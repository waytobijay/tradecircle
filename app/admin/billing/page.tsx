/**
 * app/admin/billing/page.tsx
 * Admin — Operator Billing dashboard (Phase 4)
 * Reads operatorInvoices where tenantId == current.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  CreditCard, Check, Download, X, Loader2, TrendingUp,
  Users as UsersIcon, Package as PackageIcon, HardDrive,
} from 'lucide-react';
import { db } from '@/services/firebase';
import AdminLayout from '@/components/layouts/AdminLayout';
import type { OperatorPlan, OperatorInvoice, Timestamp } from '@/types';

// ─── Hard-coded plans ─────────────────────────────────────────────────────────

const PLANS: OperatorPlan[] = [
  {
    id: 'starter', name: 'Starter', monthlyPriceAud: 99,
    maxUsers: 500, maxProducts: 1000, maxStorageGb: 10,
    customDomain: false, whiteLabel: false, dedicatedSupport: false, slaUptime: 99.0,
  },
  {
    id: 'growth', name: 'Growth', monthlyPriceAud: 499,
    maxUsers: 5000, maxProducts: 10000, maxStorageGb: 100,
    customDomain: true, whiteLabel: true, dedicatedSupport: false, slaUptime: 99.9,
  },
  {
    id: 'enterprise', name: 'Enterprise', monthlyPriceAud: -1,
    maxUsers: -1, maxProducts: -1, maxStorageGb: -1,
    customDomain: true, whiteLabel: true, dedicatedSupport: true, slaUptime: 99.99,
  },
];

const CURRENT_PLAN_ID: 'starter' | 'growth' | 'enterprise' = 'growth';
const CURRENT_TENANT_ID = 'default';

// Mock usage stats (would come from analytics in production)
const USAGE = {
  users: 1234,
  products: 3456,
  storageGb: 28.4,
};

function fmtAud(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n);
}
function fmtDate(ts: Timestamp | undefined) {
  if (!ts) return '—';
  try { return ts.toDate().toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub,
}: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>{value}</span>
      {sub && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{sub}</span>}
    </div>
  );
}

function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  const c = color ?? 'var(--color-primary)';
  return (
    <div style={{ width: '100%', height: 6, background: 'var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: c, transition: 'width 0.3s' }} />
    </div>
  );
}

function StatusBadge({ status }: { status: OperatorInvoice['status'] }) {
  const map: Record<OperatorInvoice['status'], { bg: string; color: string; label: string }> = {
    paid:    { bg: 'color-mix(in srgb, var(--color-success) 14%, transparent)', color: 'var(--color-success)', label: 'Paid' },
    pending: { bg: 'color-mix(in srgb, var(--color-warning) 14%, transparent)', color: 'var(--color-warning)', label: 'Pending' },
    overdue: { bg: 'color-mix(in srgb, var(--color-danger) 14%, transparent)',  color: 'var(--color-danger)',  label: 'Overdue' },
    failed:  { bg: 'color-mix(in srgb, var(--color-danger) 14%, transparent)',  color: 'var(--color-danger)',  label: 'Failed' },
  };
  const s = map[status];
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      background: s.bg, color: s.color, fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>{s.label}</span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OperatorBillingPage() {
  const [invoices, setInvoices] = useState<OperatorInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const currentPlan = useMemo(() => PLANS.find((p) => p.id === CURRENT_PLAN_ID)!, []);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'operatorInvoices'), where('tenantId', '==', CURRENT_TENANT_ID)),
        );
        setInvoices(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OperatorInvoice, 'id'>) })));
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Usage %
  const usersPct = currentPlan.maxUsers > 0 ? (USAGE.users / currentPlan.maxUsers) * 100 : 0;
  const productsPct = currentPlan.maxProducts > 0 ? (USAGE.products / currentPlan.maxProducts) * 100 : 0;
  const storagePct = currentPlan.maxStorageGb > 0 ? (USAGE.storageGb / currentPlan.maxStorageGb) * 100 : 0;
  const avgUsage = Math.round((usersPct + productsPct + storagePct) / 3);

  // Next invoice date — 30d from now (mock)
  const nextInvoice = new Date();
  nextInvoice.setDate(nextInvoice.getDate() + 30);

  return (
    <AdminLayout>
      <style>{`
        .bil-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 700px) { .bil-grid { grid-template-columns: repeat(4, 1fr); } }
        .bil-plans { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 900px) { .bil-plans { grid-template-columns: repeat(3, 1fr); } }
        .bil-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .bil-table th, .bil-table td { padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--color-border); }
        .bil-table th { font-size: 11px; text-transform: uppercase; color: var(--color-text-secondary); letterSpacing: 0.05em; font-weight: 700; }
      `}</style>

      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>Operator Billing</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Manage your subscription and billing details.
            </p>
          </div>
          <button
            onClick={() => setPaymentModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'var(--color-background)', color: 'var(--color-text)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <CreditCard size={15} /> Update Payment Method
          </button>
        </div>

        {/* Stat cards */}
        <div className="bil-grid" style={{ marginBottom: 24 }}>
          <StatCard
            label="Current Plan"
            value={
              <span style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: 20,
                background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                color: 'var(--color-primary)', fontSize: 14, fontWeight: 700,
              }}>{currentPlan.name}</span>
            }
            sub={`SLA ${currentPlan.slaUptime}% uptime`}
          />
          <StatCard
            label="Monthly Cost"
            value={currentPlan.monthlyPriceAud === -1 ? 'Custom' : fmtAud(currentPlan.monthlyPriceAud)}
            sub="Billed monthly in AUD"
          />
          <StatCard
            label="Next Invoice"
            value={nextInvoice.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
            sub={nextInvoice.toLocaleDateString('en-AU', { year: 'numeric' })}
          />
          <StatCard
            label="Usage"
            value={`${avgUsage}%`}
            sub={<ProgressBar pct={avgUsage} color={avgUsage > 80 ? 'var(--color-danger)' : 'var(--color-success)'} />}
          />
        </div>

        {/* Usage breakdown */}
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 12, padding: 20, marginBottom: 24,
        }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
            <TrendingUp size={16} /> Usage Breakdown
          </h3>
          {[
            { icon: UsersIcon, label: 'Users', used: USAGE.users, max: currentPlan.maxUsers, pct: usersPct, unit: '' },
            { icon: PackageIcon, label: 'Products', used: USAGE.products, max: currentPlan.maxProducts, pct: productsPct, unit: '' },
            { icon: HardDrive, label: 'Storage', used: USAGE.storageGb, max: currentPlan.maxStorageGb, pct: storagePct, unit: ' GB' },
          ].map(({ icon: Icon, label, used, max, pct, unit }) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text)', fontWeight: 500 }}>
                  <Icon size={14} color="var(--color-text-secondary)" /> {label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                  {used}{unit} / {max === -1 ? '∞' : `${max}${unit}`}
                </span>
              </div>
              <ProgressBar pct={pct} color={pct > 80 ? 'var(--color-danger)' : pct > 60 ? 'var(--color-warning)' : 'var(--color-primary)'} />
            </div>
          ))}
        </div>

        {/* Plans */}
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Plans</h3>
        <div className="bil-plans" style={{ marginBottom: 32 }}>
          {PLANS.map((p) => {
            const active = p.id === CURRENT_PLAN_ID;
            return (
              <div key={p.id} style={{
                background: 'var(--color-surface)',
                border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 14, padding: 22, position: 'relative',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                {active && (
                  <span style={{
                    position: 'absolute', top: -10, right: 16,
                    background: 'var(--color-primary)', color: '#fff',
                    fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>Current</span>
                )}
                <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>{p.name}</h4>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text)' }}>
                  {p.monthlyPriceAud === -1 ? 'Custom' : <>{fmtAud(p.monthlyPriceAud)}<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>/mo</span></>}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, color: 'var(--color-text)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} color="var(--color-success)" /> {p.maxUsers === -1 ? 'Unlimited' : p.maxUsers.toLocaleString()} users</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} color="var(--color-success)" /> {p.maxProducts === -1 ? 'Unlimited' : p.maxProducts.toLocaleString()} products</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} color="var(--color-success)" /> {p.maxStorageGb === -1 ? 'Unlimited' : `${p.maxStorageGb} GB`} storage</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: p.customDomain ? 1 : 0.4 }}>
                    {p.customDomain ? <Check size={14} color="var(--color-success)" /> : <X size={14} color="var(--color-text-secondary)" />} Custom domain
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: p.whiteLabel ? 1 : 0.4 }}>
                    {p.whiteLabel ? <Check size={14} color="var(--color-success)" /> : <X size={14} color="var(--color-text-secondary)" />} White-label
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: p.dedicatedSupport ? 1 : 0.4 }}>
                    {p.dedicatedSupport ? <Check size={14} color="var(--color-success)" /> : <X size={14} color="var(--color-text-secondary)" />} Dedicated support
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} color="var(--color-success)" /> {p.slaUptime}% uptime SLA</li>
                </ul>
                <button
                  disabled={active}
                  style={{
                    marginTop: 'auto', padding: '10px 16px', borderRadius: 8,
                    background: active ? 'var(--color-border)' : 'var(--color-primary)',
                    color: active ? 'var(--color-text-secondary)' : '#fff',
                    border: 'none', fontSize: 13, fontWeight: 600,
                    cursor: active ? 'default' : 'pointer',
                  }}
                >
                  {active ? 'Current Plan' : p.id === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Invoice History */}
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Invoice History</h3>
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <Loader2 size={20} className="spin" />
              <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : invoices.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <CreditCard size={32} color="var(--color-text-secondary)" style={{ marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text)', fontWeight: 600 }}>No invoices yet</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Your first billing cycle starts on signup +30 days.
              </p>
            </div>
          ) : (
            <table className="bil-table">
              <thead>
                <tr>
                  <th>Date</th><th>Period</th><th>Amount</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{fmtDate(inv.createdAt)}</td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}
                    </td>
                    <td style={{ fontWeight: 600 }}>{fmtAud(inv.amount)}</td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td>
                      {inv.downloadUrl && (
                        <a href={inv.downloadUrl} target="_blank" rel="noreferrer" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600,
                        }}>
                          <Download size={13} /> PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Payment modal */}
        {paymentModalOpen && (
          <div
            onClick={() => setPaymentModalOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--color-background)', borderRadius: 14,
                padding: 28, maxWidth: 440, width: '90%',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Update Payment Method</h3>
                <button onClick={() => setPaymentModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                  <X size={20} />
                </button>
              </div>
              <div style={{
                padding: 20, borderRadius: 10, background: 'var(--color-surface)',
                border: '1px dashed var(--color-border)', textAlign: 'center',
              }}>
                <CreditCard size={32} color="var(--color-text-secondary)" style={{ marginBottom: 10 }} />
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  Stripe payment element loads here in production.
                </p>
              </div>
              <button
                onClick={() => setPaymentModalOpen(false)}
                style={{
                  marginTop: 16, width: '100%', padding: '11px 16px', borderRadius: 8,
                  background: 'var(--color-primary)', color: '#fff', border: 'none',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Continue to Stripe
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
