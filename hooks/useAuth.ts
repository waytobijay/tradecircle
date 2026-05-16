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

      // Signed in — resolve full Firestore user document
      setLoading(true);

      try {
        // 1. Fetch the Firestore user document
        const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));

        if (userSnap.exists()) {
          const userData = { uid: firebaseUser.uid, ...userSnap.data() } as User;
          setUser(userData);

          // 2. Sync saved theme preference to uiStore / DOM
          //    Spec ref: section 8.6 (authenticated users override OS preference)
          const savedTheme = userSnap.data().theme as Theme | undefined;
          if (savedTheme === 'light' || savedTheme === 'dark') {
            setTheme(savedTheme);
          }

          // 3. POST the Firebase ID token to /api/session to set an HttpOnly
          //    session cookie for SSR-protected routes (admin middleware, etc.).
          //    Spec ref: section 4.1 (Authentication Flows)
          try {
            const idToken = await firebaseUser.getIdToken();
            await fetch('/api/session', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ idToken }),
            });
          } catch (sessionErr) {
            // Non-fatal: SSR guards will redirect to /login, client-side auth still works.
            console.warn('[useAuth] Failed to set session cookie:', sessionErr);
          }
        } else {
          // Auth account exists but no Firestore doc yet
          // (can happen during Google sign-up race condition)
          clearAuth();
        }

        // 3. Check adminUsers collection for admin access
        //    Spec ref: section 6.7 (admin portal protection)
        const adminSnap = await getDoc(
          doc(db, 'adminUsers', firebaseUser.uid)
        );
        setIsAdmin(adminSnap.exists() && adminSnap.data()?.active === true);
      } catch (error) {
        console.error('[useAuth] Failed to resolve user session:', error);
        clearAuth();
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
