/**
 * components/ui/VerifiedBadge.tsx
 * Blue verified checkmark badge — Twitter/LinkedIn style.
 * Used on advisor profiles and search results.
 */

import React from 'react';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md';
  label?: string;
}

export default function VerifiedBadge({ size = 'sm', label }: VerifiedBadgeProps) {
  const px = size === 'md' ? 20 : 16;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        verticalAlign: 'middle',
      }}
      title={label ?? 'Verified'}
      aria-label={label ?? 'Verified'}
    >
      {/* Blue circle with white checkmark */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: px,
          height: px,
          borderRadius: '50%',
          background: '#1D9BF0',
          flexShrink: 0,
        }}
      >
        <svg
          width={px * 0.6}
          height={px * 0.6}
          viewBox="0 0 12 10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M1.5 5.5L4.5 8.5L10.5 1.5"
            stroke="#ffffff"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {label && (
        <span
          style={{
            fontSize: size === 'md' ? 13 : 11,
            fontWeight: 600,
            color: '#1D9BF0',
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
