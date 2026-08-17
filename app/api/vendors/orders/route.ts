import { json, withHandler } from '@/lib/http';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canVendorTransition, deriveOrderStatusFromVendors } from '@/lib/orders/status';
import { startCourierSearch } from '@/lib/assignment/orchestrator';
import { notify } from '@/lib/notifications';
import { broadcastOrderUpdate } from '@/lib/realtime/broadcast';
import { z } from 'zod';
import { parseBody } from '@/lib/http';

const schema = z.object({
  status: z.enum(['ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'REFUSEE']),
  reason: z.string().max(280).optional(),
});

export async function GET() {
  return withHandler(async () => {
    const user = await requireRole('VENDEUR');
    if (!user.vendor) return json({ error: 'Boutique introuvable.' }, 404);
    const items = await prisma.vendorOrder.findMany({
      where: { vendorId: user.vendor.id },
      include: { items: true, order: { include: { market: true, client: { include: { profile: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return json({ items });
  });
}

export async function PATCH(req: Request) {
  return withHandler(async () => {
    const user = await requireRole('VENDEUR');
    if (!user.vendor) return json({ error: 'Boutique introuvable.' }, 404);
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return json({ error: 'id requis.' }, 400);
    const body = await parseBody(req, schema);

    const vo = await prisma.vendorOrder.findFirst({
      where: { id, vendorId: user.vendor.id },
      include: { order: { include: { vendorOrders: true } } },
    });
    if (!vo) return json({ error: 'Commande introuvable.' }, 404);
    if (!canVendorTransition(vo.status, body.status)) {
      return json({ error: `Transition ${vo.status} → ${body.status} interdite.` }, 409);
    }

    const now = new Date();
    await prisma.vendorOrder.update({
      where: { id: vo.id },
      data: {
        status: body.status,
        acceptedAt: body.status === 'ACCEPTEE' ? now : vo.acceptedAt,
        readyAt: body.status === 'PRETE' ? now : vo.readyAt,
        refusedAt: body.status === 'REFUSEE' ? now : vo.refusedAt,
        refusalReason: body.reason,
      },
    });

    const refreshed = await prisma.vendorOrder.findMany({
      where: { orderId: vo.orderId },
      select: { status: true },
    });
    const next = deriveOrderStatusFromVendors(
      refreshed.map((r) => r.status),
      vo.order.status,
    );
    if (next !== vo.order.status) {
      await prisma.order.update({ where: { id: vo.orderId }, data: { status: next } });
      await prisma.orderStatusHistory.create({
        data: { orderId: vo.orderId, status: next, authorId: user.id, authorRole: 'VENDEUR' },
      });
      await broadcastOrderUpdate(vo.orderId, next);
      if (next === 'PREPAREE') {
        const delivery = await prisma.delivery.findUnique({ where: { orderId: vo.orderId } });
        if (delivery && vo.order.slotType === 'ASAP') {
          await startCourierSearch(delivery.id);
        }
      }
      await notify({
        userId: vo.order.clientId,
        type: next === 'PREPAREE' ? 'COMMANDE_PREPAREE' : 'COMMANDE_ACCEPTEE',
        title: next === 'PREPAREE' ? 'Votre commande est prête' : 'Commande acceptée',
        body: `Mise à jour : ${next}`,
        data: { orderId: vo.orderId },
        actionUrl: `/commandes/${vo.orderId}`,
      });
    }

    return json({ ok: true, orderStatus: next });
  });
}
