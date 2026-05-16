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
import { useFCM } from '@/hooks/useFCM';
import { useAuthStore } from '@/store/authStore';

// ─────────────────────────────────────────────
// FCMRegistrar — mounts only when authenticated
// Registers the FCM push token and subscribes
// to foreground messages. Renders nothing.
// ─────────────────────────────────────────────

function FCMRegistrar() {
  useFCM();
  return null;
}

// ─────────────────────────────────────────────
// Inner component — must be a child of the
// provider so hooks run inside the client tree
// ─────────────────────────────────────────────

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  // Starts onAuthStateChanged listener → writes to authStore
  useAuth();

  // Only activate FCM once the user is confirmed signed-in
  const uid = useAuthStore((s) => s.user?.uid ?? null);

  // Apply saved theme on first mount (SSR renders without data-theme;
  // this runs before first paint on the client)
  const applyTheme = useUIStore((s) => s.applyTheme);
  const theme      = useUIStore((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally once — uiStore.toggleTheme calls applyTheme internally

  return (
    <>
      {/* Register FCM push token once the user is signed in */}
      {uid && <FCMRegistrar />}
      {children}
    </>
  );
}

// ─────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthBootstrap>{children}</AuthBootstrap>;
}
