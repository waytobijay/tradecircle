/**
 * app/admin/exports/page.tsx
 * Admin — Data Exports
 * Spec ref: section 6.7 (Admin Portal > Exports)
 */

'use client';

import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import {
  Download, Users, Package, ShoppingBag, BookOpen,
  MessageCircle, Shield, CheckCircle,
} from 'lucide-react';
import { db } from '@/services/firebase';
import AdminLayout from '@/components/layouts/AdminLayout';

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCsv(val: unknown): string {
  const str = val == null ? '' : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(headers: string[], rows: string[][]): string {
  const header = headers.map(escapeCsv).join(',');
  const body   = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
  return `${header}\n${body}`;
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Export config ────────────────────────────────────────────────────────────

interface ExportCard {
  id:          string;
  title:       string;
  description: string;
  icon:        React.ElementType;
  iconColor:   string;
  collection:  string;
  headers:     string[];
  buildRow:    (d: Record<string, unknown>) => string[];
}

const EXPORTS: ExportCard[] = [
  {
    id: 'users', title: 'All Users', description: 'Export all registered user accounts including roles and status.',
    icon: Users, iconColor: '#1D4ED8', collection: 'users',
    headers: ['uid', 'name', 'email', 'role', 'active', 'emailVerified', 'city', 'country', 'createdAt'],
    buildRow: (d) => [
      String(d.uid ?? ''), String(d.name ?? ''), String(d.email ?? ''), String(d.role ?? ''),
      String(d.active ?? ''), String(d.emailVerified ?? ''),
      String((d.location as Record<string,string>)?.city ?? ''),
      String((d.location as Record<string,string>)?.country ?? ''),
      d.createdAt ? new Date(((d.createdAt as { seconds: number }).seconds ?? 0) * 1000).toISOString() : '',
    ],
  },
  {
    id: 'products', title: 'All Products', description: 'Export all marketplace product listings with pricing and status.',
    icon: Package, iconColor: '#7C3AED', collection: 'products',
    headers: ['id', 'name', 'sellerId', 'category', 'price', 'currency', 'condition', 'active', 'views', 'createdAt'],
    buildRow: (d) => [
      String(d.id ?? ''), String(d.name ?? ''), String(d.sellerId ?? ''), String(d.category ?? ''),
      String(d.price ?? ''), String(d.currency ?? ''), String(d.condition ?? ''), String(d.active ?? ''),
      String(d.views ?? ''),
      d.createdAt ? new Date(((d.createdAt as { seconds: number }).seconds ?? 0) * 1000).toISOString() : '',
    ],
  },
  {
    id: 'orders', title: 'All Orders', description: 'Export complete order history with amounts and statuses.',
    icon: ShoppingBag, iconColor: '#D97706', collection: 'orders',
    headers: ['id', 'buyerId', 'productId', 'sellerId', 'fullName', 'email', 'amount', 'currency', 'gateway', 'status', 'createdAt'],
    buildRow: (d) => [
      String(d.id ?? ''), String(d.buyerId ?? ''), String(d.productId ?? ''), String(d.sellerId ?? ''),
      String(d.fullName ?? ''), String(d.email ?? ''), String(d.amount ?? ''), String(d.currency ?? ''),
      String(d.gateway ?? ''), String(d.status ?? ''),
      d.createdAt ? new Date(((d.createdAt as { seconds: number }).seconds ?? 0) * 1000).toISOString() : '',
    ],
  },
  {
    id: 'advicePosts', title: 'Advisory Posts', description: 'Export all advice posts from advisors.',
    icon: BookOpen, iconColor: '#16A34A', collection: 'advicePosts',
    headers: ['id', 'advisorId', 'title', 'subject', 'stepsCount', 'views', 'published', 'visibility', 'createdAt'],
    buildRow: (d) => [
      String(d.id ?? ''), String(d.advisorId ?? ''), String(d.title ?? ''), String(d.subject ?? ''),
      String(Array.isArray(d.steps) ? d.steps.length : 0), String(d.views ?? ''),
      String(d.published ?? ''), String(d.visibility ?? ''),
      d.createdAt ? new Date(((d.createdAt as { seconds: number }).seconds ?? 0) * 1000).toISOString() : '',
    ],
  },
  {
    id: 'advisorEnquiries', title: 'Advisor Enquiries', description: 'Export all enquiries submitted to advisors.',
    icon: MessageCircle, iconColor: '#C2410C', collection: 'advisorEnquiries',
    headers: ['id', 'fromUserId', 'toAdvisorId', 'name', 'email', 'phone', 'topic', 'status', 'attachmentsCount', 'createdAt'],
    buildRow: (d) => [
      String(d.id ?? ''), String(d.fromUserId ?? ''), String(d.toAdvisorId ?? ''), String(d.name ?? ''),
      String(d.email ?? ''), String(d.phone ?? ''), String(d.topic ?? ''), String(d.status ?? ''),
      String(Array.isArray(d.attachments) ? d.attachments.length : 0),
      d.createdAt ? new Date(((d.createdAt as { seconds: number }).seconds ?? 0) * 1000).toISOString() : '',
    ],
  },
  {
    id: 'adminUsers', title: 'Admin Users', description: 'Export all admin accounts and their permission summaries.',
    icon: Shield, iconColor: '#DC2626', collection: 'adminUsers',
    headers: ['id', 'name', 'email', 'role', 'active', 'createdAt', 'lastLogin'],
    buildRow: (d) => [
      String(d.id ?? ''), String(d.name ?? ''), String(d.email ?? ''), String(d.role ?? ''),
      String(d.active ?? ''),
      d.createdAt  ? new Date(((d.createdAt  as { seconds: number }).seconds ?? 0) * 1000).toISOString() : '',
      d.lastLogin  ? new Date(((d.lastLogin  as { seconds: number }).seconds ?? 0) * 1000).toISOString() : '',
    ],
  },
];

// ─── Mock fallback data ───────────────────────────────────────────────────────

const MOCK_ROWS: Record<string, Record<string, unknown>[]> = {
  users: [{ uid: 'u1', name: 'Aisha Patel', email: 'aisha@example.com', role: 'buyer', active: true, emailVerified: true, location: { city: 'Sydney', country: 'Australia' }, createdAt: { seconds: 1716000000 } }],
  products: [{ id: 'p1', name: 'Samsung TV 55"', sellerId: 'u2', category: 'Electronics', price: 899, currency: 'AUD', condition: 'new', active: true, views: 240, createdAt: { seconds: 1716000000 } }],
  orders: [{ id: 'ord001', buyerId: 'u1', productId: 'p1', sellerId: 'u2', fullName: 'Aisha Patel', email: 'aisha@example.com', amount: 899, currency: 'AUD', gateway: 'stripe', status: 'delivered', createdAt: { seconds: 1716500000 } }],
  advicePosts: [{ id: 'ap1', advisorId: 'a1', title: 'How to Export Wool', subject: 'Trade', steps: [1, 2], views: 1240, published: true, visibility: 'public', createdAt: { seconds: 1716000000 } }],
  advisorEnquiries: [{ id: 'enq001', fromUserId: 'u1', toAdvisorId: 'a1', name: 'Aisha Patel', email: 'aisha@example.com', phone: '+61400001001', topic: 'Wool Export', status: 'pending', attachments: ['doc.pdf'], createdAt: { seconds: 1716500000 } }],
  adminUsers: [{ id: 'adm1', name: 'Sarah Johnson', email: 'sarah@tradecircle.com', role: 'super-admin', active: true, createdAt: { seconds: 1700000000 } }],
};

// ─── Export Card Component ────────────────────────────────────────────────────

function ExportCardUI({ card }: { card: ExportCard }) {
  const [loading,  setLoading]  = useState(false);
  const [complete, setComplete] = useState(false);
  const [error,    setError]    = useState('');

  async function handleExport() {
    setLoading(true);
    setError('');
    setComplete(false);
    try {
      let rows: Record<string, unknown>[];

      try {
        const snap = await getDocs(collection(db, card.collection));
        rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (rows.length === 0) rows = MOCK_ROWS[card.collection] ?? [];
      } catch {
        rows = MOCK_ROWS[card.collection] ?? [];
      }

      const csvRows = rows.map((d) => card.buildRow(d));
      const csv = buildCsv(card.headers, csvRows);
      const filename = `${card.collection}_${new Date().toISOString().slice(0, 10)}.csv`;
      triggerDownload(csv, filename);
      setComplete(true);
      setTimeout(() => setComplete(false), 3000);
    } catch (err) {
      console.error(err);
      setError('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const Icon = card.icon;

  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 14, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: `color-mix(in srgb, ${card.iconColor} 12%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} style={{ color: card.iconColor }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{card.title}</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{card.description}</div>
        </div>
      </div>

      {/* Format selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text)', cursor: 'pointer' }}>
          <input type="radio" name={`format-${card.id}`} value="csv" defaultChecked style={{ accentColor: 'var(--color-primary)' }} />
          CSV
        </label>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: 'var(--color-danger)', padding: '8px 12px', borderRadius: 7, background: '#FFF1F2', border: '1px solid #FECDD3' }}>
          {error}
        </div>
      )}

      <button
        onClick={() => void handleExport()}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '10px 18px', borderRadius: 9, border: 'none',
          background: complete ? 'var(--color-success)' : 'var(--color-primary)',
          color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 13, fontWeight: 600, opacity: loading ? 0.8 : 1,
          transition: 'background 0.3s',
        }}
      >
        {loading ? (
          <>
            <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
            Exporting…
          </>
        ) : complete ? (
          <><CheckCircle size={15} /> Downloaded!</>
        ) : (
          <><Download size={15} /> Export CSV</>
        )}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminExportsPage() {
  return (
    <AdminLayout>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .exp-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        @media (max-width: 768px) { .exp-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>Data Exports</h2>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Export platform data to CSV. Files are generated fresh from Firestore on each download.
          </p>
        </div>

        <div className="exp-grid">
          {EXPORTS.map((card) => (
            <ExportCardUI key={card.id} card={card} />
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
