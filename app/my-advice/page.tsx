/**
 * app/my-advice/page.tsx
 * Advisor content dashboard.
 * Spec ref: section 4.3 (Advisor Dashboard)
 *
 * - Stats row: Total Posts | Views | Enquiries Received | Replies Sent
 * - Advice post table: Title | Subject | Status | Views | Date | Actions
 * - Actions: Edit | Archive (toggle published) | Delete
 * - [+ Create New Advice Post] CTA
 * - Advisor-only (RoleGuard)
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link                                          from 'next/link';
import { useRouter }                                 from 'next/navigation';
import {
  collection,
  deleteDoc,
  doc,
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
  BookOpen,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Archive,
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingUp,
  MessageSquare,
  Send,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { db }           from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { RoleGuard }    from '@/components/guards/RoleGuard';
import AdvisorLayout    from '@/components/layouts/AdvisorLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdvicePost {
  id:         string;
  title:      string;
  subject:    string;
  coverImage?: string;
  published:  boolean;
  archived?:  boolean;
  views?:     number;
  enquiries?: number;
  createdAt?: { seconds: number };
}

interface Stats {
  total:      number;
  views:      number;
  enquiries:  number;
  replies:    number;
}

const PAGE_SIZE = 10;

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, loading }: { label: string; value: number; icon: React.ReactNode; loading: boolean }) {
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
          background:     'color-mix(in srgb, var(--color-advisor, #10b981) 12%, transparent)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          color:          'var(--color-advisor, #10b981)',
          flexShrink:     0,
        }}
      >
        {icon}
      </div>
      <div>
        {loading ? (
          <div style={{ width: 52, height: 22, borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
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

// ─── Delete dialog ────────────────────────────────────────────────────────────

function DeleteDialog({ title, onConfirm, onCancel, deleting }: { title: string; onConfirm: () => void; onCancel: () => void; deleting: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'color-mix(in srgb, var(--color-error, #ef4444) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)' }}>
          <Trash2 size={22} style={{ color: 'var(--color-error, #ef4444)' }} />
        </div>
        <h3 style={{ margin: '0 0 var(--space-2)', textAlign: 'center', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)' }}>Delete Post?</h3>
        <p style={{ margin: '0 0 var(--space-5)', textAlign: 'center', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--color-text)' }}>{title}</strong> will be permanently removed.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: 'var(--space-2)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting} style={{ flex: 1, padding: 'var(--space-2)', background: 'var(--color-error, #ef4444)', border: 'none', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-1)' }}>
            {deleting && <Loader2 size={14} />} Delete
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
          {[220, 120, 80, 60, 90].map((w, j) => (
            <td key={j} style={{ padding: 'var(--space-4)' }}>
              <div style={{ width: w, height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
            </td>
          ))}
          <td style={{ padding: 'var(--space-4)' }}>
            <div style={{ width: 100, height: 28, borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyAdvicePage() {
  const user   = useAuthStore((s) => s.user);
  const router = useRouter();
  const uid    = user?.uid ?? '';

  const [posts, setPosts]             = useState<AdvicePost[]>([]);
  const [stats, setStats]             = useState<Stats>({ total: 0, views: 0, enquiries: 0, replies: 0 });
  const [loading, setLoading]         = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [hasMore, setHasMore]         = useState(false);
  const [page, setPage]               = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<AdvicePost | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [toggling, setToggling]       = useState<string | null>(null);

  const lastDocRef   = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const pageStackRef = useRef<QueryDocumentSnapshot<DocumentData>[]>([]);

  // Load stats
  useEffect(() => {
    if (!uid) return;
    async function loadStats() {
      setStatsLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'advicePosts'), where('advisorId', '==', uid)));
        let views = 0, enquiries = 0, replies = 0;
        snap.docs.forEach((d) => {
          views     += d.data().views     ?? 0;
          enquiries += d.data().enquiries ?? 0;
          replies   += d.data().replies   ?? 0;
        });
        setStats({ total: snap.size, views, enquiries, replies });
      } finally {
        setStatsLoading(false);
      }
    }
    loadStats();
  }, [uid]);

  const loadPage = useCallback(async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
    if (!uid) return;
    setLoading(true);
    try {
      const q = cursor
        ? query(collection(db, 'advicePosts'), where('advisorId', '==', uid), orderBy('createdAt', 'desc'), startAfter(cursor), limit(PAGE_SIZE + 1))
        : query(collection(db, 'advicePosts'), where('advisorId', '==', uid), orderBy('createdAt', 'desc'), limit(PAGE_SIZE + 1));
      const snap = await getDocs(q);
      const docs = snap.docs.slice(0, PAGE_SIZE);
      setHasMore(snap.docs.length > PAGE_SIZE);
      lastDocRef.current = docs[docs.length - 1] ?? null;
      setPosts(docs.map((d) => ({ id: d.id, ...d.data() } as AdvicePost)));
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { if (uid) loadPage(null); }, [uid, loadPage]);

  function nextPage() {
    if (!lastDocRef.current) return;
    pageStackRef.current.push(lastDocRef.current);
    setPage((p) => p + 1);
    loadPage(lastDocRef.current);
  }

  function prevPage() {
    const stack = pageStackRef.current;
    stack.pop();
    setPage((p) => p - 1);
    loadPage(stack[stack.length - 1] ?? null);
  }

  async function handleToggle(id: string, current: boolean) {
    setToggling(id);
    try {
      await updateDoc(doc(db, 'advicePosts', id), { published: !current });
      setPosts((prev) => prev.map((p) => p.id === id ? { ...p, published: !current } : p));
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'advicePosts', deleteTarget.id));
      setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setStats((s) => ({ ...s, total: s.total - 1 }));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <RoleGuard allowedRoles={['advisor']}>
      <AdvisorLayout>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text)' }}>My Advice</h1>
              <p style={{ margin: '4px 0 0', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
                Manage your published guides and advice posts.
              </p>
            </div>
            <Link
              href="/advice/new"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-5)',
                background: 'var(--color-advisor, #10b981)', color: '#fff',
                borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 'var(--text-sm)',
                textDecoration: 'none', flexShrink: 0, transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.88'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
            >
              <Plus size={16} /> Create Advice Post
            </Link>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            <StatCard label="Total Posts"         value={stats.total}     icon={<BookOpen      size={20} />} loading={statsLoading} />
            <StatCard label="Total Views"         value={stats.views}     icon={<TrendingUp    size={20} />} loading={statsLoading} />
            <StatCard label="Enquiries Received"  value={stats.enquiries} icon={<MessageSquare size={20} />} loading={statsLoading} />
            <StatCard label="Replies Sent"        value={stats.replies}   icon={<Send          size={20} />} loading={statsLoading} />
          </div>

          {/* Table */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-2)', borderBottom: '2px solid var(--color-border)' }}>
                    {['Title', 'Subject', 'Status', 'Views', 'Date', 'Actions'].map((h) => (
                      <th key={h} style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? <TableSkeleton /> : posts.length === 0 ? (
                    <tr><td colSpan={6}>
                      <div style={{ padding: 'var(--space-16) var(--space-4)', textAlign: 'center' }}>
                        <BookOpen size={48} style={{ color: 'var(--color-text-3)', opacity: 0.3, marginBottom: 'var(--space-3)' }} />
                        <p style={{ margin: '0 0 var(--space-2)', fontWeight: 600, color: 'var(--color-text)' }}>No advice posts yet</p>
                        <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>Share your expertise by creating your first post.</p>
                        <Link href="/advice/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-5)', background: 'var(--color-advisor, #10b981)', color: '#fff', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 'var(--text-sm)', textDecoration: 'none' }}>
                          <Plus size={15} /> Create Advice Post
                        </Link>
                      </div>
                    </td></tr>
                  ) : posts.map((post) => (
                    <tr key={post.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-surface-2)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                    >
                      {/* Title */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', minWidth: 200 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                          {post.title}
                        </p>
                      </td>
                      {/* Subject */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                          {post.subject || '—'}
                        </p>
                      </td>
                      {/* Status */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 'var(--radius-full)',
                          fontSize: 'var(--text-xs)', fontWeight: 700,
                          background: post.published
                            ? 'color-mix(in srgb, var(--color-advisor, #10b981) 14%, transparent)'
                            : 'color-mix(in srgb, var(--color-text-3) 14%, transparent)',
                          color: post.published ? 'var(--color-advisor, #10b981)' : 'var(--color-text-3)',
                        }}>
                          {post.published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      {/* Views */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
                        {(post.views ?? 0).toLocaleString()}
                      </td>
                      {/* Date */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>
                        {post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      {/* Actions */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                          {/* Edit */}
                          <button onClick={() => router.push(`/advice/${post.id}/edit`)} title="Edit"
                            style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s, color 0.15s' }}
                            onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'var(--color-primary)'; b.style.color = 'var(--color-primary)'; }}
                            onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'var(--color-border)'; b.style.color = 'var(--color-text-2)'; }}
                          ><Edit2 size={14} /></button>
                          {/* Toggle published */}
                          <button onClick={() => handleToggle(post.id, post.published)} disabled={toggling === post.id} title={post.published ? 'Unpublish' : 'Publish'}
                            style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: post.published ? 'var(--color-advisor, #10b981)' : 'var(--color-text-3)', cursor: toggling === post.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: toggling === post.id ? 0.6 : 1 }}
                          >
                            {toggling === post.id ? <Loader2 size={14} /> : post.published ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                          {/* Delete */}
                          <button onClick={() => setDeleteTarget(post)} title="Delete"
                            style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s, color 0.15s' }}
                            onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'var(--color-error, #ef4444)'; b.style.color = 'var(--color-error, #ef4444)'; }}
                            onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'var(--color-border)'; b.style.color = 'var(--color-text-3)'; }}
                          ><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && posts.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                <p style={{ margin: 0, color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>Page {page}</p>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button onClick={prevPage} disabled={page === 1} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-1) var(--space-3)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: page === 1 ? 'var(--color-text-3)' : 'var(--color-text)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}>
                    <ChevronLeft size={15} /> Prev
                  </button>
                  <button onClick={nextPage} disabled={!hasMore} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-1) var(--space-3)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: !hasMore ? 'var(--color-text-3)' : 'var(--color-text)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: !hasMore ? 'not-allowed' : 'pointer', opacity: !hasMore ? 0.5 : 1 }}>
                    Next <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {deleteTarget && (
          <DeleteDialog title={deleteTarget.title} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} deleting={deleting} />
        )}

        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }`}</style>
      </AdvisorLayout>
    </RoleGuard>
  );
}
