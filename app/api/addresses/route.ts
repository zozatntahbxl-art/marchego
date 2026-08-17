import { NextRequest } from 'next/server';
import { json, parseBody, withHandler } from '@/lib/http';
import { addressSchema } from '@/lib/validation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { geocodeBelgianAddress } from '@/lib/geo/geocoding';
import { BELGIUM_CENTER } from '@/lib/geo';

export async function GET() {
  return withHandler(async () => {
    const user = await requireUser();
    const items = await prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return json({ items });
  });
}

export async function POST(req: NextRequest) {
  return withHandler(async () => {
    const user = await requireUser();
    const body = await parseBody(req, addressSchema);
    const geo = await geocodeBelgianAddress(body);
    const coords = geo.ok
      ? { latitude: geo.result.latitude, longitude: geo.result.longitude }
      : { latitude: BELGIUM_CENTER.latitude, longitude: BELGIUM_CENTER.longitude };

    if (body.isDefault) {
      await prisma.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: {
        userId: user.id,
        ...body,
        ...coords,
      },
    });
    return json({ address }, 201);
  });
}
