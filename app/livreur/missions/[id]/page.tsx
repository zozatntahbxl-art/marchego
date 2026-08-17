import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MissionPanel } from '@/components/courier/mission-panel';
import { MissionMap } from '@/components/courier/mission-map';

export const dynamic = 'force-dynamic';

export default async function CourierMissionPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/auth/connexion?next=/livreur/missions/${params.id}`);

  const delivery = await prisma.delivery.findUnique({
    where: { id: params.id },
    include: {
      courier: true,
      order: {
        include: {
          market: true,
          deliveryAddress: true,
          vendorOrders: { include: { vendor: true } },
        },
      },
    },
  });
  if (!delivery || delivery.courier?.userId !== user.id) notFound();

  const dest = `${delivery.dropoffLatitude},${delivery.dropoffLongitude}`;
  const origin = `${delivery.pickupLatitude},${delivery.pickupLongitude}`;
  const marketNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${origin}&travelmode=bicycling`;
  const clientNavUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=bicycling`;

  const snap = (delivery.order.deliveryAddressSnapshot ?? {}) as {
    street?: string;
    houseNumber?: string;
    postalCode?: string;
    city?: string;
    instructions?: string;
  };

  return (
    <AppShell>
      <div className="container max-w-lg space-y-5 py-6">
        <div>
          <p className="label-caps mb-1">{delivery.order.reference}</p>
          <h1 className="section-title">{delivery.order.market.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {snap.street
              ? `${snap.street} ${snap.houseNumber}, ${snap.postalCode} ${snap.city}`
              : delivery.order.deliveryAddress
                ? `${delivery.order.deliveryAddress.street} ${delivery.order.deliveryAddress.houseNumber}`
                : 'Adresse de livraison'}
          </p>
          {snap.instructions && (
            <p className="mt-1 text-sm italic text-muted-foreground">« {snap.instructions} »</p>
          )}
        </div>
        <MissionMap
          pickup={{ latitude: delivery.pickupLatitude, longitude: delivery.pickupLongitude }}
          dropoff={{ latitude: delivery.dropoffLatitude, longitude: delivery.dropoffLongitude }}
        />
        <MissionPanel
          deliveryId={delivery.id}
          status={delivery.status}
          earningCents={delivery.totalEarningCents}
          pinRequired={Boolean(delivery.pinCodeHash)}
          vendors={delivery.order.vendorOrders.map((v) => ({
            id: v.id,
            name: v.vendor.businessName,
            stallNumber: v.stallNumber,
            status: v.status,
          }))}
          marketNavUrl={marketNavUrl}
          clientNavUrl={clientNavUrl}
        />
      </div>
    </AppShell>
  );
}
