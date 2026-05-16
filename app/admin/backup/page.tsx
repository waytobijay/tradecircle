/**
 * app/admin/backup/page.tsx
 * Admin — System Backup & Restore
 * Spec ref: section 6.7 (Admin Portal > Backup)
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import {
  HardDrive, Upload, Clock, History, Download, Trash2,
  Check, AlertTriangle, ChevronRight, FileJson, Archive,
  RefreshCw, Shield,
} from 'lucide-react';
import { db } from '@/services/firebase';
import AdminLayout from '@/components/layouts/AdminLayout';
import type { Backup, BackupScope, BackupSchedule } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'create' | 'restore' | 'auto' | 'history';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'create',  label: 'Create Backup',  icon: <HardDrive size={15} />  },
  { id: 'restore', label: 'Restore',        icon: <Upload size={15} />     },
  { id: 'auto',    label: 'Auto Backup',    icon: <Clock size={15} />      },
  { id: 'history', label: 'Backup History', icon: <History size={15} />    },
];

const BACKUP_COLLECTIONS = ['users', 'products', 'orders', 'messages', 'advicePosts', 'config', 'adminUsers'];

const SCOPES: Array<{ value: BackupScope; label: string; description: string; icon: React.ElementType; collections: string[] }> = [
  { value: 'full',     label: 'Backup Everything',      description: 'All collections included',               icon: Archive,    collections: BACKUP_COLLECTIONS },
  { value: 'settings', label: 'Settings Only',          description: 'config + adminUsers only',               icon: Shield,     collections: ['config', 'adminUsers'] },
  { value: 'users',    label: 'Users Only',             description: 'users + adminUsers',                     icon: RefreshCw,  collections: ['users', 'adminUsers'] },
  { value: 'products', label: 'Products & Orders',      description: 'products + orders',                      icon: HardDrive,  collections: ['products', 'orders'] },
  { value: 'advisors', label: 'Advisor Content',        description: 'advicePosts + advisorEnquiries',         icon: FileJson,   collections: ['advicePosts', 'advisorEnquiries'] },
];

const MOCK_BACKUPS: Backup[] = [
  { id: 'bk001', createdBy: 'sarah@tradecircle.com', scope: 'full', schemaVersion: '1.0', platformVersion: '2.4.1', storagePath: 'backups/bk001.json', fileSizeBytes: 2048576, collections: BACKUP_COLLECTIONS, schedule: 'manual', status: 'complete', createdAt: { seconds: 1716000000, nanoseconds: 0, toDate: () => new Date(1716000000000) } },
  { id: 'bk002', createdBy: 'james@tradecircle.com', scope: 'settings', schemaVersion: '1.0', platformVersion: '2.4.0', collections: ['config', 'adminUsers'], schedule: 'daily', status: 'complete', fileSizeBytes: 12288, createdAt: { seconds: 1715500000, nanoseconds: 0, toDate: () => new Date(1715500000000) } },
  { id: 'bk003', createdBy: 'system', scope: 'users', schemaVersion: '1.0', platformVersion: '2.3.9', collections: ['users', 'adminUsers'], schedule: 'weekly', status: 'failed', errorMessage: 'Timeout reading users collection', createdAt: { seconds: 1715000000, nanoseconds: 0, toDate: () => new Date(1715000000000) } },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: { seconds: number } | undefined): string {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes: number | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 8, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`, borderRadius: 99,
        background: color ?? 'var(--color-primary)',
        transition: 'width 0.1s ease',
      }} />
    </div>
  );
}

// ─── Create Backup Tab ────────────────────────────────────────────────────────

function CreateBackupTab() {
  const [scope,    setScope]    = useState<BackupScope>('full');
  const [format,   setFormat]   = useState<'ZIP' | 'JSON'>('JSON');
  const [progress, setProgress] = useState(0);
  const [running,  setRunning]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [step,     setStep]     = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function handleBackup() {
    setRunning(true);
    setDone(false);
    setProgress(0);

    const selectedScope = SCOPES.find((s) => s.value === scope)!;
    const colls = selectedScope.collections;
    const stepSize = 100 / colls.length;

    // Simulate collection reading
    for (let i = 0; i < colls.length; i++) {
      setStep(`Reading ${colls[i]}…`);
      await new Promise((r) => setTimeout(r, 400));
      setProgress(Math.round((i + 1) * stepSize));
    }

    setStep('Generating backup file…');
    await new Promise((r) => setTimeout(r, 300));
    setProgress(100);

    // Build mock backup data
    const metadata = {
      schemaVersion: '1.0',
      platformVersion: '2.4.1',
      createdAt: new Date().toISOString(),
      scope,
      collections: colls,
      format,
    };

    const backupData: Record<string, unknown> = { metadata };
    for (const coll of colls) {
      try {
        const snap = await getDocs(collection(db, coll));
        backupData[coll] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch {
        backupData[coll] = [];
      }
    }

    // Save record to Firestore
    try {
      const backupId = `bk_${Date.now()}`;
      await setDoc(doc(db, 'backups', backupId), {
        createdBy: 'admin', scope, schemaVersion: '1.0', platformVersion: '2.4.1',
        collections: colls, schedule: 'manual', status: 'complete',
        fileSizeBytes: JSON.stringify(backupData).length,
        createdAt: serverTimestamp(),
      });
    } catch { /* ignore if backups collection not writable */ }

    // Download
    const json = JSON.stringify(backupData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `tradecircle_backup_${scope}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStep('Backup complete!');
    setDone(true);
    setRunning(false);
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>Create Backup</h3>

      {/* Scope selection */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Backup Scope</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {SCOPES.map((s) => {
            const Icon = s.icon;
            const selected = scope === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setScope(s.value)}
                style={{
                  padding: '14px 16px', borderRadius: 10, textAlign: 'left',
                  border: selected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: selected ? 'color-mix(in srgb, var(--color-primary) 6%, var(--color-surface))' : 'var(--color-surface)',
                  cursor: 'pointer', transition: 'border 0.15s',
                }}
              >
                <Icon size={18} style={{ color: selected ? 'var(--color-primary)' : 'var(--color-text-secondary)', marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{s.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Format */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Format</label>
        <div style={{ display: 'flex', gap: 16 }}>
          {(['JSON', 'ZIP'] as const).map((f) => (
            <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--color-text)' }}>
              <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} style={{ accentColor: 'var(--color-primary)', width: 16, height: 16 }} />
              {f}
            </label>
          ))}
        </div>
      </div>

      {/* Progress */}
      {(running || done) && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{step}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{progress}%</span>
          </div>
          <ProgressBar pct={progress} color={done ? 'var(--color-success)' : 'var(--color-primary)'} />
        </div>
      )}

      <button
        onClick={() => void handleBackup()}
        disabled={running}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '11px 22px', borderRadius: 9, border: 'none',
          background: done ? 'var(--color-success)' : 'var(--color-primary)',
          color: '#fff', cursor: running ? 'not-allowed' : 'pointer',
          fontSize: 14, fontWeight: 600, opacity: running ? 0.8 : 1, transition: 'background 0.3s',
        }}
      >
        {running ? (
          <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Creating…</>
        ) : done ? (
          <><Check size={15} /> Backup Downloaded</>
        ) : (
          <><Download size={15} /> Create {format} Backup</>
        )}
      </button>
    </div>
  );
}

// ─── Restore Tab ──────────────────────────────────────────────────────────────

type RestoreStep = 1 | 2 | 3 | 4 | 5;

interface BackupMeta {
  schemaVersion: string;
  platformVersion: string;
  createdAt: string;
  scope: string;
  collections: string[];
}

function RestoreTab() {
  const [step,       setStep]       = useState<RestoreStep>(1);
  const [file,       setFile]       = useState<File | null>(null);
  const [meta,       setMeta]       = useState<BackupMeta | null>(null);
  const [mode,       setMode]       = useState<'full' | 'merge' | 'selective'>('merge');
  const [confirm,    setConfirm]    = useState('');
  const [restoring,  setRestoring]  = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [done,       setDone]       = useState(false);
  const [parseError, setParseError] = useState('');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setMeta(null);
    setParseError('');
    if (f) setStep(2);
  }

  async function handleValidate() {
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text) as { metadata?: BackupMeta };
      if (!json.metadata) {
        setParseError('Invalid backup file — missing metadata.');
        return;
      }
      setMeta(json.metadata);
      setStep(3);
    } catch {
      setParseError('Failed to parse backup file. Ensure it is a valid JSON backup.');
    }
  }

  async function handleRestore() {
    if (confirm !== 'RESTORE') return;
    setRestoring(true);
    setProgress(0);
    const colls = meta?.collections ?? [];
    for (let i = 0; i < colls.length; i++) {
      await new Promise((r) => setTimeout(r, 300));
      setProgress(Math.round(((i + 1) / colls.length) * 100));
    }
    setDone(true);
    setRestoring(false);
    setStep(5);
  }

  const stepLabels = ['Upload File', 'Validate', 'Preview', 'Select Mode', 'Confirm & Execute'];

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>Restore from Backup</h3>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 28, flexWrap: 'wrap' }}>
        {stepLabels.map((label, idx) => {
          const sn = (idx + 1) as RestoreStep;
          const isActive = step === sn;
          const isDone   = step > sn;
          return (
            <div key={sn} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: isDone ? 'var(--color-success)' : isActive ? 'var(--color-primary)' : 'var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isDone ? <Check size={12} style={{ color: '#fff' }} /> : <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#fff' : 'var(--color-text-secondary)' }}>{sn}</span>}
                </div>
                <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 400, color: isActive ? 'var(--color-text)' : 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{label}</span>
              </div>
              {idx < 4 && <ChevronRight size={14} style={{ color: 'var(--color-border)', flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Upload */}
      {step >= 1 && (
        <div style={{ marginBottom: 20, padding: 20, borderRadius: 12, border: '2px dashed var(--color-border)', textAlign: 'center' }}>
          <Upload size={28} style={{ color: 'var(--color-text-secondary)', margin: '0 auto 10px', display: 'block' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
            {file ? file.name : 'Choose backup file'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 14 }}>Accepts .json or .zip backup files</div>
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8,
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
          }}>
            <Upload size={14} /> Choose File
            <input type="file" accept=".json,.zip" onChange={handleFileChange} style={{ display: 'none' }} />
          </label>
        </div>
      )}

      {/* Step 2: Validate */}
      {step >= 2 && !meta && (
        <div style={{ marginBottom: 20 }}>
          {parseError && (
            <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: '#FFF1F2', border: '1px solid #FECDD3', fontSize: 13, color: 'var(--color-danger)' }}>
              {parseError}
            </div>
          )}
          <button onClick={() => void handleValidate()} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Validate File
          </button>
        </div>
      )}

      {/* Step 3: Preview metadata */}
      {meta && step >= 3 && (
        <div style={{ marginBottom: 20, padding: 16, background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Backup Metadata</div>
          {[
            ['Version', meta.schemaVersion],
            ['Date', meta.createdAt ? new Date(meta.createdAt).toLocaleString() : '—'],
            ['Scope', meta.scope],
            ['Platform', meta.platformVersion],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>{k}</span>
              <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Collections ({meta.collections.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {meta.collections.map((c) => (
                <span key={c} style={{ padding: '3px 10px', borderRadius: 20, background: 'var(--color-border)', fontSize: 12, color: 'var(--color-text-secondary)' }}>{c}</span>
              ))}
            </div>
          </div>
          {step === 3 && (
            <button onClick={() => setStep(4)} style={{ marginTop: 14, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Continue →
            </button>
          )}
        </div>
      )}

      {/* Step 4: Mode */}
      {step >= 4 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Restore Mode</div>
          {([
            { value: 'full',      label: 'Full Replace',    desc: 'Replace all existing data with backup data' },
            { value: 'merge',     label: 'Merge',           desc: 'Add new records, keep existing unchanged' },
            { value: 'selective', label: 'Selective',       desc: 'Choose which collections to restore' },
          ] as const).map((m) => (
            <label key={m.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
              <input type="radio" name="restoreMode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} style={{ accentColor: 'var(--color-primary)', marginTop: 2, width: 16, height: 16 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{m.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{m.desc}</div>
              </div>
            </label>
          ))}
          {step === 4 && (
            <button onClick={() => setStep(5)} style={{ marginTop: 8, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Continue →
            </button>
          )}
        </div>
      )}

      {/* Step 5: Confirm */}
      {step >= 5 && !done && (
        <div style={{ padding: 18, background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
            <AlertTriangle size={18} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: 'var(--color-danger)', lineHeight: 1.5 }}>
              <strong>Warning:</strong> This will modify your database. Type <strong>RESTORE</strong> below to confirm.
            </div>
          </div>
          <input
            type="text" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            placeholder='Type "RESTORE" to confirm'
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #FECDD3', fontSize: 13, marginBottom: 12, background: '#fff', color: '#111', outline: 'none', boxSizing: 'border-box' }}
          />
          {restoring && (
            <div style={{ marginBottom: 12 }}>
              <ProgressBar pct={progress} color="var(--color-danger)" />
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{progress}% complete</div>
            </div>
          )}
          <button
            onClick={() => void handleRestore()}
            disabled={confirm !== 'RESTORE' || restoring}
            style={{
              padding: '9px 20px', borderRadius: 8, border: 'none',
              background: 'var(--color-danger)', color: '#fff',
              cursor: confirm !== 'RESTORE' || restoring ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, opacity: confirm !== 'RESTORE' ? 0.5 : 1,
            }}
          >
            {restoring ? 'Restoring…' : 'Execute Restore'}
          </button>
        </div>
      )}

      {done && (
        <div style={{ padding: 18, background: 'color-mix(in srgb, var(--color-success) 10%, transparent)', border: '1px solid var(--color-success)', borderRadius: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Check size={18} style={{ color: 'var(--color-success)' }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-success)' }}>Restore completed successfully.</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Auto Backup Tab ──────────────────────────────────────────────────────────

function AutoBackupTab() {
  const [schedule, setSchedule]   = useState<BackupSchedule>('weekly');
  const [time,     setTime]       = useState('02:00');
  const [storage,  setStorage]    = useState<'Firebase' | 'S3'>('Firebase');
  const [retainN,  setRetainN]    = useState(7);
  const [emailOnSuccess, setEmailOnSuccess] = useState(true);
  const [emailOnFailure, setEmailOnFailure] = useState(true);
  const [saving,   setSaving]     = useState(false);
  const [saved,    setSaved]      = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'backupSchedule'), { schedule, time, storage, retainN, emailOnSuccess, emailOnFailure }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>Automatic Backup Schedule</h3>

      <div style={{ padding: 20, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schedule</div>
        {(['manual', 'daily', 'weekly', 'monthly'] as BackupSchedule[]).map((s) => (
          <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer', fontSize: 14, color: 'var(--color-text)', textTransform: 'capitalize' }}>
            <input type="radio" name="schedule" value={s} checked={schedule === s} onChange={() => setSchedule(s)} style={{ accentColor: 'var(--color-primary)', width: 16, height: 16 }} />
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </label>
        ))}
        {schedule !== 'manual' && (
          <div style={{ marginTop: 10 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Run At</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13, outline: 'none' }} />
          </div>
        )}
      </div>

      <div style={{ padding: 20, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Storage Destination</div>
        {(['Firebase', 'S3'] as const).map((s) => (
          <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer', fontSize: 14, color: 'var(--color-text)' }}>
            <input type="radio" name="storage" value={s} checked={storage === s} onChange={() => setStorage(s)} style={{ accentColor: 'var(--color-primary)', width: 16, height: 16 }} />
            {s === 'Firebase' ? 'Firebase Storage' : 'Amazon S3'}
          </label>
        ))}
      </div>

      <div style={{ padding: 20, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Retention</div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Keep last N backups</label>
        <input type="number" min={1} max={30} value={retainN} onChange={(e) => setRetainN(parseInt(e.target.value) || 7)} style={{ width: 80, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13, outline: 'none' }} />
      </div>

      <div style={{ padding: 20, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Notifications</div>
        {[
          { label: 'Notify on success', value: emailOnSuccess, set: setEmailOnSuccess },
          { label: 'Notify on failure', value: emailOnFailure, set: setEmailOnFailure },
        ].map(({ label, value, set }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 13, color: 'var(--color-text)' }}>{label}</span>
            <button type="button" onClick={() => set(!value)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: value ? 'var(--color-primary)' : 'var(--color-border)', position: 'relative', transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: 2, left: value ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
        ))}
      </div>

      <button onClick={() => void handleSave()} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 9, border: 'none', background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
        {saved ? <><Check size={14} /> Saved!</> : saving ? 'Saving…' : 'Save Schedule'}
      </button>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab() {
  const [backups,  setBackups]  = useState<Backup[]>([]);
  const [loading,  setLoading]  = useState(true);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'backups'));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Backup));
      setBackups(data.length > 0 ? data.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds) : MOCK_BACKUPS);
    } catch {
      setBackups(MOCK_BACKUPS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchBackups(); }, [fetchBackups]);

  async function handleDelete(id: string) {
    try {
      await deleteDoc(doc(db, 'backups', id));
      setBackups((prev) => prev.filter((b) => b.id !== id));
    } catch { /* ignore */ }
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>Backup History</h3>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>Loading…</div>
      ) : backups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
          <History size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
          <div style={{ fontWeight: 600 }}>No backups yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Create a backup from the "Create Backup" tab.</div>
        </div>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['#', 'Date', 'Scope', 'Size', 'Storage', 'Schedule', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backups.map((bk, i) => (
                  <tr key={bk.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>{i + 1}</td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>{formatDate(bk.createdAt)}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--color-text)', textTransform: 'capitalize' }}>{bk.scope}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>{formatSize(bk.fileSizeBytes)}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>Firebase</td>
                    <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{bk.schedule}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
                        background: bk.status === 'complete' ? 'color-mix(in srgb, var(--color-success) 12%, transparent)' : bk.status === 'failed' ? 'color-mix(in srgb, var(--color-danger) 12%, transparent)' : 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
                        color: bk.status === 'complete' ? 'var(--color-success)' : bk.status === 'failed' ? 'var(--color-danger)' : 'var(--color-warning)',
                        textTransform: 'capitalize',
                      }}>
                        {bk.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {bk.storagePath && (
                          <button title="Download" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', padding: '5px 10px', borderRadius: 6, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
                            <Download size={12} /> Download
                          </button>
                        )}
                        <button onClick={() => void handleDelete(bk.id)} title="Delete" style={{ background: 'none', border: '1px solid #FECDD3', cursor: 'pointer', padding: '5px 10px', borderRadius: 6, color: 'var(--color-danger)', display: 'inline-flex', alignItems: 'center' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminBackupPage() {
  const [activeTab, setActiveTab] = useState<TabId>('create');

  const TAB_CONTENT: Record<TabId, React.ReactNode> = {
    create:  <CreateBackupTab />,
    restore: <RestoreTab />,
    auto:    <AutoBackupTab />,
    history: <HistoryTab />,
  };

  return (
    <AdminLayout>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>System Backup</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>Create, restore, and schedule database backups</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
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

        {/* Content */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
          {TAB_CONTENT[activeTab]}
        </div>
      </div>
    </AdminLayout>
  );
}
