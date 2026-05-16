/**
 * app/admin/analytics/page.tsx
 * Analytics dashboard — date range tabs, stat cards, charts, tables.
 * Spec ref: section 6.7 (Admin Portal — Analytics)
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/layouts/AdminLayout';
import {
  Eye, Users, UserPlus, Package, ShoppingBag, TrendingUp, ArrowRight,
} from 'lucide-react';

// ─── Mock data ────────────────────────────────────────────────────────────────

type Range = '7d' | '30d' | '90d';

const RANGE_TABS: { value: Range; label: string }[] = [
  { value: '7d',  label: 'Last 7 Days'  },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
];

interface StatsSnapshot {
  pageViews:       string;
  uniqueUsers:     string;
  newRegistrations: string;
  activeProducts:  string;
  ordersPlaced:    string;
  conversionRate:  string;
}

const STATS_BY_RANGE: Record<Range, StatsSnapshot> = {
  '7d': {
    pageViews:        '18,432',
    uniqueUsers:      '4,217',
    newRegistrations: '318',
    activeProducts:   '1,204',
    ordersPlaced:     '94',
    conversionRate:   '2.23%',
  },
  '30d': {
    pageViews:        '74,891',
    uniqueUsers:      '16,532',
    newRegistrations: '1,247',
    activeProducts:   '4,312',
    ordersPlaced:     '382',
    conversionRate:   '2.31%',
  },
  '90d': {
    pageViews:        '218,045',
    uniqueUsers:      '48,700',
    newRegistrations: '3,891',
    activeProducts:   '4,312',
    ordersPlaced:     '1,124',
    conversionRate:   '2.31%',
  },
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const USER_BAR_VALUES  = [45, 82, 67, 91, 54, 78, 103];
const REV_BAR_VALUES   = [1200, 3400, 2100, 4500, 1800, 3200, 4100];

const TOP_CATEGORIES = [
  { name: 'Electronics', pct: 38 },
  { name: 'Clothing',    pct: 24 },
  { name: 'Home',        pct: 18 },
  { name: 'Vehicles',    pct: 12 },
  { name: 'Agriculture', pct:  8 },
];

const TOP_PRODUCTS = [
  { name: 'Samsung 55" OLED TV',   views: 2841, orders: 34, revenue: '$51,000' },
  { name: 'iPhone 15 Pro Max',      views: 2390, orders: 28, revenue: '$42,000' },
  { name: 'Canon EOS R6 Mark II',   views: 1874, orders: 19, revenue: '$28,500' },
  { name: 'DJI Mavic 3 Pro',        views: 1521, orders: 14, revenue: '$21,000' },
  { name: 'Dyson V15 Detect',       views:  984, orders: 22, revenue: '$13,200' },
];

const DONUT_SEGMENTS = [
  { label: 'Buyers',   pct: 58, color: 'var(--color-primary)' },
  { label: 'Sellers',  pct: 29, color: '#8B5CF6' },
  { label: 'Advisors', pct: 13, color: '#F59E0B' },
];

// conic-gradient string: 0deg → 360deg
function buildConic(segments: typeof DONUT_SEGMENTS): string {
  let angle = 0;
  return segments.map((s) => {
    const start = angle;
    angle += (s.pct / 100) * 360;
    return `${s.color} ${start}deg ${angle}deg`;
  }).join(', ');
}

function fmtRev(v: number) {
  return '$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<Range>('7d');
  const stats = STATS_BY_RANGE[range];
  const maxUser = Math.max(...USER_BAR_VALUES);
  const maxRev  = Math.max(...REV_BAR_VALUES);

  const STAT_CARDS = [
    { label: 'Total Page Views',     value: stats.pageViews,        icon: <Eye size={18} />,         color: 'var(--color-primary)' },
    { label: 'Unique Users',         value: stats.uniqueUsers,      icon: <Users size={18} />,       color: '#8B5CF6'              },
    { label: 'New Registrations',    value: stats.newRegistrations, icon: <UserPlus size={18} />,    color: '#10B981'              },
    { label: 'Active Products',      value: stats.activeProducts,   icon: <Package size={18} />,     color: '#F59E0B'              },
    { label: 'Orders Placed',        value: stats.ordersPlaced,     icon: <ShoppingBag size={18} />, color: '#EF4444'              },
    { label: 'Conversion Rate',      value: stats.conversionRate,   icon: <TrendingUp size={18} />,  color: '#06B6D4'              },
  ];

  const conicStr = buildConic(DONUT_SEGMENTS);

  return (
    <AdminLayout>
      <div style={{ padding: '28px 24px', maxWidth: 1200 }}>

        <style>{`
          .an-stats-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 14px;
            margin-bottom: 28px;
          }
          @media (max-width: 1100px) { .an-stats-grid { grid-template-columns: repeat(3, 1fr); } }
          @media (max-width: 680px)  { .an-stats-grid { grid-template-columns: repeat(2, 1fr); } }
          .an-charts-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 16px;
          }
          @media (max-width: 768px) { .an-charts-row { grid-template-columns: 1fr; } }
          .an-bottom-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 16px;
          }
          @media (max-width: 900px) { .an-bottom-row { grid-template-columns: 1fr; } }
          .an-card {
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: 12px;
            padding: 20px;
          }
          .an-table { width: 100%; border-collapse: collapse; font-size: 13px; }
          .an-table th {
            text-align: left; padding: 9px 12px;
            font-size: 11px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.05em; color: var(--color-text-secondary);
            border-bottom: 1px solid var(--color-border);
          }
          .an-table td {
            padding: 11px 12px; border-bottom: 1px solid var(--color-border);
            color: var(--color-text);
          }
          .an-table tr:last-child td { border-bottom: none; }
          .an-table tr:hover td { background: color-mix(in srgb, var(--color-primary) 4%, transparent); }
        `}</style>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Analytics</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Platform-wide metrics and performance overview
          </p>
        </div>

        {/* Advanced Analytics link card */}
        <Link href="/admin/analytics/cohort" style={{ textDecoration: 'none', display: 'block', marginBottom: 24 }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, #764ba2 100%)',
            borderRadius: 12, padding: '20px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '0.92'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>
                New
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                Advanced Analytics
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                Cohort retention, revenue by gateway, and user growth charts
              </div>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginLeft: 16,
            }}>
              <ArrowRight size={20} color="#fff" />
            </div>
          </div>
        </Link>

        {/* Date range tabs */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 24,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10, padding: 4, width: 'fit-content',
        }}>
          {RANGE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setRange(t.value)}
              style={{
                padding: '6px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: range === t.value ? 'var(--color-primary)' : 'transparent',
                color: range === t.value ? '#fff' : 'var(--color-text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Stat cards */}
        <div className="an-stats-grid">
          {STAT_CARDS.map((s) => (
            <div key={s.label} className="an-card" style={{ padding: '16px 18px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, marginBottom: 10,
                background: `color-mix(in srgb, ${s.color} 12%, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: s.color,
              }}>
                {s.icon}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1, marginBottom: 4 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Two bar charts */}
        <div className="an-charts-row">

          {/* Users over time */}
          <div className="an-card">
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 20 }}>
              Users Over Time
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
              {USER_BAR_VALUES.map((v, i) => {
                const h = Math.round((v / maxUser) * 100);
                return (
                  <div key={DAYS[i]} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 600 }}>{v}</span>
                    <div style={{
                      width: '100%', height: `${h}%`, minHeight: 4,
                      background: 'var(--color-primary)',
                      borderRadius: '4px 4px 0 0', opacity: 0.85,
                    }} />
                    <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{DAYS[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Revenue over time */}
          <div className="an-card">
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 20 }}>
              Revenue Over Time
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
              {REV_BAR_VALUES.map((v, i) => {
                const h = Math.round((v / maxRev) * 100);
                return (
                  <div key={DAYS[i]} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 600 }}>{fmtRev(v)}</span>
                    <div style={{
                      width: '100%', height: `${h}%`, minHeight: 4,
                      background: '#10B981',
                      borderRadius: '4px 4px 0 0', opacity: 0.85,
                    }} />
                    <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{DAYS[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom row: top categories + top products + donut */}
        <div className="an-bottom-row">

          {/* Top categories */}
          <div className="an-card">
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 16 }}>
              Top Categories
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {TOP_CATEGORIES.map((c) => (
                <div key={c.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500 }}>{c.name}</span>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 700 }}>{c.pct}%</span>
                  </div>
                  <div style={{ height: 7, background: 'var(--color-border)', borderRadius: 99 }}>
                    <div style={{ width: `${c.pct}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 99, opacity: 0.8 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User roles donut */}
          <div className="an-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 20 }}>
              User Roles
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
              {/* Donut */}
              <div style={{
                width: 120, height: 120, borderRadius: '50%', flexShrink: 0,
                background: `conic-gradient(${conicStr})`,
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', inset: 24,
                  borderRadius: '50%', background: 'var(--color-surface)',
                }} />
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DONUT_SEGMENTS.map((s) => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500 }}>{s.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginLeft: 'auto', paddingLeft: 16 }}>{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top products table */}
        <div className="an-card">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 16 }}>
            Top Products
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="an-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th style={{ textAlign: 'right' }}>Views</th>
                  <th style={{ textAlign: 'right' }}>Orders</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {TOP_PRODUCTS.map((p) => (
                  <tr key={p.name}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>
                      {p.views.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>
                      {p.orders}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>
                      {p.revenue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
