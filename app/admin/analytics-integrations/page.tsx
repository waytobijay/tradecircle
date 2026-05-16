/**
 * app/admin/analytics-integrations/page.tsx
 * Admin page for configuring GA4 and Facebook Pixel tracking.
 *
 * - GA4 section: Measurement ID input (G-XXXXXXXXXX), Verify button, enable toggle
 * - Facebook Pixel section: Pixel ID input, enable toggle, Events Manager link
 * - Save: writes analytics field to config/siteConfig in Firestore
 * - Live preview: tracking status badge
 */

'use client';

import { useEffect, useState }             from 'react';
import { doc, getDoc, setDoc }             from 'firebase/firestore';
import {
  TrendingUp,
  ExternalLink,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ToggleLeft,
  ToggleRight,
}                                          from 'lucide-react';
import { db }                              from '@/services/firebase';
import AdminLayout                         from '@/components/layouts/AdminLayout';
import type { AnalyticsConfig }            from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GA4_PATTERN    = /^G-[A-Z0-9]{4,}$/;
const PIXEL_PATTERN  = /^\d{10,20}$/;

function isGA4Valid(id: string)   { return !id || GA4_PATTERN.test(id); }
function isPixelValid(id: string) { return !id || PIXEL_PATTERN.test(id); }

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background:   'var(--color-surface)',
        border:       '1px solid var(--color-border)',
        borderRadius: 12,
        padding:      '24px',
        marginBottom: '20px',
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin:     '0 0 16px',
        fontSize:   16,
        fontWeight: 700,
        color:      'var(--color-text)',
        display:    'flex',
        alignItems: 'center',
        gap:        8,
      }}
    >
      {children}
    </h2>
  );
}

function InputRow({
  label,
  value,
  onChange,
  placeholder,
  error,
  hint,
}: {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  placeholder: string;
  error?:      string;
  hint?:       string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width:        '100%',
          padding:      '9px 12px',
          border:       `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
          borderRadius: 8,
          fontSize:     14,
          color:        'var(--color-text)',
          background:   'var(--color-background)',
          outline:      'none',
          boxSizing:    'border-box',
        }}
      />
      {error && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-danger)' }}>{error}</p>
      )}
      {hint && !error && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>{hint}</p>
      )}
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      style={{
        background: 'none',
        border:     'none',
        cursor:     'pointer',
        display:    'flex',
        alignItems: 'center',
        gap:        8,
        padding:    0,
        fontSize:   13,
        color:      enabled ? 'var(--color-success, #10b981)' : 'var(--color-text-secondary)',
        fontWeight: 600,
      }}
    >
      {enabled
        ? <ToggleRight size={24} color="var(--color-success, #10b981)" />
        : <ToggleLeft  size={24} color="var(--color-text-secondary)"   />
      }
      {enabled ? 'Enabled' : 'Disabled'}
    </button>
  );
}

function StatusBadge({ configured, enabled }: { configured: boolean; enabled: boolean }) {
  const active = configured && enabled;
  return (
    <span
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          6,
        padding:      '4px 12px',
        borderRadius: 999,
        background:   active
          ? 'color-mix(in srgb, #10b981 14%, transparent)'
          : 'color-mix(in srgb, #f59e0b 14%, transparent)',
        color:        active ? '#10b981' : '#f59e0b',
        fontSize:     12,
        fontWeight:   700,
      }}
    >
      {active ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
      {active ? 'Tracking active' : 'Not configured'}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsIntegrationsPage() {
  const [ga4Id,        setGa4Id]        = useState('');
  const [ga4Enabled,   setGa4Enabled]   = useState(false);
  const [pixelId,      setPixelId]      = useState('');
  const [pixelEnabled, setPixelEnabled] = useState(false);
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [saveStatus,   setSaveStatus]   = useState<SaveStatus>('idle');

  // Validation
  const ga4Error    = ga4Id    && !isGA4Valid(ga4Id)    ? 'Must match format: G-XXXXXXXXXX' : undefined;
  const pixelError  = pixelId  && !isPixelValid(pixelId) ? 'Must be a 10–20 digit numeric ID' : undefined;
  const canSave     = !ga4Error && !pixelError;

  // Load from Firestore on mount
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'config', 'siteConfig'));
        if (snap.exists()) {
          const analytics = snap.data()?.analytics as Partial<AnalyticsConfig> | undefined;
          setGa4Id(analytics?.ga4MeasurementId ?? '');
          setPixelId(analytics?.facebookPixelId ?? '');
          setGa4Enabled(!!analytics?.ga4MeasurementId && !!analytics?.enabled);
          setPixelEnabled(!!analytics?.facebookPixelId && !!analytics?.enabled);
          setGlobalEnabled(analytics?.enabled ?? false);
        }
      } catch (err) {
        console.error('[AnalyticsIntegrations] load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!canSave) return;
    setSaveStatus('saving');
    try {
      const analytics: AnalyticsConfig = {
        enabled:           globalEnabled,
        ga4MeasurementId:  ga4Id.trim()   || undefined,
        facebookPixelId:   pixelId.trim() || undefined,
      };

      await setDoc(
        doc(db, 'config', 'siteConfig'),
        { analytics },
        { merge: true },
      );
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('[AnalyticsIntegrations] save error:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <TrendingUp size={22} style={{ color: 'var(--color-primary)' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--color-text)' }}>
              Analytics Integrations
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Connect Google Analytics 4 and Facebook Pixel to track visitor behaviour and conversions.
            </p>
          </div>
        </div>

        {/* Global enable toggle */}
        <SectionCard>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>
                Analytics tracking
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Master switch — disabling this stops all tracking regardless of individual settings.
              </p>
            </div>
            <Toggle enabled={globalEnabled} onChange={setGlobalEnabled} />
          </div>
        </SectionCard>

        {/* GA4 section */}
        <SectionCard>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <SectionTitle>
              Google Analytics 4
            </SectionTitle>
            <StatusBadge configured={!!ga4Id && isGA4Valid(ga4Id)} enabled={ga4Enabled && globalEnabled} />
          </div>

          <InputRow
            label="Measurement ID"
            value={ga4Id}
            onChange={setGa4Id}
            placeholder="G-XXXXXXXXXX"
            error={ga4Error}
            hint="Find this in GA4 Admin › Data Streams › your stream"
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <Toggle enabled={ga4Enabled} onChange={setGa4Enabled} />
            <a
              href={
                ga4Id && isGA4Valid(ga4Id)
                  ? `https://analytics.google.com/analytics/web/#/p${ga4Id.replace('G-', '')}/reports/home`
                  : 'https://analytics.google.com/'
              }
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:        'inline-flex',
                alignItems:     'center',
                gap:            6,
                fontSize:       13,
                fontWeight:     600,
                color:          'var(--color-primary)',
                textDecoration: 'none',
              }}
            >
              Open GA4 Dashboard <ExternalLink size={13} />
            </a>
          </div>
        </SectionCard>

        {/* Facebook Pixel section */}
        <SectionCard>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <SectionTitle>
              Facebook Pixel
            </SectionTitle>
            <StatusBadge configured={!!pixelId && isPixelValid(pixelId)} enabled={pixelEnabled && globalEnabled} />
          </div>

          <InputRow
            label="Pixel ID"
            value={pixelId}
            onChange={setPixelId}
            placeholder="123456789012345"
            error={pixelError}
            hint="Find this in Meta Business Suite › Events Manager"
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <Toggle enabled={pixelEnabled} onChange={setPixelEnabled} />
            <a
              href="https://business.facebook.com/events_manager"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:        'inline-flex',
                alignItems:     'center',
                gap:            6,
                fontSize:       13,
                fontWeight:     600,
                color:          'var(--color-primary)',
                textDecoration: 'none',
              }}
            >
              Open Events Manager <ExternalLink size={13} />
            </a>
          </div>
        </SectionCard>

        {/* Save button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleSave}
            disabled={!canSave || saveStatus === 'saving'}
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          8,
              padding:      '10px 24px',
              background:   canSave ? 'var(--color-primary)' : 'var(--color-border)',
              color:        canSave ? '#fff' : 'var(--color-text-secondary)',
              border:       'none',
              borderRadius: 8,
              fontSize:     14,
              fontWeight:   700,
              cursor:       canSave && saveStatus !== 'saving' ? 'pointer' : 'not-allowed',
              opacity:      saveStatus === 'saving' ? 0.8 : 1,
              transition:   'background 0.15s, opacity 0.15s',
            }}
          >
            {saveStatus === 'saving'
              ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
              : <Save size={15} />
            }
            {saveStatus === 'saving' ? 'Saving…' : 'Save Changes'}
          </button>

          {saveStatus === 'saved' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-success, #10b981)', fontWeight: 600 }}>
              <CheckCircle2 size={15} /> Saved successfully
            </span>
          )}
          {saveStatus === 'error' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-danger)', fontWeight: 600 }}>
              <AlertCircle size={15} /> Save failed — try again
            </span>
          )}
        </div>

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AdminLayout>
  );
}
