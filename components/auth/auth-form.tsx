'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AuthForm({ mode, next }: { mode: 'login' | 'register'; next?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('CLIENT');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload =
      mode === 'register'
        ? {
            email: fd.get('email'),
            password: fd.get('password'),
            firstName: fd.get('firstName'),
            lastName: fd.get('lastName'),
            phone: fd.get('phone'),
            role,
            acceptedTerms: true,
          }
        : { email: fd.get('email'), password: fd.get('password') };

    const res = await fetch(`/api/auth?action=${mode === 'register' ? 'register' : 'login'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(body.error ?? 'Échec');
      return;
    }
    toast.success(mode === 'register' ? 'Compte créé' : 'Bienvenue');
    router.push(next || (role === 'VENDEUR' ? '/vendeur' : role === 'LIVREUR' ? '/livreur' : '/'));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === 'register' && (
        <>
          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
            <div>
              <Label htmlFor="firstName">Prénom</Label>
              <Input id="firstName" name="firstName" required />
            </div>
            <div>
              <Label htmlFor="lastName">Nom</Label>
              <Input id="lastName" name="lastName" required />
            </div>
          </div>
          <div>
            <Label htmlFor="phone">Téléphone belge</Label>
            <Input id="phone" name="phone" placeholder="0470 12 34 56" required />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Je m’inscris en tant que</legend>
            {[
              ['CLIENT', 'Client', 'Commander les étals'],
              ['LIVREUR', 'Livreur', 'Livrer le quartier'],
              ['VENDEUR', 'Vendeur de marché', 'Tenir boutique'],
            ].map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-sm transition ${
                  role === value ? 'border-primary bg-primary/5' : 'border-border/80'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  checked={role === value}
                  onChange={() => setRole(value)}
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="font-semibold">{label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </>
      )}
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" name="password" type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Patientez…' : mode === 'register' ? 'Créer mon compte' : 'Se connecter'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {mode === 'login' ? (
          <>
            Pas encore de compte ? <Link href="/auth/inscription" className="text-primary">S’inscrire</Link>
          </>
        ) : (
          <>
            Déjà inscrit ? <Link href="/auth/connexion" className="text-primary">Connexion</Link>
          </>
        )}
      </p>
    </form>
  );
}
