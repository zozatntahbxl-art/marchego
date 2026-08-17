import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { VendorOnboardingForm } from '@/components/vendor/vendor-onboarding-form';
import { BELGIAN_MARKETS } from '@/lib/data/belgian-markets';

export const dynamic = 'force-dynamic';

export default async function VendorOnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/connexion?next=/vendeur/onboarding');
  const vendor = await prisma.vendor.findUnique({ where: { userId: user.id } });
  if (vendor) redirect('/vendeur');

  const bruxellesCount = BELGIAN_MARKETS.filter((m) => m.region === 'Bruxelles-Capitale').length;

  return (
    <AppShell>
      <div className="container grid gap-10 py-10 lg:grid-cols-[1fr_340px] lg:py-14">
        <div className="max-w-2xl">
          <p className="label-caps mb-3">Espace vendeur</p>
          <h1 className="hero-title mb-4">Installez votre étal sur MarchéGo</h1>
          <p className="mb-8 text-muted-foreground leading-relaxed">
            Sélectionnez les marchés où vous êtes déjà présent — notre répertoire couvre{' '}
            <strong className="text-foreground">{BELGIAN_MARKETS.length} marchés</strong> en
            Belgique, dont <strong className="text-foreground">{bruxellesCount}</strong> à
            Bruxelles-Capitale. Validation sous 48 h.
          </p>
          <VendorOnboardingForm />
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="surface-elevated overflow-hidden">
              <div
                className="h-40 bg-cover bg-center"
                style={{
                  backgroundImage:
                    'url(https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=800&q=80)',
                }}
              />
              <div className="p-5">
                <p className="font-display text-lg font-semibold">Répertoire national</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Gare du Midi, Flagey, Sablon, La Batte, Theaterplein… chaque marché a sa fiche,
                  ses horaires et sa zone de livraison.
                </p>
              </div>
            </div>
            <div className="surface-card p-5 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Votre marché n’est pas listé ?</p>
              <p className="mt-2">
                Contactez-nous via{' '}
                <Link href="mailto:support@marchego.be" className="text-primary underline">
                  support@marchego.be
                </Link>{' '}
                — nous l’ajoutons sous 24 h.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
