import 'server-only';
import { DeliveryStatus, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateNumericCode, generateReference } from '@/lib/utils';
import { hashCode } from '@/lib/security/crypto';
import { quoteOrder } from '@/lib/pricing';
import { getSettings, toPricing } from '@/lib/settings';
import { isAddressInMarketZone } from '@/lib/geo/queries';
import { estimateRoadKm } from '@/lib/geo';
import { notify } from '@/lib/notifications';
import { createPaymentIntentForOrder } from '@/lib/stripe/payments';
import { integrations } from '@/lib/env';

export async function createOrderFromCart(params: {
  userId: string;
  cartId: string;
  addressId: string;
  slotType: 'ASAP' | 'PLANIFIE';
  scheduledFor?: Date;
  tipCents: number;
  customerNote?: string;
}) {
  const [cart, address, settingsRow] = await Promise.all([
    prisma.cart.findUnique({
      where: { id: params.cartId },
      include: {
        market: true,
        items: {
          include: { product: { include: { category: true, vendor: true } } },
        },
      },
    }),
    prisma.address.findFirst({
      where: { id: params.addressId, userId: params.userId },
    }),
    getSettings(),
  ]);

  if (!cart || cart.items.length === 0) {
    throw Object.assign(new Error('Votre panier est vide.'), { status: 400 });
  }
  if (cart.userId && cart.userId !== params.userId) {
    throw Object.assign(new Error('Ce panier ne vous appartient pas.'), { status: 403 });
  }
  if (!address) {
    throw Object.assign(new Error('Adresse introuvable.'), { status: 404 });
  }

  const zone = await isAddressInMarketZone(cart.marketId, address.latitude, address.longitude);
  if (!zone.allowed) {
    throw Object.assign(
      new Error(
        `Cette adresse est hors zone de livraison (${zone.distanceKm.toFixed(1)} km, max ${zone.zoneRadiusKm} km).`,
      ),
      { status: 422 },
    );
  }

  const settings = toPricing(settingsRow);
  const distanceKm = estimateRoadKm(
    { latitude: cart.market.latitude, longitude: cart.market.longitude },
    { latitude: address.latitude, longitude: address.longitude },
  );

  const items = cart.items.map((i) => ({
    productId: i.productId,
    vendorId: i.product.vendorId,
    quantity: i.quantity,
    unitPriceCents: i.unitPriceCents,
    vatRateBps: i.product.vatRateBps ?? i.product.category.vatRateBps,
  }));

  const quote = quoteOrder({
    items,
    distanceKm,
    tipCents: params.tipCents,
    settings,
    commissionOverrides: Object.fromEntries(
      cart.items
        .map((i) => i.product.vendor)
        .filter((v, idx, arr) => arr.findIndex((x) => x.id === v.id) === idx)
        .map((v) => [v.id, v.commissionBpsOverride ?? settings.vendorCommissionBps]),
    ),
  });

  if (!quote.meetsMinimum) {
    throw Object.assign(
      new Error(`Minimum de commande non atteint (${(quote.minOrderCents / 100).toFixed(2)} €).`),
      { status: 422 },
    );
  }

  const pin = generateNumericCode(4);
  const pickupCodes = new Map<string, string>();
  for (const v of quote.vendors) pickupCodes.set(v.vendorId, generateNumericCode(4));

  const order = await prisma.$transaction(async (tx) => {
    // Revalider le stock sous verrou.
    for (const item of cart.items) {
      const avail = await tx.marketProductAvailability.findFirst({
        where: {
          productId: item.productId,
          marketId: cart.marketId,
          isAvailable: true,
          OR: [{ date: cart.marketDate }, { date: null }],
        },
        orderBy: { date: 'desc' },
      });
      if (!avail || avail.stock < item.quantity) {
        throw Object.assign(
          new Error(`Stock insuffisant pour « ${item.product.name} ».`),
          { status: 409 },
        );
      }
      await tx.marketProductAvailability.update({
        where: { id: avail.id },
        data: { stock: { decrement: item.quantity } },
      });
    }

    const created = await tx.order.create({
      data: {
        reference: generateReference('MG'),
        clientId: params.userId,
        marketId: cart.marketId,
        marketDate: cart.marketDate,
        status: 'EN_ATTENTE',
        paymentStatus: 'EN_ATTENTE',
        subtotalCents: quote.subtotalCents,
        deliveryFeeCents: quote.deliveryFeeCents,
        serviceFeeCents: quote.serviceFeeCents,
        tipCents: quote.tipCents,
        discountCents: quote.discountCents,
        vatTotalCents: quote.vatTotalCents,
        totalCents: quote.totalCents,
        vendorPayoutCents: quote.vendorPayoutTotalCents,
        courierPayoutCents: quote.courierPayoutCents,
        platformFeeCents: quote.platformFeeCents,
        surgeMultiplierBps: quote.surgeMultiplierBps,
        deliveryAddressId: address.id,
        deliveryAddressSnapshot: {
          label: address.label,
          street: address.street,
          houseNumber: address.houseNumber,
          boxNumber: address.boxNumber,
          city: address.city,
          postalCode: address.postalCode,
          instructions: address.instructions,
          deliveryPin: pin,
        } as Prisma.InputJsonValue,
        deliveryLatitude: address.latitude,
        deliveryLongitude: address.longitude,
        deliveryDistanceKm: distanceKm,
        slotType: params.slotType,
        scheduledFor: params.scheduledFor,
        customerNote: params.customerNote,
        statusHistory: {
          create: { status: 'EN_ATTENTE', authorId: params.userId, authorRole: 'CLIENT' },
        },
        delivery: {
          create: {
            status: 'NON_ASSIGNEE',
            pickupLatitude: cart.market.latitude,
            pickupLongitude: cart.market.longitude,
            dropoffLatitude: address.latitude,
            dropoffLongitude: address.longitude,
            distanceKm,
            pinCodeHash: hashCode(pin),
            baseFeeCents: quote.courierBreakdown.baseFeeCents,
            distanceFeeCents: quote.courierBreakdown.distanceFeeCents,
            bonusCents: quote.courierBreakdown.bonusCents,
            tipCents: quote.courierBreakdown.tipCents,
            totalEarningCents: quote.courierBreakdown.totalCents,
          },
        },
      },
    });

    for (const vendor of quote.vendors) {
      const vendorItems = cart.items.filter((i) => i.product.vendorId === vendor.vendorId);
      const stall = await tx.marketVendor.findUnique({
        where: { marketId_vendorId: { marketId: cart.marketId, vendorId: vendor.vendorId } },
      });

      const vo = await tx.vendorOrder.create({
        data: {
          orderId: created.id,
          vendorId: vendor.vendorId,
          subtotalCents: vendor.subtotalCents,
          commissionBps: vendor.commissionBps,
          commissionCents: vendor.commissionCents,
          payoutCents: vendor.payoutCents,
          stallNumber: stall?.stallNumber,
          pickupCode: pickupCodes.get(vendor.vendorId)!,
        },
      });

      await tx.orderItem.createMany({
        data: vendorItems.map((i) => ({
          orderId: created.id,
          vendorOrderId: vo.id,
          vendorId: vendor.vendorId,
          productId: i.productId,
          productName: i.product.name,
          productUnit: i.product.unit,
          productImage: i.product.images[0] ?? null,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
          vatRateBps: i.product.vatRateBps ?? i.product.category.vatRateBps,
          vatCents: Math.round(
            ((i.unitPriceCents * i.quantity) *
              (i.product.vatRateBps ?? i.product.category.vatRateBps)) /
              (10000 + (i.product.vatRateBps ?? i.product.category.vatRateBps)),
          ),
          totalCents: i.unitPriceCents * i.quantity,
          note: i.note,
        })),
      });
    }

    await tx.cart.delete({ where: { id: cart.id } });
    return created;
  });

  const vendors = await prisma.vendor.findMany({
    where: { id: { in: quote.vendors.map((v) => v.vendorId) } },
    select: { userId: true, businessName: true },
  });

  await Promise.all([
    notify({
      userId: params.userId,
      type: 'COMMANDE_CONFIRMEE',
      title: 'Commande confirmée',
      body: `Votre commande ${order.reference} a bien été enregistrée.`,
      data: { orderId: order.id, pin },
      actionUrl: `/commandes/${order.id}`,
      channels: ['IN_APP', 'PUSH', 'EMAIL'],
    }),
    ...vendors.map((v) =>
      notify({
        userId: v.userId,
        type: 'NOUVELLE_COMMANDE_VENDEUR',
        title: 'Nouvelle commande',
        body: `Commande ${order.reference} à préparer.`,
        data: { orderId: order.id },
        actionUrl: `/vendeur/commandes`,
        channels: ['IN_APP', 'PUSH'],
      }),
    ),
  ]);

  let clientSecret: string | null = null;
  if (integrations.stripe) {
    const intent = await createPaymentIntentForOrder(order.id);
    clientSecret = intent.client_secret;
  } else {
    // Mode démo : on simule un paiement réussi pour débloquer le flux.
    await prisma.payment.create({
      data: {
        orderId: order.id,
        amountCents: order.totalCents,
        status: 'PAYE',
        paymentMethodType: 'demo',
        paidAt: new Date(),
      },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'PAYE' },
    });
  }

  return { order, clientSecret, deliveryPin: pin };
}

export type { OrderStatus, PaymentStatus, DeliveryStatus };
