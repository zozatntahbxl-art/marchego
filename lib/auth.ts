import 'server-only';
import { UserRole, type User } from '@prisma/client';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { createServerSupabase, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * Résolution de l'utilisateur courant.
 *
 * Deux modes :
 *  1. Production : JWT Supabase, miroir `users.supabaseId`.
 *  2. Développement sans Supabase : cookie `mg_dev_user` posé par
 *     `/api/auth/dev-login` (désactivé si NODE_ENV=production).
 */

export type AuthUser = User & {
  profile: { firstName: string; lastName: string; language: string; avatarUrl: string | null } | null;
  vendor: { id: string; verified: boolean; status: string } | null;
  courier: { id: string; verified: boolean; status: string; online: boolean } | null;
};

const userInclude = {
  profile: { select: { firstName: true, lastName: true, language: true, avatarUrl: true } },
  vendor: { select: { id: true, verified: true, status: true } },
  courier: { select: { id: true, verified: true, status: true, online: true } },
} as const;

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (isSupabaseConfigured()) {
    const supabase = createServerSupabase();
    if (!supabase) return null;
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return null;

    const user = await prisma.user.findFirst({
      where: { OR: [{ supabaseId: authUser.id }, { id: authUser.id }] },
      include: userInclude,
    });
    return user as AuthUser | null;
  }

  if (process.env.NODE_ENV === 'production') return null;

  const devId = cookies().get('mg_dev_user')?.value;
  if (!devId) return null;
  const user = await prisma.user.findUnique({ where: { id: devId }, include: userInclude });
  return user as AuthUser | null;
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw Object.assign(new Error('Authentification requise.'), { status: 401 });
  }
  if (user.status === 'SUSPENDU' || user.status === 'DESACTIVE') {
    throw Object.assign(new Error('Compte suspendu.'), { status: 403 });
  }
  return user;
}

export async function requireRole(...roles: UserRole[]): Promise<AuthUser> {
  const user = await requireUser();
  const allowed = roles.some((r) => user.roles.includes(r));
  if (!allowed) {
    throw Object.assign(new Error('Accès refusé pour ce rôle.'), { status: 403 });
  }
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  return requireRole(UserRole.ADMIN);
}

export function hasRole(user: Pick<User, 'roles'>, role: UserRole): boolean {
  return user.roles.includes(role);
}

export function isVerifiedVendor(user: AuthUser): boolean {
  return Boolean(user.vendor?.verified && user.vendor.status === 'ACTIF');
}

export function isVerifiedCourier(user: AuthUser): boolean {
  return Boolean(user.courier?.verified && user.courier.status === 'ACTIF');
}
