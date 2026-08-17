import { json, withHandler } from '@/lib/http';
import { getStripe } from '@/lib/stripe/client';
import { mapPaymentStatus } from '@/lib/stripe/payments';
import { prisma } from '@/lib/prisma';
import { serverEnv } from '@/lib/env';
import { safeEqual } from '@/lib/security/crypto';
import Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  return withHandler(async () => {
    const raw = await req.text();
    const sig = req.headers.get('stripe-signature');
    if (!sig) return json({ error: 'Signature manquante.' }, 400);

    const stripe = getStripe();
    const secret = serverEnv().STRIPE_WEBHOOK_SECRET;
    if (!secret) return json({ error: 'Webhook non configuré.' }, 503);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(raw, sig, secret);
    } catch {
      return json({ error: 'Signature invalide.' }, 400);
    }

    const existing = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
    if (existing?.processedAt) return json({ received: true, duplicate: true });

    await prisma.webhookEvent.upsert({
      where: { id: event.id },
      create: { id: event.id, provider: 'stripe', type: event.type, payload: event as never },
      update: {},
    });

    try {
      if (
        event.type === 'payment_intent.succeeded' ||
        event.type === 'payment_intent.payment_failed' ||
        event.type === 'payment_intent.canceled'
      ) {
        const intent = event.data.object as Stripe.PaymentIntent;
        await prisma.payment.updateMany({
          where: { stripePaymentIntentId: intent.id },
          data: {
            status: mapPaymentStatus(intent.status),
            paymentMethodType: intent.payment_method_types[0],
            paidAt: intent.status === 'succeeded' ? new Date() : undefined,
            lastEventId: event.id,
          },
        });
        const payment = await prisma.payment.findUnique({
          where: { stripePaymentIntentId: intent.id },
        });
        if (payment) {
          await prisma.order.update({
            where: { id: payment.orderId },
            data: { paymentStatus: mapPaymentStatus(intent.status) },
          });
        }
      }

      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
    } catch (err) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { error: err instanceof Error ? err.message : 'unknown' },
      });
      throw err;
    }

    return json({ received: true });
  });
}

void safeEqual;
