import { NextRequest } from 'next/server';
import { json, parseSearch, withHandler, PUBLIC_CACHE } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { computeMarketOpening } from '@/lib/markets/opening';
import { z } from 'zod';

const schema = z.object({
  q: z.string().max(80).optional(),
  region: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  kind: z.string().max(40).optional(),
  day: z.coerce.number().int().min(0).max(6).optional(),
});

/** Catalogue public pour l’explorateur et l’inscription vendeur. */
export async function GET(req: NextRequest) {
  return withHandler(async () => {
    const q = parseSearch(req, schema);
    const markets = await prisma.market.findMany({
      where: {
        isActive: true,
        ...(q.city ? { city: { contains: q.city, mode: 'insensitive' } } : {}),
        ...(q.region ? { region: q.region } : {}),
        ...(q.kind ? { kind: q.kind } : {}),
        ...(q.q
          ? {
              OR: [
                { name: { contains: q.q, mode: 'insensitive' } },
                { city: { contains: q.q, mode: 'insensitive' } },
                { street: { contains: q.q, mode: 'insensitive' } },
                { description: { contains: q.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        schedules: true,
        closures: true,
        _count: { select: { marketVendors: true } },
      },
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
    });

    const items = markets
      .filter((m) => (q.day == null ? true : m.schedules.some((s) => s.dayOfWeek === q.day)))
      .map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      city: m.city,
      postalCode: m.postalCode,
      street: m.street,
      description: m.description,
      imageUrl: m.imageUrl,
      latitude: m.latitude,
      longitude: m.longitude,
      zoneRadiusKm: m.zoneRadiusKm,
      kind: m.kind,
      region: m.region,
      featured: m.featured,
      stallCount: m.stallCount,
      highlights: m.highlights,
      vendorCount: m._count.marketVendors,
      opening: computeMarketOpening({
        isActive: m.isActive,
        statusLocked: m.statusLocked,
        lockedStatus: m.status,
        schedules: m.schedules,
        closures: m.closures,
      }),
      schedules: m.schedules.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    }));

    const byCity = items.reduce<Record<string, typeof items>>((acc, m) => {
      (acc[m.city] ??= []).push(m);
      return acc;
    }, {});

    const byRegion = items.reduce<Record<string, number>>((acc, m) => {
      acc[m.region] = (acc[m.region] ?? 0) + 1;
      return acc;
    }, {});

    return json({ items, total: items.length, byCity, byRegion }, 200, PUBLIC_CACHE);
  });
}
