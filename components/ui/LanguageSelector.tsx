/**
 * components/ui/LanguageSelector.tsx
 * Language picker — dropdown or inline pill variants.
 *
 * Usage:
 *   <LanguageSelector />                          // dropdown, medium
 *   <LanguageSelector size="sm" />               // dropdown, small (footer)
 *   <LanguageSelector variant="inline" />        // pill buttons (settings page)
 */

'use client';

import { useTranslation } from '@/hooks/useTranslation';
import type { Locale }    from '@/i18n';

// ─── Config ───────────────────────────────────────────────────────────────────

const LOCALES: { value: Locale; flag: string; label: string; nativeLabel: string }[] = [
  { value: 'en', flag: '🇦🇺', label: 'English',  nativeLabel: 'English'  },
  { value: 'ne', flag: '🇳🇵', label: 'Nepali',   nativeLabel: 'नेपाली'  },
  { value: 'hi', flag: '🇮🇳', label: 'Hindi',    nativeLabel: 'हिन्दी'  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface LanguageSelectorProps {
  size?:    'sm' | 'md';
  variant?: 'dropdown' | 'inline';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LanguageSelector({
  size    = 'md',
  variant = 'dropdown',
}: LanguageSelectorProps) {
  const { locale, setLocale } = useTranslation();

  // ── Inline pill variant ────────────────────────────────────────────────────
  if (variant === 'inline') {
    return (
      <div
        role="group"
        aria-label="Select language"
        style={{
          display:   'flex',
          gap:       8,
          flexWrap:  'wrap',
        }}
      >
        {LOCALES.map((loc) => {
          const active = locale === loc.value;
          return (
            <button
              key={loc.value}
              type="button"
              onClick={() => setLocale(loc.value)}
              aria-pressed={active}
              style={{
                display:      'inline-flex',
                alignItems:   'center',
                gap:          6,
                padding:      '6px 14px',
                borderRadius: 999,
                border:       `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background:   active
                  ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                  : 'var(--color-surface-2)',
                color:        active ? 'var(--color-primary)' : 'var(--color-text-2)',
                fontSize:     14,
                fontWeight:   active ? 700 : 500,
                cursor:       'pointer',
                transition:   'border-color 0.15s, background 0.15s, color 0.15s',
                whiteSpace:   'nowrap',
              }}
            >
              <span role="img" aria-label={loc.label} style={{ fontSize: 16 }}>
                {loc.flag}
              </span>
              {loc.nativeLabel}
            </button>
          );
        })}
      </div>
    );
  }

  // ── Dropdown variant (default) ─────────────────────────────────────────────
  const isSmall = size === 'sm';
  const current = LOCALES.find((l) => l.value === locale) ?? LOCALES[0];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label="Select language"
        style={{
          appearance:   'none',
          WebkitAppearance: 'none',
          paddingLeft:  isSmall ? 28 : 32,
          paddingRight: isSmall ? 24 : 28,
          paddingTop:   isSmall ? 4  : 7,
          paddingBottom:isSmall ? 4  : 7,
          background:   'var(--color-surface-2)',
          border:       '1px solid var(--color-border)',
          borderRadius: 8,
          color:        'var(--color-text)',
          fontSize:     isSmall ? 12 : 14,
          fontWeight:   500,
          cursor:       'pointer',
          outline:      'none',
          transition:   'border-color 0.15s',
        }}
      >
        {LOCALES.map((loc) => (
          <option key={loc.value} value={loc.value}>
            {loc.flag} {loc.nativeLabel}
          </option>
        ))}
      </select>

      {/* Flag overlay — positioned left of the select */}
      <span
        aria-hidden="true"
        style={{
          position:      'absolute',
          left:          isSmall ? 6  : 8,
          top:           '50%',
          transform:     'translateY(-50%)',
          fontSize:      isSmall ? 13 : 15,
          pointerEvents: 'none',
          lineHeight:    1,
        }}
      >
        {current.flag}
      </span>

      {/* Chevron */}
      <span
        aria-hidden="true"
        style={{
          position:      'absolute',
          right:         isSmall ? 5  : 7,
          top:           '50%',
          transform:     'translateY(-50%)',
          pointerEvents: 'none',
          color:         'var(--color-text-2)',
          fontSize:      10,
          lineHeight:    1,
        }}
      >
        ▾
      </span>
    </div>
  );
}
