/**
 * app/admin/roles/page.tsx
 * Phase 4 — Regional admin management with hierarchical scope.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp,
} from 'firebase/firestore';
import { Plus, Pencil, Trash2, X, UserCog } from 'lucide-react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { db } from '@/services/firebase';
import type { RegionalAdmin, RegionalRole, AdminPermissions } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const REGIONAL_ROLES: { value: RegionalRole; label: string }[] = [
  { value: 'global-admin',   label: 'Global Admin'   },
  { value: 'regional-admin', label: 'Regional Admin' },
  { value: 'country-admin',  label: 'Country Admin'  },
  { value: 'city-moderator', label: 'City Moderator' },
];

const ROLE_STYLES: Record<RegionalRole, { bg: string; color: string }> = {
  'global-admin':   { bg: '#FEF2F2', color: '#DC2626' },
  'regional-admin': { bg: '#F5F3FF', color: '#7C3AED' },
  'country-admin':  { bg: '#EFF6FF', color: '#1D4ED8' },
  'city-moderator': { bg: '#F3F4F6', color: '#4B5563' },
};

const PERMISSION_KEYS: Array<{ key: keyof AdminPermissions; label: string }> = [
  { key: 'users',          label: 'Users'           },
  { key: 'products',       label: 'Products'        },
  { key: 'advisories',     label: 'Advisories'      },
  { key: 'enquiries',      label: 'Enquiries'       },
  { key: 'orders',         label: 'Orders'          },
  { key: 'ads',            label: 'Ads'             },
  { key: 'aiSettings',     label: 'AI Settings'     },
  { key: 'cms',            label: 'CMS'             },
  { key: 'featureToggles', label: 'Feature Toggles' },
  { key: 'config',         label: 'Configuration'   },
  { key: 'analytics',      label: 'Analytics'       },
  { key: 'exports',        label: 'Exports'         },
  { key: 'backup',         label: 'Backup'          },
];

function emptyPermissions(): AdminPermissions {
  return PERMISSION_KEYS.reduce((acc, { key }) => {
    acc[key] = false;
    return acc;
  }, {} as AdminPermissions);
}

function RoleBadge({ role }: { role: RegionalRole }) {
  const s = ROLE_STYLES[role];
  const label = REGIONAL_ROLES.find((r) => r.value === role)?.label ?? role;
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

function scopeSummary(scope: RegionalAdmin['scope']): string {
  const parts: string[] = [];
  const geo = [...(scope.regions ?? []), ...(scope.countries ?? [])];
  if (geo.length) parts.push(geo.join(', '));
  if (scope.cities?.length) parts.push(`${scope.cities.length} cit${scope.cities.length === 1 ? 'y' : 'ies'}`);
  return parts.length ? parts.join(' — ') : 'No scope';
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  email: string;
  role: RegionalRole;
  regions: string;     // comma-separated
  countries: string;
  cities: string;
  permissions: AdminPermissions;
}

function emptyForm(): FormState {
  return {
    name: '', email: '', role: 'regional-admin',
    regions: '', countries: '', cities: '',
    permissions: emptyPermissions(),
  };
}

interface ModalProps {
  initial: FormState | null;
  editId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function RegionalAdminModal({ initial, editId, onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState<FormState>(initial ?? emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = !!editId;

  function togglePermission(key: keyof AdminPermissions) {
    setForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));
  }

  function parseChips(s: string): string[] {
    return s.split(',').map((x) => x.trim()).filter(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        scope: {
          regions: parseChips(form.regions),
          countries: parseChips(form.countries),
          cities: parseChips(form.cities),
        },
        permissions: form.permissions,
      };
      if (isEdit && editId) {
        await updateDoc(doc(db, 'regionalAdmins', editId), payload);
      } else {
        await addDoc(collection(db, 'regionalAdmins'), {
          ...payload,
          uid: '',
          active: true,
          createdAt: serverTimestamp(),
        });
      }
      onSaved();
    } catch (err) {
      console.error(err);
      setError('Failed to save regional admin.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--color-border)', fontSize: 13,
    background: 'var(--color-background)', color: 'var(--color-text)',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    marginBottom: 6, color: 'var(--color-text-secondary)',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)',
      overflowY: 'auto', padding: '40px 16px',
    }}>
      <div style={{
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 14, padding: 28, maxWidth: 600, width: '100%',
        boxShadow: '0 16px 48px rgba(0,0,0,0.16)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
            {isEdit ? 'Edit Regional Admin' : 'Add Regional Admin'}
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-secondary)', padding: 4,
          }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input style={inputStyle} value={form.name} required
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Jane Smith" />
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input type="email" style={inputStyle} value={form.email} required
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="admin@tradecircle.com" />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Role *</label>
            <select style={inputStyle} value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as RegionalRole }))}>
              {REGIONAL_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Regions (comma-separated)</label>
            <input style={inputStyle} value={form.regions}
              onChange={(e) => setForm((f) => ({ ...f, regions: e.target.value }))}
              placeholder="e.g. APAC, EMEA" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Countries (comma-separated)</label>
            <input style={inputStyle} value={form.countries}
              onChange={(e) => setForm((f) => ({ ...f, countries: e.target.value }))}
              placeholder="e.g. AU, NP, IN" />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Cities (comma-separated)</label>
            <input style={inputStyle} value={form.cities}
              onChange={(e) => setForm((f) => ({ ...f, cities: e.target.value }))}
              placeholder="e.g. Sydney, Kathmandu" />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ ...labelStyle, marginBottom: 10 }}>Permissions</label>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 16px',
              padding: 14, borderRadius: 8,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}>
              {PERMISSION_KEYS.map(({ key, label }) => (
                <label key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  cursor: 'pointer', fontSize: 13, color: 'var(--color-text)',
                }}>
                  <input type="checkbox" checked={!!form.permissions[key]}
                    onChange={() => togglePermission(key)}
                    style={{ accentColor: 'var(--color-primary)', width: 14, height: 14 }} />
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

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              padding: '9px 18px', borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text)',
            }}>Cancel</button>
            <button type="submit" disabled={saving} style={{
              padding: '9px 22px', borderRadius: 8, border: 'none',
              background: 'var(--color-primary)', color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RegionalRolesPage() {
  const [admins, setAdmins] = useState<(RegionalAdmin & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<(RegionalAdmin & { id: string }) | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<(RegionalAdmin & { id: string }) | null>(null);
  const [error, setError] = useState('');

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const snap = await getDocs(collection(db, 'regionalAdmins'));
      const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as RegionalAdmin) }));
      setAdmins(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load regional admins.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAdmins(); }, [fetchAdmins]);

  async function handleToggleActive(a: RegionalAdmin & { id: string }) {
    try {
      await updateDoc(doc(db, 'regionalAdmins', a.id), { active: !a.active });
      setAdmins((prev) => prev.map((x) => x.id === a.id ? { ...x, active: !x.active } : x));
    } catch {
      setError('Failed to update status.');
    }
  }

  async function handleDelete(a: RegionalAdmin & { id: string }) {
    try {
      await deleteDoc(doc(db, 'regionalAdmins', a.id));
      setAdmins((prev) => prev.filter((x) => x.id !== a.id));
      setDeleteTarget(null);
    } catch {
      setError('Failed to delete admin.');
    }
  }

  const editInitial: FormState | null = editTarget ? {
    name: editTarget.name, email: editTarget.email, role: editTarget.role,
    regions:   editTarget.scope?.regions?.join(', ')   ?? '',
    countries: editTarget.scope?.countries?.join(', ') ?? '',
    cities:    editTarget.scope?.cities?.join(', ')    ?? '',
    permissions: editTarget.permissions ?? emptyPermissions(),
  } : null;

  return (
    <AdminLayout>
      <style>{`
        .adm-rr-table { width: 100%; border-collapse: collapse; }
        .adm-rr-table th {
          text-align: left; font-size: 11px; font-weight: 600;
          letter-spacing: 0.05em; color: var(--color-text-secondary);
          text-transform: uppercase; padding: 10px 16px;
          border-bottom: 1px solid var(--color-border); white-space: nowrap;
        }
        .adm-rr-table td {
          font-size: 13px; padding: 14px 16px;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text); vertical-align: middle;
        }
        .adm-rr-table tr:last-child td { border-bottom: none; }
        .adm-rr-table tbody tr:hover td { background: var(--color-surface); }
      `}</style>

      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
            Regional Admins
          </h2>
          <button onClick={() => { setEditTarget(null); setModalOpen(true); }} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 9, border: 'none',
            background: 'var(--color-primary)', color: '#fff',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            <Plus size={15} /> Add Regional Admin
          </button>
        </div>

        {error && (
          <div style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 8,
            background: '#FFF1F2', border: '1px solid #FECDD3',
            color: 'var(--color-danger)', fontSize: 13,
          }}>{error}</div>
        )}

        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-rr-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Scope</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-secondary)' }}>Loading…</td></tr>
                ) : admins.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-secondary)' }}>
                      <UserCog size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>No regional admins yet.</div>
                      <div style={{ fontSize: 12 }}>Add hierarchical access for multi-region operations.</div>
                    </td>
                  </tr>
                ) : (
                  admins.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.name}</td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{a.email}</td>
                      <td><RoleBadge role={a.role} /></td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{scopeSummary(a.scope ?? { regions: [], countries: [], cities: [] })}</td>
                      <td>
                        <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!a.active} onChange={() => void handleToggleActive(a)}
                            style={{ accentColor: 'var(--color-primary)', width: 16, height: 16 }} />
                        </label>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setEditTarget(a); setModalOpen(true); }} style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                            border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer',
                            color: 'var(--color-primary)',
                          }}>
                            <Pencil size={12} /> Edit
                          </button>
                          <button onClick={() => setDeleteTarget(a)} style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                            border: '1px solid #FECDD3', background: 'none', cursor: 'pointer',
                            color: 'var(--color-danger)',
                          }}>
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
      </div>

      {modalOpen && (
        <RegionalAdminModal
          initial={editInitial}
          editId={editTarget?.id ?? null}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
          onSaved={() => { setModalOpen(false); setEditTarget(null); void fetchAdmins(); }}
        />
      )}

      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.45)',
        }}>
          <div style={{
            background: 'var(--color-background)',
            border: '1px solid var(--color-border)',
            borderRadius: 14, padding: 28, maxWidth: 400, width: '90%',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--color-text)' }}>
              Delete Regional Admin
            </h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 24 }}>
              Remove <strong>{deleteTarget.name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} style={{
                padding: '9px 18px', borderRadius: 8, border: '1px solid var(--color-border)',
                background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text)',
              }}>Cancel</button>
              <button onClick={() => void handleDelete(deleteTarget)} style={{
                padding: '9px 18px', borderRadius: 8, border: 'none',
                background: 'var(--color-danger)', color: '#fff',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
