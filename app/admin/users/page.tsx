/**
 * app/admin/users/page.tsx
 * Admin — Users management page.
 * Spec ref: section 6.7 (Admin Portal > Users)
 *
 * Features:
 *  - Firestore load from `users` collection (20 per page)
 *  - Debounced search + role filter
 *  - Ban / Unban / Delete (with confirm dialog)
 *  - Loading skeleton (4 shimmer rows)
 *  - Empty state
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection, getDocs, query, orderBy, limit,
  startAfter, where, doc, updateDoc, deleteDoc,
  DocumentSnapshot, QueryDocumentSnapshot,
} from 'firebase/firestore';
import { Search, ChevronLeft, ChevronRight, Trash2, Ban, ShieldCheck } from 'lucide-react';
import AdminLayout      from '@/components/layouts/AdminLayout';
import { RoleBadge }   from '@/components/ui/RoleBadge';
import { db }          from '@/services/firebase';
import type { User, UserRole } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const ROLE_OPTIONS: { value: '' | UserRole; label: string }[] = [
  { value: '',        label: 'All Roles' },
  { value: 'buyer',   label: 'Buyer'     },
  { value: 'seller',  label: 'Seller'    },
  { value: 'advisor', label: 'Advisor'   },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: { seconds: number } | undefined): string {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function userInitial(name: string): string {
  return name?.charAt(0).toUpperCase() ?? '?';
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[48, 120, 160, 80, 90, 80, 70, 100].map((w, i) => (
        <td key={i} style={{ padding: '14px 16px' }}>
          <div
            style={{
              width: w, height: 14, borderRadius: 6,
              background: 'var(--color-border)',
              animation: 'shimmer 1.4s ease-in-out infinite',
            }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 600,
      padding: '2px 9px', borderRadius: 9999,
      background: active ? '#F0FDF4' : '#FFF1F2',
      color:      active ? '#16A34A' : '#DC2626',
    }}>
      {active ? 'Active' : 'Banned'}
    </span>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteModal({
  user,
  onConfirm,
  onCancel,
}: {
  user: User;
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)',
    }}>
      <div style={{
        background: 'var(--color-background, var(--color-bg-primary))',
        border: '1px solid var(--color-border)',
        borderRadius: 14, padding: 28, maxWidth: 400, width: '90%',
        boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--color-text, var(--color-text-primary))' }}>
          Delete User
        </h3>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 24 }}>
          Are you sure you want to permanently delete <strong>{user.name}</strong>? This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 18px', borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text, var(--color-text-primary))',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: 'var(--color-danger)', color: '#fff',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [users,       setUsers]       = useState<User[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [roleFilter,  setRoleFilter]  = useState<'' | UserRole>('');
  const [page,        setPage]        = useState(0);
  const [cursors,     setCursors]     = useState<(DocumentSnapshot | null)[]>([null]);
  const [hasNext,     setHasNext]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [actionError,  setActionError]  = useState('');

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
      setCursors([null]);
    }, 350);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  // Reset pagination when role filter changes
  useEffect(() => {
    setPage(0);
    setCursors([null]);
  }, [roleFilter]);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setActionError('');
    try {
      const usersRef = collection(db, 'users');
      const constraints: Parameters<typeof query>[1][] = [orderBy('createdAt', 'desc'), limit(PAGE_SIZE + 1)];

      if (roleFilter) {
        constraints.unshift(where('role', '==', roleFilter));
      }

      const cursorDoc = cursors[page];
      if (cursorDoc) {
        constraints.push(startAfter(cursorDoc));
      }

      const snap = await getDocs(query(usersRef, ...constraints));
      const docs = snap.docs as QueryDocumentSnapshot[];
      const hasMore = docs.length > PAGE_SIZE;
      const pageDocs = docs.slice(0, PAGE_SIZE);

      const fetched = pageDocs.map((d) => ({ uid: d.id, ...d.data() } as User));

      // Client-side search filter (Firestore doesn't support full-text search)
      const filtered = debouncedSearch
        ? fetched.filter((u) =>
            u.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            u.email.toLowerCase().includes(debouncedSearch.toLowerCase())
          )
        : fetched;

      setUsers(filtered);
      setHasNext(hasMore);

      // Store the last cursor for next page
      if (hasMore && pageDocs.length > 0) {
        setCursors((prev) => {
          const next = [...prev];
          next[page + 1] = pageDocs[pageDocs.length - 1];
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to load users', err);
      setActionError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, cursors, roleFilter, debouncedSearch]);

  useEffect(() => {
    void fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, roleFilter, debouncedSearch]);

  // ── Actions ──────────────────────────────────────────────────────────────
  async function handleToggleBan(user: User) {
    try {
      await updateDoc(doc(db, 'users', user.uid), { active: !user.active });
      setUsers((prev) => prev.map((u) => u.uid === user.uid ? { ...u, active: !u.active } : u));
    } catch {
      setActionError('Failed to update user status.');
    }
  }

  async function handleDelete(user: User) {
    try {
      await deleteDoc(doc(db, 'users', user.uid));
      setUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      setDeleteTarget(null);
    } catch {
      setActionError('Failed to delete user.');
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <style>{`
        @keyframes shimmer {
          0%   { opacity: 1; }
          50%  { opacity: 0.4; }
          100% { opacity: 1; }
        }
        .adm-users-table { width: 100%; border-collapse: collapse; }
        .adm-users-table th {
          text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.05em;
          color: var(--color-text-secondary); text-transform: uppercase;
          padding: 10px 16px; border-bottom: 1px solid var(--color-border);
          white-space: nowrap;
        }
        .adm-users-table td {
          font-size: 13px; padding: 14px 16px;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text, var(--color-text-primary));
          vertical-align: middle;
        }
        .adm-users-table tr:last-child td { border-bottom: none; }
        .adm-users-table tbody tr:hover td { background: var(--color-surface, var(--color-bg-secondary)); }
        .adm-action-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 11px; border-radius: 7px; font-size: 12px; font-weight: 600;
          border: 1px solid var(--color-border); background: none; cursor: pointer;
          transition: background 0.15s;
        }
      `}</style>

      <div style={{ padding: '24px' }}>

        {/* Header + filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text, var(--color-text-primary))', flex: 1, margin: 0 }}>
            Users
          </h2>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--color-text-secondary)',
            }} />
            <input
              type="text"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                border: '1px solid var(--color-border)', borderRadius: 8,
                fontSize: 13, width: 220,
                background: 'var(--color-background, var(--color-bg-primary))',
                color: 'var(--color-text, var(--color-text-primary))',
                outline: 'none',
              }}
            />
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as '' | UserRole)}
            style={{
              padding: '8px 12px', border: '1px solid var(--color-border)',
              borderRadius: 8, fontSize: 13,
              background: 'var(--color-background, var(--color-bg-primary))',
              color: 'var(--color-text, var(--color-text-primary))',
              cursor: 'pointer', outline: 'none',
            }}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {actionError && (
          <div style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 8,
            background: '#FFF1F2', border: '1px solid #FECDD3',
            color: 'var(--color-danger)', fontSize: 13,
          }}>
            {actionError}
          </div>
        )}

        {/* Table container */}
        <div style={{
          background: 'var(--color-surface, var(--color-bg-secondary))',
          border: '1px solid var(--color-border)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-users-table">
              <thead>
                <tr>
                  <th>Avatar</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Location</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-secondary)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>No users found</div>
                      <div style={{ fontSize: 12 }}>Try adjusting your search or filter.</div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.uid}>
                      {/* Avatar */}
                      <td>
                        {user.profilePhoto ? (
                          <img
                            src={user.profilePhoto}
                            alt={user.name}
                            style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: 'var(--color-primary)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 700,
                          }}>
                            {userInitial(user.name)}
                          </div>
                        )}
                      </td>

                      {/* Name */}
                      <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{user.name}</td>

                      {/* Email */}
                      <td style={{ color: 'var(--color-text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.email}
                      </td>

                      {/* Role */}
                      <td><RoleBadge role={user.role} /></td>

                      {/* Location */}
                      <td style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                        {user.location ? `${user.location.city}, ${user.location.country}` : '—'}
                      </td>

                      {/* Joined */}
                      <td style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatDate(user.createdAt)}
                      </td>

                      {/* Status */}
                      <td><StatusBadge active={user.active} /></td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button
                            className="adm-action-btn"
                            onClick={() => void handleToggleBan(user)}
                            style={{
                              color: user.active ? 'var(--color-warning)' : 'var(--color-success)',
                              borderColor: user.active ? '#FDE68A' : '#BBF7D0',
                            }}
                            title={user.active ? 'Ban user' : 'Unban user'}
                          >
                            {user.active ? <Ban size={12} /> : <ShieldCheck size={12} />}
                            {user.active ? 'Ban' : 'Unban'}
                          </button>
                          <button
                            className="adm-action-btn"
                            onClick={() => setDeleteTarget(user)}
                            style={{ color: 'var(--color-danger)', borderColor: '#FECDD3' }}
                            title="Delete user"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && users.length > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', borderTop: '1px solid var(--color-border)',
            }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Page {page + 1}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                    border: '1px solid var(--color-border)',
                    background: 'none', cursor: page === 0 ? 'not-allowed' : 'pointer',
                    color: page === 0 ? 'var(--color-text-secondary)' : 'var(--color-text, var(--color-text-primary))',
                    opacity: page === 0 ? 0.5 : 1,
                  }}
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  disabled={!hasNext}
                  onClick={() => setPage((p) => p + 1)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                    border: '1px solid var(--color-border)',
                    background: 'none', cursor: !hasNext ? 'not-allowed' : 'pointer',
                    color: !hasNext ? 'var(--color-text-secondary)' : 'var(--color-text, var(--color-text-primary))',
                    opacity: !hasNext ? 0.5 : 1,
                  }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteTarget && (
        <DeleteModal
          user={deleteTarget}
          onConfirm={() => void handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </AdminLayout>
  );
}
