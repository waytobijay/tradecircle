/**
 * components/ui/Button.tsx
 * Reusable button component.
 * Spec ref: section 8.4 (Button Styles)
 *
 * Variants: primary | secondary | danger | ghost | icon
 * Sizes:    sm | md | lg
 * States:   hover (8% darker) | active (scale 0.98) | disabled (40% opacity)
 * Loading:  spinner replaces label, width preserved
 */

'use client';

import { forwardRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  loading?:   boolean;
  children?:  React.ReactNode;
  className?: string;
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background:  'var(--color-primary)',
    color:       '#ffffff',
    border:      'none',
  },
  secondary: {
    background:  'transparent',
    color:       'var(--color-primary)',
    border:      '1.5px solid var(--color-primary)',
  },
  danger: {
    background:  'var(--color-danger)',
    color:       '#ffffff',
    border:      'none',
  },
  ghost: {
    background:  'transparent',
    color:       'var(--color-text-secondary)',
    border:      'none',
  },
  icon: {
    background:  'var(--color-bg-tertiary)',
    color:       'var(--color-text)',
    border:      'none',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '6px 12px',  fontSize: 12, height: 30 },
  md: { padding: '9px 18px',  fontSize: 14, height: 38 },
  lg: { padding: '12px 24px', fontSize: 15, height: 46 },
};

const iconSizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: 6,  width: 30, height: 30 },
  md: { padding: 8,  width: 38, height: 38 },
  lg: { padding: 10, width: 46, height: 46 },
};

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ color }: { color: string }) {
  return (
    <>
      <span style={{
        display:      'inline-block',
        width:        14,
        height:       14,
        borderRadius: '50%',
        border:       `2px solid ${color}40`,
        borderTop:    `2px solid ${color}`,
        animation:    'btn-spin 0.7s linear infinite',
        flexShrink:   0,
      }} />
      <style>{`@keyframes btn-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant   = 'primary',
    size      = 'md',
    loading   = false,
    disabled  = false,
    children,
    className,
    style,
    onClick,
    type      = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const isIcon     = variant === 'icon';

  const spinnerColor =
    variant === 'primary' || variant === 'danger' ? '#ffffff' : 'var(--color-primary)';

  const baseStyle: React.CSSProperties = {
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    borderRadius:   8,
    fontWeight:     500,
    cursor:         isDisabled ? 'not-allowed' : 'pointer',
    opacity:        isDisabled ? 0.4 : 1,
    transition:     'filter 0.15s ease, transform 0.1s ease, opacity 0.15s',
    whiteSpace:     'nowrap',
    lineHeight:     1,
    outline:        'none',
    userSelect:     'none',
    boxSizing:      'border-box',
    ...variantStyles[variant],
    ...(isIcon ? iconSizeStyles[size] : sizeStyles[size]),
    ...style,
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={className}
      style={baseStyle}
      onClick={isDisabled ? undefined : onClick}
      onMouseEnter={(e) => {
        if (!isDisabled) e.currentTarget.style.filter = 'brightness(0.92)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter    = 'none';
        e.currentTarget.style.transform = 'scale(1)';
      }}
      onMouseDown={(e) => {
        if (!isDisabled) e.currentTarget.style.transform = 'scale(0.98)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      aria-disabled={isDisabled}
      aria-busy={loading}
      {...rest}
    >
      {loading ? <Spinner color={spinnerColor} /> : children}
    </button>
  );
});

Button.displayName = 'Button';

export { Button };
