import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { VendorOrders } from '@/components/vendor/vendor-orders';

export const dynamic = 'force-dynamic';

export default async function VendorPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/connexion?next=/vendeur');
  if (!user.roles.includes('VENDEUR')) redirect('/');

  const vendor = await prisma.vendor.findUnique({
    where: { userId: user.id },
    include: {
      products: { take: 8, orderBy: { updatedAt: 'desc' } },
    },
  });

  const orders = vendor
    ? await prisma.vendorOrder.findMany({
        where: { vendorId: vendor.id },
        include: { items: true, order: { include: { market: true } } },
        orderBy: { createdAt: 'desc' },
        take: 40,
      })
    : [];

  return (
    <AppShell>
      <div className="container max-w-4xl space-y-6 py-8">
        <div>
          <p className="label-caps mb-2">Coulisses de l’étal</p>
          <h1 className="section-title">Espace vendeur</h1>
          <p className="mt-1 text-muted-foreground">
            {vendor ? vendor.businessName : 'Complétez votre onboarding boutique'}
          </p>
        </div>
        {!vendor && (
          <p className="rounded-2xl border bg-card p-4 text-sm">
            Votre boutique n’est pas encore créée.{' '}
            <a href="/vendeur/onboarding" className="text-primary underline">
              Compléter l’onboarding
            </a>
          </p>
        )}
        {vendor && (
          <>
            <div className="flex gap-3 text-sm">
              <a href="/vendeur/produits" className="rounded-full bg-secondary px-4 py-2 font-semibold text-secondary-foreground">
                Gérer les produits
              </a>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Note" value={vendor.rating.toFixed(1)} />
              <Stat
                label="À traiter"
                value={String(orders.filter((o) => o.status === 'EN_ATTENTE').length)}
              />
              <Stat
                label="En préparation"
                value={String(orders.filter((o) => o.status === 'ACCEPTEE' || o.status === 'EN_PREPARATION').length)}
              />
              <Stat
                label="Prêtes"
                value={String(orders.filter((o) => o.status === 'PRETE').length)}
              />
            </div>
            <VendorOrders orders={orders} />
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.35rem] border border-border/80 bg-card p-4 shadow-soft">
      <p className="label-caps">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
