import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { RendezVous } from '@/components/home/rendez-vous';

export type DiscoverCounts = {
  sunday?: number;
  bio?: number;
  brussels?: number;
  fleurs?: number;
  brocante?: number;
  poisson?: number;
};

const DISCOVER: Array<{
  href: string;
  title: string;
  kicker: string;
  text: string;
  image: string;
  countKey?: keyof DiscoverCounts;
  featured?: boolean;
}> = [
  {
    href: '/marches?jour=0',
    title: 'Dimanche',
    kicker: 'Le grand jour',
    text: 'Midi, La Batte, Jourdan, Jette…',
    image:
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=1400&q=80',
    countKey: 'sunday',
    featured: true,
  },
  {
    href: '/marches?kind=bio',
    title: 'Bio & fermier',
    kicker: 'Circuits courts',
    text: 'Châtelain, terroir, producteurs',
    image:
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=80',
    countKey: 'bio',
  },
  {
    href: '/marches?region=Bruxelles-Capitale',
    title: 'Bruxelles',
    kicker: '19 communes',
    text: 'Du Midi au Sablon',
    image:
      'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=80',
    countKey: 'brussels',
  },
  {
    href: '/marches?kind=fleurs',
    title: 'Fleurs',
    kicker: 'Botte du jour',
    text: 'Grand-Place, Kouter, Ostende',
    image:
      'https://images.unsplash.com/photo-1490759837105-384976224789?auto=format&fit=crop&w=900&q=80',
    countKey: 'fleurs',
  },
  {
    href: '/marches?kind=brocante',
    title: 'Brocante',
    kicker: 'Chasse aux trésors',
    text: 'Jeu de Balle, Sablon, Sint-Jacobs',
    image:
      'https://images.unsplash.com/photo-1555529669-2269763671c0?auto=format&fit=crop&w=900&q=80',
    countKey: 'brocante',
  },
  {
    href: '/marches?kind=poisson',
    title: 'Poisson',
    kicker: 'Arrivé ce matin',
    text: 'Sainte-Catherine et quais',
    image:
      'https://images.unsplash.com/photo-1498654200943-1088dd4438ae?auto=format&fit=crop&w=900&q=80',
    countKey: 'poisson',
  },
];

function countLabel(n?: number) {
  if (!n) return null;
  return n > 1 ? `${n} marchés` : '1 marché';
}

export function CategoryStrip({ counts }: { counts?: DiscoverCounts }) {
  return (
    <section className="container py-8 sm:py-12 md:py-16">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
        <div>
          <p className="label-caps mb-2">Par où commencer</p>
          <h2 className="section-title">Une envie, un marché.</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            On choisit d’abord le rendez-vous — le dimanche, le bio, Bruxelles — puis les étals.
          </p>
        </div>
        <Link
          href="/marches"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary"
        >
          Tout le répertoire
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DISCOVER.map((card) => {
          const count = countLabel(card.countKey ? counts?.[card.countKey] : undefined);
          return (
            <Link
              key={card.href}
              href={card.href}
              className={`group relative isolate flex min-h-[44px] overflow-hidden rounded-[1.35rem] ring-1 ring-black/5 transition active:scale-[0.99] sm:rounded-[1.75rem] sm:hover:-translate-y-0.5 sm:hover:shadow-lifted ${
                card.featured
                  ? 'min-h-[200px] sm:col-span-2 sm:min-h-[340px] lg:row-span-2 lg:min-h-[440px]'
                  : 'min-h-[168px] sm:min-h-[200px]'
              }`}
            >
              <Image
                src={card.image}
                alt={card.title}
                fill
                sizes={card.featured ? '(min-width: 1024px) 66vw, 100vw' : '(max-width: 640px) 100vw, (min-width: 1024px) 33vw, 50vw'}
                className="object-cover transition duration-700 ease-out group-hover:scale-[1.06]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
              <div className="relative flex h-full flex-col justify-end p-4 text-white sm:p-5 md:p-6">
                <div className="mb-auto flex items-start justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                    {card.kicker}
                  </p>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition group-hover:bg-white group-hover:text-foreground">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
                <p
                  className={`font-display font-semibold leading-[1.1] ${
                    card.featured ? 'text-[1.75rem] sm:text-3xl md:text-4xl' : 'text-xl sm:text-2xl'
                  }`}
                >
                  {card.title}
                </p>
                <p className="mt-1.5 max-w-sm text-sm text-white/80">{card.text}</p>
                {count ? (
                  <p className="mt-3 w-fit rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
                    {count}
                  </p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>

      <RendezVous />
    </section>
  );
}
