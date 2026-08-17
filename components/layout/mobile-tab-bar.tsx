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
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = item.href === '/' ? path === '/' : path.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {item.badge ? (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
                      {item.badge}
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
