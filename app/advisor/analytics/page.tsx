'use client';

/**
 * app/advisor/analytics/page.tsx
 * Advisor analytics dashboard — Phase 2.
 *
 * Stats: Total Post Views, Total Enquiries, Response Rate, Active Posts.
 * Charts: Top Posts by Views (CSS bar chart), Enquiries This Month (week buckets).
 * Gated: full analytics locked behind Professional/Expert plan.
 *
 * Firestore reads:
 *   advicePosts    where advisorId == uid
 *   advisorEnquiries where toAdvisorId == uid
 *   advisorSubscriptions/{uid}
 */

import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { BarChart2, Eye, MessageSquare, TrendingUp, FileText, Zap } from 'lucide-react';
import AdvisorLayout   from '@/components/layouts/AdvisorLayout';
import { useAuthStore } from '@/store/authStore';
import { db }          from '@/services/firebase';
import type { AdvicePost, AdvisorEnquiry, AdvisorPlanId } from '@/types';

// ─────────────────────────────────────────────
// Skeleton loader (inline — no deps)
// ─────────────────────────────────────────────

function Skeleton({ width, height, borderRadius = 8 }: { width: number | string; height: number; borderRadius?: number }) {
  return (
    <div style={{
      width, height, borderRadius,
      background: 'linear-gradient(90deg, var(--color-border) 25%, color-mix(in srgb, var(--color-border) 50%, transparent) 50%, var(--color-border) 75%)',
      backgroundSize: '200% 100%',
      animation: 'advan-shimmer 1.4s infinite',
    }} />
  );
}

// ─────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  loading: boolean;
  accent?: string;
}

function StatCard({ label, value, icon, loading, accent = 'var(--color-primary)' }: StatCardProps) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 14,
      padding: '18px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: `color-mix(in srgb, ${accent} 12%, transparent)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </div>
        {loading
          ? <Skeleton width={70} height={24} />
          : <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>{value}</div>
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getWeekOfMonth(date: Date): number {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  return Math.ceil((date.getDate() + startOfMonth.getDay()) / 7);
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function AdvisorAnalyticsPage() {
  const { user } = useAuthStore();
  const uid = user?.uid ?? '';

  const [posts,     setPosts]     = useState<AdvicePost[]>([]);
  const [enquiries, setEnquiries] = useState<AdvisorEnquiry[]>([]);
  const [plan,      setPlan]      = useState<AdvisorPlanId>('free');
  const [loading,   setLoading]   = useState(true);

  const fetchData = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const [postsSnap, enquiriesSnap, planSnap] = await Promise.all([
        getDocs(query(collection(db, 'advicePosts'), where('advisorId', '==', uid))),
        getDocs(query(collection(db, 'advisorEnquiries'), where('toAdvisorId', '==', uid))),
        getDoc(doc(db, 'advisorSubscriptions', uid)),
      ]);

      const fetchedPosts: AdvicePost[] = postsSnap.docs.map((d) => ({
        ...(d.data() as Omit<AdvicePost, 'id'>),
        id: d.id,
      }));
      const fetchedEnquiries: AdvisorEnquiry[] = enquiriesSnap.docs.map((d) => ({
        ...(d.data() as Omit<AdvisorEnquiry, 'id'>),
        id: d.id,
      }));

      setPosts(fetchedPosts);
      setEnquiries(fetchedEnquiries);

      if (planSnap.exists()) {
        const data = planSnap.data() as { plan?: AdvisorPlanId };
        setPlan(data.plan ?? 'free');
      }
    } catch (err) {
      console.error('[AdvisorAnalytics] fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // ── Derived stats ──────────────────────────
  const totalViews    = posts.reduce((sum, p) => sum + (p.views ?? 0), 0);
  const totalEnquiries = enquiries.length;
  const responded     = enquiries.filter((e) => e.status === 'responded').length;
  const responseRate  = totalEnquiries > 0 ? Math.round((responded / totalEnquiries) * 100) : 0;
  const activePosts   = posts.filter((p) => p.published).length;

  // Top 5 posts by views
  const topPosts = [...posts]
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 5);
  const maxViews = topPosts[0]?.views ?? 1;

  // Enquiries grouped by week of current month
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();
  const thisMonthEnquiries = enquiries.filter((e) => {
    const d = new Date((e.createdAt?.seconds ?? 0) * 1000);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const weekBuckets: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const e of thisMonthEnquiries) {
    const d = new Date((e.createdAt?.seconds ?? 0) * 1000);
    const w = getWeekOfMonth(d);
    weekBuckets[w] = (weekBuckets[w] ?? 0) + 1;
  }
  const weekEntries = Object.entries(weekBuckets).map(([w, count]) => ({
    label: `Week ${w}`,
    count,
  }));
  const maxWeekCount = Math.max(...weekEntries.map((w) => w.count), 1);

  const isFreePlan = plan === 'free';

  return (
    <>
      <style>{`
        @keyframes advan-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <AdvisorLayout>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 80px' }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <BarChart2 size={22} color="var(--color-primary)" />
              Analytics
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)' }}>
              Overview of your advice posts and enquiries.
            </p>
          </div>

          {/* Upgrade banner for free plan */}
          {!loading && isFreePlan && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              padding: '14px 18px',
              background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)',
              borderRadius: 12,
              marginBottom: 24,
            }}>
              <Zap size={20} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                  Unlock full analytics
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
                  Upgrade to Professional or Expert to access detailed post performance, enquiry trends, conversion rates, and more.
                </div>
                <a
                  href="/advisor/subscription"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 18px', borderRadius: 9,
                    background: 'var(--color-primary)', color: '#fff',
                    textDecoration: 'none', fontWeight: 600, fontSize: 13,
                  }}
                >
                  <Zap size={13} /> View Plans
                </a>
              </div>
            </div>
          )}

          {/* Stats cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            gap: 16,
            marginBottom: 32,
          }}>
            <StatCard label="Total Post Views"       value={totalViews}      icon={<Eye size={20} />}           loading={loading} />
            <StatCard label="Total Enquiries"         value={totalEnquiries}  icon={<MessageSquare size={20} />} loading={loading} accent="var(--color-success)" />
            <StatCard label="Response Rate"           value={`${responseRate}%`} icon={<TrendingUp size={20} />} loading={loading} accent="var(--color-warning)" />
            <StatCard label="Active Posts"            value={activePosts}     icon={<FileText size={20} />}      loading={loading} accent="#8B5CF6" />
          </div>

          {/* Top Posts by Views — horizontal bar chart */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 14,
            padding: 20,
            marginBottom: 24,
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={15} color="var(--color-primary)" />
              Top Posts by Views
            </h2>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Skeleton width={140} height={13} />
                    <Skeleton width="100%" height={22} borderRadius={6} />
                    <Skeleton width={32} height={13} />
                  </div>
                ))}
              </div>
            ) : topPosts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>
                No posts yet. Create your first advice post to see analytics.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topPosts.map((post) => {
                  const pct = Math.max(((post.views ?? 0) / maxViews) * 100, 2);
                  return (
                    <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Post title */}
                      <div style={{
                        width: 160, flexShrink: 0,
                        fontSize: 12, color: 'var(--color-text)',
                        fontWeight: 500, overflow: 'hidden',
                        whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                      }}
                        title={post.title}
                      >
                        {post.title}
                      </div>
                      {/* Bar */}
                      <div style={{ flex: 1, position: 'relative', height: 22, background: 'var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute', top: 0, left: 0, height: '100%',
                          width: `${pct}%`,
                          background: isFreePlan
                            ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)'
                            : 'var(--color-primary)',
                          borderRadius: 6,
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                      {/* Views count */}
                      <div style={{ width: 36, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--color-text)', flexShrink: 0 }}>
                        {post.views ?? 0}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isFreePlan && !loading && topPosts.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                Upgrade to unlock full post-level analytics with engagement metrics.
              </div>
            )}
          </div>

          {/* Enquiries This Month — week buckets */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 14,
            padding: 20,
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={15} color="var(--color-success)" />
              Enquiries This Month
            </h2>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 100 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} width={50} height={40 + i * 10} borderRadius={6} />
                ))}
              </div>
            ) : thisMonthEnquiries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>
                No enquiries received this month.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 100 }}>
                  {weekEntries.map((entry) => {
                    const barPct = (entry.count / maxWeekCount) * 100;
                    const barH = Math.max((barPct / 100) * 80, entry.count > 0 ? 8 : 0);
                    return (
                      <div key={entry.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        {/* Count label */}
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)', minHeight: 16 }}>
                          {entry.count > 0 ? entry.count : ''}
                        </div>
                        {/* Bar */}
                        <div style={{
                          width: '100%', height: 80,
                          display: 'flex', alignItems: 'flex-end',
                          background: 'var(--color-border)',
                          borderRadius: 6, overflow: 'hidden',
                        }}>
                          <div style={{
                            width: '100%',
                            height: `${barH}px`,
                            background: isFreePlan
                              ? 'color-mix(in srgb, var(--color-success) 40%, transparent)'
                              : 'var(--color-success)',
                            borderRadius: 6,
                            transition: 'height 0.4s ease',
                          }} />
                        </div>
                        {/* Week label */}
                        <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                          {entry.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {isFreePlan && (
                  <div style={{ marginTop: 12, fontSize: 11, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                    Upgrade to unlock response rate trends, conversion funnels, and month-over-month comparison.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </AdvisorLayout>
    </>
  );
}
