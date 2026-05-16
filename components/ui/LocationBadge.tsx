/**
 * components/ui/LocationBadge.tsx
 * Pill badge showing city + country with a map pin icon.
 * Spec ref: section 8.5 (LocationBadge component)
 *
 * Props:
 *  - city    string
 *  - country string
 *  - size    'sm' | 'md'
 */

'use client';

import { MapPin } from 'lucide-react';

export type LocationBadgeSize = 'sm' | 'md';

export interface LocationBadgeProps {
  city:       string;
  country?:   string;
  size?:      LocationBadgeSize;
  className?: string;
  style?:     React.CSSProperties;
}

const sizeMap = {
  sm: { fontSize: 11, iconSize: 11, padding: '3px 8px',  gap: 4 },
  md: { fontSize: 13, iconSize: 13, padding: '5px 10px', gap: 5 },
};

export function LocationBadge({
  city,
  country,
  size      = 'md',
  className,
  style,
}: LocationBadgeProps) {
  const s    = sizeMap[size];
  const label = country ? `${city}, ${country}` : city;

  return (
    <span
      className={className}
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          s.gap,
        padding:      s.padding,
        borderRadius: 999,
        background:   'var(--color-bg-tertiary)',
        color:        'var(--color-text-secondary)',
        fontSize:     s.fontSize,
        fontWeight:   500,
        whiteSpace:   'nowrap',
        lineHeight:   1.3,
        ...style,
      }}
    >
      <MapPin size={s.iconSize} strokeWidth={2} style={{ flexShrink: 0 }} />
      {label}
    </span>
  );
}
