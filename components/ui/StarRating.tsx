/**
 * components/ui/StarRating.tsx
 * Interactive / read-only star rating widget.
 *
 * Interactive mode:
 *   - Hover highlights 1..N stars
 *   - Click commits the value via onChange
 *
 * ReadOnly mode:
 *   - Renders partial fill for fractional values (e.g. 4.3 → 4 full + 1 partial)
 *   - No hover / click behaviour
 *
 * No external deps — pure inline styles + SVG clip-path for partial fill.
 */

'use client';

import { useState } from 'react';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface StarRatingProps {
  value: number;           // 0–5
  onChange?: (v: number) => void;
  size?: number;           // px, default 20
  readOnly?: boolean;
}

// ─────────────────────────────────────────────
// Single star SVG (filled or empty, with optional clip fraction)
// ─────────────────────────────────────────────

function Star({
  filled,
  partial,
  size,
}: {
  filled:   boolean;
  partial?: number; // 0–1 fraction of fill (readOnly fractional)
  size:     number;
}) {
  const color    = 'var(--color-warning, #F59E0B)';
  const emptyClr = 'var(--color-border, #D1D5DB)';

  if (partial !== undefined && partial > 0 && partial < 1) {
    // Clip-path approach: overlay a filled star clipped to `partial` width
    const id = `star-clip-${Math.round(partial * 100)}`;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{ display: 'block', flexShrink: 0 }}
        aria-hidden="true"
      >
        <defs>
          <clipPath id={id}>
            <rect x="0" y="0" width={24 * partial} height="24" />
          </clipPath>
        </defs>
        {/* Empty background star */}
        <polygon
          points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
          fill={emptyClr}
          stroke={emptyClr}
          strokeWidth="1"
          strokeLinejoin="round"
        />
        {/* Filled star clipped */}
        <polygon
          points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
          fill={color}
          stroke={color}
          strokeWidth="1"
          strokeLinejoin="round"
          clipPath={`url(#${id})`}
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: 'block', flexShrink: 0 }}
      aria-hidden="true"
    >
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill={filled ? color : emptyClr}
        stroke={filled ? color : emptyClr}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────
// StarRating component
// ─────────────────────────────────────────────

export default function StarRating({
  value,
  onChange,
  size = 20,
  readOnly = false,
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const displayValue = readOnly ? value : (hovered ?? value);

  return (
    <div
      role={readOnly ? 'img' : 'radiogroup'}
      aria-label={`Rating: ${value} out of 5`}
      style={{
        display:    'inline-flex',
        gap:        '2px',
        alignItems: 'center',
        cursor:     readOnly ? 'default' : 'pointer',
      }}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const isFull    = displayValue >= star;
        const fraction  = readOnly ? Math.max(0, Math.min(1, displayValue - (star - 1))) : 0;
        const isPartial = readOnly && fraction > 0 && fraction < 1;

        return (
          <span
            key={star}
            role={readOnly ? undefined : 'radio'}
            aria-checked={readOnly ? undefined : value === star}
            aria-label={readOnly ? undefined : `${star} star${star > 1 ? 's' : ''}`}
            tabIndex={readOnly ? undefined : 0}
            onMouseEnter={readOnly ? undefined : () => setHovered(star)}
            onMouseLeave={readOnly ? undefined : () => setHovered(null)}
            onClick={readOnly ? undefined : () => onChange?.(star)}
            onKeyDown={
              readOnly
                ? undefined
                : (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onChange?.(star);
                    }
                  }
            }
            style={{
              display:    'block',
              lineHeight: 0,
              transition: 'transform 0.1s ease',
              transform:  !readOnly && hovered === star ? 'scale(1.15)' : 'scale(1)',
            }}
          >
            <Star
              filled={isFull}
              partial={isPartial ? fraction : undefined}
              size={size}
            />
          </span>
        );
      })}
    </div>
  );
}
