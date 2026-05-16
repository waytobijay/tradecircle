/**
 * app/orders/page.tsx
 * Order history — all roles.
 * Spec ref: section 5.5 (Order History)
 *
 * Table: Order # | Date | Items | Amount | Status | Payment | [View Details]
 * Status badges: Pending | Confirmed | Shipped | Delivered | Cancelled
 * Detail modal: contact info, items, payment details, status timeline, [Download Invoice]
 *
 * Buyers  → orders where buyerId == uid
 * Sellers → orders where sellerId == uid
 * Advisors → orders where buyerId == uid (advisors can also be buyers)
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter }                                 from 'next/navigation';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import {
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  X,
  Package,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import { db }            from '@/services/firebase';
import { useAuthStore }  from '@/store/authStore';
import type { OrderStatus, PaymentGateway, ProductCurrency } from '@/types';
import BuyerLayout       from '@/components/layouts/BuyerLayout';
import SellerLayout      from '@/components/layouts/SellerLayout';
import AdvisorLayout     from '@/components/layouts/AdvisorLayout';
import InvoiceButton     from '@/components/orders/InvoiceButton';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  productId: string;
  name:      string;
  price:     number;
  quantity:  number;
  imageUrl?: string;
}

interface Order {
  id:        string;
  buyerId:   string;
  sellerId:  string;
  items:     OrderItem[];
  fullName:  string;
  phone:     string;
  email:     string;
  address: {
    street:   string;
    city:     string;
    state:    string;
    postcode: string;
    country:  string;
  };
  notes?:    string;
  amount:    number;
  taxAmount?: number;
  taxRate?:  number;
  currency:  ProductCurrency;
  gateway:   PaymentGateway;
  status:    OrderStatus;
  createdAt?: { seconds: number };
  updatedAt?: { seconds: number };
}

const CURRENCY_SYMBOL: Record<ProductCurrency, string> = {
  AUD: 'A$',
  USD: '$',
  NPR: 'रू',
  INR: '₹',
};

const GATEWAY_LABEL: Record<PaymentGateway, string> = {
  stripe:           'Stripe / Google Pay',
  eway:             'eWAY',
  esewa:            'eSewa',
  khalti:           'Khalti',
  fonepay:          'Fonepay QR',
  'contact-seller': 'Contact Seller',
};

const PAGE_SIZE = 10;

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<OrderStatus, { bg: string; color: string; label: string }> = {
  pending:   { bg: 'color-mix(in srgb, #f59e0b 14%, transparent)', color: '#f59e0b', label: 'Pending'   },
  confirmed: { bg: 'color-mix(in srgb, #3b82f6 14%, transparent)', color: '#3b82f6', label: 'Confirmed' },
  shipped:   { bg: 'color-mix(in srgb, #8b5cf6 14%, transparent)', color: '#8b5cf6', label: 'Shipped'   },
  delivered: { bg: 'color-mix(in srgb, #10b981 14%, transparent)', color: '#10b981', label: 'Delivered' },
  cancelled: { bg: 'color-mix(in srgb, #ef4444 14%, transparent)', color: '#ef4444', label: 'Cancelled' },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      style={{
        display:      'inline-block',
        padding:      '3px 10px',
        borderRadius: 'var(--radius-full)',
        background:   s.bg,
        color:        s.color,
        fontSize:     'var(--text-xs)',
        fontWeight:   700,
        whiteSpace:   'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}

// ─── Status timeline ──────────────────────────────────────────────────────────

const TIMELINE_STEPS: { status: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { status: 'pending',   label: 'Order Placed',  icon: <Clock size={16} />        },
  { status: 'confirmed', label: 'Confirmed',      icon: <CheckCircle size={16} />  },
  { status: 'shipped',   label: 'Shipped',        icon: <Truck size={16} />        },
  { status: 'delivered', label: 'Delivered',      icon: <Package size={16} />      },
];

const STATUS_ORDER: Record<OrderStatus, number> = {
  pending:   0,
  confirmed: 1,
  shipped:   2,
  delivered: 3,
  cancelled: -1,
};

function StatusTimeline({ status }: { status: OrderStatus }) {
  const currentIdx = STATUS_ORDER[status];
  const cancelled  = status === 'cancelled';

  if (cancelled) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-error, #ef4444)' }}>
        <XCircle size={20} />
        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Order Cancelled</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {TIMELINE_STEPS.map((step, i) => {
        const done    = i <= currentIdx;
        const active  = i === currentIdx;
        const color   = done ? 'var(--color-primary)' : 'var(--color-border)';

        return (
          <div key={step.status} style={{ display: 'flex', alignItems: 'center', flex: i < TIMELINE_STEPS.length - 1 ? 1 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width:          32,
                  height:         32,
                  borderRadius:   '50%',
                  background:     done ? 'var(--color-primary)' : 'var(--color-surface-2)',
                  border:         `2px solid ${color}`,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  color:          done ? '#fff' : 'var(--color-text-3)',
                  boxShadow:      active ? `0 0 0 4px color-mix(in srgb, var(--color-primary) 20%, transparent)` : 'none',
                  transition:     'background 0.3s, border-color 0.3s',
                }}
              >
                {step.icon}
              </div>
              <span
                style={{
                  fontSize:   10,
                  fontWeight: active ? 700 : 400,
                  color:      done ? 'var(--color-primary)' : 'var(--color-text-3)',
                  whiteSpace: 'nowrap',
                }}
              >
                {step.label}
              </span>
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <div
                style={{
                  flex:       1,
                  height:     2,
                  background: i < currentIdx ? 'var(--color-primary)' : 'var(--color-border)',
                  margin:     '0 4px',
                  marginBottom: 20,
                  transition: 'background 0.3s',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Invoice generator ────────────────────────────────────────────────────────

function downloadInvoice(order: Order) {
  const symbol = (CURRENCY_SYMBOL as Record<string, string>)[order.currency] ?? order.currency;
  const date   = order.createdAt
    ? new Date(order.createdAt.seconds * 1000).toLocaleDateString(undefined, { dateStyle: 'long' })
    : 'N/A';

  const itemRows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${symbol} ${item.price.toLocaleString()}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${symbol} ${(item.price * item.quantity).toLocaleString()}</td>
      </tr>`,
    )
    .join('');

  const taxRow = order.taxAmount && order.taxAmount > 0
    ? `<tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;">Tax (${order.taxRate ?? 0}%)</td><td style="padding:8px 12px;text-align:right;color:#6b7280;">${symbol} ${order.taxAmount.toFixed(2)}</td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Invoice #${order.id.slice(-8).toUpperCase()}</title>
  <style>
    body { font-family: sans-serif; color: #111; margin: 0; padding: 40px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
    .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
    .value { font-weight: 600; font-size: 14px; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th { background: #f9fafb; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; }
    .total-row td { font-weight: 700; font-size: 16px; padding: 12px; color: #4f46e5; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Invoice</h1>
      <p style="color:#6b7280;margin:0;">Order #${order.id.slice(-8).toUpperCase()}</p>
    </div>
    <div style="text-align:right;">
      <div class="label">Date</div>
      <div class="value">${date}</div>
      <div class="label" style="margin-top:12px;">Status</div>
      <div class="value">${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
    <div>
      <div class="label">Bill To</div>
      <div class="value">${order.fullName}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px;">
        ${order.email}<br/>${order.phone}
      </div>
    </div>
    <div>
      <div class="label">Deliver To</div>
      <div style="font-size:13px;color:#374151;margin-top:4px;">
        ${order.address.street}<br/>
        ${order.address.city}, ${order.address.state} ${order.address.postcode}<br/>
        ${order.address.country}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Unit Price</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${taxRow}
      <tr class="total-row">
        <td colspan="3" style="text-align:right;padding:12px;border-top:2px solid #e5e7eb;">Total</td>
        <td style="text-align:right;padding:12px;border-top:2px solid #e5e7eb;">${symbol} ${order.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top:24px;font-size:12px;color:#6b7280;">
    Payment method: ${GATEWAY_LABEL[order.gateway] ?? order.gateway}
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `invoice-${order.id.slice(-8).toUpperCase()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Order detail modal ───────────────────────────────────────────────────────

function OrderDetailModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const symbol = (CURRENCY_SYMBOL as Record<string, string>)[order.currency] ?? order.currency;
  const subtotal = order.amount - (order.taxAmount ?? 0);

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.55)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        zIndex:         1000,
        padding:        'var(--space-4)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background:   'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          width:        '100%',
          maxWidth:     600,
          maxHeight:    '90vh',
          overflowY:    'auto',
          boxShadow:    '0 24px 64px rgba(0,0,0,0.25)',
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        'var(--space-4) var(--space-5)',
            borderBottom:   '1px solid var(--color-border)',
            position:       'sticky',
            top:            0,
            background:     'var(--color-surface)',
            borderRadius:   'var(--radius-xl) var(--radius-xl) 0 0',
            zIndex:         1,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
              Order #{order.id.slice(-8).toUpperCase()}
            </h3>
            {order.createdAt && (
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-3)' }}>
                Placed {new Date(order.createdAt.seconds * 1000).toLocaleDateString(undefined, { dateStyle: 'long' })}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <StatusBadge status={order.status} />
            <button
              onClick={onClose}
              style={{
                width:          32,
                height:         32,
                borderRadius:   'var(--radius-md)',
                border:         '1px solid var(--color-border)',
                background:     'var(--color-surface-2)',
                color:          'var(--color-text-2)',
                cursor:         'pointer',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

          {/* Timeline */}
          <div>
            <p style={{ margin: '0 0 var(--space-3)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
              Status Timeline
            </p>
            <StatusTimeline status={order.status} />
          </div>

          {/* Items */}
          <div>
            <p style={{ margin: '0 0 var(--space-3)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Package size={15} style={{ color: 'var(--color-primary)' }} /> Items
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {order.items.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display:   'flex',
                    gap:       'var(--space-3)',
                    alignItems: 'center',
                    padding:   'var(--space-3)',
                    background: 'var(--color-surface-2)',
                    borderRadius: 'var(--radius-lg)',
                  }}
                >
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', objectFit: 'cover', flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-3)' }}>
                      Qty: {item.quantity} · {symbol} {item.price.toLocaleString()} each
                    </p>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-primary)', flexShrink: 0 }}>
                    {symbol} {(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            <div
              style={{
                marginTop:    'var(--space-3)',
                padding:      'var(--space-3)',
                background:   'var(--color-surface-2)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--color-text-2)', marginBottom: 'var(--space-1)' }}>
                <span>Subtotal</span>
                <span>{symbol} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {(order.taxAmount ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--color-text-2)', marginBottom: 'var(--space-1)' }}>
                  <span>Tax ({order.taxRate ?? 0}%)</span>
                  <span>{symbol} {(order.taxAmount ?? 0).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                <span>Total</span>
                <span style={{ color: 'var(--color-primary)' }}>{symbol} {order.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div
            style={{
              padding:      'var(--space-4)',
              background:   'var(--color-surface-2)',
              borderRadius: 'var(--radius-lg)',
              display:      'flex',
              alignItems:   'center',
              gap:          'var(--space-3)',
            }}
          >
            <CreditCard size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                {GATEWAY_LABEL[order.gateway] ?? order.gateway}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-3)' }}>
                Currency: {order.currency}
              </p>
            </div>
          </div>

          {/* Contact + Delivery */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            {/* Contact */}
            <div style={{ padding: 'var(--space-4)', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)' }}>
              <p style={{ margin: '0 0 var(--space-2)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                Contact
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-2)', display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
                  <Mail size={11} /> {order.email}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-2)', display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
                  <Phone size={11} /> {order.phone}
                </p>
              </div>
            </div>

            {/* Delivery */}
            <div style={{ padding: 'var(--space-4)', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)' }}>
              <p style={{ margin: '0 0 var(--space-2)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <MapPin size={13} style={{ color: 'var(--color-primary)' }} /> Delivery
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                {order.address.street}<br />
                {order.address.city}, {order.address.state} {order.address.postcode}<br />
                {order.address.country}
              </p>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)' }}>
              <p style={{ margin: '0 0 4px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Order Notes
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                {order.notes}
              </p>
            </div>
          )}

          {/* Invoice download */}
          <button
            onClick={() => downloadInvoice(order)}
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              gap:            'var(--space-2)',
              padding:        'var(--space-2) var(--space-5)',
              background:     'var(--color-surface)',
              border:         '1px solid var(--color-border)',
              borderRadius:   'var(--radius-md)',
              color:          'var(--color-text)',
              fontWeight:     600,
              fontSize:       'var(--text-sm)',
              cursor:         'pointer',
              transition:     'border-color 0.15s, color 0.15s',
              alignSelf:      'flex-start',
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = 'var(--color-primary)';
              b.style.color       = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = 'var(--color-border)';
              b.style.color       = 'var(--color-text)';
            }}
          >
            <FileText size={15} /> Download Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Table skeleton ───────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
          {[100, 160, 80, 90, 100, 80].map((w, j) => (
            <td key={j} style={{ padding: 'var(--space-4)' }}>
              <div
                style={{
                  width:        w,
                  height:       14,
                  borderRadius: 'var(--radius-sm)',
                  background:   'var(--color-surface-2)',
                  animation:    'pulse 1.4s ease-in-out infinite',
                }}
              />
            </td>
          ))}
          <td style={{ padding: 'var(--space-4)' }}>
            <div style={{ width: 80, height: 28, borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const user        = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const router      = useRouter();

  const [orders, setOrders]           = useState<Order[]>([]);
  const [loading, setLoading]         = useState(true);
  const [hasMore, setHasMore]         = useState(false);
  const [page, setPage]               = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const lastDocRef    = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const pageStackRef  = useRef<QueryDocumentSnapshot<DocumentData>[]>([]);

  const uid = user?.uid ?? '';

  // Sellers see orders for their products; buyers/advisors see orders they placed
  const filterField = user?.role === 'seller' ? 'sellerId' : 'buyerId';

  const loadPage = useCallback(async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
    if (!uid) return;
    setLoading(true);
    try {
      const q = cursor
        ? query(
            collection(db, 'orders'),
            where(filterField, '==', uid),
            orderBy('createdAt', 'desc'),
            startAfter(cursor),
            limit(PAGE_SIZE + 1),
          )
        : query(
            collection(db, 'orders'),
            where(filterField, '==', uid),
            orderBy('createdAt', 'desc'),
            limit(PAGE_SIZE + 1),
          );

      const snap = await getDocs(q);
      const docs = snap.docs.slice(0, PAGE_SIZE);

      setHasMore(snap.docs.length > PAGE_SIZE);
      lastDocRef.current = docs[docs.length - 1] ?? null;
      setOrders(docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
    } finally {
      setLoading(false);
    }
  }, [uid, filterField]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (uid) loadPage(null);
  }, [uid, loadPage]);

  function nextPage() {
    if (!lastDocRef.current) return;
    pageStackRef.current.push(lastDocRef.current);
    setPage((p) => p + 1);
    loadPage(lastDocRef.current);
  }

  function prevPage() {
    const stack = pageStackRef.current;
    stack.pop();
    const cursor = stack[stack.length - 1] ?? null;
    setPage((p) => p - 1);
    loadPage(cursor);
  }

  if (authLoading || !user) return null;

  const LayoutWrapper =
    user.role === 'seller'
      ? SellerLayout
      : user.role === 'advisor'
      ? AdvisorLayout
      : BuyerLayout;

  return (
    <LayoutWrapper>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          <ShoppingBag size={22} style={{ color: 'var(--color-primary)' }} />
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text)' }}>
            {user.role === 'seller' ? 'Received Orders' : 'My Orders'}
          </h1>
        </div>

        {/* Table card */}
        <div
          style={{
            background:   'var(--color-surface)',
            border:       '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            overflow:     'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)', borderBottom: '2px solid var(--color-border)' }}>
                  {['Order #', 'Date', 'Items', 'Amount', 'Status', 'Payment', ''].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding:       'var(--space-3) var(--space-4)',
                        textAlign:     'left',
                        fontSize:      'var(--text-xs)',
                        fontWeight:    700,
                        color:         'var(--color-text-3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        whiteSpace:    'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton />
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div style={{ padding: 'var(--space-16) var(--space-4)', textAlign: 'center' }}>
                        <ShoppingBag size={48} style={{ color: 'var(--color-text-3)', opacity: 0.3, marginBottom: 'var(--space-3)' }} />
                        <p style={{ margin: '0 0 var(--space-2)', fontWeight: 600, color: 'var(--color-text)' }}>
                          No orders yet
                        </p>
                        <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
                          {user.role === 'seller'
                            ? 'Orders from buyers will appear here.'
                            : 'Start shopping to see your orders here.'}
                        </p>
                        {user.role !== 'seller' && (
                          <a
                            href="/search"
                            style={{
                              display:        'inline-flex',
                              alignItems:     'center',
                              gap:            'var(--space-1)',
                              padding:        'var(--space-2) var(--space-5)',
                              background:     'var(--color-primary)',
                              color:          '#fff',
                              borderRadius:   'var(--radius-md)',
                              fontWeight:     700,
                              fontSize:       'var(--text-sm)',
                              textDecoration: 'none',
                            }}
                          >
                            Browse Products
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const symbol = (CURRENCY_SYMBOL as Record<string, string>)[order.currency] ?? order.currency;
                    const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
                    const firstItem = order.items[0];

                    return (
                      <tr
                        key={order.id}
                        style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-surface-2)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                      >
                        {/* Order # */}
                        <td style={{ padding: 'var(--space-4)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                          #{order.id.slice(-8).toUpperCase()}
                        </td>

                        {/* Date */}
                        <td style={{ padding: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>
                          {order.createdAt
                            ? new Date(order.createdAt.seconds * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' })
                            : '—'}
                        </td>

                        {/* Items */}
                        <td style={{ padding: 'var(--space-4)', minWidth: 180 }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                            {firstItem?.name ?? '—'}
                          </p>
                          {itemCount > 1 && (
                            <p style={{ margin: '1px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-3)' }}>
                              +{itemCount - 1} more item{itemCount - 1 !== 1 ? 's' : ''}
                            </p>
                          )}
                        </td>

                        {/* Amount */}
                        <td style={{ padding: 'var(--space-4)', fontWeight: 700, color: 'var(--color-text)', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
                          {symbol} {order.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Status */}
                        <td style={{ padding: 'var(--space-4)' }}>
                          <StatusBadge status={order.status} />
                        </td>

                        {/* Payment method */}
                        <td style={{ padding: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>
                          {GATEWAY_LABEL[order.gateway] ?? order.gateway}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: 'var(--space-4)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => setSelectedOrder(order)}
                              style={{
                                padding:      'var(--space-1) var(--space-3)',
                                background:   'var(--color-surface)',
                                border:       '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                color:        'var(--color-text)',
                                fontSize:     'var(--text-xs)',
                                fontWeight:   600,
                                cursor:       'pointer',
                                whiteSpace:   'nowrap',
                                transition:   'border-color 0.15s, color 0.15s',
                              }}
                              onMouseEnter={(e) => {
                                const b = e.currentTarget as HTMLButtonElement;
                                b.style.borderColor = 'var(--color-primary)';
                                b.style.color       = 'var(--color-primary)';
                              }}
                              onMouseLeave={(e) => {
                                const b = e.currentTarget as HTMLButtonElement;
                                b.style.borderColor = 'var(--color-border)';
                                b.style.color       = 'var(--color-text)';
                              }}
                            >
                              View Details
                            </button>
                            <InvoiceButton orderId={order.id} order={order as import('@/types').Order} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && orders.length > 0 && (
            <div
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                padding:        'var(--space-3) var(--space-4)',
                borderTop:      '1px solid var(--color-border)',
                background:     'var(--color-surface-2)',
              }}
            >
              <p style={{ margin: 0, color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
                Page {page}
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  onClick={prevPage}
                  disabled={page === 1}
                  style={{
                    display:        'inline-flex',
                    alignItems:     'center',
                    gap:            'var(--space-1)',
                    padding:        'var(--space-1) var(--space-3)',
                    background:     'var(--color-surface)',
                    border:         '1px solid var(--color-border)',
                    borderRadius:   'var(--radius-md)',
                    color:          page === 1 ? 'var(--color-text-3)' : 'var(--color-text)',
                    fontSize:       'var(--text-sm)',
                    fontWeight:     600,
                    cursor:         page === 1 ? 'not-allowed' : 'pointer',
                    opacity:        page === 1 ? 0.5 : 1,
                  }}
                >
                  <ChevronLeft size={15} /> Prev
                </button>
                <button
                  onClick={nextPage}
                  disabled={!hasMore}
                  style={{
                    display:        'inline-flex',
                    alignItems:     'center',
                    gap:            'var(--space-1)',
                    padding:        'var(--space-1) var(--space-3)',
                    background:     'var(--color-surface)',
                    border:         '1px solid var(--color-border)',
                    borderRadius:   'var(--radius-md)',
                    color:          !hasMore ? 'var(--color-text-3)' : 'var(--color-text)',
                    fontSize:       'var(--text-sm)',
                    fontWeight:     600,
                    cursor:         !hasMore ? 'not-allowed' : 'pointer',
                    opacity:        !hasMore ? 0.5 : 1,
                  }}
                >
                  Next <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
      `}</style>
    </LayoutWrapper>
  );
}
