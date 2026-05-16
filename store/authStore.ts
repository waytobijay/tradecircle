/**
 * store/authStore.ts
 * Global authentication state via Zustand.
 * Spec ref: section 4.1 (Authentication Flows)
 *
 * Usage:
 *   const { user, role, loading } = useAuthStore()
 *   const setUser = useAuthStore((s) => s.setUser)
 *
 * This store holds the resolved Firestore user document, not the raw
 * Firebase Auth user. The useAuth hook is responsible for listening to
 * Firebase Auth state and populating this store.
 */

import { create } from 'zustand';
import type { User, UserRole } from '@/types';

// ─────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────

interface AuthState {
  /** Full Firestore user document. Null when unauthenticated. */
  user: User | null;

  /** Shortcut to user.role — avoids optional chaining everywhere. */
  role: UserRole | null;

  /**
   * True while Firebase Auth is resolving the initial session.
   * Use this to show skeleton loaders on protected pages instead of
   * flashing the login screen on refresh.
   * Spec ref: section 9.6 (skeleton loaders)
   */
  loading: boolean;
}

// ─────────────────────────────────────────────
// Actions shape
// ─────────────────────────────────────────────

interface AuthActions {
  /** Set the resolved Firestore user document and derive role. */
  setUser: (user: User | null) => void;

  /** Override role independently (e.g. after a role-switch flow). */
  setRole: (role: UserRole | null) => void;

  /** Toggle the loading flag (set true on app init, false once resolved). */
  setLoading: (loading: boolean) => void;

  /** Reset all auth state — called on sign-out. */
  clearAuth: () => void;
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  // ── Initial state ──────────────────────────
  user:    null,
  role:    null,
  loading: true, // true until Firebase resolves the first auth state event

  // ── Actions ────────────────────────────────

  setUser: (user) =>
    set({
      user,
      role: user?.role ?? null,
    }),

  setRole: (role) =>
    set({ role }),

  setLoading: (loading) =>
    set({ loading }),

  clearAuth: () =>
    set({
      user:    null,
      role:    null,
      loading: false,
    }),
}));
