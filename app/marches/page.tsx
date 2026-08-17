import { AppShell } from '@/components/layout/app-shell';
import { prisma } from '@/lib/prisma';
import { computeMarketOpening } from '@/lib/markets/opening';
import { MarketsExplorer } from '@/components/markets/markets-explorer';

export const dynamic = 'force-dynamic';

export default async function MarketsIndexPage({
  searchParams,
}: {
  searchParams: { q?: string; kind?: string; jour?: string; region?: string };
}) {
  const markets = await prisma.market.findMany({
    where: { isActive: true },
    include: {
      schedules: true,
      closures: true,
      _count: { select: { marketVendors: true } },
    },
    orderBy: { name: 'asc' },
  });

  const cards = markets.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    city: m.city,
    street: m.street,
    imageUrl: m.imageUrl,
    vendorCount: m._count.marketVendors,
    opening: computeMarketOpening({
      isActive: m.isActive,
      statusLocked: m.statusLocked,
      lockedStatus: m.status,
      schedules: m.schedules,
      closures: m.closures,
    }),
    latitude: m.latitude,
    longitude: m.longitude,
    kind: m.kind,
    region: m.region,
    featured: m.featured,
    stallCount: m.stallCount,
    highlights: m.highlights,
    schedules: m.schedules,
  }));

  return (
    <AppShell>
      <div className="container pt-8 pb-2">
        <p className="label-caps mb-2">Répertoire belge</p>
        <h1 className="hero-title">Tous les marchés</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {cards.length} marchés — Bruxelles, Flandre et Wallonie. Filtrez par jour, date, type,
          commune. Chaque fiche a sa photo, ses horaires et sa zone de livraison.
        </p>
      </div>
      <MarketsExplorer
        markets={cards}
        title="Explorer les marchés"
        subtitle="Carte, distance, horaires et filtres"
        initialKind={searchParams.kind}
        initialDay={
          searchParams.jour != null && /^[0-6]$/.test(searchParams.jour)
            ? Number(searchParams.jour)
            : null
        }
        initialRegion={searchParams.region}
      />
    </AppShell>
  );
}
