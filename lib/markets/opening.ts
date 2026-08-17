import { localDayOfWeek, timeToMinutes, toISODate, toLocalTime } from '@/lib/utils';
import { isBelgianHoliday } from '@/lib/belgium';

/**
 * Calcul de l'ouverture d'un marché à un instant donné.
 *
 * Un marché est ouvert si :
 *  • `isActive` et pas `statusLocked` sur FERME/EN_PAUSE ;
 *  • aucun `MarketClosure` pour la date (fuseau Europe/Brussels) ;
 *  • un `MarketSchedule` récurrent (jour de semaine) ou une date spécifique
 *    couvre l'heure actuelle ;
 *  • ce n'est pas un jour férié belge, sauf si un horaire `dateSpecific`
 *    a été explicitement créé pour ce jour.
 */

export interface ScheduleLike {
  dayOfWeek: number | null;
  dateSpecific: Date | null;
  startTime: string;
  endTime: string;
  lastOrderTime: string | null;
  isActive: boolean;
}

export interface ClosureLike {
  date: Date;
}

export type ComputedMarketStatus = 'OUVERT' | 'FERME' | 'EN_PAUSE';

export interface OpeningSnapshot {
  status: ComputedMarketStatus;
  isOpen: boolean;
  acceptingOrders: boolean;
  current?: { startTime: string; endTime: string; lastOrderTime: string | null };
  nextOpen?: { date: string; startTime: string };
}

export function computeMarketOpening(params: {
  now?: Date;
  isActive: boolean;
  statusLocked: boolean;
  lockedStatus?: ComputedMarketStatus;
  schedules: ScheduleLike[];
  closures: ClosureLike[];
  timeZone?: string;
}): OpeningSnapshot {
  const now = params.now ?? new Date();
  const tz = params.timeZone ?? 'Europe/Brussels';

  if (!params.isActive) {
    return { status: 'FERME', isOpen: false, acceptingOrders: false };
  }
  if (params.statusLocked && params.lockedStatus && params.lockedStatus !== 'OUVERT') {
    return { status: params.lockedStatus, isOpen: false, acceptingOrders: false };
  }

  const dateIso = toISODate(now, tz);
  const closed = params.closures.some((c) => toISODate(c.date, 'UTC') === dateIso);
  if (closed) {
    return {
      status: 'FERME',
      isOpen: false,
      acceptingOrders: false,
      nextOpen: findNextOpen(params.schedules, params.closures, now, tz),
    };
  }

  const dow = localDayOfWeek(now, tz);
  const minutes = timeToMinutes(toLocalTime(now, tz));
  const holiday = isBelgianHoliday(new Date(`${dateIso}T00:00:00Z`));

  const matching = params.schedules.filter((s) => {
    if (!s.isActive) return false;
    if (s.dateSpecific) return toISODate(s.dateSpecific, 'UTC') === dateIso;
    if (holiday) return false;
    return s.dayOfWeek === dow;
  });

  const current = matching.find((s) => {
    const start = timeToMinutes(s.startTime);
    const end = timeToMinutes(s.endTime);
    return minutes >= start && minutes < end;
  });

  if (current) {
    const lastOrder = current.lastOrderTime
      ? timeToMinutes(current.lastOrderTime)
      : timeToMinutes(current.endTime) - 45;
    return {
      status: 'OUVERT',
      isOpen: true,
      acceptingOrders: minutes < lastOrder,
      current: {
        startTime: current.startTime,
        endTime: current.endTime,
        lastOrderTime: current.lastOrderTime,
      },
    };
  }

  return {
    status: 'FERME',
    isOpen: false,
    acceptingOrders: false,
    nextOpen: findNextOpen(params.schedules, params.closures, now, tz),
  };
}

function findNextOpen(
  schedules: ScheduleLike[],
  closures: ClosureLike[],
  from: Date,
  tz: string,
): { date: string; startTime: string } | undefined {
  const closedDates = new Set(closures.map((c) => toISODate(c.date, 'UTC')));

  for (let offset = 0; offset < 21; offset += 1) {
    const candidate = new Date(from.getTime() + offset * 86_400_000);
    const iso = toISODate(candidate, tz);
    if (closedDates.has(iso)) continue;
    const dow = localDayOfWeek(candidate, tz);
    const holiday = isBelgianHoliday(new Date(`${iso}T00:00:00Z`));
    const minutesNow = offset === 0 ? timeToMinutes(toLocalTime(from, tz)) : -1;

    const hits = schedules
      .filter((s) => {
        if (!s.isActive) return false;
        if (s.dateSpecific) return toISODate(s.dateSpecific, 'UTC') === iso;
        if (holiday) return false;
        return s.dayOfWeek === dow;
      })
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    const next = hits.find((s) => timeToMinutes(s.startTime) > minutesNow);
    if (next) return { date: iso, startTime: next.startTime };
  }
  return undefined;
}

/** Dates d'ouverture d'un marché sur les 14 prochains jours (sélecteur client). */
export function upcomingMarketDates(
  schedules: ScheduleLike[],
  closures: ClosureLike[],
  from = new Date(),
  days = 14,
  tz = 'Europe/Brussels',
): Array<{ date: string; startTime: string; endTime: string }> {
  const closedDates = new Set(closures.map((c) => toISODate(c.date, 'UTC')));
  const out: Array<{ date: string; startTime: string; endTime: string }> = [];

  for (let offset = 0; offset < days; offset += 1) {
    const candidate = new Date(from.getTime() + offset * 86_400_000);
    const iso = toISODate(candidate, tz);
    if (closedDates.has(iso)) continue;
    const dow = localDayOfWeek(candidate, tz);
    const holiday = isBelgianHoliday(new Date(`${iso}T00:00:00Z`));

    for (const s of schedules) {
      if (!s.isActive) continue;
      const match = s.dateSpecific
        ? toISODate(s.dateSpecific, 'UTC') === iso
        : !holiday && s.dayOfWeek === dow;
      if (match) out.push({ date: iso, startTime: s.startTime, endTime: s.endTime });
    }
  }
  return out;
}

/** Le marché a-t-il un horaire ce jour de semaine (0=dimanche) ? */
export function holdsOnWeekday(schedules: ScheduleLike[], dayOfWeek: number): boolean {
  return schedules.some((s) => s.isActive && s.dayOfWeek === dayOfWeek && !s.dateSpecific);
}

/** Le marché ouvre-t-il à cette date ISO (YYYY-MM-DD, fuseau Bruxelles) ? */
export function holdsOnDate(
  schedules: ScheduleLike[],
  closures: ClosureLike[],
  dateIso: string,
  tz = 'Europe/Brussels',
): boolean {
  if (closures.some((c) => toISODate(c.date, 'UTC') === dateIso)) return false;
  const noon = new Date(`${dateIso}T12:00:00`);
  const dow = localDayOfWeek(noon, tz);
  const holiday = isBelgianHoliday(new Date(`${dateIso}T00:00:00Z`));
  return schedules.some((s) => {
    if (!s.isActive) return false;
    if (s.dateSpecific) return toISODate(s.dateSpecific, 'UTC') === dateIso;
    if (holiday) return false;
    return s.dayOfWeek === dow;
  });
}
