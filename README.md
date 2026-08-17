# MarchéGo

Plateforme belge de livraison des courses de marchés. Un client compose son panier auprès des étals d’un marché, paie en une fois, et reçoit la livraison pendant le créneau d’ouverture. Les vendeurs préparent ; les livreurs collectent et remettent contre PIN.

**Conception : M. El Tawfik · Développement : Billy .M**

Stack : Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma, PostgreSQL / PostGIS, Supabase (auth, stockage), Stripe Connect, MapLibre.

Pour tester l’application sans installer de base de données locale, voir [GUIDE.md](./GUIDE.md).

---

## Sommaire

1. [Prérequis](#prérequis)
2. [Installation](#installation)
3. [Variables d’environnement](#variables-denvironnement)
4. [Scripts](#scripts)
5. [Architecture](#architecture)
6. [Modèle métier](#modèle-métier)
7. [API](#api)
8. [Déploiement Vercel](#déploiement-vercel)
9. [Qualité](#qualité)
10. [Licence](#licence)

---

## Prérequis

- Node.js 20 ou supérieur
- npm 10+
- PostgreSQL avec l’extension **PostGIS** (Supabase, Neon + `CREATE EXTENSION postgis`, ou instance Docker)
- Compte Vercel pour la mise en production (optionnel en local)

## Installation

```bash
git clone <url-du-depot>
cd marchego
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

Sans clés Supabase ni Stripe, l’application fonctionne en **mode démonstration** : authentification par cookie `mg_dev_user` (désactivée en production) et paiement marqué comme réglé immédiatement.

## Variables d’environnement

Référence complète : `.env.example`.

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion Postgres (pooler en production) |
| `DIRECT_URL` | Connexion directe, requise pour les migrations Prisma |
| `APP_SECRET` | Signature des jetons internes (PIN, cron), 16 caractères minimum |
| `ENCRYPTION_KEY` | AES-256-GCM, 64 caractères hexadécimaux |
| `NEXT_PUBLIC_APP_URL` | URL publique (`http://localhost:3000` en local) |
| `CRON_SECRET` | Protège `GET /api/cron/assign` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth, Realtime, Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Opérations serveur Storage |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Paiements et Connect |
| `RESEND_API_KEY` | E-mails transactionnels (optionnel) |
| `TWILIO_*` | SMS (optionnel) |

Générez les secrets :

```bash
openssl rand -base64 48   # APP_SECRET
openssl rand -hex 32      # ENCRYPTION_KEY
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | `prisma generate` + build Next.js |
| `npm start` | Serveur de production |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (tarification, assignation, ouvertures) |
| `npm run test:e2e` | Playwright |
| `npm run db:seed` | Marchés belges, vendeurs, produits, comptes de démonstration |
| `npm run prisma:studio` | Interface Prisma |
| `npm run openapi` | Génère `public/openapi.json` |

## Architecture

```
app/                  Routes App Router (pages et API)
components/           UI (accueil, marchés, panier, checkout, vendeur, livreur)
lib/                  Métier : commandes, tarifs, ouverture des marchés, geo, Stripe
prisma/               Schéma, migrations, seed
public/               Service worker PWA
```

Points d’entrée :

- Client : `/`, `/marches`, `/marches/[slug]`, `/panier`, `/commande`, `/commandes/[id]`
- Vendeur : `/vendeur`, `/vendeur/produits`, `/vendeur/onboarding`
- Livreur : `/livreur`, `/livreur/missions/[id]`, `/livreur/onboarding`
- Admin : `/admin`

## Modèle métier

- Un panier appartient à **un seul marché**.
- Montants en **centimes**. TVA alimentaire 6 %, services 21 %.
- Horaires des marchés en fuseau `Europe/Brussels`, jours fériés belges exclus sauf horaire exceptionnel.
- Livraison : code PIN à la remise. Preuves photo côté livreur.
- Assignation livreur : scoring (distance, note, taux d’acceptation), vagues, majoration de 10 % par vague.

## API

Documentation OpenAPI : `public/openapi.json`.

Webhooks Stripe : `POST /api/webhooks/stripe`.  
Cron d’assignation : `GET /api/cron/assign` avec `Authorization: Bearer $CRON_SECRET`.  
RGPD : `GET` / `DELETE /api/account/gdpr`.

## Déploiement Vercel

1. Créez un projet Next.js (Node 20) à partir de ce dépôt.
2. Provisionnez un Postgres **PostGIS**.
3. Renseignez les variables d’environnement (production + preview).
4. Le build exécute `prisma generate && next build`.
5. Après le premier déploiement, appliquez le schéma et les données :

```bash
npx prisma migrate deploy
npm run db:seed
```

6. Webhook Stripe : `https://<domaine>/api/webhooks/stripe`.
7. Cron : `vercel.json` interroge `/api/cron/assign` chaque minute.

`NEXT_PUBLIC_APP_URL` doit correspondre au domaine Vercel (ou un domaine personnalisé).

## Qualité

```bash
npm run typecheck
npm test
```

## Licence

Propriétaire. Conception : **M. El Tawfik**. Développement : **Billy .M**.
