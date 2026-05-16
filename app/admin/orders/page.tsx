/**
 * app/admin/orders/page.tsx
 * Admin — Orders management
 * Spec ref: section 6.7 (Admin Portal)
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection, getDocs, doc, updateDoc,
  query, orderBy, limit, startAfter,
  QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore';
import {
  ChevronLeft, ChevronRight, X, Package,
  MapPin, CreditCard, Clock, ChevronDown,
} from 'lucide-react';
import { db } from '@/services/firebase';
import AdminLayout from '@/components/layouts/AdminLayout';
import type { Order, OrderStatus } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: 'All' | OrderStatus; label: string }> = [
  { value: 'All',       label: 'All Statuses'  },
  { value: 'pending',   label: 'Pending'        },
  { value: 'confirmed', label: 'Confirmed'      },
  { value: 'shipped',   label: 'Shipped'        },
  { value: 'delivered', label: 'Delivered'      },
  { value: 'cancelled', label: 'Cancelled'      },
];

const STATUS_COLORS: Record<OrderStatus, { bg: string; color: string }> = {
  pending:   { bg: 'color-mix(in srgb, var(--color-warning) 15%, transparent)',  color: 'var(--color-warning)'  },
  confirmed: { bg: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',  color: 'var(--color-primary)'  },
  shipped:   { bg: 'color-mix(in srgb, #7c3aed 12%, transparent)',               color: '#7c3aed'               },
  delivered: { bg: 'color-mix(in srgb, var(--color-success) 12%, transparent)',  color: 'var(--color-success)'  },
  cancelled: { bg: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',   color: 'var(--color-danger)'   },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrderStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 10px',
      borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: c.bg, color: c.color, textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      flex: '1 1 160px', padding: '16px 20px',
      background: 'var(--color-surface)', borderRadius: 12,
      border: '1px solid var(--color-border)',
    }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--color-text)' }}>{value}</div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} style={{ padding: '12px 14px' }}>
          <div style={{
            height: 14, borderRadius: 6, background: 'var(--color-border)',
            width: i === 0 ? '60px' : '85%',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Order Detail Side Panel ──────────────────────────────────────────────────

interface SidePanelProps {
  order: Order;
  onClose: () => void;
  onStatusChange: (id: string, status: OrderStatus) => void;
}

function OrderSidePanel({ order, onClose, onStatusChange }: SidePanelProps) {
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [localStatus, setLocalStatus]       = useState<OrderStatus>(order.status);

  async function handleStatusChange(newStatus: OrderStatus) {
    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'orders', order.id), { status: newStatus, updatedAt: new Date() });
      setLocalStatus(newStatus);
      onStatusChange(order.id, newStatus);
    } catch (err) {
      console.error('Failed to update order status', err);
    } finally {
      setUpdatingStatus(false);
    }
  }

  function formatDate(ts: Order['createdAt']) {
    try { return ts.toDate().toLocaleString(); } catch { return '—'; }
  }

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 7, border: '1px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text)',
    fontSize: 13, outline: 'none',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 400 }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 440, maxWidth: '95vw',
        background: 'var(--color-background)',
        borderLeft: '1px solid var(--color-border)',
        zIndex: 401, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        animation: 'slideIn 0.22s ease',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Panel header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Order Details</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2, fontFamily: 'monospace' }}>
              #{order.id.slice(0, 12).toUpperCase()}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4, borderRadius: 6, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Panel body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* Status update */}
          <div style={{ marginBottom: 20, padding: 14, background: 'var(--color-surface)', borderRadius: 10, border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Update Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusBadge status={localStatus} />
              <select
                value={localStatus}
                onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
                disabled={updatingStatus}
                style={{ ...inputStyle, flex: 1 }}
              >
                {STATUS_OPTIONS.filter((s) => s.value !== 'All').map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Buyer info */}
          <Section title="Buyer Information">
            <Row label="Name"    value={order.fullName} />
            <Row label="Email"   value={order.email}    />
            <Row label="Phone"   value={order.phone}    />
            <Row label="Notes"   value={order.notes ?? '—'} />
          </Section>

          {/* Address */}
          <Section title="Delivery Address" icon={<MapPin size={14} />}>
            <Row label="Street"   value={order.address.street}   />
            <Row label="City"     value={order.address.city}     />
            <Row label="State"    value={order.address.state}    />
            <Row label="Postcode" value={order.address.postcode} />
            <Row label="Country"  value={order.address.country}  />
          </Section>

          {/* Payment */}
          <Section title="Payment" icon={<CreditCard size={14} />}>
            <Row label="Amount"  value={`${order.currency} ${order.amount?.toLocaleString()}`} bold />
            <Row label="Gateway" value={order.gateway} />
            {order.taxRate != null && <Row label="Tax Rate" value={`${order.taxRate}%`} />}
            {order.taxAmount != null && <Row label="Tax Amount" value={`${order.currency} ${order.taxAmount?.toLocaleString()}`} />}
          </Section>

          {/* Timeline */}
          <Section title="Timeline" icon={<Clock size={14} />}>
            <Row label="Created"  value={formatDate(order.createdAt)} />
            <Row label="Updated"  value={formatDate(order.updatedAt)} />
          </Section>

          {/* IDs */}
          <Section title="References">
            <Row label="Order ID"   value={order.id}        mono />
            <Row label="Buyer ID"   value={order.buyerId}   mono />
            <Row label="Product ID" value={order.productId} mono />
            <Row label="Seller ID"  value={order.sellerId}  mono />
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {icon && <span style={{ color: 'var(--color-text-secondary)' }}>{icon}</span>}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      </div>
      <div style={{ background: 'var(--color-surface)', borderRadius: 10, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
      <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0, marginRight: 12 }}>{label}</span>
      <span style={{
        color: 'var(--color-text)', fontWeight: bold ? 700 : 400,
        fontFamily: mono ? 'monospace' : undefined, fontSize: mono ? 11 : 13,
        wordBreak: 'break-all', textAlign: 'right',
      }}>{value}</span>
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

interface OrderRow extends Order {
  buyerName: string;
  productName: string;
}

async function fetchName(collection_: string, id: string, field: string): Promise<string> {
  try {
    const { getDoc, doc: firestoreDoc } = await import('firebase/firestore');
    const snap = await getDoc(firestoreDoc(db, collection_, id));
    if (snap.exists()) return (snap.data() as Record<string, string>)[field] ?? id;
  } catch { /* ignore */ }
  return id;
}

export default function AdminOrdersPage() {
  const [orders, setOrders]             = useState<OrderRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatus>('All');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [page, setPage]                 = useState(0);
  const [pageStack, setPageStack]       = useState<Array<QueryDocumentSnapshot<DocumentData> | null>>([null]);
  const [lastDoc, setLastDoc]           = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore]           = useState(false);

  // Summary stats
  const [totalCount, setTotalCount]     = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);

  const loadPage = useCallback(async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
    setLoading(true);
    try {
      const constraints = [orderBy('createdAt', 'desc'), limit(PAGE_SIZE)];
      if (cursor) constraints.push(startAfter(cursor) as never);

      const snap = await getDocs(query(collection(db, 'orders'), ...constraints));
      let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderRow));

      // Client-side filters
      if (statusFilter !== 'All') rows = rows.filter((o) => o.status === statusFilter);
      if (dateFrom) {
        const from = new Date(dateFrom).getTime();
        rows = rows.filter((o) => { try { return o.createdAt.toDate().getTime() >= from; } catch { return true; } });
      }
      if (dateTo) {
        const to = new Date(dateTo).getTime() + 86400000;
        rows = rows.filter((o) => { try { return o.createdAt.toDate().getTime() <= to; } catch { return true; } });
      }

      // Enrich with buyer name and product name
      const buyerIds   = [...new Set(rows.map((o) => o.buyerId))];
      const productIds = [...new Set(rows.map((o) => o.productId))];
      const [buyerNames, productNames] = await Promise.all([
        Promise.all(buyerIds.map((id) => fetchName('users', id, 'name').then((n) => [id, n]))),
        Promise.all(productIds.map((id) => fetchName('products', id, 'name').then((n) => [id, n]))),
      ]);
      const buyerMap   = Object.fromEntries(buyerNames   as [string, string][]);
      const productMap = Object.fromEntries(productNames as [string, string][]);
      rows = rows.map((o) => ({ ...o, buyerName: buyerMap[o.buyerId] ?? o.buyerId, productName: productMap[o.productId] ?? o.productId }));

      setOrders(rows);
      setHasMore(snap.docs.length === PAGE_SIZE);
      if (snap.docs.length > 0) setLastDoc(snap.docs[snap.docs.length - 1]);
      else setLastDoc(null);

      // Compute stats from all loaded
      setTotalCount((prev) => (cursor ? prev : snap.docs.length));
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      let rev = 0;
      let pend = 0;
      snap.docs.forEach((d) => {
        const o = d.data() as Order;
        try { if (o.createdAt.toDate().getTime() >= monthStart && o.status !== 'cancelled') rev += o.amount ?? 0; } catch { /* ignore */ }
        if (o.status === 'pending') pend++;
      });
      if (!cursor) {
        setMonthRevenue(rev);
        setPendingCount(pend);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    setPage(0);
    setPageStack([null]);
    loadPage(null);
  }, [statusFilter, dateFrom, dateTo]);

  function goNext() {
    const newStack = [...pageStack, lastDoc];
    setPageStack(newStack);
    setPage((p) => p + 1);
    loadPage(lastDoc);
  }

  function goPrev() {
    const newStack = pageStack.slice(0, -1);
    setPageStack(newStack);
    const cursor = newStack[newStack.length - 1] ?? null;
    setPage((p) => p - 1);
    loadPage(cursor);
  }

  function handleStatusChange(id: string, status: OrderStatus) {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
    if (selectedOrder?.id === id) setSelectedOrder((prev) => prev ? { ...prev, status } : prev);
  }

  function formatDate(ts: Order['createdAt']) {
    try { return ts.toDate().toLocaleDateString(); } catch { return '—'; }
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text)',
    fontSize: 13, outline: 'none', height: 36,
  };

  return (
    <AdminLayout>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .ord-row:hover td { background: var(--color-surface); }
        .act-btn { background:none;border:none;cursor:pointer;padding:6px 12px;border-radius:7px;
          color:var(--color-primary);border:1px solid var(--color-border);font-size:12px;
          font-weight:600;display:inline-flex;align-items:center;gap:4px; }
        .act-btn:hover { background:var(--color-surface); }
      `}</style>

      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>Orders</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            View and manage all customer orders
          </p>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
          <StatCard label="Total Orders" value={totalCount} />
          <StatCard label="Revenue This Month" value={`$${monthRevenue.toLocaleString()}`} color="var(--color-success)" />
          <StatCard label="Pending Orders" value={pendingCount} color="var(--color-warning)" />
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16,
          padding: 16, background: 'var(--color-surface)',
          borderRadius: 10, border: '1px solid var(--color-border)',
        }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'All' | OrderStatus)}
            style={inputStyle}
          >
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>From</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>To</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{
              background: 'none', border: '1px solid var(--color-border)', borderRadius: 7,
              cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)',
              padding: '0 10px', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <X size={13} /> Clear dates
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{
          background: 'var(--color-surface)', borderRadius: 12,
          border: '1px solid var(--color-border)', overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Order #', 'Date', 'Buyer', 'Product', 'Amount', 'Gateway', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '48px 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🛍️</div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>No orders found</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your filters</div>
                    </td>
                  </tr>
                ) : orders.map((order) => (
                  <tr key={order.id} className="ord-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      #{order.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDate(order.createdAt)}
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--color-text)', fontWeight: 500 }}>
                      {order.buyerName}
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--color-text)', maxWidth: 160 }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.productName}</div>
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--color-text)', fontWeight: 700 }}>
                      {order.currency} {order.amount?.toLocaleString()}
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
                      {order.gateway}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <StatusBadge status={order.status} />
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <button
                        className="act-btn"
                        onClick={() => setSelectedOrder(order)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderTop: '1px solid var(--color-border)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Page {page + 1}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={goPrev} disabled={page === 0} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 7, border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', color: 'var(--color-text)',
                fontSize: 13, cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1,
              }}>
                <ChevronLeft size={14} /> Prev
              </button>
              <button onClick={goNext} disabled={!hasMore} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 7, border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', color: 'var(--color-text)',
                fontSize: 13, cursor: !hasMore ? 'not-allowed' : 'pointer', opacity: !hasMore ? 0.4 : 1,
              }}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Side panel */}
      {selectedOrder && (
        <OrderSidePanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </AdminLayout>
  );
}
