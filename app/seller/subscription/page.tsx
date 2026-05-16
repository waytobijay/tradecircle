'use client';

/**
 * app/seller/subscription/page.tsx
 * Seller subscription tier selection page.
 * Displays the 4 available tiers, the seller's current plan (read from
 * Firestore sellerSubscriptions/{uid}), upgrade/downgrade actions, and a
 * feature comparison table.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Check, X, Star, Loader2 } from 'lucide-react';
import SellerLayout     from '@/components/layouts/SellerLayout';
import { useAuthStore } from '@/store/authStore';
import { db }          from '@/services/firebase';
import type { SubscriptionTier, SubscriptionTierId, SellerSubscription } from '@/types';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const TIERS: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free',
    priceAud: 0,
    maxListings: 5,
    featuredListings: 0,
    adCreditsMonthly: 0,
    analyticsAccess: false,
    prioritySupport: false,
  },
  {
    id: 'basic',
    name: 'Basic',
    priceAud: 19,
    maxListings: 25,
    featuredListings: 1,
    adCreditsMonthly: 10,
    analyticsAccess: false,
    prioritySupport: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceAud: 49,
    maxListings: 100,
    featuredListings: 5,
    adCreditsMonthly: 50,
    analyticsAccess: true,
    prioritySupport: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    priceAud: 99,
    maxListings: -1,
    featuredListings: 20,
    adCreditsMonthly: 200,
    analyticsAccess: true,
    prioritySupport: true,
  },
];

type TierOrder = Record<SubscriptionTierId, number>;
const TIER_ORDER: TierOrder = { free: 0, basic: 1, pro: 2, premium: 3 };

// ─────────────────────────────────────────────
// Toast component (lightweight, no deps)
// ─────────────────────────────────────────────

interface ToastProps {
  message: string;
  type: 'info' | 'success' | 'error';
  onDismiss: () => void;
}

function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const bg =
    type === 'success' ? 'var(--color-success)' :
    type === 'error'   ? 'var(--color-danger)'  :
    'var(--color-primary)';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 96,
        left: '50%',
        transform: 'translateX(-50%)',
        background: bg,
        color: '#fff',
        padding: '10px 20px',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        zIndex: 1000,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        whiteSpace: 'nowrap',
      }}
    >
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────
// Confirmation modal
// ─────────────────────────────────────────────

interface ConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500,
        padding: '0 16px',
      }}
    >
      <div
        style={{
          background: 'var(--color-background)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          padding: '32px 28px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        }}
      >
        <h2
          id="confirm-modal-title"
          style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}
        >
          Downgrade to Free?
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          Your current paid subscription will be cancelled at the end of the billing period.
          You will lose access to paid features including featured listings, ad credits, and analytics.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Keep Plan
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--color-danger)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Yes, Downgrade
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tier card
// ─────────────────────────────────────────────

interface TierCardProps {
  tier: SubscriptionTier;
  currentTierId: SubscriptionTierId;
  onUpgrade: (tier: SubscriptionTier) => void;
  onDowngradeToFree: () => void;
  loading: boolean;
}

function TierCard({ tier, currentTierId, onUpgrade, onDowngradeToFree, loading }: TierCardProps) {
  const isCurrent  = tier.id === currentTierId;
  const isPro      = tier.id === 'pro';
  const isFree     = tier.id === 'free';
  const currentIdx = TIER_ORDER[currentTierId];
  const thisIdx    = TIER_ORDER[tier.id];
  const isUpgrade  = thisIdx > currentIdx;
  const isDowngrade = thisIdx < currentIdx;

  const features: { label: string; value: string | boolean }[] = [
    {
      label: 'Max Listings',
      value: tier.maxListings === -1 ? 'Unlimited' : String(tier.maxListings),
    },
    { label: 'Featured Listings', value: String(tier.featuredListings) },
    { label: 'Monthly Ad Credits', value: String(tier.adCreditsMonthly) },
    { label: 'Analytics Dashboard', value: tier.analyticsAccess },
    { label: 'Priority Support',    value: tier.prioritySupport },
  ];

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: isPro
          ? '2px solid var(--color-primary)'
          : '1px solid var(--color-border)',
        borderRadius: 16,
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        position: 'relative',
        transition: 'box-shadow 0.2s',
        boxShadow: isPro ? '0 0 0 4px color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'none',
      }}
    >
      {/* Badges */}
      {isPro && (
        <span
          style={{
            position: 'absolute',
            top: -13,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-primary)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 12px',
            borderRadius: 99,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Star size={10} fill="currentColor" />
          Most Popular
        </span>
      )}

      {isCurrent && (
        <span
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'color-mix(in srgb, var(--color-success) 15%, transparent)',
            color: 'var(--color-success)',
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 99,
            letterSpacing: '0.03em',
          }}
        >
          Current Plan
        </span>
      )}

      {/* Tier name & price */}
      <h3
        style={{
          margin: '0 0 6px',
          fontSize: 20,
          fontWeight: 700,
          color: isPro ? 'var(--color-primary)' : 'var(--color-text)',
        }}
      >
        {tier.name}
      </h3>

      <div style={{ marginBottom: 24 }}>
        {tier.priceAud === 0 ? (
          <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text)' }}>Free</span>
        ) : (
          <>
            <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text)' }}>
              A${tier.priceAud}
            </span>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginLeft: 4 }}>
              /mo
            </span>
          </>
        )}
      </div>

      {/* Feature list */}
      <ul
        style={{
          listStyle: 'none',
          margin: '0 0 28px',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flex: 1,
        }}
      >
        {features.map((f) => (
          <li
            key={f.label}
            style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}
          >
            {typeof f.value === 'boolean' ? (
              f.value ? (
                <Check size={16} color="var(--color-success)" strokeWidth={2.5} />
              ) : (
                <X size={16} color="var(--color-text-secondary)" strokeWidth={2} />
              )
            ) : (
              <Check size={16} color="var(--color-success)" strokeWidth={2.5} />
            )}
            <span style={{ color: 'var(--color-text)', flex: 1 }}>{f.label}</span>
            {typeof f.value === 'string' && (
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                {f.value}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* Action button */}
      {isCurrent ? (
        <button
          disabled
          style={{
            padding: '10px 0',
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'default',
            width: '100%',
          }}
        >
          Current Plan
        </button>
      ) : isUpgrade ? (
        <button
          onClick={() => onUpgrade(tier)}
          disabled={loading}
          style={{
            padding: '10px 0',
            borderRadius: 10,
            border: 'none',
            background: isPro ? 'var(--color-primary)' : 'var(--color-surface)',
            color: isPro ? '#fff' : 'var(--color-text)',
            border: isPro ? 'none' : '1px solid var(--color-border)',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: loading ? 0.7 : 1,
            transition: 'opacity 0.15s',
          } as React.CSSProperties}
        >
          {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          Upgrade to {tier.name}
        </button>
      ) : isDowngrade && !isFree ? (
        <button
          onClick={() => onUpgrade(tier)}
          disabled={loading}
          style={{
            padding: '10px 0',
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          Downgrade to {tier.name}
        </button>
      ) : isDowngrade && isFree ? (
        <button
          onClick={onDowngradeToFree}
          disabled={loading}
          style={{
            padding: '10px 0',
            borderRadius: 10,
            border: '1px solid var(--color-danger)',
            background: 'transparent',
            color: 'var(--color-danger)',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          Downgrade to Free
        </button>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────
// Comparison table
// ─────────────────────────────────────────────

function ComparisonTable({ currentTierId }: { currentTierId: SubscriptionTierId }) {
  type RowValue = string | boolean;
  const rows: { feature: string; values: RowValue[] }[] = [
    {
      feature: 'Max Listings',
      values: TIERS.map((t) => (t.maxListings === -1 ? 'Unlimited' : String(t.maxListings))),
    },
    {
      feature: 'Featured Listings',
      values: TIERS.map((t) => String(t.featuredListings)),
    },
    {
      feature: 'Monthly Ad Credits',
      values: TIERS.map((t) => String(t.adCreditsMonthly)),
    },
    {
      feature: 'Analytics Dashboard',
      values: TIERS.map((t) => t.analyticsAccess),
    },
    {
      feature: 'Priority Support',
      values: TIERS.map((t) => t.prioritySupport),
    },
  ];

  const colWidth = `${100 / (TIERS.length + 1)}%`;

  return (
    <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid var(--color-border)' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 14,
          minWidth: 520,
        }}
      >
        <thead>
          <tr style={{ background: 'var(--color-surface)' }}>
            <th
              style={{
                padding: '14px 20px',
                textAlign: 'left',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                borderBottom: '1px solid var(--color-border)',
                width: colWidth,
              }}
            >
              Feature
            </th>
            {TIERS.map((t) => (
              <th
                key={t.id}
                style={{
                  padding: '14px 16px',
                  textAlign: 'center',
                  fontWeight: 700,
                  color: t.id === currentTierId
                    ? 'var(--color-primary)'
                    : t.id === 'pro'
                    ? 'var(--color-primary)'
                    : 'var(--color-text)',
                  borderBottom: '1px solid var(--color-border)',
                  borderLeft: '1px solid var(--color-border)',
                  width: colWidth,
                  background: t.id === currentTierId
                    ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)'
                    : 'transparent',
                }}
              >
                {t.name}
                {t.id === currentTierId && (
                  <span
                    style={{
                      display: 'block',
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--color-success)',
                      marginTop: 2,
                    }}
                  >
                    Current
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.feature}
              style={{
                background: i % 2 === 0 ? 'transparent' : 'var(--color-surface)',
              }}
            >
              <td
                style={{
                  padding: '13px 20px',
                  color: 'var(--color-text)',
                  fontWeight: 500,
                  borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                {row.feature}
              </td>
              {row.values.map((val, j) => (
                <td
                  key={j}
                  style={{
                    padding: '13px 16px',
                    textAlign: 'center',
                    borderLeft: '1px solid var(--color-border)',
                    borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none',
                    background: TIERS[j].id === currentTierId
                      ? 'color-mix(in srgb, var(--color-primary) 4%, transparent)'
                      : 'transparent',
                  }}
                >
                  {typeof val === 'boolean' ? (
                    val ? (
                      <Check
                        size={16}
                        color="var(--color-success)"
                        strokeWidth={2.5}
                        style={{ margin: '0 auto', display: 'block' }}
                      />
                    ) : (
                      <X
                        size={16}
                        color="var(--color-text-secondary)"
                        strokeWidth={2}
                        style={{ margin: '0 auto', display: 'block' }}
                      />
                    )
                  ) : (
                    <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{val}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function SubscriptionPage() {
  const { user } = useAuthStore();
  const uid = user?.uid ?? '';

  const [currentTierId, setCurrentTierId] = useState<SubscriptionTierId>('free');
  const [loadingData,   setLoadingData]   = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);

  type Toast = { message: string; type: 'info' | 'success' | 'error' };
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    setToast({ message, type });
  }, []);

  // ── Load current subscription ──────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;

    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'sellerSubscriptions', uid));
        if (snap.exists()) {
          const data = snap.data() as SellerSubscription;
          setCurrentTierId(data.tier ?? 'free');
        } else {
          setCurrentTierId('free');
        }
      } catch {
        setCurrentTierId('free');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [uid]);

  // ── Upgrade / change to paid tier ─────────────────────────────────────
  const handleUpgrade = useCallback(
    async (tier: SubscriptionTier) => {
      if (!uid) return;

      // Placeholder: open Stripe Checkout
      showToast('Redirecting to Stripe...', 'info');

      const stripeCheckoutUrl = tier.stripePriceId
        ? `https://checkout.stripe.com/pay/${tier.stripePriceId}?client_reference_id=${uid}`
        : 'https://checkout.stripe.com'; // placeholder

      window.open(stripeCheckoutUrl, '_blank', 'noopener,noreferrer');
    },
    [uid, showToast],
  );

  // ── Downgrade to free ──────────────────────────────────────────────────
  const handleDowngradeToFreeConfirmed = useCallback(async () => {
    if (!uid) return;
    setShowConfirm(false);
    setActionLoading(true);

    try {
      const ref = doc(db, 'sellerSubscriptions', uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        await updateDoc(ref, {
          tier: 'free',
          cancelAtPeriodEnd: false,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          uid,
          tier: 'free',
          cancelAtPeriodEnd: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setCurrentTierId('free');
      showToast('Downgraded to Free plan.', 'success');
    } catch {
      showToast('Failed to downgrade. Please try again.', 'error');
    } finally {
      setActionLoading(false);
    }
  }, [uid, showToast]);

  // ─────────────────────────────────────────────────────────────────────
  return (
    <SellerLayout>
      {/* keyframe animation for spinner */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (min-width: 640px)  { .sub-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (min-width: 1024px) { .sub-grid { grid-template-columns: repeat(4, 1fr) !important; } }
      `}</style>

      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '40px 20px 60px',
        }}
      >
        {/* Page header */}
        <div style={{ marginBottom: 40 }}>
          <h1
            style={{
              margin: '0 0 8px',
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
            }}
          >
            Subscription Plan
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--color-text-secondary)' }}>
            Choose the plan that fits your selling needs. Upgrade or downgrade anytime.
          </p>
        </div>

        {loadingData ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 0',
              gap: 12,
              color: 'var(--color-text-secondary)',
            }}
          >
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 15 }}>Loading your plan...</span>
          </div>
        ) : (
          <>
            {/* ── Tier cards grid ────────────────────────────────────────── */}
            <div
              className="sub-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 20,
                marginBottom: 56,
              }}
            >
              {TIERS.map((tier) => (
                <TierCard
                  key={tier.id}
                  tier={tier}
                  currentTierId={currentTierId}
                  onUpgrade={handleUpgrade}
                  onDowngradeToFree={() => setShowConfirm(true)}
                  loading={actionLoading}
                />
              ))}
            </div>

            {/* ── Comparison table ───────────────────────────────────────── */}
            <div>
              <h2
                style={{
                  margin: '0 0 20px',
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                }}
              >
                Feature Comparison
              </h2>
              <ComparisonTable currentTierId={currentTierId} />
            </div>
          </>
        )}
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <ConfirmModal
          onConfirm={() => void handleDowngradeToFreeConfirmed()}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </SellerLayout>
  );
}
