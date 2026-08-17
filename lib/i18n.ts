export const LOCALES = ['fr', 'nl', 'de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export interface Dictionary {
  [key: string]: string | Dictionary;
}

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  fr: () => import('@/locales/fr.json').then((m) => m.default),
  nl: () => import('@/locales/nl.json').then((m) => m.default),
  de: () => import('@/locales/de.json').then((m) => m.default),
  en: () => import('@/locales/en.json').then((m) => m.default),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}

export function t(dict: Dictionary, path: string, vars?: Record<string, string | number>): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as object)) {
      return (acc as Dictionary)[key];
    }
    return undefined;
  }, dict);

  if (typeof value !== 'string') return path;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'Français',
  nl: 'Nederlands',
  de: 'Deutsch',
  en: 'English',
};
