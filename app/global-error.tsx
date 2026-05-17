/**
 * app/global-error.tsx
 * Catches uncaught client + server errors at the root of the app.
 *
 * Replaces the browser's generic "This page couldn't load" with a real
 * error message + reset button. Required by Next.js App Router — must
 * include its own <html> and <body> tags.
 *
 * Shows the actual error.message + digest (Vercel's correlation ID) so
 * the issue can be reported with concrete diagnostics rather than a black
 * screen.
 */

'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Surface the error to the browser console for DevTools inspection
  useEffect(() => {
    console.error('[TradeCircle] Global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          color: '#fff',
        }}
      >
        <div
          style={{
            maxWidth: 540,
            width: '100%',
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 20,
            padding: 32,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.2)',
              color: '#fca5a5',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              marginBottom: 16,
            }}
          >
            !
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: 14,
              margin: '0 0 20px',
              color: '#cbd5e1',
              lineHeight: 1.6,
            }}
          >
            The app encountered an unexpected error. Most often this is fixed by
            a hard refresh ({navigatorHint()}).
          </p>

          <div
            style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 12,
              fontFamily:
                '"JetBrains Mono", Menlo, Consolas, monospace',
              color: '#fca5a5',
              wordBreak: 'break-word',
              marginBottom: 20,
              maxHeight: 200,
              overflow: 'auto',
            }}
          >
            {error.message || 'Unknown error'}
            {error.digest && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: '#94a3b8',
                }}
              >
                ref: {error.digest}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={reset}
              style={{
                flex: 1,
                minWidth: 140,
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
                background:
                  'linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)',
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/login"
              style={{
                flex: 1,
                minWidth: 140,
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'center',
                textDecoration: 'none',
              }}
            >
              Go to login
            </a>
          </div>

          <p
            style={{
              fontSize: 11,
              color: '#64748b',
              margin: '20px 0 0',
              textAlign: 'center',
            }}
          >
            Persisting? Check{' '}
            <a
              href="/api/health"
              style={{ color: '#93c5fd', textDecoration: 'underline' }}
            >
              /api/health
            </a>{' '}
            for env-var status.
          </p>
        </div>
      </body>
    </html>
  );
}

function navigatorHint(): string {
  // Best-effort OS detection for the keyboard shortcut hint
  if (typeof navigator === 'undefined') return 'Ctrl+Shift+R';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'Cmd+Shift+R';
  return 'Ctrl+Shift+R';
}
