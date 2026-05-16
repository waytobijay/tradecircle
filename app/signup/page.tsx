/**
 * app/signup/page.tsx
 * Role selection — first step of the sign-up flow.
 * Spec ref: section 4.1 (Sign Up Page — Step 1: Role Selection)
 *
 * Layout:
 *   [Continue with Google]
 *   ── or ──
 *   3 role cards (Buyer | Seller | Advisor) → /signup/[role]
 *
 * Micro-interactions (spec section 3):
 *   Cards lift on hover (translateY -4px) with role-coloured border accent.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingBag, Store, GraduationCap, Loader2 } from 'lucide-react';
import { signInWithGoogle } from '@/services/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { UserRole } from '@/types';

// ─────────────────────────────────────────────
// Role card definitions
// Spec ref: section 10.2 (Key Messaging Per Section)
// ─────────────────────────────────────────────

interface RoleCard {
  role:        UserRole;
  label:       string;
  description: string;
  Icon:        React.ElementType;
  colorVar:    string; // CSS variable name for role accent colour
}

const ROLE_CARDS: RoleCard[] = [
  {
    role:        'buyer',
    label:       'Buyer',
    description: 'Find products in your area, from people you can trust.',
    Icon:        ShoppingBag,
    colorVar:    'var(--color-buyer)',
  },
  {
    role:        'seller',
    label:       'Seller',
    description: 'List your products in minutes. Reach buyers near you.',
    Icon:        Store,
    colorVar:    'var(--color-seller)',
  },
  {
    role:        'advisor',
    label:       'Advisor',
    description: 'Share your expertise. Help your community. Get recognised.',
    Icon:        GraduationCap,
    colorVar:    'var(--color-advisor)',
  },
];

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
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Role card component
// ─────────────────────────────────────────────

interface RoleCardProps extends RoleCard {
  onSelect: (role: UserRole) => void;
}

function RoleCardItem({ role, label, description, Icon, colorVar, onSelect }: RoleCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Sign up as ${label}`}
      onClick={() => onSelect(role)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(role); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: `1.5px solid ${hovered ? colorVar : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '28px var(--space-6)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
        boxShadow: hovered
          ? '0 8px 24px rgba(0,0,0,0.10)'
          : '0 1px 4px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 'var(--space-3)',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: `color-mix(in srgb, ${colorVar} 12%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={28} style={{ color: colorVar }} strokeWidth={1.5} />
      </div>

      {/* Role name */}
      <h3
        className="font-display font-semibold"
        style={{
          fontSize: '20px',
          color: 'var(--color-text-primary)',
          margin: 0,
        }}
      >
        {label}
      </h3>

      {/* Description */}
      <p
        style={{
          fontSize: '14px',
          lineHeight: '1.5',
          color: 'var(--color-text-secondary)',
          margin: 0,
        }}
      >
        {description}
      </p>

      {/* Select button */}
      <button
        type="button"
        tabIndex={-1} // card itself handles keyboard
        onClick={(e) => { e.stopPropagation(); onSelect(role); }}
        style={{
          marginTop: 'var(--space-2)',
          width: '100%',
          padding: '9px var(--space-4)',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: hovered ? colorVar : 'transparent',
          border: `1.5px solid ${colorVar}`,
          color: hovered ? '#ffffff' : colorVar,
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background-color 0.2s ease, color 0.2s ease',
        }}
      >
        Sign up as {label}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError]     = useState('');

  function handleRoleSelect(role: UserRole) {
    router.push(`/signup/${role}`);
  }

  async function handleGoogleSignUp() {
    setGoogleLoading(true);
    setGoogleError('');
    try {
      const { user, isNewUser } = await signInWithGoogle();

      if (isNewUser) {
        // New Google user — they'll land on /home with buyer role (set in signInWithGoogle)
        router.replace('/home');
      } else {
        // Returning user — resolve their role and redirect
        const adminSnap = await getDoc(doc(db, 'adminUsers', user.uid));
        if (adminSnap.exists() && adminSnap.data()?.active) {
          router.replace('/admin/dashboard');
        } else {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          const role = userSnap.data()?.role as UserRole | undefined;
          router.replace(role ? '/home' : '/home');
        }
      }
    } catch (err) {
      setGoogleError(
        err instanceof Error ? err.message : 'Google sign up failed. Please try again.'
      );
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-base"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      <div className="w-full max-w-3xl">

        {/* Header */}
        <div className="mb-lg text-center">
          <h1
            className="font-display font-bold"
            style={{ fontSize: '32px', color: 'var(--color-text-primary)' }}
          >
            Join TradeCircle
          </h1>
          <p
            className="mt-xs text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Choose how you want to participate in the community.
          </p>
        </div>

        {/* Google button */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-sm rounded-md font-medium text-sm transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed mb-md"
          style={{
            padding: '11px var(--space-4)',
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

        {googleError && (
          <p
            className="text-sm text-center mb-sm"
            style={{ color: 'var(--color-danger)' }}
            role="alert"
          >
            {googleError}
          </p>
        )}

        {/* Divider */}
        <div className="flex items-center gap-sm mb-lg">
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
          <span
            className="text-xs font-medium px-xs"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            or sign up with email
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
        </div>

        {/* Role cards */}
        <div
          className="grid grid-cols-1 gap-sm tablet:grid-cols-3"
        >
          {ROLE_CARDS.map((card) => (
            <RoleCardItem
              key={card.role}
              {...card}
              onSelect={handleRoleSelect}
            />
          ))}
        </div>

        {/* Sign in link */}
        <p
          className="mt-lg text-sm text-center"
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
    </main>
  );
}
