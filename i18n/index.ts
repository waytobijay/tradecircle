/**
 * i18n/index.ts
 * Lightweight i18n system — no external packages required.
 *
 * Usage:
 *   import { t, getLocale, setLocale } from '@/i18n';
 *
 * In components, prefer the useTranslation() hook instead.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Locale = 'en' | 'ne' | 'hi';

export const DEFAULT_LOCALE: Locale = 'en';
export const SUPPORTED_LOCALES: Locale[] = ['en', 'ne', 'hi'];

/** Dot-notation key, e.g. 'nav.home', 'auth.login' */
export type TranslationKey = string;

/** Flat key→string map built from a nested translations object */
type FlatTranslations = Record<string, string>;

// ─── Module-level cache ───────────────────────────────────────────────────────

/** Resolved flat translation maps, keyed by locale */
const _cache: Partial<Record<Locale, FlatTranslations>> = {};

/** Promise gate so we don't load the same locale twice concurrently */
const _loading: Partial<Record<Locale, Promise<FlatTranslations>>> = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively flatten { nav: { home: 'Home' } } → { 'nav.home': 'Home' } */
function flattenObj(obj: Record<string, unknown>, prefix = ''): FlatTranslations {
  const out: FlatTranslations = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenObj(v as Record<string, unknown>, key));
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

/** Apply {{var}} interpolation */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{{${key}}}`
  );
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Get the current locale.
 * Reads from localStorage (client-side); falls back to DEFAULT_LOCALE.
 */
export function getLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem('tc-locale') as Locale | null;
    if (stored && (SUPPORTED_LOCALES as string[]).includes(stored)) return stored;
  } catch {
    // localStorage may be blocked in some environments
  }
  return DEFAULT_LOCALE;
}

/**
 * Persist a locale choice to localStorage.
 * Does NOT reload the page — the useTranslation hook handles live updates.
 */
export function setLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('tc-locale', locale);
  } catch {
    // ignore write errors
  }
}

/**
 * Load and cache the flat translation map for a locale.
 * Safe to call multiple times — subsequent calls return the cached promise.
 */
export async function loadTranslations(locale: Locale): Promise<FlatTranslations> {
  if (_cache[locale]) return _cache[locale]!;
  if (_loading[locale]) return _loading[locale]!;

  const promise = (async () => {
    try {
      let mod: { default: Record<string, unknown> };
      if (locale === 'ne') {
        mod = await import('./locales/ne');
      } else if (locale === 'hi') {
        mod = await import('./locales/hi');
      } else {
        mod = await import('./locales/en');
      }
      const flat = flattenObj(mod.default as Record<string, unknown>);
      _cache[locale] = flat;
      return flat;
    } catch {
      // Fallback to English on any load error
      if (locale !== 'en') return loadTranslations('en');
      return {};
    }
  })();

  _loading[locale] = promise;
  return promise;
}

/**
 * Synchronously get a translation.
 *
 * Because module imports are async we eagerly preload and cache translations;
 * this function reads from that cache. If called before the locale is loaded,
 * it falls back gracefully:
 *   1. Try requested locale cache
 *   2. Try English cache
 *   3. Return the key itself
 */
export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  const locale = getLocale();

  // Try current locale
  const localeMap = _cache[locale];
  if (localeMap && key in localeMap) {
    return interpolate(localeMap[key], vars);
  }

  // Fallback: English
  const enMap = _cache['en'];
  if (enMap && key in enMap) {
    return interpolate(enMap[key], vars);
  }

  // Last resort: return the key
  return key;
}

/**
 * Expose the internal cache for the hook — avoids duplicate loads.
 * Returns undefined if not yet loaded.
 */
export function getCachedTranslations(locale: Locale): FlatTranslations | undefined {
  return _cache[locale];
}

// ─── Preload English on module init (client-side) ────────────────────────────

if (typeof window !== 'undefined') {
  void loadTranslations('en');
  const current = getLocale();
  if (current !== 'en') {
    void loadTranslations(current);
  }
}
