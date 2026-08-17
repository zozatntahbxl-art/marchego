import { describe, expect, it } from 'vitest';
import { computeMarketOpening } from '@/lib/markets/opening';

const sundayMorning = new Date('2026-08-16T08:30:00+02:00');

describe('ouverture des marchés', () => {
  const sundaySchedule = [
    {
      dayOfWeek: 0,
      dateSpecific: null,
      startTime: '08:00',
      endTime: '14:00',
      lastOrderTime: '13:00',
      isActive: true,
    },
  ];

  it('ouvre un marché le dimanche matin', () => {
    const snap = computeMarketOpening({
      now: sundayMorning,
      isActive: true,
      statusLocked: false,
      schedules: sundaySchedule,
      closures: [],
    });
    expect(snap.isOpen).toBe(true);
    expect(snap.acceptingOrders).toBe(true);
    expect(snap.status).toBe('OUVERT');
  });

  it('ferme sur un jour férié sans horaire spécifique', () => {
    const snap = computeMarketOpening({
      now: new Date('2026-07-21T10:00:00+02:00'),
      isActive: true,
      statusLocked: false,
      schedules: [
        {
          dayOfWeek: 2,
          dateSpecific: null,
          startTime: '08:00',
          endTime: '14:00',
          lastOrderTime: '13:00',
          isActive: true,
        },
      ],
      closures: [],
    });
    expect(snap.isOpen).toBe(false);
  });

  it('honore un verrouillage admin', () => {
    const snap = computeMarketOpening({
      now: sundayMorning,
      isActive: true,
      statusLocked: true,
      lockedStatus: 'FERME',
      schedules: sundaySchedule,
      closures: [],
    });
    expect(snap.isOpen).toBe(false);
    expect(snap.status).toBe('FERME');
  });
});
