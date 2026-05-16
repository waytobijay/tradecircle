/**
 * app/page.tsx
 * Root route — redirects based on auth state.
 *
 * - Loading  → full-screen pulse skeleton
 * - Authed   → /home
 * - Unauthed → /login
 *
 * Middleware handles server-side cookie checks, but this client redirect
 * catches the case where the cookie exists but authStore hasn't hydrated yet,
 * and gives a smooth loading state instead of a flash of the wrong content.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function RootSkeleton() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
      aria-label="Loading"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4">
        {/* Logo placeholder */}
        <div
          className="rounded-lg animate-pulse"
          style={{
            width:           '48px',
            height:          '48px',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        />
        {/* Wordmark placeholder */}
        <div
          className="rounded animate-pulse"
          style={{
            width:           '120px',
            height:          '16px',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function RootPage() {
  const router  = useRouter();
  const user    = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    if (loading) return; // wait for auth to resolve

    if (user) {
      router.replace('/home');
    } else {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Always show skeleton — redirect fires before the user sees anything
  return <RootSkeleton />;
}
