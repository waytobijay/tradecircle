'use client';

/**
 * app/admin/tax/page.tsx
 * Admin tax configuration page.
 * Reads/writes config/siteConfig → field: tax
 */

import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Pencil, Trash2, Plus, X, Check } from 'lucide-react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { db } from '@/services/firebase';
import type { TaxConfig, TaxRegion } from '@/types';

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: TaxConfig = {
  enabled: false,
  defaultRegionCode: 'AU',
  regions: [
    { code: 'AU', name: 'Australia',  taxName: 'GST',        rate: 10,  enabled: true,  applyToShipping: true,  inclusive: false },
    { code: 'NP', name: 'Nepal',      taxName: 'VAT',        rate: 13,  enabled: true,  applyToShipping: false, inclusive: false },
    { code: 'US', name: 'United States', taxName: 'Sales Tax', rate: 8.5, enabled: false, applyToShipping: false, inclusive: false },
  ],
};

const EMPTY_REGION: TaxRegion = {
  code: '',
  name: '',
  taxName: '',
  rate: 0,
  enabled: true,
  applyToShipping: false,
  inclusive: false,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 999,
        border: 'none',
        background: value ? 'var(--color-primary)' : 'var(--color-border)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: value ? 22 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} style={{ padding: '12px 14px' }}>
          <div style={{ height: 14, borderRadius: 4, background: 'var(--color-border)', width: '80%', animation: 'tax-pulse 1.4s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

// ─── RegionFormRow ────────────────────────────────────────────────────────────

interface RegionFormRowProps {
  initial: TaxRegion;
  onSave: (r: TaxRegion) => void;
  onCancel: () => void;
}

function RegionFormRow({ initial, onSave, onCancel }: RegionFormRowProps) {
  const [form, setForm] = useState<TaxRegion>(initial);

  function field(key: keyof TaxRegion, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: 'var(--color-background)',
    color: 'var(--color-text)',
    fontSize: 13,
  };

  return (
    <tr style={{ background: 'color-mix(in srgb, var(--color-primary) 5%, transparent)' }}>
      <td style={{ padding: '8px 14px' }}>
        <input
          style={inputStyle}
          placeholder="AU"
          value={form.code}
          onChange={(e) => field('code', e.target.value.toUpperCase())}
          maxLength={4}
        />
      </td>
      <td style={{ padding: '8px 14px' }}>
        <input
          style={inputStyle}
          placeholder="Australia"
          value={form.name}
          onChange={(e) => field('name', e.target.value)}
        />
      </td>
      <td style={{ padding: '8px 14px' }}>
        <input
          style={inputStyle}
          placeholder="GST"
          value={form.taxName}
          onChange={(e) => field('taxName', e.target.value)}
        />
      </td>
      <td style={{ padding: '8px 14px' }}>
        <input
          style={{ ...inputStyle, width: 70 }}
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={form.rate}
          onChange={(e) => field('rate', parseFloat(e.target.value) || 0)}
        />
      </td>
      <td style={{ padding: '8px 14px', textAlign: 'center' }}>
        <Toggle value={form.applyToShipping} onChange={(v) => field('applyToShipping', v)} />
      </td>
      <td style={{ padding: '8px 14px', textAlign: 'center' }}>
        <Toggle value={form.inclusive} onChange={(v) => field('inclusive', v)} />
      </td>
      <td style={{ padding: '8px 14px', textAlign: 'center' }}>
        <Toggle value={form.enabled} onChange={(v) => field('enabled', v)} />
      </td>
      <td style={{ padding: '8px 14px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => onSave(form)}
            style={{
              padding: '5px 10px', borderRadius: 6,
              border: 'none', background: 'var(--color-primary)', color: '#fff',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
            }}
          >
            <Check size={13} /> Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '5px 10px', borderRadius: 6,
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
            }}
          >
            <X size={13} /> Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TaxPage() {
  const [config, setConfig] = useState<TaxConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // inline add / edit state
  const [addingRow, setAddingRow] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'config', 'siteConfig'));
      if (snap.exists()) {
        const data = snap.data();
        if (data.tax) {
          setConfig(data.tax as TaxConfig);
          return;
        }
      }
      // Fall back to defaults if field absent
      setConfig(DEFAULT_CONFIG);
    } catch {
      setConfig(DEFAULT_CONFIG);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchConfig(); }, [fetchConfig]);

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'config', 'siteConfig'), { tax: config });
      showToast('Tax configuration saved.', 'success');
    } catch {
      showToast('Failed to save. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Region CRUD ──────────────────────────────────────────────────────────
  function handleAddRegion(region: TaxRegion) {
    if (!region.code) return;
    setConfig((prev) => ({ ...prev, regions: [...prev.regions, region] }));
    setAddingRow(false);
  }

  function handleEditRegion(updated: TaxRegion) {
    setConfig((prev) => ({
      ...prev,
      regions: prev.regions.map((r) => (r.code === updated.code ? updated : r)),
    }));
    setEditingCode(null);
  }

  function handleDeleteRegion(code: string) {
    setConfig((prev) => ({
      ...prev,
      regions: prev.regions.filter((r) => r.code !== code),
      defaultRegionCode: prev.defaultRegionCode === code ? '' : prev.defaultRegionCode,
    }));
    setDeleteConfirmCode(null);
  }

  // ── Styles ───────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '20px 24px',
    marginBottom: 20,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    marginBottom: 6,
    display: 'block',
  };

  const thStyle: React.CSSProperties = {
    padding: '10px 14px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    borderBottom: '1px solid var(--color-border)',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '12px 14px',
    fontSize: 13,
    color: 'var(--color-text)',
    borderBottom: '1px solid var(--color-border)',
    verticalAlign: 'middle',
  };

  return (
    <AdminLayout>
      <style>{`
        @keyframes tax-pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 500,
          padding: '12px 20px', borderRadius: 10,
          background: toast.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
          color: '#fff', fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
              Tax Configuration
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Manage tax regions and rates applied at checkout.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              padding: '10px 22px', borderRadius: 8,
              border: 'none', background: 'var(--color-primary)', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* ── Master settings ───────────────────────────────────────────── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Master toggle */}
            <div>
              <span style={labelStyle}>Enable Tax Collection</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Toggle
                  value={config.enabled}
                  onChange={(v) => setConfig((prev) => ({ ...prev, enabled: v }))}
                />
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  {config.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Default region */}
            <div>
              <label style={labelStyle} htmlFor="default-region">Default Region</label>
              <select
                id="default-region"
                value={config.defaultRegionCode}
                onChange={(e) => setConfig((prev) => ({ ...prev, defaultRegionCode: e.target.value }))}
                style={{
                  padding: '8px 12px', borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-background)',
                  color: 'var(--color-text)', fontSize: 13,
                  minWidth: 200,
                }}
              >
                <option value="">— select —</option>
                {config.regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name} ({r.code}) — {r.taxName} {r.rate}%
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Regions table ─────────────────────────────────────────────── */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
              Tax Regions
            </h3>
            <button
              type="button"
              onClick={() => { setAddingRow(true); setEditingCode(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8,
                border: '1px solid var(--color-primary)', background: 'transparent',
                color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={15} />
              Add Region
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Tax Name</th>
                  <th style={thStyle}>Rate %</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Apply to Shipping</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Inclusive</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Enabled</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                ) : (
                  <>
                    {config.regions.map((region) =>
                      editingCode === region.code ? (
                        <RegionFormRow
                          key={region.code}
                          initial={region}
                          onSave={handleEditRegion}
                          onCancel={() => setEditingCode(null)}
                        />
                      ) : (
                        <tr
                          key={region.code}
                          style={{ background: deleteConfirmCode === region.code ? 'color-mix(in srgb, var(--color-danger) 6%, transparent)' : 'transparent' }}
                        >
                          <td style={tdStyle}>
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: 6,
                              background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                              color: 'var(--color-primary)', fontWeight: 700, fontSize: 12,
                            }}>
                              {region.code}
                            </span>
                          </td>
                          <td style={tdStyle}>{region.name}</td>
                          <td style={tdStyle}>{region.taxName}</td>
                          <td style={tdStyle}>{region.rate}%</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <Toggle
                              value={region.applyToShipping}
                              onChange={(v) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  regions: prev.regions.map((r) =>
                                    r.code === region.code ? { ...r, applyToShipping: v } : r,
                                  ),
                                }))
                              }
                            />
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <Toggle
                              value={region.inclusive}
                              onChange={(v) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  regions: prev.regions.map((r) =>
                                    r.code === region.code ? { ...r, inclusive: v } : r,
                                  ),
                                }))
                              }
                            />
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <Toggle
                              value={region.enabled}
                              onChange={(v) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  regions: prev.regions.map((r) =>
                                    r.code === region.code ? { ...r, enabled: v } : r,
                                  ),
                                }))
                              }
                            />
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {deleteConfirmCode === region.code ? (
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRegion(region.code)}
                                  style={{
                                    padding: '4px 10px', borderRadius: 6,
                                    border: 'none', background: 'var(--color-danger)', color: '#fff',
                                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                  }}
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmCode(null)}
                                  style={{
                                    padding: '4px 10px', borderRadius: 6,
                                    border: '1px solid var(--color-border)', background: 'transparent',
                                    color: 'var(--color-text-secondary)', fontSize: 12, cursor: 'pointer',
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  title="Edit"
                                  onClick={() => { setEditingCode(region.code); setAddingRow(false); }}
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--color-primary)', padding: 4, borderRadius: 6,
                                    display: 'flex', alignItems: 'center',
                                  }}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  title="Delete"
                                  onClick={() => setDeleteConfirmCode(region.code)}
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--color-danger)', padding: 4, borderRadius: 6,
                                    display: 'flex', alignItems: 'center',
                                  }}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ),
                    )}

                    {/* Inline add row */}
                    {addingRow && (
                      <RegionFormRow
                        initial={EMPTY_REGION}
                        onSave={handleAddRegion}
                        onCancel={() => setAddingRow(false)}
                      />
                    )}
                  </>
                )}
              </tbody>
            </table>

            {!loading && config.regions.length === 0 && !addingRow && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 14 }}>
                No tax regions configured. Click &ldquo;Add Region&rdquo; to get started.
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
