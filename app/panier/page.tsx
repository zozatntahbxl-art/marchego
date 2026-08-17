import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { getActiveCart, quoteCart } from '@/lib/cart';
import { formatCents } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CartActions } from '@/components/cart/cart-actions';

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const cart = await getActiveCart();
  if (!cart || cart.items.length === 0) {
    return (
      <AppShell>
        <div className="container max-w-lg py-20 text-center">
          <p className="label-caps mb-3">Panier</p>
          <h1 className="hero-title mb-3 text-3xl">Votre cabas est vide</h1>
          <p className="text-muted-foreground">
            Choisissez un marché, une date, puis glissez les étals — fromage, pain, botte de carottes.
          </p>
          <Button asChild className="mt-8">
            <Link href="/marches">Parcourir les marchés</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const { quote } = await quoteCart(cart.id);

  return (
    <AppShell>
      <div className="container max-w-2xl space-y-6 py-8">
        <div>
          <p className="label-caps mb-2">Votre commande</p>
          <h1 className="section-title">Panier</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cart.market.name} · {cart.marketDate.toISOString().slice(0, 10)}
          </p>
        </div>
        <CartActions cart={cart} />
        <div className="surface-card space-y-2 p-5 text-sm">
          <Row label="Sous-total" value={formatCents(quote.subtotalCents)} />
          <Row label="Livraison" value={formatCents(quote.deliveryFeeCents)} />
          <Row label="Frais de service" value={formatCents(quote.serviceFeeCents)} />
          <Row label="Total TTC" value={formatCents(quote.totalCents)} bold />
          {!quote.meetsMinimum && (
            <p className="pt-2 text-sm text-stall-700">
              Encore {formatCents(quote.missingForMinimumCents)} pour atteindre le minimum de commande.
            </p>
          )}
        </div>
        <Button asChild size="lg" className="w-full" disabled={!quote.meetsMinimum}>
          <Link href="/commande">Commander · {formatCents(quote.totalCents)}</Link>
        </Button>
      </div>
    </AppShell>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-semibold' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
