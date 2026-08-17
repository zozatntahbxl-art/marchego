import 'server-only';
import { serverEnv } from '@/lib/env';
import { isInBelgium, type LatLng } from '@/lib/geo';

/**
 * Géocodage d'adresses belges.
 *
 * Deux fournisseurs sont pris en charge :
 *  • Nominatim (OpenStreetMap) — gratuit, sans clé, limité à 1 req/s. Défaut.
 *  • Google Geocoding — plus précis, nécessite `GOOGLE_MAPS_API_KEY`.
 *
 * Les résultats sont mis en cache en mémoire : les mêmes adresses reviennent
 * constamment (marchés, adresses enregistrées) et Nominatim impose un quota.
 */

export interface GeocodeResult extends LatLng {
  formattedAddress: string;
  street: string;
  houseNumber: string;
  city: string;
  postalCode: string;
  country: string;
  confidence: number;
}

const cache = new Map<string, { value: GeocodeResult | null; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Nominatim exige au maximum une requête par seconde.
let lastNominatimCall = 0;
const NOMINATIM_MIN_INTERVAL_MS = 1100;

function cacheKey(parts: object): string {
  return JSON.stringify(parts).toLowerCase();
}

function readCache(key: string): GeocodeResult | null | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function writeCache(key: string, value: GeocodeResult | null) {
  if (cache.size > 2000) cache.clear();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export interface AddressInput {
  street: string;
  houseNumber?: string;
  postalCode: string;
  city: string;
  country?: string;
}

export async function geocodeAddress(address: AddressInput): Promise<GeocodeResult | null> {
  const key = cacheKey(address);
  const cached = readCache(key);
  if (cached !== undefined) return cached;

  const provider = serverEnv().GEOCODING_PROVIDER;
  const result =
    provider === 'google' && serverEnv().GOOGLE_MAPS_API_KEY
      ? await geocodeWithGoogle(address)
      : await geocodeWithNominatim(address);

  writeCache(key, result);
  return result;
}

export async function reverseGeocode(point: LatLng): Promise<GeocodeResult | null> {
  const key = cacheKey({ rev: true, ...point });
  const cached = readCache(key);
  if (cached !== undefined) return cached;

  const provider = serverEnv().GEOCODING_PROVIDER;
  const result =
    provider === 'google' && serverEnv().GOOGLE_MAPS_API_KEY
      ? await reverseWithGoogle(point)
      : await reverseWithNominatim(point);

  writeCache(key, result);
  return result;
}

// ─── Nominatim ───────────────────────────────────────────────────────────────

async function throttleNominatim() {
  const elapsed = Date.now() - lastNominatimCall;
  if (elapsed < NOMINATIM_MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, NOMINATIM_MIN_INTERVAL_MS - elapsed));
  }
  lastNominatimCall = Date.now();
}

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
  importance?: number;
  address?: Record<string, string>;
}

async function geocodeWithNominatim(address: AddressInput): Promise<GeocodeResult | null> {
  await throttleNominatim();
  const env = serverEnv();

  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
    countrycodes: (address.country ?? 'BE').toLowerCase(),
    street: `${address.houseNumber ?? ''} ${address.street}`.trim(),
    postalcode: address.postalCode,
    city: address.city,
  });

  try {
    const res = await fetch(`${env.NOMINATIM_BASE_URL}/search?${params}`, {
      headers: { 'User-Agent': env.NOMINATIM_USER_AGENT, 'Accept-Language': 'fr-BE,fr' },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const places = (await res.json()) as NominatimPlace[];
    const place = places[0];
    if (!place) return null;
    return mapNominatim(place, address);
  } catch {
    return null;
  }
}

async function reverseWithNominatim(point: LatLng): Promise<GeocodeResult | null> {
  await throttleNominatim();
  const env = serverEnv();

  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    lat: String(point.latitude),
    lon: String(point.longitude),
  });

  try {
    const res = await fetch(`${env.NOMINATIM_BASE_URL}/reverse?${params}`, {
      headers: { 'User-Agent': env.NOMINATIM_USER_AGENT, 'Accept-Language': 'fr-BE,fr' },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const place = (await res.json()) as NominatimPlace;
    if (!place?.lat) return null;
    return mapNominatim(place);
  } catch {
    return null;
  }
}

function mapNominatim(place: NominatimPlace, fallback?: AddressInput): GeocodeResult | null {
  const a = place.address ?? {};
  const latitude = Number(place.lat);
  const longitude = Number(place.lon);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

  return {
    latitude,
    longitude,
    formattedAddress: place.display_name,
    street: a.road ?? a.pedestrian ?? fallback?.street ?? '',
    houseNumber: a.house_number ?? fallback?.houseNumber ?? '',
    city: a.city ?? a.town ?? a.village ?? a.municipality ?? fallback?.city ?? '',
    postalCode: a.postcode ?? fallback?.postalCode ?? '',
    country: (a.country_code ?? 'be').toUpperCase(),
    confidence: place.importance ?? (a.house_number ? 0.9 : 0.6),
  };
}

// ─── Google ──────────────────────────────────────────────────────────────────

interface GoogleGeocodeResponse {
  status: string;
  results: Array<{
    formatted_address: string;
    geometry: { location: { lat: number; lng: number }; location_type: string };
    address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
  }>;
}

const GOOGLE_CONFIDENCE: Record<string, number> = {
  ROOFTOP: 1,
  RANGE_INTERPOLATED: 0.85,
  GEOMETRIC_CENTER: 0.6,
  APPROXIMATE: 0.4,
};

async function callGoogle(params: URLSearchParams): Promise<GeocodeResult | null> {
  params.set('key', serverEnv().GOOGLE_MAPS_API_KEY ?? '');
  params.set('language', 'fr');
  params.set('region', 'be');

  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GoogleGeocodeResponse;
    if (data.status !== 'OK' || !data.results[0]) return null;

    const r = data.results[0];
    const get = (type: string) =>
      r.address_components.find((c) => c.types.includes(type))?.long_name ?? '';

    return {
      latitude: r.geometry.location.lat,
      longitude: r.geometry.location.lng,
      formattedAddress: r.formatted_address,
      street: get('route'),
      houseNumber: get('street_number'),
      city: get('locality') || get('postal_town'),
      postalCode: get('postal_code'),
      country:
        r.address_components.find((c) => c.types.includes('country'))?.short_name ?? 'BE',
      confidence: GOOGLE_CONFIDENCE[r.geometry.location_type] ?? 0.5,
    };
  } catch {
    return null;
  }
}

function geocodeWithGoogle(address: AddressInput) {
  const line = [
    `${address.houseNumber ?? ''} ${address.street}`.trim(),
    `${address.postalCode} ${address.city}`,
    address.country ?? 'Belgique',
  ]
    .filter(Boolean)
    .join(', ');
  return callGoogle(new URLSearchParams({ address: line, components: 'country:BE' }));
}

function reverseWithGoogle(point: LatLng) {
  return callGoogle(new URLSearchParams({ latlng: `${point.latitude},${point.longitude}` }));
}

/**
 * Géocode une adresse et refuse le résultat s'il tombe hors de Belgique ou si
 * la confiance est insuffisante pour livrer au bon endroit.
 */
export async function geocodeBelgianAddress(
  address: AddressInput,
): Promise<{ ok: true; result: GeocodeResult } | { ok: false; error: string }> {
  const result = await geocodeAddress(address);

  if (!result) {
    return { ok: false, error: "Adresse introuvable. Vérifiez la rue, le numéro et la commune." };
  }
  if (!isInBelgium(result)) {
    return { ok: false, error: 'MarchéGo ne livre actuellement qu’en Belgique.' };
  }
  if (result.confidence < 0.4) {
    return {
      ok: false,
      error: "Adresse trop imprécise pour garantir la livraison. Ajoutez le numéro de rue.",
    };
  }
  return { ok: true, result };
}
