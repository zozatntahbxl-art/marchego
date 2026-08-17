import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { serverEnv } from '@/lib/env';

/**
 * Chiffrement des données sensibles au repos (IBAN, numéro de registre
 * national, références de documents).
 *
 * Algorithme : AES-256-GCM, IV aléatoire de 12 octets, tag d'authentification
 * de 16 octets. Format stocké : `v1:<iv b64>:<tag b64>:<ciphertext b64>`.
 */

const VERSION = 'v1';
const IV_LENGTH = 12;

function key(): Buffer {
  return Buffer.from(serverEnv().ENCRYPTION_KEY, 'hex');
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(
    ':',
  );
}

export function decrypt(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(':');
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Charge chiffrée invalide ou de version inconnue.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Chiffre une valeur optionnelle ; `null`/`undefined` restent inchangés. */
export function encryptNullable(value: string | null | undefined): string | null {
  return value ? encrypt(value) : null;
}

export function decryptNullable(value: string | null | undefined): string | null {
  return value ? decrypt(value) : null;
}

// ─── Hachage de secrets courts (PIN, codes de vérification) ──────────────────

/**
 * Hache un code court avec scrypt et un sel aléatoire. Un simple SHA-256 serait
 * cassable par force brute sur un espace de 10 000 combinaisons.
 */
export function hashCode(code: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(code, salt, 32);
  return `${salt.toString('base64')}:${derived.toString('base64')}`;
}

export function verifyCode(code: string, stored: string): boolean {
  const [saltB64, hashB64] = stored.split(':');
  if (!saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(code, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(expected, actual);
}

// ─── Jetons signés (liens de suivi publics, tâches cron) ─────────────────────

export function signPayload(payload: string): string {
  return createHmac('sha256', serverEnv().APP_SECRET).update(payload).digest('base64url');
}

export function verifySignature(payload: string, signature: string): boolean {
  const expected = Buffer.from(signPayload(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/** Jeton opaque destiné aux paniers anonymes et aux liens de suivi. */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

/** Comparaison à temps constant de deux chaînes (secrets de webhook, cron). */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
