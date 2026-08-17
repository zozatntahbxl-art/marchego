import { z } from 'zod';

/**
 * Validation centralisée des variables d'environnement.
 *
 * Les variables serveur ne sont lues que côté serveur ; y accéder depuis un
 * composant client lève une erreur explicite plutôt que de renvoyer
 * silencieusement `undefined`.
 */

const boolish = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  APP_SECRET: z.string().min(16, 'APP_SECRET doit faire au moins 16 caractères'),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY doit être 64 caractères hexadécimaux'),

  DATABASE_URL: z.string().min(10, 'DATABASE_URL est requis'),
  DIRECT_URL: z.string().min(10).optional(),

  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  SUPABASE_BUCKET_PRODUCTS: z.string().default('products'),
  SUPABASE_BUCKET_DOCUMENTS: z.string().default('documents'),
  SUPABASE_BUCKET_PROOFS: z.string().default('delivery-proofs'),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_TAX_CODE_FOOD: z.string().default('txcd_40060003'),
  STRIPE_TAX_CODE_SERVICE: z.string().default('txcd_20030000'),
  STRIPE_ENABLE_TAX: boolish,

  GEOCODING_PROVIDER: z.enum(['nominatim', 'google']).default('nominatim'),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  NOMINATIM_BASE_URL: z.string().url().default('https://nominatim.openstreetmap.org'),
  NOMINATIM_USER_AGENT: z.string().default('MarcheGo/1.0'),

  PUSH_PROVIDER: z.enum(['onesignal', 'fcm', 'webpush', 'none']).default('none'),
  ONESIGNAL_REST_API_KEY: z.string().optional(),
  FCM_PROJECT_ID: z.string().optional(),
  FCM_SERVER_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('MarchéGo <no-reply@marchego.be>'),
  EMAIL_REPLY_TO: z.string().optional(),
  EMAIL_ADMIN: z.string().optional(),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),

  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),

  CRON_SECRET: z.string().min(8).default('dev-cron-secret'),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().default('MarchéGo'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_MAP_STYLE_URL: z
    .string()
    .default('https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
  NEXT_PUBLIC_ONESIGNAL_APP_ID: z.string().optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().default('https://eu.i.posthog.com'),
});

// Next.js remplace `process.env.NEXT_PUBLIC_*` à la compilation : il faut donc
// les référencer littéralement plutôt que dynamiquement.
const rawClientEnv = {
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  NEXT_PUBLIC_ONESIGNAL_APP_ID: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
};

function emptyToUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === '' ? undefined : v]),
  ) as T;
}

const parsedClient = clientSchema.safeParse(emptyToUndefined(rawClientEnv));
if (!parsedClient.success) {
  throw new Error(
    `Variables d'environnement publiques invalides :\n${parsedClient.error.issues
      .map((i) => ` • ${i.path.join('.')} — ${i.message}`)
      .join('\n')}`,
  );
}

export const clientEnv = parsedClient.data;

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

/**
 * Accès paresseux aux variables serveur : la validation n'est déclenchée qu'au
 * premier usage réel, ce qui évite de casser le build quand seules les pages
 * publiques sont rendues.
 */
export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== 'undefined') {
    throw new Error("serverEnv() ne peut pas être appelé côté client.");
  }
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverSchema.safeParse(emptyToUndefined(process.env as Record<string, unknown>));
  if (!parsed.success) {
    throw new Error(
      `Variables d'environnement serveur invalides :\n${parsed.error.issues
        .map((i) => ` • ${i.path.join('.')} — ${i.message}`)
        .join('\n')}`,
    );
  }
  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

export const isProduction = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test';

/** Indique si une intégration tierce est configurée (dégradation gracieuse). */
export const integrations = {
  get supabase() {
    return Boolean(
      clientEnv.NEXT_PUBLIC_SUPABASE_URL && clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  },
  get stripe() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  },
  get resend() {
    return Boolean(process.env.RESEND_API_KEY);
  },
  get twilio() {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  },
  get push() {
    const provider = process.env.PUSH_PROVIDER;
    if (provider === 'onesignal') return Boolean(process.env.ONESIGNAL_REST_API_KEY);
    if (provider === 'fcm') return Boolean(process.env.FCM_SERVER_KEY);
    if (provider === 'webpush') return Boolean(process.env.VAPID_PRIVATE_KEY);
    return false;
  },
};
