import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ASSIGNMENT,
  initialWave,
  nextWave,
  rankCouriers,
  scheduledSearchAt,
  selectForWave,
} from '@/lib/assignment/scoring';

describe('scoring livreurs', () => {
  const candidates = [
    { courierId: 'far', distanceKm: 9, rating: 5, vehicleType: 'VOITURE', acceptanceRate: 0.9 },
    { courierId: 'cargo', distanceKm: 1.2, rating: 4.8, vehicleType: 'VELO_CARGO', acceptanceRate: 0.85 },
    { courierId: 'bike', distanceKm: 2, rating: 4.2, vehicleType: 'VELO', acceptanceRate: 0.6 },
  ];

  it('classe le vélo-cargo proche en tête', () => {
    const ranked = rankCouriers(candidates, 12);
    expect(ranked[0].courierId).toBe('cargo');
    expect(ranked[0].score).toBeGreaterThan(ranked[2].score);
  });

  it('exclut les livreurs déjà sollicités d’une vague', () => {
    const ranked = rankCouriers(candidates, 12);
    const wave = selectForWave(ranked, new Set(['cargo']), 2);
    expect(wave.map((c) => c.courierId)).not.toContain('cargo');
    expect(wave).toHaveLength(2);
  });
});

describe('vagues', () => {
  it('démarre à 3 km sans surge', () => {
    const w = initialWave(DEFAULT_ASSIGNMENT);
    expect(w.wave).toBe(0);
    expect(w.radiusKm).toBe(3);
    expect(w.surgeBps).toBe(10000);
    expect(w.done).toBe(false);
  });

  it('élargit le rayon et applique un surge à partir de la 3ᵉ vague', () => {
    const w2 = nextWave(1, DEFAULT_ASSIGNMENT);
    expect(w2.wave).toBe(2);
    expect(w2.radiusKm).toBe(7);
    expect(w2.surgeBps).toBe(11000);

    const last = nextWave(4, DEFAULT_ASSIGNMENT);
    expect(last.done).toBe(true);
  });

  it('lance immédiatement une recherche si le créneau est trop proche', () => {
    const now = new Date('2026-08-17T10:00:00Z');
    const scheduled = new Date('2026-08-17T10:10:00Z');
    expect(scheduledSearchAt(scheduled, 30, now).getTime()).toBe(now.getTime());
  });
});
