'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/utils';
import { vendorStatusLabel } from '@/lib/orders/status';
import { cn } from '@/lib/utils';

type VendorOrderCard = {
  id: string;
  status: string;
  subtotalCents: number;
  pickupCode: string;
  stallNumber: string | null;
  items: Array<{ productName: string; quantity: number }>;
  order: { reference: string; market: { name: string }; createdAt?: string | Date };
};

const TABS = [
  { id: 'todo', label: 'À traiter', statuses: ['EN_ATTENTE'] },
  { id: 'prep', label: 'En cours', statuses: ['ACCEPTEE', 'EN_PREPARATION'] },
  { id: 'ready', label: 'Prêtes', statuses: ['PRETE'] },
  { id: 'done', label: 'Terminées', statuses: ['RECUPEREE', 'REFUSEE', 'ANNULEE'] },
] as const;

export function VendorOrders({ orders }: { orders: VendorOrderCard[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('todo');
  const [busy, setBusy] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of TABS) {
      map[t.id] = orders.filter((o) => (t.statuses as readonly string[]).includes(o.status)).length;
    }
    return map;
  }, [orders]);

  const visible = orders.filter((o) => {
    const t = TABS.find((x) => x.id === tab)!;
    return (t.statuses as readonly string[]).includes(o.status);
  });

  async function setStatus(id: string, status: string) {
    setBusy(id);
    const res = await fetch(`/api/vendors/orders?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? 'Impossible de mettre à jour');
      return;
    }
    toast.success(
      status === 'ACCEPTEE' ? 'Commande acceptée' : status === 'PRETE' ? 'Sac prêt pour le livreur' : 'Mis à jour',
    );
    if (status === 'ACCEPTEE' && tab === 'todo') setTab('prep');
    if (status === 'PRETE') setTab('ready');
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Commandes du jour</h2>
        {counts.todo > 0 && (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-white">
            {counts.todo} nouvelle{counts.todo > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold',
              tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            {t.label}
            {counts[t.id] ? ` · ${counts[t.id]}` : ''}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="rounded-[1.4rem] border border-dashed p-8 text-center text-sm text-muted-foreground">
          Rien dans cet onglet pour le moment.
        </p>
      )}

      {visible.map((o) => (
        <article key={o.id} className="space-y-3 rounded-[1.5rem] border border-border/80 bg-card p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-lg font-semibold">{o.order.reference}</p>
              <p className="text-sm text-muted-foreground">
                {o.order.market.name}
                {o.stallNumber ? ` · étal ${o.stallNumber}` : ''}
              </p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
              {vendorStatusLabel(o.status)}
            </span>
          </div>
          <ul className="space-y-1 text-sm">
            {o.items.map((i) => (
              <li key={i.productName} className="flex justify-between">
                <span>
                  {i.quantity}× {i.productName}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm font-semibold">{formatCents(o.subtotalCents)}</p>

          {o.status === 'EN_ATTENTE' && (
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" disabled={busy === o.id} onClick={() => setStatus(o.id, 'ACCEPTEE')}>
                Accepter
              </Button>
              <Button
                size="lg"
                variant="outline"
                disabled={busy === o.id}
                onClick={() => setStatus(o.id, 'REFUSEE')}
              >
                Refuser
              </Button>
            </div>
          )}

          {(o.status === 'ACCEPTEE' || o.status === 'EN_PREPARATION') && (
            <Button size="lg" className="w-full" disabled={busy === o.id} onClick={() => setStatus(o.id, 'PRETE')}>
              Sac prêt — afficher le code livreur
            </Button>
          )}

          {o.status === 'PRETE' && (
            <div className="rounded-2xl bg-secondary/70 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Code à dicter au livreur
              </p>
              <p className="mt-1 font-display text-4xl font-semibold tracking-[0.28em]">{o.pickupCode}</p>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
