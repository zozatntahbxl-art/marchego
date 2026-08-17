import { NextRequest } from 'next/server';
import { json, parseBody, withHandler } from '@/lib/http';
import { requireUser, requireAdmin } from '@/lib/auth';
import { disputeSchema } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import { generateReference } from '@/lib/utils';
import { DisputeStatus } from '@prisma/client';

export async function GET() {
  return withHandler(async () => {
    const user = await requireUser();
    const where = user.roles.includes('ADMIN') ? {} : { openedById: user.id };
    const items = await prisma.dispute.findMany({
      where,
      include: { order: { select: { reference: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return json({ items });
  });
}

export async function POST(req: NextRequest) {
  return withHandler(async () => {
    const user = await requireUser();
    const body = await parseBody(req, disputeSchema);
    const order = await prisma.order.findFirst({
      where: {
        id: body.orderId,
        OR: [{ clientId: user.id }, { vendorOrders: { some: { vendor: { userId: user.id } } } }],
      },
    });
    if (!order) return json({ error: 'Commande introuvable.' }, 404);

    const dispute = await prisma.dispute.create({
      data: {
        reference: generateReference('DSP'),
        openedById: user.id,
        orderId: body.orderId,
        reason: body.reason,
        description: body.description,
        attachments: body.attachments,
        affectedItemIds: body.affectedItemIds,
        requestedRefundCents: body.requestedRefundCents,
      },
    });
    return json({ dispute }, 201);
  });
}

export async function PATCH(req: NextRequest) {
  return withHandler(async () => {
    await requireAdmin();
    const body = (await req.json()) as { id: string; status: DisputeStatus };
    const resolved =
      body.status === 'RESOLU_REMBOURSEMENT' ||
      body.status === 'RESOLU_SANS_SUITE' ||
      body.status === 'CLOS';
    const dispute = await prisma.dispute.update({
      where: { id: body.id },
      data: { status: body.status, resolvedAt: resolved ? new Date() : null },
    });
    return json({ dispute });
  });
}
