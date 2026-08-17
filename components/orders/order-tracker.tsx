'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { OrderStatus } from '@prisma/client';
import { Check } from 'lucide-react';
import { CLIENT_TRACK_STEPS, clientTrackIndex, orderStatusLabel } from '@/lib/orders/status';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { formatDuration } from '@/lib/utils';
import { haversineKm } from '@/lib/geo';
import { cn } from '@/lib/utils';

const GeoMap = dynamic(() => import('@/components/maps/geo-map').then((m) => m.GeoMap), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-2xl bg-muted" />,
});

type DeliveryInfo = {
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude: number;
  dropoffLongitude: number;
  courierLatitude?: number | null;
  courierLongitude?: number | null;
} | null;

export function OrderTracker({
  orderId,
  initialStatus,
  delivery,
}: {
  orderId: string;
  initialStatus: OrderStatus;
  delivery: DeliveryInfo;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [courierPos, setCourierPos] = useState(
    delivery?.courierLatitude && delivery?.courierLongitude
      ? { latitude: delivery.courierLatitude, longitude: delivery.courierLongitude }
      : null,
  );

  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) {
      const t = setInterval(async () => {
        const res = await fetch(`/api/orders/${orderId}`);
        if (res.ok) {
          const body = await res.json();
          setStatus(body.order.status);
          const loc = body.order.delivery;
          if (loc?.courier?.currentLatitude && loc?.courier?.currentLongitude) {
            setCourierPos({
              latitude: loc.courier.currentLatitude,
              longitude: loc.courier.currentLongitude,
            });
          }
        }
      }, 6000);
      return () => clearInterval(t);
    }

    const channel = supabase
      .channel(`order:${orderId}`)
      .on('broadcast', { event: 'status' }, (payload) => {
        if (payload.payload?.status) setStatus(payload.payload.status as OrderStatus);
      })
      .on('broadcast', { event: 'location' }, (payload) => {
        const lat = payload.payload?.latitude;
        const lng = payload.payload?.longitude;
        if (typeof lat === 'number' && typeof lng === 'number') {
          setCourierPos({ latitude: lat, longitude: lng });
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const pickup = delivery
    ? { latitude: delivery.pickupLatitude, longitude: delivery.pickupLongitude }
    : null;
  const dropoff = delivery
    ? { latitude: delivery.dropoffLatitude, longitude: delivery.dropoffLongitude }
    : null;
  const etaMin =
    courierPos && dropoff ? Math.round((haversineKm(courierPos, dropoff) / 18) * 60) : null;
  const active = clientTrackIndex(status);
  const delivered = status === 'LIVREE';
  const cancelled = status === 'ANNULEE';

  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] border border-border/80 bg-card p-5 shadow-soft">
        <p className="font-display text-xl font-semibold">
          {cancelled ? 'Commande annulée' : delivered ? 'C’est livré' : orderStatusLabel(status)}
        </p>
        {etaMin != null && !delivered && !cancelled && (
          <p className="mt-1 text-sm text-muted-foreground">Arrivée estimée dans {formatDuration(etaMin)}</p>
        )}
        <ol className="mt-5 grid grid-cols-5 gap-1">
          {CLIENT_TRACK_STEPS.map((step, i) => {
            const done = !cancelled && i <= active;
            const current = !cancelled && i === active && !delivered;
            return (
              <li key={step.id} className="flex flex-col items-center gap-2 text-center">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                    done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    current && 'ring-4 ring-primary/20',
                  )}
                >
                  {done && i < active ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      {pickup && dropoff && !cancelled && (
        <GeoMap
          className="h-64 w-full overflow-hidden rounded-[1.5rem] border"
          center={courierPos ?? pickup}
          zoom={13}
          route={{ from: pickup, to: dropoff }}
          markers={[
            {
              id: 'market',
              ...pickup,
              color: '#3d7c2c',
              label: 'Marché',
              popupHtml: '<strong>Marché</strong>',
            },
            {
              id: 'client',
              ...dropoff,
              color: '#c45c26',
              label: 'Livraison',
              popupHtml: '<strong>Chez vous</strong>',
            },
            ...(courierPos
              ? [
                  {
                    id: 'courier',
                    ...courierPos,
                    color: '#2563eb',
                    label: 'Livreur',
                    popupHtml: '<strong>Livreur</strong>',
                  },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
}
