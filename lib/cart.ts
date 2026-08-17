import 'server-only';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { randomToken } from '@/lib/security/crypto';
import { quoteOrder } from '@/lib/pricing';
import { getSettings, toPricing } from '@/lib/settings';
import { estimateRoadKm } from '@/lib/geo';

const CART_COOKIE = 'mg_cart';
const CART_TTL_DAYS = 7;

function expiresAt() {
  return new Date(Date.now() + CART_TTL_DAYS * 86_400_000);
}

export async function getOrCreateCartSession(): Promise<string> {
  const store = cookies();
  const existing = store.get(CART_COOKIE)?.value;
  if (existing) return existing;
  const token = randomToken();
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: CART_TTL_DAYS * 24 * 60 * 60,
    path: '/',
  });
  return token;
}

export async function getActiveCart() {
  const user = await getCurrentUser();
  const session = cookies().get(CART_COOKIE)?.value;
  if (!user && !session) return null;

  const cart = await prisma.cart.findFirst({
    where: user ? { userId: user.id } : { sessionToken: session },
    orderBy: { updatedAt: 'desc' },
    include: {
      market: { select: { id: true, name: true, slug: true, latitude: true, longitude: true, zoneRadiusKm: true } },
      items: {
        include: {
          product: {
            include: { vendor: { select: { id: true, businessName: true, slug: true, logoUrl: true } } },
          },
        },
      },
    },
  });
  return cart;
}

export async function upsertCartItem(params: {
  marketId: string;
  marketDate: Date;
  productId: string;
  quantity: number;
  note?: string;
}) {
  const user = await getCurrentUser();
  const sessionToken = user ? null : await getOrCreateCartSession();

  const product = await prisma.product.findUnique({
    where: { id: params.productId },
    include: { vendor: true },
  });
  if (!product || !product.isAvailable || !product.isApproved) {
    throw Object.assign(new Error('Produit indisponible.'), { status: 404 });
  }

  const availability = await prisma.marketProductAvailability.findFirst({
    where: {
      productId: product.id,
      marketId: params.marketId,
      isAvailable: true,
      OR: [{ date: params.marketDate }, { date: null }],
    },
    orderBy: { date: 'desc' },
  });
  if (!availability) {
    throw Object.assign(new Error('Ce produit n’est pas proposé sur ce marché à cette date.'), {
      status: 409,
    });
  }

  const unitPrice = availability.priceOverrideCents ?? product.priceCents;
  const stock = availability.stock;
  if (params.quantity > stock) {
    throw Object.assign(new Error(`Stock insuffisant (${stock} restant).`), { status: 409 });
  }
  if (params.quantity > product.maxPerOrder) {
    throw Object.assign(new Error(`Maximum ${product.maxPerOrder} par commande.`), { status: 409 });
  }

  const existing = await prisma.cart.findFirst({
    where: user
      ? { userId: user.id, marketId: params.marketId, marketDate: params.marketDate }
      : { sessionToken: sessionToken!, marketId: params.marketId, marketDate: params.marketDate },
  });

  // Un panier = un marché. Si le client change de marché, on recrée.
  if (existing && existing.marketId !== params.marketId) {
    await prisma.cart.delete({ where: { id: existing.id } });
  }

  const cart =
    existing ??
    (await prisma.cart.create({
      data: {
        userId: user?.id,
        sessionToken: sessionToken ?? undefined,
        marketId: params.marketId,
        marketDate: params.marketDate,
        expiresAt: expiresAt(),
      },
    }));

  if (params.quantity === 0) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId: product.id } });
  } else {
    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: product.id } },
      create: {
        cartId: cart.id,
        productId: product.id,
        quantity: params.quantity,
        unitPriceCents: unitPrice,
        note: params.note,
      },
      update: { quantity: params.quantity, unitPriceCents: unitPrice, note: params.note },
    });
  }

  return getCartById(cart.id);
}

export async function getCartById(id: string) {
  return prisma.cart.findUnique({
    where: { id },
    include: {
      market: true,
      items: {
        include: {
          product: {
            include: {
              vendor: { select: { id: true, businessName: true, slug: true, logoUrl: true } },
              category: true,
            },
          },
        },
      },
    },
  });
}

export async function quoteCart(cartId: string, destination?: { latitude: number; longitude: number }) {
  const cart = await getCartById(cartId);
  if (!cart) throw Object.assign(new Error('Panier introuvable.'), { status: 404 });

  const settings = toPricing(await getSettings());
  const distanceKm = destination
    ? estimateRoadKm(
        { latitude: cart.market.latitude, longitude: cart.market.longitude },
        destination,
      )
    : 3;

  const items = cart.items.map((i) => ({
    productId: i.productId,
    vendorId: i.product.vendorId,
    quantity: i.quantity,
    unitPriceCents: i.unitPriceCents,
    vatRateBps: i.product.vatRateBps ?? i.product.category.vatRateBps,
  }));

  return {
    cart,
    quote: quoteOrder({ items, distanceKm, settings }),
    distanceKm,
  };
}

export async function mergeAnonymousCart(userId: string) {
  const session = cookies().get(CART_COOKIE)?.value;
  if (!session) return;
  const anon = await prisma.cart.findUnique({ where: { sessionToken: session } });
  if (!anon) return;
  await prisma.cart.update({
    where: { id: anon.id },
    data: { userId, sessionToken: null },
  });
}
