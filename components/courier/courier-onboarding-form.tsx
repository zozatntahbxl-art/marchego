'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const VEHICLES = [
  { value: 'VELO_CARGO', label: 'Vélo-cargo' },
  { value: 'VELO', label: 'Vélo' },
  { value: 'SCOOTER', label: 'Scooter' },
  { value: 'VOITURE', label: 'Voiture' },
  { value: 'CAMIONNETTE', label: 'Camionnette' },
  { value: 'A_PIED', label: 'À pied' },
];

export function CourierOnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/couriers/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleType: fd.get('vehicleType'),
        iban: fd.get('iban'),
        radiusKm: Number(fd.get('radiusKm') || 8),
        model: fd.get('model') || undefined,
        plateNumber: fd.get('plateNumber') || undefined,
        acceptedTerms: fd.get('acceptedTerms') === 'on',
      }),
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? 'Impossible de créer le profil.');
      return;
    }
    router.push('/livreur');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="vehicleType">Véhicule</Label>
        <select
          id="vehicleType"
          name="vehicleType"
          className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"
          defaultValue="VELO_CARGO"
        >
          {VEHICLES.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="iban">IBAN (reversements)</Label>
        <Input id="iban" name="iban" placeholder="BE68 5390 0754 7034" required />
      </div>
      <div>
        <Label htmlFor="radiusKm">Rayon d’action (km)</Label>
        <Input id="radiusKm" name="radiusKm" type="number" min={2} max={30} defaultValue={8} />
      </div>
      <div>
        <Label htmlFor="model">Modèle</Label>
        <Input id="model" name="model" placeholder="Urban Arrow" />
      </div>
      <div>
        <Label htmlFor="plateNumber">Plaque (si applicable)</Label>
        <Input id="plateNumber" name="plateNumber" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="acceptedTerms" required />
        J’accepte les CGU livreur et le suivi GPS pendant les missions.
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Envoi…' : 'Soumettre le dossier'}
      </Button>
    </form>
  );
}
