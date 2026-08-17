'use client';

import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function HomeHero({
  totalMarkets = 129,
  brusselsMarkets = 74,
}: {
  totalMarkets?: number;
  brusselsMarkets?: number;
}) {
  return (
    <section className="relative overflow-hidden border-b">
      <div className="absolute inset-0 bg-[#f6f3ea]" />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, hsl(142 38% 32% / 0.12) 0%, transparent 45%), radial-gradient(circle at 85% 10%, hsl(22 78% 48% / 0.1) 0%, transparent 40%)',
        }}
      />
      <div className="grain absolute inset-0" />

      <div className="container relative grid gap-10 py-14 md:grid-cols-2 md:items-center md:py-20 lg:py-24">
        <div className="space-y-6 animate-slide-up">
          <p className="label-caps text-market-700">Belgique · {totalMarkets} marchés référencés</p>
          <h1 className="hero-title text-foreground">
            Les étals du marché,
            <span className="text-primary"> livrés</span> comme au comptoir.
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
            Du Midi au Sablon, de Flagey à la Batte — commandez aux producteurs belges que vous
            connaissez déjà, et recevez le panier avant la fin du marché.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/marches">
                <MapPin className="h-4 w-4" />
                Explorer les marchés
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-card/70">
              <Link href="/vendeur/onboarding">
                Ouvrir mon étal
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <dl className="grid grid-cols-3 gap-4 pt-2">
            {[
              [String(totalMarkets), 'Marchés'],
              [String(brusselsMarkets), 'À Bruxelles'],
              ['30 s', 'Pour commander'],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-display text-2xl font-semibold text-foreground">{v}</dt>
                <dd className="text-xs text-muted-foreground">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative hidden md:block">
          <div className="absolute -left-6 top-8 h-48 w-48 rounded-full bg-market-200/40 blur-3xl" />
          <div className="absolute -right-4 bottom-0 h-40 w-40 rounded-full bg-stall-200/50 blur-3xl" />
          <div className="surface-elevated relative rotate-1 overflow-hidden">
            <div
              className="aspect-[4/3] bg-cover bg-center"
              style={{
                backgroundImage:
                  'url(https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80)',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
              <p className="text-xs font-medium uppercase tracking-wider text-white/80">Aujourd’hui</p>
              <p className="font-display text-xl font-semibold">Gare du Midi · dimanche</p>
              <p className="text-sm text-white/85">450 étals · livraison en 45 min</p>
            </div>
          </div>
          <div className="surface-card absolute -bottom-4 -left-4 max-w-[220px] -rotate-2 p-4">
            <p className="text-xs text-muted-foreground">Panier multi-vendeurs</p>
            <p className="font-semibold">Fromage + pain + légumes</p>
            <p className="mt-1 text-sm text-primary">Livré à Ixelles · 12,40 €</p>
          </div>
        </div>
      </div>
    </section>
  );
}
