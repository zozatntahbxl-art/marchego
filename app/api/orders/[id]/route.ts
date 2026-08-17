import { json, withHandler } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeCancellationRefund } from '@/lib/pricing';
import { getSettings } from '@/lib/settings';
import { refundPayment } from '@/lib/stripe/payments';
import { integrations } from '@/lib/env';
import { notify } from '@/lib/notifications';
import { broadcastOrderUpdate } from '@/lib/realtime/broadcast';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withHandler(async () => {
    const user = await requireUser();
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        items: true,
        vendorOrders: { include: { vendor: true } },
        delivery: { include: { courier: true } },
        market: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) return json({ error: 'Commande introuvable.' }, 404);
    const allowed =
      order.clientId === user.id ||
      user.roles.includes('ADMIN') ||
      order.vendorOrders.some((vo) => vo.vendor.userId === user.id) ||
      order.delivery?.courierId === user.courier?.id;
    if (!allowed) return json({ error: 'Accès refusé.' }, 403);
    return json({ order });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return withHandler(async () => {
    const user = await requireUser();
    const body = (await req.json()) as { action?: string; reason?: string };
    if (body.action !== 'cancel') return json({ error: 'Action inconnue.' }, 400);

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { payment: true, delivery: true },
    });
    if (!order || order.clientId !== user.id) return json({ error: 'Commande introuvable.' }, 404);

    const settings = await getSettings();
    const seconds = (Date.now() - order.createdAt.getTime()) / 1000;
    const refund = computeCancellationRefund({
      totalCents: order.totalCents,
      serviceFeeCents: order.serviceFeeCents,
      secondsSinceOrder: seconds,
      vendorAccepted: order.status !== 'EN_ATTENTE',
      courierAssigned: Boolean(order.delivery?.courierId),
      freeCancellationSeconds: settings.freeCancellationSeconds,
      cancellationFeeCents: settings.cancellationFeeCents,
    });

    if (order.status === 'LIVREE' || order.status === 'ANNULEE') {
      return json({ error: 'Cette commande ne peut plus être annulée.' }, 409);
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'ANNULEE',
          cancelledAt: new Date(),
          cancelledBy: user.id,
          cancellationReason: body.reason,
        },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'ANNULEE',
          authorId: user.id,
          authorRole: 'CLIENT',
          note: body.reason,
        },
      }),
    ]);

    if (integrations.stripe && order.payment && refund.refundCents > 0) {
      await refundPayment({
        paymentId: order.payment.id,
        amountCents: refund.refundCents,
        reason: body.reason ?? 'Annulation client',
        initiatedById: user.id,
      });
    }

    await notify({
      userId: user.id,
      type: 'COMMANDE_ANNULEE',
      title: 'Commande annulée',
      body: `Remboursement de ${(refund.refundCents / 100).toFixed(2)} €.`,
      data: { orderId: order.id },
    });
    await broadcastOrderUpdate(order.id, 'ANNULEE');

    return json({ ok: true, refund });
  });
}
