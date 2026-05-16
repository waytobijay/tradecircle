/**
 * app/rewards/page.tsx
 * Phase 5 — Buyer-facing loyalty dashboard.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection, doc, getDoc, getDocs, limit, onSnapshot,
  orderBy, query, where,
} from 'firebase/firestore';
import {
  Award, ShoppingBag, Star, Users as UsersIcon, Gift,
  Plus, Minus, X, Loader2, Sparkles, CheckCircle2,
} from 'lucide-react';
import BuyerLayout      from '@/components/layouts/BuyerLayout';
import { db }           from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import {
  TIER_THRESHOLDS, POINTS_PER_ACTION,
  calculateTier, pointsToNextTier, redeemReward,
} from '@/services/loyalty';
import type {
  LoyaltyAccount, LoyaltyReward, LoyaltyTransaction, LoyaltyTier,
} from '@/types';

const TIER_COLORS: Record<LoyaltyTier, string> = {
  bronze:   '#cd7f32',
  silver:   '#c0c0c0',
  gold:     '#ffd700',
  platinum: '#e5e4e2',
};

const TIER_ORDER: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum'];

function fmtDate(seconds: number): string {
  try { return new Date(seconds * 1000).toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RewardsPage() {
  const { user }    = useAuthStore();
  const uid         = user?.uid ?? '';

  const [account,      setAccount]      = useState<LoyaltyAccount | null>(null);
  const [rewards,      setRewards]      = useState<LoyaltyReward[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading,      setLoading]      = useState(true);

  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [modal,     setModal]     = useState<{ ok: boolean; message: string } | null>(null);

  // Live account
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const ref = doc(db, 'loyaltyAccounts', uid);
    return onSnapshot(ref, (snap) => {
      setAccount(snap.exists() ? (snap.data() as LoyaltyAccount) : null);
      setLoading(false);
    });
  }, [uid]);

  // Active rewards (one-shot — admin-managed)
  useEffect(() => {
    (async () => {
      try {
        const q = query(
          collection(db, 'loyaltyRewards'),
          where('active', '==', true),
          orderBy('pointsCost', 'asc'),
        );
        const snap = await getDocs(q);
        setRewards(snap.docs.map((d) => ({ ...(d.data() as LoyaltyReward), id: d.id })));
      } catch { setRewards([]); }
    })();
  }, []);

  // Live transactions
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'loyaltyTransactions'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    return onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map((d) => ({ ...(d.data() as LoyaltyTransaction), id: d.id })));
    });
  }, [uid]);

  const points     = account?.points ?? 0;
  const lifetime   = account?.lifetimePoints ?? 0;
  const tier       = account?.tier ?? calculateTier(lifetime);
  const toNext     = pointsToNextTier(lifetime);
  const nextIdx    = TIER_ORDER.indexOf(tier) + 1;
  const nextTier   = nextIdx < TIER_ORDER.length ? TIER_ORDER[nextIdx] : null;
  const progressPct = useMemo(() => {
    if (!nextTier) return 100;
    const span = TIER_THRESHOLDS[nextTier] - TIER_THRESHOLDS[tier];
    const done = lifetime - TIER_THRESHOLDS[tier];
    return span > 0 ? Math.min(100, Math.max(0, (done / span) * 100)) : 100;
  }, [lifetime, tier, nextTier]);

  async function handleRedeem(reward: LoyaltyReward) {
    if (!uid || redeeming) return;
    setRedeeming(reward.id);
    const result = await redeemReward(uid, reward);
    setRedeeming(null);
    setModal({ ok: result.success, message: result.message });
  }

  return (
    <BuyerLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 60px' }}>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div style={{
          background: `linear-gradient(135deg, ${TIER_COLORS[tier]}33, var(--color-surface))`,
          border: '1px solid var(--color-border)', borderRadius: 16,
          padding: 28, marginBottom: 24,
          display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center',
        }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: TIER_COLORS[tier],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            flexShrink: 0,
          }}>
            <Award size={48} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Your tier
            </div>
            <h1 style={{
              margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--color-text)',
              textTransform: 'capitalize',
            }}>{tier}</h1>
            <div style={{ marginTop: 12, fontSize: 14, color: 'var(--color-text-secondary)' }}>
              <strong style={{ color: 'var(--color-text)', fontSize: 22 }}>{points.toLocaleString()}</strong>
              {' '}points available · {lifetime.toLocaleString()} lifetime
            </div>

            {nextTier && (
              <div style={{ marginTop: 14 }}>
                <div style={{ height: 10, borderRadius: 6, background: 'var(--color-border)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${progressPct}%`, height: '100%',
                    background: TIER_COLORS[nextTier],
                    transition: 'width 0.4s',
                  }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {toNext.toLocaleString()} points to {nextTier}
                </div>
              </div>
            )}
            {!nextTier && (
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--color-text-secondary)',
                display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} /> Top tier reached — enjoy your perks!
              </div>
            )}
          </div>
        </div>

        {/* ── Earn ─────────────────────────────────────────────────────── */}
        <h2 style={sectionTitle}>How to earn</h2>
        <div style={gridResponsive(4, 180)}>
          <EarnCard icon={<ShoppingBag size={22} />} label="Per purchase"        pts={POINTS_PER_ACTION.purchase} />
          <EarnCard icon={<Star size={22} />}        label="Leave a review"      pts={POINTS_PER_ACTION.review} />
          <EarnCard icon={<UsersIcon size={22} />}   label="Refer a friend"      pts={POINTS_PER_ACTION.referral} />
          <EarnCard icon={<Gift size={22} />}        label="Signup bonus"        pts={POINTS_PER_ACTION.signup} />
        </div>

        {/* ── Rewards ──────────────────────────────────────────────────── */}
        <h2 style={{ ...sectionTitle, marginTop: 32 }}>Available rewards</h2>
        {loading
          ? <SkeletonGrid />
          : rewards.length === 0
            ? <EmptyState text="No rewards available right now. Check back soon!" />
            : (
              <div style={gridResponsive(3, 240)}>
                {rewards.map((r) => {
                  const disabled = points < r.pointsCost || redeeming === r.id;
                  return (
                    <div key={r.id} style={cardStyle}>
                      <div style={{
                        height: 130, borderRadius: 8, marginBottom: 12,
                        background: r.imageUrl ? `url(${r.imageUrl}) center/cover no-repeat` : 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {!r.imageUrl && <Gift size={36} color="var(--color-text-secondary)" />}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>
                          {r.name}
                        </h3>
                        <span style={pointsBadge}>{r.pointsCost} pts</span>
                      </div>
                      <p style={{
                        margin: '6px 0 12px', fontSize: 13, color: 'var(--color-text-secondary)',
                        minHeight: 36, lineHeight: 1.4,
                      }}>{r.description}</p>
                      <button
                        onClick={() => void handleRedeem(r)}
                        disabled={disabled}
                        style={{
                          width: '100%', padding: '9px 14px', fontSize: 13, fontWeight: 600,
                          border: 'none', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
                          background: disabled ? 'var(--color-border)' : 'var(--color-primary)',
                          color: disabled ? 'var(--color-text-secondary)' : '#fff',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        {redeeming === r.id
                          ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Redeeming…</>
                          : points < r.pointsCost
                            ? `Need ${(r.pointsCost - points).toLocaleString()} more`
                            : 'Redeem'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )
        }

        {/* ── History ──────────────────────────────────────────────────── */}
        <h2 style={{ ...sectionTitle, marginTop: 32 }}>Recent activity</h2>
        {transactions.length === 0
          ? <EmptyState text="No activity yet. Start earning by shopping or referring friends!" />
          : (
            <div style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              {transactions.map((tx, i) => {
                const earned = tx.points >= 0;
                return (
                  <div key={tx.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: earned ? 'color-mix(in srgb, var(--color-success) 18%, transparent)'
                                         : 'color-mix(in srgb, var(--color-danger) 18%, transparent)',
                      color: earned ? 'var(--color-success)' : 'var(--color-danger)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {earned ? <Plus size={16} /> : <Minus size={16} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500,
                        textTransform: 'capitalize' }}>
                        {tx.action.replace('-', ' ')}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {tx.description}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 700,
                        color: earned ? 'var(--color-success)' : 'var(--color-danger)',
                      }}>
                        {earned ? '+' : ''}{tx.points.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                        {fmtDate(tx.createdAt?.seconds ?? 0)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>

      {/* Confirmation modal */}
      {modal && (
        <div
          onClick={() => setModal(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-background)', borderRadius: 14,
              padding: 28, maxWidth: 380, width: '100%',
              border: '1px solid var(--color-border)', textAlign: 'center',
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 14px',
              background: modal.ok ? 'color-mix(in srgb, var(--color-success) 18%, transparent)'
                                   : 'color-mix(in srgb, var(--color-danger) 18%, transparent)',
              color: modal.ok ? 'var(--color-success)' : 'var(--color-danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {modal.ok ? <CheckCircle2 size={30} /> : <X size={30} />}
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, color: 'var(--color-text)' }}>
              {modal.ok ? 'Success!' : 'Something went wrong'}
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--color-text-secondary)' }}>
              {modal.message}
            </p>
            <button
              onClick={() => setModal(null)}
              style={{
                width: '100%', padding: '10px 14px', fontSize: 14, fontWeight: 600,
                border: 'none', borderRadius: 8, cursor: 'pointer',
                background: 'var(--color-primary)', color: '#fff',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </BuyerLayout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EarnCard({ icon, label, pts }: { icon: React.ReactNode; label: string; pts: number }) {
  return (
    <div style={cardStyle}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
        color: 'var(--color-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
      }}>{icon}</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginTop: 2 }}>
        +{pts} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>pts</span>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div style={gridResponsive(3, 240)}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ ...cardStyle, height: 260, opacity: 0.5 }} />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px dashed var(--color-border)',
      borderRadius: 12, padding: 30, textAlign: 'center',
      color: 'var(--color-text-secondary)', fontSize: 14,
    }}>{text}</div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const sectionTitle: React.CSSProperties = {
  margin: '0 0 14px', fontSize: 16, fontWeight: 600, color: 'var(--color-text)',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 12, padding: 16,
};

const pointsBadge: React.CSSProperties = {
  background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
  color: 'var(--color-primary)',
  fontSize: 11, fontWeight: 700,
  padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
};

function gridResponsive(cols: number, min: number): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
    gap: 14,
  };
}
