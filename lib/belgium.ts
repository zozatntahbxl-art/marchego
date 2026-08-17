/**
 * Règles de validation et de formatage propres à la Belgique :
 * IBAN, numéro d'entreprise / TVA, téléphone, code postal, jours fériés.
 */

// ─── IBAN ────────────────────────────────────────────────────────────────────

/** Normalise un IBAN : majuscules, sans espaces. */
export function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase();
}

/**
 * Validation IBAN par la méthode modulo 97 (norme ISO 13616).
 * Un IBAN belge fait exactement 16 caractères : BE + 2 clés + 12 chiffres.
 */
export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  if (iban.startsWith('BE') && iban.length !== 16) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));

  // Modulo 97 par blocs, pour éviter le dépassement de Number.MAX_SAFE_INTEGER.
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** BE68 5390 0754 7034 — format lisible par groupes de 4. */
export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})/g, '$1 ').trim();
}

export function ibanLast4(iban: string): string {
  return normalizeIban(iban).slice(-4);
}

// ─── Numéro d'entreprise / TVA ───────────────────────────────────────────────

/** Normalise un numéro de TVA belge vers la forme `BE0123456789`. */
export function normalizeVatNumber(vat: string): string {
  const cleaned = vat.replace(/[\s.\-]/g, '').toUpperCase();
  const digits = cleaned.startsWith('BE') ? cleaned.slice(2) : cleaned;
  // Les anciens numéros à 9 chiffres sont préfixés d'un zéro.
  const padded = digits.length === 9 ? `0${digits}` : digits;
  return `BE${padded}`;
}

/**
 * Un numéro d'entreprise belge est composé de 10 chiffres commençant par 0 ou 1.
 * Les 2 derniers chiffres sont une clé de contrôle : 97 - (8 premiers mod 97).
 */
export function isValidVatNumber(input: string): boolean {
  const vat = normalizeVatNumber(input);
  if (!/^BE[01][0-9]{9}$/.test(vat)) return false;
  const digits = vat.slice(2);
  const base = Number(digits.slice(0, 8));
  const checksum = Number(digits.slice(8, 10));
  return 97 - (base % 97) === checksum;
}

export function formatVatNumber(vat: string): string {
  const v = normalizeVatNumber(vat);
  return `${v.slice(0, 2)} ${v.slice(2, 6)}.${v.slice(6, 9)}.${v.slice(9)}`;
}

// ─── Téléphone ───────────────────────────────────────────────────────────────

/**
 * Convertit un numéro belge vers le format E.164 (+32...).
 * Accepte `0470 12 34 56`, `+32470123456`, `0032 470 123 456`.
 * Renvoie `null` si le numéro n'est pas un numéro belge plausible.
 */
export function toE164Belgian(input: string): string | null {
  const cleaned = input.replace(/[\s.\-()/]/g, '');
  let national: string;

  if (cleaned.startsWith('+32')) national = cleaned.slice(3);
  else if (cleaned.startsWith('0032')) national = cleaned.slice(4);
  else if (cleaned.startsWith('32') && cleaned.length >= 11) national = cleaned.slice(2);
  else if (cleaned.startsWith('0')) national = cleaned.slice(1);
  else return null;

  if (!/^[1-9][0-9]{7,8}$/.test(national)) return null;

  // Mobiles : 4xx xx xx xx (9 chiffres). Fixes : 8 chiffres (2xx, 3xx…).
  const isMobile = national.startsWith('4') && national.length === 9;
  const isLandline = !national.startsWith('4') && national.length === 8;
  if (!isMobile && !isLandline) return null;

  return `+32${national}`;
}

export function isBelgianMobile(e164: string): boolean {
  return /^\+324[0-9]{8}$/.test(e164);
}

/** +32 470 12 34 56 */
export function formatPhone(e164: string): string {
  if (!e164.startsWith('+32')) return e164;
  const n = e164.slice(3);
  if (n.length === 9) return `+32 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
  return `+32 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
}

// ─── Code postal ─────────────────────────────────────────────────────────────

/** Les codes postaux belges vont de 1000 à 9992. */
export function isValidBelgianPostalCode(code: string): boolean {
  const n = Number(code);
  return /^[1-9][0-9]{3}$/.test(code) && n >= 1000 && n <= 9992;
}

/** Région administrative déduite du code postal (utile pour la TVA locale). */
export function regionFromPostalCode(code: string): 'BRUXELLES' | 'FLANDRE' | 'WALLONIE' | null {
  const n = Number(code);
  if (Number.isNaN(n)) return null;
  if (n >= 1000 && n <= 1299) return 'BRUXELLES';
  if ((n >= 1300 && n <= 1499) || (n >= 4000 && n <= 7999)) return 'WALLONIE';
  if ((n >= 1500 && n <= 3999) || (n >= 8000 && n <= 9999)) return 'FLANDRE';
  return null;
}

// ─── Jours fériés ────────────────────────────────────────────────────────────

/** Calcul de la date de Pâques (algorithme de Meeus/Jones/Butcher). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export interface BelgianHoliday {
  date: Date;
  nameFr: string;
  nameNl: string;
  nameDe: string;
  nameEn: string;
}

/** Les 10 jours fériés légaux belges pour une année donnée. */
export function belgianHolidays(year: number): BelgianHoliday[] {
  const easter = easterSunday(year);
  const utc = (m: number, d: number) => new Date(Date.UTC(year, m - 1, d));

  return [
    { date: utc(1, 1), nameFr: "Nouvel An", nameNl: 'Nieuwjaar', nameDe: 'Neujahr', nameEn: "New Year's Day" },
    { date: addDays(easter, 1), nameFr: 'Lundi de Pâques', nameNl: 'Paasmaandag', nameDe: 'Ostermontag', nameEn: 'Easter Monday' },
    { date: utc(5, 1), nameFr: 'Fête du Travail', nameNl: 'Feest van de Arbeid', nameDe: 'Tag der Arbeit', nameEn: 'Labour Day' },
    { date: addDays(easter, 39), nameFr: 'Ascension', nameNl: 'Onze-Lieve-Heer-Hemelvaart', nameDe: 'Christi Himmelfahrt', nameEn: 'Ascension Day' },
    { date: addDays(easter, 50), nameFr: 'Lundi de Pentecôte', nameNl: 'Pinkstermaandag', nameDe: 'Pfingstmontag', nameEn: 'Whit Monday' },
    { date: utc(7, 21), nameFr: 'Fête nationale', nameNl: 'Nationale feestdag', nameDe: 'Nationalfeiertag', nameEn: 'National Day' },
    { date: utc(8, 15), nameFr: 'Assomption', nameNl: 'Onze-Lieve-Vrouw-Hemelvaart', nameDe: 'Mariä Himmelfahrt', nameEn: 'Assumption Day' },
    { date: utc(11, 1), nameFr: 'Toussaint', nameNl: 'Allerheiligen', nameDe: 'Allerheiligen', nameEn: "All Saints' Day" },
    { date: utc(11, 11), nameFr: 'Armistice', nameNl: 'Wapenstilstand', nameDe: 'Waffenstillstand', nameEn: 'Armistice Day' },
    { date: utc(12, 25), nameFr: 'Noël', nameNl: 'Kerstmis', nameDe: 'Weihnachten', nameEn: 'Christmas Day' },
  ];
}

export function isBelgianHoliday(date: Date): boolean {
  const iso = date.toISOString().slice(0, 10);
  return belgianHolidays(date.getUTCFullYear()).some(
    (h) => h.date.toISOString().slice(0, 10) === iso,
  );
}
