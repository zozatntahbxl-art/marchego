import { NextRequest } from 'next/server';
import { json, parseBody, withHandler } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { vendorOnboardingSchema } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/security/crypto';
import { ibanLast4, normalizeVatNumber } from '@/lib/belgium';
import { slugify } from '@/lib/utils';
import { UserRole } from '@prisma/client';

export async function POST(req: NextRequest) {
  return withHandler(async () => {
    const user = await requireUser();
    const body = await parseBody(req, vendorOnboardingSchema);

    const existing = await prisma.vendor.findUnique({ where: { userId: user.id } });
    if (existing) return json({ error: 'Boutique déjà créée.' }, 409);

    const baseSlug = slugify(body.businessName);
    let slug = baseSlug;
    let n = 1;
    while (await prisma.vendor.findUnique({ where: { slug } })) {
      n += 1;
      slug = `${baseSlug}-${n}`;
    }

    const vendor = await prisma.vendor.create({
      data: {
        userId: user.id,
        businessName: body.businessName,
        slug,
        description: body.description,
        vatNumber: normalizeVatNumber(body.vatNumber),
        ibanEncrypted: encrypt(body.iban),
        ibanLast4: ibanLast4(body.iban),
        phone: body.phone,
        primaryCategoryId: body.primaryCategoryId,
        verificationStatus: 'EN_ATTENTE',
        status: 'EN_ATTENTE',
        acceptedTermsAt: new Date(),
        marketVendors: {
          create: body.marketIds.map((marketId) => ({
            marketId,
            isPresent: true,
          })),
        },
      },
    });

    const roles = user.roles.includes('VENDEUR') ? user.roles : [...user.roles, UserRole.VENDEUR];
    await prisma.user.update({
      where: { id: user.id },
      data: { roles, activeRole: 'VENDEUR' },
    });

    return json({ vendorId: vendor.id }, 201);
  });
}
