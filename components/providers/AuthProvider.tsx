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

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/store/uiStore';
import { useFCM } from '@/hooks/useFCM';
import { useAuthStore } from '@/store/authStore';

// ─────────────────────────────────────────────
// FCMRegistrar — mounts only when authenticated
// AND only after the page has been interactive for a moment.
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

  // Defer FCM registration so it doesn't block first paint.
  // FCM init involves service-worker registration + permission checks +
  // a Firestore write — none of which need to happen during the critical
  // render path. We wait for idle (or a 2.5 s timeout) before mounting.
  const [shouldInitFCM, setShouldInitFCM] = useState(false);

  useEffect(() => {
    if (!uid) {
      setShouldInitFCM(false);
      return;
    }

    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?:  (id: number) => void;
    };
    const w = typeof window !== 'undefined' ? (window as IdleWindow) : null;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId:    number | null = null;

    if (w?.requestIdleCallback) {
      idleId = w.requestIdleCallback(() => setShouldInitFCM(true), { timeout: 3000 });
    } else {
      timeoutId = setTimeout(() => setShouldInitFCM(true), 2500);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (idleId !== null && w?.cancelIdleCallback) w.cancelIdleCallback(idleId);
    };
  }, [uid]);

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
      {/* Register FCM push token once the user is signed in AND the page is idle */}
      {uid && shouldInitFCM && <FCMRegistrar />}
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
