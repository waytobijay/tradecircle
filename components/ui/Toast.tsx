/**
 * components/ui/Toast.tsx
 * Toast notification system.
 * Spec ref: section 8.5 (Toast component), section 10.3 (Microcopy)
 *
 * Usage:
 *   1. Wrap app in <ToastProvider>
 *   2. const { toast } = useToast()
 *      toast.success('Product saved!')
 *      toast.error('Something went wrong.')
 *      toast.warning('Stock running low.')
 *      toast.info('New message received.')
 *
 * Features:
 *  - Auto-dismisses after 4 seconds
 *  - Manual close button
 *  - Slide-in animation (right on desktop, bottom-centre on mobile)
 *  - Stacks multiple toasts vertically
 */

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id:      string;
  type:    ToastType;
  message: string;
}

interface ToastContextValue {
  toast: {
    success: (msg: string) => void;
    error:   (msg: string) => void;
    warning: (msg: string) => void;
    info:    (msg: string) => void;
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Visual config per type ───────────────────────────────────────────────────

const typeConfig: Record<ToastType, { icon: React.ReactNode; accent: string }> = {
  success: { icon: <CheckCircle  size={18} />, accent: 'var(--color-success, #16a34a)' },
  error:   { icon: <XCircle      size={18} />, accent: 'var(--color-danger,  #dc2626)' },
  warning: { icon: <AlertTriangle size={18} />, accent: 'var(--color-warning, #d97706)' },
  info:    { icon: <Info          size={18} />, accent: 'var(--color-primary, #1d4ed8)' },
};

// ─── Single toast card ────────────────────────────────────────────────────────

function ToastCard({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const { icon, accent } = typeConfig[item.type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onRemove(item.id), 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [item.id, onRemove]);

  return (
    <div
      className="tc-toast-card"
      role="alert"
      aria-live="assertive"
      style={{
        display:      'flex',
        alignItems:   'flex-start',
        gap:          10,
        padding:      '12px 14px',
        borderRadius: 10,
        background:   'var(--color-background)',
        border:       `1px solid var(--color-border)`,
        borderLeft:   `4px solid ${accent}`,
        boxShadow:    '0 4px 20px rgba(0,0,0,0.10)',
        minWidth:     280,
        maxWidth:     360,
        animation:    'toast-in 0.25s ease forwards',
      }}
    >
      <span style={{ color: accent, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5 }}>
        {item.message}
      </span>
      <button
        onClick={() => onRemove(item.id)}
        aria-label="Dismiss notification"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-secondary)', padding: 2,
          display: 'flex', alignItems: 'center', flexShrink: 0,
          borderRadius: 4,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast: ToastContextValue['toast'] = {
    success: (msg) => addToast('success', msg),
    error:   (msg) => addToast('error',   msg),
    warning: (msg) => addToast('warning', msg),
    info:    (msg) => addToast('info',    msg),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container */}
      {toasts.length > 0 && (
        <>
          <style>{`
            @keyframes toast-in {
              from { opacity: 0; transform: translateX(24px); }
              to   { opacity: 1; transform: translateX(0);    }
            }
            @media (max-width: 767px) {
              .tc-toast-container {
                bottom: 80px !important;
                right: 50% !important;
                transform: translateX(50%) !important;
                align-items: center !important;
              }
              .tc-toast-card { min-width: calc(100vw - 32px) !important; max-width: calc(100vw - 32px) !important; }
              @keyframes toast-in {
                from { opacity: 0; transform: translateY(16px); }
                to   { opacity: 1; transform: translateY(0);    }
              }
            }
          `}</style>
          <div
            className="tc-toast-container"
            style={{
              position:      'fixed',
              bottom:        24,
              right:         24,
              zIndex:        9999,
              display:       'flex',
              flexDirection: 'column',
              gap:           10,
              alignItems:    'flex-end',
            }}
          >
            {toasts.map((t) => (
              <ToastCard key={t.id} item={t} onRemove={removeToast} />
            ))}
          </div>
        </>
      )}
    </ToastContext.Provider>
  );
}
