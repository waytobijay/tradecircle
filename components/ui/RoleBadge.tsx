/**
 * components/ui/RoleBadge.tsx
 * Coloured pill badge for user roles.
 * Spec ref: section 8.5 (RoleBadge component)
 *
 * Buyer  → var(--color-buyer)  background (blue)
 * Seller → var(--color-seller) background (amber)
 * Advisor→ var(--color-advisor) background (purple)
 */

'use client';

import type { UserRole } from '@/types';

export interface RoleBadgeProps {
  role:       UserRole;
  className?: string;
  style?:     React.CSSProperties;
}

const roleConfig: Record<UserRole, { bg: string; label: string }> = {
  buyer:   { bg: 'var(--color-buyer,   #1d4ed8)', label: 'Buyer'   },
  seller:  { bg: 'var(--color-seller,  #d97706)', label: 'Seller'  },
  advisor: { bg: 'var(--color-advisor, #7c3aed)', label: 'Advisor' },
};

export function RoleBadge({ role, className, style }: RoleBadgeProps) {
  const { bg, label } = roleConfig[role];

  return (
    <span
      className={className}
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        padding:       '3px 10px',
        borderRadius:  999,
        background:    bg,
        color:         '#ffffff',
        fontSize:      11,
        fontWeight:    600,
        textTransform: 'capitalize',
        letterSpacing: '0.03em',
        whiteSpace:    'nowrap',
        lineHeight:    1.4,
        ...style,
      }}
    >
      {label}
    </span>
  );
}
