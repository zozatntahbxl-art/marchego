'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MarketPicker, type MarketOption } from '@/components/vendor/market-picker';

export function VendorOnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [markets, setMarkets] = useState<MarketOption[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    businessName: '',
    vatNumber: '',
    iban: '',
    phone: '',
    description: '',
    acceptedTerms: false,
  });

  useEffect(() => {
    fetch('/api/markets/directory')
      .then((r) => r.json())
      .then((body) => setMarkets(body.items ?? []))
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedMarkets.length === 0) {
      setError('Choisissez au moins un marché où vous êtes présent.');
      setStep(1);
      return;
    }
    if (!form.acceptedTerms) {
      setError('Vous devez accepter les conditions.');
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch('/api/vendors/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        marketIds: selectedMarkets,
        acceptedTerms: true,
      }),
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? 'Impossible de créer la boutique.');
      return;
    }
    router.push('/vendeur');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="flex gap-2">
        {[
          ['Emplacements', 1],
          ['Boutique', 2],
          ['Validation', 3],
        ].map(([label, n]) => (
          <button
            key={String(n)}
            type="button"
            onClick={() => setStep(n as number)}
            className={`flex-1 rounded-full py-2 text-xs font-semibold transition ${
              step === n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {step === 1 && (
        <section className="animate-slide-up space-y-4">
          <div className="surface-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-market-100 text-market-800">
                <Store className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold">Où vendez-vous ?</h2>
                <p className="text-sm text-muted-foreground">
                  Cochez tous les marchés belges où votre étal est installé.
                </p>
              </div>
            </div>
            <MarketPicker markets={markets} value={selectedMarkets} onChange={setSelectedMarkets} />
          </div>
          <Button type="button" className="w-full" onClick={() => setStep(2)} disabled={selectedMarkets.length === 0}>
            Continuer
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>
      )}

      {step === 2 && (
        <section className="animate-slide-up space-y-4 surface-card p-5">
          <h2 className="font-display text-lg font-semibold">Votre boutique</h2>
          <div>
            <Label htmlFor="businessName">Nom de l’étal</Label>
            <Input
              id="businessName"
              required
              minLength={2}
              className="mt-1"
              value={form.businessName}
              onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="vatNumber">N° TVA belge (BCE)</Label>
              <Input
                id="vatNumber"
                placeholder="BE0123.456.789"
                required
                className="mt-1"
                value={form.vatNumber}
                onChange={(e) => setForm((f) => ({ ...f, vatNumber: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="0470 12 34 56"
                className="mt-1"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="iban">IBAN</Label>
            <Input
              id="iban"
              placeholder="BE68 5390 0754 7034"
              required
              className="mt-1"
              value={form.iban}
              onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="description">Histoire de votre étal</Label>
            <Textarea
              id="description"
              rows={4}
              placeholder="Fromages affinés, Maraîcher bio depuis 1998…"
              className="mt-1"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Retour
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => setStep(3)}
              disabled={!form.businessName || !form.vatNumber || !form.iban}
            >
              Continuer
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="animate-slide-up space-y-4 surface-card p-5">
          <h2 className="font-display text-lg font-semibold">Récapitulatif</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4 border-b py-2">
              <dt className="text-muted-foreground">Étal</dt>
              <dd className="font-medium">{form.businessName}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b py-2">
              <dt className="text-muted-foreground">Marchés</dt>
              <dd className="font-medium">{selectedMarkets.length} sélectionné(s)</dd>
            </div>
          </dl>
          <label className="flex items-start gap-3 rounded-xl border bg-cream-50/80 p-4 text-sm">
            <input
              type="checkbox"
              checked={form.acceptedTerms}
              onChange={(e) => setForm((f) => ({ ...f, acceptedTerms: e.target.checked }))}
              className="mt-1"
            />
            <span>
              J’accepte les conditions générales vendeur, la commission plateforme et le traitement
              de mes données conformément au RGPD.
            </span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              Retour
            </Button>
            <Button type="submit" disabled={pending || !form.acceptedTerms} className="flex-1">
              {pending ? 'Envoi…' : 'Soumettre mon dossier'}
            </Button>
          </div>
        </section>
      )}
    </form>
  );
}
