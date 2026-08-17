import { json, withHandler } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { computeMarketOpening, upcomingMarketDates } from '@/lib/markets/opening';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withHandler(async () => {
    const market = await prisma.market.findFirst({
      where: { OR: [{ id: params.id }, { slug: params.id }] },
      include: { schedules: true, closures: true },
    });
    if (!market) return json({ error: 'Marché introuvable.' }, 404);
    const opening = computeMarketOpening({
      isActive: market.isActive,
      statusLocked: market.statusLocked,
      lockedStatus: market.status,
      schedules: market.schedules,
      closures: market.closures,
    });
    const dates = upcomingMarketDates(market.schedules, market.closures);
    return json({ market, opening, dates });
  });
}
