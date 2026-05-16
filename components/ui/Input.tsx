/**
 * components/ui/Input.tsx
 * Reusable form input with floating label, error state, and password toggle.
 * Spec ref: section 8.5 (Form inputs), section 9.1 (React Hook Form + Zod)
 *
 * Props:
 *  - label      string           — floating label text
 *  - type        string          — input type (text, email, password, tel, number…)
 *  - placeholder string
 *  - error       string          — error message shown below input
 *  - register     RHF register   — React Hook Form register return value
 *  - required     boolean
 *  - disabled     boolean
 *  - className    string
 */

'use client';

import { forwardRef, useState } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?:     string;
  error?:     string;
  register?:  UseFormRegisterReturn;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    type      = 'text',
    placeholder,
    error,
    register,
    required  = false,
    disabled  = false,
    className,
    style,
    id,
    ...rest
  },
  forwardedRef,
) {
  const [showPassword, setShowPassword] = useState(false);
  const [focused,      setFocused]      = useState(false);

  const inputId     = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const isPassword  = type === 'password';
  const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const borderColor = error   ? 'var(--color-danger)'
                    : focused ? 'var(--color-primary)'
                    : 'var(--color-border)';

  return (
    <>
      <style>{`
        .tc-input::placeholder { color: transparent; }
        .tc-input:focus::placeholder { color: var(--color-text-secondary); opacity: 0.6; }
        .tc-label-float {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 14px;
          color: var(--color-text-secondary);
          pointer-events: none;
          transition: top 0.15s ease, font-size 0.15s ease, color 0.15s ease;
          background: var(--color-background);
          padding: 0 4px;
          line-height: 1;
        }
        .tc-input:focus ~ .tc-label-float,
        .tc-input:not(:placeholder-shown) ~ .tc-label-float {
          top: 0;
          font-size: 11px;
          color: var(--color-primary);
        }
        .tc-input-error ~ .tc-label-float {
          color: var(--color-danger) !important;
        }
      `}</style>

      <div
        className={className}
        style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            {...register}
            {...rest}
            ref={(node) => {
              // Support both RHF ref and forwardedRef
              if (register && typeof register === 'object' && 'ref' in register) {
                (register as { ref: (node: HTMLInputElement | null) => void }).ref(node);
              }
              if (typeof forwardedRef === 'function') forwardedRef(node);
              else if (forwardedRef) forwardedRef.current = node;
            }}
            id={inputId}
            type={resolvedType}
            placeholder={placeholder ?? (label ? ' ' : undefined)}
            required={required}
            disabled={disabled}
            className={`tc-input${error ? ' tc-input-error' : ''}`}
            onFocus={(e) => { setFocused(true);  rest.onFocus?.(e); }}
            onBlur={(e)  => { setFocused(false); rest.onBlur?.(e);  }}
            style={{
              width:        '100%',
              height:       44,
              padding:      label ? '16px 12px 6px' : '10px 12px',
              paddingRight: isPassword ? 44 : 12,
              borderRadius: 8,
              border:       `1.5px solid ${borderColor}`,
              background:   disabled ? 'var(--color-bg-tertiary)' : 'var(--color-background)',
              color:        'var(--color-text)',
              fontSize:     14,
              outline:      'none',
              transition:   'border-color 0.15s',
              cursor:       disabled ? 'not-allowed' : 'text',
              opacity:      disabled ? 0.6 : 1,
              boxSizing:    'border-box',
            }}
          />

          {/* Floating label */}
          {label && (
            <label
              htmlFor={inputId}
              className="tc-label-float"
            >
              {label}{required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
            </label>
          )}

          {/* Password toggle */}
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position:   'absolute',
                right:      10,
                top:        '50%',
                transform:  'translateY(-50%)',
                background: 'none',
                border:     'none',
                cursor:     'pointer',
                color:      'var(--color-text-secondary)',
                padding:    4,
                display:    'flex',
                alignItems: 'center',
                borderRadius: 4,
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>

        {/* Error message */}
        {error && (
          <span style={{
            fontSize: 12,
            color:    'var(--color-danger)',
            paddingLeft: 4,
            lineHeight: 1.4,
          }}>
            {error}
          </span>
        )}
      </div>
    </>
  );
});

Input.displayName = 'Input';

export { Input };
