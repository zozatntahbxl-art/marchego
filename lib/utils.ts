import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convertit des centimes en chaîne monétaire localisée (€, format belge). */
export function formatCents(cents: number, locale = 'fr-BE'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

/** Arrondi bancaire au centime le plus proche (évite les biais d'arrondi). */
export function roundCents(value: number): number {
  const floored = Math.floor(value);
  const diff = value - floored;
  if (Math.abs(diff - 0.5) > Number.EPSILON) return Math.round(value);
  return floored % 2 === 0 ? floored : floored + 1;
}

export function formatDistance(km: number, locale = 'fr-BE'): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(km)} km`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/**
 * Slug URL-safe : retire les diacritiques, remplace tout le reste par « - ».
 * « Fromagerie Van Dijck » → « fromagerie-van-dijck »
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const REFERENCE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Référence lisible sans caractères ambigus (0/O, 1/I/L).
 * Format : MG-XXXXXX
 */
export function generateReference(prefix = 'MG'): string {
  let out = '';
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i += 1) {
    out += REFERENCE_ALPHABET[bytes[i] % REFERENCE_ALPHABET.length];
  }
  return `${prefix}-${out}`;
}

function randomBytes(size: number): Uint8Array {
  const arr = new Uint8Array(size);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(arr);
    return arr;
  }
  for (let i = 0; i < size; i += 1) arr[i] = Math.floor(Math.random() * 256);
  return arr;
}

/** Code numérique à n chiffres (PIN de livraison, code de retrait). */
export function generateNumericCode(length = 4): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => String(b % 10)).join('');
}

export function initials(firstName?: string | null, lastName?: string | null): string {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

/** Masque un numéro de téléphone pour l'affichage : +32 4xx xx xx 89 */
export function maskPhone(phone: string): string {
  if (phone.length < 4) return '•••';
  return `${'•'.repeat(Math.max(0, phone.length - 2))}${phone.slice(-2)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Découpe un tableau en lots de taille fixe. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function groupBy<T, K extends string | number>(
  items: T[],
  key: (item: T) => K,
): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] ||= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Date au format ISO `YYYY-MM-DD` dans le fuseau de Bruxelles. */
export function toISODate(date: Date, timeZone = 'Europe/Brussels'): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/** `HH:mm` dans le fuseau de Bruxelles. */
export function toLocalTime(date: Date, timeZone = 'Europe/Brussels'): string {
  return new Intl.DateTimeFormat('fr-BE', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Jour de la semaine (0 = dimanche) dans le fuseau de Bruxelles. */
export function localDayOfWeek(date: Date, timeZone = 'Europe/Brussels'): number {
  const label = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(label);
}

/** Convertit `HH:mm` en minutes depuis minuit. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}
