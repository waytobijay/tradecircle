/**
 * app/admin/firebase-setup/page.tsx
 * Four-step wizard for configuring Firebase from within the admin panel.
 *
 * Steps:
 *   1. Welcome
 *   2. Firebase keys (with "Test Connection")
 *   3. Service account JSON (optional)
 *   4. Download .env + optional "Migrate Admin to Firebase"
 *
 * The wizard only writes to the local config file (`/api/local-config`).
 * No environment variables are mutated — the operator must save the
 * generated .env.local themselves and restart the dev server / redeploy.
 */

'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Download,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Flame,
} from 'lucide-react';
import AdminLayout from '@/components/layouts/AdminLayout';

// ─── Types ────────────────────────────────────────────────────────────────

interface FirebaseKeys {
  apiKey:            string;
  authDomain:        string;
  projectId:         string;
  storageBucket:     string;
  appId:             string;
  messagingSenderId: string;
  vapidKey:          string;
}

const EMPTY_KEYS: FirebaseKeys = {
  apiKey: '', authDomain: '', projectId: '', storageBucket: '',
  appId: '', messagingSenderId: '', vapidKey: '',
};

type Step = 1 | 2 | 3 | 4;

// ─── Tiny UI helpers ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 13,
  borderRadius: 8,
  background: 'var(--color-bg-tertiary)',
  color: 'var(--color-text-primary)',
  border: '1px solid var(--color-border)',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 4,
  color: 'var(--color-text-secondary)',
};

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '10px 18px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--color-primary)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
});

const ghostBtn: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-text-primary)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

// ─── Step indicator ───────────────────────────────────────────────────────

function StepDots({ step }: { step: Step }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24 }}>
      {[1, 2, 3, 4].map((n) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: n <= step ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
              color: n <= step ? '#fff' : 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              transition: 'background 0.2s',
            }}
          >
            {n < step ? <CheckCircle2 size={16} /> : n}
          </div>
          {n < 4 && (
            <div
              style={{
                width: 32,
                height: 2,
                background: n < step ? 'var(--color-primary)' : 'var(--color-border)',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function FirebaseSetupPage() {
  const [step, setStep]   = useState<Step>(1);
  const [keys, setKeys]   = useState<FirebaseKeys>(EMPTY_KEYS);
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testError, setTestError]   = useState('');
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState('');
  const [envContent, setEnvContent] = useState('');

  // Migration state for step 4
  const [migrating, setMigrating]         = useState(false);
  const [migrateMsg, setMigrateMsg]       = useState('');
  const [migrateError, setMigrateError]   = useState('');

  // Hydrate from existing config so re-visits don't wipe progress.
  useEffect(() => {
    fetch('/api/local-config', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.config) return;
        if (data.config.firebase) {
          setKeys({ ...EMPTY_KEYS, ...data.config.firebase });
        }
        if (data.config.serviceAccountJson) {
          setServiceAccountJson(data.config.serviceAccountJson);
        }
      })
      .catch(() => { /* silent */ });
  }, []);

  // ── Step 2: test connection ────────────────────────────────────────────
  async function handleTest() {
    setTestStatus('testing');
    setTestError('');
    try {
      const res  = await fetch('/api/firebase-test', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(keys),
      });
      const data = await res.json();
      if (data.ok) {
        setTestStatus('ok');
      } else {
        setTestStatus('error');
        setTestError(data.error || 'Connection failed.');
      }
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : 'Network error.');
    }
  }

  // ── Save the wizard so far ─────────────────────────────────────────────
  async function saveConfig(): Promise<boolean> {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/local-config', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          firebase:           keys,
          serviceAccountJson: serviceAccountJson || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Save failed.');
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  // ── Step 4: preview .env ───────────────────────────────────────────────
  useEffect(() => {
    if (step !== 4) return;
    fetch('/api/local-config?export=env', { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : ''))
      .then(setEnvContent)
      .catch(() => setEnvContent(''));
  }, [step]);

  function downloadEnv() {
    const blob = new Blob([envContent], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = '.env.local';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Step 4: migrate admin to Firebase ──────────────────────────────────
  async function handleMigrate() {
    setMigrating(true);
    setMigrateMsg('');
    setMigrateError('');
    try {
      const res  = await fetch('/api/local-config/migrate', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setMigrateMsg(data.message || 'Admin migrated successfully.');
      } else {
        setMigrateError(
          data.error === 'firebase_admin_not_configured'
            ? 'Firebase Admin SDK not configured. Save .env.local and restart, then try again.'
            : data.error || 'Migration failed.',
        );
      }
    } catch (err) {
      setMigrateError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setMigrating(false);
    }
  }

  // ── Step navigation ────────────────────────────────────────────────────
  async function goNext() {
    if (step === 2) {
      const ok = await saveConfig();
      if (!ok) return;
    }
    if (step === 3) {
      const ok = await saveConfig();
      if (!ok) return;
    }
    setStep((s) => (Math.min(4, s + 1) as Step));
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div style={{ padding: '32px 24px', maxWidth: 980, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Flame size={28} style={{ color: '#f97316' }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
            Firebase Configuration Wizard
          </h1>
        </div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 28 }}>
          Connect your Firebase project so TradeCircle can persist users, products, and orders.
        </p>

        <StepDots step={step} />

        {/* ── Step 1: Welcome ───────────────────────────────────────────── */}
        {step === 1 && (
          <Card>
            <h2 style={h2}>Welcome</h2>
            <p style={body}>
              This wizard collects your Firebase credentials and produces a ready-to-deploy
              <code style={codeChip}>.env.local</code> file. You&apos;ll be guided through:
            </p>
            <ol style={{ ...body, paddingLeft: 20 }}>
              <li>Pasting your Firebase client config (6 values).</li>
              <li>Optionally pasting your service account JSON (for server-side admin).</li>
              <li>Downloading the generated <code style={codeChip}>.env.local</code>.</li>
              <li>Migrating your bootstrap admin into Firebase.</li>
            </ol>
            <div style={{ marginTop: 24 }}>
              <button style={primaryBtn(false)} onClick={() => setStep(2)}>
                Get Started <ChevronRight size={16} />
              </button>
            </div>
          </Card>
        )}

        {/* ── Step 2: Firebase keys ─────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            <Card>
              <h2 style={h2}>Firebase Keys</h2>
              <p style={body}>
                Paste the six values from your Firebase project&apos;s web app config.
              </p>

              <Field id="apiKey"            label="API Key *"             value={keys.apiKey}            onChange={(v) => setKeys({ ...keys, apiKey: v })} />
              <Field id="authDomain"        label="Auth Domain *"         value={keys.authDomain}        onChange={(v) => setKeys({ ...keys, authDomain: v })} placeholder="your-project.firebaseapp.com" />
              <Field id="projectId"         label="Project ID *"          value={keys.projectId}         onChange={(v) => setKeys({ ...keys, projectId: v })} />
              <Field id="storageBucket"     label="Storage Bucket"        value={keys.storageBucket}     onChange={(v) => setKeys({ ...keys, storageBucket: v })} placeholder="your-project.appspot.com" />
              <Field id="appId"             label="App ID *"              value={keys.appId}             onChange={(v) => setKeys({ ...keys, appId: v })} />
              <Field id="messagingSenderId" label="Messaging Sender ID"   value={keys.messagingSenderId} onChange={(v) => setKeys({ ...keys, messagingSenderId: v })} />
              <Field id="vapidKey"          label="VAPID Key (optional)"  value={keys.vapidKey}          onChange={(v) => setKeys({ ...keys, vapidKey: v })} />

              {/* Test connection */}
              <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={ghostBtn}
                  onClick={handleTest}
                  disabled={testStatus === 'testing'}
                >
                  {testStatus === 'testing' && <Loader2 size={14} className="animate-spin" />}
                  Test Connection
                </button>
                {testStatus === 'ok' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-success)', fontSize: 13 }}>
                    <CheckCircle2 size={16} /> Connection OK
                  </span>
                )}
                {testStatus === 'error' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-danger)', fontSize: 13 }}>
                    <AlertCircle size={16} /> {testError}
                  </span>
                )}
              </div>

              {saveError && (
                <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 12 }}>
                  {saveError}
                </p>
              )}

              <NavRow
                onBack={() => setStep(1)}
                onNext={goNext}
                nextLabel={saving ? 'Saving…' : 'Save & Continue'}
                nextDisabled={saving}
              />
            </Card>

            {/* Help card */}
            <Card subtle>
              <h3 style={{ ...h2, fontSize: 14 }}>Where do I find these?</h3>
              <ol style={{ ...body, fontSize: 12, paddingLeft: 18, lineHeight: 1.6 }}>
                <li>Open <strong>console.firebase.google.com</strong>.</li>
                <li>Pick your project.</li>
                <li>Click the gear icon → <strong>Project settings</strong>.</li>
                <li>Scroll to <strong>Your apps</strong> → web app.</li>
                <li>Copy the values from the <code style={codeChip}>firebaseConfig</code> object.</li>
              </ol>
              <a
                href="https://console.firebase.google.com"
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'var(--color-primary)',
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 8,
                }}
              >
                Open Firebase Console <ExternalLink size={12} />
              </a>
            </Card>
          </div>
        )}

        {/* ── Step 3: Service account ───────────────────────────────────── */}
        {step === 3 && (
          <Card>
            <h2 style={h2}>Service Account (optional)</h2>
            <p style={body}>
              Required for server-side admin operations (verifying sessions, writing
              from API routes). In the Firebase console, go to{' '}
              <strong>Project Settings → Service accounts → Generate new private key</strong>{' '}
              and paste the entire JSON file below.
            </p>
            <textarea
              value={serviceAccountJson}
              onChange={(e) => setServiceAccountJson(e.target.value)}
              placeholder='{ "type": "service_account", "project_id": "...", ... }'
              rows={12}
              style={{
                ...inputStyle,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12,
                resize: 'vertical',
              }}
            />
            {saveError && (
              <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 12 }}>
                {saveError}
              </p>
            )}
            <NavRow
              onBack={() => setStep(2)}
              onNext={goNext}
              nextLabel={saving ? 'Saving…' : serviceAccountJson ? 'Save & Continue' : 'Skip for now'}
              nextDisabled={saving}
            />
          </Card>
        )}

        {/* ── Step 4: Download + migrate ────────────────────────────────── */}
        {step === 4 && (
          <Card>
            <h2 style={h2}>Download & Deploy</h2>
            <p style={body}>Your generated environment file:</p>
            <pre
              style={{
                background: 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                lineHeight: 1.5,
                maxHeight: 320,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {envContent || 'Loading…'}
            </pre>

            <div style={{ marginTop: 12 }}>
              <button style={primaryBtn(!envContent)} onClick={downloadEnv} disabled={!envContent}>
                <Download size={16} /> Download .env File
              </button>
            </div>

            <h3 style={{ ...h2, fontSize: 14, marginTop: 24 }}>Next steps</h3>
            <ol style={{ ...body, paddingLeft: 20, lineHeight: 1.8 }}>
              <li>Save the downloaded file as <code style={codeChip}>.env.local</code> in your project root.</li>
              <li>Copy the same variables into <strong>Vercel → Settings → Environment Variables</strong>.</li>
              <li>Restart <code style={codeChip}>npm run dev</code> (or redeploy).</li>
              <li>Click <strong>Migrate Admin to Firebase</strong> below to copy your bootstrap admin.</li>
            </ol>

            <div style={{
              marginTop: 24,
              padding: 16,
              borderRadius: 10,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-secondary)',
            }}>
              <h3 style={{ ...h2, fontSize: 14, margin: 0, marginBottom: 6 }}>Migrate Admin to Firebase</h3>
              <p style={{ ...body, fontSize: 12, marginTop: 0 }}>
                Copies the local bootstrap admin into <code style={codeChip}>adminUsers/{'{uid}'}</code>.
                Requires Firebase Admin SDK to be live (i.e. you&apos;ve restarted with the new env vars).
              </p>
              <button
                style={primaryBtn(migrating)}
                onClick={handleMigrate}
                disabled={migrating}
              >
                {migrating && <Loader2 size={14} className="animate-spin" />}
                Migrate Admin to Firebase
              </button>
              {migrateMsg && (
                <p style={{ color: 'var(--color-success)', fontSize: 13, marginTop: 12 }}>
                  {migrateMsg}
                </p>
              )}
              {migrateError && (
                <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 12 }}>
                  {migrateError}
                </p>
              )}
            </div>

            <div style={{ marginTop: 24 }}>
              <button style={ghostBtn} onClick={() => setStep(3)}>
                <ChevronLeft size={14} /> Back
              </button>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

// ─── Reusable bits ────────────────────────────────────────────────────────

const h2: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  margin: 0,
  marginBottom: 12,
  color: 'var(--color-text-primary)',
};

const body: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.6,
  color: 'var(--color-text-secondary)',
  marginTop: 0,
  marginBottom: 16,
};

const codeChip: React.CSSProperties = {
  background: 'var(--color-bg-tertiary)',
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: '90%',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

function Card({ children, subtle }: { children: React.ReactNode; subtle?: boolean }) {
  return (
    <div
      style={{
        background: subtle ? 'var(--color-bg-secondary)' : 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: 24,
      }}
    >
      {children}
    </div>
  );
}

function Field({
  id, label, value, onChange, placeholder,
}: {
  id:           string;
  label:        string;
  value:        string;
  onChange:     (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

function NavRow({
  onBack, onNext, nextLabel, nextDisabled,
}: {
  onBack:        () => void;
  onNext:        () => void;
  nextLabel:     string;
  nextDisabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
      <button style={ghostBtn} onClick={onBack}>
        <ChevronLeft size={14} /> Back
      </button>
      <button style={primaryBtn(!!nextDisabled)} onClick={onNext} disabled={nextDisabled}>
        {nextLabel} <ChevronRight size={16} />
      </button>
    </div>
  );
}
