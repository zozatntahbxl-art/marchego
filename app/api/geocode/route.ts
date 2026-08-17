import { json, withHandler } from '@/lib/http';
import { geocodeBelgianAddress } from '@/lib/geo/geocoding';
import { z } from 'zod';
import { parseBody } from '@/lib/http';
import { addressSchema } from '@/lib/validation';

const schema = addressSchema.pick({
  street: true,
  houseNumber: true,
  city: true,
  postalCode: true,
});

export async function POST(req: Request) {
  return withHandler(async () => {
    const body = await parseBody(req, schema);
    const result = await geocodeBelgianAddress(body);
    if (!result.ok) return json({ error: result.error }, 422);
    return json({ result: result.result });
  });
}

void z;
