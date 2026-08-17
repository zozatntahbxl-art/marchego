import { roundCents } from '@/lib/utils';

/**
 * Moteur de tarification MarchéGo.
 *
 * Règles :
 *  • Tous les montants sont en centimes d'euro, entiers.
 *  • Les prix produits affichés sont TTC (usage commercial belge) : la TVA est
 *    donc **extraite** du prix, jamais ajoutée.
 *  • Taux de TVA belges : 6 % sur les denrées alimentaires, 21 % sur les
 *    prestations de service (livraison, frais de plateforme).
 *  • Les taux sont exprimés en points de base (bps) : 600 = 6 %, 1500 = 15 %.
 *
 * Ce module est volontairement pur (aucun accès base de données ni réseau)
 * afin d'être entièrement couvert par des tests unitaires.
 */

export const VAT_FOOD_BPS = 600;
export const VAT_SERVICE_BPS = 2100;

export interface PricingSettings {
  serviceFeeCents: number;
  serviceFeeBps: number;
  serviceFeeCapCents: number;
  vendorCommissionBps: number;
  minOrderCents: number;
  deliveryBaseFeeCents: number;
  deliveryPerKmCents: number;
  deliveryFreeAboveCents: number | null;
  deliveryMaxKm: number;
  courierBaseFeeCents: number;
  courierPerKmCents: number;
  courierPerVendorCents: number;
  courierMinEarningCents: number;
  surgeEnabled: boolean;
  surgeMaxBps: number;
  rainBonusCents: number;
  highDemandBonusCents: number;
  vatFoodBps: number;
  vatServiceBps: number;
}

export const DEFAULT_PRICING: PricingSettings = {
  serviceFeeCents: 199,
  serviceFeeBps: 0,
  serviceFeeCapCents: 500,
  vendorCommissionBps: 1500,
  minOrderCents: 1500,
  deliveryBaseFeeCents: 290,
  deliveryPerKmCents: 80,
  deliveryFreeAboveCents: null,
  deliveryMaxKm: 15,
  courierBaseFeeCents: 350,
  courierPerKmCents: 90,
  courierPerVendorCents: 50,
  courierMinEarningCents: 450,
  surgeEnabled: true,
  surgeMaxBps: 20000,
  rainBonusCents: 100,
  highDemandBonusCents: 150,
  vatFoodBps: VAT_FOOD_BPS,
  vatServiceBps: VAT_SERVICE_BPS,
};

export interface PriceableItem {
  productId: string;
  vendorId: string;
  quantity: number;
  unitPriceCents: number;
  /** TVA applicable ; par défaut le taux alimentaire. */
  vatRateBps?: number;
}

export interface SurgeContext {
  /** Multiplicateur global en bps (10000 = ×1,00). */
  multiplierBps?: number;
  /** Prime météo appliquée au livreur. */
  rain?: boolean;
  /** Prime « forte demande » appliquée au livreur. */
  highDemand?: boolean;
}

export interface VendorBreakdown {
  vendorId: string;
  subtotalCents: number;
  vatCents: number;
  commissionBps: number;
  commissionCents: number;
  payoutCents: number;
  itemCount: number;
}

export interface OrderQuote {
  subtotalCents: number;
  deliveryFeeCents: number;
  serviceFeeCents: number;
  tipCents: number;
  discountCents: number;
  totalCents: number;
  /** TVA totale incluse dans `totalCents`. */
  vatTotalCents: number;
  vatBreakdown: { food: number; service: number };
  vendors: VendorBreakdown[];
  vendorPayoutTotalCents: number;
  courierPayoutCents: number;
  courierBreakdown: CourierEarningBreakdown;
  platformFeeCents: number;
  surgeMultiplierBps: number;
  meetsMinimum: boolean;
  minOrderCents: number;
  missingForMinimumCents: number;
}

export interface CourierEarningBreakdown {
  baseFeeCents: number;
  distanceFeeCents: number;
  multiVendorFeeCents: number;
  bonusCents: number;
  tipCents: number;
  totalCents: number;
}

/**
 * Extrait la TVA contenue dans un montant TTC.
 * TTC = HT × (1 + t) ⇒ TVA = TTC × t / (1 + t)
 */
export function vatIncludedIn(amountTtcCents: number, vatRateBps: number): number {
  return roundCents((amountTtcCents * vatRateBps) / (10000 + vatRateBps));
}

/** Ajoute la TVA à un montant hors taxe. */
export function vatOn(amountHtCents: number, vatRateBps: number): number {
  return roundCents((amountHtCents * vatRateBps) / 10000);
}

/**
 * Frais de livraison : forfait de base + tarif kilométrique, multiplié par le
 * coefficient de tarification dynamique, puis annulé si le seuil de gratuité
 * est atteint.
 */
export function computeDeliveryFee(
  distanceKm: number,
  subtotalCents: number,
  settings: PricingSettings,
  surge: SurgeContext = {},
): { feeCents: number; multiplierBps: number } {
  const multiplierBps = resolveSurgeMultiplier(settings, surge);

  if (
    settings.deliveryFreeAboveCents !== null &&
    subtotalCents >= settings.deliveryFreeAboveCents
  ) {
    return { feeCents: 0, multiplierBps };
  }

  const billableKm = Math.min(Math.max(distanceKm, 0), settings.deliveryMaxKm);
  const raw = settings.deliveryBaseFeeCents + billableKm * settings.deliveryPerKmCents;
  return { feeCents: roundCents((raw * multiplierBps) / 10000), multiplierBps };
}

export function resolveSurgeMultiplier(
  settings: PricingSettings,
  surge: SurgeContext = {},
): number {
  if (!settings.surgeEnabled) return 10000;
  const requested = surge.multiplierBps ?? 10000;
  return Math.min(Math.max(requested, 10000), settings.surgeMaxBps);
}

/** Frais de service plateforme : forfait + pourcentage, plafonné. */
export function computeServiceFee(subtotalCents: number, settings: PricingSettings): number {
  const variable = roundCents((subtotalCents * settings.serviceFeeBps) / 10000);
  return Math.min(settings.serviceFeeCents + variable, settings.serviceFeeCapCents);
}

/** Répartition par vendeur : sous-total, commission plateforme et reversement. */
export function computeVendorBreakdown(
  items: PriceableItem[],
  settings: PricingSettings,
  commissionOverrides: Record<string, number> = {},
): VendorBreakdown[] {
  const byVendor = new Map<string, VendorBreakdown>();

  for (const item of items) {
    const lineTotal = item.unitPriceCents * item.quantity;
    const vatRate = item.vatRateBps ?? settings.vatFoodBps;
    const existing = byVendor.get(item.vendorId);

    if (existing) {
      existing.subtotalCents += lineTotal;
      existing.vatCents += vatIncludedIn(lineTotal, vatRate);
      existing.itemCount += item.quantity;
    } else {
      byVendor.set(item.vendorId, {
        vendorId: item.vendorId,
        subtotalCents: lineTotal,
        vatCents: vatIncludedIn(lineTotal, vatRate),
        commissionBps: commissionOverrides[item.vendorId] ?? settings.vendorCommissionBps,
        commissionCents: 0,
        payoutCents: 0,
        itemCount: item.quantity,
      });
    }
  }

  return Array.from(byVendor.values()).map((v) => {
    const commissionCents = roundCents((v.subtotalCents * v.commissionBps) / 10000);
    return { ...v, commissionCents, payoutCents: v.subtotalCents - commissionCents };
  });
}

/**
 * Rémunération du livreur : forfait + kilomètres + supplément par vendeur
 * supplémentaire + primes + pourboire, avec un minimum garanti par course.
 */
export function computeCourierEarning(
  distanceKm: number,
  vendorCount: number,
  tipCents: number,
  settings: PricingSettings,
  surge: SurgeContext = {},
): CourierEarningBreakdown {
  const multiplierBps = resolveSurgeMultiplier(settings, surge);

  const baseFeeCents = roundCents((settings.courierBaseFeeCents * multiplierBps) / 10000);
  const distanceFeeCents = roundCents(
    (Math.max(distanceKm, 0) * settings.courierPerKmCents * multiplierBps) / 10000,
  );
  // Le premier vendeur est inclus dans le forfait de base.
  const multiVendorFeeCents = Math.max(0, vendorCount - 1) * settings.courierPerVendorCents;

  let bonusCents = 0;
  if (surge.rain) bonusCents += settings.rainBonusCents;
  if (surge.highDemand) bonusCents += settings.highDemandBonusCents;

  const beforeMinimum = baseFeeCents + distanceFeeCents + multiVendorFeeCents + bonusCents;
  const guaranteed = Math.max(beforeMinimum, settings.courierMinEarningCents);
  // Le complément éventuel du minimum garanti est comptabilisé comme prime.
  const adjustedBonus = bonusCents + (guaranteed - beforeMinimum);

  return {
    baseFeeCents,
    distanceFeeCents,
    multiVendorFeeCents,
    bonusCents: adjustedBonus,
    tipCents,
    totalCents: guaranteed + tipCents,
  };
}

export interface QuoteInput {
  items: PriceableItem[];
  distanceKm: number;
  tipCents?: number;
  discountCents?: number;
  settings?: PricingSettings;
  surge?: SurgeContext;
  commissionOverrides?: Record<string, number>;
}

/**
 * Devis complet d'une commande : montants client, répartition vendeurs,
 * rémunération livreur et marge plateforme.
 */
export function quoteOrder({
  items,
  distanceKm,
  tipCents = 0,
  discountCents = 0,
  settings = DEFAULT_PRICING,
  surge = {},
  commissionOverrides = {},
}: QuoteInput): OrderQuote {
  const vendors = computeVendorBreakdown(items, settings, commissionOverrides);
  const subtotalCents = vendors.reduce((sum, v) => sum + v.subtotalCents, 0);
  const vatFoodCents = vendors.reduce((sum, v) => sum + v.vatCents, 0);

  const { feeCents: deliveryFeeCents, multiplierBps } = computeDeliveryFee(
    distanceKm,
    subtotalCents,
    settings,
    surge,
  );
  const serviceFeeCents = computeServiceFee(subtotalCents, settings);

  // Livraison et frais de service sont des prestations : TVA à 21 %.
  const vatServiceCents =
    vatIncludedIn(deliveryFeeCents, settings.vatServiceBps) +
    vatIncludedIn(serviceFeeCents, settings.vatServiceBps);

  const cappedDiscount = Math.min(Math.max(discountCents, 0), subtotalCents);
  const totalCents = Math.max(
    0,
    subtotalCents + deliveryFeeCents + serviceFeeCents + tipCents - cappedDiscount,
  );

  const courierBreakdown = computeCourierEarning(
    distanceKm,
    vendors.length,
    tipCents,
    settings,
    surge,
  );

  const vendorPayoutTotalCents = vendors.reduce((sum, v) => sum + v.payoutCents, 0);
  const commissionTotalCents = vendors.reduce((sum, v) => sum + v.commissionCents, 0);

  // Marge plateforme : commissions + frais de service + frais de livraison
  // encaissés, moins ce qui est reversé au livreur et la remise consentie.
  const platformFeeCents =
    commissionTotalCents +
    serviceFeeCents +
    deliveryFeeCents -
    (courierBreakdown.totalCents - courierBreakdown.tipCents) -
    cappedDiscount;

  return {
    subtotalCents,
    deliveryFeeCents,
    serviceFeeCents,
    tipCents,
    discountCents: cappedDiscount,
    totalCents,
    vatTotalCents: vatFoodCents + vatServiceCents,
    vatBreakdown: { food: vatFoodCents, service: vatServiceCents },
    vendors,
    vendorPayoutTotalCents,
    courierPayoutCents: courierBreakdown.totalCents,
    courierBreakdown,
    platformFeeCents,
    surgeMultiplierBps: multiplierBps,
    meetsMinimum: subtotalCents >= settings.minOrderCents,
    minOrderCents: settings.minOrderCents,
    missingForMinimumCents: Math.max(0, settings.minOrderCents - subtotalCents),
  };
}

/**
 * Montant remboursable lors d'une annulation.
 * Avant acceptation vendeur ou dans le délai de grâce : remboursement intégral.
 * Après : les frais de service restent acquis et des frais d'annulation
 * peuvent s'appliquer, mais jamais au-delà du montant payé.
 */
export function computeCancellationRefund(params: {
  totalCents: number;
  serviceFeeCents: number;
  secondsSinceOrder: number;
  vendorAccepted: boolean;
  courierAssigned: boolean;
  freeCancellationSeconds: number;
  cancellationFeeCents: number;
}): { refundCents: number; penaltyCents: number; reason: string } {
  const {
    totalCents,
    serviceFeeCents,
    secondsSinceOrder,
    vendorAccepted,
    courierAssigned,
    freeCancellationSeconds,
    cancellationFeeCents,
  } = params;

  if (!vendorAccepted || secondsSinceOrder <= freeCancellationSeconds) {
    return {
      refundCents: totalCents,
      penaltyCents: 0,
      reason: 'Annulation gratuite : commande non encore acceptée ou délai de grâce.',
    };
  }

  if (!courierAssigned) {
    const penalty = Math.min(serviceFeeCents, totalCents);
    return {
      refundCents: totalCents - penalty,
      penaltyCents: penalty,
      reason: 'Commande acceptée par le vendeur : les frais de service sont retenus.',
    };
  }

  const penalty = Math.min(serviceFeeCents + cancellationFeeCents, totalCents);
  return {
    refundCents: totalCents - penalty,
    penaltyCents: penalty,
    reason: 'Livreur déjà en route : frais de service et frais d’annulation retenus.',
  };
}

/**
 * Remboursement partiel pour des articles manquants ou abîmés.
 * La part de frais de service et de livraison n'est pas remboursée : le service
 * a bien été rendu pour le reste de la commande.
 */
export function computeItemRefund(
  items: Array<{ unitPriceCents: number; quantity: number }>,
): number {
  return items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
}

/**
 * Estimation de la durée totale : préparation du vendeur le plus lent, trajet
 * du livreur vers le marché, collecte chez chaque vendeur, trajet vers le
 * client. Vitesses moyennes en ville, embouteillages inclus.
 */
export const VEHICLE_SPEED_KMH: Record<string, number> = {
  A_PIED: 4.5,
  VELO: 15,
  VELO_CARGO: 13,
  SCOOTER: 22,
  VOITURE: 20,
  CAMIONNETTE: 18,
};

export function estimateDeliveryMinutes(params: {
  courierToMarketKm: number;
  marketToClientKm: number;
  vendorCount: number;
  maxPrepTimeMinutes: number;
  vehicleType?: string;
}): number {
  const speed = VEHICLE_SPEED_KMH[params.vehicleType ?? 'VELO'] ?? 15;
  const travelToMarket = (params.courierToMarketKm / speed) * 60;
  const travelToClient = (params.marketToClientKm / speed) * 60;
  // 3 minutes de collecte par étal, plus 4 minutes de remise au client.
  const pickupTime = params.vendorCount * 3;
  const handover = 4;

  // La préparation se déroule pendant que le livreur rejoint le marché.
  const untilPickupReady = Math.max(params.maxPrepTimeMinutes, travelToMarket);

  return Math.ceil(untilPickupReady + pickupTime + travelToClient + handover);
}
