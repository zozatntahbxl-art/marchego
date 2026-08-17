import { AppShell } from '@/components/layout/app-shell';
import { prisma } from '@/lib/prisma';
import { computeMarketOpening, upcomingMarketDates } from '@/lib/markets/opening';
import { MarketCatalog } from '@/components/markets/market-catalog';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MarketPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { date?: string; q?: string; categorie?: string };
}) {
  const market = await prisma.market.findUnique({
    where: { slug: params.slug },
    include: {
      schedules: true,
      closures: true,
      marketVendors: {
        where: { isPresent: true },
        include: {
          vendor: {
            include: {
              products: {
                where: { isAvailable: true, isApproved: true },
                include: { category: true },
                orderBy: { name: 'asc' },
              },
            },
          },
        },
      },
    },
  });
  if (!market) notFound();

  const opening = computeMarketOpening({
    isActive: market.isActive,
    statusLocked: market.statusLocked,
    lockedStatus: market.status,
    schedules: market.schedules,
    closures: market.closures,
  });
  const dates = upcomingMarketDates(market.schedules, market.closures);

  return (
    <AppShell>
      <MarketCatalog
        market={{
          id: market.id,
          name: market.name,
          slug: market.slug,
          description: market.description,
          city: market.city,
          street: market.street,
          postalCode: market.postalCode,
          imageUrl: market.imageUrl,
          zoneRadiusKm: market.zoneRadiusKm,
          latitude: market.latitude,
          longitude: market.longitude,
          kind: market.kind,
          region: market.region,
          stallCount: market.stallCount,
          highlights: market.highlights,
        }}
        opening={opening}
        dates={dates}
        vendors={market.marketVendors.map((mv) => ({
          id: mv.vendor.id,
          businessName: mv.vendor.businessName,
          slug: mv.vendor.slug,
          description: mv.vendor.description,
          logoUrl: mv.vendor.logoUrl,
          rating: mv.vendor.rating,
          stallNumber: mv.stallNumber,
          products: mv.vendor.products.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            priceCents: p.priceCents,
            unit: p.unit,
            images: p.images,
            labels: p.labels,
            stock: p.stock,
            categorySlug: p.category.slug,
            categoryName: p.category.nameFr,
          })),
        }))}
        initialDate={searchParams.date ?? dates[0]?.date}
        initialQuery={searchParams.q}
        initialCategory={searchParams.categorie}
      />
    </AppShell>
  );
}
