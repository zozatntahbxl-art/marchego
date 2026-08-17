'use client';

import { useRouter } from 'next/navigation';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/utils';

export function CartActions({
  cart,
}: {
  cart: {
    id: string;
    marketId: string;
    marketDate: Date;
    items: Array<{
      productId: string;
      quantity: number;
      unitPriceCents: number;
      product: { name: string; vendor: { businessName: string } };
    }>;
  };
}) {
  const router = useRouter();
  const date = cart.marketDate.toISOString().slice(0, 10);

  async function setQty(productId: string, quantity: number) {
    await fetch('/api/cart', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketId: cart.marketId,
        marketDate: date,
        productId,
        quantity,
      }),
    });
    router.refresh();
  }

  const byVendor = new Map<string, typeof cart.items>();
  for (const item of cart.items) {
    const key = item.product.vendor.businessName;
    (byVendor.get(key) ?? byVendor.set(key, []).get(key)!).push(item);
  }

  return (
    <div className="space-y-5">
      {Array.from(byVendor.entries()).map(([vendor, lines]) => (
        <section key={vendor} className="overflow-hidden rounded-[1.4rem] border border-border/80 bg-card shadow-soft">
          <header className="border-b bg-secondary/40 px-4 py-2.5">
            <p className="text-sm font-semibold">{vendor}</p>
          </header>
          <ul>
            {lines.map((item) => (
              <li
                key={item.productId}
                className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.product.name}</p>
                  <p className="text-sm font-semibold text-primary">
                    {formatCents(item.unitPriceCents * item.quantity)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9"
                    onClick={() => setQty(item.productId, item.quantity - 1)}
                    aria-label={item.quantity === 1 ? 'Retirer' : 'Diminuer'}
                  >
                    {item.quantity === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  </Button>
                  <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9"
                    onClick={() => setQty(item.productId, item.quantity + 1)}
                    aria-label="Augmenter"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
