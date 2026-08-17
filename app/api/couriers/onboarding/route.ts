import { NextRequest } from 'next/server';
import { json, parseBody, withHandler } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { courierOnboardingSchema } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/security/crypto';
import { ibanLast4 } from '@/lib/belgium';
import { UserRole } from '@prisma/client';

export async function POST(req: NextRequest) {
  return withHandler(async () => {
    const user = await requireUser();
    const body = await parseBody(req, courierOnboardingSchema);

    const existing = await prisma.courier.findUnique({ where: { userId: user.id } });
    if (existing) return json({ error: 'Profil livreur déjà créé.' }, 409);

    const courier = await prisma.courier.create({
      data: {
        userId: user.id,
        vehicleType: body.vehicleType,
        ibanEncrypted: encrypt(body.iban),
        ibanLast4: ibanLast4(body.iban),
        radiusKm: body.radiusKm,
        preferredLatitude: body.preferredLatitude,
        preferredLongitude: body.preferredLongitude,
        verificationStatus: 'EN_ATTENTE',
        status: 'EN_ATTENTE',
        acceptedTermsAt: new Date(),
        vehicles: {
          create: {
            type: body.vehicleType,
            model: body.model,
            plateNumber: body.plateNumber,
            isPrimary: true,
          },
        },
      },
    });

    const roles = user.roles.includes('LIVREUR') ? user.roles : [...user.roles, UserRole.LIVREUR];
    await prisma.user.update({
      where: { id: user.id },
      data: { roles, activeRole: 'LIVREUR' },
    });

    return json({ courierId: courier.id }, 201);
  });
}
