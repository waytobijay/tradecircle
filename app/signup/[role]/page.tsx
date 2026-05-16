/**
 * app/signup/[role]/page.tsx
 * Email sign-up form for a specific role: buyer | seller | advisor.
 * Spec ref: section 4.1 (Sign Up Form — Standard)
 *
 * Flow:
 *   /signup → role selected → /signup/buyer (or seller / advisor)
 *   → submit → Firebase Auth + Firestore write + verification email
 *   → /signup/verify?email=<encoded>
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { signUpWithEmail, sendVerificationEmail } from '@/services/auth';
import type { UserRole } from '@/types';

// ─────────────────────────────────────────────
// Route validation
// ─────────────────────────────────────────────

const VALID_ROLES = new Set<string>(['buyer', 'seller', 'advisor']);

const ROLE_LABELS: Record<UserRole, string> = {
  buyer:   'Buyer',
  seller:  'Seller',
  advisor: 'Advisor',
};

// ─────────────────────────────────────────────
// Zod schema
// ─────────────────────────────────────────────

const signupSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(80, 'Full name is too long'),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    phone: z
      .string()
      .min(7, 'Please enter a valid phone number')
      .max(20, 'Phone number is too long'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password is too long'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    city: z
      .string()
      .min(1, 'City is required')
      .max(80, 'City name is too long'),
    country: z
      .string()
      .min(1, 'Country is required')
      .max(80, 'Country name is too long'),
    /** Seller only */
    brand: z.string().max(80, 'Brand name is too long').optional(),
    /** Advisor only */
    specialty: z.string().max(120, 'Specialty is too long').optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

// ─────────────────────────────────────────────
// Password strength
// ─────────────────────────────────────────────

interface PasswordStrength {
  score: number;     // 0–5
  label: 'Weak' | 'Fair' | 'Strong';
  color: string;     // CSS variable
  width: string;     // bar width %
}

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: 'Weak', color: 'var(--color-danger)', width: '0%' };
  }

  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak',   color: 'var(--color-danger)',  width: '25%'  };
  if (score <= 3) return { score, label: 'Fair',   color: 'var(--color-warning)', width: '60%'  };
  return              { score, label: 'Strong', color: 'var(--color-success)', width: '100%' };
}

// ─────────────────────────────────────────────
// Reusable field wrapper
// ─────────────────────────────────────────────

interface FieldProps {
  id:          string;
  label:       string;
  error?:      string;
  required?:   boolean;
  children:    React.ReactNode;
}

function Field({ id, label, error, required = true, children }: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium mb-1"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {label}
        {required && (
          <span style={{ color: 'var(--color-danger)' }} aria-hidden="true">
            {' '}*
          </span>
        )}
      </label>
      {children}
      {error && (
        <p
          className="mt-1 text-xs"
          style={{ color: 'var(--color-danger)' }}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Shared input style helper
// ─────────────────────────────────────────────

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width:           '100%',
    padding:         '10px 14px',
    borderRadius:    'var(--radius-md)',
    border:          `1px solid ${hasError ? 'var(--color-danger)' : 'var(--color-border)'}`,
    backgroundColor: 'var(--color-bg-tertiary)',
    color:           'var(--color-text-primary)',
    fontSize:        '14px',
    outline:         'none',
    transition:      'border-color 0.15s',
  };
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function SignupRolePage() {
  const params = useParams();
  const router = useRouter();
  const role   = params.role as string;

  const [showPassword, setShowPassword]     = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [serverError, setServerError]       = useState('');
  const [passwordValue, setPasswordValue]   = useState('');

  // Redirect to /signup if role is invalid
  useEffect(() => {
    if (!VALID_ROLES.has(role)) {
      router.replace('/signup');
    }
  }, [role, router]);

  const typedRole = role as UserRole;
  const isSeller  = typedRole === 'seller';
  const isAdvisor = typedRole === 'advisor';

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  // Watch password for strength indicator
  const watchedPassword = watch('password', '');
  const strength = getPasswordStrength(watchedPassword);

  // ── Submit ─────────────────────────────────
  async function onSubmit(data: SignupFormData) {
    setServerError('');
    try {
      await signUpWithEmail(
        data.email,
        data.password,
        data.name,
        data.phone,
        typedRole,
        {
          brand:     isSeller  ? data.brand     : undefined,
          specialty: isAdvisor ? data.specialty : undefined,
          location:  { city: data.city, country: data.country },
        }
      );

      // Send email verification
      await sendVerificationEmail();

      // Redirect to verify page with email for display
      router.replace(`/signup/verify?email=${encodeURIComponent(data.email)}`);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Sign up failed. Please try again.'
      );
    }
  }

  if (!VALID_ROLES.has(role)) return null;

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-base"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      <div className="w-full max-w-lg">

        {/* Back link */}
        <Link
          href="/signup"
          className="inline-flex items-center gap-1 text-sm mb-md transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeft size={14} />
          Change role
        </Link>

        {/* Card */}
        <div
          className="w-full rounded-md p-lg"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            border:           '1px solid var(--color-border)',
          }}
        >
          {/* Header */}
          <div className="mb-lg">
            <h1
              className="font-display font-bold"
              style={{ fontSize: '26px', color: 'var(--color-text-primary)' }}
            >
              Create your account
            </h1>
            <p
              className="mt-xs text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Signing up as a{' '}
              <span
                className="font-semibold"
                style={{ color: `var(--color-${typedRole})` }}
              >
                {ROLE_LABELS[typedRole]}
              </span>
            </p>
          </div>

          {/* Server error */}
          {serverError && (
            <div
              className="mb-md text-sm px-base py-xs rounded-md"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                border:           '1px solid var(--color-danger)',
                color:            'var(--color-danger)',
              }}
              role="alert"
            >
              {serverError}
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-sm"
          >
            {/* Full Name */}
            <Field id="name" label="Full Name" error={errors.name?.message}>
              <input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="e.g. Alex Johnson"
                {...register('name')}
                style={inputStyle(!!errors.name)}
              />
            </Field>

            {/* Seller: Brand / Business Name */}
            {isSeller && (
              <Field
                id="brand"
                label="Brand / Business Name"
                error={errors.brand?.message}
                required={false}
              >
                <input
                  id="brand"
                  type="text"
                  autoComplete="organization"
                  placeholder="e.g. Johnson's Produce"
                  {...register('brand')}
                  style={inputStyle(!!errors.brand)}
                />
              </Field>
            )}

            {/* Advisor: Specialty */}
            {isAdvisor && (
              <Field
                id="specialty"
                label="Specialty / Area of Expertise"
                error={errors.specialty?.message}
                required={false}
              >
                <input
                  id="specialty"
                  type="text"
                  autoComplete="off"
                  placeholder="e.g. Agricultural Law, Financial Planning"
                  {...register('specialty')}
                  style={inputStyle(!!errors.specialty)}
                />
              </Field>
            )}

            {/* Email */}
            <Field id="email" label="Email Address" error={errors.email?.message}>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="e.g. you@example.com"
                {...register('email')}
                style={inputStyle(!!errors.email)}
              />
            </Field>

            {/* Phone */}
            <Field id="phone" label="Phone Number" error={errors.phone?.message}>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="e.g. +61 400 000 000"
                {...register('phone')}
                style={inputStyle(!!errors.phone)}
              />
            </Field>

            {/* Password + strength */}
            <Field id="password" label="Password" error={errors.password?.message}>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  {...register('password')}
                  style={{ ...inputStyle(!!errors.password), paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Strength bar */}
              {watchedPassword.length > 0 && (
                <div className="mt-2">
                  <div
                    className="w-full rounded-full overflow-hidden"
                    style={{
                      height:          '4px',
                      backgroundColor: 'var(--color-bg-tertiary)',
                    }}
                  >
                    <div
                      style={{
                        height:          '100%',
                        width:            strength.width,
                        backgroundColor:  strength.color,
                        borderRadius:     '9999px',
                        transition:       'width 0.3s ease, background-color 0.3s ease',
                      }}
                    />
                  </div>
                  <p
                    className="mt-1 text-xs font-medium"
                    style={{ color: strength.color }}
                  >
                    {strength.label}
                  </p>
                </div>
              )}
            </Field>

            {/* Confirm Password */}
            <Field
              id="confirmPassword"
              label="Confirm Password"
              error={errors.confirmPassword?.message}
            >
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  {...register('confirmPassword')}
                  style={{
                    ...inputStyle(!!errors.confirmPassword),
                    paddingRight: '44px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {/* City + Country — side by side on tablet+ */}
            <div className="grid grid-cols-1 gap-sm tablet:grid-cols-2">
              <Field id="city" label="City" error={errors.city?.message}>
                <input
                  id="city"
                  type="text"
                  autoComplete="address-level2"
                  placeholder="e.g. Sydney"
                  {...register('city')}
                  style={inputStyle(!!errors.city)}
                />
              </Field>

              <Field id="country" label="Country" error={errors.country?.message}>
                <input
                  id="country"
                  type="text"
                  autoComplete="country-name"
                  placeholder="e.g. Australia"
                  {...register('country')}
                  style={inputStyle(!!errors.country)}
                />
              </Field>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-xs font-medium text-sm transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed mt-xs"
              style={{
                padding:         '12px',
                borderRadius:    'var(--radius-pill)',
                backgroundColor: `var(--color-${typedRole})`,
                color:           '#ffffff',
              }}
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting
                ? 'Creating account…'
                : `Create ${ROLE_LABELS[typedRole]} Account`
              }
            </button>
          </form>

          {/* Sign in link */}
          <p
            className="mt-md text-sm text-center"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-primary)' }}
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
