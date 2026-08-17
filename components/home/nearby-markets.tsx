'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { MapPin, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { haversineKm, BELGIUM_CENTER } from '@/lib/geo';
import { formatDistance } from '@/lib/utils';
import type { OpeningSnapshot } from '@/lib/markets/opening';

interface MarketCard {
  id: string;
  name: string;
  slug: string;
  city: string;
  imageUrl: string | null;
  vendorCount: number;
  opening: OpeningSnapshot;
  latitude: number;
  longitude: number;
}

export function NearbyMarkets({ markets }: { markets: MarketCard[] }) {
  const [origin, setOrigin] = useState(BELGIUM_CENTER);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setOrigin({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 4000 },
    );
  }, []);

  const sorted = useMemo(
    () =>
      [...markets]
        .map((m) => ({
          ...m,
          distanceKm: haversineKm(origin, { latitude: m.latitude, longitude: m.longitude }),
        }))
        .sort((a, b) => Number(b.opening.isOpen) - Number(a.opening.isOpen) || a.distanceKm - b.distanceKm),
    [markets, origin],
  );

  return (
    <section className="container pb-10">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Marchés autour de vous</h2>
          <p className="text-sm text-muted-foreground">Ouverts aujourd’hui en priorité</p>
        </div>
        <Link href="/marches" className="text-sm font-semibold text-primary">
          Tout voir
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((m) => (
          <Link key={m.id} href={`/marches/${m.slug}`}>
            <Card className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lifted">
              <div
                className="h-36 bg-cover bg-center"
                style={{
                  backgroundImage: m.imageUrl
                    ? `url(${m.imageUrl})`
                    : 'linear-gradient(135deg,#3d7c2c,#f97316)',
                }}
              />
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{m.name}</h3>
                  <Badge variant={m.opening.isOpen ? 'success' : 'muted'}>
                    {m.opening.isOpen ? 'Ouvert' : 'Fermé'}
                  </Badge>
                </div>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {m.city} · {formatDistance(m.distanceKm)}
                </p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {m.opening.isOpen && m.opening.current
                    ? `Jusqu’à ${m.opening.current.endTime}`
                    : m.opening.nextOpen
                      ? `Prochaine ouverture ${m.opening.nextOpen.date} ${m.opening.nextOpen.startTime}`
                      : 'Horaires à venir'}
                </p>
                <p className="text-xs text-muted-foreground">{m.vendorCount} vendeurs</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
