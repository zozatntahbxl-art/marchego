import 'server-only';
import { createServiceClient } from '@/lib/supabase/client';
import type { OrderStatus } from '@prisma/client';

/**
 * Diffusion Realtime des événements métier. Le client s'abonne au canal
 * `order:<id>` (suivi) ou `courier:<id>` (nouvelles missions).
 *
 * Sans Supabase, les appels sont no-op : le polling HTTP reste un filet de
 * sécurité (les pages rafraîchissent toutes les 8 s).
 */

export async function broadcastOrderUpdate(orderId: string, status: OrderStatus) {
  const supabase = createServiceClient();
  if (!supabase) return;
  await supabase.channel(`order:${orderId}`).send({
    type: 'broadcast',
    event: 'status',
    payload: { orderId, status, at: new Date().toISOString() },
  });
}

export async function broadcastCourierLocation(params: {
  deliveryId: string;
  orderId: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
}) {
  const supabase = createServiceClient();
  if (!supabase) return;
  await supabase.channel(`order:${params.orderId}`).send({
    type: 'broadcast',
    event: 'courier-location',
    payload: params,
  });
}

export async function broadcastChatMessage(conversationId: string, payload: unknown) {
  const supabase = createServiceClient();
  if (!supabase) return;
  await supabase.channel(`chat:${conversationId}`).send({
    type: 'broadcast',
    event: 'message',
    payload,
  });
}
