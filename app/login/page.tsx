/**
 * app/login/page.tsx
 * Login page — email/password + Google OAuth + Phone link.
 * Spec ref: section 4.1 (Login Page)
 *
 * Visual: modern glassmorphism — frosted card sits on top of a cinematic
 * blurred CMS-managed media background (see <MediaBackground>).
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
import { MediaBackground } from '@/components/ui/MediaBackground';
import { useMediaBackground } from '@/hooks/useMediaBackground';

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

  const adminSnap = await getDoc(doc(db, 'adminUsers', uid));
  if (adminSnap.exists() && adminSnap.data()?.active === true) {
    return '/admin/dashboard';
  }

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
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Shared style helpers — modern inputs / buttons
// ─────────────────────────────────────────────

const GLASS_CARD: React.CSSProperties = {
  background:       'rgba(255,255,255,0.85)',
  backdropFilter:   'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  border:           '1px solid rgba(255,255,255,0.18)',
  boxShadow:        '0 20px 60px rgba(0,0,0,0.3)',
  borderRadius:     20,
};

function modernInputStyle(hasError: boolean, focused = false): React.CSSProperties {
  return {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 14,
    fontSize: 14,
    background: '#ffffff',
    border: `1px solid ${hasError ? '#ef4444' : focused ? 'var(--color-primary)' : '#e5e7eb'}`,
    color: '#0f172a',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxShadow: focused ? '0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent)' : 'none',
  };
}

// ─────────────────────────────────────────────
// Forgot password modal
// ─────────────────────────────────────────────

interface ForgotModalProps { onClose: () => void; }

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
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ ...GLASS_CARD, width: '100%', maxWidth: 400, padding: 28 }}>
        <h2
          id="forgot-title"
          style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#0f172a' }}
        >
          Reset your password
        </h2>
        <p style={{ margin: '6px 0 18px', fontSize: 13, color: '#475569' }}>
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-success)' }}>Check your email!</p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#475569' }}>
              A password reset link has been sent if that address is registered.
            </p>
            <button
              onClick={onClose}
              style={{
                marginTop: 18, width: '100%', padding: 12, borderRadius: 14,
                background: 'linear-gradient(135deg, var(--color-primary), #1e3a8a)',
                color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <label htmlFor="resetEmail" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#0f172a', marginBottom: 6 }}>
              Email address
            </label>
            <input
              id="resetEmail"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register('resetEmail')}
              style={modernInputStyle(!!errors.resetEmail)}
            />
            {errors.resetEmail && (
              <p style={{ marginTop: 6, fontSize: 12, color: '#ef4444' }}>{errors.resetEmail.message}</p>
            )}
            {serverError && (
              <p style={{ marginTop: 6, fontSize: 12, color: '#ef4444' }}>{serverError}</p>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1, padding: 12, borderRadius: 14, fontSize: 14, fontWeight: 500,
                  background: 'transparent', color: '#475569',
                  border: '1.5px solid #e5e7eb', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === 'loading'}
                style={{
                  flex: 1, padding: 12, borderRadius: 14, fontSize: 14, fontWeight: 600,
                  background: 'linear-gradient(135deg, var(--color-primary), #1e3a8a)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: status === 'loading' ? 0.6 : 1,
                }}
              >
                {status === 'loading' && <Loader2 size={14} className="animate-spin" />}
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
// Inner form
// ─────────────────────────────────────────────

function LoginForm() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const nextPath      = searchParams.get('next');
  const { slides, blurPx, intervalSec } = useMediaBackground();

  const [showPassword,  setShowPassword]  = useState(false);
  const [forgotOpen,    setForgotOpen]    = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [serverError,   setServerError]   = useState('');
  const [setupNeeded,   setSetupNeeded]   = useState(false);
  const [localMode,     setLocalMode]     = useState(false);
  const [emailFocused,    setEmailFocused]    = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [primaryHover,    setPrimaryHover]    = useState(false);

  // Probe setup-check on mount — drives "first-time setup" link visibility +
  // local-bootstrap auth path on submit.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/setup-check', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { setupComplete?: boolean; firebaseConfigured?: boolean } | null) => {
        if (cancelled || !data) return;
        if (data.setupComplete === false) setSetupNeeded(true);
        if (data.firebaseConfigured === false) setLocalMode(true);
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  // ── Email/password submit ──────────────────
  async function tryLocalAuth(email: string, password: string): Promise<boolean> {
    const res = await fetch('/api/local-auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const text = await res.text();
    let payload: { ok?: boolean; error?: string; redirect?: string } = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { /* non-JSON */ }
    if (payload.ok) {
      router.replace(payload.redirect || '/admin/dashboard');
      return true;
    }
    if (payload.error === 'invalid_credentials') {
      setServerError('Invalid email or password.');
      return true; // handled
    }
    return false; // no local admin / other error — caller should fall through
  }

  async function onSubmit(data: LoginFormData) {
    setServerError('');
    try {
      // Local-bootstrap path — used when Firebase isn't configured.
      if (localMode) {
        const handled = await tryLocalAuth(data.email, data.password);
        if (!handled) setServerError('No local admin exists. Visit /setup first.');
        return;
      }

      // Firebase path with local-admin fallback for bootstrap accounts
      // that were created before Firebase was configured.
      try {
        const { user } = await signInWithEmail(data.email, data.password);
        const path = await resolveRedirectPath(user.uid, nextPath);
        router.replace(path);
      } catch (firebaseErr) {
        // If Firebase rejects (user not found / wrong password), try the
        // local bootstrap admin before surfacing the error. This lets the
        // first super-admin sign in even when their account hasn't been
        // migrated to Firebase yet.
        const handled = await tryLocalAuth(data.email, data.password);
        if (!handled) {
          throw firebaseErr; // fall through to outer catch with original Firebase error
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed. Please try again.';
      // Friendly Firebase error mapping
      const friendly =
        msg.includes('auth/user-not-found')      ? 'No account found with this email.' :
        msg.includes('auth/wrong-password')      ? 'Incorrect password.' :
        msg.includes('auth/invalid-credential')  ? 'Invalid email or password.' :
        msg.includes('auth/too-many-requests')   ? 'Too many attempts. Try again later.' :
        msg.includes('auth/network-request-failed') ? 'Network error. Check your connection.' :
        msg;
      setServerError(friendly);
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

  return (
    <>
      {/* Blurred cinematic background */}
      <MediaBackground slides={slides} blurPx={blurPx} overlayOpacity={0.6} intervalSec={intervalSec} />

      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          position: 'relative',
        }}
      >
        <div style={{ width: '100%', maxWidth: 440 }}>
          {/* Glass card */}
          <div style={{ ...GLASS_CARD, padding: 40 }}>

            {/* Local-bootstrap warning — small, top of card */}
            {localMode && (
              <div
                role="status"
                style={{
                  padding: '8px 12px', borderRadius: 10,
                  background: 'color-mix(in srgb, var(--color-warning) 14%, transparent)',
                  border: '1px solid var(--color-warning)',
                  color: 'var(--color-warning)',
                  fontSize: 11, lineHeight: 1.5,
                  marginBottom: 18, textAlign: 'center', fontWeight: 500,
                }}
              >
                Running in local mode. Firebase not yet configured.
              </div>
            )}

            {/* Wordmark */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h1
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-display, Sora), system-ui',
                  fontSize: 28, fontWeight: 700,
                  color: 'var(--color-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                TradeCircle
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#475569' }}>
                Welcome back. Sign in to continue.
              </p>
            </div>

            {/* Email/password form */}
            <form onSubmit={handleSubmit(onSubmit)} noValidate>

              {/* Global server error */}
              {serverError && (
                <div
                  role="alert"
                  style={{
                    marginBottom: 14, padding: '10px 14px', borderRadius: 12,
                    background: 'color-mix(in srgb, #ef4444 10%, transparent)',
                    border: '1px solid #ef4444', color: '#b91c1c', fontSize: 13,
                  }}
                >
                  {serverError}
                </div>
              )}

              {/* Email field */}
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="email" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#0f172a', marginBottom: 6 }}>
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...register('email')}
                  onFocus={() => setEmailFocused(true)}
                  onBlurCapture={() => setEmailFocused(false)}
                  style={modernInputStyle(!!errors.email, emailFocused)}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
                {errors.email && (
                  <p id="email-error" role="alert" style={{ marginTop: 6, fontSize: 12, color: '#ef4444' }}>
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password field */}
              <div style={{ marginBottom: 6 }}>
                <label htmlFor="password" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#0f172a', marginBottom: 6 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Your password"
                    {...register('password')}
                    onFocus={() => setPasswordFocused(true)}
                    onBlurCapture={() => setPasswordFocused(false)}
                    style={{ ...modernInputStyle(!!errors.password, passwordFocused), paddingRight: 44 }}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#64748b', padding: 4, display: 'flex',
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" role="alert" style={{ marginTop: 6, fontSize: 12, color: '#ef4444' }}>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Forgot password */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: 'var(--color-primary)', fontWeight: 500,
                  }}
                >
                  Forgot password?
                </button>
              </div>

              {/* Primary submit — gradient + slight hover scale */}
              <button
                type="submit"
                disabled={isSubmitting || googleLoading}
                onMouseEnter={() => setPrimaryHover(true)}
                onMouseLeave={() => setPrimaryHover(false)}
                style={{
                  width: '100%', padding: 14, borderRadius: 14,
                  background: 'linear-gradient(135deg, var(--color-primary), #1e3a8a)',
                  color: '#fff', border: 'none', fontWeight: 600, fontSize: 14,
                  cursor: isSubmitting ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'transform 0.15s ease, box-shadow 0.2s ease',
                  transform: primaryHover && !isSubmitting ? 'scale(1.02)' : 'scale(1)',
                  boxShadow: primaryHover
                    ? '0 10px 30px rgba(30,58,138,0.35)'
                    : '0 4px 12px rgba(30,58,138,0.22)',
                  opacity: isSubmitting || googleLoading ? 0.7 : 1,
                }}
              >
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isSubmitting ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                or continue with
              </span>
              <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
            </div>

            {/* Google button — outlined */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || isSubmitting || localMode}
              title={localMode ? 'Configure Firebase first to enable Google sign-in.' : undefined}
              style={{
                width: '100%', padding: 12, borderRadius: 14,
                background: '#fff', color: '#0f172a',
                border: '1.5px solid #e5e7eb',
                fontWeight: 500, fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                marginBottom: 10,
                opacity: googleLoading || isSubmitting || localMode ? 0.55 : 1,
              }}
            >
              {googleLoading ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}
              Google
            </button>

            {/* Phone link */}
            <Link
              href="/login/phone"
              style={{
                width: '100%', padding: 12, borderRadius: 14,
                background: '#fff', color: '#0f172a',
                border: '1.5px solid #e5e7eb',
                fontWeight: 500, fontSize: 14, textDecoration: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <Phone size={18} />
              Continue with Phone
            </Link>

            {/* Sign up link */}
            <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#475569' }}>
              New here?{' '}
              <Link href="/signup" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
                Sign up →
              </Link>
            </p>

            {/* First-time setup bootstrap — only visible when no super-admin exists */}
            {setupNeeded && (
              <p style={{ marginTop: 8, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                <Link href="/setup" style={{ color: '#64748b', textDecoration: 'none' }}>
                  First time setup? →
                </Link>
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Forgot password modal */}
      {forgotOpen && <ForgotPasswordModal onClose={() => setForgotOpen(false)} />}
    </>
  );
}

// ─────────────────────────────────────────────
// Suspense wrapper (App Router useSearchParams)
// ─────────────────────────────────────────────

function LoginPageSkeleton() {
  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #312e81 100%)',
      }}
    >
      <div style={{ ...GLASS_CARD, width: '100%', maxWidth: 440, padding: 40 }}>
        <div style={{ height: 32, width: '55%', margin: '0 auto 10px', borderRadius: 8, background: '#e5e7eb' }} className="animate-pulse" />
        <div style={{ height: 14, width: '70%', margin: '0 auto 28px', borderRadius: 6, background: '#e5e7eb' }} className="animate-pulse" />
        <div style={{ height: 44, borderRadius: 14, background: '#e5e7eb', marginBottom: 12 }} className="animate-pulse" />
        <div style={{ height: 44, borderRadius: 14, background: '#e5e7eb', marginBottom: 12 }} className="animate-pulse" />
        <div style={{ height: 48, borderRadius: 14, background: '#e5e7eb' }} className="animate-pulse" />
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
