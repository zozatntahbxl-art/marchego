import { NextRequest } from 'next/server';
import { json, parseBody, withHandler } from '@/lib/http';
import { loginSchema, registerSchema } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import { createServerSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { cookies } from 'next/headers';
import { mergeAnonymousCart } from '@/lib/cart';
import { consume } from '@/lib/security/rate-limit';
import { clientIp } from '@/lib/http';

export async function POST(req: NextRequest) {
  return withHandler(async () => {
    const ip = clientIp(req) ?? 'anon';
    const rl = consume(`auth:${ip}`, { max: 20, windowMs: 60_000 });
    if (!rl.allowed) return json({ error: 'Trop de tentatives.' }, 429);

    const url = new URL(req.url);
    const action = url.searchParams.get('action') ?? 'login';

    if (action === 'register') {
      const body = await parseBody(req, registerSchema);
      if (isSupabaseConfigured()) {
        const supabase = createServerSupabase()!;
        const { data, error } = await supabase.auth.signUp({
          email: body.email,
          password: body.password,
          options: { data: { firstName: body.firstName, lastName: body.lastName } },
        });
        if (error) return json({ error: error.message }, 400);
        const id = data.user?.id;
        if (!id) return json({ error: 'Inscription incomplète.' }, 500);
        await prisma.user.create({
          data: {
            id,
            supabaseId: id,
            email: body.email,
            phone: body.phone,
            roles: [body.role],
            activeRole: body.role,
            profile: {
              create: {
                firstName: body.firstName,
                lastName: body.lastName,
                language: body.language,
              },
            },
          },
        });
        return json({ ok: true, needsEmailConfirmation: !data.session });
      }

      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing) return json({ error: 'Un compte existe déjà avec cet e-mail.' }, 409);
      const user = await prisma.user.create({
        data: {
          email: body.email,
          phone: body.phone,
          roles: [body.role],
          activeRole: body.role,
          emailVerified: true,
          profile: {
            create: {
              firstName: body.firstName,
              lastName: body.lastName,
              language: body.language,
            },
          },
        },
      });
      cookies().set('mg_dev_user', user.id, { httpOnly: true, sameSite: 'lax', path: '/' });
      await mergeAnonymousCart(user.id);
      return json({ ok: true, userId: user.id });
    }

    const body = await parseBody(req, loginSchema);
    if (isSupabaseConfigured()) {
      const supabase = createServerSupabase()!;
      const { error } = await supabase.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });
      if (error) return json({ error: 'Identifiants incorrects.' }, 401);
      return json({ ok: true });
    }

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) return json({ error: 'Identifiants incorrects.' }, 401);
    cookies().set('mg_dev_user', user.id, { httpOnly: true, sameSite: 'lax', path: '/' });
    await mergeAnonymousCart(user.id);
    return json({ ok: true, userId: user.id });
  });
}

export async function DELETE() {
  return withHandler(async () => {
    if (isSupabaseConfigured()) {
      const supabase = createServerSupabase();
      await supabase?.auth.signOut();
    }
    cookies().delete('mg_dev_user');
    return json({ ok: true });
  });
}
