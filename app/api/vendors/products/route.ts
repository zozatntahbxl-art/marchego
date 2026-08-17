import { NextRequest } from 'next/server';
import { json, parseBody, withHandler } from '@/lib/http';
import { requireRole } from '@/lib/auth';
import { productSchema } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';

export async function GET() {
  return withHandler(async () => {
    const user = await requireRole('VENDEUR');
    if (!user.vendor) return json({ error: 'Boutique introuvable.' }, 404);
    const items = await prisma.product.findMany({
      where: { vendorId: user.vendor.id },
      include: { category: true },
      orderBy: { updatedAt: 'desc' },
    });
    return json({ items });
  });
}

export async function POST(req: NextRequest) {
  return withHandler(async () => {
    const user = await requireRole('VENDEUR');
    if (!user.vendor) return json({ error: 'Boutique introuvable.' }, 404);
    const body = await parseBody(req, productSchema);
    const product = await prisma.product.create({
      data: {
        vendorId: user.vendor.id,
        slug: slugify(body.name) + '-' + Math.random().toString(36).slice(2, 6),
        ...body,
      },
    });
    return json({ product }, 201);
  });
}
