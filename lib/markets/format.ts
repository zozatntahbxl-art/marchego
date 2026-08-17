import type { MarketType } from '@/lib/data/belgian-markets';

export const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const;
export const DAY_LONG = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const;

export const KIND_LABEL: Record<MarketType, string> = {
  alimentaire: 'Alimentaire',
  bio: 'Bio & fermier',
  brocante: 'Brocante',
  fleurs: 'Fleurs',
  artisanat: 'Artisanat',
  poisson: 'Poissons',
  mixte: 'Marché général',
};

export const REGION_LABEL: Record<string, string> = {
  'Bruxelles-Capitale': 'Bruxelles',
  Flandre: 'Flandre',
  Wallonie: 'Wallonie',
};

export function formatScheduleLine(
  schedules: Array<{ dayOfWeek: number | null; startTime: string; endTime: string }>,
): string {
  const byKey = new Map<string, number[]>();
  for (const s of schedules) {
    if (s.dayOfWeek == null) continue;
    const key = `${s.startTime}–${s.endTime}`;
    const days = byKey.get(key) ?? [];
    days.push(s.dayOfWeek);
    byKey.set(key, days);
  }
  return Array.from(byKey.entries())
    .map(([hours, days]) => `${formatDayGroup(days)} ${hours}`)
    .join(' · ');
}

export function formatDayGroup(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (sorted.length === 7) return 'Tous les jours';
  if (sorted.length >= 3 && consecutive(sorted)) {
    return `${DAY_SHORT[sorted[0]]}–${DAY_SHORT[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((d) => DAY_SHORT[d]).join(', ');
}

function consecutive(days: number[]): boolean {
  const norm = days.map((d) => (d + 6) % 7).sort((a, b) => a - b);
  return norm.every((v, i) => i === 0 || v === norm[i - 1] + 1);
}
