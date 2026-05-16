/**
 * app/setup/page.tsx
 * First-time admin setup — creates the BOOTSTRAP super-admin in a local file.
 *
 * This runs BEFORE Firebase is configured. The created credentials live in
 * `.tradecircle-local/config.json`; once Firebase is wired up via the
 * /admin/firebase-setup wizard, the operator can migrate the local admin
 * into the real Firebase project.
 *
 * Flow:
 *   1. POST /api/local-auth/setup  { name, email, password }
 *   2. Session cookies are set by that endpoint.
 *   3. Redirect to /admin/firebase-setup
 *
 * If a local admin already exists, /api/setup-check reports it and we
 * redirect to /login?message=setup-complete.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';

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

  // ── On mount: check whether bootstrap setup is already complete ────────
  useEffect(() => {
    let cancelled = false;
    fetch('/api/setup-check', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { setupComplete?: boolean } | null) => {
        if (cancelled) return;
        if (data?.setupComplete) {
          router.replace('/login?message=setup-complete');
          return;
        }
        setPhase('ready');
      })
      .catch(() => {
        // Allow setup to proceed on read failure — better than soft-locking.
        if (!cancelled) setPhase('ready');
      });
    return () => { cancelled = true; };
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
      const res = await fetch('/api/local-auth/setup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:     values.name.trim(),
          email:    values.email.trim(),
          password: values.password,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        if (data.error === 'already_setup') {
          router.replace('/login?message=setup-complete');
          return;
        }
        throw new Error(data.error || 'Setup failed.');
      }

      setPhase('redirecting');
      router.replace(data.redirect || '/admin/firebase-setup');
    } catch (err) {
      console.error('[setup] failed:', err);
      setServerError(
        err instanceof Error ? err.message : 'Failed to create super-admin.',
      );
      setPhase('ready');
    }
  }

  // ── Styles ─────────────────────────────────────────────────────────────
  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '11px 14px',
    fontSize: 14,
    borderRadius: 10,
    background: '#fff',
    color: '#0f172a',
    border: `1px solid ${hasError ? '#dc2626' : '#cbd5e1'}`,
    outline: 'none',
    transition: 'border-color 0.15s',
  });

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: '#334155',
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
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 6, color: '#0f172a' }}>
            First-Time Admin Setup
          </h1>
          <p style={{ fontSize: 13, margin: 0, color: '#475569', lineHeight: 1.5 }}>
            Create the master super-admin account for this TradeCircle instance.
            You&apos;ll configure Firebase right after.
          </p>
        </div>

        {/* Info */}
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
          These credentials are stored locally in <code>.tradecircle-local/config.json</code>
          {' '}until Firebase is connected. The file is git-ignored automatically.
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
            <label style={labelStyle} htmlFor="setup-name">Full Name</label>
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
            <label style={labelStyle} htmlFor="setup-email">Email Address</label>
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
            <label style={labelStyle} htmlFor="setup-password">Password</label>
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
                  color: '#64748b',
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
            <label style={labelStyle} htmlFor="setup-confirm">Confirm Password</label>
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
