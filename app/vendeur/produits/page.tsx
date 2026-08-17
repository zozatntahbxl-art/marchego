import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { VendorProductManager } from '@/components/vendor/vendor-product-manager';

export const dynamic = 'force-dynamic';

export default async function VendorProductsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/connexion?next=/vendeur/produits');
  if (!user.roles.includes('VENDEUR')) redirect('/');

  const vendor = await prisma.vendor.findUnique({
    where: { userId: user.id },
    include: { products: { include: { category: true }, orderBy: { updatedAt: 'desc' } } },
  });
  if (!vendor) redirect('/vendeur/onboarding');

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <AppShell>
      <div className="container max-w-3xl space-y-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-caps mb-1">Catalogue</p>
            <h1 className="section-title">Mes produits</h1>
          </div>
          <Link href="/vendeur" className="text-sm font-semibold text-primary">
            Retour commandes
          </Link>
        </div>
        <VendorProductManager
          products={vendor.products.map((p) => ({
            id: p.id,
            name: p.name,
            priceCents: p.priceCents,
            stock: p.stock,
            isAvailable: p.isAvailable,
            category: { nameFr: p.category.nameFr },
          }))}
          categories={categories.map((c) => ({ id: c.id, nameFr: c.nameFr }))}
        />
      </div>
    </AppShell>
  );
}
