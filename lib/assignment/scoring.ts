import type { VehicleType } from '@prisma/client';
import { clamp } from '@/lib/utils';

/**
 * Algorithme d'assignation des livreurs — cœur pur, sans I/O.
 *
 * Stratégie :
 *  1. Identifier les livreurs éligibles dans un rayon de recherche (fait en SQL).
 *  2. Les scorer (distance, note, taux d'acceptation, type de véhicule).
 *  3. Envoyer une offre aux N meilleurs, avec un délai d'expiration de 30 s.
 *  4. Premier acceptant gagne. Refus / timeout → vague suivante, rayon élargi
 *     et rémunération éventuellement augmentée (surge).
 *
 * Ce module calcule le score et décide de l'escalade ; l'orchestration (envoi
 * des offres, notifications, persistance) vit dans `lib/assignment/orchestrator.ts`.
 */

export interface AssignmentSettings {
  offerTimeoutSeconds: number;
  initialSearchRadiusKm: number;
  radiusIncrementKm: number;
  maxSearchRadiusKm: number;
  maxSearchWaves: number;
  offersPerWave: number;
  scheduledAssignLeadMinutes: number;
}

export const DEFAULT_ASSIGNMENT: AssignmentSettings = {
  offerTimeoutSeconds: 30,
  initialSearchRadiusKm: 3,
  radiusIncrementKm: 2,
  maxSearchRadiusKm: 12,
  maxSearchWaves: 5,
  offersPerWave: 3,
  scheduledAssignLeadMinutes: 30,
};

export interface CourierCandidate {
  courierId: string;
  distanceKm: number;
  rating: number;
  vehicleType: VehicleType | string;
  acceptanceRate: number;
}

export interface ScoredCourier extends CourierCandidate {
  score: number;
  breakdown: {
    distance: number;
    rating: number;
    acceptance: number;
    vehicle: number;
  };
}

/**
 * Pondération du type de véhicule : un vélo-cargo est idéal pour les courses
 * de marché (volume), une voiture est plus lente en centre-ville mais utile
 * pour les longs trajets. Le score est un bonus, pas un filtre dur.
 */
const VEHICLE_SCORE: Record<string, number> = {
  VELO_CARGO: 1,
  VELO: 0.85,
  SCOOTER: 0.7,
  A_PIED: 0.4,
  VOITURE: 0.55,
  CAMIONNETTE: 0.5,
};

export interface ScoringWeights {
  distance: number;
  rating: number;
  acceptance: number;
  vehicle: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  distance: 0.5,
  rating: 0.25,
  acceptance: 0.15,
  vehicle: 0.1,
};

/**
 * Score ∈ [0, 1]. Distance : 1 au marché, 0 au-delà de `maxDistanceKm`.
 * Note : 5 → 1, 1 → 0. Taux d'acceptation déjà ∈ [0, 1].
 */
export function scoreCourier(
  candidate: CourierCandidate,
  maxDistanceKm: number,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): ScoredCourier {
  const distance = clamp(1 - candidate.distanceKm / Math.max(maxDistanceKm, 0.1), 0, 1);
  const rating = clamp((candidate.rating - 1) / 4, 0, 1);
  const acceptance = clamp(candidate.acceptanceRate, 0, 1);
  const vehicle = VEHICLE_SCORE[candidate.vehicleType] ?? 0.5;

  const score =
    weights.distance * distance +
    weights.rating * rating +
    weights.acceptance * acceptance +
    weights.vehicle * vehicle;

  return {
    ...candidate,
    score: Number(score.toFixed(4)),
    breakdown: { distance, rating, acceptance, vehicle },
  };
}

export function rankCouriers(
  candidates: CourierCandidate[],
  maxDistanceKm: number,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): ScoredCourier[] {
  return candidates
    .map((c) => scoreCourier(c, maxDistanceKm, weights))
    .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);
}

/** Sélectionne les N meilleurs encore jamais sollicités pour cette livraison. */
export function selectForWave(
  ranked: ScoredCourier[],
  alreadyOfferedIds: Set<string>,
  offersPerWave: number,
): ScoredCourier[] {
  return ranked.filter((c) => !alreadyOfferedIds.has(c.courierId)).slice(0, offersPerWave);
}

export interface WavePlan {
  wave: number;
  radiusKm: number;
  /** Multiplicateur de rémunération en bps (10000 = ×1). */
  surgeBps: number;
  done: boolean;
  reason?: string;
}

/**
 * Planifie la vague suivante. Au-delà de `maxSearchWaves` ou du rayon max,
 * l'assignation est considérée comme échouée : l'admin est alerté et le
 * client peut être remboursé.
 *
 * Le surge augmente de 10 % à chaque vague à partir de la 3ᵉ
 * (vague 0–1 : ×1,00 ; vague 2 : ×1,10 ; vague 3 : ×1,20…).
 */
export function nextWave(
  currentWave: number,
  settings: AssignmentSettings,
  surgeMaxBps = 20000,
): WavePlan {
  const next = currentWave + 1;

  if (next >= settings.maxSearchWaves) {
    return {
      wave: currentWave,
      radiusKm: settings.maxSearchRadiusKm,
      surgeBps: 10000,
      done: true,
      reason: 'Nombre maximal de vagues atteint. Aucun livreur n’a accepté.',
    };
  }

  const radiusKm = Math.min(
    settings.initialSearchRadiusKm + next * settings.radiusIncrementKm,
    settings.maxSearchRadiusKm,
  );

  const extraWaves = Math.max(0, next - 1);
  const surgeBps = Math.min(10000 + extraWaves * 1000, surgeMaxBps);

  return { wave: next, radiusKm, surgeBps, done: false };
}

export function initialWave(settings: AssignmentSettings): WavePlan {
  return {
    wave: 0,
    radiusKm: settings.initialSearchRadiusKm,
    surgeBps: 10000,
    done: false,
  };
}

/**
 * Instant auquel lancer la recherche de livreur pour une commande planifiée :
 * `scheduledFor - leadMinutes`. Si cet instant est déjà passé, on lance
 * immédiatement.
 */
export function scheduledSearchAt(scheduledFor: Date, leadMinutes: number, now = new Date()): Date {
  const at = new Date(scheduledFor.getTime() - leadMinutes * 60_000);
  return at < now ? now : at;
}

export function offerExpiresAt(timeoutSeconds: number, now = new Date()): Date {
  return new Date(now.getTime() + timeoutSeconds * 1000);
}

/**
 * Cas limite : le livreur qui avait accepté se désiste. On relance une
 * recherche en repartant de la vague 0, mais en l'excluant définitivement
 * (géré par l'orchestrateur via `alreadyOfferedIds`).
 */
export function restartAfterDrop(): WavePlan {
  return { wave: 0, radiusKm: DEFAULT_ASSIGNMENT.initialSearchRadiusKm, surgeBps: 10000, done: false };
}
