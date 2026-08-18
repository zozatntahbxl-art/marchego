import { z } from 'zod';

/**
 * Validation centralisée des variables d'environnement.
 * Les valeurs vides, entre guillemets, ou d’exemple (aBcDe, example.com, …)
 * sont ignorées pour ne pas faire échouer le build Vercel.
 */

const boolish = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const s = value.trim().replace(/^["']|["']$/g, '');
  if (!s) return undefined;
  if (s.includes('…') || s.includes('••••')) return undefined;
  if (/aBcDe|sk_live_a12|eyJhbGci…|phc_aBcDe|re_aBcDe|sntrys_|ACaBcDe/i.test(s)) return undefined;
  if (/example\.com/i.test(s)) return undefined;
  return s;
}

function asUrl(value: unknown): string | undefined {
  const s = clean(value);
  if (!s) return undefined;
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    return new URL(withProto).toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

const serverSchema = z.object({
  NODE_ENV: z.preprocess((v) => {
    const n = String(v ?? process.env.NODE_ENV ?? 'development').toLowerCase();
    return n === 'production' || n === 'test' ? n : 'development';
  }, z.enum(['development', 'production', 'test'])),

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

  GEOCODING_PROVIDER: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.enum(['nominatim', 'google']).default('nominatim'),
  ),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  NOMINATIM_BASE_URL: z.string().url().default('https://nominatim.openstreetmap.org'),
  NOMINATIM_USER_AGENT: z.string().default('MarcheGo/1.0'),

  PUSH_PROVIDER: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.enum(['onesignal', 'fcm', 'webpush', 'none']).default('none'),
  ),
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

const vercelFallback = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;

const rawClientEnv = {
  NEXT_PUBLIC_APP_URL: asUrl(process.env.NEXT_PUBLIC_APP_URL) || vercelFallback,
  NEXT_PUBLIC_APP_NAME: clean(process.env.NEXT_PUBLIC_APP_NAME),
  NEXT_PUBLIC_SUPABASE_URL: asUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: clean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
  NEXT_PUBLIC_MAP_STYLE_URL: asUrl(process.env.NEXT_PUBLIC_MAP_STYLE_URL),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: clean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
  NEXT_PUBLIC_ONESIGNAL_APP_ID: clean(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: clean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
  NEXT_PUBLIC_SENTRY_DSN: asUrl(process.env.NEXT_PUBLIC_SENTRY_DSN),
  NEXT_PUBLIC_POSTHOG_KEY: clean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
  NEXT_PUBLIC_POSTHOG_HOST: asUrl(process.env.NEXT_PUBLIC_POSTHOG_HOST),
};

const parsedClient = clientSchema.safeParse(rawClientEnv);
export const clientEnv = parsedClient.success
  ? parsedClient.data
  : clientSchema.parse({
      NEXT_PUBLIC_APP_URL: vercelFallback ?? 'http://localhost:3000',
    });

function cleanedProcessEnv() {
  const src = process.env as Record<string, string | undefined>;
  const out: Record<string, string | undefined> = { ...src };
  for (const [key, value] of Object.entries(src)) {
    const c = clean(value);
    if (value && c === undefined && /URL|DSN|HOST|KEY|TOKEN|SECRET|SID/i.test(key)) {
      out[key] = undefined;
    } else if (c !== undefined) {
      out[key] = c;
    }
  }
  if (out.NODE_ENV) out.NODE_ENV = out.NODE_ENV.toLowerCase();
  if (out.GEOCODING_PROVIDER && !['nominatim', 'google'].includes(out.GEOCODING_PROVIDER)) {
    out.GEOCODING_PROVIDER = 'nominatim';
  }
  if (out.PUSH_PROVIDER && !['onesignal', 'fcm', 'webpush', 'none'].includes(out.PUSH_PROVIDER)) {
    out.PUSH_PROVIDER = 'none';
  }
  if (!out.DIRECT_URL && out.DATABASE_URL) out.DIRECT_URL = out.DATABASE_URL;
  if (out.NOMINATIM_BASE_URL && !asUrl(out.NOMINATIM_BASE_URL)) {
    out.NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
  }
  return out;
}

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== 'undefined') {
    throw new Error("serverEnv() ne peut pas être appelé côté client.");
  }
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverSchema.safeParse(cleanedProcessEnv());
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

export const integrations = {
  get supabase() {
    return Boolean(
      clientEnv.NEXT_PUBLIC_SUPABASE_URL && clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  },
  get stripe() {
    return Boolean(clean(process.env.STRIPE_SECRET_KEY));
  },
  get resend() {
    return Boolean(clean(process.env.RESEND_API_KEY));
  },
  get twilio() {
    return Boolean(clean(process.env.TWILIO_ACCOUNT_SID) && clean(process.env.TWILIO_AUTH_TOKEN));
  },
  get push() {
    const provider = process.env.PUSH_PROVIDER;
    if (provider === 'onesignal') return Boolean(clean(process.env.ONESIGNAL_REST_API_KEY));
    if (provider === 'fcm') return Boolean(clean(process.env.FCM_SERVER_KEY));
    if (provider === 'webpush') return Boolean(clean(process.env.VAPID_PRIVATE_KEY));
    return false;
  },
};
