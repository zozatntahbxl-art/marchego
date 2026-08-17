import { AppShell } from '@/components/layout/app-shell';
import { AuthForm } from '@/components/auth/auth-form';

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <AppShell>
      <div className="container grid min-h-[70vh] items-center gap-10 py-12 lg:grid-cols-2">
        <div className="hidden lg:block">
          <p className="label-caps mb-3">Espace membre</p>
          <h1 className="hero-title mb-4">Retrouvez vos étals, vos commandes, vos tournées.</h1>
          <p className="max-w-md text-muted-foreground leading-relaxed">
            Un seul compte pour commander, vendre ou livrer. En démo, le mot de passe n’est pas
            vérifié — choisissez un profil ci-contre.
          </p>
        </div>
        <div className="mx-auto w-full max-w-md">
          <div className="surface-elevated p-6 md:p-8">
            <p className="label-caps mb-2">Connexion</p>
            <h2 className="font-display mb-1 text-2xl font-semibold">Bon retour</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Essayez <code className="rounded bg-muted px-1">admin@marchego.be</code>,{' '}
              <code className="rounded bg-muted px-1">client@marchego.be</code>,{' '}
              <code className="rounded bg-muted px-1">livreur@marchego.be</code> ou{' '}
              <code className="rounded bg-muted px-1">fromagerie.vandijck@marchego.be</code>.
            </p>
            <AuthForm mode="login" next={searchParams.next} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
