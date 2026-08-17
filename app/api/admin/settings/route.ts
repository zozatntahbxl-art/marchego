import { json, parseBody, withHandler } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { invalidateSettingsCache } from '@/lib/settings';
import { z } from 'zod';

const schema = z.object({
  serviceFeeCents: z.number().int().min(0).max(2000).optional(),
  vendorCommissionBps: z.number().int().min(0).max(5000).optional(),
  courierBaseFeeCents: z.number().int().min(0).optional(),
  courierPerKmCents: z.number().int().min(0).optional(),
  minOrderCents: z.number().int().min(0).optional(),
  offerTimeoutSeconds: z.number().int().min(10).max(120).optional(),
  surgeEnabled: z.boolean().optional(),
});

export async function GET() {
  return withHandler(async () => {
    await requireAdmin();
    const settings = await prisma.platformSettings.findUnique({ where: { id: 'global' } });
    return json({ settings });
  });
}

export async function PATCH(req: Request) {
  return withHandler(async () => {
    const admin = await requireAdmin();
    const body = await parseBody(req, schema);
    const settings = await prisma.platformSettings.upsert({
      where: { id: 'global' },
      create: { id: 'global', ...body, updatedById: admin.id },
      update: { ...body, updatedById: admin.id },
    });
    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: 'UPDATE_SETTINGS',
        targetType: 'PlatformSettings',
        targetId: 'global',
        metadata: body,
      },
    });
    invalidateSettingsCache();
    return json({ settings });
  });
}
