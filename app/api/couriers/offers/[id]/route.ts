import { json, withHandler } from '@/lib/http';
import { requireRole } from '@/lib/auth';
import { acceptOffer, refuseOffer } from '@/lib/assignment/orchestrator';
import { z } from 'zod';
import { parseBody } from '@/lib/http';

const schema = z.object({
  action: z.enum(['accept', 'refuse']),
  reason: z.string().max(200).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withHandler(async () => {
    const user = await requireRole('LIVREUR');
    const body = await parseBody(req, schema);
    if (body.action === 'accept') {
      const offer = await acceptOffer(params.id, user.id);
      return json({ offer });
    }
    const offer = await refuseOffer(params.id, user.id, body.reason);
    return json({ offer });
  });
}
