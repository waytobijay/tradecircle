/**
 * app/admin/tenant-branding/page.tsx
 * Admin — Per-tenant white-label branding (Phase 4)
 * Reads/writes tenants/{tenantId}/branding (single-tenant fallback: config/siteConfig.branding)
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  Palette, Type, Globe, Mail, Image as ImageIcon, Save, Check, Loader2,
  ShieldCheck, AlertTriangle,
} from 'lucide-react';
import { db } from '@/services/firebase';
import AdminLayout from '@/components/layouts/AdminLayout';
import ImageUploader from '@/components/ui/ImageUploader';
import type { ProductImage } from '@/types';

// ─── Local types ──────────────────────────────────────────────────────────────

interface TenantBranding {
  // Logo & Identity
  logoUrl: string;
  faviconUrl: string;
  companyName: string;
  tagline: string;
  // Color theme
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    danger: string;
    surface: string;
  };
  // Typography
  fontFamily: string;
  headingWeight: number;
  baseFontSize: number;
  // Custom domain
  customDomain: string;
  domainVerified: boolean;
  // Email branding
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  emailFooter: string;
}

const FONT_FAMILIES = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Poppins', 'system-ui'];

function defaults(): TenantBranding {
  return {
    logoUrl: '',
    faviconUrl: '',
    companyName: 'TradeCircle',
    tagline: 'Buy. Sell. Advise.',
    colors: {
      primary: '#1877F2',
      secondary: '#7C3AED',
      accent: '#16A34A',
      success: '#16A34A',
      danger: '#DC2626',
      surface: '#F9FAFB',
    },
    fontFamily: 'Inter',
    headingWeight: 700,
    baseFontSize: 16,
    customDomain: '',
    domainVerified: false,
    fromName: 'TradeCircle',
    fromEmail: 'noreply@tradecircle.com',
    replyToEmail: 'support@tradecircle.com',
    emailFooter: '© TradeCircle. All rights reserved.',
  };
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', fontSize: 13,
  background: 'var(--color-background)', color: 'var(--color-text)',
  outline: 'none', boxSizing: 'border-box',
};

const sectionStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--color-text-secondary)', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.04em',
};

// ─── Color picker row ─────────────────────────────────────────────────────────

function ColorRow({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text)' }}>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 40, height: 32, padding: 0, border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer' }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, width: 100, fontFamily: 'monospace' }}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TenantBrandingPage() {
  const [branding, setBranding] = useState<TenantBranding>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // For ImageUploader we need ProductImage[] adapters
  const logoImages: ProductImage[] = useMemo(
    () => branding.logoUrl ? [{ url: branding.logoUrl, cloudinaryId: 'logo' }] : [],
    [branding.logoUrl],
  );
  const faviconImages: ProductImage[] = useMemo(
    () => branding.faviconUrl ? [{ url: branding.faviconUrl, cloudinaryId: 'favicon' }] : [],
    [branding.faviconUrl],
  );

  // Load
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'siteConfig'));
        if (snap.exists()) {
          const data = snap.data() as { branding?: Partial<TenantBranding> & { companyName?: string; logoUrl?: string; faviconUrl?: string } };
          const merged = { ...defaults(), ...(data.branding ?? {}) } as TenantBranding;
          // ensure nested colors merged
          merged.colors = { ...defaults().colors, ...(data.branding?.colors ?? {}) };
          setBranding(merged);
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const applyToDocument = useCallback((b: TenantBranding) => {
    if (typeof document === 'undefined') return;
    const r = document.documentElement.style;
    r.setProperty('--color-primary', b.colors.primary);
    r.setProperty('--color-accent', b.colors.accent);
    r.setProperty('--color-success', b.colors.success);
    r.setProperty('--color-danger', b.colors.danger);
    r.setProperty('--color-surface', b.colors.surface);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const ref = doc(db, 'config', 'siteConfig');
      await setDoc(ref, { branding }, { merge: true });
      applyToDocument(branding);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save branding', e);
    } finally {
      setSaving(false);
    }
  }, [branding, applyToDocument]);

  const verifyDomain = useCallback(() => {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
    }, 1500);
  }, []);

  // Cloudinary creds (best-effort — fall back to placeholders)
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';

  if (loading) {
    return (
      <AdminLayout>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <Loader2 size={28} className="spin" />
          <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <style>{`
        .tb-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 1100px) { .tb-grid { grid-template-columns: 1fr 360px; } }
      `}</style>

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>Tenant Branding</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              White-label this marketplace instance.
            </p>
          </div>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 8, border: 'none',
              background: saved ? 'var(--color-success)' : 'var(--color-primary)',
              color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving ? <Loader2 size={16} className="spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
            {saved ? 'Saved' : saving ? 'Saving…' : 'Save Branding'}
          </button>
        </div>

        <div className="tb-grid">
          {/* ───────── LEFT: form columns ───────── */}
          <div>
            {/* Logo & Identity */}
            <div style={sectionStyle}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                <ImageIcon size={16} /> Logo & Identity
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Logo</label>
                  <ImageUploader
                    cloudName={cloudName}
                    uploadPreset={uploadPreset}
                    folder="tenant-branding"
                    maxImages={1}
                    value={logoImages}
                    onChange={(imgs) => setBranding((b) => ({ ...b, logoUrl: imgs[0]?.url ?? '' }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Favicon</label>
                  <ImageUploader
                    cloudName={cloudName}
                    uploadPreset={uploadPreset}
                    folder="tenant-branding"
                    maxImages={1}
                    value={faviconImages}
                    onChange={(imgs) => setBranding((b) => ({ ...b, faviconUrl: imgs[0]?.url ?? '' }))}
                  />
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <label style={labelStyle}>Company Name</label>
                <input style={inputStyle} value={branding.companyName}
                  onChange={(e) => setBranding({ ...branding, companyName: e.target.value })} />
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Tagline</label>
                <input style={inputStyle} value={branding.tagline}
                  onChange={(e) => setBranding({ ...branding, tagline: e.target.value })} />
              </div>
            </div>

            {/* Color Theme */}
            <div style={sectionStyle}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                <Palette size={16} /> Color Theme
              </h3>
              <ColorRow label="Primary" value={branding.colors.primary} onChange={(v) => setBranding({ ...branding, colors: { ...branding.colors, primary: v } })} />
              <ColorRow label="Secondary" value={branding.colors.secondary} onChange={(v) => setBranding({ ...branding, colors: { ...branding.colors, secondary: v } })} />
              <ColorRow label="Accent" value={branding.colors.accent} onChange={(v) => setBranding({ ...branding, colors: { ...branding.colors, accent: v } })} />
              <ColorRow label="Success" value={branding.colors.success} onChange={(v) => setBranding({ ...branding, colors: { ...branding.colors, success: v } })} />
              <ColorRow label="Danger" value={branding.colors.danger} onChange={(v) => setBranding({ ...branding, colors: { ...branding.colors, danger: v } })} />
              <ColorRow label="Surface" value={branding.colors.surface} onChange={(v) => setBranding({ ...branding, colors: { ...branding.colors, surface: v } })} />
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                {Object.values(branding.colors).map((c, i) => (
                  <div key={i} style={{ width: 36, height: 36, borderRadius: 8, background: c, border: '1px solid var(--color-border)' }} />
                ))}
              </div>
            </div>

            {/* Typography */}
            <div style={sectionStyle}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                <Type size={16} /> Typography
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Font Family</label>
                  <select
                    style={inputStyle}
                    value={branding.fontFamily}
                    onChange={(e) => setBranding({ ...branding, fontFamily: e.target.value })}
                  >
                    {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Heading Weight</label>
                  <select
                    style={inputStyle}
                    value={branding.headingWeight}
                    onChange={(e) => setBranding({ ...branding, headingWeight: Number(e.target.value) })}
                  >
                    {[400, 500, 600, 700, 800, 900].map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <label style={labelStyle}>Base Font Size — {branding.baseFontSize}px</label>
                <input
                  type="range" min={14} max={18} step={1}
                  value={branding.baseFontSize}
                  onChange={(e) => setBranding({ ...branding, baseFontSize: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Custom Domain */}
            <div style={sectionStyle}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                <Globe size={16} /> Custom Domain
              </h3>
              <label style={labelStyle}>Domain</label>
              <input
                style={inputStyle}
                placeholder="marketplace.acme.com"
                value={branding.customDomain}
                onChange={(e) => setBranding({ ...branding, customDomain: e.target.value })}
              />
              <div style={{
                marginTop: 14, padding: 14, borderRadius: 8,
                background: 'var(--color-background)', border: '1px dashed var(--color-border)',
                fontFamily: 'monospace', fontSize: 12, color: 'var(--color-text-secondary)',
                whiteSpace: 'pre-line', lineHeight: 1.6,
              }}>
                Add this CNAME record to your DNS:{'\n'}
                Type:  CNAME    Name: marketplace    Value: tradecircle-platform.vercel.app
              </div>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={verifyDomain}
                  disabled={verifying || !branding.customDomain}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-background)',
                    color: 'var(--color-text)', fontSize: 13, fontWeight: 600,
                    cursor: verifying ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {verifying ? <Loader2 size={14} className="spin" /> : <ShieldCheck size={14} />}
                  {verifying ? 'Checking…' : 'Verify Domain'}
                </button>
                <span style={{
                  display: 'inline-block', fontSize: 11, fontWeight: 700,
                  padding: '4px 10px', borderRadius: 20,
                  background: 'color-mix(in srgb, var(--color-warning) 14%, transparent)',
                  color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Pending verification
                </span>
              </div>
            </div>

            {/* Email Branding */}
            <div style={sectionStyle}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                <Mail size={16} /> Email Branding
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>From Name</label>
                  <input style={inputStyle} value={branding.fromName}
                    onChange={(e) => setBranding({ ...branding, fromName: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>From Email</label>
                  <input style={inputStyle} type="email" value={branding.fromEmail}
                    onChange={(e) => setBranding({ ...branding, fromEmail: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Reply-To Email</label>
                  <input style={inputStyle} type="email" value={branding.replyToEmail}
                    onChange={(e) => setBranding({ ...branding, replyToEmail: e.target.value })} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Email Footer Text</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
                  value={branding.emailFooter}
                  onChange={(e) => setBranding({ ...branding, emailFooter: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* ───────── RIGHT: live preview ───────── */}
          <div>
            <div style={{ ...sectionStyle, position: 'sticky', top: 80 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Live Preview
              </h3>
              <div style={{
                borderRadius: 12, overflow: 'hidden',
                border: '1px solid var(--color-border)',
                fontFamily: branding.fontFamily,
                fontSize: branding.baseFontSize,
              }}>
                {/* Mock top bar */}
                <div style={{
                  padding: '12px 14px', background: branding.colors.primary, color: '#fff',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  {branding.logoUrl
                    ? <img src={branding.logoUrl} alt="" style={{ height: 24, width: 'auto', objectFit: 'contain' }} />
                    : <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.25)' }} />}
                  <span style={{ fontWeight: branding.headingWeight, fontSize: 14 }}>{branding.companyName}</span>
                </div>
                {/* Hero */}
                <div style={{ padding: 18, background: branding.colors.surface }}>
                  <h4 style={{ margin: 0, fontWeight: branding.headingWeight, color: '#111', fontSize: branding.baseFontSize + 4 }}>
                    Welcome to {branding.companyName}
                  </h4>
                  <p style={{ margin: '6px 0 14px', fontSize: branding.baseFontSize - 3, color: '#555' }}>
                    {branding.tagline}
                  </p>
                  <button style={{
                    padding: '8px 14px', borderRadius: 6, border: 'none',
                    background: branding.colors.primary, color: '#fff',
                    fontWeight: 600, fontSize: branding.baseFontSize - 3, cursor: 'pointer',
                  }}>
                    Shop now
                  </button>
                  <button style={{
                    marginLeft: 8,
                    padding: '8px 14px', borderRadius: 6, border: 'none',
                    background: branding.colors.accent, color: '#fff',
                    fontWeight: 600, fontSize: branding.baseFontSize - 3, cursor: 'pointer',
                  }}>
                    Browse
                  </button>
                </div>
                {/* Status pills */}
                <div style={{ display: 'flex', gap: 6, padding: 14, background: '#fff' }}>
                  <span style={{ background: branding.colors.success, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 12 }}>Active</span>
                  <span style={{ background: branding.colors.danger, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 12 }}>Alert</span>
                  <span style={{ background: branding.colors.secondary, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 12 }}>New</span>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 12, lineHeight: 1.5 }}>
                <AlertTriangle size={11} style={{ verticalAlign: 'middle' }} /> Changes apply globally on save.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
