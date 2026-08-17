import 'server-only';
import Stripe from 'stripe';
import { serverEnv, integrations } from '@/lib/env';

/**
 * Client Stripe unique. `null` si la clé n'est pas configurée : les routes
 * de paiement renvoient alors une erreur explicite plutôt que de planter au
 * chargement du module.
 *
 * API version figée : un bump doit être un changement conscient (cf. skill
 * Stripe upgrade).
 */

let stripeSingleton: Stripe | null | undefined;

export function getStripe(): Stripe {
  if (stripeSingleton === undefined) {
    const key = process.env.STRIPE_SECRET_KEY;
    stripeSingleton = key
      ? new Stripe(key, {
          apiVersion: '2025-02-24.acacia',
          typescript: true,
          appInfo: { name: 'MarcheGo', version: '1.0.0' },
        })
      : null;
  }
  if (!stripeSingleton) {
    throw Object.assign(new Error('Stripe n’est pas configuré (STRIPE_SECRET_KEY).'), {
      status: 503,
    });
  }
  return stripeSingleton;
}

export function isStripeConfigured() {
  return integrations.stripe;
}

/**
 * Payment methods belges activés sur le PaymentIntent.
 * Bancontact et Payconiq sont les moyens de paiement les plus utilisés
 * en Belgique ; Apple Pay / Google Pay passent par `card` (wallets).
 */
export const BELGIAN_PAYMENT_METHODS: NonNullable<
  Stripe.PaymentIntentCreateParams['payment_method_types']
> = ['bancontact', 'card', 'klarna'];

export { Stripe };
export { serverEnv };
