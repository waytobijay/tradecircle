/**
 * components/providers/AuthProvider.tsx
 * Client-side provider that bootstraps Firebase auth state at the app root.
 *
 * Calls useAuth() once — this sets up the onAuthStateChanged listener that
 * populates authStore (user, role, loading) for the entire app.
 *
 * Also initialises uiStore theme on mount (reads localStorage / OS preference).
 */

'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/store/uiStore';

// ─────────────────────────────────────────────
// Inner component — must be a child of the
// provider so hooks run inside the client tree
// ─────────────────────────────────────────────

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  // Starts onAuthStateChanged listener → writes to authStore
  useAuth();

  // Apply saved theme on first mount (SSR renders without data-theme;
  // this runs before first paint on the client)
  const applyTheme = useUIStore((s) => s.applyTheme);
  const theme      = useUIStore((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally once — uiStore.toggleTheme calls applyTheme internally

  return <>{children}</>;
}

// ─────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthBootstrap>{children}</AuthBootstrap>;
}
