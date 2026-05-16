'use client';

/**
 * app/login/phone/page.tsx
 * Phone-number login page.
 * Spec ref: section 4.1 (Phone Auth — login flow)
 *
 * Flow:
 *   1. User enters phone number → OTP sent
 *   2. User enters OTP → verified
 *   3. Fetch/create Firestore user doc, update auth store, POST session, redirect /home
 */

import { useRouter }              from 'next/navigation';
import Link                       from 'next/link';
import { ArrowLeft }              from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserCredential }         from 'firebase/auth';
import { db }                     from '@/services/firebase';
import { useAuthStore }           from '@/store/authStore';
import PublicLayout               from '@/components/layouts/PublicLayout';
import PhoneVerification          from '@/components/auth/PhoneVerification';
import type { User }              from '@/types';

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function PhoneLoginPage() {
  const router  = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  // ── Handle verified credential ──────────────
  async function handleVerified(credential: UserCredential) {
    const { user: firebaseUser } = credential;
    const uid = firebaseUser.uid;

    // Fetch or create the Firestore user document
    const userRef  = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    let appUser: User;

    if (userSnap.exists()) {
      appUser = userSnap.data() as User;
    } else {
      // New user — create a minimal doc
      const newUser: User = {
        uid,
        name:          firebaseUser.displayName ?? '',
        email:         firebaseUser.email ?? '',
        phone:         firebaseUser.phoneNumber ?? '',
        role:          'buyer',
        createdAt:     serverTimestamp() as never,
        emailVerified: firebaseUser.emailVerified,
        active:        true,
      };
      await setDoc(userRef, newUser);
      appUser = newUser;
    }

    // Update auth store
    setUser(appUser);

    // Establish server-side session cookie
    try {
      const idToken = await firebaseUser.getIdToken();
      await fetch('/api/session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ idToken }),
      });
    } catch {
      // Session cookie failure is non-fatal — client auth is still valid
    }

    router.replace('/home');
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <PublicLayout>
      <main
        style={{
          minHeight:      '100vh',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        'var(--space-4, 16px)',
          background:     'var(--color-background, #f9fafb)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Back to login */}
          <Link
            href="/login"
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          6,
              fontSize:     '14px',
              color:        'var(--color-text-secondary, #6b7280)',
              textDecoration: 'none',
              marginBottom: 24,
              transition:   'opacity 0.15s',
            }}
          >
            <ArrowLeft size={16} />
            Back to Sign In
          </Link>

          {/* Card */}
          <div
            style={{
              background:   'var(--color-surface, #fff)',
              border:       '1px solid var(--color-border, #e5e7eb)',
              borderRadius: 'var(--radius-xl, 16px)',
              padding:      'var(--space-6, 32px) var(--space-5, 24px)',
            }}
          >
            <PhoneVerification
              mode="login"
              onVerified={handleVerified}
            />
          </div>
        </div>
      </main>
    </PublicLayout>
  );
}
