import { json, withHandler } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withHandler(async () => {
    const vendors = await prisma.marketVendor.findMany({
      where: { marketId: params.id, isPresent: true },
      include: {
        vendor: {
          select: {
            id: true,
            businessName: true,
            slug: true,
            description: true,
            logoUrl: true,
            rating: true,
            ratingCount: true,
          },
        },
      },
    });
    return json({ items: vendors });
  });
}
