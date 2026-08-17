import { AppShell } from '@/components/layout/app-shell';
import { AuthForm } from '@/components/auth/auth-form';

export default function RegisterPage() {
  return (
    <AppShell>
      <div className="container grid min-h-[70vh] items-center gap-10 py-12 lg:grid-cols-2">
        <div className="hidden lg:block">
          <p className="label-caps mb-3">Rejoindre MarchéGo</p>
          <h1 className="hero-title mb-4">Client, vendeur ou livreur — un seul geste pour commencer.</h1>
          <p className="max-w-md text-muted-foreground leading-relaxed">
            Les vendeurs cochent ensuite leurs marchés dans le répertoire national. Les livreurs
            choisissent leur rayon. Vous pourrez ajouter d’autres rôles plus tard.
          </p>
        </div>
        <div className="mx-auto w-full max-w-md">
          <div className="surface-elevated p-6 md:p-8">
            <p className="label-caps mb-2">Inscription</p>
            <h2 className="font-display mb-2 text-2xl font-semibold">Créer un compte</h2>
            <p className="mb-6 text-sm text-muted-foreground">Gratuit · Belgique uniquement · RGPD.</p>
            <AuthForm mode="register" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
