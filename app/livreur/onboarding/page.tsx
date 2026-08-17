import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CourierOnboardingForm } from '@/components/courier/courier-onboarding-form';

export const dynamic = 'force-dynamic';

export default async function CourierOnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/connexion?next=/livreur/onboarding');
  const courier = await prisma.courier.findUnique({ where: { userId: user.id } });
  if (courier) redirect('/livreur');

  return (
    <AppShell>
      <div className="container max-w-lg space-y-6 py-8">
        <div>
          <p className="label-caps mb-2">Candidature</p>
          <h1 className="section-title">Devenir livreur</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Indiquez votre véhicule et votre IBAN. Validation admin obligatoire avant de passer en
            ligne.
          </p>
        </div>
        <CourierOnboardingForm />
      </div>
    </AppShell>
  );
}
