'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, Clock, List, LocateFixed, Map as MapIcon, MapPin, Search, SlidersHorizontal, Store, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BELGIUM_CENTER, haversineKm } from '@/lib/geo';
import { cn, formatDistance } from '@/lib/utils';
import { holdsOnDate, holdsOnWeekday, type OpeningSnapshot } from '@/lib/markets/opening';
import { DAY_LONG, DAY_SHORT, KIND_LABEL, REGION_LABEL, formatScheduleLine } from '@/lib/markets/format';
import type { MarketType } from '@/lib/data/belgian-markets';

const GeoMap = dynamic(() => import('@/components/maps/geo-map').then((m) => m.GeoMap), {
  ssr: false,
  loading: () => <div className="h-full min-h-[260px] animate-pulse rounded-[1.75rem] bg-muted" />,
});

export interface MarketCard {
  id: string;
  name: string;
  slug: string;
  city: string;
  street?: string;
  imageUrl: string | null;
  vendorCount: number;
  opening: OpeningSnapshot;
  latitude: number;
  longitude: number;
  kind?: string;
  region?: string;
  featured?: boolean;
  stallCount?: number | null;
  highlights?: string[];
  schedules?: Array<{
    dayOfWeek: number | null;
    startTime: string;
    endTime: string;
    dateSpecific?: Date | null;
    isActive?: boolean;
  }>;
}

type MarketWithDistance = MarketCard & { distanceKm: number };

const KINDS: MarketType[] = ['mixte', 'alimentaire', 'bio', 'fleurs', 'brocante', 'artisanat', 'poisson'];
const REGIONS = ['Bruxelles-Capitale', 'Flandre', 'Wallonie'] as const;
const PAGE_SIZE = 10;

export function MarketsExplorer({
  markets,
  title = 'Marchés autour de vous',
  subtitle = 'Ouverts aujourd’hui en priorité',
  initialKind,
  initialDay,
  initialRegion,
}: {
  markets: MarketCard[];
  title?: string;
  subtitle?: string;
  initialKind?: string;
  initialDay?: number | null;
  initialRegion?: string;
}) {
  const kindFromUrl = KINDS.includes(initialKind as MarketType) ? (initialKind as MarketType) : '';
  const [origin, setOrigin] = useState(BELGIUM_CENTER);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState(initialRegion ?? '');
  const [kind, setKind] = useState(kindFromUrl);
  const [day, setDay] = useState<number | null>(initialDay ?? null);
  const [date, setDate] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [maxKm, setMaxKm] = useState(80);
  const [nearMe, setNearMe] = useState(!(kindFromUrl || initialRegion || initialDay != null));
  const [moreFilters, setMoreFilters] = useState(Boolean(kindFromUrl || initialDay != null));
  const [view, setView] = useState<'split' | 'list' | 'map'>('split');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setOrigin({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 4000 },
    );
  }, []);

  const regionCounts = useMemo(() => {
    const counts = { 'Bruxelles-Capitale': 0, Flandre: 0, Wallonie: 0 };
    for (const m of markets) {
      if (m.region && m.region in counts) {
        counts[m.region as keyof typeof counts] += 1;
      }
    }
    return counts;
  }, [markets]);

  const communes = useMemo(() => {
    if (!region) return [];
    return Array.from(new Set(markets.filter((m) => m.region === region).map((m) => m.city))).sort((a, b) =>
      a.localeCompare(b, 'fr'),
    );
  }, [markets, region]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...markets]
      .map((m) => ({
        ...m,
        distanceKm: haversineKm(origin, { latitude: m.latitude, longitude: m.longitude }),
      }))
      .filter((m) => {
        if (openOnly && !m.opening.isOpen) return false;
        if (region && m.region !== region) return false;
        if (city && m.city !== city) return false;
        if (kind && m.kind !== kind) return false;
        if (nearMe && !region && m.distanceKm > maxKm) return false;
        if (day != null && m.schedules?.length) {
          if (!holdsOnWeekday(normalizeSchedules(m.schedules), day)) return false;
        }
        if (date && m.schedules?.length) {
          if (!holdsOnDate(normalizeSchedules(m.schedules), [], date)) return false;
        }
        if (!q) return true;
        return (
          m.name.toLowerCase().includes(q) ||
          m.city.toLowerCase().includes(q) ||
          m.slug.toLowerCase().includes(q) ||
          (m.street ?? '').toLowerCase().includes(q) ||
          (m.highlights ?? []).some((h) => h.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (region) {
          return (
            Number(b.featured) - Number(a.featured) ||
            Number(b.opening.isOpen) - Number(a.opening.isOpen) ||
            a.distanceKm - b.distanceKm
          );
        }
        return Number(b.opening.isOpen) - Number(a.opening.isOpen) || a.distanceKm - b.distanceKm;
      });
  }, [markets, origin, query, city, region, kind, day, date, openOnly, maxKm, nearMe]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, region, kind, day, date, openOnly, maxKm, city, nearMe]);

  useEffect(() => {
    if (city && region && !communes.includes(city)) setCity('');
  }, [region, communes, city]);

  const visible = filtered.slice(0, visibleCount);
  const selected = filtered.find((m) => m.id === selectedId) ?? filtered[0];
  const mapMarkers = useMemo(
    () =>
      filtered.map((m) => ({
        id: m.id,
        latitude: m.latitude,
        longitude: m.longitude,
        color: m.opening.isOpen ? '#3d7c2c' : '#b9a48a',
        label: m.name,
        popupHtml: `<strong>${m.name}</strong><br/>${m.city} · ${m.opening.isOpen ? 'Ouvert' : 'Fermé'}`,
      })),
    [filtered],
  );

  const filterHints = [
    region ? (REGION_LABEL[region] ?? region) : null,
    city || null,
    day != null ? DAY_LONG[day] : null,
    kind ? (KIND_LABEL[kind as MarketType] ?? kind) : null,
    date ? `le ${date}` : null,
    nearMe && !region ? `${maxKm} km` : null,
    openOnly ? 'Ouverts maintenant' : null,
  ].filter(Boolean) as string[];

  function selectRegion(next: string) {
    setRegion(next);
    setCity('');
  }

  function resetFilters() {
    setQuery('');
    setCity('');
    setRegion('');
    setKind('');
    setDay(null);
    setDate('');
    setOpenOnly(false);
    setNearMe(false);
  }

  return (
    <section className="container space-y-5 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex w-full rounded-full border border-border/80 bg-card/80 p-1 shadow-soft sm:w-auto">
          {(
            [
              ['split', MapIcon, 'Carte'],
              ['list', List, 'Liste'],
              ['map', MapPin, 'Pleine'],
            ] as const
          ).map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition sm:flex-none sm:px-3.5 ${
                view === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-pressed={view === key}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-market-200/80 bg-gradient-to-br from-[#f4f9f1] via-card to-[#fff4ea] shadow-soft">
        <div className="space-y-3 p-3 md:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-market-700" />
            <Input
              className="h-12 rounded-2xl border-market-200 bg-white/90 pl-10 pr-4 shadow-sm focus-visible:ring-market-600"
              placeholder="Rechercher un marché, une ville…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Rechercher un marché"
            />
          </div>

          <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-1 pb-0.5">
            <RegionChip
              active={!region}
              label="Belgique"
              count={markets.length}
              tone="belgique"
              onClick={() => selectRegion('')}
            />
            {REGIONS.map((r) => (
              <RegionChip
                key={r}
                active={region === r}
                label={REGION_LABEL[r]}
                count={regionCounts[r]}
                tone={r === 'Bruxelles-Capitale' ? 'bruxelles' : r === 'Flandre' ? 'flandre' : 'wallonie'}
                onClick={() => selectRegion(region === r ? '' : r)}
              />
            ))}
          </div>

          {region ? (
            <select
              className="h-12 w-full rounded-2xl border bg-background px-3 text-base md:h-11 md:text-sm"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              aria-label="Commune"
            >
              <option value="">Toutes les communes — {REGION_LABEL[region]}</option>
              {communes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setNearMe((v) => !v)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                  nearMe
                    ? 'border-[#c45c26] bg-[#c45c26] text-white shadow-soft'
                    : 'border-orange-200 bg-orange-50 text-orange-900 hover:border-orange-300'
                }`}
              >
                <LocateFixed className="h-3.5 w-3.5" />
                Autour de moi
              </button>
              {nearMe
                ? [20, 50, 80, 150].map((km) => (
                    <Chip key={km} active={maxKm === km} onClick={() => setMaxKm(km)}>
                      {km} km
                    </Chip>
                  ))
                : null}
            </div>
          )}

          {filterHints.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {filterHints.map((hint) => (
                <span
                  key={hint}
                  className="inline-flex items-center rounded-full bg-market-100 px-2.5 py-1 text-[11px] font-semibold text-market-800"
                >
                  {hint}
                </span>
              ))}
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Effacer
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setMoreFilters((v) => !v)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-stall-600"
            aria-expanded={moreFilters}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Affiner
            <ChevronDown className={`h-4 w-4 transition ${moreFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {moreFilters ? (
          <div className="space-y-4 border-t border-market-200/70 bg-white/50 px-3 py-4 md:px-4">
            <div>
              <p className="label-caps mb-2">Jour d’ouverture</p>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                <Chip active={day === null} onClick={() => setDay(null)} className="w-full justify-center">
                  Tous
                </Chip>
                {DAY_SHORT.map((label, i) => (
                  <Chip key={label} active={day === i} onClick={() => setDay(day === i ? null : i)} className="w-full justify-center">
                    {label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="label-caps mb-2">Type de marché</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={!kind} onClick={() => setKind('')}>
                  Tous
                </Chip>
                {KINDS.map((k) => (
                  <Chip key={k} active={kind === k} onClick={() => setKind(kind === k ? '' : k)}>
                    {KIND_LABEL[k]}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm font-medium">
                Date précise
                <div className="relative mt-1">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </label>
              <label className="flex h-11 items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={openOnly}
                  onChange={(e) => setOpenOnly(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Ouverts maintenant
              </label>
            </div>
          </div>
        ) : null}
      </div>

      {filterHints.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-market-100/50 px-4 py-3">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{filterHints.join(' · ')}</span>
            <span className="text-muted-foreground">
              {' '}
              — {filtered.length} marché{filtered.length > 1 ? 's' : ''}
            </span>
          </p>
          <button type="button" onClick={resetFilters} className="text-sm font-semibold text-primary hover:underline">
            Toute la Belgique
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{filtered.length}</strong> marché
          {filtered.length > 1 ? 's' : ''} autour de vous
        </p>
      )}

      <div
        className={
          view === 'split'
            ? 'grid overflow-hidden rounded-[1.75rem] border border-border/80 bg-card lg:h-[min(72vh,680px)] lg:grid-cols-[1.1fr_0.9fr]'
            : 'grid gap-5'
        }
      >
        {view !== 'list' && (
          <GeoMap
            className={
              view === 'map'
                ? 'h-[min(58dvh,520px)] w-full overflow-hidden rounded-[1.75rem] border sm:h-[min(70vh,640px)]'
                : 'h-[min(38vh,220px)] w-full overflow-hidden sm:h-[260px] lg:h-full lg:rounded-none lg:border-0'
            }
            center={origin}
            zoom={8}
            highlightedId={selected?.id}
            markers={mapMarkers}
            onMarkerClick={(id) => setSelectedId(id)}
          />
        )}

        {view !== 'map' && (
          <div
            className={
              view === 'list'
                ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
                : 'max-h-[min(48dvh,380px)] overflow-y-auto overscroll-contain border-t lg:max-h-none lg:border-t-0 lg:border-l'
            }
          >
            {view === 'split' && selected && (
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur">
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-semibold">{selected.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selected.city}
                    {selected.region ? ` · ${REGION_LABEL[selected.region] ?? selected.region}` : ''} ·{' '}
                    {formatDistance(selected.distanceKm)}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href={`/marches/${selected.slug}`}>
                    Ouvrir
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}

            {visible.map((m) =>
              view === 'list' ? (
                <MarketGridCard key={m.id} market={m} selected={selected?.id === m.id} onHover={() => setSelectedId(m.id)} />
              ) : (
                <MarketRow
                  key={m.id}
                  market={m}
                  selected={selected?.id === m.id}
                  onSelect={() => setSelectedId(m.id)}
                />
              ),
            )}

            {filtered.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Aucun marché ne correspond. Changez de région, de jour, ou retirez un filtre.
              </div>
            )}

            {visibleCount < filtered.length && (
              <div className={view === 'list' ? 'sm:col-span-2 xl:col-span-3' : ''}>
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="w-full py-4 text-sm font-semibold text-primary hover:underline"
                >
                  Afficher plus · {filtered.length - visibleCount} restants
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {view === 'map' && selected && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.6rem] border bg-card p-4 shadow-soft">
          <div>
            <p className="font-display text-lg font-semibold">{selected.name}</p>
            <p className="text-sm text-muted-foreground">
              {selected.city}
              {selected.region ? ` · ${REGION_LABEL[selected.region] ?? selected.region}` : ''} ·{' '}
              {formatDistance(selected.distanceKm)}
            </p>
          </div>
          <Button asChild>
            <Link href={`/marches/${selected.slug}`}>Voir la fiche</Link>
          </Button>
        </div>
      )}
    </section>
  );
}

function MarketRow({
  market: m,
  selected,
  onSelect,
}: {
  market: MarketWithDistance;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full min-h-[76px] items-stretch gap-3 border-b px-3 py-3 text-left transition hover:bg-secondary/50 ${
        selected ? 'bg-market-50' : ''
      }`}
    >
      <div
        className="h-[72px] w-[72px] shrink-0 rounded-2xl bg-cover bg-center"
        style={{
          backgroundImage: m.imageUrl ? `url(${m.imageUrl})` : 'linear-gradient(145deg,#3d7c2c,#c45c26)',
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-[15px] font-semibold leading-snug">{m.name}</p>
          <Badge variant={m.opening.isOpen ? 'success' : 'muted'} className="shrink-0">
            {m.opening.isOpen ? 'Ouvert' : 'Fermé'}
          </Badge>
        </div>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          {m.city}
          {m.region ? ` · ${REGION_LABEL[m.region] ?? m.region}` : ''} · {formatDistance(m.distanceKm)}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {m.schedules?.length
              ? formatScheduleLine(m.schedules)
              : m.opening.nextOpen
                ? `Prochaine ouverture ${m.opening.nextOpen.date}`
                : 'Horaires à venir'}
          </span>
        </p>
      </div>
    </button>
  );
}

function MarketGridCard({
  market: m,
  selected,
  onHover,
}: {
  market: MarketWithDistance;
  selected: boolean;
  onHover: () => void;
}) {
  return (
    <Link href={`/marches/${m.slug}`} onMouseEnter={onHover}>
      <article
        className={`group overflow-hidden rounded-[1.6rem] border bg-card shadow-soft transition hover:-translate-y-0.5 hover:shadow-lifted ${
          selected ? 'ring-2 ring-primary/70' : 'border-border/80'
        }`}
      >
        <div className="relative h-36 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-105"
            style={{
              backgroundImage: m.imageUrl ? `url(${m.imageUrl})` : 'linear-gradient(145deg,#3d7c2c,#c45c26)',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {m.kind && (
              <span className="ticket bg-background/90 text-foreground">
                {KIND_LABEL[(m.kind as MarketType) ?? 'mixte'] ?? m.kind}
              </span>
            )}
            {m.featured && <span className="ticket bg-accent text-white">Coup de cœur</span>}
          </div>
          <Badge variant={m.opening.isOpen ? 'success' : 'muted'} className="absolute bottom-3 right-3">
            {m.opening.isOpen ? 'Ouvert' : 'Fermé'}
          </Badge>
        </div>
        <div className="space-y-2 p-4">
          <h3 className="font-display text-lg font-semibold leading-tight">{m.name}</h3>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {m.city}
            {m.region ? ` · ${REGION_LABEL[m.region] ?? m.region}` : ''}
          </p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Store className="h-3.5 w-3.5" />
            {m.stallCount ? `${m.stallCount} emplacements` : `${m.vendorCount} vendeurs`}
          </p>
        </div>
      </article>
    </Link>
  );
}

function RegionChip({
  active,
  label,
  count,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  tone: 'belgique' | 'bruxelles' | 'flandre' | 'wallonie';
  onClick: () => void;
}) {
  const tones = {
    belgique: {
      on: 'border-market-700 bg-market-700 text-white shadow-soft',
      off: 'border-market-200 bg-market-50 text-market-900 hover:border-market-400',
    },
    bruxelles: {
      on: 'border-[#c45c26] bg-[#c45c26] text-white shadow-soft',
      off: 'border-orange-200 bg-orange-50 text-orange-950 hover:border-orange-400',
    },
    flandre: {
      on: 'border-sky-700 bg-sky-700 text-white shadow-soft',
      off: 'border-sky-200 bg-sky-50 text-sky-950 hover:border-sky-400',
    },
    wallonie: {
      on: 'border-amber-600 bg-amber-600 text-white shadow-soft',
      off: 'border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-400',
    },
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full border px-3.5 py-2 text-left transition ${
        active ? tones[tone].on : tones[tone].off
      }`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className={`text-[11px] tabular-nums ${active ? 'text-white/80' : 'opacity-70'}`}>{count}</span>
    </button>
  );
}

function normalizeSchedules(
  schedules: NonNullable<MarketCard['schedules']>,
): Array<{
  dayOfWeek: number | null;
  dateSpecific: Date | null;
  startTime: string;
  endTime: string;
  lastOrderTime: string | null;
  isActive: boolean;
}> {
  return schedules.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    dateSpecific: s.dateSpecific ?? null,
    startTime: s.startTime,
    endTime: s.endTime,
    lastOrderTime: null,
    isActive: s.isActive ?? true,
  }));
}

function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 items-center rounded-full border px-3 py-2 text-xs font-semibold transition sm:min-h-0 sm:py-1.5',
        active
          ? 'border-market-700 bg-market-700 text-white'
          : 'border-market-200 bg-white/80 text-market-800 hover:border-market-400 hover:text-market-900',
        className,
      )}
    >
      {children}
    </button>
  );
}
