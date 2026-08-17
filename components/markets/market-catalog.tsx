'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, MapPin, Store } from 'lucide-react';
import { formatCents } from '@/lib/utils';
import type { OpeningSnapshot } from '@/lib/markets/opening';
import { KIND_LABEL, formatScheduleLine } from '@/lib/markets/format';
import type { MarketType } from '@/lib/data/belgian-markets';

const GeoMap = dynamic(() => import('@/components/maps/geo-map').then((m) => m.GeoMap), {
  ssr: false,
  loading: () => <div className="h-48 animate-pulse rounded-2xl bg-muted" />,
});

const LABEL_FILTERS = ['BIO', 'ARTISANAL', 'LOCAL', 'FAIT_MAISON', 'HALAL', 'VEGAN'] as const;

interface ProductCard {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  unit: string;
  images: string[];
  labels: string[];
  stock: number;
  categorySlug: string;
  categoryName: string;
}

interface VendorCard {
  id: string;
  businessName: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  rating: number;
  stallNumber: string | null;
  products: ProductCard[];
}

export function MarketCatalog(props: {
  market: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    city: string;
    street: string;
    postalCode?: string;
    imageUrl: string | null;
    zoneRadiusKm: number;
    latitude: number;
    longitude: number;
    kind?: string;
    region?: string;
    stallCount?: number | null;
    highlights?: string[];
  };
  opening: OpeningSnapshot;
  dates: Array<{ date: string; startTime: string; endTime: string }>;
  vendors: VendorCard[];
  initialDate?: string;
  initialQuery?: string;
  initialCategory?: string;
}) {
  const [date, setDate] = useState(props.initialDate ?? props.dates[0]?.date ?? '');
  const [q, setQ] = useState(props.initialQuery ?? '');
  const [category, setCategory] = useState(props.initialCategory ?? '');
  const [labels, setLabels] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(50);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<'default' | 'price-asc' | 'price-desc' | 'rating'>('default');
  const [pending, start] = useTransition();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    props.vendors.forEach((v) =>
      v.products.forEach((p) => {
        if (!map.has(p.categorySlug)) map.set(p.categorySlug, p.categoryName);
      }),
    );
    return Array.from(map, ([slug, name]) => ({ slug, name }));
  }, [props.vendors]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return props.vendors
      .filter((v) => v.rating >= minRating)
      .map((v) => ({
        ...v,
        products: v.products
          .filter((p) => {
            if (category && p.categorySlug !== category) return false;
            if (p.priceCents > maxPrice * 100) return false;
            if (labels.length && !labels.every((l) => p.labels.includes(l))) return false;
            if (!query) return true;
            return (
              p.name.toLowerCase().includes(query) ||
              v.businessName.toLowerCase().includes(query) ||
              (p.description ?? '').toLowerCase().includes(query)
            );
          })
          .sort((a, b) => {
            if (sort === 'price-asc') return a.priceCents - b.priceCents;
            if (sort === 'price-desc') return b.priceCents - a.priceCents;
            return a.name.localeCompare(b.name, 'fr');
          }),
      }))
      .filter((v) => v.products.length > 0)
      .sort((a, b) => (sort === 'rating' ? b.rating - a.rating : a.businessName.localeCompare(b.businessName, 'fr')));
  }, [props.vendors, q, category, labels, maxPrice, minRating, sort]);

  function toggleLabel(label: string) {
    setLabels((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));
  }

  function add(productId: string) {
    const qty = (quantities[productId] ?? 0) + 1;
    setQuantities((s) => ({ ...s, [productId]: qty }));
    start(async () => {
      const res = await fetch('/api/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: props.market.id,
          marketDate: date,
          productId,
          quantity: qty,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? 'Impossible d’ajouter au panier');
        return;
      }
      toast.success('Ajouté au panier');
    });
  }

  return (
    <div>
      <div
        className="relative h-52 bg-cover bg-center md:h-80"
        style={{
          backgroundImage: props.market.imageUrl
            ? `url(${props.market.imageUrl})`
            : 'linear-gradient(135deg,#3d7c2c,#c45c26)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>
      <div className="container -mt-24 space-y-6 pb-12">
        <div className="surface-elevated p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                {props.market.kind && (
                  <span className="ticket border-border bg-secondary text-secondary-foreground">
                    {KIND_LABEL[(props.market.kind as MarketType) ?? 'mixte'] ?? props.market.kind}
                  </span>
                )}
                {props.market.region && (
                  <span className="ticket border-border bg-card text-muted-foreground">
                    {props.market.region}
                  </span>
                )}
              </div>
              <h1 className="hero-title text-[2rem] md:text-4xl">{props.market.name}</h1>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {props.market.street}, {props.market.postalCode} {props.market.city} · livraison{' '}
                {props.market.zoneRadiusKm} km
              </p>
            </div>
            <Badge variant={props.opening.isOpen ? 'success' : 'muted'} className="text-sm">
              {props.opening.isOpen ? 'Ouvert maintenant' : 'Fermé'}
            </Badge>
          </div>
          {props.market.description && (
            <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">{props.market.description}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {formatScheduleLine(props.dates.length ? props.dates.map((d) => ({
                dayOfWeek: new Date(`${d.date}T12:00:00`).getDay(),
                startTime: d.startTime,
                endTime: d.endTime,
              })) : []) || 'Voir les dates ci-dessous'}
            </span>
            {props.market.stallCount ? (
              <span className="flex items-center gap-1.5">
                <Store className="h-4 w-4" />
                {props.market.stallCount} emplacements
              </span>
            ) : null}
          </div>
          {props.market.highlights && props.market.highlights.length > 0 && (
            <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {props.market.highlights.join(' · ')}
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium">
              Date
              <select
                className="mt-1 h-11 w-full rounded-xl border bg-background px-3"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              >
                {props.dates.map((d) => (
                  <option key={d.date} value={d.date}>
                    {d.date} · {d.startTime}–{d.endTime}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium sm:col-span-1 lg:col-span-2">
              Recherche
              <Input
                className="mt-1"
                placeholder="Tomates, fromage, boulanger…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium">
              Trier
              <select
                className="mt-1 h-11 w-full rounded-xl border bg-background px-3"
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
              >
                <option value="default">Par étal</option>
                <option value="rating">Note vendeur</option>
                <option value="price-asc">Prix croissant</option>
                <option value="price-desc">Prix décroissant</option>
              </select>
            </label>
          </div>
        </div>

        <GeoMap
          className="h-56 w-full overflow-hidden rounded-2xl border"
          center={{ latitude: props.market.latitude, longitude: props.market.longitude }}
          zoom={14}
          markers={[
            {
              id: props.market.id,
              latitude: props.market.latitude,
              longitude: props.market.longitude,
              color: '#f97316',
              label: props.market.name,
              popupHtml: `<strong>${props.market.name}</strong><br/>${props.market.street}, ${props.market.city}`,
            },
          ]}
        />

        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          <FilterChip active={!category} onClick={() => setCategory('')}>
            Toutes catégories
          </FilterChip>
          {categories.map((c) => (
            <FilterChip key={c.slug} active={category === c.slug} onClick={() => setCategory(c.slug)}>
              {c.name}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {LABEL_FILTERS.map((label) => (
            <FilterChip key={label} active={labels.includes(label)} onClick={() => toggleLabel(label)}>
              {label.replace('_', ' ').toLowerCase()}
            </FilterChip>
          ))}
        </div>

        <div className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Prix max ({formatCents(maxPrice * 100)})
            <input
              type="range"
              min={2}
              max={50}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="mt-3 w-full accent-primary"
            />
          </label>
          <label className="text-sm font-medium">
            Note vendeur min ({minRating.toFixed(1)})
            <input
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="mt-3 w-full accent-primary"
            />
          </label>
        </div>

        {filtered.map((vendor) => (
          <section key={vendor.id} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-market-100 text-lg font-bold text-market-800">
                {vendor.businessName.slice(0, 1)}
              </div>
              <div>
                <h2 className="font-semibold">{vendor.businessName}</h2>
                <p className="text-xs text-muted-foreground">
                  {vendor.stallNumber ? `Emplacement ${vendor.stallNumber} · ` : ''}
                  {vendor.rating.toFixed(1)} / 5
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {vendor.products.map((p) => (
                <article key={p.id} className="flex gap-3 rounded-2xl border bg-card p-3 shadow-soft">
                  <div
                    className="h-20 w-20 shrink-0 rounded-xl bg-muted bg-cover bg-center"
                    style={p.images[0] ? { backgroundImage: `url(${p.images[0]})` } : undefined}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="truncate font-medium">{p.name}</h3>
                    <p className="text-sm font-semibold text-primary">
                      {formatCents(p.priceCents)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        / {p.unit.toLowerCase()}
                      </span>
                    </p>
                    {p.labels.length > 0 && (
                      <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                        {p.labels.slice(0, 3).join(' · ')}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{p.stock} en stock</span>
                      <Button size="sm" onClick={() => add(p.id)} disabled={pending || p.stock === 0}>
                        Ajouter
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
        {filtered.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">Aucun produit ne correspond à ces filtres.</p>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'
      }`}
    >
      {children}
    </button>
  );
}
