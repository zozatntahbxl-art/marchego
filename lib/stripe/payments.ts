import 'server-only';
import { PaymentStatus, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getStripe, BELGIAN_PAYMENT_METHODS } from '@/lib/stripe/client';
import { clientEnv } from '@/lib/env';

/**
 * Création d'un PaymentIntent Stripe Connect avec répartition :
 *
 *  • Le client paie `totalCents` à la plateforme (compte principal).
 *  • `application_fee` = commission vendeurs + frais de service + frais de
 *    livraison − rémunération livreur (la plateforme reverse ensuite au
 *    livreur via un Transfer séparé, car le livreur n'est pas un « vendeur
 *    du PaymentIntent »).
 *  • Les vendeurs reçoivent leur part via `transfer_data` n'est pas adapté
 *    au multi-vendeurs : on utilise des Transfers après capture.
 *
 * On autorise le paiement (`manual` capture) jusqu'à l'acceptation vendeur,
 * puis on capture. En pratique, Bancontact est un débit immédiat : on capture
 * donc tout de suite et on rembourse en cas d'annulation.
 */

export async function createPaymentIntentForOrder(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      payment: true,
      client: { select: { email: true, id: true } },
    },
  });

  if (order.payment?.stripePaymentIntentId) {
    const stripe = getStripe();
    const existing = await stripe.paymentIntents.retrieve(order.payment.stripePaymentIntentId);
    return existing;
  }

  const stripe = getStripe();
  const intent = await stripe.paymentIntents.create({
    amount: order.totalCents,
    currency: 'eur',
    payment_method_types: BELGIAN_PAYMENT_METHODS,
    capture_method: 'automatic',
    receipt_email: order.client.email,
    metadata: {
      orderId: order.id,
      orderReference: order.reference,
      clientId: order.client.id,
    },
    statement_descriptor_suffix: 'MARCHEGO',
    description: `MarchéGo ${order.reference}`,
  });

  await prisma.payment.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      stripePaymentIntentId: intent.id,
      amountCents: order.totalCents,
      status: mapPaymentStatus(intent.status),
    },
    update: {
      stripePaymentIntentId: intent.id,
      amountCents: order.totalCents,
      status: mapPaymentStatus(intent.status),
    },
  });

  return intent;
}

export function mapPaymentStatus(status: string): PaymentStatus {
  switch (status) {
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
      return 'EN_ATTENTE';
    case 'requires_capture':
      return 'AUTORISE';
    case 'succeeded':
      return 'PAYE';
    case 'canceled':
      return 'ANNULE';
    default:
      return 'ECHOUE';
  }
}

export async function refundPayment(params: {
  paymentId: string;
  amountCents: number;
  reason: string;
  initiatedById?: string;
  disputeId?: string;
}) {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: params.paymentId },
  });

  const remaining = payment.amountCents - payment.refundedCents;
  const amount = Math.min(params.amountCents, remaining);
  if (amount <= 0) {
    throw Object.assign(new Error('Aucun montant remboursable.'), { status: 409 });
  }

  const stripe = getStripe();
  if (!payment.stripePaymentIntentId) {
    throw Object.assign(new Error('Paiement Stripe introuvable.'), { status: 409 });
  }

  const refund = await stripe.refunds.create({
    payment_intent: payment.stripePaymentIntentId,
    amount,
    reason: 'requested_by_customer',
    metadata: { paymentId: payment.id, reason: params.reason },
  });

  const newRefunded = payment.refundedCents + amount;
  const fullyRefunded = newRefunded >= payment.amountCents;

  await prisma.$transaction([
    prisma.refund.create({
      data: {
        paymentId: payment.id,
        stripeRefundId: refund.id,
        amountCents: amount,
        reason: params.reason,
        initiatedById: params.initiatedById,
        disputeId: params.disputeId,
        status: refund.status ?? 'EN_ATTENTE',
      },
    }),
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        refundedCents: newRefunded,
        status: fullyRefunded ? 'REMBOURSE' : 'REMBOURSE_PARTIEL',
      },
    }),
    prisma.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: fullyRefunded ? 'REMBOURSE' : 'REMBOURSE_PARTIEL' },
    }),
  ]);

  return refund;
}

/**
 * Reverse un payout vers un compte Connect. Utilisé par le cron hebdomadaire.
 * Si le compte n'est pas encore onboardé, le payout reste `PROGRAMME`.
 */
export async function transferToConnectAccount(params: {
  stripeAccountId: string;
  amountCents: number;
  payoutId: string;
  description: string;
}) {
  const stripe = getStripe();
  return stripe.transfers.create({
    amount: params.amountCents,
    currency: 'eur',
    destination: params.stripeAccountId,
    description: params.description,
    metadata: { payoutId: params.payoutId },
  });
}

export function checkoutReturnUrl(orderId: string) {
  const base = clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  return {
    success: `${base}/commandes/${orderId}?paiement=ok`,
    cancel: `${base}/panier?paiement=annule`,
  };
}

export type JsonValue = Prisma.InputJsonValue;
