'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Receipt, ShoppingBasket, Store, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MobileTabBar({ cartCount, isAuth }: { cartCount: number; isAuth: boolean }) {
  const path = usePathname();
  const items = [
    { href: '/', label: 'Accueil', icon: Home },
    { href: '/marches', label: 'Marchés', icon: Store },
    { href: '/panier', label: 'Panier', icon: ShoppingBasket, badge: cartCount },
    { href: isAuth ? '/commandes' : '/auth/connexion', label: 'Suivi', icon: Receipt },
    { href: isAuth ? '/compte' : '/auth/connexion', label: 'Compte', icon: UserRound },
  ];

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl md:hidden"
      style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active =
            item.label === 'Accueil'
              ? path === '/'
              : item.label === 'Suivi'
                ? path.startsWith('/commandes')
                : item.label === 'Compte'
                  ? path.startsWith('/compte') || path.startsWith('/auth')
                  : path.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={`${item.href}-${item.label}`}>
              <Link
                href={item.href}
                className={cn(
                  'flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold tracking-wide sm:text-[11px]',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span className="relative flex h-6 w-6 items-center justify-center">
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                  {item.badge ? (
                    <span className="absolute -right-2.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold leading-none text-white">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
