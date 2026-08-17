'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBasket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AccountMenu } from '@/components/layout/account-menu';

const NAV = [
  { href: '/marches', label: 'Marchés' },
  { href: '/commandes', label: 'Commandes', auth: true },
  { href: '/vendeur', label: 'Vendeur', role: 'VENDEUR' as const },
  { href: '/livreur', label: 'Livreur', role: 'LIVREUR' as const },
  { href: '/admin', label: 'Admin', role: 'ADMIN' as const },
];

export function SiteHeader({
  user,
  cartCount,
}: {
  user: {
    roles: string[];
    profile: { firstName: string; lastName: string } | null;
  } | null;
  cartCount: number;
}) {
  const path = usePathname();

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="container flex h-14 items-center justify-between gap-3 sm:h-[3.75rem] sm:gap-4">
        <Link
          href="/"
          className="group flex min-h-11 min-w-0 items-center gap-2 sm:gap-2.5"
          aria-label="MarchéGo, accueil"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft transition group-hover:scale-[1.03]">
            <ShoppingBasket className="h-4 w-4" />
          </span>
          <span className="truncate font-display text-[1.05rem] font-semibold tracking-tight sm:text-lg">
            MarchéGo
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            if (item.auth && !user) return null;
            if (item.role && !user?.roles.includes(item.role)) return null;
            const active = path === item.href || (item.href !== '/' && path.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition',
                  active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <Link
            href="/panier"
            className="relative hidden min-h-11 min-w-11 items-center justify-center rounded-full transition hover:bg-muted md:flex"
            aria-label={cartCount > 0 ? `Panier, ${cartCount} articles` : 'Panier'}
          >
            <ShoppingBasket className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
          <AccountMenu user={user} />
        </div>
      </div>
    </header>
  );
}
