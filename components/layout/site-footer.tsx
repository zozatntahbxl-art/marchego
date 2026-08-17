import Link from 'next/link';
import { ShoppingBasket } from 'lucide-react';

const LINKS = [
  { href: '/marches', label: 'Marchés' },
  { href: '/vendeur/onboarding', label: 'Ouvrir un étal' },
  { href: '/livreur/onboarding', label: 'Devenir livreur' },
  { href: '/legal/cgu', label: 'Conditions' },
  { href: '/legal/confidentialite', label: 'Confidentialité' },
  { href: '/legal/mentions', label: 'Mentions légales' },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/80 bg-[#f3efe4] pb-24 pt-12 md:pb-10">
      <div className="container grid gap-10 md:grid-cols-[1.2fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <ShoppingBasket className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold">MarchéGo</span>
          </Link>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Les étals des marchés belges, livrés comme au comptoir. Bruxelles, Flandre et Wallonie.
          </p>
        </div>
        <nav aria-label="Pied de page" className="grid grid-cols-2 gap-2 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg py-1 text-muted-foreground transition hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="container mt-10 border-t border-border/70 pt-6">
        <p className="text-sm text-foreground">
          Conception et développement : <span className="font-semibold">MAAYOUD.B</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">© {new Date().getFullYear()} MarchéGo · Belgique</p>
      </div>
    </footer>
  );
}
