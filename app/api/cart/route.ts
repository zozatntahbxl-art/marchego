import { NextRequest } from 'next/server';
import { json, parseBody, withHandler } from '@/lib/http';
import { cartPutSchema } from '@/lib/validation';
import { getActiveCart, quoteCart, upsertCartItem } from '@/lib/cart';

export async function GET() {
  return withHandler(async () => {
    const cart = await getActiveCart();
    if (!cart) return json({ cart: null, quote: null });
    const quoted = await quoteCart(cart.id);
    return json(quoted);
  });
}

export async function PUT(req: NextRequest) {
  return withHandler(async () => {
    const body = await parseBody(req, cartPutSchema);
    const cart = await upsertCartItem({
      marketId: body.marketId,
      marketDate: new Date(body.marketDate),
      productId: body.productId,
      quantity: body.quantity,
      note: body.note,
    });
    return json({ cart });
  });
}
