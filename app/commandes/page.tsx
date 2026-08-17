import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/utils';
import { orderStatusLabel } from '@/lib/orders/status';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/connexion?next=/commandes');

  const orders = await prisma.order.findMany({
    where: { clientId: user.id },
    include: { market: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <AppShell>
      <div className="container max-w-2xl space-y-6 py-8">
        <div>
          <p className="label-caps mb-2">Suivi</p>
          <h1 className="section-title">Mes commandes</h1>
        </div>
        {orders.length === 0 && (
          <div className="surface-card p-10 text-center">
            <p className="font-display text-xl font-semibold">Pas encore de commande</p>
            <p className="mt-2 text-sm text-muted-foreground">Le prochain marché n’attend que votre cabas.</p>
            <Button asChild className="mt-6">
              <Link href="/marches">Aller au marché</Link>
            </Button>
          </div>
        )}
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/commandes/${o.id}`}
                className="flex items-center justify-between rounded-[1.35rem] border border-border/80 bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lifted"
              >
                <div>
                  <p className="font-semibold">{o.reference}</p>
                  <p className="text-sm text-muted-foreground">{o.market.name}</p>
                </div>
                <div className="text-right">
                  <Badge>{orderStatusLabel(o.status)}</Badge>
                  <p className="mt-1 text-sm font-medium">{formatCents(o.totalCents)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
