import { AppShell } from '@/components/layout/app-shell';

export default function TermsPage() {
  return (
    <AppShell>
      <article className="container max-w-2xl space-y-6 py-12">
        <p className="label-caps">Mentions légales</p>
        <h1 className="section-title">Conditions générales</h1>
        <p>
          MarchéGo met en relation des clients, des vendeurs de marchés et des livreurs indépendants
          en Belgique. La plateforme n’est pas vendeuse des denrées : chaque étal reste responsable
          de la qualité et de la conformité de ses produits (AFSCA).
        </p>
        <h2>Annulation</h2>
        <p>
          Annulation gratuite tant qu’aucun vendeur n’a accepté, ou dans les 2 minutes. Au-delà, les
          frais de service peuvent être retenus. Si un livreur est déjà assigné, des frais
          d’annulation s’ajoutent.
        </p>
        <h2>Paiement</h2>
        <p>
          Paiements traités par Stripe (Bancontact, cartes, wallets). Split payment vers les
          vendeurs et livreurs via Stripe Connect. TVA belge : 6 % alimentation, 21 % services.
        </p>
      </article>
    </AppShell>
  );
}
