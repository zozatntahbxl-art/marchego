import { NextRequest } from 'next/server';
import { json, parseBody, withHandler, parseSearch } from '@/lib/http';
import { checkoutSchema, paginationSchema } from '@/lib/validation';
import { requireUser } from '@/lib/auth';
import { createOrderFromCart } from '@/lib/orders/create';
import { prisma } from '@/lib/prisma';
import { consume, rateLimitHeaders } from '@/lib/security/rate-limit';
import { clientIp } from '@/lib/http';

export async function GET(req: NextRequest) {
  return withHandler(async () => {
    const user = await requireUser();
    const { page, limit } = parseSearch(req, paginationSchema);
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where: { clientId: user.id },
        include: { market: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where: { clientId: user.id } }),
    ]);
    return json({ items, total, page, limit });
  });
}

export async function POST(req: NextRequest) {
  return withHandler(async () => {
    const user = await requireUser();
    const ip = clientIp(req) ?? user.id;
    const rl = consume(`orders:${ip}`, { max: 8, windowMs: 60_000 });
    if (!rl.allowed) {
      return json({ error: 'Trop de tentatives. Réessayez dans un instant.' }, 429, rateLimitHeaders(rl, 8));
    }
    const body = await parseBody(req, checkoutSchema);
    const result = await createOrderFromCart({
      userId: user.id,
      cartId: body.cartId,
      addressId: body.addressId,
      slotType: body.slotType,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
      tipCents: body.tipCents,
      customerNote: body.customerNote,
    });
    return json(result, 201);
  });
}
