/**
 * app/setup/page.tsx
 * First-time admin setup — creates the bootstrap super-admin account.
 *
 * Access rules:
 *   - Page is publicly reachable (no auth cookie required).
 *   - If ANY adminUsers doc with role='super-admin' already exists, the page
 *     redirects to /login?message=setup-complete to lock further setup.
 *
 * Flow:
 *   1. createUserWithEmailAndPassword(auth, email, password)
 *   2. updateProfile(user, { displayName: name })
 *   3. Write adminUsers/{uid} with role='super-admin', all 13 permissions=true
 *   4. POST /api/session with idToken to mint admin session cookies
 *   5. Redirect to /admin/dashboard?welcome=true
 *
 * Spec ref: section 6.7 (Admin Portal — first-run bootstrap)
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';

import { auth, db } from '@/services/firebase';
import type { AdminPermissions } from '@/types';

// ─── Constants ──────────────────────────────────────────────────────────────

const ALL_PERMISSIONS: AdminPermissions = {
  users:          true,
  products:       true,
  config:         true,
  exports:        true,
  analytics:      true,
  backup:         true,
  advisories:     true,
  enquiries:      true,
  orders:         true,
  ads:            true,
  aiSettings:     true,
  cms:            true,
  featureToggles: true,
};

// ─── Validation ─────────────────────────────────────────────────────────────

interface FormErrors {
  name?:            string;
  email?:           string;
  password?:        string;
  confirmPassword?: string;
}

function validate(values: {
  name:            string;
  email:           string;
  password:        string;
  confirmPassword: string;
}): FormErrors {
  const errs: FormErrors = {};

  if (!values.name.trim()) {
    errs.name = 'Full name is required.';
  } else if (values.name.trim().length < 2) {
    errs.name = 'Full name must be at least 2 characters.';
  }

  if (!values.email.trim()) {
    errs.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errs.email = 'Please enter a valid email address.';
  }

  if (!values.password) {
    errs.password = 'Password is required.';
  } else if (values.password.length < 8) {
    errs.password = 'Password must be at least 8 characters.';
  } else if (!/[A-Z]/.test(values.password)) {
    errs.password = 'Password must contain at least one uppercase letter.';
  } else if (!/[0-9]/.test(values.password)) {
    errs.password = 'Password must contain at least one number.';
  }

  if (!values.confirmPassword) {
    errs.confirmPassword = 'Please confirm your password.';
  } else if (values.confirmPassword !== values.password) {
    errs.confirmPassword = 'Passwords do not match.';
  }

  return errs;
}

// ─── Page ───────────────────────────────────────────────────────────────────

type Phase = 'checking' | 'ready' | 'submitting' | 'redirecting';

export default function SetupPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('checking');
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [values, setValues] = useState({
    name:            '',
    email:           '',
    password:        '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // ── On mount: check whether setup has already completed ────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'adminUsers'),
            where('role', '==', 'super-admin'),
            limit(1),
          ),
        );
        if (cancelled) return;
        if (!snap.empty) {
          router.replace('/login?message=setup-complete');
          return;
        }
        setPhase('ready');
      } catch (err) {
        console.error('[setup] adminUsers check failed:', err);
        if (cancelled) return;
        // Allow setup to proceed on read failure — better than soft-locking.
        setPhase('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // ── Submit ─────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');

    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setPhase('submitting');

    try {
      // Defensive double-check right before write to defeat race conditions.
      const racingSnap = await getDocs(
        query(
          collection(db, 'adminUsers'),
          where('role', '==', 'super-admin'),
          limit(1),
        ),
      );
      if (!racingSnap.empty) {
        router.replace('/login?message=setup-complete');
        return;
      }

      // 1. Create Firebase Auth user
      const credential = await createUserWithEmailAndPassword(
        auth,
        values.email.trim(),
        values.password,
      );

      // 2. Set display name
      await updateProfile(credential.user, { displayName: values.name.trim() });

      // 3. Write adminUsers/{uid} document
      await setDoc(doc(db, 'adminUsers', credential.user.uid), {
        name:        values.name.trim(),
        email:       values.email.trim(),
        role:        'super-admin',
        permissions: ALL_PERMISSIONS,
        active:      true,
        createdAt:   serverTimestamp(),
      });

      // 4. Exchange ID token for session cookies
      const idToken = await credential.user.getIdToken();
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, role: 'admin', isAdmin: true }),
      });
      if (!res.ok) {
        console.warn('[setup] /api/session returned', res.status);
      }

      // 5. Redirect into the admin portal
      setPhase('redirecting');
      router.replace('/admin/dashboard?welcome=true');
    } catch (err) {
      console.error('[setup] failed:', err);
      const code = (err as { code?: string }).code;
      let msg = 'Failed to create super-admin. Please try again.';
      if (code === 'auth/email-already-in-use') {
        msg = 'That email is already registered. Use a different address or sign in.';
      } else if (code === 'auth/weak-password') {
        msg = 'Password is too weak. Use at least 8 characters with a mix of letters and numbers.';
      } else if (code === 'auth/invalid-email') {
        msg = 'That email address is invalid.';
      } else if (err instanceof Error && err.message) {
        msg = err.message;
      }
      setServerError(msg);
      setPhase('ready');
    }
  }

  // ── Styles ─────────────────────────────────────────────────────────────
  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '11px 14px',
    fontSize: 14,
    borderRadius: 10,
    background: 'var(--color-surface, var(--color-background, #fff))',
    color: 'var(--color-text, var(--color-text-primary, #111))',
    border: `1px solid ${hasError ? 'var(--color-danger)' : 'var(--color-border)'}`,
    outline: 'none',
    transition: 'border-color 0.15s',
  });

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6,
    color: 'var(--color-text-secondary)',
  };

  const errorStyle: React.CSSProperties = {
    marginTop: 6,
    fontSize: 12,
    color: 'var(--color-danger)',
  };

  // ── Render ─────────────────────────────────────────────────────────────
  if (phase === 'checking') {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, var(--color-primary) 0%, #1e3a8a 100%)',
        }}
      >
        <Loader2 size={32} className="animate-spin" style={{ color: '#fff' }} />
      </main>
    );
  }

  const submitting = phase === 'submitting' || phase === 'redirecting';

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
        background:
          'linear-gradient(135deg, var(--color-primary) 0%, #1e3a8a 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--color-background, #fff)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          padding: 32,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
              color: 'var(--color-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              margin: 0,
              marginBottom: 6,
              color: 'var(--color-text, var(--color-text-primary))',
            }}
          >
            First-Time Admin Setup
          </h1>
          <p
            style={{
              fontSize: 13,
              margin: 0,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
            }}
          >
            Create the master super-admin account for this TradeCircle instance.
          </p>
        </div>

        {/* Lock warning */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
            border: '1px solid var(--color-warning)',
            color: 'var(--color-warning)',
            fontSize: 12,
            lineHeight: 1.5,
            marginBottom: 22,
          }}
        >
          Setup is locked once the first super-admin is created. Choose your
          credentials carefully.
        </div>

        {serverError && (
          <div
            role="alert"
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
              border: '1px solid var(--color-danger)',
              color: 'var(--color-danger)',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Full Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle} htmlFor="setup-name">
              Full Name
            </label>
            <input
              id="setup-name"
              type="text"
              autoComplete="name"
              placeholder="e.g. Alex Doe"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              style={inputStyle(!!errors.name)}
              disabled={submitting}
              aria-invalid={!!errors.name}
            />
            {errors.name && <p style={errorStyle}>{errors.name}</p>}
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle} htmlFor="setup-email">
              Email Address
            </label>
            <input
              id="setup-email"
              type="email"
              autoComplete="email"
              placeholder="admin@tradecircle.com"
              value={values.email}
              onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              style={inputStyle(!!errors.email)}
              disabled={submitting}
              aria-invalid={!!errors.email}
            />
            {errors.email && <p style={errorStyle}>{errors.email}</p>}
          </div>

          {/* Password */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle} htmlFor="setup-password">
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="setup-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                value={values.password}
                onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
                style={{ ...inputStyle(!!errors.password), paddingRight: 42 }}
                disabled={submitting}
                aria-invalid={!!errors.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p style={errorStyle}>{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div style={{ marginBottom: 22 }}>
            <label style={labelStyle} htmlFor="setup-confirm">
              Confirm Password
            </label>
            <input
              id="setup-confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={values.confirmPassword}
              onChange={(e) => setValues((v) => ({ ...v, confirmPassword: e.target.value }))}
              style={inputStyle(!!errors.confirmPassword)}
              disabled={submitting}
              aria-invalid={!!errors.confirmPassword}
            />
            {errors.confirmPassword && (
              <p style={errorStyle}>{errors.confirmPassword}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--color-primary)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'opacity 0.15s',
            }}
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {phase === 'redirecting'
              ? 'Redirecting…'
              : phase === 'submitting'
                ? 'Creating super-admin…'
                : 'Create Super-Admin'}
          </button>
        </form>
      </div>
    </main>
  );
}
