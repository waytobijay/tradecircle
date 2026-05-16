/**
 * app/admin/admin-users/page.tsx
 * Admin Users management — CRUD + Permission Matrix.
 * Spec ref: section 6.7 (Admin Portal > Admin Users)
 *
 * Features:
 *  - Table: Name | Email | Role | Last Login | Status | Actions (Edit, Delete)
 *  - Permission Matrix grid (read-only, role vs permission)
 *  - Create Admin User modal: Name, Email, Temp Password, Role, Permission checklist
 *  - All CRUD operations write to Firestore `adminUsers` collection
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp,
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import {
  Plus, Pencil, Trash2, X, Eye, EyeOff, Check, Minus, KeyRound,
} from 'lucide-react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { db, auth } from '@/services/firebase';
import type { AdminUser, AdminRole, AdminPermissions } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const ADMIN_ROLES: { value: AdminRole; label: string }[] = [
  { value: 'super-admin', label: 'Super Admin' },
  { value: 'admin',       label: 'Admin'       },
  { value: 'moderator',   label: 'Moderator'   },
  { value: 'analyst',     label: 'Analyst'     },
];

const PERMISSION_KEYS: Array<{ key: keyof AdminPermissions; label: string }> = [
  { key: 'users',          label: 'Users'          },
  { key: 'products',       label: 'Products'       },
  { key: 'config',         label: 'Configuration'  },
  { key: 'exports',        label: 'Exports'        },
  { key: 'analytics',      label: 'Analytics'      },
  { key: 'backup',         label: 'Backup'         },
  { key: 'advisories',     label: 'Advisories'     },
  { key: 'enquiries',      label: 'Enquiries'      },
  { key: 'orders',         label: 'Orders'         },
  { key: 'ads',            label: 'Ads'            },
  { key: 'aiSettings',     label: 'AI Settings'    },
  { key: 'cms',            label: 'CMS'            },
  { key: 'featureToggles', label: 'Feature Toggles' },
];

// Permissions each role gets by default (for the read-only matrix)
const ROLE_PERMISSION_MATRIX: Record<AdminRole, (keyof AdminPermissions)[]> = {
  'super-admin': PERMISSION_KEYS.map((p) => p.key),
  admin:         ['users', 'products', 'advisories', 'enquiries', 'orders', 'ads', 'cms', 'featureToggles', 'analytics'],
  moderator:     ['users', 'products', 'advisories', 'enquiries', 'orders', 'cms'],
  analyst:       ['analytics', 'exports'],
};

const MATRIX_COLUMNS: Array<{ role: AdminRole; label: string; color: string }> = [
  { role: 'super-admin', label: 'Super Admin', color: '#DC2626' },
  { role: 'admin',       label: 'Admin',       color: '#1D4ED8' },
  { role: 'moderator',   label: 'Moderator',   color: '#16A34A' },
  { role: 'analyst',     label: 'Analyst',     color: '#C2410C' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function defaultPermissions(role: AdminRole): AdminPermissions {
  const allowed = new Set(ROLE_PERMISSION_MATRIX[role]);
  return PERMISSION_KEYS.reduce((acc, { key }) => {
    acc[key] = allowed.has(key);
    return acc;
  }, {} as AdminPermissions);
}

function formatDate(ts: { seconds: number } | null | undefined): string {
  if (!ts) return 'Never';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Role Badge ──────────────────────────────────────────────────────────────

const ADMIN_ROLE_STYLES: Record<AdminRole, { bg: string; color: string }> = {
  'super-admin': { bg: '#FEF2F2', color: '#DC2626' },
  admin:         { bg: '#EFF6FF', color: '#1D4ED8' },
  moderator:     { bg: '#F0FDF4', color: '#16A34A' },
  analyst:       { bg: '#FFF7ED', color: '#C2410C' },
};

function AdminRoleBadge({ role }: { role: AdminRole }) {
  const s = ADMIN_ROLE_STYLES[role];
  const label = ADMIN_ROLES.find((r) => r.value === role)?.label ?? role;
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 600,
      padding: '2px 9px', borderRadius: 9999,
      background: s.bg, color: s.color,
    }}>
      {label}
    </span>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface ModalFormState {
  name:        string;
  email:       string;
  tempPassword: string;
  role:        AdminRole;
  permissions: AdminPermissions;
}

function emptyForm(): ModalFormState {
  return {
    name:         '',
    email:        '',
    tempPassword: '',
    role:         'admin',
    permissions:  defaultPermissions('admin'),
  };
}

interface AdminUserModalProps {
  initial:   ModalFormState | null; // null = create mode, object = edit mode
  editId:    string | null;
  onClose:   () => void;
  onSaved:   () => void;
}

function AdminUserModal({ initial, editId, onClose, onSaved }: AdminUserModalProps) {
  const [form,        setForm]        = useState<ModalFormState>(initial ?? emptyForm());
  const [showPwd,     setShowPwd]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  const isEdit = !!editId;

  function handleRoleChange(role: AdminRole) {
    setForm((f) => ({ ...f, role, permissions: defaultPermissions(role) }));
  }

  function togglePermission(key: keyof AdminPermissions) {
    setForm((f) => ({
      ...f,
      permissions: { ...f.permissions, [key]: !f.permissions[key] },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (!isEdit && !form.tempPassword.trim()) {
      setError('Temporary password is required for new admins.');
      return;
    }
    setSaving(true);
    try {
      if (isEdit && editId) {
        await updateDoc(doc(db, 'adminUsers', editId), {
          name:        form.name.trim(),
          email:       form.email.trim(),
          role:        form.role,
          permissions: form.permissions,
        });
      } else {
        await addDoc(collection(db, 'adminUsers'), {
          name:        form.name.trim(),
          email:       form.email.trim(),
          role:        form.role,
          permissions: form.permissions,
          active:      true,
          createdAt:   serverTimestamp(),
          // Note: tempPassword is intentionally NOT stored in Firestore.
          // In production, send via Firebase Auth createUser or email invite.
        });
      }
      onSaved();
    } catch (err) {
      console.error(err);
      setError('Failed to save admin user. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--color-border)', fontSize: 13,
    background: 'var(--color-background, var(--color-bg-primary))',
    color: 'var(--color-text, var(--color-text-primary))',
    outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)',
      overflowY: 'auto', padding: '40px 16px',
    }}>
      <div style={{
        background: 'var(--color-background, var(--color-bg-primary))',
        border: '1px solid var(--color-border)',
        borderRadius: 14, padding: 28, maxWidth: 540, width: '100%',
        boxShadow: '0 16px 48px rgba(0,0,0,0.16)',
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--color-text, var(--color-text-primary))' }}>
            {isEdit ? 'Edit Admin User' : 'Create Admin User'}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
              Full Name *
            </label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Jane Smith"
              required
            />
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
              Email Address *
            </label>
            <input
              type="email"
              style={inputStyle}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="admin@tradecircle.com"
              required
            />
          </div>

          {/* Temp Password (create only) */}
          {!isEdit && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
                Temporary Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  style={{ ...inputStyle, paddingRight: 40 }}
                  value={form.tempPassword}
                  onChange={(e) => setForm((f) => ({ ...f, tempPassword: e.target.value }))}
                  placeholder="Min 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          )}

          {/* Role */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-secondary)' }}>
              Role *
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {ADMIN_ROLES.map(({ value, label }) => (
                <label
                  key={value}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    color: 'var(--color-text, var(--color-text-primary))',
                  }}
                >
                  <input
                    type="radio"
                    name="adminRole"
                    value={value}
                    checked={form.role === value}
                    onChange={() => handleRoleChange(value)}
                    style={{ accentColor: 'var(--color-primary)', width: 15, height: 15 }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Permissions checklist */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--color-text-secondary)' }}>
              Permissions
            </label>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 16px',
              padding: 14, borderRadius: 8,
              background: 'var(--color-surface, var(--color-bg-secondary))',
              border: '1px solid var(--color-border)',
            }}>
              {PERMISSION_KEYS.map(({ key, label }) => (
                <label
                  key={key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    cursor: 'pointer', fontSize: 13,
                    color: 'var(--color-text, var(--color-text-primary))',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!form.permissions[key]}
                    onChange={() => togglePermission(key)}
                    style={{ accentColor: 'var(--color-primary)', width: 14, height: 14 }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div style={{
              marginBottom: 14, padding: '9px 12px', borderRadius: 8,
              background: '#FFF1F2', border: '1px solid #FECDD3',
              color: 'var(--color-danger)', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 18px', borderRadius: 8, border: '1px solid var(--color-border)',
                background: 'none', cursor: 'pointer', fontSize: 13,
                color: 'var(--color-text, var(--color-text-primary))',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '9px 22px', borderRadius: 8, border: 'none',
                background: 'var(--color-primary)', color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteModal({
  adminUser,
  onConfirm,
  onCancel,
}: {
  adminUser: AdminUser;
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
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
          Delete Admin User
        </h3>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 24 }}>
          Are you sure you want to remove <strong>{adminUser.name}</strong> from the admin panel? This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 18px', borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'none', cursor: 'pointer', fontSize: 13,
              color: 'var(--color-text, var(--color-text-primary))',
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
  const [adminUsers,    setAdminUsers]    = useState<AdminUser[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [editTarget,    setEditTarget]    = useState<AdminUser | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<AdminUser | null>(null);
  const [error,         setError]         = useState('');
  const [resetStatus,   setResetStatus]   = useState<{ id: string; state: 'sending' | 'sent' } | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchAdminUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const snap = await getDocs(collection(db, 'adminUsers'));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminUser));
      setAdminUsers(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load admin users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAdminUsers(); }, [fetchAdminUsers]);

  // ── Actions ──────────────────────────────────────────────────────────────
  async function handleToggleActive(adminUser: AdminUser) {
    try {
      await updateDoc(doc(db, 'adminUsers', adminUser.id), { active: !adminUser.active });
      setAdminUsers((prev) =>
        prev.map((u) => u.id === adminUser.id ? { ...u, active: !u.active } : u)
      );
    } catch {
      setError('Failed to update admin user status.');
    }
  }

  async function handleSendPasswordReset(adminUser: AdminUser) {
    setResetStatus({ id: adminUser.id, state: 'sending' });
    try {
      await sendPasswordResetEmail(auth, adminUser.email);
      setResetStatus({ id: adminUser.id, state: 'sent' });
      // Clear the inline confirmation after a few seconds.
      setTimeout(() => {
        setResetStatus((curr) => (curr?.id === adminUser.id ? null : curr));
      }, 4000);
    } catch (err) {
      console.error('[admin-users] sendPasswordResetEmail failed:', err);
      setResetStatus(null);
      setError(
        err instanceof Error
          ? `Failed to send reset email: ${err.message}`
          : 'Failed to send reset email.',
      );
    }
  }

  async function handleDelete(adminUser: AdminUser) {
    try {
      await deleteDoc(doc(db, 'adminUsers', adminUser.id));
      setAdminUsers((prev) => prev.filter((u) => u.id !== adminUser.id));
      setDeleteTarget(null);
    } catch {
      setError('Failed to delete admin user.');
    }
  }

  function openEdit(adminUser: AdminUser) {
    setEditTarget(adminUser);
    setModalOpen(true);
  }

  function openCreate() {
    setEditTarget(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditTarget(null);
  }

  async function handleSaved() {
    setModalOpen(false);
    setEditTarget(null);
    await fetchAdminUsers();
  }

  // Build edit initial state from AdminUser
  const editInitial: ModalFormState | null = editTarget
    ? {
        name:         editTarget.name,
        email:        editTarget.email,
        tempPassword: '',
        role:         editTarget.role,
        permissions:  editTarget.permissions,
      }
    : null;

  return (
    <AdminLayout>
      <style>{`
        .adm-au-table { width: 100%; border-collapse: collapse; }
        .adm-au-table th {
          text-align: left; font-size: 11px; font-weight: 600;
          letter-spacing: 0.05em; color: var(--color-text-secondary);
          text-transform: uppercase; padding: 10px 16px;
          border-bottom: 1px solid var(--color-border); white-space: nowrap;
        }
        .adm-au-table td {
          font-size: 13px; padding: 14px 16px;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text, var(--color-text-primary));
          vertical-align: middle;
        }
        .adm-au-table tr:last-child td { border-bottom: none; }
        .adm-au-table tbody tr:hover td { background: var(--color-surface, var(--color-bg-secondary)); }
        .adm-matrix-table { width: 100%; border-collapse: collapse; }
        .adm-matrix-table th, .adm-matrix-table td {
          padding: 9px 14px; text-align: center; font-size: 12px;
          border: 1px solid var(--color-border);
        }
        .adm-matrix-table th { font-weight: 600; background: var(--color-surface, var(--color-bg-secondary)); }
        .adm-matrix-table td:first-child { text-align: left; font-weight: 500; white-space: nowrap; }
      `}</style>

      <div style={{ padding: '24px' }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--color-text, var(--color-text-primary))' }}>
            Admin Users
          </h2>
          <button
            onClick={openCreate}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 9, border: 'none',
              background: 'var(--color-primary)', color: '#fff',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            <Plus size={15} />
            Create Admin User
          </button>
        </div>

        {error && (
          <div style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 8,
            background: '#FFF1F2', border: '1px solid #FECDD3',
            color: 'var(--color-danger)', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* ── Admin Users Table ────────────────────────────────────────────── */}
        <div style={{
          background: 'var(--color-surface, var(--color-bg-secondary))',
          border: '1px solid var(--color-border)',
          borderRadius: 12, overflow: 'hidden', marginBottom: 28,
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-au-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Last Login</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      {[140, 180, 90, 130, 70, 100].map((w, j) => (
                        <td key={j} style={{ padding: '14px 16px' }}>
                          <div style={{
                            width: w, height: 13, borderRadius: 6,
                            background: 'var(--color-border)',
                            animation: 'shimmer 1.4s ease-in-out infinite',
                          }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : adminUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-secondary)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🛡️</div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>No admin users yet</div>
                      <div style={{ fontSize: 12 }}>Click "Create Admin User" to add one.</div>
                    </td>
                  </tr>
                ) : (
                  adminUsers.map((au) => (
                    <tr key={au.id}>
                      {/* Name */}
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: 'var(--color-primary)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 700,
                          }}>
                            {au.name?.charAt(0).toUpperCase()}
                          </div>
                          {au.name}
                        </div>
                      </td>

                      {/* Email */}
                      <td style={{ color: 'var(--color-text-secondary)' }}>{au.email}</td>

                      {/* Role */}
                      <td><AdminRoleBadge role={au.role} /></td>

                      {/* Last Login */}
                      <td style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatDate(au.lastLogin ?? null)}
                      </td>

                      {/* Status */}
                      <td>
                        <span style={{
                          display: 'inline-block', fontSize: 11, fontWeight: 600,
                          padding: '2px 9px', borderRadius: 9999,
                          background: au.active ? '#F0FDF4' : '#FFF1F2',
                          color:      au.active ? '#16A34A' : '#DC2626',
                        }}>
                          {au.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => openEdit(au)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                              border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer',
                              color: 'var(--color-primary)',
                            }}
                            title="Edit"
                          >
                            <Pencil size={12} /> Edit
                          </button>
                          <button
                            onClick={() => void handleSendPasswordReset(au)}
                            disabled={resetStatus?.id === au.id && resetStatus.state === 'sending'}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                              border: '1px solid var(--color-border)', background: 'none',
                              cursor: resetStatus?.id === au.id && resetStatus.state === 'sending' ? 'not-allowed' : 'pointer',
                              color: resetStatus?.id === au.id && resetStatus.state === 'sent'
                                ? 'var(--color-success)'
                                : 'var(--color-text-secondary)',
                            }}
                            title="Send password reset email"
                          >
                            <KeyRound size={12} />
                            {resetStatus?.id === au.id && resetStatus.state === 'sending'
                              ? 'Sending…'
                              : resetStatus?.id === au.id && resetStatus.state === 'sent'
                                ? 'Reset sent'
                                : 'Send Reset'}
                          </button>
                          <button
                            onClick={() => void handleToggleActive(au)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                              border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer',
                              color: au.active ? 'var(--color-warning)' : 'var(--color-success)',
                            }}
                          >
                            {au.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(au)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                              border: '1px solid #FECDD3', background: 'none', cursor: 'pointer',
                              color: 'var(--color-danger)',
                            }}
                            title="Delete"
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
        </div>

        {/* ── Permission Matrix ────────────────────────────────────────────── */}
        <div style={{
          background: 'var(--color-surface, var(--color-bg-secondary))',
          border: '1px solid var(--color-border)',
          borderRadius: 12, padding: '20px', overflow: 'hidden',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--color-text, var(--color-text-primary))' }}>
            Permission Matrix
          </h3>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
            Default permissions granted to each admin role. Individual admin users may have custom overrides set above.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-matrix-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', minWidth: 140 }}>Permission</th>
                  {MATRIX_COLUMNS.map((col) => (
                    <th key={col.role} style={{ color: col.color, minWidth: 110 }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_KEYS.map(({ key, label }) => (
                  <tr key={key}>
                    <td style={{ color: 'var(--color-text, var(--color-text-primary))', fontSize: 13 }}>
                      {label}
                    </td>
                    {MATRIX_COLUMNS.map((col) => {
                      const has = ROLE_PERMISSION_MATRIX[col.role].includes(key);
                      return (
                        <td key={col.role}>
                          {has ? (
                            <Check size={15} style={{ color: '#16A34A', margin: '0 auto' }} />
                          ) : (
                            <Minus size={15} style={{ color: 'var(--color-border)', margin: '0 auto' }} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <AdminUserModal
          initial={editInitial}
          editId={editTarget?.id ?? null}
          onClose={handleModalClose}
          onSaved={() => void handleSaved()}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          adminUser={deleteTarget}
          onConfirm={() => void handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <style>{`@keyframes shimmer { 0%{opacity:1} 50%{opacity:0.4} 100%{opacity:1} }`}</style>
    </AdminLayout>
  );
}
