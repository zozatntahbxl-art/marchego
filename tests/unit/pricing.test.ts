import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRICING,
  computeCancellationRefund,
  computeCourierEarning,
  computeDeliveryFee,
  computeServiceFee,
  estimateDeliveryMinutes,
  quoteOrder,
  vatIncludedIn,
} from '@/lib/pricing';

describe('TVA belge extraite du TTC', () => {
  it('extrait 6 % d’un montant alimentaire', () => {
    // 100,00 € TTC à 6 % → TVA = 10000 * 600 / 10600 ≈ 566
    expect(vatIncludedIn(10_000, 600)).toBe(566);
  });

  it('extrait 21 % d’une prestation', () => {
    expect(vatIncludedIn(1_210, 2100)).toBe(210);
  });
});

describe('quoteOrder', () => {
  const items = [
    { productId: 'p1', vendorId: 'v1', quantity: 2, unitPriceCents: 495 },
    { productId: 'p2', vendorId: 'v2', quantity: 1, unitPriceCents: 1290 },
  ];

  it('respecte le minimum de commande', () => {
    const tooSmall = quoteOrder({
      items: [{ productId: 'p', vendorId: 'v', quantity: 1, unitPriceCents: 500 }],
      distanceKm: 3,
    });
    expect(tooSmall.meetsMinimum).toBe(false);
    expect(tooSmall.missingForMinimumCents).toBe(DEFAULT_PRICING.minOrderCents - 500);
  });

  it('calcule un devis multi-vendeurs cohérent', () => {
    const quote = quoteOrder({ items, distanceKm: 4.2, tipCents: 100 });
    expect(quote.subtotalCents).toBe(495 * 2 + 1290);
    expect(quote.vendors).toHaveLength(2);
    expect(quote.totalCents).toBe(
      quote.subtotalCents + quote.deliveryFeeCents + quote.serviceFeeCents + quote.tipCents,
    );
    expect(quote.courierPayoutCents).toBeGreaterThanOrEqual(DEFAULT_PRICING.courierMinEarningCents);
    expect(quote.vendorPayoutTotalCents + quote.vendors.reduce((s, v) => s + v.commissionCents, 0)).toBe(
      quote.subtotalCents,
    );
  });

  it('annule les frais de livraison au-dessus du seuil', () => {
    const { feeCents } = computeDeliveryFee(5, 50_000, {
      ...DEFAULT_PRICING,
      deliveryFreeAboveCents: 40_000,
    });
    expect(feeCents).toBe(0);
  });

  it('plafonne les frais de service', () => {
    expect(
      computeServiceFee(1_000_000, { ...DEFAULT_PRICING, serviceFeeBps: 1000 }),
    ).toBe(DEFAULT_PRICING.serviceFeeCapCents);
  });
});

describe('rémunération livreur', () => {
  it('applique le minimum garanti', () => {
    const earning = computeCourierEarning(0.2, 1, 0, DEFAULT_PRICING);
    expect(earning.totalCents).toBe(DEFAULT_PRICING.courierMinEarningCents);
  });

  it('ajoute primes pluie et forte demande', () => {
    const earning = computeCourierEarning(8, 3, 200, DEFAULT_PRICING, {
      rain: true,
      highDemand: true,
    });
    expect(earning.bonusCents).toBeGreaterThanOrEqual(
      DEFAULT_PRICING.rainBonusCents + DEFAULT_PRICING.highDemandBonusCents,
    );
    expect(earning.tipCents).toBe(200);
  });
});

describe('annulation', () => {
  it('rembourse intégralement dans le délai de grâce', () => {
    const r = computeCancellationRefund({
      totalCents: 2500,
      serviceFeeCents: 199,
      secondsSinceOrder: 30,
      vendorAccepted: true,
      courierAssigned: false,
      freeCancellationSeconds: 120,
      cancellationFeeCents: 200,
    });
    expect(r.refundCents).toBe(2500);
    expect(r.penaltyCents).toBe(0);
  });

  it('retient les frais si un livreur est déjà assigné', () => {
    const r = computeCancellationRefund({
      totalCents: 2500,
      serviceFeeCents: 199,
      secondsSinceOrder: 600,
      vendorAccepted: true,
      courierAssigned: true,
      freeCancellationSeconds: 120,
      cancellationFeeCents: 200,
    });
    expect(r.penaltyCents).toBe(399);
    expect(r.refundCents).toBe(2101);
  });
});

describe('ETA', () => {
  it('arrondit à la minute supérieure', () => {
    const minutes = estimateDeliveryMinutes({
      courierToMarketKm: 2,
      marketToClientKm: 4,
      vendorCount: 2,
      maxPrepTimeMinutes: 15,
      vehicleType: 'VELO_CARGO',
    });
    expect(minutes).toBeGreaterThan(15);
  });
});
