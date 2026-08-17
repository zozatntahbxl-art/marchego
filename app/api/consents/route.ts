import { json, withHandler } from '@/lib/http';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { parseBody } from '@/lib/http';
import { clientIp } from '@/lib/http';

const schema = z.object({
  purpose: z.string().min(2).max(40),
  granted: z.boolean(),
});

export async function POST(req: Request) {
  return withHandler(async () => {
    const user = await getCurrentUser();
    const body = await parseBody(req, schema);
    await prisma.consentRecord.create({
      data: {
        userId: user?.id,
        purpose: body.purpose,
        granted: body.granted,
        ipAddress: clientIp(req),
        userAgent: req.headers.get('user-agent'),
      },
    });
    return json({ ok: true });
  });
}
