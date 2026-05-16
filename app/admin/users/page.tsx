/**
 * app/admin/users/page.tsx
 * Admin — Users management page.
 * Spec ref: section 6.7 (Admin Portal > Users)
 *
 * Features:
 *  - Firestore load from `users` collection (20 per page)
 *  - Debounced search + role filter
 *  - Create user (modal -> POST /api/admin/users)
 *  - Edit user (modal -> PATCH /api/admin/users) + send password reset
 *  - Ban / Unban (PATCH active flag, both Auth + Firestore via API)
 *  - Delete (DELETE /api/admin/users) with confirm dialog
 *  - Bulk select + Ban / Unban / Delete / Export CSV
 *  - Loading skeleton (4 shimmer rows)
 *  - Empty state
 *
 * Server-side mutations all go through /api/admin/users, which keeps
 * Firebase Auth and Firestore in sync and writes adminLogs entries.
 * That route requires FIREBASE_SERVICE_ACCOUNT_JSON in .env.local — if it
 * isn't set the API returns 501 and we surface the error inline.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection, getDocs, query, orderBy, limit,
  startAfter, where, DocumentSnapshot, QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  Search, ChevronLeft, ChevronRight, Trash2, Ban, ShieldCheck,
  Plus, Pencil, KeyRound, X, Download,
} from 'lucide-react';
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

function csvEscape(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', fontSize: 13,
  background: 'var(--color-background, var(--color-bg-primary))',
  color: 'var(--color-text, var(--color-text-primary))',
  outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--color-text-secondary)', marginBottom: 6,
};

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[20, 48, 120, 160, 80, 90, 80, 70, 100].map((w, i) => (
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

// ─── Modal shell ─────────────────────────────────────────────────────────────

function Modal({
  title, onClose, children, wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)', padding: 16,
    }}>
      <div style={{
        background: 'var(--color-background, var(--color-bg-primary))',
        border: '1px solid var(--color-border)',
        borderRadius: 14, padding: 24,
        maxWidth: wide ? 560 : 440, width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-text, var(--color-text-primary))' }}>
            {title}
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-secondary)', padding: 4, borderRadius: 6,
          }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Confirm modal ───────────────────────────────────────────────────────────

function ConfirmModal({
  title, message, confirmLabel, danger, onConfirm, onCancel, busy,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel:  () => void;
  busy?: boolean;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginTop: 0, marginBottom: 24 }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel} disabled={busy}
          style={{
            padding: '9px 18px', borderRadius: 8, border: '1px solid var(--color-border)',
            background: 'none', cursor: 'pointer', fontSize: 13,
            color: 'var(--color-text, var(--color-text-primary))',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm} disabled={busy}
          style={{
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: danger ? 'var(--color-danger)' : 'var(--color-primary)',
            color: '#fff', cursor: busy ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600, opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// ─── Create-user modal ───────────────────────────────────────────────────────

function CreateUserModal({
  onClose, onCreated,
}: {
  onClose:   () => void;
  onCreated: () => void;
}) {
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [role,      setRole]      = useState<UserRole>('buyer');
  const [password,  setPassword]  = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [phone,     setPhone]     = useState('');
  const [city,      setCity]      = useState('');
  const [country,   setCountry]   = useState('');
  const [brand,     setBrand]     = useState('');
  const [specialty, setSpecialty] = useState('');
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) return setError('Name is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Invalid email address.');
    if (!sendEmail && password.length < 8) return setError('Password must be at least 8 characters (or enable "Send password setup email").');

    setBusy(true);
    try {
      const res = await fetch('/api/admin/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          role,
          ...(sendEmail ? { sendEmail: true } : { password }),
          phone: phone.trim() || undefined,
          location: (city || country) ? { city, country } : undefined,
          brand:     role === 'seller'  ? brand.trim()     || undefined : undefined,
          specialty: role === 'advisor' ? specialty.trim() || undefined : undefined,
        }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Failed (HTTP ${res.status}).`);
        setBusy(false);
        return;
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
      setBusy(false);
    }
  }

  return (
    <Modal title="Create User" onClose={onClose} wide>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Full Name *</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Email *</label>
          <input type="email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Role *</label>
          <div style={{ display: 'flex', gap: 16 }}>
            {(['buyer', 'seller', 'advisor'] as UserRole[]).map((r) => (
              <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--color-text, var(--color-text-primary))', textTransform: 'capitalize' }}>
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} style={{ accentColor: 'var(--color-primary)' }} />
                {r}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text, var(--color-text-primary))', cursor: 'pointer' }}>
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} style={{ accentColor: 'var(--color-primary)' }} />
            Send password setup email (generates a random temp password)
          </label>
        </div>

        {!sendEmail && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Password * (min 8 chars)</label>
            <input type="password" style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required={!sendEmail} />
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Phone</label>
          <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>City</label>
            <input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Country</label>
            <input style={inputStyle} value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </div>

        {role === 'seller' && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Brand</label>
            <input style={inputStyle} value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
        )}

        {role === 'advisor' && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Specialty</label>
            <input style={inputStyle} value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
          </div>
        )}

        {error && (
          <div style={{
            marginBottom: 14, padding: '9px 12px', borderRadius: 8,
            background: '#FFF1F2', border: '1px solid #FECDD3',
            color: 'var(--color-danger)', fontSize: 12,
          }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={busy} style={{
            padding: '9px 18px', borderRadius: 8, border: '1px solid var(--color-border)',
            background: 'none', cursor: 'pointer', fontSize: 13,
            color: 'var(--color-text, var(--color-text-primary))',
          }}>Cancel</button>
          <button type="submit" disabled={busy} style={{
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: 'var(--color-primary)', color: '#fff',
            cursor: busy ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600, opacity: busy ? 0.7 : 1,
          }}>{busy ? 'Creating…' : 'Create User'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit-user modal ─────────────────────────────────────────────────────────

function EditUserModal({
  user, onClose, onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name,      setName]      = useState(user.name);
  const [role,      setRole]      = useState<UserRole>(user.role);
  const [phone,     setPhone]     = useState(user.phone ?? '');
  const [city,      setCity]      = useState(user.location?.city ?? '');
  const [country,   setCountry]   = useState(user.location?.country ?? '');
  const [brand,     setBrand]     = useState(user.brand ?? '');
  const [specialty, setSpecialty] = useState(user.specialty ?? '');
  const [active,    setActive]    = useState(user.active);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setResetMsg('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/users', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          uid: user.uid,
          name: name.trim(),
          role,
          phone: phone.trim(),
          location: { city, country },
          brand:     role === 'seller'  ? brand.trim()     : '',
          specialty: role === 'advisor' ? specialty.trim() : '',
          active,
        }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Failed (HTTP ${res.status}).`);
        setBusy(false);
        return;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
      setBusy(false);
    }
  }

  async function handleSendReset() {
    setError(''); setResetMsg('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/users', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid: user.uid, sendPasswordReset: true }),
      });
      const data = await res.json() as { ok: boolean; resetLink?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Failed (HTTP ${res.status}).`);
      } else {
        setResetMsg('Password reset link generated. Copy from console or send to user.');
        if (data.resetLink) console.log('[admin] password reset link for', user.email, ':', data.resetLink);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Edit User — ${user.name}`} onClose={onClose} wide>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Email (read-only)</label>
          <input style={{ ...inputStyle, opacity: 0.6 }} value={user.email} readOnly />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Full Name</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Role</label>
          <div style={{ display: 'flex', gap: 16 }}>
            {(['buyer', 'seller', 'advisor'] as UserRole[]).map((r) => (
              <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--color-text, var(--color-text-primary))', textTransform: 'capitalize' }}>
                <input type="radio" name="edit-role" value={r} checked={role === r} onChange={() => setRole(r)} style={{ accentColor: 'var(--color-primary)' }} />
                {r}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Phone</label>
          <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>City</label>
            <input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Country</label>
            <input style={inputStyle} value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </div>

        {role === 'seller' && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Brand</label>
            <input style={inputStyle} value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
        )}

        {role === 'advisor' && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Specialty</label>
            <input style={inputStyle} value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
          </div>
        )}

        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text, var(--color-text-primary))' }}>Active</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Banned users cannot sign in.</div>
          </div>
          <button type="button" onClick={() => setActive(!active)} style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: active ? 'var(--color-primary)' : 'var(--color-border)',
            position: 'relative', flexShrink: 0,
          }}>
            <span style={{
              position: 'absolute', top: 2, left: active ? 22 : 2,
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
        </div>

        <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Email verified: <strong>{user.emailVerified ? 'Yes' : 'No'}</strong>
        </div>

        {error && (
          <div style={{
            marginBottom: 14, padding: '9px 12px', borderRadius: 8,
            background: '#FFF1F2', border: '1px solid #FECDD3',
            color: 'var(--color-danger)', fontSize: 12,
          }}>{error}</div>
        )}
        {resetMsg && (
          <div style={{
            marginBottom: 14, padding: '9px 12px', borderRadius: 8,
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            color: 'var(--color-success)', fontSize: 12,
          }}>{resetMsg}</div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" onClick={() => void handleSendReset()} disabled={busy} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 14px', borderRadius: 8, border: '1px solid var(--color-border)',
            background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            color: 'var(--color-text, var(--color-text-primary))',
          }}>
            <KeyRound size={13} /> Send Password Reset Email
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} disabled={busy} style={{
              padding: '9px 18px', borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'none', cursor: 'pointer', fontSize: 13,
              color: 'var(--color-text, var(--color-text-primary))',
            }}>Cancel</button>
            <button type="submit" disabled={busy} style={{
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: 'var(--color-primary)', color: '#fff',
              cursor: busy ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, opacity: busy ? 0.7 : 1,
            }}>{busy ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </div>
      </form>
    </Modal>
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
  const [actionError, setActionError] = useState('');

  // Selection (uids of currently-selected rows)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modals
  const [showCreate,   setShowCreate]   = useState(false);
  const [editTarget,   setEditTarget]   = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [bulkConfirm,  setBulkConfirm]  = useState<'ban' | 'unban' | 'delete' | null>(null);
  const [bulkBusy,     setBulkBusy]     = useState(false);

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

  // Clear selection whenever the underlying list changes
  useEffect(() => { setSelected(new Set()); }, [page, roleFilter, debouncedSearch]);

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

      const filtered = debouncedSearch
        ? fetched.filter((u) =>
            u.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            u.email.toLowerCase().includes(debouncedSearch.toLowerCase())
          )
        : fetched;

      setUsers(filtered);
      setHasNext(hasMore);

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

  // ── API helpers ──────────────────────────────────────────────────────────
  async function apiPatch(uid: string, partial: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch('/api/admin/users', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid, ...partial }),
      });
      return await res.json() as { ok: boolean; error?: string };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  async function apiDelete(uid: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch('/api/admin/users', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid }),
      });
      return await res.json() as { ok: boolean; error?: string };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  // ── Single-row actions ───────────────────────────────────────────────────
  async function handleToggleBan(user: User) {
    const result = await apiPatch(user.uid, { active: !user.active });
    if (!result.ok) {
      setActionError(result.error ?? 'Failed to update user status.');
      return;
    }
    setUsers((prev) => prev.map((u) => u.uid === user.uid ? { ...u, active: !u.active } : u));
  }

  async function handleDelete(user: User) {
    const result = await apiDelete(user.uid);
    if (!result.ok) {
      setActionError(result.error ?? 'Failed to delete user.');
      return;
    }
    setUsers((prev) => prev.filter((u) => u.uid !== user.uid));
    setDeleteTarget(null);
  }

  // ── Selection ────────────────────────────────────────────────────────────
  const allOnPageSelected = users.length > 0 && users.every((u) => selected.has(u.uid));

  function toggleOne(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  }
  function toggleAll() {
    if (allOnPageSelected) setSelected(new Set());
    else setSelected(new Set(users.map((u) => u.uid)));
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────
  async function runBulk(action: 'ban' | 'unban' | 'delete') {
    setBulkBusy(true);
    setActionError('');
    const ids = Array.from(selected);
    let failed = 0;
    for (const uid of ids) {
      const result = action === 'delete'
        ? await apiDelete(uid)
        : await apiPatch(uid, { active: action === 'unban' });
      if (!result.ok) failed++;
    }
    setBulkBusy(false);
    setBulkConfirm(null);
    setSelected(new Set());
    if (failed > 0) setActionError(`${failed} of ${ids.length} operations failed.`);
    await fetchUsers();
  }

  function exportCSV() {
    const rows = users.filter((u) => selected.has(u.uid));
    if (rows.length === 0) return;
    const headers = ['uid','name','email','role','phone','city','country','brand','specialty','active','emailVerified','createdAt'];
    const lines = [headers.join(',')];
    for (const u of rows) {
      lines.push([
        u.uid, u.name, u.email, u.role, u.phone ?? '',
        u.location?.city ?? '', u.location?.country ?? '',
        u.brand ?? '', u.specialty ?? '',
        u.active, u.emailVerified,
        u.createdAt ? new Date(u.createdAt.seconds * 1000).toISOString() : '',
      ].map(csvEscape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradecircle-users-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

          {/* Create */}
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: 'var(--color-primary)', color: '#fff',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            <Plus size={14} /> Create User
          </button>
        </div>

        {/* Bulk toolbar */}
        {selected.size > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '10px 14px', marginBottom: 14, borderRadius: 10,
            background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text, var(--color-text-primary))' }}>
              {selected.size} selected
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setBulkConfirm('ban')}
              className="adm-action-btn"
              style={{ color: 'var(--color-warning)', borderColor: '#FDE68A' }}
            >
              <Ban size={12} /> Ban Selected
            </button>
            <button
              onClick={() => setBulkConfirm('unban')}
              className="adm-action-btn"
              style={{ color: 'var(--color-success)', borderColor: '#BBF7D0' }}
            >
              <ShieldCheck size={12} /> Unban Selected
            </button>
            <button
              onClick={() => setBulkConfirm('delete')}
              className="adm-action-btn"
              style={{ color: 'var(--color-danger)', borderColor: '#FECDD3' }}
            >
              <Trash2 size={12} /> Delete Selected
            </button>
            <button
              onClick={exportCSV}
              className="adm-action-btn"
              style={{ color: 'var(--color-text, var(--color-text-primary))' }}
            >
              <Download size={12} /> Export CSV
            </button>
          </div>
        )}

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
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      aria-label="Select all"
                      style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                    />
                  </th>
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
                    <td colSpan={9} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-secondary)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>No users found</div>
                      <div style={{ fontSize: 12 }}>Try adjusting your search or filter.</div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.uid}>
                      {/* Select checkbox */}
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(user.uid)}
                          onChange={() => toggleOne(user.uid)}
                          aria-label={`Select ${user.name}`}
                          style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                        />
                      </td>

                      {/* Avatar */}
                      <td>
                        {user.profilePhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
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
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            className="adm-action-btn"
                            onClick={() => setEditTarget(user)}
                            style={{ color: 'var(--color-primary)', borderColor: 'color-mix(in srgb, var(--color-primary) 35%, transparent)' }}
                            title="Edit user"
                          >
                            <Pencil size={12} /> Edit
                          </button>
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
                            <Trash2 size={12} /> Delete
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

      {/* Modals */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); void fetchUsers(); }}
        />
      )}

      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); void fetchUsers(); }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete User"
          message={<>Are you sure you want to permanently delete <strong>{deleteTarget.name}</strong>? This removes them from Firebase Auth and Firestore and cannot be undone.</>}
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleDelete(deleteTarget)}
        />
      )}

      {bulkConfirm && (
        <ConfirmModal
          title={
            bulkConfirm === 'delete' ? 'Delete Selected Users'
            : bulkConfirm === 'ban'  ? 'Ban Selected Users'
                                     : 'Unban Selected Users'
          }
          message={
            bulkConfirm === 'delete'
              ? <>Permanently delete <strong>{selected.size}</strong> user(s) from Firebase Auth and Firestore? This cannot be undone.</>
              : bulkConfirm === 'ban'
                ? <>Ban <strong>{selected.size}</strong> user(s)? They will be unable to sign in.</>
                : <>Unban <strong>{selected.size}</strong> user(s)? They will regain sign-in access.</>
          }
          confirmLabel={bulkConfirm === 'delete' ? 'Delete' : bulkConfirm === 'ban' ? 'Ban' : 'Unban'}
          danger={bulkConfirm === 'delete' || bulkConfirm === 'ban'}
          busy={bulkBusy}
          onCancel={() => setBulkConfirm(null)}
          onConfirm={() => void runBulk(bulkConfirm)}
        />
      )}
    </AdminLayout>
  );
}
