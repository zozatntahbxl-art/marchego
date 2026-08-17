'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgeEuro,
  Bike,
  CalendarDays,
  Flag,
  LayoutDashboard,
  MessageSquareWarning,
  Package,
  Settings,
  ShoppingBag,
  Store,
  Tags,
  Users,
  ScrollText,
  Star,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/admin', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users },
  { href: '/admin/vendors', label: 'Vendeurs', icon: Store },
  { href: '/admin/couriers', label: 'Livreurs', icon: Bike },
  { href: '/admin/markets', label: 'Marchés', icon: Flag },
  { href: '/admin/products', label: 'Produits', icon: Package },
  { href: '/admin/categories', label: 'Catégories', icon: Tags },
  { href: '/admin/orders', label: 'Commandes', icon: ShoppingBag },
  { href: '/admin/disputes', label: 'Litiges', icon: MessageSquareWarning },
  { href: '/admin/reviews', label: 'Avis', icon: Star },
  { href: '/admin/payouts', label: 'Versements', icon: BadgeEuro },
  { href: '/admin/holidays', label: 'Jours fériés', icon: CalendarDays },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/settings', label: 'Réglages', icon: Settings },
  { href: '/admin/audit', label: 'Journal', icon: ScrollText },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border/70 bg-card/80 md:block">
      <div className="sticky top-0 flex h-dvh flex-col">
        <Link href="/" className="border-b border-border/70 px-5 py-4">
          <span className="label-caps">Back-office</span>
          <span className="mt-1 block font-display text-lg font-semibold">MarchéGo</span>
        </Link>
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {LINKS.map((link) => {
              const active = link.href === '/admin' ? path === '/admin' : path.startsWith(link.href);
              const Icon = link.icon;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
                      active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}

export function AdminMobileNav() {
  const path = usePathname();
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto border-b bg-card px-3 py-2 md:hidden">
      {LINKS.map((link) => {
        const active = link.href === '/admin' ? path === '/admin' : path.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
              active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
