import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/utils';
import { isCancellableByClient, orderStatusLabel, vendorStatusLabel } from '@/lib/orders/status';
import { OrderTracker } from '@/components/orders/order-tracker';
import { OrderCancelButton } from '@/components/orders/order-cancel-button';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/connexion');

  const [order, settings] = await Promise.all([
    prisma.order.findUnique({
      where: { id: params.id },
      include: {
        market: true,
        items: true,
        vendorOrders: { include: { vendor: true } },
        delivery: { include: { courier: { include: { user: { include: { profile: true } } } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    }),
    getSettings(),
  ]);
  if (!order) notFound();
  if (order.clientId !== user.id && !user.roles.includes('ADMIN')) {
    redirect('/commandes');
  }

  const snapshot = (order.deliveryAddressSnapshot ?? {}) as {
    street?: string;
    houseNumber?: string;
    postalCode?: string;
    city?: string;
    deliveryPin?: string;
    instructions?: string;
  };
  const pin = snapshot.deliveryPin;
  const seconds = (Date.now() - order.createdAt.getTime()) / 1000;
  const canCancel = isCancellableByClient(order.status, seconds, settings.freeCancellationSeconds);
  const courierName = order.delivery?.courier?.user.profile
    ? `${order.delivery.courier.user.profile.firstName} ${order.delivery.courier.user.profile.lastName.slice(0, 1)}.`
    : null;
  const showPin = Boolean(pin) && order.status !== 'ANNULEE';

  return (
    <AppShell>
      <div className="container max-w-2xl space-y-5 py-8">
        <div>
          <p className="label-caps mb-2">{order.reference}</p>
          <h1 className="section-title">{order.market.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{orderStatusLabel(order.status)}</p>
        </div>

        <OrderTracker
          orderId={order.id}
          initialStatus={order.status}
          delivery={
            order.delivery
              ? {
                  pickupLatitude: order.delivery.pickupLatitude,
                  pickupLongitude: order.delivery.pickupLongitude,
                  dropoffLatitude: order.delivery.dropoffLatitude,
                  dropoffLongitude: order.delivery.dropoffLongitude,
                  courierLatitude: order.delivery.courier?.currentLatitude,
                  courierLongitude: order.delivery.courier?.currentLongitude,
                }
              : null
          }
        />

        {showPin && pin && (
          <div className="rounded-[1.5rem] bg-secondary p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Code à dicter au livreur
            </p>
            <p className="mt-1 font-display text-4xl font-semibold tracking-[0.35em]">{pin}</p>
            <p className="mt-2 text-xs text-muted-foreground">Ne le partagez qu’à la remise.</p>
          </div>
        )}

        {courierName && order.status !== 'ANNULEE' && (
          <div className="rounded-[1.35rem] border bg-card px-4 py-3 text-sm">
            <p className="text-muted-foreground">Livreur</p>
            <p className="font-semibold">{courierName}</p>
          </div>
        )}

        <section className="rounded-[1.4rem] border border-border/80 bg-card p-5 shadow-soft">
          <h2 className="mb-3 font-display text-lg font-semibold">Étals</h2>
          <ul className="space-y-3">
            {order.vendorOrders.map((vo) => (
              <li key={vo.id} className="rounded-2xl bg-muted/40 px-3 py-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{vo.vendor.businessName}</span>
                  <span className="text-muted-foreground">{vendorStatusLabel(vo.status)}</span>
                </div>
                <ul className="mt-1 text-sm text-muted-foreground">
                  {order.items
                    .filter((i) => i.vendorId === vo.vendorId)
                    .map((i) => (
                      <li key={i.id}>
                        {i.quantity}× {i.productName}
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatCents(order.totalCents)}</span>
          </p>
          {snapshot.street && (
            <p className="mt-3 text-sm text-muted-foreground">
              Livraison : {snapshot.street} {snapshot.houseNumber}, {snapshot.postalCode} {snapshot.city}
            </p>
          )}
          {order.customerNote && (
            <p className="mt-2 text-sm italic text-muted-foreground">« {order.customerNote} »</p>
          )}
        </section>

        {canCancel && <OrderCancelButton orderId={order.id} />}
      </div>
    </AppShell>
  );
}
