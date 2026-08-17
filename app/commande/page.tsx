import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { getCurrentUser } from '@/lib/auth';
import { getActiveCart, quoteCart } from '@/lib/cart';
import { prisma } from '@/lib/prisma';
import { CheckoutForm } from '@/components/checkout/checkout-form';
import { formatCents } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/connexion?next=/commande');

  const cart = await getActiveCart();
  if (!cart || cart.items.length === 0) redirect('/panier');

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0];
  const { quote } = await quoteCart(
    cart.id,
    defaultAddr ? { latitude: defaultAddr.latitude, longitude: defaultAddr.longitude } : undefined,
  );

  return (
    <AppShell>
      <div className="container max-w-2xl space-y-6 py-8">
        <div>
          <p className="label-caps mb-2">Checkout</p>
          <h1 className="section-title">Finaliser la commande</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trois étapes : adresse, créneau, paiement.
          </p>
        </div>
        <CheckoutForm
          cartId={cart.id}
          marketName={cart.market.name}
          marketDate={cart.marketDate.toISOString().slice(0, 10)}
          items={cart.items.map((i) => ({
            name: i.product.name,
            vendor: i.product.vendor.businessName,
            quantity: i.quantity,
            totalCents: i.unitPriceCents * i.quantity,
          }))}
          addresses={addresses}
          quote={{
            subtotal: formatCents(quote.subtotalCents),
            delivery: formatCents(quote.deliveryFeeCents),
            service: formatCents(quote.serviceFeeCents),
            total: formatCents(quote.totalCents),
            totalCents: quote.totalCents,
            meetsMinimum: quote.meetsMinimum,
          }}
        />
      </div>
    </AppShell>
  );
}
