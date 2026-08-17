'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Bike, MapPin, Store } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { formatCents, formatDistance } from '@/lib/utils';

interface Offer {
  id: string;
  deliveryId: string;
  expiresAt: string;
  earning: number;
  distance: number;
  market: string;
  vendors: number;
  dropoff?: string;
}

interface ActiveMission {
  id: string;
  market: string;
  status: string;
  earning: number;
}

export function CourierHub({
  online,
  verified,
  offers,
  missions = [],
  rating,
  earnings,
}: {
  courierId: string;
  online: boolean;
  verified: boolean;
  offers: Offer[];
  missions?: ActiveMission[];
  rating: number;
  earnings: number;
}) {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(online);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [isOnline, router]);

  async function toggle(next: boolean) {
    setIsOnline(next);
    await fetch('/api/couriers/online', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ online: next }),
    });
    if (next && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        fetch('/api/couriers/online', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        });
      });
    }
    router.refresh();
  }

  async function respond(id: string, action: 'accept' | 'refuse', deliveryId?: string) {
    setBusy(id);
    const res = await fetch(`/api/couriers/offers/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const body = await res.json();
    setBusy(null);
    if (!res.ok) {
      toast.error(body.error ?? 'Action impossible');
      return;
    }
    if (action === 'accept') {
      toast.success('Course à vous');
      const dest = body.offer?.deliveryId ?? deliveryId;
      if (dest) router.push(`/livreur/missions/${dest}`);
      else router.refresh();
      return;
    }
    toast.message('Offre refusée');
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div
        className={`flex items-center justify-between rounded-[1.5rem] border p-5 shadow-soft ${
          isOnline ? 'border-primary/30 bg-primary/5' : 'border-border/80 bg-card'
        }`}
      >
        <div>
          <p className="font-display text-lg font-semibold">
            {isOnline ? 'Vous êtes en ligne' : 'Hors ligne'}
          </p>
          <p className="text-sm text-muted-foreground">
            {verified ? `Note ${rating.toFixed(1)} · ${formatCents(earnings)} gagnés` : 'En attente de validation admin'}
          </p>
        </div>
        <Switch checked={isOnline} onCheckedChange={toggle} disabled={!verified} />
      </div>

      {missions.length > 0 && (
        <section className="space-y-2">
          <p className="label-caps">Course en cours</p>
          {missions.map((m) => (
            <Link
              key={m.id}
              href={`/livreur/missions/${m.id}`}
              className="flex items-center justify-between rounded-[1.35rem] border border-primary/30 bg-card p-4 shadow-soft"
            >
              <div>
                <p className="font-semibold">{m.market}</p>
                <p className="text-xs text-muted-foreground">{m.status}</p>
              </div>
              <span className="text-sm font-bold text-accent">{formatCents(m.earning)}</span>
            </Link>
          ))}
        </section>
      )}

      {offers.map((o) => {
        const remaining = Math.max(0, Math.ceil((new Date(o.expiresAt).getTime() - now) / 1000));
        return (
          <article
            key={o.id}
            className="space-y-4 overflow-hidden rounded-[1.6rem] border border-accent/30 bg-card p-5 shadow-lifted"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label-caps text-accent">Nouvelle course</p>
                <h3 className="font-display text-xl font-semibold">{o.market}</h3>
              </div>
              <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold text-white">{remaining}s</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-2xl bg-muted/60 p-3">
                <Bike className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                <p className="font-semibold">{formatCents(o.earning)}</p>
                <p className="text-[10px] text-muted-foreground">Gain</p>
              </div>
              <div className="rounded-2xl bg-muted/60 p-3">
                <MapPin className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                <p className="font-semibold">{formatDistance(o.distance)}</p>
                <p className="text-[10px] text-muted-foreground">Marché</p>
              </div>
              <div className="rounded-2xl bg-muted/60 p-3">
                <Store className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                <p className="font-semibold">{o.vendors}</p>
                <p className="text-[10px] text-muted-foreground">étal{o.vendors > 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${Math.min(100, (remaining / 30) * 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="lg"
                disabled={remaining === 0 || busy === o.id}
                onClick={() => respond(o.id, 'accept', o.deliveryId)}
              >
                Accepter
              </Button>
              <Button
                size="lg"
                variant="outline"
                disabled={busy === o.id}
                onClick={() => respond(o.id, 'refuse')}
              >
                Passer
              </Button>
            </div>
          </article>
        );
      })}

      {offers.length === 0 && isOnline && missions.length === 0 && (
        <div className="rounded-[1.5rem] border border-dashed p-10 text-center">
          <p className="font-display text-lg font-semibold">En écoute</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Les courses proches apparaissent ici. Gardez l’app ouverte.
          </p>
        </div>
      )}
    </div>
  );
}
