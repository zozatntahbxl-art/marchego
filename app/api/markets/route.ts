import { NextRequest } from 'next/server';
import { json, parseSearch, withHandler } from '@/lib/http';
import { marketQuerySchema } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import { findMarketsNear } from '@/lib/geo/queries';
import { computeMarketOpening } from '@/lib/markets/opening';
import { PUBLIC_CACHE } from '@/lib/http';

export async function GET(req: NextRequest) {
  return withHandler(async () => {
    const q = parseSearch(req, marketQuerySchema);

    let ids: string[] | undefined;
    const distances = new Map<string, number>();
    if (q.lat != null && q.lng != null) {
      const nearby = await findMarketsNear(q.lat, q.lng, q.radiusKm);
      ids = nearby.map((n) => n.market_id);
      nearby.forEach((n) => distances.set(n.market_id, n.distance_km));
    }

    const markets = await prisma.market.findMany({
      where: {
        isActive: true,
        ...(ids ? { id: { in: ids } } : {}),
        ...(q.city ? { city: { contains: q.city, mode: 'insensitive' } } : {}),
        ...(q.region ? { region: q.region } : {}),
        ...(q.kind ? { kind: q.kind } : {}),
        ...(q.q
          ? {
              OR: [
                { name: { contains: q.q, mode: 'insensitive' } },
                { city: { contains: q.q, mode: 'insensitive' } },
                { description: { contains: q.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { schedules: true, closures: true, _count: { select: { marketVendors: true } } },
    });

    const items = markets.map((m) => {
      const opening = computeMarketOpening({
        isActive: m.isActive,
        statusLocked: m.statusLocked,
        lockedStatus: m.status,
        schedules: m.schedules,
        closures: m.closures,
      });
      return {
        ...m,
        opening,
        distanceKm: distances.get(m.id) ?? null,
      };
    }).filter((m) => (q.openOnly === 'true' ? m.opening.isOpen : true));

    return json({ items }, 200, PUBLIC_CACHE);
  });
}
