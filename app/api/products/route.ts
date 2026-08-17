import { NextRequest } from 'next/server';
import { json, parseSearch, withHandler } from '@/lib/http';
import { productQuerySchema } from '@/lib/validation';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  return withHandler(async () => {
    const q = parseSearch(req, productQuerySchema);
    const labels = q.labels ? q.labels.split(',').filter(Boolean) : [];

    const where = {
      isAvailable: true,
      isApproved: true,
      ...(q.vendorId ? { vendorId: q.vendorId } : {}),
      ...(q.category ? { category: { slug: q.category } } : {}),
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' as const } } : {}),
      ...(q.minPrice || q.maxPrice
        ? { priceCents: { gte: q.minPrice, lte: q.maxPrice } }
        : {}),
      ...(q.minRating ? { rating: { gte: q.minRating } } : {}),
      ...(labels.length ? { labels: { hasSome: labels as never } } : {}),
      ...(q.marketId
        ? {
            availabilities: {
              some: {
                marketId: q.marketId,
                isAvailable: true,
                ...(q.date ? { OR: [{ date: new Date(q.date) }, { date: null }] } : {}),
              },
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          vendor: { select: { id: true, businessName: true, slug: true, rating: true } },
          category: true,
        },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { soldCount: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    return json({ items, total, page: q.page, limit: q.limit });
  });
}
