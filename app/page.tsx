import { AppShell } from '@/components/layout/app-shell';
import { HomeHero } from '@/components/home/home-hero';
import { HowItWorks } from '@/components/home/how-it-works';
import { MarketsExplorer } from '@/components/markets/markets-explorer';
import { CategoryStrip } from '@/components/home/category-strip';
import { prisma } from '@/lib/prisma';
import { computeMarketOpening, holdsOnWeekday } from '@/lib/markets/opening';

export const dynamic = 'force-dynamic';

async function loadHomeCatalog() {
  return prisma.market.findMany({
    where: { isActive: true },
    include: {
      schedules: true,
      closures: true,
      _count: { select: { marketVendors: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export default async function HomePage() {
  let markets: Awaited<ReturnType<typeof loadHomeCatalog>> = [];
  try {
    markets = await loadHomeCatalog();
  } catch {
    markets = [];
  }

  const cards = markets.map((m) => {
    const opening = computeMarketOpening({
      isActive: m.isActive,
      statusLocked: m.statusLocked,
      lockedStatus: m.status,
      schedules: m.schedules,
      closures: m.closures,
    });
    return {
      id: m.id,
      name: m.name,
      slug: m.slug,
      city: m.city,
      street: m.street,
      imageUrl: m.imageUrl,
      vendorCount: m._count.marketVendors,
      opening,
      latitude: m.latitude,
      longitude: m.longitude,
      kind: m.kind,
      region: m.region,
      featured: m.featured,
      stallCount: m.stallCount,
      highlights: m.highlights,
      schedules: m.schedules,
    };
  });

  return (
    <AppShell>
      <HomeHero
        totalMarkets={cards.length}
        brusselsMarkets={cards.filter((m) => m.region === 'Bruxelles-Capitale').length}
      />
      <CategoryStrip
        counts={{
          sunday: markets.filter((m) => holdsOnWeekday(m.schedules, 0)).length,
          bio: markets.filter((m) => m.kind === 'bio').length,
          brussels: markets.filter((m) => m.region === 'Bruxelles-Capitale').length,
          fleurs: markets.filter((m) => m.kind === 'fleurs').length,
          brocante: markets.filter((m) => m.kind === 'brocante').length,
          poisson: markets.filter((m) => m.kind === 'poisson').length,
        }}
      />
      <HowItWorks />
      <MarketsExplorer markets={cards} title="Près de chez vous" subtitle="Ouverts aujourd’hui en priorité" />
    </AppShell>
  );
}
