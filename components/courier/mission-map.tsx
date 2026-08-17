'use client';

import dynamic from 'next/dynamic';

const GeoMap = dynamic(() => import('@/components/maps/geo-map').then((m) => m.GeoMap), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-2xl bg-muted" />,
});

export function MissionMap({
  pickup,
  dropoff,
}: {
  pickup: { latitude: number; longitude: number };
  dropoff: { latitude: number; longitude: number };
}) {
  return (
    <GeoMap
      className="h-56 w-full overflow-hidden rounded-2xl border"
      center={pickup}
      zoom={13}
      route={{ from: pickup, to: dropoff }}
      markers={[
        { id: 'pickup', ...pickup, color: '#3d7c2c', label: 'Marché', popupHtml: '<strong>Marché</strong>' },
        {
          id: 'dropoff',
          ...dropoff,
          color: '#f97316',
          label: 'Client',
          popupHtml: '<strong>Livraison client</strong>',
        },
      ]}
    />
  );
}
