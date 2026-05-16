'use client';

/**
 * components/ui/GatewayCard.tsx
 * Payment gateway selector card used on the checkout page.
 * GatewayId is imported from services/payments (not @/types) to avoid
 * concurrent-edit conflicts on types/index.ts.
 */

import { useState } from 'react';
import type { GatewayId } from '@/services/payments';

interface GatewayCardProps {
  id: GatewayId;
  label: string;
  description: string;
  logoSrc?: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

// Emoji fallback icons per gateway
const GATEWAY_EMOJIS: Record<GatewayId, string> = {
  stripe:           '💳',
  eway:             '🔒',
  esewa:            '🟢',
  khalti:           '🟣',
  fonepay:          '📱',
  'contact-seller': '💬',
};

export default function GatewayCard({
  id,
  label,
  description,
  logoSrc,
  selected,
  onSelect,
  disabled = false,
}: GatewayCardProps) {
  const [hovered, setHovered] = useState(false);

  const cardStyle: React.CSSProperties = {
    display:      'flex',
    alignItems:   'center',
    gap:          14,
    padding:      '14px 16px',
    borderRadius: 12,
    border:       selected
      ? '2px solid var(--color-primary)'
      : '2px solid var(--color-border)',
    background:   hovered && !disabled
      ? 'var(--color-surface)'
      : 'var(--color-background)',
    cursor:       disabled ? 'not-allowed' : 'pointer',
    opacity:      disabled ? 0.45 : 1,
    transition:   'border-color 0.15s, background 0.15s, opacity 0.15s',
    userSelect:   'none',
    width:        '100%',
    boxSizing:    'border-box',
  };

  const logoAreaStyle: React.CSSProperties = {
    width:          48,
    height:         48,
    borderRadius:   10,
    border:         '1px solid var(--color-border)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    background:     'var(--color-surface)',
    flexShrink:     0,
    overflow:       'hidden',
    fontSize:       24,
  };

  const radioDotStyle: React.CSSProperties = {
    width:          20,
    height:         20,
    borderRadius:   '50%',
    border:         selected
      ? '2px solid var(--color-primary)'
      : '2px solid var(--color-border)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
    background:     'var(--color-background)',
    transition:     'border-color 0.15s',
  };

  const innerDotStyle: React.CSSProperties = {
    width:        10,
    height:       10,
    borderRadius: '50%',
    background:   'var(--color-primary)',
    opacity:      selected ? 1 : 0,
    transition:   'opacity 0.15s',
  };

  const handleClick = () => {
    if (!disabled) onSelect();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      style={cardStyle}
      onClick={handleClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={handleKeyDown}
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
    >
      {/* Logo / icon area */}
      <div style={logoAreaStyle}>
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt={`${label} logo`}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <span role="img" aria-label={label} style={{ lineHeight: 1 }}>
            {GATEWAY_EMOJIS[id]}
          </span>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 15, fontWeight: 600,
          color: 'var(--color-text)', lineHeight: 1.3,
        }}>
          {label}
        </p>
        <p style={{
          margin: '2px 0 0', fontSize: 13,
          color: 'var(--color-text-secondary)',
          lineHeight: 1.4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {description}
        </p>
      </div>

      {/* Radio dot */}
      <div style={radioDotStyle} aria-hidden="true">
        <div style={innerDotStyle} />
      </div>
    </div>
  );
}
