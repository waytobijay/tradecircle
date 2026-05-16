/**
 * app/admin/dashboard/page.tsx
 * Admin dashboard — stats, charts, recent activity.
 * Spec ref: section 6.7 (Admin Portal)
 */

'use client';

import AdminLayout from '@/components/layouts/AdminLayout';
import {
  Users, Package, ShoppingBag, DollarSign,
  TrendingUp, TrendingDown, UserPlus, Star,
  AlertCircle, CheckCircle, ShoppingCart, Eye,
} from 'lucide-react';

// ─── Mock data ────────────────────────────────────────────────────────────────

const STATS = [
  {
    label:   'Total Users',
    value:   '12,847',
    trend:   '+8.2%',
    up:      true,
    icon:    <Users size={20} />,
    color:   'var(--color-primary)',
  },
  {
    label:   'Total Products',
    value:   '4,312',
    trend:   '+5.1%',
    up:      true,
    icon:    <Package size={20} />,
    color:   '#7C3AED',
  },
  {
    label:   'Active Orders',
    value:   '238',
    trend:   '-2.3%',
    up:      false,
    icon:    <ShoppingBag size={20} />,
    color:   '#D97706',
  },
  {
    label:   'Total Revenue',
    value:   'AUD 98,450',
    trend:   '+14.6%',
    up:      true,
    icon:    <DollarSign size={20} />,
    color:   '#16A34A',
  },
];

// Last 7 days new user counts (Sun → Sat)
const USER_CHART_DATA = [
  { day: 'Mon', count: 42 },
  { day: 'Tue', count: 68 },
  { day: 'Wed', count: 55 },
  { day: 'Thu', count: 91 },
  { day: 'Fri', count: 78 },
  { day: 'Sat', count: 34 },
  { day: 'Sun', count: 29 },
];

const TOP_CATEGORIES = [
  { name: 'Electronics',    pct: 82 },
  { name: 'Fashion',        pct: 67 },
  { name: 'Farm & Garden',  pct: 54 },
  { name: 'Home & Living',  pct: 41 },
  { name: 'Vehicles',       pct: 28 },
  { name: 'Services',       pct: 19 },
];

const RECENT_ACTIVITY = [
  { id: 1,  icon: <UserPlus size={15} />,      color: '#1D4ED8', text: 'Aisha Patel joined as Buyer',            time: '2 min ago'  },
  { id: 2,  icon: <Package  size={15} />,      color: '#7C3AED', text: 'Ravi Sharma listed "Samsung TV 55"',     time: '8 min ago'  },
  { id: 3,  icon: <ShoppingCart size={15} />,  color: '#D97706', text: 'Order #ORD-7821 placed by John Kim',     time: '15 min ago' },
  { id: 4,  icon: <CheckCircle size={15} />,   color: '#16A34A', text: 'Order #ORD-7818 delivered successfully', time: '32 min ago' },
  { id: 5,  icon: <AlertCircle size={15} />,   color: '#DC2626', text: 'Product "iPhone 14 Pro" flagged for review', time: '1 hr ago' },
  { id: 6,  icon: <Star size={15} />,          color: '#D97706', text: 'New 5-star review on "Canon EOS R6"',    time: '1 hr ago'   },
  { id: 7,  icon: <UserPlus size={15} />,      color: '#1D4ED8', text: 'Marco Bianchi joined as Seller',         time: '2 hrs ago'  },
  { id: 8,  icon: <Eye size={15} />,           color: '#7C3AED', text: 'Advisory "Wool Export Tips" hit 500 views', time: '3 hrs ago' },
];

const MAX_CHART_VAL = Math.max(...USER_CHART_DATA.map((d) => d.count));

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  return (
    <AdminLayout>
      <div style={{ padding: '28px 24px', maxWidth: 1200 }}>

        {/* ── Stats row ──────────────────────────────────────────────────── */}
        <style>{`
          .adm-stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 28px;
          }
          @media (max-width: 900px) {
            .adm-stats-grid { grid-template-columns: repeat(2, 1fr); }
          }
          @media (max-width: 480px) {
            .adm-stats-grid { grid-template-columns: repeat(2, 1fr); }
          }
          .adm-charts-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 28px;
          }
          @media (max-width: 768px) {
            .adm-charts-grid { grid-template-columns: 1fr; }
          }
        `}</style>

        <div className="adm-stats-grid">
          {STATS.map((s) => (
            <div
              key={s.label}
              style={{
                background: 'var(--color-surface, var(--color-bg-secondary))',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                padding: '20px 20px 16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `color-mix(in srgb, ${s.color} 12%, transparent)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: s.color,
                }}>
                  {s.icon}
                </div>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 600,
                  color: s.up ? 'var(--color-success)' : 'var(--color-danger)',
                }}>
                  {s.up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {s.trend}
                </span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text, var(--color-text-primary))', lineHeight: 1.1, marginBottom: 4 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts ─────────────────────────────────────────────────────── */}
        <div className="adm-charts-grid">

          {/* Bar chart — New Users last 7 days */}
          <div style={{
            background: 'var(--color-surface, var(--color-bg-secondary))',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '20px',
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text, var(--color-text-primary))', marginBottom: 20 }}>
              New Users — Last 7 Days
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120 }}>
              {USER_CHART_DATA.map((d) => {
                const barH = Math.round((d.count / MAX_CHART_VAL) * 100);
                return (
                  <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>{d.count}</span>
                    <div
                      style={{
                        width: '100%',
                        height: `${barH}%`,
                        minHeight: 4,
                        background: 'var(--color-primary)',
                        borderRadius: '4px 4px 0 0',
                        opacity: 0.85,
                        transition: 'height 0.3s ease',
                      }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{d.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Horizontal bar chart — Top Categories */}
          <div style={{
            background: 'var(--color-surface, var(--color-bg-secondary))',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '20px',
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text, var(--color-text-primary))', marginBottom: 16 }}>
              Top Categories
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {TOP_CATEGORIES.map((c) => (
                <div key={c.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text, var(--color-text-primary))', fontWeight: 500 }}>{c.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>{c.pct}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 99 }}>
                    <div
                      style={{
                        width: `${c.pct}%`,
                        height: '100%',
                        background: 'var(--color-primary)',
                        borderRadius: 99,
                        opacity: 0.8,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recent Activity ─────────────────────────────────────────────── */}
        <div style={{
          background: 'var(--color-surface, var(--color-bg-secondary))',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '20px',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text, var(--color-text-primary))', marginBottom: 16 }}>
            Recent Activity
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {RECENT_ACTIVITY.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: idx < RECENT_ACTIVITY.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: `color-mix(in srgb, ${item.color} 12%, transparent)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: item.color,
                }}>
                  {item.icon}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text, var(--color-text-primary))', lineHeight: 1.4 }}>
                  {item.text}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
