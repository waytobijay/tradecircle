/**
 * hooks/useAuth.ts
 * Subscribes to Firebase Auth state and keeps authStore in sync.
 * Spec ref: section 4.1 (Authentication Flows), section 8.6 (theme sync)
 *
 * Usage:
 *   const { user, role, loading, isAdmin, isSeller } = useAuth()
 *
 * Architecture:
 *   - onAuthStateChanged fires once on mount with the persisted session.
 *   - On sign-in: fetches the Firestore users/{uid} doc → setUser in authStore
 *     → POST to /api/session with the Firebase ID token to set an HttpOnly
 *     session cookie for SSR-protected routes.
 *   - Also checks adminUsers/{uid} to resolve isAdmin.
 *   - On sign-out: clearAuth → DELETE /api/session to remove the cookie.
 *   - loading stays true until the first auth event resolves — prevents
 *     protected pages from flashing the login screen on refresh.
 */

'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import type { User, Theme } from '@/types';

// ─────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────

export interface UseAuthReturn {
  user: User | null;
  role: User['role'] | null;
  loading: boolean;
  /** True if the user has an active document in the adminUsers collection. */
  isAdmin: boolean;
  isSeller: boolean;
  isAdvisor: boolean;
  isBuyer: boolean;
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useAuth(): UseAuthReturn {
  const { user, role, loading, setUser, setLoading, clearAuth } =
    useAuthStore();
  const { setTheme } = useUiStore();

  /**
   * isAdmin lives in local state rather than the shared authStore because
   * it requires an extra Firestore read (adminUsers collection) and is only
   * needed in the hook's consumers — not across the entire app.
   */
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    // Bootstrap guard: when Firebase isn't configured (e.g. fresh Vercel
    // deploy without env vars) `auth` is null. Skip the subscription, mark
    // loading=false, and let the user reach /setup or /login to configure.
    if (!auth) {
      setLoading(false);
      setIsAdmin(false);
      return;
    }

    // Subscribe to Firebase Auth state changes.
    // The returned function unsubscribes on unmount.
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Signed out — clear all auth state and remove the session cookie.
        clearAuth();
        setIsAdmin(false);
        try {
          await fetch('/api/session', { method: 'DELETE' });
        } catch {
          // Non-fatal: cookie will expire naturally if DELETE fails.
        }
        return;
      }

      // Signed in — resolve user identity (could be regular user OR admin)
      setLoading(true);

      try {
        // 1. Resolve role first (in parallel) so we can mint the session cookie.
        //    Admins live in adminUsers/{uid} and may NOT have a users/{uid} doc.
        const [adminSnap, userSnap] = await Promise.all([
          getDoc(doc(db, 'adminUsers', firebaseUser.uid)),
          getDoc(doc(db, 'users',      firebaseUser.uid)),
        ]);

        const isAdminUser = adminSnap.exists() && adminSnap.data()?.active === true;
        setIsAdmin(isAdminUser);

        // 2. Set the session cookie with the resolved role + admin flag.
        //    /api/session validates role ∈ {buyer, seller, advisor, admin}.
        //    Without this the middleware bounces the user back to /login.
        try {
          const idToken = await firebaseUser.getIdToken();
          const resolvedRole =
            isAdminUser
              ? 'admin'
              : (userSnap.exists() ? userSnap.data().role : 'buyer');
          await fetch('/api/session', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              idToken,
              role:    resolvedRole,
              isAdmin: isAdminUser,
            }),
          });
        } catch (sessionErr) {
          console.warn('[useAuth] Failed to set session cookie:', sessionErr);
        }

        if (userSnap.exists()) {
          // Regular user — populate full user doc into authStore
          const userData = { uid: firebaseUser.uid, ...userSnap.data() } as User;
          setUser(userData);

          // Sync saved theme
          const savedTheme = userSnap.data().theme as Theme | undefined;
          if (savedTheme === 'light' || savedTheme === 'dark') {
            setTheme(savedTheme);
          }
        } else if (isAdminUser) {
          // Admin without a users/{uid} doc — synthesise a minimal user record
          // so authStore.user is non-null and downstream guards don't redirect.
          const adminData = adminSnap.data() ?? {};
          setUser({
            uid:           firebaseUser.uid,
            email:         firebaseUser.email ?? adminData.email ?? '',
            name:          firebaseUser.displayName ?? adminData.name ?? 'Admin',
            role:          'admin',           // not in UserRole but tolerated
            createdAt:     adminData.createdAt ?? null,
            emailVerified: firebaseUser.emailVerified,
            active:        true,
          } as unknown as User);
        } else {
          // Auth account exists but no user OR admin doc — race condition
          // during fresh signup. Don't clear — let the signup flow finish
          // writing the doc. Mark loading=false so UI can show something.
          console.warn('[useAuth] No users/{uid} or adminUsers/{uid} doc found for', firebaseUser.uid);
        }
      } catch (error) {
        console.error('[useAuth] Failed to resolve user session:', error);
        // Don't clearAuth on Firestore errors — could be a transient rules issue.
        // Better to let the user see SOMETHING than bounce them to /login forever.
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    user,
    role,
    loading,
    isAdmin,
    isSeller:  role === 'seller',
    isAdvisor: role === 'advisor',
    isBuyer:   role === 'buyer',
  };
}
