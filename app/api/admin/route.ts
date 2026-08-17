import { json, withHandler } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { invalidateSettingsCache } from '@/lib/settings';
import { z } from 'zod';
import { parseBody } from '@/lib/http';

export async function GET() {
  return withHandler(async () => {
    await requireAdmin();
    const [orders, vendorsPending, couriersPending, disputes, gmv] = await Promise.all([
      prisma.order.count({ where: { status: { notIn: ['LIVREE', 'ANNULEE'] } } }),
      prisma.vendor.count({ where: { verificationStatus: 'EN_ATTENTE' } }),
      prisma.courier.count({ where: { verificationStatus: 'EN_ATTENTE' } }),
      prisma.dispute.count({ where: { status: { in: ['OUVERT', 'EN_EXAMEN'] } } }),
      prisma.order.aggregate({
        where: { paymentStatus: 'PAYE', createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        _sum: { totalCents: true, platformFeeCents: true },
      }),
    ]);
    return json({
      liveOrders: orders,
      vendorsPending,
      couriersPending,
      openDisputes: disputes,
      weekGmvCents: gmv._sum.totalCents ?? 0,
      weekPlatformCents: gmv._sum.platformFeeCents ?? 0,
    });
  });
}

const verifySchema = z.object({
  type: z.enum(['vendor', 'courier']),
  id: z.string().uuid(),
  decision: z.enum(['APPROUVE', 'REJETE', 'COMPLEMENT_REQUIS']),
  reason: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  return withHandler(async () => {
    const admin = await requireAdmin();
    const body = await parseBody(req, verifySchema);
    if (body.type === 'vendor') {
      await prisma.vendor.update({
        where: { id: body.id },
        data: {
          verificationStatus: body.decision,
          verified: body.decision === 'APPROUVE',
          status: body.decision === 'APPROUVE' ? 'ACTIF' : 'EN_ATTENTE',
        },
      });
    } else {
      await prisma.courier.update({
        where: { id: body.id },
        data: {
          verificationStatus: body.decision,
          verified: body.decision === 'APPROUVE',
          status: body.decision === 'APPROUVE' ? 'ACTIF' : 'EN_ATTENTE',
        },
      });
    }
    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: `VERIFY_${body.type.toUpperCase()}`,
        targetType: body.type,
        targetId: body.id,
        metadata: { decision: body.decision, reason: body.reason },
      },
    });
    invalidateSettingsCache();
    return json({ ok: true });
  });
}
