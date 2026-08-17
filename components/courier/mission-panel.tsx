'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/utils';
import { courierStatusLabel } from '@/lib/orders/status';
import { cn } from '@/lib/utils';

type VendorPickup = {
  id: string;
  name: string;
  stallNumber: string | null;
  status: string;
};

const FLOW: Array<{
  when: string[];
  next: string;
  label: string;
  hint: string;
  nav?: 'market' | 'client';
  needsPickups?: boolean;
  needsPin?: boolean;
}> = [
  {
    when: ['ASSIGNEE', 'LIVREUR_ASSIGNE', 'NON_ASSIGNEE'],
    next: 'EN_ROUTE_VERS_MARCHE',
    label: 'Je pars vers le marché',
    hint: 'Ouvrez la navigation, roulez jusqu’aux étals.',
    nav: 'market',
  },
  {
    when: ['EN_ROUTE_VERS_MARCHE'],
    next: 'ARRIVE_AU_MARCHE',
    label: 'Je suis arrivé au marché',
    hint: 'Garez-vous, puis collectez chaque sac.',
  },
  {
    when: ['ARRIVE_AU_MARCHE'],
    next: 'EN_RECUPERATION',
    label: 'Commencer la collecte',
    hint: 'Demandez le code 4 chiffres à chaque vendeur.',
  },
  {
    when: ['EN_RECUPERATION'],
    next: 'EN_ROUTE_VERS_CLIENT',
    label: 'Tout est dans le cabas — je pars',
    hint: 'Tous les étals doivent être cochés.',
    needsPickups: true,
    nav: 'client',
  },
  {
    when: ['EN_ROUTE_VERS_CLIENT'],
    next: 'ARRIVE_CHEZ_CLIENT',
    label: 'Je suis chez le client',
    hint: 'Sonnez, puis demandez le code PIN.',
    nav: 'client',
  },
  {
    when: ['ARRIVE_CHEZ_CLIENT'],
    next: 'LIVREE',
    label: 'Confirmer la remise',
    hint: 'Le client dicte son PIN à 4 chiffres.',
    needsPin: true,
  },
];

export function MissionPanel({
  deliveryId,
  status,
  earningCents,
  pinRequired,
  vendors,
  marketNavUrl,
  clientNavUrl,
}: {
  deliveryId: string;
  status: string;
  earningCents: number;
  pinRequired: boolean;
  vendors: VendorPickup[];
  marketNavUrl: string;
  clientNavUrl: string;
}) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const collected = vendors.filter((v) => v.status === 'RECUPEREE');
  const pending = vendors.filter((v) => v.status !== 'RECUPEREE' && v.status !== 'REFUSEE' && v.status !== 'ANNULEE');
  const step = FLOW.find((s) => s.when.includes(status)) ?? FLOW[0];
  const allPicked = pending.length === 0;

  const pinPad = useMemo(() => ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'], []);

  async function patch(next: string, extra: Record<string, string> = {}) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/deliveries/${deliveryId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next, ...extra }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? 'Mise à jour impossible.');
      toast.error(data.error ?? 'Action refusée');
      return false;
    }
    router.refresh();
    return true;
  }

  async function collect(vendor: VendorPickup) {
    const code = codes[vendor.id]?.trim();
    if (!code || code.length < 4) {
      toast.error('Entrez le code à 4 chiffres du vendeur.');
      return;
    }
    const ok = await patch('EN_RECUPERATION', { vendorOrderId: vendor.id, pickupCode: code });
    if (ok) {
      toast.success(`${vendor.name} récupéré`);
      setCodes((c) => ({ ...c, [vendor.id]: '' }));
    }
  }

  async function goNext() {
    if (step.needsPickups && !allPicked) {
      toast.error('Collectez tous les étals avant de partir.');
      return;
    }
    if (step.needsPin) {
      if (pinRequired && pin.length < 4) {
        toast.error('Le client dicte son PIN.');
        return;
      }
      await patch('LIVREE', { proofType: 'CODE_PIN', pin });
      return;
    }
    await patch(step.next);
  }

  if (status === 'LIVREE') {
    return (
      <div className="rounded-[1.5rem] border bg-primary/5 p-6 text-center">
        <p className="font-display text-2xl font-semibold">Course terminée</p>
        <p className="mt-1 text-sm text-muted-foreground">Gain {formatCents(earningCents)} — merci.</p>
        <Button asChild className="mt-4">
          <a href="/livreur">Retour aux missions</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-[1.35rem] border bg-card px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">Gain de la course</p>
          <p className="font-display text-xl font-semibold">{formatCents(earningCents)}</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
          {courierStatusLabel(status)}
        </span>
      </div>

      {(status === 'EN_RECUPERATION' || status === 'ARRIVE_AU_MARCHE') && (
        <section className="space-y-3 rounded-[1.5rem] border bg-card p-4">
          <p className="font-semibold">
            Collecte {collected.length}/{vendors.length}
          </p>
          {vendors.map((v) => {
            const done = v.status === 'RECUPEREE';
            return (
              <div
                key={v.id}
                className={cn(
                  'rounded-2xl border p-3',
                  done ? 'border-primary/30 bg-primary/5' : 'border-border/80',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">
                    {v.name}
                    {v.stallNumber ? ` · étal ${v.stallNumber}` : ''}
                  </p>
                  {done && <Check className="h-4 w-4 text-primary" />}
                </div>
                {!done && (
                  <div className="mt-2 flex gap-2">
                    <input
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="Code 4 chiffres"
                      className="h-11 flex-1 rounded-xl border bg-background px-3 text-center font-mono text-lg tracking-[0.3em]"
                      value={codes[v.id] ?? ''}
                      onChange={(e) => setCodes((c) => ({ ...c, [v.id]: e.target.value.replace(/\D/g, '') }))}
                    />
                    <Button onClick={() => collect(v)} disabled={busy}>
                      OK
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {step.needsPin && (
        <section className="rounded-[1.5rem] border bg-card p-4">
          <p className="mb-3 text-center text-sm font-medium">PIN client</p>
          <p className="mb-3 text-center font-mono text-3xl tracking-[0.4em]">{pin.padEnd(4, '·')}</p>
          <div className="grid grid-cols-3 gap-2">
            {pinPad.map((key, i) =>
              key === '' ? (
                <span key={i} />
              ) : (
                <button
                  key={key + i}
                  type="button"
                  className="h-12 rounded-xl border bg-muted/40 text-lg font-semibold"
                  onClick={() => {
                    if (key === '⌫') setPin((p) => p.slice(0, -1));
                    else if (pin.length < 4) setPin((p) => p + key);
                  }}
                >
                  {key}
                </button>
              ),
            )}
          </div>
        </section>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {step.nav && (
          <Button asChild variant="outline" className="w-full" size="lg">
            <a href={step.nav === 'market' ? marketNavUrl : clientNavUrl} target="_blank" rel="noreferrer">
              <Navigation className="h-4 w-4" />
              {step.nav === 'market' ? 'Naviguer vers le marché' : 'Naviguer vers le client'}
            </a>
          </Button>
        )}
        <Button size="lg" className="w-full" disabled={busy} onClick={goNext}>
          {step.label}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{step.hint}</p>
      </div>
    </div>
  );
}
