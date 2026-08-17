import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'MarchéGo API',
    version: '1.0.0',
    description: 'API de la place de marché belge de livraison de courses de marchés.',
  },
  servers: [{ url: '/api' }],
  paths: {
    '/markets': { get: { summary: 'Lister les marchés', tags: ['Marchés'] } },
    '/markets/{id}': { get: { summary: 'Détail d’un marché', tags: ['Marchés'] } },
    '/products': { get: { summary: 'Catalogue produits', tags: ['Catalogue'] } },
    '/cart': {
      get: { summary: 'Lire le panier', tags: ['Panier'] },
      put: { summary: 'Mettre à jour le panier', tags: ['Panier'] },
    },
    '/orders': {
      get: { summary: 'Commandes du client', tags: ['Commandes'] },
      post: { summary: 'Créer une commande', tags: ['Commandes'] },
    },
    '/orders/{id}': {
      get: { summary: 'Détail commande', tags: ['Commandes'] },
      patch: { summary: 'Annuler une commande', tags: ['Commandes'] },
    },
    '/auth': { post: { summary: 'Inscription / connexion', tags: ['Auth'] } },
    '/couriers/online': { post: { summary: 'Passer en ligne', tags: ['Livreurs'] } },
    '/couriers/offers/{id}': { post: { summary: 'Accepter / refuser une offre', tags: ['Livreurs'] } },
    '/deliveries/{id}/status': { patch: { summary: 'Mettre à jour une mission', tags: ['Livreurs'] } },
    '/vendors/products': { get: { summary: 'Produits du vendeur', tags: ['Vendeurs'] } },
    '/vendors/orders': { get: { summary: 'Commandes vendeur', tags: ['Vendeurs'] } },
    '/admin/settings': { get: { summary: 'Réglages plateforme', tags: ['Admin'] } },
    '/webhooks/stripe': { post: { summary: 'Webhook Stripe', tags: ['Paiements'] } },
    '/cron/assign': { get: { summary: 'Tick d’assignation (CRON_SECRET)', tags: ['Cron'] } },
    '/account/gdpr': {
      get: { summary: 'Export RGPD', tags: ['Compte'] },
      delete: { summary: 'Demande d’effacement', tags: ['Compte'] },
    },
  },
};

const out = resolve(process.cwd(), 'public/openapi.json');
writeFileSync(out, JSON.stringify(spec, null, 2));
console.info('OpenAPI écrit dans public/openapi.json');
