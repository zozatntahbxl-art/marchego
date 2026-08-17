import { AppShell } from '@/components/layout/app-shell';

export default function ImprintPage() {
  return (
    <AppShell>
      <article className="container max-w-2xl space-y-6 py-12">
        <p className="label-caps">Société</p>
        <h1 className="section-title">Mentions légales</h1>
        <p>
          MarchéGo · Siège : Rue du Marché 12, 1000 Bruxelles · contact@marchego.be
        </p>
        <p>
          Conception : <strong>M. El Tawfik</strong>
          <br />
          Développement : <strong>Billy .M</strong>
        </p>
        <p>Hébergement : Vercel Inc. · Paiements : Stripe Payments Europe Ltd.</p>
      </article>
    </AppShell>
  );
}
