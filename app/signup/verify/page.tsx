/**
 * app/signup/verify/page.tsx
 * Email verification holding page — shown immediately after sign-up.
 * Spec ref: section 4.1 (Sign Up Form — email verification)
 *
 * Receives ?email= query param from /signup/[role] after account creation.
 * Resend button has a 60-second cooldown to prevent spam.
 */

'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Loader2, CheckCircle } from 'lucide-react';
import { sendVerificationEmail } from '@/services/auth';
import { auth } from '@/services/firebase';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const COOLDOWN_SECONDS = 60;

// ─────────────────────────────────────────────
// Inner component — uses useSearchParams (must be inside Suspense)
// ─────────────────────────────────────────────

function VerifyContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const email        = searchParams.get('email') ?? '';

  const [countdown, setCountdown]   = useState(0);
  const [resendState, setResendState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auto-poll for email verification ───────
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        await currentUser.reload();
        if (currentUser.emailVerified) {
          clearInterval(pollRef.current!);
          router.replace('/home');
        }
      } catch {
        // ignore transient errors — keep polling
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [router]);

  // ── Countdown timer ────────────────────────
  useEffect(() => {
    if (countdown <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [countdown]);

  // ── Resend handler ─────────────────────────
  async function handleResend() {
    setResendState('loading');
    setErrorMessage('');
    try {
      await sendVerificationEmail();
      setResendState('sent');
      setCountdown(COOLDOWN_SECONDS);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to resend. Please try again.'
      );
      setResendState('error');
    }
  }

  const canResend = countdown === 0 && resendState !== 'loading';

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-base"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      <div
        className="w-full max-w-md rounded-md p-lg text-center"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          border:           '1px solid var(--color-border)',
        }}
      >
        {/* Icon */}
        <div
          className="mx-auto mb-md flex items-center justify-center rounded-full"
          style={{
            width:           72,
            height:          72,
            backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
          }}
        >
          <Mail
            size={34}
            strokeWidth={1.5}
            style={{ color: 'var(--color-primary)' }}
          />
        </div>

        {/* Heading */}
        <h1
          className="font-display font-bold mb-xs"
          style={{ fontSize: '26px', color: 'var(--color-text-primary)' }}
        >
          Check your inbox
        </h1>

        {/* Subtitle */}
        <p
          className="text-sm mb-xs"
          style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6' }}
        >
          We sent a verification link to
        </p>

        {/* Email display */}
        {email && (
          <p
            className="font-semibold text-sm mb-md px-base py-xs rounded-md inline-block"
            style={{
              color:           'var(--color-text-primary)',
              backgroundColor: 'var(--color-bg-tertiary)',
              wordBreak:       'break-all',
            }}
          >
            {email}
          </p>
        )}

        <p
          className="text-sm mb-lg"
          style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6' }}
        >
          Click the link in the email to activate your account. If you don&apos;t
          see it, check your spam folder.
        </p>

        {/* Sent confirmation */}
        {resendState === 'sent' && (
          <div
            className="flex items-center justify-center gap-xs text-sm mb-sm"
            style={{ color: 'var(--color-success)' }}
            role="status"
          >
            <CheckCircle size={15} />
            Verification email resent!
          </div>
        )}

        {/* Error */}
        {resendState === 'error' && errorMessage && (
          <p
            className="text-sm mb-sm"
            style={{ color: 'var(--color-danger)' }}
            role="alert"
          >
            {errorMessage}
          </p>
        )}

        {/* Resend button */}
        <button
          type="button"
          onClick={handleResend}
          disabled={!canResend}
          className="w-full flex items-center justify-center gap-xs font-medium text-sm rounded-md transition-opacity disabled:cursor-not-allowed"
          style={{
            padding:         '11px var(--space-4)',
            backgroundColor: canResend
              ? 'var(--color-primary)'
              : 'var(--color-bg-tertiary)',
            color: canResend
              ? '#ffffff'
              : 'var(--color-text-secondary)',
            opacity: !canResend && resendState !== 'loading' ? 0.7 : 1,
            border:  canResend
              ? 'none'
              : '1px solid var(--color-border)',
          }}
          aria-live="polite"
        >
          {resendState === 'loading' && (
            <Loader2 size={15} className="animate-spin" />
          )}
          {resendState === 'loading' && 'Sending…'}
          {resendState !== 'loading' && countdown > 0 && `Resend in ${countdown}s`}
          {resendState !== 'loading' && countdown === 0 && 'Resend verification email'}
        </button>

        {/* Divider */}
        <div
          className="my-md h-px w-full"
          style={{ backgroundColor: 'var(--color-border)' }}
        />

        {/* Back to login */}
        <Link
          href="/login"
          className="text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-primary)' }}
        >
          ← Back to Sign In
        </Link>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────
// Skeleton — shown while Suspense resolves
// ─────────────────────────────────────────────

function VerifySkeleton() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-base"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      <div
        className="w-full max-w-md rounded-md p-lg flex flex-col items-center gap-sm"
        style={{ border: '1px solid var(--color-border)' }}
      >
        <div className="w-16 h-16 rounded-full bg-bg-secondary animate-pulse" />
        <div className="h-7 w-2/3 rounded-md bg-bg-secondary animate-pulse" />
        <div className="h-4 w-full rounded-md bg-bg-secondary animate-pulse" />
        <div className="h-4 w-1/2 rounded-md bg-bg-secondary animate-pulse" />
        <div className="h-10 w-full rounded-md bg-bg-secondary animate-pulse mt-xs" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page export
// ─────────────────────────────────────────────

export default function VerifyPage() {
  return (
    <Suspense fallback={<VerifySkeleton />}>
      <VerifyContent />
    </Suspense>
  );
}
