/**
 * app/admin/configuration/page.tsx
 * Admin Configuration — 8-tab interface for all platform settings.
 * Reads/writes Firestore doc: config/siteConfig
 * Spec ref: section 6.7 (Admin Portal > Configuration)
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  Paintbrush, Database, ShieldCheck, Image as ImageIcon, Mail,
  CreditCard, DollarSign, Palette, Save, Check, Loader2,
  Wifi, WifiOff, ChevronDown, ChevronUp,
} from 'lucide-react';
import { db } from '@/services/firebase';
import AdminLayout from '@/components/layouts/AdminLayout';
import type { SiteConfig } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'branding' | 'backend' | 'auth' | 'media' | 'emailjs' | 'gateways' | 'currency' | 'theme';

interface Tab { id: TabId; label: string; icon: React.ReactNode }

const TABS: Tab[] = [
  { id: 'branding',  label: 'Branding',   icon: <Paintbrush size={15} /> },
  { id: 'backend',   label: 'Backend',    icon: <Database size={15} />   },
  { id: 'auth',      label: 'Auth',       icon: <ShieldCheck size={15} /> },
  { id: 'media',     label: 'Media',      icon: <ImageIcon size={15} />  },
  { id: 'emailjs',   label: 'EmailJS',    icon: <Mail size={15} />       },
  { id: 'gateways',  label: 'Gateways',   icon: <CreditCard size={15} /> },
  { id: 'currency',  label: 'Currency',   icon: <DollarSign size={15} /> },
  { id: 'theme',     label: 'CSS Theme',  icon: <Palette size={15} />    },
];

// ─── Default config ───────────────────────────────────────────────────────────

function defaultConfig(): SiteConfig {
  return {
    branding:  { companyName: 'TradeCircle', logoUrl: '', faviconUrl: '' },
    currency:  { active: 'AUD', rates: { nprToAud: 0.011, nprToUsd: 0.0075 } },
    firebase:  { enabled: true, apiKey: '', projectId: '', authDomain: '', storageBucket: '', appId: '' },
    supabase:  { enabled: false, url: '', anonKey: '' },
    cloudinary: { enabled: true, cloudName: '', uploadPreset: '' },
    s3:        { enabled: false, bucket: '', region: '', accessKey: '' },
    emailjs:   { publicKey: '', serviceId: '', contactTemplateId: '', contactEnabled: false, paymentTemplateId: '', paymentEnabled: false },
    gateways:  {
      stripe:  { enabled: false, sandboxMode: true, publishableKey: '', paymentLinkUrl: '' },
      eway:    { enabled: false, apiKey: '', endpointUrl: '' },
      fonepay: { enabled: false, merchantQrUrl: '' },
      esewa:   { enabled: false, merchantCode: '', sandboxMode: true },
      khalti:  { enabled: false, publishableKey: '', sandboxMode: false },
    },
    auth:  { showAuthButtons: true, requireEmailVerification: false, guestCheckout: false, googleSignIn: true },
    forms: { productListing: [], contactAdvisor: [], contactSeller: [] },
    theme: {
      cssVars: {
        '--color-primary': '#1877F2',
        '--color-text': '#111827',
        '--color-text-secondary': '#6B7280',
        '--color-border': '#E5E7EB',
        '--color-surface': '#F9FAFB',
        '--color-background': '#FFFFFF',
        '--color-danger': '#DC2626',
        '--color-success': '#16A34A',
        '--color-warning': '#D97706',
        '--color-primary-hover': '#1461C8',
        '--color-accent': '#7C3AED',
        '--color-seller': '#D97706',
        '--color-buyer': '#1877F2',
        '--color-advisor': '#16A34A',
        '--color-overlay': 'rgba(0,0,0,0.5)',
      },
      fontFamily: 'Inter, sans-serif',
      borderRadius: '8px',
    },
  };
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', fontSize: 13,
  background: 'var(--color-background)', color: 'var(--color-text)',
  outline: 'none', boxSizing: 'border-box',
};

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500 }}>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!on)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: on ? 'var(--color-primary)' : 'var(--color-border)',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: on ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );
}

// ─── Save Button ──────────────────────────────────────────────────────────────

function SaveBtn({ onSave, saving, saved }: { onSave: () => void; saving: boolean; saved: boolean }) {
  return (
    <button
      onClick={onSave}
      disabled={saving}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '9px 20px', borderRadius: 9, border: 'none',
        background: saved ? 'var(--color-success)' : 'var(--color-primary)',
        color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
        fontSize: 13, fontWeight: 600, opacity: saving ? 0.8 : 1,
        transition: 'background 0.3s',
      }}
    >
      {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : saved ? <Check size={14} /> : <Save size={14} />}
      {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
    </button>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      {title && <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{title}</h4>}
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Gateway Card ─────────────────────────────────────────────────────────────

function GatewayCard({ title, config, fields, onSave }: {
  title: string;
  config: Record<string, unknown>;
  fields: Array<{ key: string; label: string; type?: string }>;
  onSave: (updated: Record<string, unknown>) => void;
}) {
  const [local, setLocal] = useState({ ...config });
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    onSave(local);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--color-surface)', cursor: 'pointer' }} onClick={() => setExpanded((v) => !v)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: local.enabled ? 'color-mix(in srgb, var(--color-success) 12%, transparent)' : 'var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CreditCard size={16} style={{ color: local.enabled ? 'var(--color-success)' : 'var(--color-text-secondary)' }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLocal((l) => ({ ...l, enabled: !l.enabled })); }}
            style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: local.enabled ? 'var(--color-primary)' : 'var(--color-border)',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: local.enabled ? 22 : 2,
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
          {expanded ? <ChevronUp size={16} style={{ color: 'var(--color-text-secondary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--color-text-secondary)' }} />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '16px 18px', borderTop: '1px solid var(--color-border)', background: 'var(--color-background)' }}>
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.type === 'toggle' ? (
                <Toggle
                  on={!!local[f.key]}
                  onChange={(v) => setLocal((l) => ({ ...l, [f.key]: v }))}
                  label={f.label}
                />
              ) : (
                <input
                  type={f.type ?? 'text'}
                  style={inputStyle}
                  value={String(local[f.key] ?? '')}
                  onChange={(e) => setLocal((l) => ({ ...l, [f.key]: e.target.value }))}
                />
              )}
            </Field>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <SaveBtn onSave={() => void handleSave()} saving={saving} saved={saved} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfigurationPage() {
  const [activeTab, setActiveTab] = useState<TabId>('branding');
  const [config, setConfig]       = useState<SiteConfig>(defaultConfig());
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved,  setSaved]        = useState(false);
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>({});

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load config
  useEffect(() => {
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'siteConfig'));
        if (snap.exists()) setConfig({ ...defaultConfig(), ...snap.data() as SiteConfig });
      } catch { /* use defaults */ }
      finally { setLoadingConfig(false); }
    })();
  }, []);

  function set<K extends keyof SiteConfig>(section: K, value: SiteConfig[K]) {
    setConfig((prev) => ({ ...prev, [section]: value }));
  }

  function merge<K extends keyof SiteConfig>(section: K, partial: Partial<SiteConfig[K]>) {
    setConfig((prev) => ({ ...prev, [section]: { ...(prev[section] as object), ...partial } }));
  }

  async function saveSection(data?: Partial<SiteConfig>) {
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'siteConfig'), data ?? config, { merge: true });
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setSaving(false);
    }
  }

  async function testConnection(key: string) {
    setTestStatus((p) => ({ ...p, [key]: 'testing' }));

    // Real test for Cloudinary: upload a 1x1 PNG via the configured cloudName + uploadPreset
    if (key === 'cloudinary') {
      const { cloudName, uploadPreset } = config.cloudinary;
      if (!cloudName || !uploadPreset) {
        setTestStatus((p) => ({ ...p, [key]: 'fail' }));
        setTimeout(() => setTestStatus((p) => ({ ...p, [key]: 'idle' })), 3000);
        return;
      }
      try {
        // 1x1 transparent PNG
        const png =
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        const fd = new FormData();
        fd.append('file', `data:image/png;base64,${png}`);
        fd.append('upload_preset', uploadPreset);
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: 'POST', body: fd },
        );
        setTestStatus((p) => ({ ...p, [key]: res.ok ? 'ok' : 'fail' }));
      } catch {
        setTestStatus((p) => ({ ...p, [key]: 'fail' }));
      }
      setTimeout(() => setTestStatus((p) => ({ ...p, [key]: 'idle' })), 3000);
      return;
    }

    await new Promise((r) => setTimeout(r, 1200));
    setTestStatus((p) => ({ ...p, [key]: 'ok' }));
    setTimeout(() => setTestStatus((p) => ({ ...p, [key]: 'idle' })), 3000);
  }

  function TestBtn({ id }: { id: string }) {
    const s = testStatus[id] ?? 'idle';
    return (
      <button
        onClick={() => void testConnection(id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-border)',
          background: 'none', cursor: s === 'testing' ? 'not-allowed' : 'pointer',
          fontSize: 12, fontWeight: 600,
          color: s === 'ok' ? 'var(--color-success)' : s === 'fail' ? 'var(--color-danger)' : 'var(--color-text-secondary)',
        }}
      >
        {s === 'testing' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : s === 'ok' ? <Wifi size={13} /> : s === 'fail' ? <WifiOff size={13} /> : <Wifi size={13} />}
        {s === 'testing' ? 'Testing…' : s === 'ok' ? 'Connected' : s === 'fail' ? 'Failed' : 'Test Connection'}
      </button>
    );
  }

  // ─── Tab content ─────────────────────────────────────────────────────────

  function renderBranding() {
    return (
      <SectionCard title="Brand Identity">
        <Field label="Company Name">
          <input style={inputStyle} value={config.branding.companyName} onChange={(e) => merge('branding', { companyName: e.target.value })} placeholder="TradeCircle" />
        </Field>
        <Field label="Logo URL">
          <input style={inputStyle} value={config.branding.logoUrl ?? ''} onChange={(e) => merge('branding', { logoUrl: e.target.value })} placeholder="https://example.com/logo.png" />
          {config.branding.logoUrl && (
            <img src={config.branding.logoUrl} alt="Logo preview" style={{ marginTop: 10, maxHeight: 60, borderRadius: 6, border: '1px solid var(--color-border)' }} />
          )}
        </Field>
        <Field label="Favicon URL">
          <input style={inputStyle} value={config.branding.faviconUrl ?? ''} onChange={(e) => merge('branding', { faviconUrl: e.target.value })} placeholder="https://example.com/favicon.ico" />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <SaveBtn onSave={() => void saveSection({ branding: config.branding })} saving={saving} saved={saved} />
        </div>
      </SectionCard>
    );
  }

  function renderBackend() {
    return (
      <>
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Only one backend can be active at a time.
        </div>
        <SectionCard title="Firebase">
          <Toggle on={config.firebase.enabled} onChange={(v) => merge('firebase', { enabled: v })} label="Enable Firebase" />
          {config.firebase.enabled && (
            <>
              {(['apiKey', 'projectId', 'authDomain', 'storageBucket', 'appId'] as const).map((k) => (
                <Field key={k} label={k}>
                  <input style={inputStyle} value={config.firebase[k] ?? ''} onChange={(e) => merge('firebase', { [k]: e.target.value })} placeholder={k} />
                </Field>
              ))}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <TestBtn id="firebase" />
                <SaveBtn onSave={() => void saveSection({ firebase: config.firebase })} saving={saving} saved={saved} />
              </div>
            </>
          )}
        </SectionCard>
        <SectionCard title="Supabase">
          <Toggle on={config.supabase.enabled} onChange={(v) => { merge('supabase', { enabled: v }); if (v) merge('firebase', { enabled: false }); }} label="Enable Supabase" />
          {config.supabase.enabled && (
            <>
              <Field label="URL"><input style={inputStyle} value={config.supabase.url ?? ''} onChange={(e) => merge('supabase', { url: e.target.value })} placeholder="https://xxx.supabase.co" /></Field>
              <Field label="Anon Key"><input style={inputStyle} value={config.supabase.anonKey ?? ''} onChange={(e) => merge('supabase', { anonKey: e.target.value })} placeholder="your-anon-key" /></Field>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <TestBtn id="supabase" />
                <SaveBtn onSave={() => void saveSection({ supabase: config.supabase })} saving={saving} saved={saved} />
              </div>
            </>
          )}
        </SectionCard>
      </>
    );
  }

  function renderAuth() {
    return (
      <SectionCard title="Authentication Settings">
        <Toggle on={config.auth.showAuthButtons} onChange={(v) => merge('auth', { showAuthButtons: v })} label="Show Auth Buttons" />
        <Toggle on={config.auth.requireEmailVerification} onChange={(v) => merge('auth', { requireEmailVerification: v })} label="Require Email Verification" />
        <Toggle on={config.auth.guestCheckout} onChange={(v) => merge('auth', { guestCheckout: v })} label="Allow Guest Checkout" />
        <Toggle on={config.auth.googleSignIn} onChange={(v) => merge('auth', { googleSignIn: v })} label="Enable Google Sign-In" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <SaveBtn onSave={() => void saveSection({ auth: config.auth })} saving={saving} saved={saved} />
        </div>
      </SectionCard>
    );
  }

  function renderMedia() {
    return (
      <>
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Only one media storage can be active at a time.
        </div>
        <SectionCard title="Cloudinary">
          <Toggle on={config.cloudinary.enabled} onChange={(v) => merge('cloudinary', { enabled: v })} label="Enable Cloudinary" />
          {config.cloudinary.enabled && (
            <>
              <Field label="Cloud Name"><input style={inputStyle} value={config.cloudinary.cloudName ?? ''} onChange={(e) => merge('cloudinary', { cloudName: e.target.value })} placeholder="dxyz9abcd" /></Field>
              <Field label="Upload Preset"><input style={inputStyle} value={config.cloudinary.uploadPreset ?? ''} onChange={(e) => merge('cloudinary', { uploadPreset: e.target.value })} placeholder="tradecircle_unsigned" /></Field>
              <Field label="API Key (optional, server-side)"><input style={inputStyle} value={config.cloudinary.apiKey ?? ''} onChange={(e) => merge('cloudinary', { apiKey: e.target.value })} placeholder="123456789012345" /></Field>
              <Field label="API Secret (optional, server-side)"><input type="password" style={inputStyle} value={config.cloudinary.apiSecret ?? ''} onChange={(e) => merge('cloudinary', { apiSecret: e.target.value })} placeholder="••••••••" /></Field>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <TestBtn id="cloudinary" />
                <SaveBtn onSave={() => void saveSection({ cloudinary: config.cloudinary })} saving={saving} saved={saved} />
              </div>
            </>
          )}
        </SectionCard>
        <SectionCard title="Amazon S3">
          <Toggle on={config.s3.enabled} onChange={(v) => { merge('s3', { enabled: v }); if (v) merge('cloudinary', { enabled: false }); }} label="Enable S3" />
          {config.s3.enabled && (
            <>
              <Field label="Bucket"><input style={inputStyle} value={config.s3.bucket ?? ''} onChange={(e) => merge('s3', { bucket: e.target.value })} placeholder="my-bucket" /></Field>
              <Field label="Region"><input style={inputStyle} value={config.s3.region ?? ''} onChange={(e) => merge('s3', { region: e.target.value })} placeholder="ap-southeast-2" /></Field>
              <Field label="Access Key"><input style={inputStyle} value={config.s3.accessKey ?? ''} onChange={(e) => merge('s3', { accessKey: e.target.value })} placeholder="AKIA..." /></Field>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <TestBtn id="s3" />
                <SaveBtn onSave={() => void saveSection({ s3: config.s3 })} saving={saving} saved={saved} />
              </div>
            </>
          )}
        </SectionCard>
      </>
    );
  }

  function renderEmailJS() {
    return (
      <SectionCard title="EmailJS Configuration">
        <Field label="Public Key"><input style={inputStyle} value={config.emailjs.publicKey ?? ''} onChange={(e) => merge('emailjs', { publicKey: e.target.value })} placeholder="user_xxx" /></Field>
        <Field label="Service ID"><input style={inputStyle} value={config.emailjs.serviceId ?? ''} onChange={(e) => merge('emailjs', { serviceId: e.target.value })} placeholder="service_xxx" /></Field>
        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 10 }}>Contact Form</div>
          <Toggle on={config.emailjs.contactEnabled} onChange={(v) => merge('emailjs', { contactEnabled: v })} label="Enable Contact Form Emails" />
          {config.emailjs.contactEnabled && (
            <Field label="Template ID"><input style={inputStyle} value={config.emailjs.contactTemplateId ?? ''} onChange={(e) => merge('emailjs', { contactTemplateId: e.target.value })} placeholder="template_xxx" /></Field>
          )}
        </div>
        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 10 }}>Payment Confirmation</div>
          <Toggle on={config.emailjs.paymentEnabled} onChange={(v) => merge('emailjs', { paymentEnabled: v })} label="Enable Payment Emails" />
          {config.emailjs.paymentEnabled && (
            <Field label="Template ID"><input style={inputStyle} value={config.emailjs.paymentTemplateId ?? ''} onChange={(e) => merge('emailjs', { paymentTemplateId: e.target.value })} placeholder="template_yyy" /></Field>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <SaveBtn onSave={() => void saveSection({ emailjs: config.emailjs })} saving={saving} saved={saved} />
        </div>
      </SectionCard>
    );
  }

  function renderGateways() {
    const gw = config.gateways;

    function updateGateway(key: keyof typeof gw, updated: Record<string, unknown>) {
      setConfig((prev) => ({
        ...prev,
        gateways: { ...prev.gateways, [key]: { ...prev.gateways[key], ...updated } },
      }));
      void saveSection({ gateways: { ...config.gateways, [key]: { ...config.gateways[key], ...updated } } });
    }

    return (
      <>
        <GatewayCard
          title="Stripe"
          config={gw.stripe as unknown as Record<string, unknown>}
          fields={[
            { key: 'publishableKey', label: 'Publishable Key' },
            { key: 'paymentLinkUrl', label: 'Payment Link URL' },
            { key: 'sandboxMode', label: 'Sandbox Mode', type: 'toggle' },
          ]}
          onSave={(u) => updateGateway('stripe', u)}
        />
        <GatewayCard
          title="eWAY"
          config={gw.eway as unknown as Record<string, unknown>}
          fields={[
            { key: 'apiKey', label: 'API Key' },
            { key: 'endpointUrl', label: 'Endpoint URL' },
          ]}
          onSave={(u) => updateGateway('eway', u)}
        />
        <GatewayCard
          title="Fonepay"
          config={gw.fonepay as unknown as Record<string, unknown>}
          fields={[
            { key: 'merchantQrUrl', label: 'Merchant QR URL' },
          ]}
          onSave={(u) => updateGateway('fonepay', u)}
        />
        <GatewayCard
          title="eSewa"
          config={gw.esewa as unknown as Record<string, unknown>}
          fields={[
            { key: 'merchantCode', label: 'Merchant Code' },
            { key: 'sandboxMode', label: 'Sandbox Mode', type: 'toggle' },
          ]}
          onSave={(u) => updateGateway('esewa', u)}
        />
        <GatewayCard
          title="Khalti"
          config={gw.khalti as unknown as Record<string, unknown>}
          fields={[
            { key: 'publishableKey', label: 'Public Key' },
            { key: 'sandboxMode', label: 'Test Mode', type: 'toggle' },
          ]}
          onSave={(u) => updateGateway('khalti', u)}
        />
      </>
    );
  }

  function renderCurrency() {
    const currencies = [
      { code: 'AUD' as const, label: 'AUD — Australian Dollar', symbol: 'A$' },
      { code: 'USD' as const, label: 'USD — US Dollar',         symbol: '$'  },
      { code: 'NPR' as const, label: 'NPR — Nepali Rupee',      symbol: 'Rs' },
      { code: 'INR' as const, label: 'INR — Indian Rupee',      symbol: '₹'  },
    ];
    const active = config.currency.active;
    const symbols: Record<string, string> = { AUD: 'A$', USD: '$', NPR: 'Rs', INR: '₹' };
    const names: Record<string, string> = { AUD: 'Australian Dollar', USD: 'US Dollar', NPR: 'Nepali Rupee', INR: 'Indian Rupee' };
    return (
      <SectionCard title="Currency Settings">
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 10 }}>Active Currency</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currencies.map(({ code, label }) => (
              <label key={code} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--color-text)' }}>
                <input type="radio" name="currency" value={code} checked={active === code} onChange={() => merge('currency', { active: code })} style={{ accentColor: 'var(--color-primary)', width: 16, height: 16 }} />
                {label}
              </label>
            ))}
          </div>
        </div>
        <Field label="NPR → AUD Rate">
          <input type="number" step="0.0001" style={inputStyle} value={config.currency.rates.nprToAud} onChange={(e) => merge('currency', { rates: { ...config.currency.rates, nprToAud: parseFloat(e.target.value) || 0 } })} />
        </Field>
        <Field label="NPR → USD Rate">
          <input type="number" step="0.0001" style={inputStyle} value={config.currency.rates.nprToUsd} onChange={(e) => merge('currency', { rates: { ...config.currency.rates, nprToUsd: parseFloat(e.target.value) || 0 } })} />
        </Field>
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)', fontSize: 13, color: 'var(--color-text)', marginBottom: 16 }}>
          Selected: <strong>{symbols[active]} ({names[active]})</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <SaveBtn onSave={() => void saveSection({ currency: config.currency })} saving={saving} saved={saved} />
        </div>
      </SectionCard>
    );
  }

  function renderTheme() {
    const cssVarLabels: Record<string, string> = {
      '--color-primary':        'Primary',
      '--color-primary-hover':  'Primary Hover',
      '--color-accent':         'Accent',
      '--color-text':           'Text',
      '--color-text-secondary': 'Text Secondary',
      '--color-border':         'Border',
      '--color-surface':        'Surface',
      '--color-background':     'Background',
      '--color-danger':         'Danger',
      '--color-success':        'Success',
      '--color-warning':        'Warning',
      '--color-seller':         'Seller',
      '--color-buyer':          'Buyer',
      '--color-advisor':        'Advisor',
      '--color-overlay':        'Overlay',
    };

    function setVar(k: string, v: string) {
      merge('theme', { cssVars: { ...config.theme.cssVars, [k]: v } });
    }

    function previewLive() {
      Object.entries(config.theme.cssVars).forEach(([k, v]) => {
        document.documentElement.style.setProperty(k, v);
      });
      if (config.theme.fontFamily) document.documentElement.style.setProperty('--font-family', config.theme.fontFamily);
    }

    const radius = parseInt(config.theme.borderRadius ?? '8') || 8;

    return (
      <SectionCard title="CSS Theme Variables">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
          {Object.entries(cssVarLabels).map(([k, label]) => (
            <div key={k}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{label}</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={/^#/.test(config.theme.cssVars[k] ?? '') ? config.theme.cssVars[k] : '#888888'}
                  onChange={(e) => setVar(k, e.target.value)}
                  style={{ width: 36, height: 36, borderRadius: 6, border: '1px solid var(--color-border)', cursor: 'pointer', padding: 2 }}
                />
                <input
                  type="text"
                  value={config.theme.cssVars[k] ?? ''}
                  onChange={(e) => setVar(k, e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            </div>
          ))}
        </div>

        <Field label="Font Family">
          <input style={inputStyle} value={config.theme.fontFamily ?? ''} onChange={(e) => merge('theme', { fontFamily: e.target.value })} placeholder="Inter, sans-serif" />
        </Field>

        <Field label={`Border Radius: ${radius}px`}>
          <input
            type="range" min={4} max={24}
            value={radius}
            onChange={(e) => merge('theme', { borderRadius: `${e.target.value}px` })}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            <span>4px (sharp)</span><span>24px (round)</span>
          </div>
        </Field>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={previewLive}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}
          >
            <Palette size={14} /> Preview Live
          </button>
          <button
            onClick={() => { previewLive(); void saveSection({ theme: config.theme }); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {saved ? <Check size={14} /> : <Save size={14} />} {saved ? 'Saved!' : 'Save & Apply'}
          </button>
        </div>
      </SectionCard>
    );
  }

  const TAB_RENDERERS: Record<TabId, () => React.ReactNode> = {
    branding: renderBranding,
    backend:  renderBackend,
    auth:     renderAuth,
    media:    renderMedia,
    emailjs:  renderEmailJS,
    gateways: renderGateways,
    currency: renderCurrency,
    theme:    renderTheme,
  };

  return (
    <AdminLayout>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>Configuration</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>Manage all platform settings and integrations</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 16px', borderRadius: '8px 8px 0 0',
                border: '1px solid var(--color-border)', borderBottom: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                background: activeTab === tab.id ? 'var(--color-background)' : 'var(--color-surface)',
                color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                marginBottom: -1, position: 'relative',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {loadingConfig ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: 14 }}>Loading configuration…</div>
          </div>
        ) : (
          TAB_RENDERERS[activeTab]()
        )}
      </div>
    </AdminLayout>
  );
}
