import 'server-only';
import { NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { integrations, serverEnv } from '@/lib/env';
import { createServiceClient } from '@/lib/supabase/client';

/**
 * Hub de notifications : persiste en base (cloche in-app), diffuse via
 * Supabase Realtime, et tente push / email / SMS selon les canaux demandés.
 *
 * Chaque canal est optionnel : l'absence de clé API n'empêche pas le reste.
 */

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
  channels?: NotificationChannel[];
}

export async function notify(input: NotifyInput) {
  const channels = input.channels ?? ['IN_APP', 'PUSH'];

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      channels,
      title: input.title,
      body: input.body,
      data: (input.data ?? {}) as Prisma.InputJsonValue,
      actionUrl: input.actionUrl,
      sentAt: new Date(),
    },
  });

  await Promise.allSettled([
    broadcastInApp(input.userId, notification.id),
    channels.includes('PUSH') ? sendPush(input) : Promise.resolve(),
    channels.includes('EMAIL') ? sendEmail(input) : Promise.resolve(),
    channels.includes('SMS') ? sendSms(input) : Promise.resolve(),
  ]);

  return notification;
}

async function broadcastInApp(userId: string, notificationId: string) {
  const supabase = createServiceClient();
  if (!supabase) return;
  await supabase.channel(`user:${userId}`).send({
    type: 'broadcast',
    event: 'notification',
    payload: { notificationId },
  });
}

async function sendPush(input: NotifyInput) {
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: input.userId, isActive: true },
  });
  if (subs.length === 0) return;

  const provider = process.env.PUSH_PROVIDER ?? 'none';
  if (provider === 'onesignal' && process.env.ONESIGNAL_REST_API_KEY && process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID) {
    await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
        include_aliases: { onesignal_id: subs.map((s) => s.token) },
        headings: { fr: input.title, en: input.title },
        contents: { fr: input.body, en: input.body },
        url: input.actionUrl,
        data: input.data,
      }),
    });
    return;
  }

  // Web Push natif : le service worker `public/sw.js` affiche la notif.
  // Sans VAPID configuré, on s'arrête ici : la cloche in-app suffit.
}

async function sendEmail(input: NotifyInput) {
  if (!integrations.resend) return;
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, profile: { select: { firstName: true } } },
  });
  if (!user?.email) return;

  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const env = serverEnv();
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: user.email,
    replyTo: env.EMAIL_REPLY_TO,
    subject: input.title,
    html: emailLayout(input.title, input.body, input.actionUrl, user.profile?.firstName),
  });
}

async function sendSms(input: NotifyInput) {
  if (!integrations.twilio) return;
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { phone: true, phoneVerified: true },
  });
  if (!user?.phone || !user.phoneVerified) return;

  const twilio = await import('twilio');
  const env = serverEnv();
  const client = twilio.default(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    from: env.TWILIO_PHONE_NUMBER,
    to: user.phone,
    body: `MarchéGo : ${input.title} — ${input.body}`,
  });
}

function emailLayout(title: string, body: string, actionUrl?: string, firstName?: string | null) {
  const greeting = firstName ? `Bonjour ${firstName},` : 'Bonjour,';
  const cta = actionUrl
    ? `<p style="margin:24px 0"><a href="${actionUrl}" style="background:#3d7c2c;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Voir le détail</a></p>`
    : '';
  return `<!doctype html>
<html lang="fr"><body style="font-family:Inter,Arial,sans-serif;background:#faf7ec;padding:24px;color:#1a1a1a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 8px 24px rgba(16,24,40,.06)">
    <p style="color:#3d7c2c;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:12px">MarchéGo</p>
    <h1 style="font-size:22px;margin:8px 0 16px">${title}</h1>
    <p>${greeting}</p>
    <p>${body}</p>
    ${cta}
    <p style="color:#6b7280;font-size:12px;margin-top:32px">MarchéGo · MAAYOUD.B · Bruxelles · <a href="${process.env.NEXT_PUBLIC_APP_URL}/legal/confidentialite">Confidentialité</a></p>
  </div>
</body></html>`;
}

export async function markNotificationRead(id: string, userId: string) {
  await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
