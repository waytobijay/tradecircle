/**
 * app/admin/products/page.tsx
 * Admin — Products management
 * Spec ref: section 6.7 (Admin Portal)
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection, getDocs, doc, updateDoc, deleteDoc,
  query, orderBy, limit, startAfter, QueryDocumentSnapshot,
  DocumentData, where, QueryConstraint,
} from 'firebase/firestore';
import {
  Search, ChevronLeft, ChevronRight, Trash2, Edit2,
  ToggleLeft, ToggleRight, X, AlertTriangle, CheckSquare,
  Square, Minus,
} from 'lucide-react';
import { db } from '@/services/firebase';
import AdminLayout from '@/components/layouts/AdminLayout';
import type { Product } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const CATEGORIES = [
  'All Categories', 'Electronics', 'Clothing', 'Home & Garden',
  'Sports', 'Vehicles', 'Food & Beverage', 'Books', 'Toys', 'Other',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: active
        ? 'color-mix(in srgb, var(--color-success) 12%, transparent)'
        : 'color-mix(in srgb, var(--color-text-secondary) 12%, transparent)',
      color: active ? 'var(--color-success)' : 'var(--color-text-secondary)',
    }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} style={{ padding: '12px 14px' }}>
          <div style={{
            height: 14, borderRadius: 6, background: 'var(--color-border)',
            width: i === 2 ? '80%' : i === 0 ? '60px' : '90%',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

interface ConfirmModalProps {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ count, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: 'var(--color-background)', borderRadius: 14,
        border: '1px solid var(--color-border)',
        padding: 28, width: 380, maxWidth: '90vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <AlertTriangle size={22} color="var(--color-danger)" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
            Confirm Delete
          </h3>
        </div>
        <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          {count === 1
            ? 'This will permanently delete this product. This action cannot be undone.'
            : `This will permanently delete ${count} products. This action cannot be undone.`}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 18px', borderRadius: 8, border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', color: 'var(--color-text)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none',
            background: 'var(--color-danger)', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Seller name cache ────────────────────────────────────────────────────────

async function fetchSellerName(sellerId: string): Promise<string> {
  try {
    const { getDoc, doc: firestoreDoc } = await import('firebase/firestore');
    const snap = await getDoc(firestoreDoc(db, 'users', sellerId));
    if (snap.exists()) return (snap.data() as { name?: string }).name ?? sellerId;
  } catch { /* ignore */ }
  return sellerId;
}

// ─── Page Component ───────────────────────────────────────────────────────────

interface ProductRow extends Product {
  sellerName: string;
}

export default function AdminProductsPage() {
  const router = useRouter();

  const [products, setProducts]           = useState<ProductRow[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter]   = useState<'All' | 'Active' | 'Inactive'>('All');
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget]   = useState<string[] | null>(null);
  const [lastDoc, setLastDoc]             = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore]             = useState(false);
  const [page, setPage]                   = useState(0);
  const [pageStack, setPageStack]         = useState<Array<QueryDocumentSnapshot<DocumentData> | null>>([null]);
  const [toastMsg, setToastMsg]           = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 3000);
  }

  const loadPage = useCallback(async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
    setLoading(true);
    setSelected(new Set());
    try {
      const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc'), limit(PAGE_SIZE)];
      if (cursor) constraints.push(startAfter(cursor));

      const snap = await getDocs(query(collection(db, 'products'), ...constraints));
      let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProductRow));

      // Client-side filters
      if (categoryFilter !== 'All Categories') {
        rows = rows.filter((p) => p.category === categoryFilter);
      }
      if (statusFilter !== 'All') {
        rows = rows.filter((p) => p.active === (statusFilter === 'Active'));
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        rows = rows.filter((p) => p.name?.toLowerCase().includes(q));
      }

      // Fetch seller names
      const sellerIds = [...new Set(rows.map((p) => p.sellerId))];
      const nameMap: Record<string, string> = {};
      await Promise.all(sellerIds.map(async (sid) => {
        nameMap[sid] = await fetchSellerName(sid);
      }));
      rows = rows.map((p) => ({ ...p, sellerName: nameMap[p.sellerId] ?? p.sellerId }));

      setProducts(rows);
      setHasMore(snap.docs.length === PAGE_SIZE);
      if (snap.docs.length > 0) setLastDoc(snap.docs[snap.docs.length - 1]);
      else setLastDoc(null);
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter, search]);

  useEffect(() => {
    setPage(0);
    setPageStack([null]);
    loadPage(null);
  }, [categoryFilter, statusFilter]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0);
      setPageStack([null]);
      loadPage(null);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

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

  async function toggleStatus(product: ProductRow) {
    try {
      await updateDoc(doc(db, 'products', product.id), { active: !product.active });
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, active: !p.active } : p));
      showToast(`Product ${product.active ? 'deactivated' : 'activated'}`);
    } catch { showToast('Failed to update status'); }
  }

  async function doDelete(ids: string[]) {
    try {
      await Promise.all(ids.map((id) => deleteDoc(doc(db, 'products', id))));
      setProducts((prev) => prev.filter((p) => !ids.includes(p.id)));
      setSelected((prev) => { const s = new Set(prev); ids.forEach((id) => s.delete(id)); return s; });
      showToast(`Deleted ${ids.length} product${ids.length > 1 ? 's' : ''}`);
    } catch { showToast('Failed to delete'); }
    setDeleteTarget(null);
  }

  async function bulkSetStatus(active: boolean) {
    const ids = [...selected];
    try {
      await Promise.all(ids.map((id) => updateDoc(doc(db, 'products', id), { active })));
      setProducts((prev) => prev.map((p) => selected.has(p.id) ? { ...p, active } : p));
      setSelected(new Set());
      showToast(`${ids.length} product${ids.length > 1 ? 's' : ''} ${active ? 'activated' : 'deactivated'}`);
    } catch { showToast('Bulk update failed'); }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function toggleSelectAll() {
    if (selected.size === products.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.id)));
    }
  }

  const allSelected   = products.length > 0 && selected.size === products.length;
  const someSelected  = selected.size > 0 && selected.size < products.length;

  function formatDate(ts: Product['createdAt']) {
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
        .prod-row:hover td { background: var(--color-surface); }
        .act-btn { background:none;border:none;cursor:pointer;padding:5px;border-radius:6px;
          color:var(--color-text-secondary);display:inline-flex;align-items:center; }
        .act-btn:hover { background:var(--color-border);color:var(--color-text); }
      `}</style>

      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>Products</h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Manage all marketplace product listings
            </p>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16,
          padding: 16, background: 'var(--color-surface)',
          borderRadius: 10, border: '1px solid var(--color-border)',
        }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
            <input
              placeholder="Search by product name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 32, width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={inputStyle}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')}
            style={inputStyle}
          >
            <option>All</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            padding: '10px 16px', background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
            borderRadius: 10,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
              {selected.size} selected
            </span>
            <button onClick={() => bulkSetStatus(true)} style={{
              padding: '5px 12px', borderRadius: 7, border: 'none',
              background: 'var(--color-success)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>Activate</button>
            <button onClick={() => bulkSetStatus(false)} style={{
              padding: '5px 12px', borderRadius: 7, border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>Deactivate</button>
            <button onClick={() => setDeleteTarget([...selected])} style={{
              padding: '5px 12px', borderRadius: 7, border: 'none',
              background: 'var(--color-danger)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>Delete</button>
            <button onClick={() => setSelected(new Set())} style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center',
            }}>
              <X size={15} />
            </button>
          </div>
        )}

        {/* Table */}
        <div style={{
          background: 'var(--color-surface)', borderRadius: 12,
          border: '1px solid var(--color-border)', overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', width: 40 }}>
                    <button
                      onClick={toggleSelectAll}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 0, display: 'flex' }}
                    >
                      {allSelected ? <CheckSquare size={16} color="var(--color-primary)" />
                        : someSelected ? <Minus size={16} color="var(--color-primary)" />
                        : <Square size={16} />}
                    </button>
                  </th>
                  {['ID', 'Image', 'Name', 'Seller', 'Price', 'Category', 'Status', 'Date', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '48px 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>No products found</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your filters</div>
                    </td>
                  </tr>
                ) : products.map((product) => (
                  <tr key={product.id} className="prod-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        onClick={() => toggleSelect(product.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 0, display: 'flex' }}
                      >
                        {selected.has(product.id)
                          ? <CheckSquare size={16} color="var(--color-primary)" />
                          : <Square size={16} />}
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: 11 }}>
                      {product.id.slice(0, 8)}…
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {product.images?.[0]?.url
                        ? <img src={product.images[0].url} alt={product.name}
                            style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--color-border)' }} />
                        : <div style={{ width: 30, height: 30, background: 'var(--color-border)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--color-text-secondary)' }}>N/A</div>
                      }
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text)', fontWeight: 500, maxWidth: 180 }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>
                      {product.sellerName}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text)', fontWeight: 600 }}>
                      {product.currency} {product.price?.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>
                      {product.category}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <StatusBadge active={product.active} />
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDate(product.createdAt)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="act-btn"
                          title={product.active ? 'Deactivate' : 'Activate'}
                          onClick={() => toggleStatus(product)}
                        >
                          {product.active
                            ? <ToggleRight size={16} color="var(--color-success)" />
                            : <ToggleLeft size={16} />}
                        </button>
                        <button
                          className="act-btn"
                          title="Edit"
                          onClick={() => router.push(`/products/${product.id}/edit`)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="act-btn"
                          title="Delete"
                          onClick={() => setDeleteTarget([product.id])}
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Page {page + 1}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={goPrev}
                disabled={page === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px', borderRadius: 7, border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  fontSize: 13, cursor: page === 0 ? 'not-allowed' : 'pointer',
                  opacity: page === 0 ? 0.4 : 1,
                }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                onClick={goNext}
                disabled={!hasMore}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px', borderRadius: 7, border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  fontSize: 13, cursor: !hasMore ? 'not-allowed' : 'pointer',
                  opacity: !hasMore ? 0.4 : 1,
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteTarget && (
        <ConfirmModal
          count={deleteTarget.length}
          onConfirm={() => doDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 600,
          background: 'var(--color-text)', color: 'var(--color-background)',
          padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toastMsg}
        </div>
      )}
    </AdminLayout>
  );
}
