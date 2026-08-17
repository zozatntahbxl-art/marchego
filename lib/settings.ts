import 'server-only';
import { prisma } from '@/lib/prisma';
import type { PlatformSettings } from '@prisma/client';
import { DEFAULT_PRICING, type PricingSettings } from '@/lib/pricing';

/**
 * Cache court de la configuration plateforme. Invalidé à chaque écriture
 * admin. TTL de 15 s : assez pour absorber un pic, assez court pour qu'un
 * changement de tarif soit visible presque immédiatement.
 */

let cache: { value: PlatformSettings; expiresAt: number } | null = null;
const TTL_MS = 15_000;

export async function getSettings(): Promise<PlatformSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const existing = await prisma.platformSettings.findUnique({ where: { id: 'global' } });
  const value =
    existing ??
    (await prisma.platformSettings.create({
      data: { id: 'global' },
    }));

  cache = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

export function invalidateSettingsCache() {
  cache = null;
}

export function toPricing(settings: PlatformSettings): PricingSettings {
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

export { DEFAULT_PRICING };
