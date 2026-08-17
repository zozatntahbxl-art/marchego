'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Bike, CreditCard, Leaf, ShieldCheck, Store, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HIDE_PREFIXES = ['/commande', '/commandes', '/panier', '/auth', '/admin', '/legal', '/livreur/missions', '/compte'];

const ADS = [
  {
    href: '/marches/gare-du-midi',
    kicker: 'À la une · dimanche',
    title: 'Gare du Midi, 450 étals',
    text: 'Le plus grand marché de Belgique, livré avant la fermeture des étals.',
    cta: 'Voir le marché',
    image:
      'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1400&q=80',
  },
  {
    href: '/marches/chatelain',
    kicker: 'Étal partenaire',
    title: 'Châtelain, mercredi bio',
    text: 'Fromages fermiers, vins nature et pain au levain — l’après-midi mythique d’Ixelles.',
    cta: 'Commander au Châtelain',
    image:
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=80',
  },
];

const TRUST = [
  { icon: Timer, title: 'Le jour du marché', text: 'Livré pendant le créneau, pas le lendemain.' },
  { icon: ShieldCheck, title: 'PIN de remise', text: 'Le colis ne se donne qu’avec votre code.' },
  { icon: CreditCard, title: 'Bancontact', text: 'Paiement belge, encaissé par étal.' },
  { icon: Leaf, title: 'Circuits courts', text: 'Producteurs et commerçants de marchés.' },
];

export function SitePreFooter() {
  const path = usePathname();
  if (HIDE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return null;

  return (
    <div className="space-y-10 pb-4 pt-4">
      <section className="container">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="label-caps mb-1">À la une</p>
            <h2 className="font-display text-2xl font-semibold tracking-tight">Ce week-end sur MarchéGo</h2>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          {ADS.map((ad, i) => (
            <Link
              key={ad.href}
              href={ad.href}
              className={`group relative isolate min-h-[180px] overflow-hidden rounded-[1.5rem] sm:min-h-[220px] sm:rounded-[1.75rem] ${
                i === 0 ? 'lg:min-h-[280px]' : ''
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url(${ad.image})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
              <div className="relative flex h-full flex-col justify-end p-5 text-white sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">{ad.kicker}</p>
                <p className="mt-1 font-display text-2xl font-semibold leading-tight">{ad.title}</p>
                <p className="mt-1 max-w-md text-sm text-white/80">{ad.text}</p>
                <span className="mt-4 inline-flex w-fit items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold backdrop-blur-sm">
                  {ad.cta}
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className="rounded-[1.4rem] border border-border/80 bg-card px-4 py-4">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-market-100 text-market-800">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="font-display text-base font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="container">
        <div className="overflow-hidden rounded-[1.85rem] border border-border/70 bg-[#2a4e21] text-[#faf7ec]">
          <div className="grid md:grid-cols-2">
            <div className="space-y-4 p-6 md:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Commerçants</p>
              <h2 className="font-display text-3xl font-semibold leading-tight">Vous tenez un étal ?</h2>
              <p className="max-w-sm text-sm leading-relaxed text-white/75">
                Rejoignez les marchés déjà sur MarchéGo. Vous préparez les commandes, on s’occupe de
                la livraison le jour J.
              </p>
              <Button asChild variant="secondary" className="bg-[#faf7ec] text-[#2a4e21] hover:bg-white">
                <Link href="/vendeur/onboarding">
                  <Store className="h-4 w-4" />
                  Ouvrir mon étal
                </Link>
              </Button>
            </div>
            <div className="space-y-4 border-t border-white/10 p-6 md:border-l md:border-t-0 md:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Livreurs</p>
              <h2 className="font-display text-3xl font-semibold leading-tight">Courses de quartier.</h2>
              <p className="max-w-sm text-sm leading-relaxed text-white/75">
                Vélo, cargo ou voiture — des missions courtes autour des marchés belges, payées à la
                course.
              </p>
              <Button asChild className="bg-stall-500 text-white hover:bg-stall-600">
                <Link href="/livreur/onboarding">
                  <Bike className="h-4 w-4" />
                  Devenir livreur
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
