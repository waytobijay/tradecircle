/**
 * app/seller/analytics/page.tsx
 * Seller analytics dashboard.
 * Spec ref: section 4.3 (Seller Analytics)
 *
 * Layout:
 *  - Date range selector: Last 7 / 30 / 90 days | Custom (two date pickers)
 *  - Stats cards: Total Views | Total Clicks | Conversion Rate | Revenue
 *  - Line chart: Views Over Time  (reads sellerAnalytics/{uid}.viewsByDate)
 *  - Bar chart:  Revenue Over Time (derived from orders collection)
 *  - Horizontal bar chart: Top Products by Views (top 8 by product.views)
 *  - Ads Performance table: Ad Name | Impressions | Clicks | CTR | Spend
 *
 * Firestore reads:
 *  - products       where sellerId == uid  (full scan — accurate totals)
 *  - orders         where sellerId == uid, createdAt in [start, end]
 *                   Requires composite index: sellerId ASC + createdAt ASC
 *  - sellerAnalytics/{uid}  optional doc — { viewsByDate, clicksByDate }
 *  - ads            where advertiserId == uid
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import {
  BarChart2,
  DollarSign,
  Eye,
  MousePointer,
  Percent,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { db }           from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { RoleGuard }    from '@/components/guards/RoleGuard';
import SellerLayout     from '@/components/layouts/SellerLayout';

// ─── Types ───────────────────────────────────────────────────────────────────

type DateRange = '7d' | '30d' | '90d' | 'custom';

interface DailyStat {
  label: string; // 'MM/DD'
  date:  string; // 'YYYY-MM-DD'
  value: number;
}

interface ProductStat {
  id:    string;
  name:  string;
  views: number;
}

interface AdRow {
  id:          string;
  name:        string;
  impressions: number;
  clicks:      number;
  spend:       number;
}

interface PageStats {
  views:    number;
  clicks:   number;
  convRate: number; // percentage
  revenue:  number;
  currency: string;
}

interface AnalyticsDoc {
  viewsByDate:  Record<string, number>;
  clicksByDate: Record<string, number>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRangeDates(
  range:       DateRange,
  customStart: string,
  customEnd:   string,
): [Date, Date] {
  const now = new Date();
  if (range === 'custom' && customStart && customEnd) {
    const s = new Date(customStart);
    const e = new Date(customEnd);
    e.setHours(23, 59, 59, 999);
    return [s, e];
  }
  const days  = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const start = new Date(now);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return [start, now];
}

function buildDayRange(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cur  = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endD = new Date(end);
  endD.setHours(0, 0, 0, 0);
  while (cur <= endD) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function dateToLabel(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parts[1]}/${parts[2]}`;
}

function fmtCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ─── SVG Chart Constants ──────────────────────────────────────────────────────

const CW = 560;           // chart viewBox width
const CH = 180;           // chart viewBox height
const P  = { t: 10, r: 12, b: 28, l: 46 }; // padding
const IW = CW - P.l - P.r;
const IH = CH - P.t - P.b;

// ─── Chart Sub-components ─────────────────────────────────────────────────────

function NoData() {
  return (
    <div style={{
      height: CH,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--color-text-secondary)',
      fontSize: 13,
    }}>
      No data for this period
    </div>
  );
}

function LineChartSVG({
  data,
  color = 'var(--color-primary)',
}: {
  data:   DailyStat[];
  color?: string;
}) {
  if (data.length < 2 || data.every((d) => d.value === 0)) return <NoData />;

  const max  = Math.max(...data.map((d) => d.value), 1);
  const n    = data.length;
  const pts  = data.map((d, i) => ({
    x: P.l + (n > 1 ? i / (n - 1) : 0.5) * IW,
    y: P.t + (1 - d.value / max) * IH,
    d,
  }));
  const polyPts = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const ticks   = [0, 0.5, 1].map((t) => ({ val: Math.round(max * t), y: P.t + (1 - t) * IH }));
  const step    = Math.max(1, Math.floor(n / 5));
  const gradId  = 'lc-grad-line';

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} style={{ width: '100%', display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid + y-axis ticks */}
      {ticks.map((t) => (
        <g key={t.val}>
          <line
            x1={P.l} y1={t.y} x2={P.l + IW} y2={t.y}
            stroke="var(--color-border)" strokeDasharray="3 3"
          />
          <text x={P.l - 6} y={t.y + 4} textAnchor="end" fontSize={10} fill="var(--color-text-secondary)">
            {t.val}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <polygon
        points={`${P.l},${P.t + IH} ${polyPts} ${P.l + IW},${P.t + IH}`}
        fill={`url(#${gradId})`}
      />

      {/* Line */}
      <polyline
        points={polyPts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots + x-axis labels */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill={color} stroke="var(--color-background)" strokeWidth={1.5} />
          {(i % step === 0 || i === n - 1) && (
            <text x={p.x} y={CH - 6} textAnchor="middle" fontSize={10} fill="var(--color-text-secondary)">
              {p.d.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function BarChartSVG({
  data,
  color = 'var(--color-primary)',
}: {
  data:   DailyStat[];
  color?: string;
}) {
  if (!data.length || data.every((d) => d.value === 0)) return <NoData />;

  const max   = Math.max(...data.map((d) => d.value), 1);
  const n     = data.length;
  const barW  = Math.max(2, IW / n - 2);
  const ticks = [0, 0.5, 1].map((t) => ({ val: Math.round(max * t), y: P.t + (1 - t) * IH }));
  const step  = Math.max(1, Math.floor(n / 5));

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} style={{ width: '100%', display: 'block' }}>
      {ticks.map((t) => (
        <g key={t.val}>
          <line
            x1={P.l} y1={t.y} x2={P.l + IW} y2={t.y}
            stroke="var(--color-border)" strokeDasharray="3 3"
          />
          <text x={P.l - 6} y={t.y + 4} textAnchor="end" fontSize={10} fill="var(--color-text-secondary)">
            {t.val}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const x = P.l + (i / n) * IW + 1;
        const h = Math.max(1, (d.value / max) * IH);
        const y = P.t + IH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} fill={color} rx={2} opacity={0.8} />
            {(i % step === 0 || i === n - 1) && (
              <text x={x + barW / 2} y={CH - 6} textAnchor="middle" fontSize={10} fill="var(--color-text-secondary)">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function HBarChartSVG({ data }: { data: ProductStat[] }) {
  if (!data.length) return <NoData />;

  const max   = Math.max(...data.map((d) => d.views), 1);
  const ROW   = 32;
  const BAR_W = IW - 60;
  const svgH  = data.length * ROW + 8;

  return (
    <svg viewBox={`0 0 ${CW} ${svgH}`} style={{ width: '100%', display: 'block' }}>
      {data.map((d, i) => {
        const bLen = (d.views / max) * BAR_W;
        const y    = i * ROW;
        const name = d.name.length > 20 ? `${d.name.slice(0, 18)}…` : d.name;
        return (
          <g key={d.id}>
            <text
              x={P.l - 6} y={y + ROW / 2 + 4}
              textAnchor="end" fontSize={11}
              fill="var(--color-text-secondary)"
            >
              {name}
            </text>
            <rect
              x={P.l} y={y + 6}
              width={Math.max(bLen, 1)} height={ROW - 12}
              rx={4}
              fill="var(--color-seller, #f59e0b)"
              opacity={0.8}
            />
            <text
              x={P.l + bLen + 6} y={y + ROW / 2 + 4}
              fontSize={11}
              fill="var(--color-text-secondary)"
            >
              {d.views.toLocaleString()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Skeleton helper ──────────────────────────────────────────────────────────

const skeletonStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--color-surface) 25%, color-mix(in srgb, var(--color-surface) 80%, var(--color-text)) 50%, var(--color-surface) 75%)',
  backgroundSize: '200% 100%',
  animation: 'pulse 1.4s ease-in-out infinite',
  borderRadius: 8,
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SellerAnalyticsPage() {
  const { user } = useAuthStore();
  const uid      = user?.uid ?? '';

  const [range,       setRange]       = useState<DateRange>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');
  const [loading,     setLoading]     = useState(true);
  const [stats,       setStats]       = useState<PageStats>({
    views: 0, clicks: 0, convRate: 0, revenue: 0, currency: 'AUD',
  });
  const [viewsData,   setViewsData]   = useState<DailyStat[]>([]);
  const [revenueData, setRevenueData] = useState<DailyStat[]>([]);
  const [topProducts, setTopProducts] = useState<ProductStat[]>([]);
  const [ads,         setAds]         = useState<AdRow[]>([]);

  const loadData = useCallback(async () => {
    if (!uid) return;
    setLoading(true);

    const [startDate, endDate] = getRangeDates(range, customStart, customEnd);
    const dayKeys              = buildDayRange(startDate, endDate);
    const startTs              = Timestamp.fromDate(startDate);
    const endTs                = Timestamp.fromDate(endDate);

    try {
      // ── 1. Products (full scan — accurate totals + top-by-views) ──────────
      const prodSnap    = await getDocs(
        query(collection(db, 'products'), where('sellerId', '==', uid)),
      );
      const productList: ProductStat[] = prodSnap.docs.map((d) => ({
        id:    d.id,
        name:  (d.data().name  as string) ?? 'Unnamed',
        views: (d.data().views as number) ?? 0,
      }));
      const totalViews = productList.reduce((s, p) => s + p.views, 0);
      const topProds   = [...productList].sort((a, b) => b.views - a.views).slice(0, 8);

      // ── 2. Orders in date range ───────────────────────────────────────────
      //    Requires Firestore composite index: sellerId ASC + createdAt ASC
      const ordersSnap = await getDocs(
        query(
          collection(db, 'orders'),
          where('sellerId',  '==', uid),
          where('createdAt', '>=', startTs),
          where('createdAt', '<=', endTs),
          orderBy('createdAt', 'asc'),
        ),
      );
      const orders = ordersSnap.docs.map((d) => ({
        amount:    (d.data().amount    as number)    ?? 0,
        currency:  (d.data().currency  as string)    ?? 'AUD',
        createdAt: (d.data().createdAt as Timestamp),
      }));
      const totalRevenue = orders.reduce((s, o) => s + o.amount, 0);
      const currency     = orders[0]?.currency ?? 'AUD';
      const convRate     = totalViews > 0 ? (orders.length / totalViews) * 100 : 0;

      // Revenue time-series: group by calendar date
      const revByDate: Record<string, number> = {};
      orders.forEach((o) => {
        const key          = o.createdAt.toDate().toISOString().slice(0, 10);
        revByDate[key]     = (revByDate[key] ?? 0) + o.amount;
      });
      const revenueTimeSeries: DailyStat[] = dayKeys.map((k) => ({
        label: dateToLabel(k),
        date:  k,
        value: revByDate[k] ?? 0,
      }));

      // ── 3. Analytics doc (optional — views + clicks by date) ─────────────
      const analyticsSnap = await getDoc(doc(db, 'sellerAnalytics', uid));
      const analytics: AnalyticsDoc = analyticsSnap.exists()
        ? (analyticsSnap.data() as AnalyticsDoc)
        : { viewsByDate: {}, clicksByDate: {} };

      const totalClicks       = dayKeys.reduce((s, k) => s + (analytics.clicksByDate[k] ?? 0), 0);
      const viewsTimeSeries: DailyStat[] = dayKeys.map((k) => ({
        label: dateToLabel(k),
        date:  k,
        value: analytics.viewsByDate[k] ?? 0,
      }));

      // ── 4. Ads ────────────────────────────────────────────────────────────
      const adsSnap = await getDocs(
        query(collection(db, 'ads'), where('advertiserId', '==', uid)),
      );
      const adsList: AdRow[] = adsSnap.docs.map((d) => ({
        id:          d.id,
        name:        (d.data().name              as string) ?? '—',
        impressions: (d.data().stats?.impressions as number) ?? 0,
        clicks:      (d.data().stats?.clicks      as number) ?? 0,
        spend:       (d.data().budget             as number) ?? 0,
      }));

      // ── Commit ────────────────────────────────────────────────────────────
      setStats({ views: totalViews, clicks: totalClicks, convRate, revenue: totalRevenue, currency });
      setViewsData(viewsTimeSeries);
      setRevenueData(revenueTimeSeries);
      setTopProducts(topProds);
      setAds(adsList);
    } finally {
      setLoading(false);
    }
  }, [uid, range, customStart, customEnd]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Derived display values ────────────────────────────────────────────────

  const rangeOptions: { value: DateRange; label: string }[] = [
    { value: '7d',     label: 'Last 7 days'  },
    { value: '30d',    label: 'Last 30 days' },
    { value: '90d',    label: 'Last 90 days' },
    { value: 'custom', label: 'Custom'       },
  ];

  type StatCard = { icon: React.ReactNode; label: string; value: string; sub: string };
  const statCards: StatCard[] = [
    {
      icon:  <Eye size={18} />,
      label: 'Total Views',
      value: stats.views.toLocaleString(),
      sub:   'Across all listings',
    },
    {
      icon:  <MousePointer size={18} />,
      label: 'Total Clicks',
      value: stats.clicks.toLocaleString(),
      sub:   'In selected period',
    },
    {
      icon:  <Percent size={18} />,
      label: 'Conversion Rate',
      value: `${stats.convRate.toFixed(1)}%`,
      sub:   'Views → Orders',
    },
    {
      icon:  <DollarSign size={18} />,
      label: 'Revenue',
      value: fmtCurrency(stats.revenue, stats.currency),
      sub:   'Orders in period',
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  const sellerColor = 'var(--color-seller, #f59e0b)';

  const cardBase: React.CSSProperties = {
    background:   'var(--color-surface)',
    border:       '1px solid var(--color-border)',
    borderRadius: 12,
    padding:      '18px 20px',
  };

  return (
    <RoleGuard allowedRoles={['seller']}>
      <SellerLayout>
        <style>{`
          @keyframes pulse {
            0%   { background-position:  200% 0; }
            100% { background-position: -200% 0; }
          }
          @keyframes spin {
            from { transform: rotate(0deg);   }
            to   { transform: rotate(360deg); }
          }
        `}</style>

        <div style={{
          maxWidth:      1100,
          margin:        '0 auto',
          padding:       '24px 16px',
          display:       'flex',
          flexDirection: 'column',
          gap:           24,
        }}>

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            flexWrap:       'wrap',
            gap:            12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BarChart2 size={22} color={sellerColor} />
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>
                Analytics
              </h1>
            </div>
            <button
              onClick={() => void loadData()}
              disabled={loading}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          6,
                padding:      '7px 14px',
                border:       '1px solid var(--color-border)',
                borderRadius: 8,
                background:   'var(--color-surface)',
                cursor:       loading ? 'not-allowed' : 'pointer',
                color:        'var(--color-text)',
                fontSize:     13,
                opacity:      loading ? 0.6 : 1,
              }}
            >
              <RefreshCw
                size={14}
                style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
              />
              Refresh
            </button>
          </div>

          {/* ── Date range selector ─────────────────────────────────────────── */}
          <div style={{
            ...cardBase,
            padding:    '12px 16px',
            display:    'flex',
            alignItems: 'center',
            flexWrap:   'wrap',
            gap:        10,
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              Period:
            </span>

            {rangeOptions.map((opt) => {
              const active = range === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setRange(opt.value)}
                  style={{
                    padding:      '6px 14px',
                    borderRadius: 8,
                    cursor:       'pointer',
                    fontSize:     13,
                    border:       active
                      ? `2px solid ${sellerColor}`
                      : '1px solid var(--color-border)',
                    background: active
                      ? 'color-mix(in srgb, var(--color-seller, #f59e0b) 12%, transparent)'
                      : 'var(--color-background)',
                    color:      active ? sellerColor : 'var(--color-text)',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}

            {range === 'custom' && (
              <>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  style={{
                    padding:      '6px 10px',
                    borderRadius: 8,
                    fontSize:     13,
                    border:       '1px solid var(--color-border)',
                    background:   'var(--color-background)',
                    color:        'var(--color-text)',
                    cursor:       'pointer',
                  }}
                />
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  style={{
                    padding:      '6px 10px',
                    borderRadius: 8,
                    fontSize:     13,
                    border:       '1px solid var(--color-border)',
                    background:   'var(--color-background)',
                    color:        'var(--color-text)',
                    cursor:       'pointer',
                  }}
                />
              </>
            )}
          </div>

          {/* ── Stats cards ─────────────────────────────────────────────────── */}
          <div style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap:                 16,
          }}>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ ...skeletonStyle, height: 108, borderRadius: 12 }} />
                ))
              : statCards.map((card, i) => (
                  <div key={i} style={cardBase}>
                    <div style={{
                      display:    'flex',
                      alignItems: 'center',
                      gap:        6,
                      marginBottom: 10,
                      color:      sellerColor,
                    }}>
                      {card.icon}
                      <span style={{
                        fontSize:      11,
                        fontWeight:    600,
                        color:         'var(--color-text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        {card.label}
                      </span>
                    </div>
                    <div style={{
                      fontSize:   26,
                      fontWeight: 700,
                      color:      'var(--color-text)',
                      lineHeight: 1.1,
                      marginBottom: 4,
                    }}>
                      {card.value}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {card.sub}
                    </div>
                  </div>
                ))
            }
          </div>

          {/* ── Line + Bar charts ───────────────────────────────────────────── */}
          <div style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap:                 16,
          }}>
            {/* Views Over Time */}
            <div style={cardBase}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <TrendingUp size={15} color="var(--color-primary)" />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                  Views Over Time
                </span>
              </div>
              {loading
                ? <div style={{ ...skeletonStyle, height: CH }} />
                : <LineChartSVG data={viewsData} color="var(--color-primary)" />
              }
            </div>

            {/* Revenue Over Time */}
            <div style={cardBase}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <DollarSign size={15} color={sellerColor} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                  Revenue Over Time
                </span>
              </div>
              {loading
                ? <div style={{ ...skeletonStyle, height: CH }} />
                : <BarChartSVG data={revenueData} color={sellerColor} />
              }
            </div>
          </div>

          {/* ── Top Products by Views ────────────────────────────────────────── */}
          <div style={cardBase}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <BarChart2 size={15} color={sellerColor} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                Top Products by Views
              </span>
            </div>
            {loading
              ? <div style={{ ...skeletonStyle, height: 200 }} />
              : <HBarChartSVG data={topProducts} />
            }
          </div>

          {/* ── Ads Performance Table ────────────────────────────────────────── */}
          <div style={cardBase}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <MousePointer size={15} color="var(--color-primary)" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                Ads Performance
              </span>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ ...skeletonStyle, height: 40 }} />
                ))}
              </div>
            ) : ads.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding:   '32px 0',
                color:     'var(--color-text-secondary)',
                fontSize:  14,
              }}>
                No ads running.{' '}
                <a
                  href="/ads/new"
                  style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
                >
                  Create your first ad →
                </a>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                      {[
                        { label: 'Ad Name',     align: 'left'  as const },
                        { label: 'Impressions', align: 'right' as const },
                        { label: 'Clicks',      align: 'right' as const },
                        { label: 'CTR',         align: 'right' as const },
                        { label: 'Spend',       align: 'right' as const },
                      ].map((h) => (
                        <th
                          key={h.label}
                          style={{
                            padding:       '8px 12px',
                            textAlign:     h.align,
                            fontWeight:    600,
                            color:         'var(--color-text-secondary)',
                            whiteSpace:    'nowrap',
                            fontSize:      12,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ads.map((ad) => {
                      const ctr = ad.impressions > 0
                        ? ((ad.clicks / ad.impressions) * 100).toFixed(2)
                        : '0.00';
                      return (
                        <tr
                          key={ad.id}
                          style={{ borderBottom: '1px solid var(--color-border)' }}
                        >
                          <td style={{
                            padding:    '11px 12px',
                            color:      'var(--color-text)',
                            fontWeight: 500,
                          }}>
                            {ad.name}
                          </td>
                          <td style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                            {ad.impressions.toLocaleString()}
                          </td>
                          <td style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                            {ad.clicks.toLocaleString()}
                          </td>
                          <td style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                            {ctr}%
                          </td>
                          <td style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--color-text)', fontWeight: 500 }}>
                            {fmtCurrency(ad.spend, stats.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </SellerLayout>
    </RoleGuard>
  );
}
