/**
 * app/admin/geo-ads/page.tsx
 * Admin — Location-Based Geo-Targeted Ads (Phase 4)
 * Spec ref: section 13.14 (Phase 4 — Location-based ad geo-targeting)
 */

'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import { MapPin, Plus, X, Sliders, Target } from 'lucide-react';
import { db } from '@/services/firebase';
import AdminLayout from '@/components/layouts/AdminLayout';
import type { Ad, UserRole } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeoAdForm {
  name: string;
  headline: string;
  ctaUrl: string;
  imageUrl: string;
  radiusKm: number;
  category: string;
  roles: UserRole[];
}

const EMPTY_FORM: GeoAdForm = {
  name: '',
  headline: '',
  ctaUrl: '',
  imageUrl: '',
  radiusKm: 25,
  category: '',
  roles: [],
};

const CATEGORIES = [
  'Electronics', 'Clothing', 'Food & Beverage', 'Agriculture',
  'Real Estate', 'Vehicles', 'Health & Beauty', 'Services', 'Other',
];

const ALL_ROLES: { value: UserRole; label: string }[] = [
  { value: 'buyer',   label: 'Buyer'   },
  { value: 'seller',  label: 'Seller'  },
  { value: 'advisor', label: 'Advisor' },
];

// ─── Map Placeholder ──────────────────────────────────────────────────────────

function MapPlaceholder() {
  return (
    <div style={{
      position: 'relative',
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid var(--color-border)',
      height: 260,
      backgroundImage: `
        linear-gradient(var(--color-border) 1px, transparent 1px),
        linear-gradient(90deg, var(--color-border) 1px, transparent 1px)
      `,
      backgroundSize: '40px 40px',
      backgroundColor: 'color-mix(in srgb, var(--color-surface) 80%, var(--color-background))',
    }}>
      {/* Simulated roads */}
      <div style={{
        position: 'absolute', top: '40%', left: 0, right: 0,
        height: 4, background: 'color-mix(in srgb, var(--color-border) 80%, transparent)',
        borderRadius: 2,
      }} />
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '30%',
        width: 4, background: 'color-mix(in srgb, var(--color-border) 80%, transparent)',
        borderRadius: 2,
      }} />
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '65%',
        width: 4, background: 'color-mix(in srgb, var(--color-border) 80%, transparent)',
        borderRadius: 2,
      }} />

      {/* Radius circle indicator */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 120, height: 120, borderRadius: '50%',
        border: '2px dashed color-mix(in srgb, var(--color-primary) 40%, transparent)',
        background: 'color-mix(in srgb, var(--color-primary) 6%, transparent)',
      }} />

      {/* Pin marker */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -100%)',
      }}>
        <MapPin size={28} style={{ color: 'var(--color-primary)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
      </div>

      {/* Overlay notice */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'color-mix(in srgb, var(--color-background) 90%, transparent)',
        backdropFilter: 'blur(4px)',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
        borderTop: '1px solid var(--color-border)',
      }}>
        <MapPin size={14} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Map preview requires Google Maps API key — configure in Admin › Configuration
        </span>
      </div>
    </div>
  );
}

// ─── Geo Ad Row ───────────────────────────────────────────────────────────────

function GeoAdRow({ ad }: { ad: Ad }) {
  const radius = ad.targeting.locationRadius ?? 0;
  const category = ad.targeting.category ?? '—';
  const roles = ad.targeting.roles.join(', ') || '—';

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 10, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      {/* Name + headline */}
      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {ad.name}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {ad.creative.headline}
        </p>
      </div>

      {/* Radius badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <Target size={13} style={{ color: 'var(--color-primary)' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)' }}>
          {radius} km
        </span>
      </div>

      {/* Category */}
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
        background: 'color-mix(in srgb, var(--color-border) 60%, transparent)',
        color: 'var(--color-text-secondary)', flexShrink: 0,
      }}>
        {category}
      </span>

      {/* Roles */}
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', flexShrink: 0 }}>
        {roles}
      </span>

      {/* Status dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, marginLeft: 'auto' }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: ad.status === 'active' ? 'var(--color-success)' : 'var(--color-border)',
          display: 'inline-block',
        }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: ad.status === 'active' ? 'var(--color-success)' : 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
          {ad.status}
        </span>
      </div>
    </div>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: (form: GeoAdForm) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState<GeoAdForm>(EMPTY_FORM);

  function setField<K extends keyof GeoAdForm>(key: K, value: GeoAdForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleRole(role: UserRole) {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  }

  const isValid = form.name.trim() && form.headline.trim() && form.ctaUrl.trim();

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-background)',
    color: 'var(--color-text)', fontSize: 13,
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--color-text-secondary)', marginBottom: 5,
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 700,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
        }}
      />

      {/* Dialog */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 701,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 16, padding: '24px 28px',
          width: '100%', maxWidth: 520,
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
              Create Geo Ad
            </h3>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-text-secondary)' }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Ad Name */}
            <div>
              <label style={labelStyle}>Ad Name *</label>
              <input
                style={inputStyle}
                placeholder="e.g. Summer Sale Sydney"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
              />
            </div>

            {/* Headline */}
            <div>
              <label style={labelStyle}>Headline *</label>
              <input
                style={inputStyle}
                placeholder="e.g. Up to 40% off electronics near you"
                value={form.headline}
                onChange={(e) => setField('headline', e.target.value)}
              />
            </div>

            {/* CTA URL */}
            <div>
              <label style={labelStyle}>CTA URL *</label>
              <input
                style={inputStyle}
                type="url"
                placeholder="https://..."
                value={form.ctaUrl}
                onChange={(e) => setField('ctaUrl', e.target.value)}
              />
            </div>

            {/* Image URL */}
            <div>
              <label style={labelStyle}>Image URL</label>
              <input
                style={inputStyle}
                type="url"
                placeholder="https://res.cloudinary.com/..."
                value={form.imageUrl}
                onChange={(e) => setField('imageUrl', e.target.value)}
              />
            </div>

            {/* Radius slider */}
            <div>
              <label style={labelStyle}>
                <Sliders size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Target Radius: <strong>{form.radiusKm} km</strong>
              </label>
              <input
                type="range"
                min={1}
                max={100}
                value={form.radiusKm}
                onChange={(e) => setField('radiusKm', Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                <span>1 km</span>
                <span>100 km</span>
              </div>
            </div>

            {/* Category */}
            <div>
              <label style={labelStyle}>Category</label>
              <select
                style={{ ...inputStyle, appearance: 'none' }}
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Target Roles */}
            <div>
              <label style={labelStyle}>Target Roles</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {ALL_ROLES.map(({ value, label }) => {
                  const checked = form.roles.includes(value);
                  return (
                    <label
                      key={value}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        cursor: 'pointer', userSelect: 'none',
                        padding: '6px 12px', borderRadius: 8,
                        border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: checked
                          ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                          : 'transparent',
                        fontSize: 13, fontWeight: checked ? 600 : 400,
                        color: checked ? 'var(--color-primary)' : 'var(--color-text)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRole(value)}
                        style={{ display: 'none' }}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--color-border)' }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 20px', borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'transparent', color: 'var(--color-text)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => void onSave(form)}
              disabled={!isValid || saving}
              style={{
                padding: '9px 20px', borderRadius: 8,
                border: 'none',
                background: isValid && !saving ? 'var(--color-primary)' : 'var(--color-border)',
                color: isValid && !saving ? '#fff' : 'var(--color-text-secondary)',
                fontSize: 13, fontWeight: 600,
                cursor: isValid && !saving ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s',
              }}
            >
              {saving ? 'Saving…' : 'Create Geo Ad'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GeoAdsPage() {
  const [ads, setAds]           = useState<Ad[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  useEffect(() => {
    const q = query(
      collection(db, 'ads'),
      where('type', '==', 'location'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setAds(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ad)));
        setLoading(false);
      },
      () => setLoading(false),
    );

    return unsub;
  }, []);

  async function handleSave(form: GeoAdForm) {
    setSaving(true);
    try {
      await addDoc(collection(db, 'ads'), {
        advertiserId: 'admin',
        name: form.name,
        type: 'location',
        creative: {
          imageUrl: form.imageUrl,
          headline: form.headline,
          ctaUrl: form.ctaUrl,
        },
        targeting: {
          locationRadius: form.radiusKm,
          category: form.category || null,
          roles: form.roles.length > 0 ? form.roles : ['buyer', 'seller', 'advisor'],
        },
        schedule: {
          startDate: serverTimestamp(),
          endDate: null,
        },
        stats: { impressions: 0, clicks: 0 },
        status: 'active',
        createdAt: serverTimestamp(),
      });
      setShowModal(false);
      showToast('Geo ad created successfully');
    } catch (err) {
      console.error(err);
      showToast('Failed to create ad — please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0%,100% { opacity:1 } 50% { opacity:0.45 } }
      `}</style>

      <div style={{ padding: 24 }}>

        {/* Header ─────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
                Geo-Targeted Ads
              </h2>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: 'color-mix(in srgb, var(--color-warning) 14%, transparent)',
                color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                Phase 4
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Deliver location-targeted ads to users within a configurable radius
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={15} />
            Create Geo Ad
          </button>
        </div>

        {/* Map placeholder ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Coverage Map
          </p>
          <MapPlaceholder />
        </div>

        {/* Ad List ─────────────────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Location Ads
            </p>
            {!loading && (
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {ads.length} ad{ads.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{
                  height: 64, borderRadius: 10,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  animation: 'shimmer 1.4s ease-in-out infinite',
                }} />
              ))}
            </div>
          ) : ads.length === 0 ? (
            <div style={{
              padding: '40px 20px', textAlign: 'center',
              border: '1.5px dashed var(--color-border)', borderRadius: 12,
              background: 'var(--color-surface)',
            }}>
              <MapPin size={32} style={{ color: 'var(--color-border)', marginBottom: 12 }} />
              <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                No geo-targeted ads yet
              </p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Click "Create Geo Ad" to target users within a specific radius.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ads.map((ad) => (
                <GeoAdRow key={ad.id} ad={ad} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal ─────────────────────────────────────────────────────── */}
      {showModal && (
        <CreateModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* Toast ───────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 800,
          background: 'var(--color-text)', color: 'var(--color-background)',
          padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', animation: 'slideUp 0.2s ease',
        }}>
          {toast}
        </div>
      )}
    </AdminLayout>
  );
}
