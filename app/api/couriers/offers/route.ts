import { json, withHandler } from '@/lib/http';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  return withHandler(async () => {
    const user = await requireRole('LIVREUR');
    const offers = await prisma.deliveryOffer.findMany({
      where: {
        courier: { userId: user.id },
        status: 'ENVOYEE',
        expiresAt: { gt: new Date() },
      },
      include: {
        delivery: {
          include: { order: { include: { market: true, vendorOrders: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return json({ items: offers });
  });
}
