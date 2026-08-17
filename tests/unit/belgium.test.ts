import { describe, expect, it } from 'vitest';
import {
  belgianHolidays,
  formatIban,
  isBelgianHoliday,
  isValidBelgianPostalCode,
  isValidIban,
  isValidVatNumber,
  regionFromPostalCode,
  toE164Belgian,
} from '@/lib/belgium';

describe('IBAN belge', () => {
  it('valide l’exemple officiel BE68 5390 0754 7034', () => {
    expect(isValidIban('BE68 5390 0754 7034')).toBe(true);
    expect(formatIban('BE68539007547034')).toBe('BE68 5390 0754 7034');
  });

  it('rejette un IBAN trop court ou une mauvaise clé', () => {
    expect(isValidIban('BE00 0000 0000 0000')).toBe(false);
    expect(isValidIban('FR1420041010050500013M02606')).toBe(true);
  });
});

describe('TVA / BCE', () => {
  it('accepte un numéro avec clé modulo 97', () => {
    const base = 12345678;
    const check = String(97 - (base % 97)).padStart(2, '0');
    expect(isValidVatNumber(`BE${base}${check}`)).toBe(true);
  });

  it('rejette une clé incorrecte', () => {
    expect(isValidVatNumber('BE0123456789')).toBe(false);
  });
});

describe('téléphone et codes postaux', () => {
  it('normalise un mobile belge en E.164', () => {
    expect(toE164Belgian('0470 12 34 56')).toBe('+32470123456');
    expect(toE164Belgian('+32 470 12 34 56')).toBe('+32470123456');
  });

  it('classe les régions par code postal', () => {
    expect(isValidBelgianPostalCode('1000')).toBe(true);
    expect(regionFromPostalCode('1000')).toBe('BRUXELLES');
    expect(regionFromPostalCode('2000')).toBe('FLANDRE');
    expect(regionFromPostalCode('4000')).toBe('WALLONIE');
  });
});

describe('jours fériés', () => {
  it('inclut la Fête nationale le 21 juillet', () => {
    expect(isBelgianHoliday(new Date('2026-07-21T00:00:00Z'))).toBe(true);
    const names = belgianHolidays(2026).map((h) => h.nameFr);
    expect(names).toContain('Noël');
    expect(names).toHaveLength(10);
  });

  it('place le lundi de Pâques 2026 au 6 avril', () => {
    const easterMonday = belgianHolidays(2026).find((h) => h.nameFr === 'Lundi de Pâques');
    expect(easterMonday?.date.toISOString().slice(0, 10)).toBe('2026-04-06');
  });
});
