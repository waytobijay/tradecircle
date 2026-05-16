/**
 * hooks/useTranslation.ts
 * React hook for consuming the lightweight i18n system.
 *
 * Usage:
 *   const { t, locale, setLocale, localeLabel } = useTranslation();
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  type Locale,
  type TranslationKey,
  getLocale,
  setLocale as persistLocale,
  loadTranslations,
  getCachedTranslations,
} from '@/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ne: 'नेपाली',
  hi: 'हिन्दी',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>(getLocale);

  // Trigger a re-render once translations are loaded
  const [, setTick] = useState(0);

  // Load translations for the active locale (and English fallback) on mount / locale change
  useEffect(() => {
    let cancelled = false;

    async function load() {
      await loadTranslations('en');
      await loadTranslations(locale);
      if (!cancelled) setTick((n) => n + 1);
    }

    // If already cached, no async work needed — but still force a re-render so
    // the component picks up any locale change synchronously.
    if (getCachedTranslations(locale) && getCachedTranslations('en')) {
      setTick((n) => n + 1);
    } else {
      void load();
    }

    return () => { cancelled = true; };
  }, [locale]);

  /** Translate a dot-notation key with optional interpolation vars. */
  const translate = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      // Try current locale
      const localeMap = getCachedTranslations(locale);
      if (localeMap && key in localeMap) {
        const raw = localeMap[key];
        if (!vars) return raw;
        return raw.replace(/\{\{(\w+)\}\}/g, (_, k) =>
          k in vars ? String(vars[k]) : `{{${k}}}`
        );
      }

      // Fallback to English
      const enMap = getCachedTranslations('en');
      if (enMap && key in enMap) {
        const raw = enMap[key];
        if (!vars) return raw;
        return raw.replace(/\{\{(\w+)\}\}/g, (_, k) =>
          k in vars ? String(vars[k]) : `{{${k}}}`
        );
      }

      return key;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, setTick]
  );

  /** Change locale — persists to localStorage, updates state (no page reload). */
  const changeLocale = useCallback((next: Locale) => {
    persistLocale(next);
    setLocaleState(next);
  }, []);

  return {
    t:           translate,
    locale,
    setLocale:   changeLocale,
    localeLabel: LOCALE_LABELS[locale],
  };
}
