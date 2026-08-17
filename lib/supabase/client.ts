import { createBrowserClient, createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { clientEnv } from '@/lib/env';

/**
 * Clients Supabase.
 *
 *  • `createBrowserSupabase()`  — composants client (Auth, Realtime, Storage).
 *  • `createServerSupabase()`   — Server Components / Route Handlers, cookies.
 *  • `createServiceClient()`    — tâches serveur (webhooks, cron) : bypasse RLS.
 *
 * Si les variables publiques ne sont pas configurées, on renvoie `null` pour
 * permettre le développement hors Supabase (seed Prisma + auth de démo).
 */

export function isSupabaseConfigured(): boolean {
  const url = clientEnv.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) return false;
  if (url.includes('xxxxxxxxxxxx') || key === 'eyJhbGciOi...') return false;
  return url.startsWith('https://') && key.length > 20;
}

export function createBrowserSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL!,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export function createServerSupabase() {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = cookies();
  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL!,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Appelé depuis un Server Component en lecture seule : ignoré,
            // le middleware rafraîchit la session de son côté.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            /* idem */
          }
        },
      },
    },
  );
}

let serviceClient: SupabaseClient | null | undefined;

export function createServiceClient(): SupabaseClient | null {
  if (serviceClient !== undefined) return serviceClient;
  const url = clientEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    serviceClient = null;
    return null;
  }
  serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}
