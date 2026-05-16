/**
 * app/home/page.tsx
 * Single route that serves two experiences:
 *   - Unauthenticated → LandingPage (marketing site, 7 sections)
 *   - Authenticated   → HomeFeed    (social feed, 3-column layout)
 *
 * Spec ref: section 3 (Home / Landing Page)
 *
 * Auth state comes from authStore (populated by AuthProvider → useAuth).
 * While loading, render a neutral full-screen skeleton so neither
 * experience flashes before auth resolves.
 */

'use client';

import { Suspense, lazy } from 'react';
import { useAuthStore }   from '@/store/authStore';

// Lazy-load both experiences so each bundle only loads when needed
const LandingPage = lazy(() =>
  import('@/components/home/LandingPage').then((m) => ({ default: m.LandingPage }))
);
const HomeFeed = lazy(() =>
  import('@/components/home/HomeFeed').then((m) => ({ default: m.HomeFeed }))
);

// ─────────────────────────────────────────────
// Skeletons
// ─────────────────────────────────────────────

function AuthSkeleton() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
      aria-busy="true"
      aria-label="Loading"
    >
      {/* Navbar skeleton */}
      <div
        className="animate-pulse"
        style={{
          height:          '64px',
          backgroundColor: 'var(--color-bg-primary)',
          borderBottom:    '1px solid var(--color-border)',
        }}
      />
      {/* Body skeleton */}
      <div
        className="mx-auto animate-pulse"
        style={{
          maxWidth: '1200px',
          padding:  'var(--space-6)',
          display:  'grid',
          gap:      'var(--space-6)',
          gridTemplateColumns: '240px 1fr 280px',
        }}
      >
        {/* Left sidebar */}
        <div
          className="rounded-xl hidden desktop:block"
          style={{ height: '400px', backgroundColor: 'var(--color-bg-secondary)' }}
        />
        {/* Feed */}
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl"
              style={{ height: '180px', backgroundColor: 'var(--color-bg-secondary)' }}
            />
          ))}
        </div>
        {/* Right sidebar */}
        <div
          className="rounded-xl hidden desktop:block"
          style={{ height: '400px', backgroundColor: 'var(--color-bg-secondary)' }}
        />
      </div>
    </div>
  );
}

function LandingSkeleton() {
  return (
    <div
      className="min-h-screen animate-pulse"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
      aria-busy="true"
      aria-label="Loading"
    >
      {/* Navbar */}
      <div
        style={{
          height:          '64px',
          backgroundColor: 'var(--color-bg-primary)',
          borderBottom:    '1px solid var(--color-border)',
        }}
      />
      {/* Hero */}
      <div
        style={{
          height:          '100vh',
          backgroundColor: 'var(--color-bg-secondary)',
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Auth-resolving skeleton (shown while loading=true)
// ─────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="rounded-lg animate-pulse"
          style={{
            width:           '48px',
            height:          '48px',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        />
        <div
          className="rounded animate-pulse"
          style={{
            width:           '120px',
            height:          '14px',
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

export default function HomePage() {
  const user    = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  // Auth still resolving — show neutral skeleton
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Authenticated → social feed
  if (user) {
    return (
      <Suspense fallback={<AuthSkeleton />}>
        <HomeFeed />
      </Suspense>
    );
  }

  // Unauthenticated → marketing landing
  return (
    <Suspense fallback={<LandingSkeleton />}>
      <LandingPage />
    </Suspense>
  );
}
