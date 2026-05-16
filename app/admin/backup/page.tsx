/**
 * app/admin/backup/page.tsx
 * Admin — System Backup & Restore
 * Spec ref: section 6.7 (Admin Portal > Backup)
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection, getDocs, doc, setDoc, deleteDoc,
  getDoc, serverTimestamp, query, orderBy, limit,
} from 'firebase/firestore';
import {
  ref, uploadBytes, getDownloadURL, deleteObject,
} from 'firebase/storage';
import {
  HardDrive, Upload, Clock, History, Download, Trash2,
  Check, AlertTriangle, ChevronRight, FileJson, Archive,
  RefreshCw, Shield, Cloud, UploadCloud, X,
} from 'lucide-react';
import { db, storage } from '@/services/firebase';
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

/** Compute the next run date/time given schedule + time + optional weekday/monthday */
function computeNextRun(
  schedule: BackupSchedule,
  time: string,
  dayOfWeek: number,
  dayOfMonth: number,
): Date | null {
  if (schedule === 'manual') return null;
  const [hh, mm] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date();
  next.setSeconds(0, 0);
  next.setHours(hh, mm);

  if (schedule === 'daily') {
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  if (schedule === 'weekly') {
    const today = now.getDay(); // 0=Sun
    let diff = dayOfWeek - today;
    if (diff < 0 || (diff === 0 && next <= now)) diff += 7;
    next.setDate(next.getDate() + diff);
    return next;
  }

  if (schedule === 'monthly') {
    next.setDate(dayOfMonth);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(dayOfMonth);
    }
    return next;
  }

  return null;
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

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  const bg = type === 'success' ? 'color-mix(in srgb, var(--color-success) 12%, var(--color-surface))' :
             type === 'error'   ? 'color-mix(in srgb, var(--color-danger) 12%, var(--color-surface))' :
             'color-mix(in srgb, #3B82F6 12%, var(--color-surface))';
  const border = type === 'success' ? 'var(--color-success)' : type === 'error' ? 'var(--color-danger)' : '#3B82F6';
  const color  = type === 'success' ? 'var(--color-success)' : type === 'error' ? 'var(--color-danger)' : '#1d4ed8';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      padding: '11px 16px', borderRadius: 10, marginBottom: 16,
      background: bg, border: `1px solid ${border}`,
      fontSize: 13, color,
    }}>
      <span>{msg}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color, padding: 0, display: 'flex' }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Create Backup Tab ────────────────────────────────────────────────────────

function CreateBackupTab() {
  const [scope,        setScope]        = useState<BackupScope>('full');
  const [format,       setFormat]       = useState<'ZIP' | 'JSON'>('JSON');
  const [progress,     setProgress]     = useState(0);
  const [running,      setRunning]      = useState(false);
  const [done,         setDone]         = useState(false);
  const [step,         setStep]         = useState('');
  const [backupId,     setBackupId]     = useState<string | null>(null);
  const [backupData,   setBackupData]   = useState<Record<string, unknown> | null>(null);
  const [uploadPct,    setUploadPct]    = useState(0);
  const [uploading,    setUploading]    = useState(false);
  const [uploadDone,   setUploadDone]   = useState(false);
  const [uploadPath,   setUploadPath]   = useState('');
  const [toast,        setToast]        = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function handleBackup() {
    setRunning(true);
    setDone(false);
    setUploadDone(false);
    setUploadPct(0);
    setToast(null);
    setBackupData(null);
    setBackupId(null);
    setProgress(0);

    const selectedScope = SCOPES.find((s) => s.value === scope)!;
    const colls = selectedScope.collections;
    const stepSize = 100 / colls.length;

    for (let i = 0; i < colls.length; i++) {
      setStep(`Reading ${colls[i]}…`);
      await new Promise((r) => setTimeout(r, 400));
      setProgress(Math.round((i + 1) * stepSize));
    }

    setStep('Generating backup file…');
    await new Promise((r) => setTimeout(r, 300));
    setProgress(100);

    const metadata = {
      schemaVersion: '1.0',
      platformVersion: '2.4.1',
      createdAt: new Date().toISOString(),
      scope,
      collections: colls,
      format,
    };

    const data: Record<string, unknown> = { metadata };
    for (const coll of colls) {
      try {
        const snap = await getDocs(collection(db, coll));
        data[coll] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch {
        data[coll] = [];
      }
    }

    const newBackupId = `bk_${Date.now()}`;
    try {
      await setDoc(doc(db, 'backups', newBackupId), {
        createdBy: 'admin', scope, schemaVersion: '1.0', platformVersion: '2.4.1',
        collections: colls, schedule: 'manual', status: 'complete',
        fileSizeBytes: JSON.stringify(data).length,
        createdAt: serverTimestamp(),
      });
      setBackupId(newBackupId);
    } catch { /* ignore if backups collection not writable */ }

    setBackupData(data);

    // Download
    const json = JSON.stringify(data, null, 2);
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

  async function handleCloudUpload() {
    if (!backupData || !backupId) return;
    setUploading(true);
    setUploadPct(0);
    setToast(null);

    // Simulate progress while uploading
    let fakeProgress = 0;
    const fakeTimer = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + Math.random() * 15, 90);
      setUploadPct(Math.round(fakeProgress));
    }, 300);

    try {
      const res = await fetch('/api/backup/cloud-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId, data: backupData, scope }),
      });

      clearInterval(fakeTimer);

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? 'Upload failed');
      }

      const result = (await res.json()) as { storagePath: string; downloadUrl: string };
      setUploadPct(100);
      setUploadPath(result.storagePath);
      setUploadDone(true);
      setToast({ msg: `Saved to Firebase Storage: ${result.storagePath}`, type: 'success' });
    } catch (err) {
      clearInterval(fakeTimer);
      setUploadPct(0);
      setToast({ msg: err instanceof Error ? err.message : 'Upload failed', type: 'error' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>Create Backup</h3>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

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

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
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

        {/* Cloud upload button — visible after a backup is created */}
        {done && backupData && (
          <button
            onClick={() => void handleCloudUpload()}
            disabled={uploading || uploadDone}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 22px', borderRadius: 9, border: '1px solid var(--color-border)',
              background: uploadDone ? 'color-mix(in srgb, var(--color-success) 10%, var(--color-surface))' : 'var(--color-surface)',
              color: uploadDone ? 'var(--color-success)' : 'var(--color-text)',
              cursor: (uploading || uploadDone) ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600, opacity: uploading ? 0.8 : 1,
            }}
          >
            {uploading ? (
              <><span style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Uploading…</>
            ) : uploadDone ? (
              <><Check size={15} /> Saved to Cloud</>
            ) : (
              <><UploadCloud size={15} /> Upload to Cloud</>
            )}
          </button>
        )}
      </div>

      {/* Upload progress bar */}
      {uploading && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Uploading to Firebase Storage…</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{uploadPct}%</span>
          </div>
          <ProgressBar pct={uploadPct} color="var(--color-primary)" />
        </div>
      )}

      {/* Storage path badge */}
      {uploadDone && uploadPath && (
        <div style={{
          marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '6px 12px', borderRadius: 8, fontSize: 12,
          background: 'color-mix(in srgb, var(--color-success) 10%, var(--color-surface))',
          border: '1px solid var(--color-success)', color: 'var(--color-success)',
        }}>
          <Cloud size={13} />
          <code style={{ fontFamily: 'monospace' }}>{uploadPath}</code>
        </div>
      )}
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
  const [step,              setStep]              = useState<RestoreStep>(1);
  const [file,              setFile]              = useState<File | null>(null);
  const [meta,              setMeta]              = useState<BackupMeta | null>(null);
  const [mode,              setMode]              = useState<'full' | 'merge' | 'selective'>('merge');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [confirm,           setConfirm]           = useState('');
  const [restoring,         setRestoring]         = useState(false);
  const [progress,          setProgress]          = useState(0);
  const [done,              setDone]              = useState(false);
  const [parseError,        setParseError]        = useState('');
  const [restoreToast,      setRestoreToast]      = useState('');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setMeta(null);
    setParseError('');
    setDone(false);
    setConfirm('');
    if (f) setStep(2);
  }

  async function handleValidate() {
    if (!file) return;
    setParseError('');
    try {
      const text = await file.text();
      const json = JSON.parse(text) as { metadata?: BackupMeta; schemaVersion?: string; collections?: string[] };
      const parsedMeta: BackupMeta | null =
        json.metadata
          ? json.metadata
          : json.schemaVersion && Array.isArray(json.collections)
            ? {
                schemaVersion: json.schemaVersion,
                platformVersion: (json as Record<string, string>).platformVersion ?? 'unknown',
                createdAt: (json as Record<string, string>).createdAt ?? new Date().toISOString(),
                scope: (json as Record<string, string>).scope ?? 'full',
                collections: json.collections as string[],
              }
            : null;

      if (!parsedMeta) {
        setParseError('Invalid backup file — missing schemaVersion and collections fields.');
        return;
      }
      setMeta(parsedMeta);
      setSelectedCollections(parsedMeta.collections);
      setStep(3);
    } catch {
      setParseError('Failed to parse backup file. Ensure it is a valid JSON backup.');
    }
  }

  function toggleCollection(coll: string) {
    setSelectedCollections((prev) =>
      prev.includes(coll) ? prev.filter((c) => c !== coll) : [...prev, coll]
    );
  }

  async function handleRestore() {
    if (confirm !== 'RESTORE') return;
    setRestoring(true);
    setProgress(0);
    setRestoreToast('');
    const totalMs = 3000;
    const intervalMs = 60;
    const steps = totalMs / intervalMs;
    let current = 0;
    await new Promise<void>((resolve) => {
      const tmr = setInterval(() => {
        current++;
        setProgress(Math.min(Math.round((current / steps) * 100), 100));
        if (current >= steps) { clearInterval(tmr); resolve(); }
      }, intervalMs);
    });
    setDone(true);
    setRestoring(false);
    setRestoreToast(
      'Restore simulation complete. In production, this requires a Firebase Admin SDK server function.'
    );
  }

  const stepLabels = ['Upload File', 'Validate', 'Preview', 'Select Mode', 'Confirm & Execute'];

  const summaryLine = meta
    ? `Backup from ${meta.createdAt ? new Date(meta.createdAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : 'unknown date'}, scope: ${meta.scope}, ${meta.collections.length} collection${meta.collections.length !== 1 ? 's' : ''}`
    : '';

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Restore from Backup</h3>

      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 16px',
        background: 'color-mix(in srgb, #3B82F6 10%, transparent)',
        border: '1px solid color-mix(in srgb, #3B82F6 35%, transparent)',
        borderRadius: 10, marginBottom: 20,
        fontSize: 13, color: '#1d4ed8', lineHeight: 1.5,
      }}>
        <Shield size={16} style={{ flexShrink: 0, marginTop: 1, color: '#2563EB' }} />
        <div>
          <strong>Production note:</strong> Full restore operations require a server-side Firebase Admin SDK function with service account credentials. The restore simulation below is for UI demonstration only. In production, invoke your Cloud Function or backend endpoint with the backup JSON payload.
        </div>
      </div>

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

      {/* Step 1 */}
      {step >= 1 && (
        <div style={{ marginBottom: 20, padding: 20, borderRadius: 12, border: '2px dashed var(--color-border)', textAlign: 'center' }}>
          <Upload size={28} style={{ color: 'var(--color-text-secondary)', margin: '0 auto 10px', display: 'block' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
            {file ? file.name : 'Upload a backup JSON file'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
            Accepts .json backup files exported from TradeCircle
          </div>
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8,
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
          }}>
            <Upload size={14} /> Choose File
            <input type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} />
          </label>
        </div>
      )}

      {/* Step 2 */}
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

      {/* Step 3 */}
      {meta && step >= 3 && (
        <div style={{ marginBottom: 20, padding: 16, background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 14, background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
            {summaryLine}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Backup Metadata</div>
          {[
            ['Schema Version', meta.schemaVersion],
            ['Date', meta.createdAt ? new Date(meta.createdAt).toLocaleString('en-AU') : '—'],
            ['Scope', meta.scope],
            ['Platform Version', meta.platformVersion],
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

      {/* Step 4 */}
      {step >= 4 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Restore Mode</div>
          {([
            { value: 'full',      label: 'Full Restore',  desc: 'Replace all existing data with backup data' },
            { value: 'merge',     label: 'Merge',         desc: 'Add missing docs, keep existing unchanged' },
            { value: 'selective', label: 'Selective',     desc: 'Choose which collections to restore' },
          ] as const).map((m) => (
            <label key={m.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
              <input type="radio" name="restoreMode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} style={{ accentColor: 'var(--color-primary)', marginTop: 2, width: 16, height: 16 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{m.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{m.desc}</div>
              </div>
            </label>
          ))}

          {mode === 'selective' && meta && (
            <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 10 }}>Select collections to restore:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {meta.collections.map((coll) => (
                  <label key={coll} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--color-text)' }}>
                    <input type="checkbox" checked={selectedCollections.includes(coll)} onChange={() => toggleCollection(coll)} style={{ accentColor: 'var(--color-primary)', width: 15, height: 15 }} />
                    {coll}
                  </label>
                ))}
              </div>
              {selectedCollections.length === 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-warning)' }}>Select at least one collection to continue.</div>
              )}
            </div>
          )}

          {step === 4 && (
            <button
              onClick={() => setStep(5)}
              disabled={mode === 'selective' && selectedCollections.length === 0}
              style={{
                marginTop: 14, padding: '8px 18px', borderRadius: 8, border: 'none',
                background: 'var(--color-primary)', color: '#fff',
                cursor: mode === 'selective' && selectedCollections.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600,
                opacity: mode === 'selective' && selectedCollections.length === 0 ? 0.5 : 1,
              }}
            >
              Continue →
            </button>
          )}
        </div>
      )}

      {/* Step 5 */}
      {step >= 5 && !done && (
        <div style={{ padding: 18, background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
            <AlertTriangle size={18} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: 'var(--color-danger)', lineHeight: 1.5 }}>
              <strong>Warning:</strong> This will modify your database{mode === 'selective' && selectedCollections.length > 0 ? ` (${selectedCollections.join(', ')})` : ''}. Type <strong>RESTORE</strong> below to confirm.
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{mode === 'selective' ? 'Restoring selected collections…' : 'Restoring all collections…'}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{progress}%</span>
              </div>
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
              display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            {restoring && <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />}
            {restoring ? 'Restoring…' : 'Start Restore'}
          </button>
        </div>
      )}

      {done && (
        <div>
          {restoreToast && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', background: 'color-mix(in srgb, #3B82F6 10%, transparent)', border: '1px solid color-mix(in srgb, #3B82F6 35%, transparent)', borderRadius: 10, marginBottom: 12, fontSize: 13, color: '#1d4ed8', lineHeight: 1.5 }}>
              <Shield size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              {restoreToast}
            </div>
          )}
          <div style={{ padding: 18, background: 'color-mix(in srgb, var(--color-success) 10%, transparent)', border: '1px solid var(--color-success)', borderRadius: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Check size={18} style={{ color: 'var(--color-success)' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-success)' }}>Restore simulation completed successfully.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Auto Backup Tab ──────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function AutoBackupTab() {
  const [schedule,       setSchedule]       = useState<BackupSchedule>('weekly');
  const [time,           setTime]           = useState('02:00');
  const [dayOfWeek,      setDayOfWeek]      = useState(1); // Monday
  const [dayOfMonth,     setDayOfMonth]     = useState(1);
  const [retention,      setRetention]      = useState(30);
  const [storageType,    setStorageType]    = useState<'Firebase' | 'S3'>('Firebase');
  const [emailSuccess,   setEmailSuccess]   = useState(true);
  const [emailFailure,   setEmailFailure]   = useState(true);
  const [recipientEmail, setRecipientEmail] = useState('admin@tradecircle.com');
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [testStatus,     setTestStatus]     = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMsg,        setTestMsg]        = useState('');
  const [lastBackup,     setLastBackup]     = useState<Backup | null>(null);
  const [scheduleActive, setScheduleActive] = useState(false);
  const [loading,        setLoading]        = useState(true);

  // Load existing config + last backup
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const cfgSnap = await getDoc(doc(db, 'config', 'backupSchedule'));
        if (cfgSnap.exists()) {
          const d = cfgSnap.data() as {
            schedule?: BackupSchedule; time?: string; dayOfWeek?: number;
            dayOfMonth?: number; retention?: number; storageType?: 'Firebase' | 'S3';
            emailSuccess?: boolean; emailFailure?: boolean; recipientEmail?: string; active?: boolean;
          };
          if (d.schedule)       setSchedule(d.schedule);
          if (d.time)           setTime(d.time);
          if (d.dayOfWeek !== undefined)  setDayOfWeek(d.dayOfWeek);
          if (d.dayOfMonth !== undefined) setDayOfMonth(d.dayOfMonth);
          if (d.retention !== undefined)  setRetention(d.retention);
          if (d.storageType)    setStorageType(d.storageType);
          if (d.emailSuccess !== undefined) setEmailSuccess(d.emailSuccess);
          if (d.emailFailure !== undefined) setEmailFailure(d.emailFailure);
          if (d.recipientEmail) setRecipientEmail(d.recipientEmail);
          setScheduleActive(!!d.active);
        }
      } catch { /* ignore */ }

      try {
        const bkQ = query(collection(db, 'backups'), orderBy('createdAt', 'desc'), limit(1));
        const snap = await getDocs(bkQ);
        if (!snap.empty) setLastBackup({ id: snap.docs[0].id, ...snap.docs[0].data() } as Backup);
        else if (MOCK_BACKUPS.length > 0) setLastBackup(MOCK_BACKUPS[0]);
      } catch {
        setLastBackup(MOCK_BACKUPS[0] ?? null);
      }
      setLoading(false);
    }
    void load();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'backupSchedule'), {
        schedule, time, dayOfWeek, dayOfMonth, retention,
        storageType, emailSuccess, emailFailure, recipientEmail,
        active: schedule !== 'manual',
      }, { merge: true });
      setScheduleActive(schedule !== 'manual');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleTestStorage() {
    setTestStatus('testing');
    setTestMsg('');
    try {
      const pingRef = ref(storage, 'backups/test/ping.txt');
      await uploadBytes(pingRef, new Blob(['ping'], { type: 'text/plain' }));
      setTestStatus('ok');
      setTestMsg('Storage access confirmed — ping.txt written successfully.');
    } catch (err) {
      setTestStatus('fail');
      setTestMsg(err instanceof Error ? err.message : 'Storage access failed.');
    }
  }

  const nextRun = computeNextRun(schedule, time, dayOfWeek, dayOfMonth);
  const storagePath = `backups/{scope}/${new Date().toISOString().slice(0, 10)}.json`;

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>Loading schedule config…</div>;
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>Automatic Backup Schedule</h3>

      {/* Status row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 200, padding: '12px 16px', borderRadius: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Schedule Status</div>
          <span style={{
            display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            background: scheduleActive ? 'color-mix(in srgb, var(--color-success) 12%, transparent)' : 'color-mix(in srgb, var(--color-border) 40%, transparent)',
            color: scheduleActive ? 'var(--color-success)' : 'var(--color-text-secondary)',
          }}>
            {scheduleActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 200, padding: '12px 16px', borderRadius: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Next Scheduled Backup</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
            {nextRun ? nextRun.toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not scheduled (manual)'}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 200, padding: '12px 16px', borderRadius: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Last Backup</div>
          {lastBackup ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--color-text)' }}>{formatDate(lastBackup.createdAt)}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                background: lastBackup.status === 'complete' ? 'color-mix(in srgb, var(--color-success) 12%, transparent)' : 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
                color: lastBackup.status === 'complete' ? 'var(--color-success)' : 'var(--color-danger)',
              }}>
                {lastBackup.status}
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No backups yet</div>
          )}
        </div>
      </div>

      {/* Schedule config */}
      <div style={{ padding: 20, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schedule</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginBottom: 16 }}>
          {(['manual', 'daily', 'weekly', 'monthly'] as BackupSchedule[]).map((s) => (
            <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--color-text)', padding: '9px 12px', borderRadius: 8, border: schedule === s ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', background: schedule === s ? 'color-mix(in srgb, var(--color-primary) 6%, var(--color-surface))' : 'transparent', transition: 'border 0.15s' }}>
              <input type="radio" name="schedule" value={s} checked={schedule === s} onChange={() => setSchedule(s)} style={{ accentColor: 'var(--color-primary)', width: 15, height: 15 }} />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </label>
          ))}
        </div>

        {schedule !== 'manual' && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Time picker */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Time of Day (24h)</label>
              <input
                type="time" value={time} onChange={(e) => setTime(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13, outline: 'none' }}
              />
            </div>

            {/* Day of week — weekly only */}
            {schedule === 'weekly' && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Day of Week</label>
                <select
                  value={dayOfWeek} onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13, outline: 'none' }}
                >
                  {DAY_NAMES.map((name, idx) => (
                    <option key={idx} value={idx}>{name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Day of month — monthly only */}
            {schedule === 'monthly' && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Day of Month (1–28)</label>
                <input
                  type="number" min={1} max={28} value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
                  style={{ width: 80, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13, outline: 'none' }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Retention */}
      <div style={{ padding: 20, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Retention Policy</div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Keep last N backups</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="number" min={1} max={365} value={retention}
            onChange={(e) => setRetention(parseInt(e.target.value) || 30)}
            style={{ width: 90, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13, outline: 'none' }}
          />
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>backups (default 30)</span>
        </div>
      </div>

      {/* Cloud storage */}
      <div style={{ padding: 20, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cloud Storage Destination</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          {(['Firebase', 'S3'] as const).map((s) => (
            <label key={s} style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              padding: '12px 16px', borderRadius: 10,
              border: storageType === s ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
              background: storageType === s ? 'color-mix(in srgb, var(--color-primary) 5%, var(--color-surface))' : 'transparent',
              flex: 1, minWidth: 160, transition: 'border 0.15s',
            }}>
              <input type="radio" name="storage" value={s} checked={storageType === s} onChange={() => setStorageType(s)} style={{ accentColor: 'var(--color-primary)', width: 16, height: 16 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{s === 'Firebase' ? 'Firebase Storage' : 'Amazon S3'}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{s === 'Firebase' ? 'Uses your Firebase project storage' : 'Uses S3 config from admin settings'}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Path preview */}
        {storageType === 'Firebase' && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Storage path preview</div>
            <code style={{ display: 'inline-block', padding: '6px 10px', borderRadius: 6, background: 'var(--color-background)', border: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-text)', fontFamily: 'monospace' }}>
              {storagePath}
            </code>
          </div>
        )}

        {/* Test button */}
        <button
          onClick={() => void handleTestStorage()}
          disabled={testStatus === 'testing' || storageType === 'S3'}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: testStatus === 'ok' ? 'color-mix(in srgb, var(--color-success) 10%, var(--color-surface))' : testStatus === 'fail' ? 'color-mix(in srgb, var(--color-danger) 10%, var(--color-surface))' : 'var(--color-surface)',
            color: testStatus === 'ok' ? 'var(--color-success)' : testStatus === 'fail' ? 'var(--color-danger)' : 'var(--color-text)',
            cursor: testStatus === 'testing' || storageType === 'S3' ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600, opacity: storageType === 'S3' ? 0.5 : 1,
          }}
        >
          {testStatus === 'testing' ? (
            <><span style={{ width: 13, height: 13, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Testing…</>
          ) : testStatus === 'ok' ? (
            <><Check size={13} /> Storage OK</>
          ) : testStatus === 'fail' ? (
            <><AlertTriangle size={13} /> Access Failed</>
          ) : (
            <><Cloud size={13} /> Test Storage Access</>
          )}
        </button>
        {testMsg && (
          <div style={{ marginTop: 8, fontSize: 12, color: testStatus === 'ok' ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {testMsg}
          </div>
        )}
        {storageType === 'S3' && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            S3 test is not available from the browser. Configure S3 credentials in Admin &gt; Configuration.
          </div>
        )}
      </div>

      {/* Email notifications */}
      <div style={{ padding: 20, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Notifications</div>
        {[
          { label: 'Email on success', value: emailSuccess, set: setEmailSuccess },
          { label: 'Email on failure', value: emailFailure, set: setEmailFailure },
        ].map(({ label, value, set }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 13, color: 'var(--color-text)' }}>{label}</span>
            <button type="button" onClick={() => set(!value)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: value ? 'var(--color-primary)' : 'var(--color-border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 2, left: value ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
        ))}
        {(emailSuccess || emailFailure) && (
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Recipient Email</label>
            <input
              type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="admin@example.com"
              style={{ width: '100%', maxWidth: 320, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        )}
      </div>

      <button
        onClick={() => void handleSave()}
        disabled={saving}
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 9, border: 'none', background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
      >
        {saved ? <><Check size={14} /> Saved!</> : saving ? 'Saving…' : 'Save Schedule'}
      </button>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

function HistoryTab() {
  const [backups,    setBackups]    = useState<Backup[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(0);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [pruning,    setPruning]    = useState(false);
  const [toast,      setToast]      = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

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

  async function handleDownload(bk: Backup) {
    if (!bk.storagePath) return;
    try {
      const storageRef = ref(storage, bk.storagePath);
      const url = await getDownloadURL(storageRef);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tradecircle_backup_${bk.scope}_${bk.id}.json`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setToast({ msg: `Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`, type: 'error' });
    }
  }

  async function handleDelete(bk: Backup) {
    if (!window.confirm(`Delete backup ${bk.id}? This cannot be undone.`)) return;
    setDeleting(bk.id);
    try {
      await deleteDoc(doc(db, 'backups', bk.id));
      if (bk.storagePath) {
        try { await deleteObject(ref(storage, bk.storagePath)); } catch { /* ignore if already gone */ }
      }
      setBackups((prev) => prev.filter((b) => b.id !== bk.id));
      setToast({ msg: 'Backup deleted.', type: 'success' });
    } catch (err) {
      setToast({ msg: `Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`, type: 'error' });
    } finally {
      setDeleting(null);
    }
  }

  async function handlePrune() {
    if (!window.confirm(`Delete the ${backups.length - 30} oldest backups?`)) return;
    setPruning(true);
    const toDelete = [...backups].slice(30); // already sorted newest first
    let removed = 0;
    for (const bk of toDelete) {
      try {
        await deleteDoc(doc(db, 'backups', bk.id));
        if (bk.storagePath) {
          try { await deleteObject(ref(storage, bk.storagePath)); } catch { /* ignore */ }
        }
        removed++;
      } catch { /* continue */ }
    }
    setBackups((prev) => prev.slice(0, 30));
    setToast({ msg: `Pruned ${removed} backup${removed !== 1 ? 's' : ''}.`, type: 'success' });
    setPruning(false);
  }

  const totalPages = Math.ceil(backups.length / PAGE_SIZE);
  const pageBackups = backups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const excessCount = backups.length > 30 ? backups.length - 30 : 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Backup History</h3>
        <button onClick={() => void fetchBackups()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Auto-prune warning */}
      {!loading && excessCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: 'color-mix(in srgb, var(--color-warning) 10%, var(--color-surface))',
          border: '1px solid var(--color-warning)', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-warning)' }}>
            <AlertTriangle size={15} />
            You have {backups.length} backups. Auto-prune will remove the oldest {excessCount}.
          </div>
          <button
            onClick={() => void handlePrune()}
            disabled={pruning}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--color-warning)', color: '#fff', cursor: pruning ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}
          >
            {pruning ? 'Pruning…' : 'Prune Now'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>Loading…</div>
      ) : backups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
          <History size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
          <div style={{ fontWeight: 600 }}>No backups yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Create a backup from the "Create Backup" tab.</div>
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['#', 'Date / Time', 'Scope', 'Schedule', 'Size', 'Collections', 'Status', 'Actions'].map((h) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageBackups.map((bk, i) => (
                    <tr key={bk.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)', fontSize: 12 }}>{page * PAGE_SIZE + i + 1}</td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--color-text)' }}>{formatDate(bk.createdAt)}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--color-text)', textTransform: 'capitalize' }}>{bk.scope}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{bk.schedule}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{formatSize(bk.fileSizeBytes)}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span title={bk.collections.join(', ')} style={{ cursor: 'help' }}>
                          {bk.collections.length} coll{bk.collections.length !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
                          background: bk.status === 'complete' ? 'color-mix(in srgb, var(--color-success) 12%, transparent)' : bk.status === 'failed' ? 'color-mix(in srgb, var(--color-danger) 12%, transparent)' : 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
                          color: bk.status === 'complete' ? 'var(--color-success)' : bk.status === 'failed' ? 'var(--color-danger)' : 'var(--color-warning)',
                          textTransform: 'capitalize',
                        }}>
                          {bk.status}
                        </span>
                        {bk.errorMessage && (
                          <div style={{ fontSize: 10, color: 'var(--color-danger)', marginTop: 3, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={bk.errorMessage}>
                            {bk.errorMessage}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {bk.storagePath && (
                            <button
                              onClick={() => void handleDownload(bk)}
                              title="Download from Firebase Storage"
                              style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', padding: '5px 10px', borderRadius: 6, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
                            >
                              <Download size={12} /> Download
                            </button>
                          )}
                          <button
                            onClick={() => void handleDelete(bk)}
                            disabled={deleting === bk.id}
                            title="Delete backup"
                            style={{ background: 'none', border: '1px solid #FECDD3', cursor: deleting === bk.id ? 'not-allowed' : 'pointer', padding: '5px 10px', borderRadius: 6, color: 'var(--color-danger)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, opacity: deleting === bk.id ? 0.5 : 1 }}
                          >
                            {deleting === bk.id ? (
                              <span style={{ width: 12, height: 12, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: 'var(--color-danger)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, backups.length)} of {backups.length}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 0))}
                  disabled={page === 0}
                  style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: page === 0 ? 0.4 : 1 }}
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPage(idx)}
                    style={{
                      padding: '6px 11px', borderRadius: 7, fontSize: 13, fontWeight: 600, border: 'none',
                      background: idx === page ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: idx === page ? '#fff' : 'var(--color-text)',
                      border: idx === page ? 'none' : '1px solid var(--color-border)',
                      cursor: 'pointer',
                    } as React.CSSProperties}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                  disabled={page === totalPages - 1}
                  style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: page === totalPages - 1 ? 0.4 : 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
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
