import { PrismaClient } from '@prisma/client';

/**
 * Instance Prisma unique.
 *
 * En développement, Next.js recharge les modules à chaud : on conserve
 * l'instance sur `globalThis` pour éviter d'épuiser le pool de connexions.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [{ level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }]
        : [{ level: 'error', emit: 'stdout' }],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type { Prisma } from '@prisma/client';
export * from '@prisma/client';
