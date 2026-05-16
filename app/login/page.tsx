/**
 * app/login/page.tsx
 * Login page — email/password + Google OAuth.
 * Spec ref: section 4.1 (Login Page)
 *
 * After successful login, redirects based on role:
 *   buyer | seller | advisor → /home
 *   adminUsers collection   → /admin/dashboard
 *   ?next= query param      → back to the page that triggered the redirect
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Phone } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithEmail, signInWithGoogle, sendPasswordReset } from '@/services/auth';
import { db } from '@/services/firebase';
import type { UserRole } from '@/types';

// ─────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
});

const forgotSchema = z.object({
  resetEmail: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

type LoginFormData   = z.infer<typeof loginSchema>;
type ForgotFormData  = z.infer<typeof forgotSchema>;

// ─────────────────────────────────────────────
// Role-based redirect resolver
// ─────────────────────────────────────────────

async function resolveRedirectPath(uid: string, next: string | null): Promise<string> {
  if (next && next.startsWith('/') && !next.startsWith('/login')) {
    return next;
  }

  // Admin check first
  const adminSnap = await getDoc(doc(db, 'adminUsers', uid));
  if (adminSnap.exists() && adminSnap.data()?.active === true) {
    return '/admin/dashboard';
  }

  // Regular user role
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (userSnap.exists()) {
    const role = userSnap.data()?.role as UserRole;
    if (role === 'buyer' || role === 'seller' || role === 'advisor') {
      return '/home';
    }
  }

  return '/home';
}

// ─────────────────────────────────────────────
// Google icon SVG
// ─────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Forgot password modal
// ─────────────────────────────────────────────

interface ForgotModalProps {
  onClose: () => void;
}

function ForgotPasswordModal({ onClose }: ForgotModalProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormData>({ resolver: zodResolver(forgotSchema) });

  async function onSubmit(data: ForgotFormData) {
    setStatus('loading');
    setServerError('');
    try {
      await sendPasswordReset(data.resetEmail);
      setStatus('success');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('idle');
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-base"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div
        className="w-full max-w-sm rounded-md p-lg shadow-lg"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <h2
          id="forgot-title"
          className="font-display font-semibold text-xl mb-xs"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Reset your password
        </h2>
        <p
          className="text-sm mb-md"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {status === 'success' ? (
          <div className="text-center py-md">
            <p
              className="font-medium"
              style={{ color: 'var(--color-success)' }}
            >
              Check your email!
            </p>
            <p
              className="text-sm mt-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              A password reset link has been sent if that address is registered.
            </p>
            <button
              onClick={onClose}
              className="mt-md w-full py-xs rounded-md font-medium text-sm transition-opacity hover:opacity-80"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="mb-sm">
              <label
                htmlFor="resetEmail"
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Email address
              </label>
              <input
                id="resetEmail"
                type="email"
                autoComplete="email"
                placeholder="e.g. you@example.com"
                {...register('resetEmail')}
                className="w-full px-base py-xs rounded-md text-sm transition-colors"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  border: `1px solid ${errors.resetEmail ? 'var(--color-danger)' : 'var(--color-border)'}`,
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                }}
              />
              {errors.resetEmail && (
                <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>
                  {errors.resetEmail.message}
                </p>
              )}
              {serverError && (
                <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>
                  {serverError}
                </p>
              )}
            </div>

            <div className="flex gap-xs mt-md">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-xs rounded-md text-sm font-medium transition-opacity hover:opacity-80"
                style={{
                  border: '1.5px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'transparent',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="flex-1 py-xs rounded-md text-sm font-medium flex items-center justify-center gap-1 transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                }}
              >
                {status === 'loading' && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                Send link
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Inner form — uses useSearchParams (must be inside Suspense)
// ─────────────────────────────────────────────

function LoginForm() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const nextPath      = searchParams.get('next');

  const [showPassword, setShowPassword]   = useState(false);
  const [forgotOpen, setForgotOpen]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [serverError, setServerError]     = useState('');
  const [setupNeeded, setSetupNeeded]     = useState(false);

  // Probe whether first-time admin setup is still pending.
  // Hides the bootstrap link once the first super-admin has been created.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/setup-check', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { setupComplete?: boolean } | null) => {
        if (cancelled || !data) return;
        if (data.setupComplete === false) setSetupNeeded(true);
      })
      .catch(() => { /* silent — link just stays hidden */ });
    return () => { cancelled = true; };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  // ── Email/password submit ──────────────────
  async function onSubmit(data: LoginFormData) {
    setServerError('');
    try {
      const { user } = await signInWithEmail(data.email, data.password);
      const path = await resolveRedirectPath(user.uid, nextPath);
      router.replace(path);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    }
  }

  // ── Google sign-in ─────────────────────────
  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setServerError('');
    try {
      const { user } = await signInWithGoogle();
      const path = await resolveRedirectPath(user.uid, nextPath);
      router.replace(path);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Google sign in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    backgroundColor: 'var(--color-bg-tertiary)',
    border: `1px solid ${hasError ? 'var(--color-danger)' : 'var(--color-border)'}`,
    color: 'var(--color-text-primary)',
    outline: 'none',
    width: '100%',
    padding: '10px var(--space-4)',
    borderRadius: 'var(--radius-md)',
    fontSize: '14px',
    transition: 'border-color 0.15s',
  });

  return (
    <>
      <main
        className="min-h-screen flex items-center justify-center p-base"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
      >
        <div className="w-full max-w-md">
          {/* Card */}
          <div
            className="w-full rounded-md p-lg tablet:p-8 tablet:shadow-md"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
            }}
          >
            {/* Header */}
            <div className="mb-lg text-center">
              <h1
                className="font-display font-bold text-3xl mb-xs"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Welcome back
              </h1>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Sign in to your TradeCircle account
              </p>
            </div>

            {/* Google button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || isSubmitting}
              className="w-full flex items-center justify-center gap-sm py-xs rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed mb-md"
              style={{
                border: '1.5px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
              }}
            >
              {googleLoading
                ? <Loader2 size={18} className="animate-spin" />
                : <GoogleIcon />
              }
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-sm mb-md">
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
              <span className="text-xs font-medium px-xs" style={{ color: 'var(--color-text-secondary)' }}>
                or
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
            </div>

            {/* Email/password form */}
            <form onSubmit={handleSubmit(onSubmit)} noValidate>

              {/* Global server error */}
              {serverError && (
                <div
                  className="mb-sm text-sm px-base py-xs rounded-md"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                    border: '1px solid var(--color-danger)',
                    color: 'var(--color-danger)',
                  }}
                  role="alert"
                >
                  {serverError}
                </div>
              )}

              {/* Email field */}
              <div className="mb-sm">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="e.g. you@example.com"
                  {...register('email')}
                  style={inputStyle(!!errors.email)}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
                {errors.email && (
                  <p
                    id="email-error"
                    className="mt-1 text-xs"
                    style={{ color: 'var(--color-danger)' }}
                    role="alert"
                  >
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password field */}
              <div className="mb-xs">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Your password"
                    {...register('password')}
                    style={{
                      ...inputStyle(!!errors.password),
                      paddingRight: '44px',
                    }}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                    style={{ color: 'var(--color-text-secondary)' }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword
                      ? <EyeOff size={16} />
                      : <Eye size={16} />
                    }
                  </button>
                </div>
                {errors.password && (
                  <p
                    id="password-error"
                    className="mt-1 text-xs"
                    style={{ color: 'var(--color-danger)' }}
                    role="alert"
                  >
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Forgot password */}
              <div className="flex justify-end mb-md">
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-xs transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting || googleLoading}
                className="w-full flex items-center justify-center gap-xs py-xs rounded-pill font-medium text-sm transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  padding: '12px',
                }}
              >
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isSubmitting ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            {/* Divider — phone */}
            <div className="flex items-center gap-sm mt-md mb-sm">
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
              <span className="text-xs font-medium px-xs" style={{ color: 'var(--color-text-secondary)' }}>
                or
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
            </div>

            {/* Continue with Phone */}
            <Link
              href="/login/phone"
              className="w-full flex items-center justify-center gap-sm py-xs rounded-md text-sm font-medium transition-opacity hover:opacity-80"
              style={{
                border:          '1.5px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-primary)',
                color:           'var(--color-text-primary)',
                padding:         '10px',
                textDecoration:  'none',
              }}
            >
              <Phone size={18} />
              Continue with Phone
            </Link>

            {/* Sign up link */}
            <p
              className="mt-lg text-sm text-center"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              New here?{' '}
              <Link
                href="/signup"
                className="font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--color-primary)' }}
              >
                Sign Up
              </Link>
            </p>

            {/* First-time setup bootstrap — only visible when no super-admin exists */}
            {setupNeeded && (
              <p
                className="mt-xs text-center"
                style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}
              >
                <Link
                  href="/setup"
                  className="transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  First time setup? →
                </Link>
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Forgot password modal */}
      {forgotOpen && (
        <ForgotPasswordModal onClose={() => setForgotOpen(false)} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// Page export — wraps LoginForm in Suspense
// required because useSearchParams() suspends in App Router
// ─────────────────────────────────────────────

function LoginPageSkeleton() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-base"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      <div
        className="w-full max-w-md rounded-md p-lg space-y-sm"
        style={{ border: '1px solid var(--color-border)' }}
      >
        <div className="h-8 w-1/2 mx-auto rounded-md bg-bg-secondary animate-pulse" />
        <div className="h-4 w-2/3 mx-auto rounded-md bg-bg-secondary animate-pulse" />
        <div className="h-10 w-full rounded-md bg-bg-secondary animate-pulse mt-md" />
        <div className="h-px w-full bg-bg-secondary" />
        <div className="h-10 w-full rounded-md bg-bg-secondary animate-pulse" />
        <div className="h-10 w-full rounded-md bg-bg-secondary animate-pulse" />
        <div className="h-10 w-full rounded-pill bg-bg-secondary animate-pulse" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
