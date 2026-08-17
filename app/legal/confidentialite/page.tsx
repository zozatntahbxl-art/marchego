import { AppShell } from '@/components/layout/app-shell';

export default function PrivacyPage() {
  return (
    <AppShell>
      <article className="container max-w-2xl space-y-6 py-12">
        <p className="label-caps">RGPD</p>
        <h1 className="section-title">Politique de confidentialité</h1>
        <p>
          MarchéGo, Bruxelles (développement : MAAYOUD.B), est responsable du traitement. Nous
          collectons l’e-mail, le téléphone, les adresses de livraison et, avec consentement
          explicite, la position GPS des livreurs pendant une mission. Les IBAN et documents
          d’identité sont chiffrés au repos (AES-256-GCM).
        </p>
        <p>
          Base légale : exécution du contrat (commandes), obligation légale (facturation, TVA) et
          consentement (géolocalisation, marketing). Durée : 7 ans pour les factures, 24 h pour les
          traces GPS, 30 jours après une demande d’effacement pour les comptes.
        </p>
        <p>
          Droits RGPD : accès, rectification, portabilité, opposition, effacement — via
          privacy@marchego.be ou l’Autorité de protection des données (APD, rue de la Presse 35,
          1000 Bruxelles).
        </p>
      </article>
    </AppShell>
  );
}
