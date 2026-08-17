import { json, withHandler } from '@/lib/http';
import { tickAssignmentWorker } from '@/lib/assignment/orchestrator';
import { prisma } from '@/lib/prisma';
import { computeMarketOpening } from '@/lib/markets/opening';
import { safeEqual } from '@/lib/security/crypto';
import { serverEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorize(req: Request) {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!safeEqual(token, serverEnv().CRON_SECRET)) {
    throw Object.assign(new Error('Non autorisé.'), { status: 401 });
  }
}

export async function GET(req: Request) {
  return withHandler(async () => {
    authorize(req);

    const assignment = await tickAssignmentWorker();

    const markets = await prisma.market.findMany({
      where: { isActive: true, statusLocked: false },
      include: { schedules: true, closures: true },
    });
    let updated = 0;
    for (const m of markets) {
      const opening = computeMarketOpening({
        isActive: m.isActive,
        statusLocked: false,
        schedules: m.schedules,
        closures: m.closures,
      });
      if (opening.status !== m.status) {
        await prisma.market.update({ where: { id: m.id }, data: { status: opening.status } });
        updated += 1;
      }
    }

    await prisma.cart.deleteMany({ where: { expiresAt: { lt: new Date() } } });

    return json({ ok: true, assignment, marketsUpdated: updated });
  });
}
