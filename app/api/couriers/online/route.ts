import { NextRequest } from 'next/server';
import { json, withHandler } from '@/lib/http';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { locationPingSchema } from '@/lib/validation';
import { parseBody } from '@/lib/http';
import { broadcastCourierLocation } from '@/lib/realtime/broadcast';

export async function POST(req: NextRequest) {
  return withHandler(async () => {
    const user = await requireRole('LIVREUR');
    if (!user.courier) return json({ error: 'Profil livreur introuvable.' }, 404);
    const body = (await req.json()) as { online?: boolean };

    const courier = await prisma.courier.update({
      where: { id: user.courier.id },
      data: { online: Boolean(body.online) },
    });

    if (body.online) {
      await prisma.courierShift.create({ data: { courierId: courier.id } });
    } else {
      const open = await prisma.courierShift.findFirst({
        where: { courierId: courier.id, endedAt: null },
        orderBy: { startedAt: 'desc' },
      });
      if (open) {
        await prisma.courierShift.update({
          where: { id: open.id },
          data: { endedAt: new Date() },
        });
      }
    }

    return json({ courier: { id: courier.id, online: courier.online } });
  });
}

export async function PATCH(req: NextRequest) {
  return withHandler(async () => {
    const user = await requireRole('LIVREUR');
    if (!user.courier) return json({ error: 'Profil livreur introuvable.' }, 404);
    const body = await parseBody(req, locationPingSchema);

    await prisma.courier.update({
      where: { id: user.courier.id },
      data: {
        currentLatitude: body.latitude,
        currentLongitude: body.longitude,
        lastLocationUpdate: new Date(),
      },
    });

    const ping = await prisma.courierLocationPing.create({
      data: {
        courierId: user.courier.id,
        deliveryId: body.deliveryId,
        latitude: body.latitude,
        longitude: body.longitude,
        accuracy: body.accuracy,
        heading: body.heading,
        speed: body.speed,
      },
    });

    if (body.deliveryId) {
      const delivery = await prisma.delivery.findUnique({
        where: { id: body.deliveryId },
        select: { orderId: true },
      });
      if (delivery) {
        await broadcastCourierLocation({
          deliveryId: body.deliveryId,
          orderId: delivery.orderId,
          latitude: body.latitude,
          longitude: body.longitude,
          heading: body.heading,
        });
      }
    }

    return json({ ping: { id: ping.id } });
  });
}
