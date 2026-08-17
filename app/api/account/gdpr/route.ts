import { json, withHandler } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  return withHandler(async () => {
    const user = await requireUser();
    const [profile, addresses, orders, consents] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        include: { profile: true, vendor: true, courier: true },
      }),
      prisma.address.findMany({ where: { userId: user.id } }),
      prisma.order.findMany({
        where: { clientId: user.id },
        select: { id: true, reference: true, status: true, totalCents: true, createdAt: true },
      }),
      prisma.consentRecord.findMany({ where: { userId: user.id } }),
    ]);

    return json({
      exportedAt: new Date().toISOString(),
      user: {
        email: profile?.email,
        phone: profile?.phone,
        roles: profile?.roles,
        profile: profile?.profile,
        vendor: profile?.vendor
          ? { businessName: profile.vendor.businessName, vatNumber: profile.vendor.vatNumber }
          : null,
        courier: profile?.courier
          ? { vehicleType: profile.courier.vehicleType, verified: profile.courier.verified }
          : null,
      },
      addresses: addresses.map((a) => ({
        label: a.label,
        city: a.city,
        postalCode: a.postalCode,
        street: a.street,
      })),
      orders,
      consents,
    });
  });
}

export async function DELETE() {
  return withHandler(async () => {
    const user = await requireUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { deletionRequestedAt: new Date(), status: 'DESACTIVE' },
    });
    return json({
      ok: true,
      message: 'Demande d’effacement enregistrée. Anonymisation sous 30 jours (obligations comptables conservées 7 ans).',
    });
  });
}
