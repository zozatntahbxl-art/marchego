import { NextRequest } from 'next/server';
import { json, parseBody, withHandler } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { reviewSchema } from '@/lib/validation';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  return withHandler(async () => {
    const user = await requireUser();
    const body = await parseBody(req, reviewSchema);
    const order = await prisma.order.findFirst({
      where: { id: body.orderId, clientId: user.id, status: 'LIVREE' },
    });
    if (!order) return json({ error: 'Commande introuvable ou non livrée.' }, 404);

    const review = await prisma.review.create({
      data: {
        authorId: user.id,
        orderId: body.orderId,
        targetId: body.targetId,
        targetRole: body.targetRole,
        productId: body.productId,
        rating: body.rating,
        comment: body.comment,
      },
    });
    return json({ review }, 201);
  });
}
