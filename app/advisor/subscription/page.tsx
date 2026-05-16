'use client';

/**
 * app/advisor/subscription/page.tsx
 * Advisor premium plan selection page.
 * Reads current plan from advisorSubscriptions/{uid} (defaults to 'free').
 * Upgrade: opens Stripe via window.open.
 * Downgrade to Free: confirmation modal + Firestore updateDoc.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Check, X, Star, Loader2, Zap } from 'lucide-react';
import AdvisorLayout  from '@/components/layouts/AdvisorLayout';
import { useAuthStore } from '@/store/authStore';
import { db }          from '@/services/firebase';
import type { AdvisorPlan, AdvisorPlanId } from '@/types';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PLANS: AdvisorPlan[] = [
  {
    id: 'free',
    name: 'Free',
    priceAud: 0,
    maxActivePosts: 3,
    featuredProfile: false,
    directEnquiryPriority: false,
    analyticsAccess: false,
    verifiedBadge: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    priceAud: 29,
    maxActivePosts: 20,
    featuredProfile: true,
    directEnquiryPriority: true,
    analyticsAccess: false,
    verifiedBadge: false,
  },
  {
    id: 'expert',
    name: 'Expert',
    priceAud: 69,
    maxActivePosts: -1,
    featuredProfile: true,
    directEnquiryPriority: true,
    analyticsAccess: true,
    verifiedBadge: true,
  },
];

const PLAN_ORDER: Record<AdvisorPlanId, number> = { free: 0, professional: 1, expert: 2 };

// ─────────────────────────────────────────────
// Toast
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
        bottom: 28,
        right: 24,
        background: bg,
        color: '#fff',
        padding: '12px 20px',
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 600,
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        zIndex: 9999,
        maxWidth: 340,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {message}
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', opacity: 0.7, padding: 0, lineHeight: 1 }}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Downgrade confirmation modal
// ─────────────────────────────────────────────

interface DowngradeModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function DowngradeModal({ onConfirm, onCancel, loading }: DowngradeModalProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 8000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 16,
          padding: 28,
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
          Downgrade to Free?
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          You will lose access to premium features immediately. Your active posts will be limited to 3.
          This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 20px', borderRadius: 9,
              border: '1px solid var(--color-border)',
              background: 'var(--color-background)',
              color: 'var(--color-text)',
              cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '9px 20px', borderRadius: 9, border: 'none',
              background: 'var(--color-danger)', color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600, opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            {loading ? <Loader2 size={15} style={{ animation: 'advsub-spin 0.7s linear infinite' }} /> : null}
            {loading ? 'Downgrading…' : 'Yes, downgrade'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Feature row helper
// ─────────────────────────────────────────────

function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value
      ? <Check size={16} color="var(--color-success)" />
      : <X size={16} color="var(--color-text-secondary)" style={{ opacity: 0.4 }} />;
  }
  return <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{value}</span>;
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function AdvisorSubscriptionPage() {
  const { user } = useAuthStore();
  const uid = user?.uid ?? '';

  const [currentPlan, setCurrentPlan] = useState<AdvisorPlanId>('free');
  const [planLoading, setPlanLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
  };

  // Fetch current plan
  const fetchPlan = useCallback(async () => {
    if (!uid) return;
    setPlanLoading(true);
    try {
      const snap = await getDoc(doc(db, 'advisorSubscriptions', uid));
      if (snap.exists()) {
        const data = snap.data() as { plan?: AdvisorPlanId };
        setCurrentPlan(data.plan ?? 'free');
      }
    } catch (err) {
      console.error('[AdvisorSubscription] fetch error', err);
    } finally {
      setPlanLoading(false);
    }
  }, [uid]);

  useEffect(() => { void fetchPlan(); }, [fetchPlan]);

  const handleUpgrade = (plan: AdvisorPlan) => {
    if (!plan.stripePriceId) {
      showToast('Redirecting to Stripe…', 'info');
      // In production: use the real Stripe checkout URL with stripePriceId
      window.open('https://stripe.com', '_blank');
      return;
    }
    showToast('Redirecting to Stripe…', 'info');
    window.open(`https://buy.stripe.com/${plan.stripePriceId}?client_reference_id=${uid}`, '_blank');
  };

  const handleDowngradeToFree = async () => {
    if (!uid) return;
    setActionLoading(true);
    try {
      const ref = doc(db, 'advisorSubscriptions', uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, {
          plan: 'free',
          cancelAtPeriodEnd: false,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          uid,
          plan: 'free',
          cancelAtPeriodEnd: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setCurrentPlan('free');
      showToast('Downgraded to Free plan.', 'success');
    } catch (err) {
      console.error('[AdvisorSubscription] downgrade error', err);
      showToast('Failed to downgrade. Please try again.', 'error');
    } finally {
      setActionLoading(false);
      setShowDowngradeModal(false);
    }
  };

  const getActionButton = (plan: AdvisorPlan) => {
    const isCurrent = plan.id === currentPlan;
    const isUpgrade = PLAN_ORDER[plan.id] > PLAN_ORDER[currentPlan];
    const isDowngrade = PLAN_ORDER[plan.id] < PLAN_ORDER[currentPlan];

    if (isCurrent) {
      return (
        <button disabled style={{
          width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
          background: 'var(--color-border)', color: 'var(--color-text-secondary)',
          fontWeight: 600, fontSize: 14, cursor: 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}>
          <Check size={15} /> Current Plan
        </button>
      );
    }
    if (isUpgrade) {
      return (
        <button
          onClick={() => handleUpgrade(plan)}
          style={{
            width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
            background: 'var(--color-primary)', color: '#fff',
            fontWeight: 600, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <Zap size={15} /> Upgrade to {plan.name}
        </button>
      );
    }
    if (isDowngrade && plan.id === 'free') {
      return (
        <button
          onClick={() => setShowDowngradeModal(true)}
          style={{
            width: '100%', padding: '11px 0', borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: 'var(--color-background)', color: 'var(--color-text-secondary)',
            fontWeight: 600, fontSize: 14, cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Downgrade to Free
        </button>
      );
    }
    return null;
  };

  const featureRows: Array<{ label: string; getValue: (p: AdvisorPlan) => boolean | string }> = [
    {
      label: 'Active Posts',
      getValue: (p) => p.maxActivePosts === -1 ? 'Unlimited' : String(p.maxActivePosts),
    },
    {
      label: 'Featured Profile',
      getValue: (p) => p.featuredProfile,
    },
    {
      label: 'Priority Enquiries',
      getValue: (p) => p.directEnquiryPriority,
    },
    {
      label: 'Analytics',
      getValue: (p) => p.analyticsAccess,
    },
    {
      label: 'Verified Badge',
      getValue: (p) => p.verifiedBadge,
    },
  ];

  return (
    <>
      <style>{`
        @keyframes advsub-spin { to { transform: rotate(360deg); } }
      `}</style>

      {showDowngradeModal && (
        <DowngradeModal
          onConfirm={() => void handleDowngradeToFree()}
          onCancel={() => setShowDowngradeModal(false)}
          loading={actionLoading}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      <AdvisorLayout>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 80px' }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>
              My Plan
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)' }}>
              Choose the plan that fits your advisory practice.
            </p>
          </div>

          {planLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: 'var(--color-text-secondary)' }}>
              <Loader2 size={28} style={{ animation: 'advsub-spin 0.8s linear infinite' }} />
            </div>
          ) : (
            <>
              {/* Plan cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 20,
                marginBottom: 48,
              }}>
                {PLANS.map((plan) => {
                  const isExpert = plan.id === 'expert';
                  const isCurrent = plan.id === currentPlan;
                  return (
                    <div
                      key={plan.id}
                      style={{
                        border: isExpert
                          ? '2px solid var(--color-primary)'
                          : '1px solid var(--color-border)',
                        borderRadius: 16,
                        padding: 24,
                        background: 'var(--color-surface)',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                      }}
                    >
                      {/* Best Value badge */}
                      {isExpert && (
                        <div style={{
                          position: 'absolute',
                          top: -12,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'var(--color-primary)',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 12px',
                          borderRadius: 20,
                          letterSpacing: '0.03em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          whiteSpace: 'nowrap',
                        }}>
                          <Star size={10} fill="#fff" /> Best Value
                        </div>
                      )}

                      {/* Current plan badge */}
                      {isCurrent && (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 10px',
                          borderRadius: 20,
                          background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
                          color: 'var(--color-success)',
                          fontSize: 11,
                          fontWeight: 700,
                          alignSelf: 'flex-start',
                        }}>
                          <Check size={10} /> Current Plan
                        </div>
                      )}

                      {/* Plan name & price */}
                      <div>
                        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
                          {plan.name}
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text)' }}>
                            {plan.priceAud === 0 ? 'Free' : `$${plan.priceAud}`}
                          </span>
                          {plan.priceAud > 0 && (
                            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                              AUD / month
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Feature list */}
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                        {[
                          `${plan.maxActivePosts === -1 ? 'Unlimited' : plan.maxActivePosts} active posts`,
                          ...(plan.featuredProfile ? ['Featured profile'] : []),
                          ...(plan.directEnquiryPriority ? ['Priority enquiries'] : []),
                          ...(plan.analyticsAccess ? ['Full analytics'] : []),
                          ...(plan.verifiedBadge ? ['Verified badge'] : []),
                        ].map((feature) => (
                          <li key={feature} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                            <Check size={14} color="var(--color-success)" style={{ flexShrink: 0 }} />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      {/* Action button */}
                      <div>{getActionButton(plan)}</div>
                    </div>
                  );
                })}
              </div>

              {/* Feature comparison table */}
              <div>
                <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>
                  Feature Comparison
                </h2>
                <div style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: 'var(--color-surface)',
                }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Feature
                          </th>
                          {PLANS.map((p) => (
                            <th
                              key={p.id}
                              style={{
                                padding: '12px 16px',
                                textAlign: 'center',
                                fontWeight: 700,
                                color: p.id === currentPlan ? 'var(--color-primary)' : 'var(--color-text)',
                                fontSize: 13,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {p.name}
                              {p.id === currentPlan && (
                                <span style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--color-success)', marginTop: 2 }}>
                                  Current
                                </span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {featureRows.map((row, idx) => (
                          <tr
                            key={row.label}
                            style={{
                              borderBottom: idx < featureRows.length - 1 ? '1px solid var(--color-border)' : 'none',
                              background: idx % 2 === 1 ? 'color-mix(in srgb, var(--color-border) 20%, transparent)' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--color-text)' }}>
                              {row.label}
                            </td>
                            {PLANS.map((p) => (
                              <td key={p.id} style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <FeatureCell value={row.getValue(p)} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </AdvisorLayout>
    </>
  );
}
