import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CourierHub } from '@/components/courier/courier-hub';
import { courierStatusLabel } from '@/lib/orders/status';

export const dynamic = 'force-dynamic';

export default async function CourierPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/connexion?next=/livreur');
  if (!user.roles.includes('LIVREUR')) redirect('/');

  const courier = await prisma.courier.findUnique({ where: { userId: user.id } });
  const offers = courier
    ? await prisma.deliveryOffer.findMany({
        where: { courierId: courier.id, status: 'ENVOYEE', expiresAt: { gt: new Date() } },
        include: {
          delivery: { include: { order: { include: { market: true, vendorOrders: true } } } },
        },
      })
    : [];
  const missions = courier
    ? await prisma.delivery.findMany({
        where: {
          courierId: courier.id,
          status: { notIn: ['LIVREE', 'ECHOUEE', 'ANNULEE'] },
        },
        include: { order: { include: { market: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })
    : [];
  const earnings = courier
    ? await prisma.courierEarning.aggregate({
        where: { courierId: courier.id },
        _sum: { amountCents: true },
      })
    : { _sum: { amountCents: 0 } };

  return (
    <AppShell>
      <div className="container max-w-2xl space-y-6 py-8">
        <div>
          <p className="label-caps mb-2">Missions</p>
          <h1 className="section-title">Espace livreur</h1>
        </div>
        {!courier && (
          <p className="text-sm text-muted-foreground">
            Profil livreur en attente.{' '}
            <a href="/livreur/onboarding" className="text-primary underline">
              Compléter l’onboarding
            </a>
          </p>
        )}
        {courier && (
          <CourierHub
            courierId={courier.id}
            online={courier.online}
            verified={courier.verified}
            rating={courier.rating}
            earnings={earnings._sum.amountCents ?? 0}
            missions={missions.map((d) => ({
              id: d.id,
              market: d.order.market.name,
              status: courierStatusLabel(d.status),
              earning: d.totalEarningCents,
            }))}
            offers={offers.map((o) => ({
              id: o.id,
              deliveryId: o.deliveryId,
              expiresAt: o.expiresAt.toISOString(),
              earning: o.estimatedEarningCents,
              distance: o.distanceToMarketKm,
              market: o.delivery.order.market.name,
              vendors: o.delivery.order.vendorOrders.length,
            }))}
          />
        )}
      </div>
    </AppShell>
  );
}
