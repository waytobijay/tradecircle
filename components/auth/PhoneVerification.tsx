'use client';

/**
 * components/auth/PhoneVerification.tsx
 * Reusable OTP verification flow component.
 * Spec ref: section 4.1 (Phone Auth)
 *
 * Modes:
 *   'login' — sign in with phone number (creates/links a user session)
 *   'link'  — attach a phone number to an existing account
 */

import { useEffect, useRef, useState } from 'react';
import { Loader2, Phone, ArrowLeft } from 'lucide-react';
import { UserCredential } from 'firebase/auth';
import {
  setupRecaptcha,
  sendOTP,
  verifyOTP,
  linkPhoneToAccount,
} from '@/services/phoneAuth';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PhoneVerificationProps {
  onVerified: (credential: UserCredential) => void;
  onCancel?: () => void;
  mode: 'login' | 'link';
}

interface CountryCode {
  code: string;
  label: string;
  flag: string;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const COUNTRY_CODES: CountryCode[] = [
  { code: '+1',   label: 'US',  flag: '🇺🇸' },
  { code: '+61',  label: 'AU',  flag: '🇦🇺' },
  { code: '+977', label: 'NP',  flag: '🇳🇵' },
  { code: '+91',  label: 'IN',  flag: '🇮🇳' },
];

const OTP_COUNTDOWN = 60;

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function PhoneVerification({
  onVerified,
  onCancel,
  mode,
}: PhoneVerificationProps) {
  // ── Step state ──────────────────────────────
  const [step, setStep] = useState<'phone' | 'otp'>('phone');

  // ── Phone entry state ───────────────────────
  const [countryCode, setCountryCode] = useState<string>('+61');
  const [phoneLocal, setPhoneLocal]   = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [phoneError, setPhoneError]   = useState('');

  // ── OTP state ───────────────────────────────
  const [otpCode, setOtpCode]         = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [otpError, setOtpError]       = useState('');
  const [countdown, setCountdown]     = useState(OTP_COUNTDOWN);
  const [resendLoading, setResendLoading] = useState(false);

  // ── Refs ────────────────────────────────────
  const recaptchaRef     = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef  = useRef<ConfirmationResult | null>(null);
  const countdownRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Setup reCAPTCHA on mount ────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      recaptchaRef.current = setupRecaptcha('recaptcha-container');
    } catch {
      // reCAPTCHA setup failure is non-fatal — will surface on sendOTP
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      // Do not call .clear() on verifier here — it breaks re-renders
    };
  }, []);

  // ── Countdown timer ─────────────────────────
  function startCountdown() {
    setCountdown(OTP_COUNTDOWN);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // ── Send OTP ────────────────────────────────
  async function handleSendOTP() {
    setPhoneError('');
    const trimmed = phoneLocal.trim();
    if (!trimmed) {
      setPhoneError('Please enter your phone number.');
      return;
    }

    const fullNumber = `${countryCode}${trimmed.replace(/^0/, '')}`;

    if (!recaptchaRef.current) {
      try {
        recaptchaRef.current = setupRecaptcha('recaptcha-container');
      } catch {
        setPhoneError('reCAPTCHA failed to initialise. Please refresh and try again.');
        return;
      }
    }

    setSendLoading(true);
    try {
      const fn = mode === 'link' ? linkPhoneToAccount : sendOTP;
      confirmationRef.current = await fn(fullNumber, recaptchaRef.current);
      setStep('otp');
      startCountdown();
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : 'Failed to send OTP. Please try again.');
      // Reset reCAPTCHA so it can be re-used
      try {
        recaptchaRef.current?.clear();
        recaptchaRef.current = setupRecaptcha('recaptcha-container');
      } catch {
        // ignore reset errors
      }
    } finally {
      setSendLoading(false);
    }
  }

  // ── Resend OTP ──────────────────────────────
  async function handleResend() {
    if (countdown > 0 || resendLoading) return;
    setOtpError('');
    setOtpCode('');

    const trimmed = phoneLocal.trim();
    const fullNumber = `${countryCode}${trimmed.replace(/^0/, '')}`;

    if (!recaptchaRef.current) {
      try {
        recaptchaRef.current = setupRecaptcha('recaptcha-container');
      } catch {
        setOtpError('reCAPTCHA failed to initialise. Please refresh and try again.');
        return;
      }
    }

    setResendLoading(true);
    try {
      const fn = mode === 'link' ? linkPhoneToAccount : sendOTP;
      confirmationRef.current = await fn(fullNumber, recaptchaRef.current);
      startCountdown();
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Failed to resend OTP.');
      try {
        recaptchaRef.current?.clear();
        recaptchaRef.current = setupRecaptcha('recaptcha-container');
      } catch {
        // ignore
      }
    } finally {
      setResendLoading(false);
    }
  }

  // ── Verify OTP ──────────────────────────────
  async function handleVerify() {
    setOtpError('');
    if (!otpCode || otpCode.length < 6) {
      setOtpError('Please enter the 6-digit code.');
      return;
    }
    if (!confirmationRef.current) {
      setOtpError('Session expired. Please go back and resend the code.');
      return;
    }

    setVerifyLoading(true);
    try {
      const credential = await verifyOTP(confirmationRef.current, otpCode);
      onVerified(credential);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
    } finally {
      setVerifyLoading(false);
    }
  }

  // ── Styles ───────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width:        '100%',
    padding:      '10px var(--space-3, 12px)',
    background:   'var(--color-surface, #fff)',
    border:       '1px solid var(--color-border, #e5e7eb)',
    borderRadius: 'var(--radius-md, 8px)',
    color:        'var(--color-text, #111)',
    fontSize:     '14px',
    outline:      'none',
    boxSizing:    'border-box',
    transition:   'border-color 0.15s',
  };

  const errorInputStyle: React.CSSProperties = {
    ...inputStyle,
    border: '1px solid var(--color-danger, #ef4444)',
  };

  const btnPrimary: React.CSSProperties = {
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    width:          '100%',
    padding:        '11px 16px',
    background:     'var(--color-primary, #6366f1)',
    color:          '#fff',
    border:         'none',
    borderRadius:   'var(--radius-md, 8px)',
    fontWeight:     600,
    fontSize:       '14px',
    cursor:         'pointer',
    transition:     'opacity 0.15s',
  };

  // ─────────────────────────────────────────────
  // Render — Step 1: Phone entry
  // ─────────────────────────────────────────────

  if (step === 'phone') {
    return (
      <div style={{ width: '100%' }}>
        {/* Invisible reCAPTCHA container */}
        <div id="recaptcha-container" />

        {/* Back / cancel */}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              display:    'inline-flex',
              alignItems: 'center',
              gap:        6,
              background: 'none',
              border:     'none',
              color:      'var(--color-text-secondary, #6b7280)',
              fontSize:   '14px',
              cursor:     'pointer',
              padding:    0,
              marginBottom: 20,
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
        )}

        {/* Icon + heading */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width:           60,
              height:          60,
              borderRadius:    '50%',
              background:      'color-mix(in srgb, var(--color-primary, #6366f1) 10%, transparent)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              margin:          '0 auto 16px',
            }}
          >
            <Phone size={26} style={{ color: 'var(--color-primary, #6366f1)' }} />
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text, #111)' }}>
            {mode === 'link' ? 'Add Phone Number' : 'Sign in with Phone'}
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--color-text-secondary, #6b7280)' }}>
            We&apos;ll send a one-time code to verify your number.
          </p>
        </div>

        {/* Phone input row */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display:      'block',
              marginBottom: 6,
              fontSize:     '13px',
              fontWeight:   600,
              color:        'var(--color-text, #111)',
            }}
          >
            Phone Number
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Country code selector */}
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              style={{
                padding:      '10px 8px',
                background:   'var(--color-surface, #fff)',
                border:       `1px solid ${phoneError ? 'var(--color-danger, #ef4444)' : 'var(--color-border, #e5e7eb)'}`,
                borderRadius: 'var(--radius-md, 8px)',
                color:        'var(--color-text, #111)',
                fontSize:     '14px',
                cursor:       'pointer',
                outline:      'none',
                flexShrink:   0,
              }}
              aria-label="Country code"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} {c.label}
                </option>
              ))}
            </select>

            {/* Local number */}
            <input
              type="tel"
              value={phoneLocal}
              onChange={(e) => setPhoneLocal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSendOTP(); }}
              placeholder="412 345 678"
              autoComplete="tel-national"
              style={{
                ...(phoneError ? errorInputStyle : inputStyle),
                flex: 1,
              }}
              aria-label="Phone number"
              aria-invalid={!!phoneError}
            />
          </div>

          {phoneError && (
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--color-danger, #ef4444)' }} role="alert">
              {phoneError}
            </p>
          )}
        </div>

        {/* Send OTP button */}
        <button
          type="button"
          onClick={handleSendOTP}
          disabled={sendLoading}
          style={{
            ...btnPrimary,
            opacity: sendLoading ? 0.7 : 1,
            cursor:  sendLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {sendLoading && <Loader2 size={16} className="animate-spin" />}
          {sendLoading ? 'Sending…' : 'Send OTP'}
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // Render — Step 2: OTP entry
  // ─────────────────────────────────────────────

  return (
    <div style={{ width: '100%' }}>
      {/* Invisible reCAPTCHA container (kept for resend) */}
      <div id="recaptcha-container" />

      {/* Back */}
      <button
        type="button"
        onClick={() => { setStep('phone'); setOtpError(''); setOtpCode(''); }}
        style={{
          display:    'inline-flex',
          alignItems: 'center',
          gap:        6,
          background: 'none',
          border:     'none',
          color:      'var(--color-text-secondary, #6b7280)',
          fontSize:   '14px',
          cursor:     'pointer',
          padding:    0,
          marginBottom: 20,
        }}
      >
        <ArrowLeft size={16} />
        Change number
      </button>

      {/* Heading */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text, #111)' }}>
          Enter the code
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--color-text-secondary, #6b7280)' }}>
          We sent a 6-digit code to{' '}
          <span style={{ fontWeight: 600, color: 'var(--color-text, #111)' }}>
            {countryCode} {phoneLocal}
          </span>
        </p>
      </div>

      {/* OTP input */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display:      'block',
            marginBottom: 6,
            fontSize:     '13px',
            fontWeight:   600,
            color:        'var(--color-text, #111)',
          }}
        >
          Verification Code
        </label>
        <input
          type="number"
          value={otpCode}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
            setOtpCode(val);
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleVerify(); }}
          placeholder="123456"
          maxLength={6}
          autoComplete="one-time-code"
          inputMode="numeric"
          style={{
            ...(otpError ? errorInputStyle : inputStyle),
            letterSpacing: '0.2em',
            fontSize:      '20px',
            textAlign:     'center',
            fontWeight:    700,
          }}
          aria-label="One-time verification code"
          aria-invalid={!!otpError}
        />

        {otpError && (
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--color-danger, #ef4444)' }} role="alert">
            {otpError}
          </p>
        )}
      </div>

      {/* Verify button */}
      <button
        type="button"
        onClick={handleVerify}
        disabled={verifyLoading}
        style={{
          ...btnPrimary,
          opacity: verifyLoading ? 0.7 : 1,
          cursor:  verifyLoading ? 'not-allowed' : 'pointer',
          marginBottom: 16,
        }}
      >
        {verifyLoading && <Loader2 size={16} className="animate-spin" />}
        {verifyLoading ? 'Verifying…' : 'Verify Code'}
      </button>

      {/* Resend row */}
      <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-text-secondary, #6b7280)' }}>
        {countdown > 0 ? (
          <span>Resend code in {countdown}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading}
            style={{
              background: 'none',
              border:     'none',
              color:      resendLoading ? 'var(--color-text-secondary, #6b7280)' : 'var(--color-primary, #6366f1)',
              fontWeight: 600,
              fontSize:   '13px',
              cursor:     resendLoading ? 'not-allowed' : 'pointer',
              padding:    0,
              display:    'inline-flex',
              alignItems: 'center',
              gap:        4,
            }}
          >
            {resendLoading && <Loader2 size={13} className="animate-spin" />}
            {resendLoading ? 'Sending…' : "Didn't receive it? Resend"}
          </button>
        )}
      </div>
    </div>
  );
}
