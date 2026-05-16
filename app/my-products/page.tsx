/**
 * app/my-products/page.tsx
 * Seller listings dashboard.
 * Spec ref: section 4.3 (Seller Dashboard)
 *
 * Layout:
 *  - Stats row: Total Listings | Active | Views This Week | Enquiries
 *  - [+ List New Product] CTA
 *  - Paginated product table:
 *      Thumbnail | Name | Price | Status | Date | Actions (Edit / Toggle / Delete)
 *  - Empty state when no products
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link                                          from 'next/link';
import { useRouter }                                 from 'next/navigation';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import {
  Package,
  Plus,
  Eye,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import { db }             from '@/services/firebase';
import { useAuthStore }   from '@/store/authStore';
import { RoleGuard }      from '@/components/guards/RoleGuard';
import SellerLayout       from '@/components/layouts/SellerLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id:         string;
  name:       string;
  price:      number;
  images:     string[];
  category:   string;
  condition:  string;
  city?:      string;
  active:     boolean;
  views?:     number;
  enquiries?: number;
  createdAt?: { seconds: number };
}

interface Stats {
  total:        number;
  active:       number;
  viewsThisWeek: number;
  enquiries:    number;
}

const PAGE_SIZE = 10;

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  loading,
}: {
  label:   string;
  value:   number;
  icon:    React.ReactNode;
  loading: boolean;
}) {
  return (
    <div
      style={{
        background:   'var(--color-surface)',
        border:       '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding:      'var(--space-4)',
        display:      'flex',
        alignItems:   'center',
        gap:          'var(--space-3)',
      }}
    >
      <div
        style={{
          width:          44,
          height:         44,
          borderRadius:   'var(--radius-lg)',
          background:     'color-mix(in srgb, var(--color-primary) 12%, transparent)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          color:          'var(--color-primary)',
          flexShrink:     0,
        }}
      >
        {icon}
      </div>
      <div>
        {loading ? (
          <div
            style={{
              width:        60,
              height:       24,
              borderRadius: 'var(--radius-md)',
              background:   'var(--color-surface-2)',
              animation:    'pulse 1.4s ease-in-out infinite',
            }}
          />
        ) : (
          <p style={{ margin: 0, fontWeight: 800, fontSize: 'var(--text-2xl)', color: 'var(--color-text)', lineHeight: 1 }}>
            {value.toLocaleString()}
          </p>
        )}
        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-3)', fontWeight: 500 }}>
          {label}
        </p>
      </div>
    </div>
  );
}

// ─── Delete confirm dialog ────────────────────────────────────────────────────

function DeleteDialog({
  productName,
  onConfirm,
  onCancel,
  deleting,
}: {
  productName: string;
  onConfirm:   () => void;
  onCancel:    () => void;
  deleting:    boolean;
}) {
  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.5)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        zIndex:         1000,
        padding:        'var(--space-4)',
      }}
    >
      <div
        style={{
          background:   'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          padding:      'var(--space-6)',
          maxWidth:     420,
          width:        '100%',
          boxShadow:    '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            width:          48,
            height:         48,
            borderRadius:   '50%',
            background:     'color-mix(in srgb, var(--color-error, #ef4444) 12%, transparent)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            margin:         '0 auto var(--space-4)',
          }}
        >
          <Trash2 size={22} style={{ color: 'var(--color-error, #ef4444)' }} />
        </div>
        <h3 style={{ margin: '0 0 var(--space-2)', textAlign: 'center', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
          Delete Listing?
        </h3>
        <p style={{ margin: '0 0 var(--space-5)', textAlign: 'center', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--color-text)' }}>{productName}</strong> will be permanently removed.
          This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            onClick={onCancel}
            style={{
              flex:         1,
              padding:      'var(--space-2)',
              background:   'var(--color-surface-2)',
              border:       '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color:        'var(--color-text-2)',
              fontSize:     'var(--text-sm)',
              fontWeight:   600,
              cursor:       'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{
              flex:         1,
              padding:      'var(--space-2)',
              background:   'var(--color-error, #ef4444)',
              border:       'none',
              borderRadius: 'var(--radius-md)',
              color:        '#fff',
              fontSize:     'var(--text-sm)',
              fontWeight:   600,
              cursor:       deleting ? 'not-allowed' : 'pointer',
              opacity:      deleting ? 0.7 : 1,
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              gap:          'var(--space-2)',
            }}
          >
            {deleting && <Loader2 size={14} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Product row ──────────────────────────────────────────────────────────────

function ProductRow({
  product,
  currency,
  onToggle,
  onDelete,
}: {
  product:  Product;
  currency: string;
  onToggle: (id: string, current: boolean) => Promise<void>;
  onDelete: (product: Product) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const router = useRouter();

  async function handleToggle() {
    setToggling(true);
    try {
      await onToggle(product.id, product.active);
    } finally {
      setToggling(false);
    }
  }

  const formattedDate = product.createdAt
    ? new Date(product.createdAt.seconds * 1000).toLocaleDateString(undefined, {
        day:   '2-digit',
        month: 'short',
        year:  'numeric',
      })
    : '—';

  return (
    <tr
      style={{
        borderBottom: '1px solid var(--color-border)',
        transition:   'background 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-surface-2)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
    >
      {/* Thumbnail */}
      <td style={{ padding: 'var(--space-3)', width: 60 }}>
        <div
          style={{
            width:        52,
            height:       52,
            borderRadius: 'var(--radius-md)',
            overflow:     'hidden',
            background:   'var(--color-surface-2)',
            flexShrink:   0,
          }}
        >
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width:          '100%',
                height:         '100%',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                color:          'var(--color-text-3)',
              }}
            >
              <Package size={20} />
            </div>
          )}
        </div>
      </td>

      {/* Name + category */}
      <td style={{ padding: 'var(--space-3)', minWidth: 180 }}>
        <Link
          href={`/products/${product.id}`}
          style={{
            display:        'block',
            fontWeight:     600,
            fontSize:       'var(--text-sm)',
            color:          'var(--color-text)',
            textDecoration: 'none',
            overflow:       'hidden',
            textOverflow:   'ellipsis',
            whiteSpace:     'nowrap',
            maxWidth:       240,
          }}
        >
          {product.name}
        </Link>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-3)' }}>
          {product.category}{product.city ? ` · ${product.city}` : ''}
        </p>
      </td>

      {/* Price */}
      <td style={{ padding: 'var(--space-3)', whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: 'var(--text-sm)' }}>
          {currency} {product.price.toLocaleString()}
        </span>
      </td>

      {/* Status badge */}
      <td style={{ padding: 'var(--space-3)' }}>
        <span
          style={{
            display:      'inline-block',
            padding:      '2px 10px',
            borderRadius: 'var(--radius-full)',
            fontSize:     'var(--text-xs)',
            fontWeight:   700,
            background:   product.active
              ? 'color-mix(in srgb, var(--color-success, #10b981) 14%, transparent)'
              : 'color-mix(in srgb, var(--color-text-3) 14%, transparent)',
            color: product.active
              ? 'var(--color-success, #10b981)'
              : 'var(--color-text-3)',
          }}
        >
          {product.active ? 'Active' : 'Inactive'}
        </span>
      </td>

      {/* Views */}
      <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {(product.views ?? 0).toLocaleString()}
      </td>

      {/* Date */}
      <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>
        {formattedDate}
      </td>

      {/* Actions */}
      <td style={{ padding: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
          {/* Edit */}
          <button
            onClick={() => router.push(`/products/${product.id}/edit`)}
            title="Edit"
            style={{
              width:          32,
              height:         32,
              borderRadius:   'var(--radius-md)',
              border:         '1px solid var(--color-border)',
              background:     'var(--color-surface)',
              color:          'var(--color-text-2)',
              cursor:         'pointer',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              transition:     'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = 'var(--color-primary)';
              b.style.color       = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = 'var(--color-border)';
              b.style.color       = 'var(--color-text-2)';
            }}
          >
            <Edit2 size={14} />
          </button>

          {/* Toggle active */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            title={product.active ? 'Deactivate' : 'Activate'}
            style={{
              width:          32,
              height:         32,
              borderRadius:   'var(--radius-md)',
              border:         '1px solid var(--color-border)',
              background:     'var(--color-surface)',
              color:          product.active ? 'var(--color-success, #10b981)' : 'var(--color-text-3)',
              cursor:         toggling ? 'not-allowed' : 'pointer',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              opacity:        toggling ? 0.6 : 1,
              transition:     'border-color 0.15s',
            }}
          >
            {toggling
              ? <Loader2 size={14} />
              : product.active
              ? <ToggleRight size={16} />
              : <ToggleLeft  size={16} />
            }
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(product)}
            title="Delete"
            style={{
              width:          32,
              height:         32,
              borderRadius:   'var(--radius-md)',
              border:         '1px solid var(--color-border)',
              background:     'var(--color-surface)',
              color:          'var(--color-text-3)',
              cursor:         'pointer',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              transition:     'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = 'var(--color-error, #ef4444)';
              b.style.color       = 'var(--color-error, #ef4444)';
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = 'var(--color-border)';
              b.style.color       = 'var(--color-text-3)';
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Table skeleton ───────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
          <td style={{ padding: 'var(--space-3)' }}>
            <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
          </td>
          {[200, 80, 70, 50, 80, 90].map((w, j) => (
            <td key={j} style={{ padding: 'var(--space-3)' }}>
              <div style={{ width: w, height: 16, borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyProductsPage() {
  const user = useAuthStore((s) => s.user);

  const [products, setProducts]       = useState<Product[]>([]);
  const [stats, setStats]             = useState<Stats>({ total: 0, active: 0, viewsThisWeek: 0, enquiries: 0 });
  const [loading, setLoading]         = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [currency, setCurrency]       = useState('$');
  const [hasMore, setHasMore]         = useState(false);
  const [page, setPage]               = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting]       = useState(false);

  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const firstDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const pageStackRef = useRef<QueryDocumentSnapshot<DocumentData>[]>([]);

  const uid = user?.uid ?? '';

  // Load currency
  useEffect(() => {
    getDoc(doc(db, 'config', 'site')).then((snap) => {
      if (snap.exists()) setCurrency(snap.data().currencySymbol ?? '$');
    });
  }, []);

  // Load stats
  useEffect(() => {
    if (!uid) return;
    async function loadStats() {
      setStatsLoading(true);
      try {
        const allSnap = await getDocs(
          query(collection(db, 'products'), where('sellerId', '==', uid)),
        );

        const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
        let totalViews  = 0;
        let activeCount = 0;
        let enquiryCount = 0;

        allSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.active) activeCount++;
          totalViews   += data.views ?? 0;
          enquiryCount += data.enquiries ?? 0;
        });

        // Views this week: filter by createdAt proxy (views field refreshed weekly ideally)
        const recentSnap = await getDocs(
          query(
            collection(db, 'products'),
            where('sellerId', '==', uid),
            where('lastViewedAt', '>=', { seconds: Math.floor(weekAgoMs / 1000), nanoseconds: 0 }),
          ),
        ).catch(() => null);

        setStats({
          total:         allSnap.size,
          active:        activeCount,
          viewsThisWeek: recentSnap?.size ?? totalViews,
          enquiries:     enquiryCount,
        });
      } finally {
        setStatsLoading(false);
      }
    }
    loadStats();
  }, [uid]);

  // Load first page
  const loadPage = useCallback(async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
    if (!uid) return;
    setLoading(true);
    try {
      const q = cursor
        ? query(
            collection(db, 'products'),
            where('sellerId', '==', uid),
            orderBy('createdAt', 'desc'),
            startAfter(cursor),
            limit(PAGE_SIZE + 1),
          )
        : query(
            collection(db, 'products'),
            where('sellerId', '==', uid),
            orderBy('createdAt', 'desc'),
            limit(PAGE_SIZE + 1),
          );

      const snap = await getDocs(q);
      const docs = snap.docs.slice(0, PAGE_SIZE);

      setHasMore(snap.docs.length > PAGE_SIZE);
      lastDocRef.current = docs[docs.length - 1] ?? null;

      setProducts(docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadPage(null);
  }, [loadPage]);

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

  // Toggle active
  async function handleToggle(id: string, current: boolean) {
    await updateDoc(doc(db, 'products', id), { active: !current });
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !current } : p)),
    );
    setStats((s) => ({
      ...s,
      active: current ? s.active - 1 : s.active + 1,
    }));
  }

  // Delete
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'products', deleteTarget.id));
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setStats((s) => ({
        ...s,
        total:  s.total - 1,
        active: deleteTarget.active ? s.active - 1 : s.active,
      }));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <RoleGuard allowedRoles={['seller']}>
      <SellerLayout>
        <div
          style={{
            maxWidth: 1100,
            margin:   '0 auto',
            padding:  'var(--space-6) var(--space-4)',
          }}
        >

          {/* Header */}
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              marginBottom:   'var(--space-6)',
              flexWrap:       'wrap',
              gap:            'var(--space-3)',
            }}
          >
            <div>
              <h1
                style={{
                  margin:     0,
                  fontSize:   'var(--text-2xl)',
                  fontWeight: 800,
                  color:      'var(--color-text)',
                }}
              >
                My Products
              </h1>
              <p style={{ margin: '4px 0 0', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
                Manage your listings — edit, toggle visibility, or remove products.
              </p>
            </div>

            <Link
              href="/products/new"
              style={{
                display:        'inline-flex',
                alignItems:     'center',
                gap:            'var(--space-2)',
                padding:        'var(--space-2) var(--space-5)',
                background:     'var(--color-primary)',
                color:          '#fff',
                borderRadius:   'var(--radius-md)',
                fontWeight:     700,
                fontSize:       'var(--text-sm)',
                textDecoration: 'none',
                flexShrink:     0,
                transition:     'opacity 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.88'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
            >
              <Plus size={16} />
              List New Product
            </Link>
          </div>

          {/* Stats row */}
          <div
            style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap:                 'var(--space-3)',
              marginBottom:        'var(--space-6)',
            }}
          >
            <StatCard label="Total Listings"   value={stats.total}         icon={<Package size={20} />}      loading={statsLoading} />
            <StatCard label="Active"            value={stats.active}        icon={<ToggleRight size={20} />}  loading={statsLoading} />
            <StatCard label="Views This Week"   value={stats.viewsThisWeek} icon={<TrendingUp size={20} />}   loading={statsLoading} />
            <StatCard label="Enquiries"         value={stats.enquiries}     icon={<MessageSquare size={20} />} loading={statsLoading} />
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
                  <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                    <th style={{ padding: 'var(--space-3)', width: 60 }} />
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Product
                    </th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                      Price
                    </th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Status
                    </th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'right', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                      Views
                    </th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Listed
                    </th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeleton />
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div
                          style={{
                            padding:   'var(--space-16) var(--space-4)',
                            textAlign: 'center',
                          }}
                        >
                          <Package
                            size={48}
                            style={{ color: 'var(--color-text-3)', marginBottom: 'var(--space-3)', opacity: 0.4 }}
                          />
                          <p style={{ margin: '0 0 var(--space-2)', fontWeight: 600, color: 'var(--color-text)', fontSize: 'var(--text-base)' }}>
                            No products yet
                          </p>
                          <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
                            Start by listing your first product.
                          </p>
                          <Link
                            href="/products/new"
                            style={{
                              display:        'inline-flex',
                              alignItems:     'center',
                              gap:            'var(--space-2)',
                              padding:        'var(--space-2) var(--space-5)',
                              background:     'var(--color-primary)',
                              color:          '#fff',
                              borderRadius:   'var(--radius-md)',
                              fontWeight:     700,
                              fontSize:       'var(--text-sm)',
                              textDecoration: 'none',
                            }}
                          >
                            <Plus size={15} /> List a Product
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        currency={currency}
                        onToggle={handleToggle}
                        onDelete={setDeleteTarget}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && products.length > 0 && (
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

        {/* Delete confirm dialog */}
        {deleteTarget && (
          <DeleteDialog
            productName={deleteTarget.name}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
            deleting={deleting}
          />
        )}

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.45; }
          }
        `}</style>
      </SellerLayout>
    </RoleGuard>
  );
}
