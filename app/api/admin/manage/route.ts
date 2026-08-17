import { NextRequest } from 'next/server';
import { z } from 'zod';
import { json, parseBody, withHandler } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { adminDashboard, listResource, mutateResource } from '@/lib/admin/manage';

const getSchema = z.object({
  resource: z.string().min(1),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const mutateSchema = z.object({
  resource: z.string().min(1),
  action: z.string().min(1),
  id: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  return withHandler(async () => {
    await requireAdmin();
    const url = req.nextUrl;
    const parsed = getSchema.parse({
      resource: url.searchParams.get('resource') ?? 'dashboard',
      q: url.searchParams.get('q') ?? undefined,
      page: url.searchParams.get('page') ?? 1,
      limit: url.searchParams.get('limit') ?? 30,
    });
    if (parsed.resource === 'dashboard') {
      return json(await adminDashboard());
    }
    return json(await listResource(parsed.resource, parsed));
  });
}

export async function POST(req: Request) {
  return withHandler(async () => {
    const admin = await requireAdmin();
    const body = await parseBody(req, mutateSchema);
    const result = await mutateResource({
      adminId: admin.id,
      resource: body.resource,
      action: body.action,
      id: body.id,
      data: body.data,
    });
    return json({ ok: true, result });
  });
}
