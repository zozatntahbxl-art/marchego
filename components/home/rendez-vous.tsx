'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import { DAY_LONG } from '@/lib/markets/format';
import { localDayOfWeek } from '@/lib/utils';

/**
 * Rendez-vous = marchés alimentaires où l’on peut composer un panier.
 * Pas de brocante. Triés par prochaine ouverture (fuseau Bruxelles).
 */
const SLOTS = [
  {
    href: '/marches/sainte-catherine',
    name: 'Sainte-Catherine',
    city: 'Bruxelles',
    days: [1, 2, 3, 4, 5, 6],
    hours: '07:00–17:00',
    why: 'Poisson du matin, livré le jour même',
    cta: 'Voir les étals',
    stalls: '40 étals',
    image: 'https://images.unsplash.com/photo-1498654200943-1088dd4438ae?auto=format&fit=crop&w=800&q=80',
    tint: 'from-[#0f766e]/92 via-[#0f766e]/28',
    alt: 'Étal de poissonnerie au marché Sainte-Catherine',
  },
  {
    href: '/marches/chatelain',
    name: 'Châtelain',
    city: 'Ixelles',
    days: [3],
    hours: '12:00–20:30',
    why: 'Bio, fromages, vins nature',
    cta: 'Commander',
    stalls: '45 étals',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
    tint: 'from-[#b45309]/92 via-[#b45309]/28',
    alt: 'Légumes bio au marché du Châtelain',
  },
  {
    href: '/marches/flagey',
    name: 'Flagey',
    city: 'Ixelles',
    days: [0, 2, 3, 4, 5, 6],
    hours: '07:00–14:30',
    why: 'Fromages, pain, fleurs',
    cta: 'Commander',
    stalls: '80 étals',
    image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=800&q=80',
    tint: 'from-[#3d7c2c]/92 via-[#3d7c2c]/28',
    alt: 'Fromages à la coupe au marché Flagey',
  },
  {
    href: '/marches/gare-du-midi',
    name: 'Gare du Midi',
    city: 'Bruxelles',
    days: [0],
    hours: '06:00–14:00',
    why: 'Le plus grand marché de Belgique',
    cta: 'Commander',
    stalls: '450 étals',
    image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=800&q=80',
    tint: 'from-[#c45c26]/92 via-[#c45c26]/32',
    alt: 'Allées du marché de la Gare du Midi',
  },
  {
    href: '/marches/liege-batte',
    name: 'La Batte',
    city: 'Liège',
    days: [0],
    hours: '08:00–14:30',
    why: 'Quais de Meuse, livré le dimanche',
    cta: 'Commander',
    stalls: '200 étals',
    image: 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=800&q=80',
    tint: 'from-[#1d4e89]/92 via-[#1d4e89]/28',
    alt: 'Marché de La Batte le long de la Meuse',
  },
] as const;

function nextOpening(days: readonly number[]) {
  const today = localDayOfWeek(new Date());
  let wait = 7;
  for (const d of days) {
    const w = (d - today + 7) % 7;
    if (w < wait) wait = w;
  }
  const day = (today + wait) % 7;
  const when = wait === 0 ? 'Aujourd’hui' : wait === 1 ? 'Demain' : DAY_LONG[day];
  return { wait, when, day };
}

export function RendezVous() {
  const items = useMemo(
    () =>
      SLOTS.map((s) => ({ ...s, next: nextOpening(s.days) })).sort(
        (a, b) => a.next.wait - b.next.wait || a.name.localeCompare(b.name, 'fr'),
      ),
    [],
  );

  const todayCount = items.filter((i) => i.next.wait === 0).length;

  return (
    <div className="mt-10 sm:mt-12">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caps mb-1">Les rendez-vous</p>
          <h3 className="font-display text-[1.2rem] font-semibold tracking-tight sm:text-xl">
            Où commander cette semaine
          </h3>
          <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
            {todayCount > 0
              ? `${todayCount} marché${todayCount > 1 ? 's' : ''} ouvert${todayCount > 1 ? 's' : ''} aujourd’hui — un marché, un panier, livré pendant le créneau.`
              : 'Triés par prochaine ouverture. Un marché = un panier, livré pendant le créneau.'}
          </p>
        </div>
        <Link
          href="/marches"
          className="tap-44 hidden shrink-0 items-center text-xs font-semibold text-primary sm:inline-flex"
        >
          Tous
          <ArrowRight className="ml-0.5 h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="relative -mx-4 sm:mx-0">
        <ul
          className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pb-4 pt-0.5 touch-pan-x [-webkit-overflow-scrolling:touch] sm:scroll-px-0 sm:px-0"
          aria-label="Marchés à commander, du plus proche au calendrier"
        >
          {items.map((item) => (
            <li
              key={item.href}
              className="w-[min(72vw,17.25rem)] shrink-0 snap-start snap-always sm:w-[15.25rem]"
            >
              <Link
                href={item.href}
                className="group flex h-full min-h-[44px] flex-col overflow-hidden rounded-[1.35rem] bg-card shadow-soft ring-1 ring-black/[0.06] transition active:scale-[0.985] sm:hover:-translate-y-0.5 sm:hover:shadow-lifted"
              >
                <div className="relative aspect-[16/11] sm:h-[10.25rem] sm:aspect-auto">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    sizes="(max-width: 640px) 72vw, 244px"
                    className="object-cover"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${item.tint} to-black/15`} />
                  <span
                    className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold leading-none ${
                      item.next.wait === 0
                        ? 'bg-accent text-white shadow-soft'
                        : 'bg-white/95 text-foreground'
                    }`}
                  >
                    {item.next.when}
                  </span>
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                    {item.stalls}
                  </span>
                </div>
                <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
                  <span className="font-display text-[1.05rem] font-semibold leading-tight">{item.name}</span>
                  <span className="mt-0.5 text-xs text-muted-foreground">
                    {item.city} · {item.hours}
                  </span>
                  <span className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-foreground/80">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-market-700" aria-hidden />
                    {item.why}
                  </span>
                  <span className="mt-auto inline-flex min-h-11 items-center gap-1 pt-2 text-sm font-bold text-accent">
                    {item.cta}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          ))}
          <li className="w-[min(72vw,17.25rem)] shrink-0 snap-start sm:w-[15.25rem]">
            <Link
              href="/marches"
              className="flex h-full min-h-[44px] flex-col justify-between rounded-[1.35rem] border border-dashed border-market-300 bg-market-50/80 px-4 py-5 active:scale-[0.985]"
            >
              <p className="font-display text-lg font-semibold leading-tight text-market-900">
                120+ autres marchés
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Anvers, Namur, Gand, Charleroi… filtrez par région, jour ou type.
              </p>
              <span className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary">
                Ouvrir le répertoire
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          </li>
          <li className="w-2 shrink-0 sm:hidden" aria-hidden />
        </ul>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent sm:hidden" />
      </div>

      <p className="mt-1 text-center text-[11px] font-medium text-muted-foreground sm:hidden">
        Glissez pour le prochain marché →
      </p>
    </div>
  );
}
