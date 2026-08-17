import Link from 'next/link';
import { Bike, ShoppingBag, Store } from 'lucide-react';

const STEPS = [
  {
    icon: Store,
    title: 'Choisissez votre marché',
    body: 'Bruxelles, Anvers, Liège… parcourez le répertoire complet avec carte, horaires et étals ouverts.',
  },
  {
    icon: ShoppingBag,
    title: 'Composez votre panier',
    body: 'Fromages, légumes, boulangerie — plusieurs vendeurs, une seule commande, un seul paiement.',
  },
  {
    icon: Bike,
    title: 'Suivez la livraison',
    body: 'Statut en direct, position du livreur sur la carte, PIN de remise à l’arrivée.',
  },
];

export function HowItWorks() {
  return (
    <section className="border-y bg-cream-50/60 py-14 md:py-16">
      <div className="container">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-caps mb-2">Simple comme au marché</p>
            <h2 className="section-title">Trois gestes, c’est livré.</h2>
          </div>
          <Link href="/marches" className="text-sm font-semibold text-primary hover:underline">
            Voir tous les marchés →
          </Link>
        </div>
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="surface-card relative p-6">
                <span className="absolute right-5 top-5 font-display text-4xl font-light text-muted-foreground/20">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-market-100 text-market-800">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
