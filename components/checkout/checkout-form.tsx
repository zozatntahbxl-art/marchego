'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Bike, Clock, CreditCard, MapPin, Smartphone, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCents } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Address {
  id: string;
  label: string;
  street: string;
  houseNumber: string;
  city: string;
  postalCode: string;
}

interface CartLine {
  name: string;
  vendor: string;
  quantity: number;
  totalCents: number;
}

export function CheckoutForm({
  cartId,
  addresses,
  quote,
  marketName,
  marketDate,
  items,
}: {
  cartId: string;
  addresses: Address[];
  quote: {
    subtotal: string;
    delivery: string;
    service: string;
    total: string;
    totalCents: number;
    meetsMinimum: boolean;
  };
  marketName: string;
  marketDate: string;
  items: CartLine[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? '');
  const [slot, setSlot] = useState<'ASAP' | 'PLANIFIE'>('ASAP');
  const [tip, setTip] = useState(200);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(addresses.length === 0);

  const selected = addresses.find((a) => a.id === addressId);
  const grandTotal = formatCents(quote.totalCents + tip);

  async function addAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: fd.get('label'),
        street: fd.get('street'),
        houseNumber: fd.get('houseNumber'),
        city: fd.get('city'),
        postalCode: fd.get('postalCode'),
        isDefault: true,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      toast.error(body.error ?? 'Adresse invalide');
      return;
    }
    toast.success('Adresse enregistrée');
    router.refresh();
    setAdding(false);
  }

  async function pay() {
    if (!addressId) {
      toast.error('Ajoutez une adresse de livraison.');
      setStep(1);
      return;
    }
    setLoading(true);
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cartId,
        addressId,
        slotType: slot,
        tipCents: tip,
        customerNote: note || undefined,
      }),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(body.error ?? 'Paiement impossible');
      return;
    }
    toast.success('Commande confirmée — les étals préparent');
    router.push(`/commandes/${body.order.id}`);
  }

  return (
    <div className="space-y-6">
      <ol className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold uppercase tracking-wider">
        {[
          [1, 'Adresse'],
          [2, 'Créneau'],
          [3, 'Paiement'],
        ].map(([n, label]) => (
          <li key={String(n)}>
            <button
              type="button"
              onClick={() => setStep(n as number)}
              className={cn(
                'w-full rounded-full py-2 transition',
                step === n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <section className="space-y-3 rounded-[1.5rem] border border-border/80 bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Où livrer ?</h2>
          </div>
          {addresses.map((a) => (
            <label
              key={a.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition',
                addressId === a.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border/80',
              )}
            >
              <input
                type="radio"
                name="address"
                className="mt-1 accent-primary"
                checked={addressId === a.id}
                onChange={() => setAddressId(a.id)}
              />
              <span>
                <span className="font-semibold">{a.label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {a.street} {a.houseNumber}, {a.postalCode} {a.city}
                </span>
              </span>
            </label>
          ))}
          {adding ? (
            <form onSubmit={addAddress} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="label">Libellé</Label>
                <Input id="label" name="label" defaultValue="Domicile" required />
              </div>
              <div>
                <Label htmlFor="street">Rue</Label>
                <Input id="street" name="street" required />
              </div>
              <div>
                <Label htmlFor="houseNumber">N°</Label>
                <Input id="houseNumber" name="houseNumber" required />
              </div>
              <div>
                <Label htmlFor="postalCode">Code postal</Label>
                <Input id="postalCode" name="postalCode" required />
              </div>
              <div>
                <Label htmlFor="city">Ville</Label>
                <Input id="city" name="city" required />
              </div>
              <Button type="submit" className="sm:col-span-2">
                Enregistrer l’adresse
              </Button>
            </form>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              Nouvelle adresse
            </Button>
          )}
          <Button className="w-full" size="lg" disabled={!addressId} onClick={() => setStep(2)}>
            Continuer
          </Button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4 rounded-[1.5rem] border border-border/80 bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Quand ?</h2>
          </div>
          <button
            type="button"
            onClick={() => setSlot('ASAP')}
            className={cn(
              'w-full rounded-2xl border p-4 text-left transition',
              slot === 'ASAP' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border/80',
            )}
          >
            <p className="font-semibold">Dès que c’est prêt</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Les étals préparent, un livreur récupère, livraison pendant le marché — en général 35 à 55 min.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setSlot('PLANIFIE')}
            className={cn(
              'w-full rounded-2xl border p-4 text-left transition',
              slot === 'PLANIFIE' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border/80',
            )}
          >
            <p className="font-semibold">Fin de marché</p>
            <p className="mt-1 text-sm text-muted-foreground">
              On groupe les courses et on livre en fin de session ({marketDate}).
            </p>
          </button>
          <div>
            <p className="mb-2 text-sm font-medium">Pourboire livreur</p>
            <div className="flex flex-wrap gap-2">
              {[0, 100, 200, 300, 500].map((c) => (
                <Button
                  key={c}
                  type="button"
                  size="sm"
                  variant={tip === c ? 'default' : 'outline'}
                  onClick={() => setTip(c)}
                >
                  {c === 0 ? 'Sans' : `${c / 100} €`}
                </Button>
              ))}
            </div>
          </div>
          <Textarea
            placeholder="Digicode, étage, chien, « déposer chez le voisin »…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button className="w-full" size="lg" onClick={() => setStep(3)}>
            Voir le récapitulatif
          </Button>
        </section>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <section className="rounded-[1.5rem] border border-border/80 bg-card p-5 shadow-soft">
            <p className="label-caps mb-2">{marketName}</p>
            <h2 className="font-display text-lg font-semibold">Votre cabas</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {items.map((i) => (
                <li key={`${i.vendor}-${i.name}`} className="flex justify-between gap-3">
                  <span>
                    {i.quantity}× {i.name}
                    <span className="block text-xs text-muted-foreground">{i.vendor}</span>
                  </span>
                  <span className="shrink-0 font-medium">{formatCents(i.totalCents)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1.5 border-t pt-4 text-sm">
              <Row label="Sous-total" value={quote.subtotal} />
              <Row label="Livraison" value={quote.delivery} />
              <Row label="Service" value={quote.service} />
              <Row label="Pourboire" value={formatCents(tip)} />
              <Row label="Total TTC" value={grandTotal} bold />
            </div>
            {selected && (
              <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                {selected.street} {selected.houseNumber}, {selected.postalCode} {selected.city}
              </p>
            )}
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Bike className="h-4 w-4" />
              {slot === 'ASAP' ? 'Livraison dès que prêt' : 'Livraison en fin de marché'}
            </p>
          </section>

          <section className="rounded-[1.5rem] border border-border/80 bg-card p-5 shadow-soft">
            <p className="mb-3 text-sm font-medium">Payer avec</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  [CreditCard, 'Bancontact'],
                  [Smartphone, 'Payconiq'],
                  [CreditCard, 'Carte'],
                  [Wallet, 'Apple / Google'],
                ] as const
              ).map(([Icon, label], i) => (
                <div
                  key={`${label}-${i}`}
                  className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-xs font-semibold"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              En démo, le paiement est simulé. TVA belge incluse.
            </p>
          </section>

          <Button
            size="lg"
            className="w-full"
            disabled={loading || !quote.meetsMinimum}
            onClick={pay}
          >
            {loading ? 'Confirmation…' : `Payer ${grandTotal}`}
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-semibold' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
