import { prisma } from '@/lib/prisma';

/**
 * Requêtes de proximité déléguées à PostGIS.
 *
 * Prisma ne sait pas manipuler les colonnes `geography` : on passe donc par
 * `$queryRaw` sur les fonctions SQL définies dans la migration
 * `20250101000100_postgis_rls`.
 */

export interface NearbyMarketRow {
  market_id: string;
  distance_km: number;
}

export async function findMarketsNear(
  latitude: number,
  longitude: number,
  radiusKm?: number,
  limit = 50,
): Promise<NearbyMarketRow[]> {
  return prisma.$queryRaw<NearbyMarketRow[]>`
    SELECT market_id, distance_km
    FROM mg_markets_near(${latitude}::double precision, ${longitude}::double precision,
                         ${radiusKm ?? null}::double precision, ${limit}::integer)
  `;
}

export interface AvailableCourierRow {
  courier_id: string;
  distance_km: number;
  rating: number;
  vehicle_type: string;
  acceptance_rate: number;
}

/**
 * Livreurs éligibles pour une livraison donnée, triés par distance croissante.
 * Les exclusions (offre déjà envoyée, mission en cours, position périmée) sont
 * appliquées directement en SQL pour éviter les conditions de concurrence.
 */
export async function findAvailableCouriers(params: {
  latitude: number;
  longitude: number;
  searchRadiusKm: number;
  deliveryId: string;
  locationMaxAgeSeconds?: number;
  limit?: number;
}): Promise<AvailableCourierRow[]> {
  const {
    latitude,
    longitude,
    searchRadiusKm,
    deliveryId,
    locationMaxAgeSeconds = 300,
    limit = 20,
  } = params;

  return prisma.$queryRaw<AvailableCourierRow[]>`
    SELECT courier_id, distance_km, rating, vehicle_type, acceptance_rate
    FROM mg_couriers_available_for(
      ${latitude}::double precision,
      ${longitude}::double precision,
      ${searchRadiusKm}::double precision,
      ${deliveryId}::uuid,
      ${locationMaxAgeSeconds}::integer,
      ${limit}::integer
    )
  `;
}

/** Distance PostGIS entre deux points, en kilomètres. */
export async function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ km: number }>>`
    SELECT mg_distance_km(
      ${from.latitude}::double precision, ${from.longitude}::double precision,
      ${to.latitude}::double precision, ${to.longitude}::double precision
    ) AS km
  `;
  return rows[0]?.km ?? 0;
}

/**
 * Vérifie qu'une adresse de livraison tombe dans la zone desservie par le
 * marché (rayon défini par l'administrateur).
 */
export async function isAddressInMarketZone(
  marketId: string,
  latitude: number,
  longitude: number,
): Promise<{ allowed: boolean; distanceKm: number; zoneRadiusKm: number }> {
  const rows = await prisma.$queryRaw<
    Array<{ distance_km: number; zone_radius_km: number }>
  >`
    SELECT
      ST_Distance(m."location", ST_SetSRID(ST_MakePoint(${longitude}::double precision, ${latitude}::double precision), 4326)::geography) / 1000.0 AS distance_km,
      m."zoneRadiusKm" AS zone_radius_km
    FROM "markets" m
    WHERE m."id" = ${marketId}::uuid
  `;

  const row = rows[0];
  if (!row) return { allowed: false, distanceKm: 0, zoneRadiusKm: 0 };

  return {
    allowed: row.distance_km <= row.zone_radius_km,
    distanceKm: Number(row.distance_km.toFixed(3)),
    zoneRadiusKm: row.zone_radius_km,
  };
}

/** Dernière position connue d'un livreur pour une livraison en cours. */
export async function lastCourierPosition(deliveryId: string) {
  return prisma.courierLocationPing.findFirst({
    where: { deliveryId },
    orderBy: { recordedAt: 'desc' },
    select: {
      latitude: true,
      longitude: true,
      heading: true,
      speed: true,
      recordedAt: true,
    },
  });
}

/**
 * Nombre de commandes en attente d'un livreur autour d'un point : sert à
 * déclencher la tarification dynamique quand la demande dépasse l'offre.
 */
export async function demandPressure(
  latitude: number,
  longitude: number,
  radiusKm = 5,
): Promise<{ pendingDeliveries: number; onlineCouriers: number; ratio: number }> {
  const rows = await prisma.$queryRaw<
    Array<{ pending: bigint; couriers: bigint }>
  >`
    SELECT
      (SELECT COUNT(*) FROM "deliveries" d
        WHERE d."status" IN ('NON_ASSIGNEE', 'RECHERCHE_LIVREUR')
          AND ST_DWithin(d."pickupLocation",
                ST_SetSRID(ST_MakePoint(${longitude}::double precision, ${latitude}::double precision), 4326)::geography,
                ${radiusKm}::double precision * 1000)) AS pending,
      (SELECT COUNT(*) FROM "couriers" c
        WHERE c."online" = TRUE AND c."verified" = TRUE AND c."status" = 'ACTIF'
          AND c."currentLocation" IS NOT NULL
          AND ST_DWithin(c."currentLocation",
                ST_SetSRID(ST_MakePoint(${longitude}::double precision, ${latitude}::double precision), 4326)::geography,
                ${radiusKm}::double precision * 1000)) AS couriers
  `;

  const pendingDeliveries = Number(rows[0]?.pending ?? 0);
  const onlineCouriers = Number(rows[0]?.couriers ?? 0);
  return {
    pendingDeliveries,
    onlineCouriers,
    ratio: onlineCouriers === 0 ? pendingDeliveries : pendingDeliveries / onlineCouriers,
  };
}
