/**
 * components/ui/Modal.tsx
 * Accessible, animated modal dialog.
 * Spec ref: section 8.5 (Modal component), section 9.5 (Accessibility)
 *
 * Features:
 *  - Closes on overlay click + Escape key
 *  - Focus trap: Tab/Shift+Tab cycle within modal
 *  - ARIA role="dialog", aria-modal, aria-labelledby
 *  - Fade + scale-up animation on open
 *  - Sizes: sm (400px) | md (560px) | lg (740px)
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  isOpen:     boolean;
  onClose:    () => void;
  title?:     string;
  children:   React.ReactNode;
  size?:      ModalSize;
  className?: string;
}

const MAX_WIDTHS: Record<ModalSize, number> = {
  sm: 400,
  md: 560,
  lg: 740,
};

// ─── Focus trap helper ────────────────────────────────────────────────────────

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function trapFocus(e: KeyboardEvent, container: HTMLElement) {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (!nodes.length) return;
  const first = nodes[0];
  const last  = nodes[nodes.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
  } else {
    if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size      = 'md',
  className,
}: ModalProps) {
  const dialogRef    = useRef<HTMLDivElement>(null);
  const titleId      = 'modal-title';
  const maxWidth     = MAX_WIDTHS[size];

  // Escape key + focus trap
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Tab' && dialogRef.current) trapFocus(e, dialogRef.current);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    // Lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into dialog
    setTimeout(() => dialogRef.current?.focus(), 10);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prev;
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes modal-fade-in  { from { opacity: 0; }              to { opacity: 1; }              }
        @keyframes modal-scale-in { from { transform: scale(0.94); }  to { transform: scale(1); }     }
      `}</style>

      {/* Overlay */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position:   'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0, 0, 0, 0.5)',
          animation:  'modal-fade-in 0.18s ease forwards',
        }}
      />

      {/* Scroll container */}
      <div
        style={{
          position:       'fixed', inset: 0, zIndex: 501,
          display:        'flex', alignItems: 'center', justifyContent: 'center',
          padding:        '16px',
          overflowY:      'auto',
          pointerEvents:  'none',
        }}
      >
        {/* Dialog card */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          className={className}
          onClick={(e) => e.stopPropagation()}
          style={{
            width:         '100%',
            maxWidth:      maxWidth,
            background:    'var(--color-bg-secondary, var(--color-surface))',
            borderRadius:  12,
            border:        '1px solid var(--color-border)',
            boxShadow:     '0 20px 60px rgba(0,0,0,0.15)',
            animation:     'modal-scale-in 0.2s ease forwards',
            pointerEvents: 'auto',
            outline:       'none',
            overflow:      'hidden',
          }}
        >
          {/* Header */}
          {(title !== undefined) && (
            <div style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              padding:        '18px 20px 16px',
              borderBottom:   '1px solid var(--color-border)',
            }}>
              <h2
                id={titleId}
                style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-text)' }}
              >
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close modal"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-secondary)', padding: 4, borderRadius: 6,
                  display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-tertiary)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* No title — close button in corner */}
          {title === undefined && (
            <button
              onClick={onClose}
              aria-label="Close modal"
              style={{
                position: 'absolute', top: 12, right: 12,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-secondary)', padding: 4, borderRadius: 6,
                display: 'flex', alignItems: 'center', zIndex: 1,
              }}
            >
              <X size={18} />
            </button>
          )}

          {/* Body */}
          <div style={{ padding: '20px' }}>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
