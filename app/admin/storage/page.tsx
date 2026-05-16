/**
 * app/admin/storage/page.tsx
 * Admin Storage Configuration — manage Cloudinary, Amazon S3, and Supabase.
 * Reads/writes Firestore doc: config/siteConfig
 * Spec ref: section 9.2 — Storage & Backend configuration
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, setDoc }              from 'firebase/firestore';
import {
  Cloud, HardDrive, Database as DatabaseIcon,
  CheckCircle2, XCircle, Loader2, Save, BadgeCheck,
} from 'lucide-react';
import { db }                             from '@/services/firebase';
import AdminLayout                         from '@/components/layouts/AdminLayout';
import {
  isSupabaseConfigured,
  testSupabaseConnection,
} from '@/services/supabase';
import type { SiteConfig, CloudinaryConfig, S3Config, SupabaseConfig } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type TestStatus = 'idle' | 'testing' | 'ok' | 'error';

interface TestResult {
  status: TestStatus;
  message?: string;
}

// ─── Default config slices ────────────────────────────────────────────────────

const DEFAULT_CLOUDINARY: CloudinaryConfig = { enabled: false, cloudName: '', uploadPreset: '' };
const DEFAULT_S3:         S3Config         = { enabled: false, bucket: '', region: '', accessKey: '' };
const DEFAULT_SUPABASE:   SupabaseConfig   = { enabled: false, url: '', anonKey: '' };

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      padding: 24,
      flex: 1,
      minWidth: 0,
      ...style,
    }}>
      {children}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = 'text', masked,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  masked?: boolean;
}) {
  const [reveal, setReveal] = useState(false);
  const inputType = masked ? (reveal ? 'text' : 'password') : type;

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', marginBottom: 5,
        fontSize: 13, fontWeight: 500, color: 'var(--color-text)',
      }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-background)',
            color: 'var(--color-text)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        {masked && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            style={{
              padding: '6px 10px', borderRadius: 8, fontSize: 12,
              border: '1px solid var(--color-border)',
              background: 'var(--color-background)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            {reveal ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
    </div>
  );
}

function ActiveBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
      color: 'var(--color-success)',
      fontSize: 11, fontWeight: 600, padding: '2px 8px',
      borderRadius: 20, border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)',
    }}>
      <BadgeCheck size={12} /> Active
    </span>
  );
}

function TestResultBadge({ result }: { result: TestResult }) {
  if (result.status === 'idle') return null;
  if (result.status === 'testing') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--color-text-secondary)' }}>
        <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Testing…
      </span>
    );
  }
  if (result.status === 'ok') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--color-success)' }}>
        <CheckCircle2 size={13} /> Connected
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--color-danger)' }}>
      <XCircle size={13} /> {result.message ?? 'Failed'}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StoragePage() {
  const [cloudinary, setCloudinary]   = useState<CloudinaryConfig>(DEFAULT_CLOUDINARY);
  const [s3,         setS3]           = useState<S3Config>(DEFAULT_S3);
  const [supabase,   setSupabase]     = useState<SupabaseConfig>(DEFAULT_SUPABASE);

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState('');

  const [cdnTest,    setCdnTest]    = useState<TestResult>({ status: 'idle' });
  const [s3Test,     setS3Test]     = useState<TestResult>({ status: 'idle' });
  const [supTest,    setSupTest]    = useState<TestResult>({ status: 'idle' });

  // ── Load current siteConfig ────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'siteConfig'));
        if (snap.exists()) {
          const data = snap.data() as Partial<SiteConfig>;
          if (data.cloudinary) setCloudinary({ ...DEFAULT_CLOUDINARY, ...data.cloudinary });
          if (data.s3)         setS3({ ...DEFAULT_S3, ...data.s3 });
          if (data.supabase)   setSupabase({ ...DEFAULT_SUPABASE, ...data.supabase });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Save all three sections ────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      await setDoc(
        doc(db, 'config', 'siteConfig'),
        { cloudinary, s3, supabase },
        { merge: true },
      );
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [cloudinary, s3, supabase]);

  // ── Set Cloudinary as active storage ──────────────────────────────────────
  const setCloudinaryActive = useCallback(async () => {
    const next = { ...cloudinary, enabled: true };
    const nextS3 = { ...s3, enabled: false };
    setCloudinary(next);
    setS3(nextS3);
    await setDoc(doc(db, 'config', 'siteConfig'), { cloudinary: next, s3: nextS3 }, { merge: true });
  }, [cloudinary, s3]);

  // ── Set S3 as active storage ───────────────────────────────────────────────
  const setS3Active = useCallback(async () => {
    const next = { ...s3, enabled: true };
    const nextCdn = { ...cloudinary, enabled: false };
    setS3(next);
    setCloudinary(nextCdn);
    await setDoc(doc(db, 'config', 'siteConfig'), { s3: next, cloudinary: nextCdn }, { merge: true });
  }, [s3, cloudinary]);

  // ── Set Supabase as active database ───────────────────────────────────────
  const setSupabaseActive = useCallback(async () => {
    const next = { ...supabase, enabled: true };
    setSupabase(next);
    await setDoc(doc(db, 'config', 'siteConfig'), { supabase: next }, { merge: true });
  }, [supabase]);

  // ── Test Cloudinary ────────────────────────────────────────────────────────
  const testCloudinary = useCallback(async () => {
    setCdnTest({ status: 'testing' });
    try {
      if (!cloudinary.cloudName) throw new Error('Cloud Name is empty');
      const res = await fetch(
        `https://res.cloudinary.com/${cloudinary.cloudName}/image/upload/sample`,
        { method: 'HEAD' },
      );
      if (res.ok || res.status === 404) {
        setCdnTest({ status: 'ok' });
      } else {
        setCdnTest({ status: 'error', message: `HTTP ${res.status}` });
      }
    } catch (err) {
      setCdnTest({ status: 'error', message: err instanceof Error ? err.message : 'Failed' });
    }
  }, [cloudinary.cloudName]);

  // ── Test S3 ────────────────────────────────────────────────────────────────
  const testS3 = useCallback(async () => {
    setS3Test({ status: 'testing' });
    try {
      if (!s3.bucket || !s3.region) throw new Error('Bucket and Region are required');
      const url = `https://${s3.bucket}.s3.${s3.region}.amazonaws.com/`;
      const res = await fetch(url, { method: 'HEAD' });
      // 403 means bucket exists but we don't have list access — still a valid connection
      if (res.ok || res.status === 403 || res.status === 301) {
        setS3Test({ status: 'ok' });
      } else {
        setS3Test({ status: 'error', message: `HTTP ${res.status}` });
      }
    } catch (err) {
      setS3Test({ status: 'error', message: err instanceof Error ? err.message : 'Failed' });
    }
  }, [s3.bucket, s3.region]);

  // ── Test Supabase ──────────────────────────────────────────────────────────
  const testSupabase = useCallback(async () => {
    setSupTest({ status: 'testing' });
    if (!supabase.url || !supabase.anonKey) {
      setSupTest({ status: 'error', message: 'URL and Anon Key are required' });
      return;
    }
    const result = await testSupabaseConnection(supabase.url, supabase.anonKey);
    setSupTest(result.ok ? { status: 'ok' } : { status: 'error', message: result.error });
  }, [supabase.url, supabase.anonKey]);

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AdminLayout>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input:focus { border-color: var(--color-primary) !important; box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 15%, transparent); }
      `}</style>

      <div style={{ padding: '28px 24px', maxWidth: 1100 }}>
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
              Storage & Backend
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Configure file storage and database providers. Only one storage provider is active at a time.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {saveMsg && (
              <span style={{ fontSize: 13, color: saveMsg === 'Saved' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {saveMsg}
              </span>
            )}
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 8,
                background: 'var(--color-primary)', color: '#fff',
                border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1,
              }}
            >
              {saving
                ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                : <Save size={15} />}
              Save All
            </button>
          </div>
        </div>

        {/* ── Storage providers (side by side) ─────────────────────────────── */}
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          File Storage
        </h3>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 28 }}>
          {/* ── Cloudinary card ─────────────────────────────────────────────── */}
          <SectionCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <Cloud size={20} color="var(--color-primary)" />
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>Cloudinary</span>
              {cloudinary.enabled && <ActiveBadge />}
            </div>

            <Field
              label="Cloud Name"
              value={cloudinary.cloudName ?? ''}
              onChange={(v) => setCloudinary((c) => ({ ...c, cloudName: v }))}
              placeholder="e.g. my-cloud"
            />
            <Field
              label="Upload Preset"
              value={cloudinary.uploadPreset ?? ''}
              onChange={(v) => setCloudinary((c) => ({ ...c, uploadPreset: v }))}
              placeholder="unsigned preset name"
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => void testCloudinary()}
                disabled={cdnTest.status === 'testing'}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: '1px solid var(--color-border)', background: 'var(--color-background)',
                  color: 'var(--color-text)', cursor: 'pointer',
                }}
              >
                Test Connection
              </button>

              {!cloudinary.enabled && (
                <button
                  onClick={() => void setCloudinaryActive()}
                  style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: '1px solid var(--color-primary)',
                    background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
                    color: 'var(--color-primary)', cursor: 'pointer',
                  }}
                >
                  Set as Active
                </button>
              )}

              <TestResultBadge result={cdnTest} />
            </div>
          </SectionCard>

          {/* ── Amazon S3 card ───────────────────────────────────────────────── */}
          <SectionCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <HardDrive size={20} color="var(--color-primary)" />
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>Amazon S3</span>
              {s3.enabled && <ActiveBadge />}
            </div>

            <Field
              label="Bucket"
              value={s3.bucket ?? ''}
              onChange={(v) => setS3((c) => ({ ...c, bucket: v }))}
              placeholder="e.g. my-bucket"
            />
            <Field
              label="Region"
              value={s3.region ?? ''}
              onChange={(v) => setS3((c) => ({ ...c, region: v }))}
              placeholder="e.g. ap-southeast-2"
            />
            <Field
              label="Access Key"
              value={s3.accessKey ?? ''}
              onChange={(v) => setS3((c) => ({ ...c, accessKey: v }))}
              placeholder="AKIA…"
              masked
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => void testS3()}
                disabled={s3Test.status === 'testing'}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: '1px solid var(--color-border)', background: 'var(--color-background)',
                  color: 'var(--color-text)', cursor: 'pointer',
                }}
              >
                Test Connection
              </button>

              {!s3.enabled && (
                <button
                  onClick={() => void setS3Active()}
                  style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: '1px solid var(--color-primary)',
                    background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
                    color: 'var(--color-primary)', cursor: 'pointer',
                  }}
                >
                  Set as Active
                </button>
              )}

              <TestResultBadge result={s3Test} />
            </div>

            <p style={{ margin: '12px 0 0', fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Secret key is read server-side from <code>AWS_SECRET_ACCESS_KEY</code> env var. Only the access key ID is stored here.
            </p>
          </SectionCard>
        </div>

        {/* ── Supabase ─────────────────────────────────────────────────────── */}
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Database Backend
        </h3>

        <SectionCard style={{ maxWidth: 540 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <DatabaseIcon size={20} color="var(--color-primary)" />
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>Supabase</span>
            {isSupabaseConfigured(supabase) && <ActiveBadge />}
          </div>

          <Field
            label="Project URL"
            value={supabase.url ?? ''}
            onChange={(v) => setSupabase((c) => ({ ...c, url: v }))}
            placeholder="https://xyzabc.supabase.co"
          />
          <Field
            label="Anon Key"
            value={supabase.anonKey ?? ''}
            onChange={(v) => setSupabase((c) => ({ ...c, anonKey: v }))}
            placeholder="eyJhbGci…"
            masked
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => void testSupabase()}
              disabled={supTest.status === 'testing'}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: '1px solid var(--color-border)', background: 'var(--color-background)',
                color: 'var(--color-text)', cursor: 'pointer',
              }}
            >
              Test Connection
            </button>

            {!supabase.enabled && (
              <button
                onClick={() => void setSupabaseActive()}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: '1px solid var(--color-primary)',
                  background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
                  color: 'var(--color-primary)', cursor: 'pointer',
                }}
              >
                Set as Active Database
              </button>
            )}

            <TestResultBadge result={supTest} />
          </div>

          <p style={{ margin: '12px 0 0', fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            Requires <code>npm install @supabase/supabase-js</code>. When enabled, Supabase is used as the auth/database backend instead of Firebase.
          </p>
        </SectionCard>
      </div>
    </AdminLayout>
  );
}
