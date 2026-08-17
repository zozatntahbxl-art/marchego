import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError, type ZodTypeAny } from 'zod';

/**
 * Helpers des API routes : parsing Zod, erreurs HTTP uniformes, CORS interne.
 */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function json<T>(data: T, status = 200, headers?: HeadersInit) {
  return NextResponse.json(data, { status, headers });
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return json({ error: error.message, details: error.details }, error.status);
  }
  if (error instanceof ZodError) {
    return json(
      {
        error: 'Données invalides.',
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      422,
    );
  }
  const status = typeof (error as { status?: number })?.status === 'number'
    ? (error as { status: number }).status
    : 500;
  const message =
    error instanceof Error ? error.message : 'Erreur interne du serveur.';

  if (status >= 500) {
    console.error('[api]', error);
  }
  return json({ error: message }, status);
}

export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, 'Corps JSON invalide.');
  }
  return schema.parse(raw);
}

export function parseSearch<S extends ZodTypeAny>(req: NextRequest, schema: S): z.output<S> {
  const obj = Object.fromEntries(req.nextUrl.searchParams.entries());
  return schema.parse(obj);
}

export async function withHandler(
  handler: () => Promise<NextResponse> | NextResponse,
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    return errorResponse(error);
  }
}

/** En-têtes de cache pour les ressources publiques peu volatiles (marchés). */
export const PUBLIC_CACHE = {
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
};

export function clientIp(req: Request): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  );
}
