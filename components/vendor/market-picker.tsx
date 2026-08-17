'use client';

import { useMemo, useState } from 'react';
import { Check, MapPin, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DAY_SHORT, KIND_LABEL, formatScheduleLine } from '@/lib/markets/format';
import type { MarketType } from '@/lib/data/belgian-markets';

export type MarketOption = {
  id: string;
  name: string;
  city: string;
  street: string;
  imageUrl: string | null;
  description: string | null;
  vendorCount?: number;
  kind?: string;
  region?: string;
  stallCount?: number | null;
  schedules?: Array<{ dayOfWeek: number | null; startTime: string; endTime: string }>;
};

export function MarketPicker({
  markets,
  value,
  onChange,
}: {
  markets: MarketOption[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [day, setDay] = useState<number | null>(null);

  const cities = useMemo(
    () => Array.from(new Set(markets.map((m) => m.city))).sort((a, b) => a.localeCompare(b, 'fr')),
    [markets],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return markets.filter((m) => {
      if (city && m.city !== city) return false;
      if (day != null && m.schedules?.length && !m.schedules.some((s) => s.dayOfWeek === day)) return false;
      if (!query) return true;
      return (
        m.name.toLowerCase().includes(query) ||
        m.city.toLowerCase().includes(query) ||
        m.street.toLowerCase().includes(query) ||
        (m.region ?? '').toLowerCase().includes(query)
      );
    });
  }, [markets, q, city, day]);

  const grouped = useMemo(() => {
    const map = new Map<string, MarketOption[]>();
    for (const m of filtered) {
      (map.get(m.city) ?? map.set(m.city, []).get(m.city)!).push(m);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'fr'));
  }, [filtered]);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Chercher un marché, une commune…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="h-11 rounded-xl border bg-card px-3 text-sm"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        >
          <option value="">Toutes les villes</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setDay(null)}
          className={cn(
            'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
            day === null ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
          )}
        >
          Tous les jours
        </button>
        {DAY_SHORT.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setDay(day === i ? null : i)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
              day === i ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {value.length} marché{value.length > 1 ? 's' : ''} sélectionné{value.length > 1 ? 's' : ''} ·{' '}
        {filtered.length} disponible{filtered.length > 1 ? 's' : ''}
      </p>

      <div className="max-h-[460px] space-y-6 overflow-y-auto rounded-[1.4rem] border bg-cream-50/50 p-3">
        {grouped.map(([cityName, list]) => (
          <section key={cityName}>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {cityName}
              <span className="ml-1 font-normal">({list.length})</span>
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {list.map((m) => {
                const selected = value.includes(m.id);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => toggle(m.id)}
                      className={cn(
                        'group flex w-full gap-3 rounded-2xl border p-2.5 text-left transition',
                        selected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                          : 'border-border/80 bg-card hover:border-primary/40 hover:shadow-soft',
                      )}
                    >
                      <div
                        className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-xl bg-cover bg-center"
                        style={{
                          backgroundImage: m.imageUrl
                            ? `url(${m.imageUrl})`
                            : 'linear-gradient(145deg,#e5f2df,#fed7aa)',
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-semibold leading-snug">{m.name}</p>
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                              selected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-muted-foreground/30 bg-background',
                            )}
                          >
                            {selected && <Check className="h-3 w-3" />}
                          </span>
                        </div>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {m.street}
                        </p>
                        {m.kind && (
                          <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {KIND_LABEL[(m.kind as MarketType) ?? 'mixte'] ?? m.kind}
                            {m.schedules?.length ? ` · ${formatScheduleLine(m.schedules)}` : ''}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {grouped.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun marché ne correspond.</p>
        )}
      </div>
    </div>
  );
}

export { DAY_SHORT as DAY };
