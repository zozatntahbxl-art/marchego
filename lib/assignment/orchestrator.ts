import 'server-only';
import { prisma } from '@/lib/prisma';
import { findAvailableCouriers } from '@/lib/geo/queries';
import { computeCourierEarning, type PricingSettings } from '@/lib/pricing';
import { getSettings } from '@/lib/settings';
import { notify } from '@/lib/notifications';
import { broadcastOrderUpdate } from '@/lib/realtime/broadcast';
import {
  DEFAULT_ASSIGNMENT,
  initialWave,
  nextWave,
  offerExpiresAt,
  rankCouriers,
  selectForWave,
  type AssignmentSettings,
} from '@/lib/assignment/scoring';
import { assertTransition } from '@/lib/orders/status';

/**
 * Orchestrateur d'assignation.
 *
 * Appelé :
 *  • à la création d'une commande ASAP, dès que tous les vendeurs sont prêts ;
 *  • par le cron `/api/cron/assign` toutes les 10 secondes, pour :
 *      - expirer les offres dépassées,
 *      - lancer la vague suivante,
 *      - démarrer la recherche des commandes planifiées.
 *
 * Concurrence : chaque livraison est traitée dans une transaction avec un
 * verrou pessimiste (`SELECT … FOR UPDATE`) pour qu'un livreur ne puisse pas
 * accepter deux fois, ni deux livreurs la même mission.
 */

function assignmentFrom(settings: Awaited<ReturnType<typeof getSettings>>): AssignmentSettings {
  return {
    offerTimeoutSeconds: settings.offerTimeoutSeconds,
    initialSearchRadiusKm: settings.initialSearchRadiusKm,
    radiusIncrementKm: settings.radiusIncrementKm,
    maxSearchRadiusKm: settings.maxSearchRadiusKm,
    maxSearchWaves: settings.maxSearchWaves,
    offersPerWave: settings.offersPerWave,
    scheduledAssignLeadMinutes: settings.scheduledAssignLeadMinutes,
  };
}

function pricingFrom(settings: Awaited<ReturnType<typeof getSettings>>): PricingSettings {
  return {
    serviceFeeCents: settings.serviceFeeCents,
    serviceFeeBps: settings.serviceFeeBps,
    serviceFeeCapCents: settings.serviceFeeCapCents,
    vendorCommissionBps: settings.vendorCommissionBps,
    minOrderCents: settings.minOrderCents,
    deliveryBaseFeeCents: settings.deliveryBaseFeeCents,
    deliveryPerKmCents: settings.deliveryPerKmCents,
    deliveryFreeAboveCents: settings.deliveryFreeAboveCents,
    deliveryMaxKm: settings.deliveryMaxKm,
    courierBaseFeeCents: settings.courierBaseFeeCents,
    courierPerKmCents: settings.courierPerKmCents,
    courierPerVendorCents: settings.courierPerVendorCents,
    courierMinEarningCents: settings.courierMinEarningCents,
    surgeEnabled: settings.surgeEnabled,
    surgeMaxBps: settings.surgeMaxBps,
    rainBonusCents: settings.rainBonusCents,
    highDemandBonusCents: settings.highDemandBonusCents,
    vatFoodBps: settings.vatFoodBps,
    vatServiceBps: settings.vatServiceBps,
  };
}

/** Démarre (ou relance) la recherche de livreur pour une livraison. */
export async function startCourierSearch(deliveryId: string): Promise<void> {
  const settings = await getSettings();
  const assignment = assignmentFrom(settings);
  const wave = initialWave(assignment);

  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status: 'RECHERCHE_LIVREUR',
      searchWave: wave.wave,
      searchRadiusKm: wave.radiusKm,
      searchStartedAt: new Date(),
      courierId: null,
      assignedAt: null,
    },
  });

  await dispatchWave(deliveryId);
}

/**
 * Traite une vague : identifie les candidats, envoie les offres, notifie.
 * Si personne n'est trouvé, on passe immédiatement à la vague suivante
 * (pas la peine d'attendre 30 s dans le vide).
 */
export async function dispatchWave(deliveryId: string): Promise<{ offered: number; escalated: boolean }> {
  const settings = await getSettings();
  const assignment = assignmentFrom(settings);
  const pricing = pricingFrom(settings);

  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      order: {
        include: { vendorOrders: true, market: true },
      },
      offers: { select: { courierId: true, status: true } },
    },
  });

  if (!delivery || !delivery.order) {
    return { offered: 0, escalated: false };
  }
  if (!['NON_ASSIGNEE', 'RECHERCHE_LIVREUR'].includes(delivery.status)) {
    return { offered: 0, escalated: false };
  }

  const alreadyOffered = new Set(delivery.offers.map((o) => o.courierId));
  const candidates = await findAvailableCouriers({
    latitude: delivery.pickupLatitude,
    longitude: delivery.pickupLongitude,
    searchRadiusKm: delivery.searchRadiusKm,
    deliveryId,
  });

  const ranked = rankCouriers(
    candidates.map((c) => ({
      courierId: c.courier_id,
      distanceKm: Number(c.distance_km),
      rating: Number(c.rating),
      vehicleType: c.vehicle_type,
      acceptanceRate: Number(c.acceptance_rate),
    })),
    delivery.searchRadiusKm,
  );
  const selected = selectForWave(ranked, alreadyOffered, assignment.offersPerWave);

  if (selected.length === 0) {
    return escalate(deliveryId, assignment, settings.surgeMaxBps);
  }

  const vendorCount = delivery.order.vendorOrders.length;
  const expiresAt = offerExpiresAt(assignment.offerTimeoutSeconds);

  await prisma.$transaction(async (tx) => {
    for (const courier of selected) {
      const earning = computeCourierEarning(
        delivery.distanceKm,
        vendorCount,
        delivery.order.tipCents,
        pricing,
        { multiplierBps: 10000 + Math.max(0, delivery.searchWave - 1) * 1000 },
      );

      await tx.deliveryOffer.create({
        data: {
          deliveryId,
          courierId: courier.courierId,
          wave: delivery.searchWave,
          score: courier.score,
          distanceToMarketKm: courier.distanceKm,
          estimatedEarningCents: earning.totalCents,
          expiresAt,
        },
      });

      await tx.courier.update({
        where: { id: courier.courierId },
        data: { receivedOffers: { increment: 1 } },
      });
    }
  });

  // Notifications hors transaction : un échec d'envoi ne doit pas bloquer
  // l'offre, le livreur la verra de toute façon via Realtime.
  const couriers = await prisma.courier.findMany({
    where: { id: { in: selected.map((c) => c.courierId) } },
    select: { id: true, userId: true },
  });

  await Promise.all(
    couriers.map((c) =>
      notify({
        userId: c.userId,
        type: 'NOUVELLE_MISSION_LIVREUR',
        title: 'Nouvelle course près de vous',
        body: `${delivery.order.market.name} · ${delivery.distanceKm.toFixed(1)} km · ${delivery.order.vendorOrders.length} étal${delivery.order.vendorOrders.length > 1 ? 's' : ''}`,
        data: { deliveryId, orderId: delivery.orderId, expiresAt: expiresAt.toISOString() },
        actionUrl: `/livreur/missions/${deliveryId}`,
        channels: ['IN_APP', 'PUSH', 'SMS'],
      }),
    ),
  );

  return { offered: selected.length, escalated: false };
}

async function escalate(
  deliveryId: string,
  assignment: AssignmentSettings,
  surgeMaxBps: number,
): Promise<{ offered: number; escalated: boolean }> {
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) return { offered: 0, escalated: false };

  const plan = nextWave(delivery.searchWave, assignment, surgeMaxBps);
  if (plan.done) {
    await failAssignment(deliveryId, plan.reason ?? 'Aucun livreur disponible.');
    return { offered: 0, escalated: true };
  }

  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      searchWave: plan.wave,
      searchRadiusKm: plan.radiusKm,
    },
  });

  return dispatchWave(deliveryId);
}

async function failAssignment(deliveryId: string, reason: string) {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: { order: { select: { id: true, clientId: true, reference: true } } },
  });
  if (!delivery?.order) return;

  await prisma.$transaction([
    prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: 'ECHOUEE', failedAt: new Date(), failureReason: reason },
    }),
    prisma.order.update({
      where: { id: delivery.order.id },
      data: { status: 'EN_ATTENTE_DE_LIVREUR' },
    }),
    prisma.auditLog.create({
      data: {
        action: 'ASSIGNATION_ECHOUEE',
        targetType: 'Delivery',
        targetId: deliveryId,
        metadata: { reason },
      },
    }),
  ]);

  await notify({
    userId: delivery.order.clientId,
    type: 'SYSTEME',
    title: 'Recherche de livreur en cours',
    body: `Nous élargissons la recherche pour la commande ${delivery.order.reference}. Vous serez prévenu dès qu’un livreur sera trouvé.`,
    data: { orderId: delivery.order.id },
    actionUrl: `/commandes/${delivery.order.id}`,
  });
}

/**
 * Un livreur accepte une offre. Transaction sérialisée : si un autre a déjà
 * accepté entre-temps, on refuse poliment.
 */
export async function acceptOffer(offerId: string, courierUserId: string) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.deliveryOffer.findUnique({
      where: { id: offerId },
      include: {
        courier: { select: { id: true, userId: true } },
        delivery: {
          include: {
            order: {
              include: {
                vendorOrders: { include: { vendor: { select: { userId: true, businessName: true } } } },
                client: { select: { id: true } },
                market: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!offer) throw Object.assign(new Error('Offre introuvable.'), { status: 404 });
    if (offer.courier.userId !== courierUserId) {
      throw Object.assign(new Error('Cette offre ne vous est pas destinée.'), { status: 403 });
    }
    if (offer.status !== 'ENVOYEE') {
      throw Object.assign(new Error('Cette offre n’est plus valable.'), { status: 409 });
    }
    if (offer.expiresAt.getTime() < Date.now()) {
      await tx.deliveryOffer.update({
        where: { id: offerId },
        data: { status: 'EXPIREE', respondedAt: new Date() },
      });
      throw Object.assign(new Error('Délai d’acceptation dépassé.'), { status: 410 });
    }
    if (offer.delivery.courierId) {
      throw Object.assign(new Error('Un autre livreur a déjà accepté cette course.'), { status: 409 });
    }

    const now = new Date();

    await tx.deliveryOffer.update({
      where: { id: offerId },
      data: { status: 'ACCEPTEE', respondedAt: now },
    });

    await tx.deliveryOffer.updateMany({
      where: {
        deliveryId: offer.deliveryId,
        id: { not: offerId },
        status: 'ENVOYEE',
      },
      data: { status: 'ANNULEE' },
    });

    await tx.delivery.update({
      where: { id: offer.deliveryId },
      data: {
        courierId: offer.courierId,
        status: 'ASSIGNEE',
        assignedAt: now,
        totalEarningCents: offer.estimatedEarningCents,
      },
    });

    await tx.courier.update({
      where: { id: offer.courierId },
      data: { acceptedOffers: { increment: 1 } },
    });

    assertTransition(offer.delivery.order.status, 'LIVREUR_ASSIGNE');
    await tx.order.update({
      where: { id: offer.delivery.orderId },
      data: { status: 'LIVREUR_ASSIGNE' },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: offer.delivery.orderId,
        status: 'LIVREUR_ASSIGNE',
        authorId: courierUserId,
        authorRole: 'LIVREUR',
        note: 'Livreur assigné',
      },
    });

    return offer;
  }).then(async (offer) => {
    await Promise.all([
      notify({
        userId: offer.delivery.order.clientId,
        type: 'LIVREUR_ASSIGNE',
        title: 'Un livreur est en route',
        body: `Votre commande ${offer.delivery.order.reference} a un livreur. Il se dirige vers ${offer.delivery.order.market.name}.`,
        data: { orderId: offer.delivery.orderId, deliveryId: offer.deliveryId },
        actionUrl: `/commandes/${offer.delivery.orderId}`,
      }),
      ...offer.delivery.order.vendorOrders.map((vo) =>
        notify({
          userId: vo.vendor.userId,
          type: 'LIVREUR_ASSIGNE',
          title: 'Livreur en approche',
          body: `Un livreur va récupérer la commande ${offer.delivery.order.reference}.`,
          data: { orderId: offer.delivery.orderId, vendorOrderId: vo.id },
          actionUrl: `/vendeur/commandes/${vo.id}`,
        }),
      ),
      broadcastOrderUpdate(offer.delivery.orderId, 'LIVREUR_ASSIGNE'),
    ]);
    return offer;
  });
}

export async function refuseOffer(offerId: string, courierUserId: string, reason?: string) {
  const offer = await prisma.deliveryOffer.findUnique({
    where: { id: offerId },
    include: { courier: { select: { userId: true } } },
  });
  if (!offer) throw Object.assign(new Error('Offre introuvable.'), { status: 404 });
  if (offer.courier.userId !== courierUserId) {
    throw Object.assign(new Error('Cette offre ne vous est pas destinée.'), { status: 403 });
  }
  if (offer.status !== 'ENVOYEE') return offer;

  await prisma.deliveryOffer.update({
    where: { id: offerId },
    data: { status: 'REFUSEE', respondedAt: new Date(), refusalReason: reason },
  });

  // Si plus aucune offre n'est en cours, on enchaîne sur la vague suivante.
  const remaining = await prisma.deliveryOffer.count({
    where: { deliveryId: offer.deliveryId, status: 'ENVOYEE', expiresAt: { gt: new Date() } },
  });
  if (remaining === 0) {
    const settings = await getSettings();
    await escalate(offer.deliveryId, assignmentFrom(settings), settings.surgeMaxBps);
  }

  return offer;
}

/**
 * Balaye les livraisons en recherche : expire les offres, relance les vagues,
 * démarre les commandes planifiées dont le créneau approche.
 */
export async function tickAssignmentWorker(): Promise<{
  expired: number;
  dispatched: number;
  scheduledStarted: number;
}> {
  const now = new Date();
  const settings = await getSettings();
  const assignment = assignmentFrom(settings);

  const expired = await prisma.deliveryOffer.updateMany({
    where: { status: 'ENVOYEE', expiresAt: { lte: now } },
    data: { status: 'EXPIREE', respondedAt: now },
  });

  const searching = await prisma.delivery.findMany({
    where: { status: 'RECHERCHE_LIVREUR' },
    select: { id: true },
  });

  let dispatched = 0;
  for (const d of searching) {
    const live = await prisma.deliveryOffer.count({
      where: { deliveryId: d.id, status: 'ENVOYEE', expiresAt: { gt: now } },
    });
    if (live === 0) {
      await escalate(d.id, assignment, settings.surgeMaxBps);
      dispatched += 1;
    }
  }

  const leadMs = assignment.scheduledAssignLeadMinutes * 60_000;
  const scheduled = await prisma.order.findMany({
    where: {
      slotType: 'PLANIFIE',
      status: 'PREPAREE',
      scheduledFor: { lte: new Date(now.getTime() + leadMs) },
      delivery: { status: 'NON_ASSIGNEE' },
    },
    select: { delivery: { select: { id: true } } },
  });

  let scheduledStarted = 0;
  for (const o of scheduled) {
    if (!o.delivery) continue;
    await startCourierSearch(o.delivery.id);
    scheduledStarted += 1;
  }

  return { expired: expired.count, dispatched, scheduledStarted };
}

/**
 * Le livreur se désiste après avoir accepté. On relance la recherche en
 * l'excluant (son offre ACCEPTEE reste dans l'historique).
 */
export async function dropAssignment(deliveryId: string, courierUserId: string, reason: string) {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: { courier: true, order: true },
  });
  if (!delivery?.courier || delivery.courier.userId !== courierUserId) {
    throw Object.assign(new Error('Vous n’êtes pas assigné à cette course.'), { status: 403 });
  }
  if (!['ASSIGNEE', 'EN_ROUTE_VERS_MARCHE'].includes(delivery.status)) {
    throw Object.assign(new Error('Il n’est plus possible de se désister.'), { status: 409 });
  }

  await prisma.$transaction([
    prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        courierId: null,
        assignedAt: null,
        status: 'RECHERCHE_LIVREUR',
        searchWave: 0,
        searchRadiusKm: DEFAULT_ASSIGNMENT.initialSearchRadiusKm,
        searchStartedAt: new Date(),
        failureReason: reason,
      },
    }),
    prisma.order.update({
      where: { id: delivery.orderId },
      data: { status: 'EN_ATTENTE_DE_LIVREUR' },
    }),
    prisma.orderStatusHistory.create({
      data: {
        orderId: delivery.orderId,
        status: 'EN_ATTENTE_DE_LIVREUR',
        authorId: courierUserId,
        authorRole: 'LIVREUR',
        note: `Livreur désisté : ${reason}`,
      },
    }),
  ]);

  await startCourierSearch(deliveryId);
}
