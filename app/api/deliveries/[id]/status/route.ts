import { json, withHandler } from '@/lib/http';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { parseBody } from '@/lib/http';
import { notify } from '@/lib/notifications';
import { broadcastOrderUpdate } from '@/lib/realtime/broadcast';
import { verifyCode } from '@/lib/security/crypto';
import { createServiceClient } from '@/lib/supabase/client';

const schema = z.object({
  status: z.enum([
    'EN_ROUTE_VERS_MARCHE',
    'ARRIVE_AU_MARCHE',
    'EN_RECUPERATION',
    'EN_ROUTE_VERS_CLIENT',
    'ARRIVE_CHEZ_CLIENT',
    'LIVREE',
  ]),
  vendorOrderId: z.string().uuid().optional(),
  pickupCode: z.string().optional(),
  pin: z.string().optional(),
  proofType: z.enum(['PHOTO', 'CODE_PIN', 'SIGNATURE', 'SANS_CONTACT']).optional(),
  proofPath: z.string().optional(),
});

const ORDER_FROM_DELIVERY: Record<string, 'EN_ROUTE_VERS_MARCHE' | 'EN_RECUPERATION' | 'EN_ROUTE_VERS_CLIENT' | 'LIVREE'> = {
  EN_ROUTE_VERS_MARCHE: 'EN_ROUTE_VERS_MARCHE',
  EN_RECUPERATION: 'EN_RECUPERATION',
  EN_ROUTE_VERS_CLIENT: 'EN_ROUTE_VERS_CLIENT',
  LIVREE: 'LIVREE',
};

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return withHandler(async () => {
    const user = await requireRole('LIVREUR');
    const body = await parseBody(req, schema);

    const delivery = await prisma.delivery.findUnique({
      where: { id: params.id },
      include: {
        courier: true,
        order: { include: { vendorOrders: true, client: true } },
      },
    });
    if (!delivery || delivery.courier?.userId !== user.id) {
      return json({ error: 'Livraison introuvable.' }, 404);
    }

    if (body.status === 'LIVREE') {
      if (body.proofType === 'CODE_PIN') {
        if (!delivery.pinCodeHash || !body.pin || !verifyCode(body.pin, delivery.pinCodeHash)) {
          await prisma.delivery.update({
            where: { id: delivery.id },
            data: { pinAttempts: { increment: 1 } },
          });
          return json({ error: 'Code PIN incorrect.' }, 403);
        }
      }
    }

    if (body.vendorOrderId && body.pickupCode) {
      const vo = delivery.order.vendorOrders.find((v) => v.id === body.vendorOrderId);
      if (!vo || vo.pickupCode !== body.pickupCode) {
        return json({ error: 'Code de retrait invalide.' }, 403);
      }
      await prisma.vendorOrder.update({
        where: { id: vo.id },
        data: { status: 'RECUPEREE', pickedUpAt: new Date() },
      });
    }

    const now = new Date();
    const data: Record<string, unknown> = { status: body.status };
    if (body.status === 'ARRIVE_AU_MARCHE') data.arrivedAtMarketAt = now;
    if (body.status === 'EN_ROUTE_VERS_CLIENT') data.pickedAt = now;
    if (body.status === 'LIVREE') {
      data.deliveredAt = now;
      data.proofType = body.proofType ?? 'CODE_PIN';
      if (body.proofPath) {
        const supabase = createServiceClient();
        data.proofPhotoUrl = body.proofPath;
        void supabase;
      }
    }

    await prisma.delivery.update({ where: { id: delivery.id }, data });

    const orderStatus = ORDER_FROM_DELIVERY[body.status];
    if (orderStatus) {
      await prisma.order.update({
        where: { id: delivery.orderId },
        data: { status: orderStatus, ...(orderStatus === 'LIVREE' ? { deliveredAt: now } : {}) },
      });
      await prisma.orderStatusHistory.create({
        data: {
          orderId: delivery.orderId,
          status: orderStatus,
          authorId: user.id,
          authorRole: 'LIVREUR',
        },
      });
      await broadcastOrderUpdate(delivery.orderId, orderStatus);
      await notify({
        userId: delivery.order.clientId,
        type: orderStatus === 'LIVREE' ? 'COMMANDE_LIVREE' : 'COMMANDE_EN_ROUTE',
        title: orderStatus === 'LIVREE' ? 'Commande livrée' : 'Mise à jour de livraison',
        body: `Votre commande ${delivery.order.id.slice(0, 8)} avance.`,
        data: { orderId: delivery.orderId },
        actionUrl: `/commandes/${delivery.orderId}`,
      });
    }

    if (body.status === 'LIVREE' && delivery.courierId) {
      await prisma.courier.update({
        where: { id: delivery.courierId },
        data: { totalDeliveries: { increment: 1 } },
      });
      await prisma.courierEarning.create({
        data: {
          courierId: delivery.courierId,
          deliveryId: delivery.id,
          type: 'COURSE',
          amountCents: delivery.totalEarningCents,
          description: `Course ${delivery.order.reference ?? delivery.orderId}`,
        },
      });
    }

    return json({ ok: true });
  });
}
