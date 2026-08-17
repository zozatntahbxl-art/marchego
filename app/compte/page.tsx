import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { getCurrentUser } from '@/lib/auth';
import { LogoutButton } from '@/components/auth/logout-button';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/connexion?next=/compte');

  return (
    <AppShell>
      <div className="container max-w-lg space-y-6 py-8">
        <div>
          <p className="label-caps mb-2">Profil</p>
          <h1 className="section-title">Mon compte</h1>
        </div>
        <div className="surface-elevated p-6">
          <p className="font-display text-xl font-semibold">
            {user.profile?.firstName} {user.profile?.lastName}
          </p>
          <p className="mt-1 text-muted-foreground">{user.email}</p>
          <p className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Rôles · {user.roles.join(' · ')}
          </p>
        </div>
        <div className="grid gap-2 text-sm">
          <Link href="/commandes" className="rounded-2xl border bg-card px-4 py-3 hover:bg-muted">
            Mes commandes
          </Link>
          {user.roles.includes('VENDEUR') && (
            <Link href="/vendeur" className="rounded-2xl border bg-card px-4 py-3 hover:bg-muted">
              Espace vendeur
            </Link>
          )}
          {user.roles.includes('LIVREUR') && (
            <Link href="/livreur" className="rounded-2xl border bg-card px-4 py-3 hover:bg-muted">
              Espace livreur
            </Link>
          )}
        </div>
        <LogoutButton />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Conformément au RGPD, vous pouvez demander l’export ou l’effacement de vos données via
          support@marchego.be.
        </p>
      </div>
    </AppShell>
  );
}
