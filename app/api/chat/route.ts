import { json, parseBody, withHandler } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { chatMessageSchema } from '@/lib/validation';
import { broadcastChatMessage } from '@/lib/realtime/broadcast';

export async function GET(req: Request) {
  return withHandler(async () => {
    const user = await requireUser();
    const conversationId = new URL(req.url).searchParams.get('conversationId');
    if (!conversationId) return json({ error: 'conversationId requis.' }, 400);
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: user.id } },
    });
    if (!participant) return json({ error: 'Accès refusé.' }, 403);
    const items = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return json({ items });
  });
}

export async function POST(req: Request) {
  return withHandler(async () => {
    const user = await requireUser();
    const conversationId = new URL(req.url).searchParams.get('conversationId');
    if (!conversationId) return json({ error: 'conversationId requis.' }, 400);
    const body = await parseBody(req, chatMessageSchema);
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: user.id } },
    });
    if (!participant) return json({ error: 'Accès refusé.' }, 403);

    const message = await prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: user.id,
        content: body.content,
        attachments: body.attachments ?? [],
      },
    });
    await broadcastChatMessage(conversationId, message);
    return json({ message }, 201);
  });
}
