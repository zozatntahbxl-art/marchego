import { json, withHandler } from '@/lib/http';
import { requireRole } from '@/lib/auth';
import { tickAssignmentWorker, startCourierSearch } from '@/lib/assignment/orchestrator';
import { z } from 'zod';
import { parseBody } from '@/lib/http';

const schema = z.object({
  deliveryId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  return withHandler(async () => {
    await requireRole('ADMIN');
    const body = await parseBody(req, schema);
    if (body.deliveryId) {
      await startCourierSearch(body.deliveryId);
      return json({ ok: true, started: body.deliveryId });
    }
    const result = await tickAssignmentWorker();
    return json({ ok: true, ...result });
  });
}
