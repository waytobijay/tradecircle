/**
 * app/admin/ads/page.tsx
 * Ads management — full CRUD with Firestore, stats row, filter tabs, table, modal.
 * Spec ref: section 6.7 (Admin Portal — Ads)
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { Ad, AdType, AdStatus, AdCreative, AdTargeting, AdSchedule, UserRole } from '@/types';
import {
  Plus, Edit2, Trash2, Pause, Play, Megaphone,
  TrendingUp, MousePointerClick, Eye, BarChart2, X,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function ctr(impressions: number, clicks: number): string {
  if (!impressions) return '0.00%';
  return ((clicks / impressions) * 100).toFixed(2) + '%';
}

function tsToDisplay(ts: Timestamp | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dateStrToTs(str: string): Timestamp {
  const d = new Date(str);
  return { seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0, toDate: () => d } as Timestamp;
}

function tsToDateStr(ts: Timestamp | undefined): string {
  if (!ts) return '';
  return ts.toDate().toISOString().split('T')[0];
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AdTypeFilter = 'all' | AdType;

interface AdFormState {
  name: string;
  advertiserId: string;
  type: AdType;
  imageUrl: string;
  headline: string;
  ctaUrl: string;
  locationRadius: string;
  category: string;
  roles: UserRole[];
  startDate: string;
  endDate: string;
  budget: string;
}

const EMPTY_FORM: AdFormState = {
  name: '',
  advertiserId: '',
  type: 'feed',
  imageUrl: '',
  headline: '',
  ctaUrl: '',
  locationRadius: '',
  category: '',
  roles: [],
  startDate: '',
  endDate: '',
  budget: '',
};

const AD_TYPES: { value: AdType; label: string }[] = [
  { value: 'feed',     label: 'Feed Post' },
  { value: 'boost',    label: 'Product Boost' },
  { value: 'banner',   label: 'Banner' },
  { value: 'location', label: 'Location-Based' },
];

const TYPE_FILTER_TABS: { value: AdTypeFilter; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'feed',     label: 'Feed' },
  { value: 'boost',    label: 'Boost' },
  { value: 'banner',   label: 'Banner' },
  { value: 'location', label: 'Location' },
];

const STATUS_COLOR: Record<AdStatus, string> = {
  active: 'var(--color-success)',
  paused: 'var(--color-warning)',
  ended:  'var(--color-text-secondary)',
};

const TYPE_COLOR: Record<AdType, string> = {
  feed:     '#3B82F6',
  boost:    '#8B5CF6',
  banner:   '#F59E0B',
  location: '#10B981',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAdsPage() {
  const [ads, setAds]               = useState<Ad[]>([]);
  const [loading, setLoading]       = useState(true);
  const [typeFilter, setTypeFilter] = useState<AdTypeFilter>('all');
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<Ad | null>(null);
  const [form, setForm]             = useState<AdFormState>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Ad | null>(null);
  const [deleting, setDeleting]     = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'ads'));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ad));
      setAds(data);
    } catch (err) {
      console.error('[Ads] load error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const activeCount    = ads.filter((a) => a.status === 'active').length;
  const totalImpress   = ads.reduce((s, a) => s + (a.stats?.impressions ?? 0), 0);
  const totalClicks    = ads.reduce((s, a) => s + (a.stats?.clicks ?? 0), 0);
  const avgCtr         = totalImpress ? ((totalClicks / totalImpress) * 100).toFixed(2) + '%' : '0.00%';

  const filtered = typeFilter === 'all' ? ads : ads.filter((a) => a.type === typeFilter);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(ad: Ad) {
    setEditing(ad);
    setForm({
      name:           ad.name,
      advertiserId:   ad.advertiserId,
      type:           ad.type,
      imageUrl:       ad.creative?.imageUrl ?? '',
      headline:       ad.creative?.headline ?? '',
      ctaUrl:         ad.creative?.ctaUrl ?? '',
      locationRadius: String(ad.targeting?.locationRadius ?? ''),
      category:       ad.targeting?.category ?? '',
      roles:          ad.targeting?.roles ?? [],
      startDate:      tsToDateStr(ad.schedule?.startDate),
      endDate:        tsToDateStr(ad.schedule?.endDate),
      budget:         String(ad.budget ?? ''),
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function toggleRole(role: UserRole) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role)
        ? f.roles.filter((r) => r !== role)
        : [...f.roles, role],
    }));
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.name.trim() || !form.advertiserId.trim()) return;
    setSaving(true);
    try {
      const creative: AdCreative = {
        imageUrl: form.imageUrl,
        headline: form.headline,
        ctaUrl:   form.ctaUrl,
      };
      const targeting: AdTargeting = {
        locationRadius: form.locationRadius ? Number(form.locationRadius) : undefined,
        category:       form.category || undefined,
        roles:          form.roles,
      };
      const schedule: AdSchedule = {
        startDate: dateStrToTs(form.startDate),
        endDate:   dateStrToTs(form.endDate),
      };

      if (editing) {
        await updateDoc(doc(db, 'ads', editing.id), {
          name: form.name,
          advertiserId: form.advertiserId,
          type: form.type,
          creative,
          targeting,
          schedule,
          budget: form.budget ? Number(form.budget) : null,
        });
      } else {
        await addDoc(collection(db, 'ads'), {
          name: form.name,
          advertiserId: form.advertiserId,
          type: form.type,
          creative,
          targeting,
          schedule,
          budget: form.budget ? Number(form.budget) : null,
          status: 'active' as AdStatus,
          stats: { impressions: 0, clicks: 0 },
          createdAt: serverTimestamp(),
        });
      }
      closeModal();
      await load();
    } catch (err) {
      console.error('[Ads] save error', err);
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle status ──────────────────────────────────────────────────────────

  async function handleToggleStatus(ad: Ad) {
    const next: AdStatus = ad.status === 'active' ? 'paused' : 'active';
    try {
      await updateDoc(doc(db, 'ads', ad.id), { status: next });
      setAds((prev) => prev.map((a) => a.id === ad.id ? { ...a, status: next } : a));
    } catch (err) {
      console.error('[Ads] toggle error', err);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'ads', deleteTarget.id));
      setAds((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('[Ads] delete error', err);
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const STATS_ROW = [
    { label: 'Active Ads',      value: String(activeCount),  icon: <Megaphone size={18} />,         color: 'var(--color-primary)'  },
    { label: 'Total Impressions', value: fmt(totalImpress), icon: <Eye size={18} />,                color: '#8B5CF6'               },
    { label: 'Total Clicks',    value: fmt(totalClicks),     icon: <MousePointerClick size={18} />, color: '#F59E0B'               },
    { label: 'Average CTR',     value: avgCtr,               icon: <BarChart2 size={18} />,         color: 'var(--color-success)'  },
  ];

  return (
    <AdminLayout>
      <div style={{ padding: '28px 24px', maxWidth: 1200 }}>

        <style>{`
          .ads-stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 28px;
          }
          @media (max-width: 900px) { .ads-stats-grid { grid-template-columns: repeat(2, 1fr); } }
          @media (max-width: 480px) { .ads-stats-grid { grid-template-columns: 1fr 1fr; } }
          .ads-table-wrap { overflow-x: auto; }
          .ads-table { width: 100%; border-collapse: collapse; font-size: 13px; }
          .ads-table th {
            text-align: left;
            padding: 10px 14px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--color-text-secondary);
            border-bottom: 1px solid var(--color-border);
            white-space: nowrap;
          }
          .ads-table td {
            padding: 12px 14px;
            border-bottom: 1px solid var(--color-border);
            color: var(--color-text);
            vertical-align: middle;
          }
          .ads-table tr:last-child td { border-bottom: none; }
          .ads-table tr:hover td { background: color-mix(in srgb, var(--color-primary) 4%, transparent); }
          .ads-btn {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
            cursor: pointer; border: none; transition: opacity 0.15s;
          }
          .ads-btn:hover { opacity: 0.85; }
          .ads-btn-primary { background: var(--color-primary); color: #fff; }
          .ads-btn-ghost {
            background: transparent;
            color: var(--color-text-secondary);
            border: 1px solid var(--color-border);
          }
          .ads-btn-danger { background: var(--color-danger); color: #fff; }
          .ads-btn-sm { padding: 5px 10px; font-size: 12px; border-radius: 6px; }
          .ads-modal-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.45);
            display: flex; align-items: center; justify-content: center;
            z-index: 1000; padding: 16px;
          }
          .ads-modal {
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: 16px;
            width: 100%; max-width: 600px;
            max-height: 90vh; overflow-y: auto;
            padding: 28px;
          }
          .ads-form-group { margin-bottom: 18px; }
          .ads-label {
            display: block; font-size: 12px; font-weight: 600;
            color: var(--color-text-secondary); margin-bottom: 6px;
            text-transform: uppercase; letter-spacing: 0.04em;
          }
          .ads-input {
            width: 100%; padding: 9px 12px; border-radius: 8px;
            border: 1px solid var(--color-border);
            background: var(--color-background);
            color: var(--color-text); font-size: 13px;
            box-sizing: border-box;
          }
          .ads-input:focus { outline: 2px solid var(--color-primary); outline-offset: -1px; }
          .ads-radio-row { display: flex; flex-wrap: wrap; gap: 10px; }
          .ads-radio-option {
            display: flex; align-items: center; gap: 6px;
            padding: 7px 14px; border-radius: 8px; cursor: pointer;
            border: 1px solid var(--color-border);
            font-size: 13px; font-weight: 500; color: var(--color-text);
            transition: all 0.15s;
          }
          .ads-radio-option.selected {
            border-color: var(--color-primary);
            background: color-mix(in srgb, var(--color-primary) 10%, transparent);
            color: var(--color-primary);
          }
          .ads-checkbox-row { display: flex; gap: 16px; flex-wrap: wrap; }
          .ads-checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
          .ads-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          @media (max-width: 520px) { .ads-form-grid { grid-template-columns: 1fr; } }
        `}</style>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Ads Management</h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              Manage sponsored ads across the platform
            </p>
          </div>
          <button className="ads-btn ads-btn-primary" onClick={openCreate}>
            <Plus size={16} /> Create Ad
          </button>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div className="ads-stats-grid">
          {STATS_ROW.map((s) => (
            <div
              key={s.label}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                padding: '18px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: `color-mix(in srgb, ${s.color} 12%, transparent)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: s.color, flexShrink: 0,
                }}>
                  {s.icon}
                </div>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500 }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Filter tabs ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 20,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10, padding: 4, width: 'fit-content',
        }}>
          {TYPE_FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setTypeFilter(tab.value)}
              style={{
                padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: typeFilter === tab.value ? 'var(--color-primary)' : 'transparent',
                color: typeFilter === tab.value ? '#fff' : 'var(--color-text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
        }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 14 }}>
              Loading ads…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 14 }}>
              No ads found. <button className="ads-btn ads-btn-primary" style={{ marginLeft: 12 }} onClick={openCreate}>Create one</button>
            </div>
          ) : (
            <div className="ads-table-wrap">
              <table className="ads-table">
                <thead>
                  <tr>
                    <th>Ad Name</th>
                    <th>Advertiser</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th style={{ textAlign: 'right' }}>Impressions</th>
                    <th style={{ textAlign: 'right' }}>Clicks</th>
                    <th style={{ textAlign: 'right' }}>CTR</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ad) => (
                    <tr key={ad.id}>
                      <td style={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ad.name}
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ad.advertiserId}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 99,
                          fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                          background: `color-mix(in srgb, ${TYPE_COLOR[ad.type]} 12%, transparent)`,
                          color: TYPE_COLOR[ad.type],
                        }}>
                          {ad.type}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 99,
                          fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                          background: `color-mix(in srgb, ${STATUS_COLOR[ad.status]} 12%, transparent)`,
                          color: STATUS_COLOR[ad.status],
                        }}>
                          {ad.status}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>
                        {tsToDisplay(ad.schedule?.startDate)}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>
                        {tsToDisplay(ad.schedule?.endDate)}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(ad.stats?.impressions ?? 0)}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(ad.stats?.clicks ?? 0)}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {ctr(ad.stats?.impressions ?? 0, ad.stats?.clicks ?? 0)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                          <button
                            className="ads-btn ads-btn-ghost ads-btn-sm"
                            onClick={() => openEdit(ad)}
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="ads-btn ads-btn-ghost ads-btn-sm"
                            onClick={() => handleToggleStatus(ad)}
                            title={ad.status === 'active' ? 'Pause' : 'Activate'}
                            style={{ color: ad.status === 'active' ? 'var(--color-warning)' : 'var(--color-success)' }}
                          >
                            {ad.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                          </button>
                          <button
                            className="ads-btn ads-btn-sm"
                            style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)', border: 'none' }}
                            onClick={() => setDeleteTarget(ad)}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Create / Edit Modal ──────────────────────────────────────────── */}
        {modalOpen && (
          <div className="ads-modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
            <div className="ads-modal">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                  {editing ? 'Edit Ad' : 'Create Ad'}
                </h2>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}>
                  <X size={20} />
                </button>
              </div>

              {/* Ad Name + Advertiser */}
              <div className="ads-form-grid">
                <div className="ads-form-group">
                  <label className="ads-label">Ad Name *</label>
                  <input
                    className="ads-input"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Summer Sale Banner"
                  />
                </div>
                <div className="ads-form-group">
                  <label className="ads-label">Advertiser Email / Name *</label>
                  <input
                    className="ads-input"
                    value={form.advertiserId}
                    onChange={(e) => setForm((f) => ({ ...f, advertiserId: e.target.value }))}
                    placeholder="advertiser@email.com"
                  />
                </div>
              </div>

              {/* Ad Type */}
              <div className="ads-form-group">
                <label className="ads-label">Ad Type</label>
                <div className="ads-radio-row">
                  {AD_TYPES.map((t) => (
                    <div
                      key={t.value}
                      className={`ads-radio-option${form.type === t.value ? ' selected' : ''}`}
                      onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                    >
                      {t.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Creative */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 18, marginBottom: 18 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                  Creative
                </p>
                <div className="ads-form-group">
                  <label className="ads-label">Image URL</label>
                  <input
                    className="ads-input"
                    value={form.imageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="https://cdn.example.com/ad-image.jpg"
                  />
                </div>
                <div className="ads-form-grid">
                  <div className="ads-form-group">
                    <label className="ads-label">Headline</label>
                    <input
                      className="ads-input"
                      value={form.headline}
                      onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
                      placeholder="Shop Now — Up to 50% Off"
                    />
                  </div>
                  <div className="ads-form-group">
                    <label className="ads-label">CTA URL</label>
                    <input
                      className="ads-input"
                      value={form.ctaUrl}
                      onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))}
                      placeholder="https://tradecircle.app/promo"
                    />
                  </div>
                </div>
              </div>

              {/* Targeting */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 18, marginBottom: 18 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                  Targeting
                </p>
                <div className="ads-form-grid">
                  <div className="ads-form-group">
                    <label className="ads-label">Location Radius (km)</label>
                    <input
                      className="ads-input"
                      type="number"
                      min="1"
                      value={form.locationRadius}
                      onChange={(e) => setForm((f) => ({ ...f, locationRadius: e.target.value }))}
                      placeholder="50"
                    />
                  </div>
                  <div className="ads-form-group">
                    <label className="ads-label">Category</label>
                    <input
                      className="ads-input"
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      placeholder="Electronics"
                    />
                  </div>
                </div>
                <div className="ads-form-group">
                  <label className="ads-label">Target Roles</label>
                  <div className="ads-checkbox-row">
                    {(['buyer', 'seller', 'advisor'] as UserRole[]).map((role) => (
                      <label key={role} className="ads-checkbox-label">
                        <input
                          type="checkbox"
                          checked={form.roles.includes(role)}
                          onChange={() => toggleRole(role)}
                        />
                        <span style={{ textTransform: 'capitalize' }}>{role}</span>
                      </label>
                    ))}
                    <label className="ads-checkbox-label">
                      <input
                        type="checkbox"
                        checked={form.roles.length === 3}
                        onChange={() => setForm((f) => ({
                          ...f,
                          roles: f.roles.length === 3 ? [] : ['buyer', 'seller', 'advisor'],
                        }))}
                      />
                      <span>All</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Schedule + Budget */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 18, marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                  Schedule &amp; Budget
                </p>
                <div className="ads-form-grid">
                  <div className="ads-form-group" style={{ marginBottom: 0 }}>
                    <label className="ads-label">Start Date</label>
                    <input
                      className="ads-input"
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="ads-form-group" style={{ marginBottom: 0 }}>
                    <label className="ads-label">End Date</label>
                    <input
                      className="ads-input"
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="ads-form-group" style={{ marginTop: 16, marginBottom: 0 }}>
                  <label className="ads-label">Budget (AUD) — display only</label>
                  <input
                    className="ads-input"
                    type="number"
                    min="0"
                    value={form.budget}
                    onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                    placeholder="500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="ads-btn ads-btn-ghost" onClick={closeModal}>Cancel</button>
                <button
                  className="ads-btn ads-btn-primary"
                  onClick={handleSave}
                  disabled={saving || !form.name.trim() || !form.advertiserId.trim()}
                  style={{ opacity: (saving || !form.name.trim() || !form.advertiserId.trim()) ? 0.6 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save Ad'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Confirm ───────────────────────────────────────────────── */}
        {deleteTarget && (
          <div className="ads-modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
            <div className="ads-modal" style={{ maxWidth: 420 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Delete Ad</h2>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 24 }}>
                Are you sure you want to delete <strong style={{ color: 'var(--color-text)' }}>{deleteTarget.name}</strong>?
                This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="ads-btn ads-btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button
                  className="ads-btn ads-btn-danger"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{ opacity: deleting ? 0.6 : 1 }}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
