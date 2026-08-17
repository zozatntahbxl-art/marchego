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

      <div className="container relative grid gap-8 py-8 sm:gap-10 sm:py-14 md:grid-cols-2 md:items-center md:py-20 lg:py-24">
        <div className="space-y-5 animate-slide-up sm:space-y-6">
          <p className="label-caps text-market-700">Belgique · {totalMarkets} marchés référencés</p>
          <h1 className="hero-title text-foreground">
            Les étals du marché,
            <span className="text-primary"> livrés</span> comme au comptoir.
          </h1>
          <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground sm:text-base md:text-lg">
            Du Midi au Sablon, de Flagey à la Batte — commandez aux producteurs belges que vous
            connaissez déjà, et recevez le panier avant la fin du marché.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
            <Button asChild size="lg" className="w-full min-h-12 sm:w-auto">
              <Link href="/marches">
                <MapPin className="h-4 w-4" />
                Explorer les marchés
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full min-h-12 bg-card/70 sm:w-auto">
              <Link href="/vendeur/onboarding">
                Ouvrir mon étal
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <dl className="grid grid-cols-3 gap-2 pt-1 sm:gap-4 sm:pt-2">
            {[
              [String(totalMarkets), 'Marchés'],
              [String(brusselsMarkets), 'À Bruxelles'],
              ['30 s', 'Pour commander'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-white/50 px-2 py-2.5 text-center sm:bg-transparent sm:px-0 sm:py-0 sm:text-left">
                <dt className="font-display text-xl font-semibold text-foreground sm:text-2xl">{v}</dt>
                <dd className="text-[11px] leading-tight text-muted-foreground sm:text-xs">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="absolute -left-6 top-8 hidden h-48 w-48 rounded-full bg-market-200/40 blur-3xl md:block" />
          <div className="absolute -right-4 bottom-0 hidden h-40 w-40 rounded-full bg-stall-200/50 blur-3xl md:block" />
          <div className="surface-elevated relative overflow-hidden md:rotate-1">
            <div
              className="aspect-[16/9] bg-cover bg-center sm:aspect-[4/3]"
              style={{
                backgroundImage:
                  'url(https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80)',
              }}
              role="img"
              aria-label="Allées du marché de la Gare du Midi"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white sm:p-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/80">Le dimanche</p>
              <p className="font-display text-lg font-semibold sm:text-xl">Gare du Midi</p>
              <p className="text-sm text-white/85">450 étals · livré avant 14 h</p>
            </div>
          </div>
          <div className="surface-card mt-3 p-3.5 md:absolute md:-bottom-4 md:-left-4 md:mt-0 md:max-w-[220px] md:-rotate-2 md:p-4">
            <p className="text-xs text-muted-foreground">Panier multi-vendeurs</p>
            <p className="font-semibold">Fromage + pain + légumes</p>
            <p className="mt-1 text-sm text-primary">Livré à Ixelles · 12,40 €</p>
          </div>
        </div>
      </div>
    </section>
  );
}
