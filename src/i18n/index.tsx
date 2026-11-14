/* eslint-disable react-refresh/only-export-components -- provider + hook live together on purpose */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import cs from './cs.json';
import en from './en.json';

export type Lang = 'cs' | 'en';
type Dict = Record<string, string>;

const DICTS: Record<Lang, Dict> = { cs, en };

export function detectLang(): Lang {
  try {
    const nav = (navigator.languages?.[0] ?? navigator.language ?? 'en').toLowerCase();
    return nav.startsWith('cs') || nav.startsWith('sk') ? 'cs' : 'en';
  } catch {
    return 'en';
  }
}

export interface I18n {
  lang: Lang;
  t: (key: string, vars?: Record<string, number | string>) => string;
  /** Locale-aware number: decimal comma in CS, dot in EN. */
  fmt: (n: number, maxDigits?: number) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const fmt = useCallback(
    (n: number, maxDigits = 2) =>
      new Intl.NumberFormat(lang === 'cs' ? 'cs-CZ' : 'en-US', {
        maximumFractionDigits: maxDigits,
        useGrouping: false,
      }).format(n),
    [lang],
  );
  const t = useCallback(
    (key: string, vars?: Record<string, number | string>) => {
      const raw = DICTS[lang][key] ?? DICTS.en[key] ?? key;
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (_, k: string) => {
        const v = vars[k];
        return typeof v === 'number' ? fmt(v) : String(v ?? '');
      });
    },
    [lang, fmt],
  );
  const value = useMemo(() => ({ lang, t, fmt }), [lang, t, fmt]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}
