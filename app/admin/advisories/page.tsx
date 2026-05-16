/**
 * app/admin/advisories/page.tsx
 * Admin — Advice Posts management
 * Spec ref: section 6.7 (Admin Portal > Advisories)
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  Search, Eye, Archive, ArchiveRestore, Trash2, BookOpen, AlertTriangle,
} from 'lucide-react';
import { db } from '@/services/firebase';
import AdminLayout from '@/components/layouts/AdminLayout';
import type { AdvicePost } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type PostStatus = 'published' | 'draft' | 'archived';

interface AdvicePostRow extends AdvicePost {
  advisorName: string;
  status: PostStatus;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_POSTS: AdvicePostRow[] = [
  { id: 'ap1', advisorId: 'a1', advisorName: 'Dr. Rachel Green', title: 'How to Export Wool from Australia to Asia', subject: 'Agricultural Trade', description: 'A complete guide to wool export regulations.', steps: [{title:'Step 1',description:'Register with DAFF',images:[]},{title:'Step 2',description:'Get certified',images:[]}], tags: ['wool','export','australia'], visibility: 'public', createdAt: { seconds: 1716000000, nanoseconds: 0, toDate: () => new Date(1716000000000) }, views: 1240, published: true, status: 'published' },
  { id: 'ap2', advisorId: 'a2', advisorName: 'James Thornton',   title: 'Navigating Australian Import Duties', subject: 'Customs & Duties', description: 'Understanding duty rates and exemptions.', steps: [{title:'Step 1',description:'Classify goods',images:[]}], tags: ['customs','import','duty'], visibility: 'public', createdAt: { seconds: 1715000000, nanoseconds: 0, toDate: () => new Date(1715000000000) }, views: 876, published: true, status: 'published' },
  { id: 'ap3', advisorId: 'a3', advisorName: 'Mei Lin',          title: 'Trade Finance for Small Exporters (Draft)', subject: 'Finance', description: 'Finance instruments for SME exporters.', steps: [{title:'Step 1',description:'Assess cash flow',images:[]}], tags: ['finance','sme'], visibility: 'circle', createdAt: { seconds: 1714000000, nanoseconds: 0, toDate: () => new Date(1714000000000) }, views: 45, published: false, status: 'draft' },
  { id: 'ap4', advisorId: 'a1', advisorName: 'Dr. Rachel Green', title: 'Organic Certification in Australia', subject: 'Certification', description: 'Step by step organic certification process.', steps: [{title:'Step 1',description:'Choose certifier',images:[]},{title:'Step 2',description:'Inspection',images:[]},{title:'Step 3',description:'Get certified',images:[]}], tags: ['organic','certification'], visibility: 'public', createdAt: { seconds: 1713000000, nanoseconds: 0, toDate: () => new Date(1713000000000) }, views: 532, published: false, status: 'archived' },
  { id: 'ap5', advisorId: 'a2', advisorName: 'James Thornton',   title: 'Market Entry Strategy for Asian Markets', subject: 'Market Entry', description: 'Practical guide to entering Asian markets.', steps: [{title:'Step 1',description:'Market research',images:[]},{title:'Step 2',description:'Find distributor',images:[]}], tags: ['asia','market'], visibility: 'public', createdAt: { seconds: 1712000000, nanoseconds: 0, toDate: () => new Date(1712000000000) }, views: 389, published: true, status: 'published' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: { seconds: number } | undefined): string {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<PostStatus, { bg: string; color: string; label: string }> = {
  published: { bg: 'color-mix(in srgb, var(--color-success) 12%, transparent)', color: 'var(--color-success)', label: 'Published' },
  draft:     { bg: 'color-mix(in srgb, var(--color-warning) 14%, transparent)', color: 'var(--color-warning)', label: 'Draft'     },
  archived:  { bg: 'color-mix(in srgb, var(--color-text-secondary) 14%, transparent)', color: 'var(--color-text-secondary)', label: 'Archived' },
};

function PostStatusBadge({ status }: { status: PostStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--color-background)', borderRadius: 14, border: '1px solid var(--color-border)', padding: 28, width: 380, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <AlertTriangle size={22} color="var(--color-danger)" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Delete Post</h3>
        </div>
        <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          Permanently delete "<strong>{title}</strong>"? This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--color-danger)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAdvisoriesPage() {
  const [posts,        setPosts]        = useState<AdvicePostRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | PostStatus>('All');
  const [advisorSearch, setAdvisorSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdvicePostRow | null>(null);
  const [toastMsg,     setToastMsg]     = useState('');

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  }

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'advicePosts'));
      const data = snap.docs.map((d) => {
        const post = { id: d.id, ...d.data() } as AdvicePostRow;
        post.status = !post.published ? 'draft' : (post.status ?? 'published');
        post.advisorName = post.advisorName ?? post.advisorId;
        return post;
      });
      setPosts(data.length > 0 ? data : MOCK_POSTS);
    } catch {
      setPosts(MOCK_POSTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPosts(); }, [fetchPosts]);

  async function handleArchiveToggle(post: AdvicePostRow) {
    const newStatus: PostStatus = post.status === 'archived' ? 'published' : 'archived';
    const newPublished = newStatus === 'published';
    try {
      await updateDoc(doc(db, 'advicePosts', post.id), { status: newStatus, published: newPublished });
      setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, status: newStatus, published: newPublished } : p));
      showToast(`Post ${newStatus === 'archived' ? 'archived' : 'restored'}`);
    } catch { showToast('Failed to update post'); }
  }

  async function handleDelete(post: AdvicePostRow) {
    try {
      await deleteDoc(doc(db, 'advicePosts', post.id));
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setDeleteTarget(null);
      showToast('Post deleted');
    } catch { showToast('Failed to delete post'); }
  }

  const filtered = posts.filter((p) => {
    if (statusFilter !== 'All' && p.status !== statusFilter) return false;
    if (search.trim() && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (advisorSearch.trim() && !p.advisorName.toLowerCase().includes(advisorSearch.toLowerCase())) return false;
    return true;
  });

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none',
  };

  return (
    <AdminLayout>
      <style>{`
        @keyframes shimmer { 0%{opacity:1} 50%{opacity:0.4} 100%{opacity:1} }
        .adv-row:hover td { background: var(--color-surface); }
        .adv-table { width:100%; border-collapse:collapse; }
        .adv-table th { text-align:left;font-size:11px;font-weight:600;letter-spacing:0.05em;color:var(--color-text-secondary);text-transform:uppercase;padding:10px 16px;border-bottom:1px solid var(--color-border);white-space:nowrap; }
        .adv-table td { font-size:13px;padding:12px 16px;border-bottom:1px solid var(--color-border);color:var(--color-text);vertical-align:middle; }
        .adv-table tr:last-child td { border-bottom:none; }
        .adv-act-btn { background:none;border:none;cursor:pointer;padding:5px;border-radius:6px;color:var(--color-text-secondary);display:inline-flex;align-items:center; }
        .adv-act-btn:hover { background:var(--color-border); color:var(--color-text); }
      `}</style>

      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>Advice Posts</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>Manage all advisor-published advice posts</p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, padding: 14, background: 'var(--color-surface)', borderRadius: 10, border: '1px solid var(--color-border)' }}>
          <div style={{ position: 'relative', flex: '1 1 180px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
            <input placeholder="Search title…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 32, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'All' | PostStatus)} style={inputStyle}>
            <option value="All">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <div style={{ position: 'relative', flex: '1 1 180px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
            <input placeholder="Filter by advisor…" value={advisorSearch} onChange={(e) => setAdvisorSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 32, width: '100%', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Table */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="adv-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Advisor</th>
                  <th>Subject</th>
                  <th>Steps</th>
                  <th>Views</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {[180, 120, 100, 40, 50, 80, 80, 100].map((w, j) => (
                        <td key={j} style={{ padding: '12px 16px' }}>
                          <div style={{ width: w, height: 13, borderRadius: 6, background: 'var(--color-border)', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-secondary)' }}>
                      <BookOpen size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>No advice posts found</div>
                      <div style={{ fontSize: 12 }}>Try adjusting your search or filters.</div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((post) => (
                    <tr key={post.id} className="adv-row">
                      <td style={{ maxWidth: 220 }}>
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.title}</div>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{post.advisorName}</td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{post.subject}</td>
                      <td style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>{post.steps.length}</td>
                      <td style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>{post.views.toLocaleString()}</td>
                      <td style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(post.createdAt)}</td>
                      <td><PostStatusBadge status={post.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <a
                            href={`/advice/${post.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 6, color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                          >
                            <Eye size={14} />
                          </a>
                          <button
                            className="adv-act-btn"
                            title={post.status === 'archived' ? 'Restore' : 'Archive'}
                            onClick={() => void handleArchiveToggle(post)}
                            style={{ color: post.status === 'archived' ? 'var(--color-success)' : 'var(--color-warning)' }}
                          >
                            {post.status === 'archived' ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                          </button>
                          <button className="adv-act-btn" title="Delete" onClick={() => setDeleteTarget(post)} style={{ color: 'var(--color-danger)' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <DeleteModal title={deleteTarget.title} onConfirm={() => void handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} />
      )}

      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 600, background: 'var(--color-text)', color: 'var(--color-background)', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
          {toastMsg}
        </div>
      )}
    </AdminLayout>
  );
}
