import { json, withHandler } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { markAllRead, markNotificationRead } from '@/lib/notifications';

export async function GET() {
  return withHandler(async () => {
    const user = await requireUser();
    const items = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return json({ items });
  });
}

export async function PATCH(req: Request) {
  return withHandler(async () => {
    const user = await requireUser();
    const body = (await req.json()) as { id?: string; all?: boolean };
    if (body.all) await markAllRead(user.id);
    else if (body.id) await markNotificationRead(body.id, user.id);
    return json({ ok: true });
  });
}
