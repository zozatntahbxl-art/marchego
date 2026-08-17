export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Distance orthodromique (formule de haversine), en kilomètres.
 * Utilisée côté client et pour les estimations rapides ; les requêtes en base
 * s'appuient sur PostGIS (`ST_Distance`) qui est plus précis sur l'ellipsoïde.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Distance routière estimée : la distance à vol d'oiseau sous-estime
 * systématiquement le trajet réel en ville. Le facteur 1,35 correspond à
 * l'indice de sinuosité observé dans les centres urbains belges.
 */
export const URBAN_DETOUR_FACTOR = 1.35;

export function estimateRoadKm(a: LatLng, b: LatLng): number {
  return Number((haversineKm(a, b) * URBAN_DETOUR_FACTOR).toFixed(3));
}

/** Boîte englobante approximative, pratique pour pré-filtrer côté client. */
export function boundingBox(center: LatLng, radiusKm: number) {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos(toRad(center.latitude)));
  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLng: center.longitude - lngDelta,
    maxLng: center.longitude + lngDelta,
  };
}

export function isWithinRadius(a: LatLng, b: LatLng, radiusKm: number): boolean {
  return haversineKm(a, b) <= radiusKm;
}

/** Vérifie que des coordonnées tombent dans l'emprise de la Belgique. */
export const BELGIUM_BOUNDS = {
  minLat: 49.49,
  maxLat: 51.51,
  minLng: 2.54,
  maxLng: 6.41,
};

export function isInBelgium(point: LatLng): boolean {
  return (
    point.latitude >= BELGIUM_BOUNDS.minLat &&
    point.latitude <= BELGIUM_BOUNDS.maxLat &&
    point.longitude >= BELGIUM_BOUNDS.minLng &&
    point.longitude <= BELGIUM_BOUNDS.maxLng
  );
}

/** Centre géographique de la Belgique — position de repli sans géolocalisation. */
export const BELGIUM_CENTER: LatLng = { latitude: 50.6402, longitude: 4.6667 };

export const MAJOR_CITIES: Array<LatLng & { name: string; postalCode: string }> = [
  { name: 'Bruxelles', postalCode: '1000', latitude: 50.8467, longitude: 4.3525 },
  { name: 'Anvers', postalCode: '2000', latitude: 51.2194, longitude: 4.4025 },
  { name: 'Gand', postalCode: '9000', latitude: 51.0543, longitude: 3.7174 },
  { name: 'Charleroi', postalCode: '6000', latitude: 50.4114, longitude: 4.4446 },
  { name: 'Liège', postalCode: '4000', latitude: 50.6326, longitude: 5.5797 },
  { name: 'Bruges', postalCode: '8000', latitude: 51.2093, longitude: 3.2247 },
  { name: 'Namur', postalCode: '5000', latitude: 50.4674, longitude: 4.8718 },
  { name: 'Louvain', postalCode: '3000', latitude: 50.8798, longitude: 4.7005 },
  { name: 'Mons', postalCode: '7000', latitude: 50.4542, longitude: 3.9563 },
  { name: 'Malines', postalCode: '2800', latitude: 51.0259, longitude: 4.4776 },
];

/** Lien de navigation externe (Google Maps sur mobile, plans web sinon). */
export function navigationUrl(destination: LatLng, label?: string): string {
  const query = `${destination.latitude},${destination.longitude}`;
  const params = new URLSearchParams({
    api: '1',
    destination: query,
    travelmode: 'bicycling',
  });
  if (label) params.set('destination_place_id', '');
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Cap (bearing) en degrés de `from` vers `to`, pour orienter une icône. */
export function bearing(from: LatLng, to: LatLng): number {
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/**
 * Interpolation linéaire entre deux points : lisse le déplacement du marqueur
 * livreur entre deux relevés GPS.
 */
export function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  const clamped = Math.min(Math.max(t, 0), 1);
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * clamped,
    longitude: a.longitude + (b.longitude - a.longitude) * clamped,
  };
}
