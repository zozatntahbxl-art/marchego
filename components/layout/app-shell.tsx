import { getCurrentUser } from '@/lib/auth';
import { getActiveCart } from '@/lib/cart';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { SitePreFooter } from '@/components/layout/site-prefooter';

export async function AppShell({ children }: { children: React.ReactNode }) {
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  let cartCount = 0;
  try {
    const [current, cart] = await Promise.all([getCurrentUser(), getActiveCart()]);
    user = current;
    cartCount = cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
  } catch {
    user = null;
    cartCount = 0;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader user={user} cartCount={cartCount} />
      <main className="flex-1">{children}</main>
      <SitePreFooter />
      <SiteFooter />
      <MobileTabBar cartCount={cartCount} isAuth={Boolean(user)} />
    </div>
  );
}
