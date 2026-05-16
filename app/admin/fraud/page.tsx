/**
 * app/admin/fraud/page.tsx
 * Admin fraud flags management page.
 * Spec ref: Phase 3 — Fraud Detection
 *
 * Features:
 *  - Stats bar: Open, High Severity, Reviewed Today
 *  - Filterable table of fraud flags
 *  - Side panel: full details + notes + Mark Reviewed / Dismiss
 *  - "Run Scan" modal: scan top-20 products or users with progress counter
 *  - Empty state when no flags exist
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { AlertTriangle, ExternalLink, X, Loader2, ShieldCheck, RefreshCw } from 'lucide-react';
import { db }          from '@/services/firebase';
import AdminLayout     from '@/components/layouts/AdminLayout';
import { useAuthStore } from '@/store/authStore';
import type { FraudFlag, FraudSeverity, FraudFlagStatus } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'open' | 'high' | 'reviewed';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function isToday(ts: Timestamp): boolean {
  const d = ts.toDate();
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth()    === now.getMonth()    &&
         d.getDate()     === now.getDate();
}

function targetLink(flag: FraudFlag): string {
  if (flag.targetType === 'product') return `/products/${flag.targetId}`;
  if (flag.targetType === 'user')    return `/admin/users?id=${flag.targetId}`;
  return '#';
}

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: FraudSeverity }) {
  const styles: Record<FraudSeverity, { bg: string; color: string; label: string }> = {
    high:   { bg: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',   color: 'var(--color-danger)',   label: 'High'   },
    medium: { bg: 'color-mix(in srgb, var(--color-warning) 18%, transparent)',  color: '#b45309',               label: 'Medium' },
    low:    { bg: 'color-mix(in srgb, #eab308 15%, transparent)',               color: '#854d0e',               label: 'Low'    },
  };
  const s = styles[severity];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
      backgroundColor: s.bg, color: s.color, textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FraudFlagStatus }) {
  const map: Record<FraudFlagStatus, { bg: string; color: string }> = {
    open:      { bg: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',   color: 'var(--color-danger)'   },
    reviewed:  { bg: 'color-mix(in srgb, var(--color-success) 12%, transparent)',  color: 'var(--color-success)'  },
    dismissed: { bg: 'color-mix(in srgb, var(--color-text) 8%, transparent)',      color: 'var(--color-text-secondary)' },
  };
  const s = map[status];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 600,
      backgroundColor: s.bg, color: s.color, textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 140,
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 12, padding: '16px 20px',
    }}>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: accent ?? 'var(--color-text)' }}>
        {value}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>{label}</p>
    </div>
  );
}

// ─── Side panel ───────────────────────────────────────────────────────────────

function ReviewPanel({
  flag,
  onClose,
  onUpdate,
}: {
  flag: FraudFlag;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const { user }                  = useAuthStore();
  const [notes,   setNotes]       = useState(flag.notes ?? '');
  const [saving,  setSaving]      = useState(false);
  const [error,   setError]       = useState('');

  async function handleAction(newStatus: 'reviewed' | 'dismissed') {
    setSaving(true);
    setError('');
    try {
      await updateDoc(doc(db, 'fraudFlags', flag.id), {
        status:     newStatus,
        reviewedBy: user?.email ?? 'admin',
        reviewedAt: serverTimestamp(),
        notes,
      });
      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update flag.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.35)', zIndex: 400,
        }}
      />

      {/* Panel */}
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420, maxWidth: '100vw',
        background: 'var(--color-background)',
        borderLeft: '1px solid var(--color-border)',
        zIndex: 401,
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border)',
          position: 'sticky', top: 0,
          background: 'var(--color-background)',
          zIndex: 1,
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
            Flag Details
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Target</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>
              {flag.targetName}
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 400, marginLeft: 8 }}>
                ({flag.targetType})
              </span>
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Severity</p>
              <SeverityBadge severity={flag.severity} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</p>
              <StatusBadge status={flag.status} />
            </div>
          </div>

          <div>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI Reason</p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text)', lineHeight: 1.6, background: 'var(--color-surface)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
              {flag.reason}
            </p>
          </div>

          <div>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Detected</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text)' }}>{formatDate(flag.detectedAt)}</p>
          </div>

          {flag.reviewedBy && (
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reviewed by</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text)' }}>{flag.reviewedBy} · {formatDate(flag.reviewedAt)}</p>
            </div>
          )}

          <div>
            <a
              href={targetLink(flag)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500,
              }}
            >
              <ExternalLink size={13} />
              View {flag.targetType === 'product' ? 'product' : 'user'} page
            </a>
          </div>

          {/* Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
              Admin Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add notes about this flag…"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: 8, border: '1.5px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: 13, resize: 'vertical', outline: 'none',
              }}
            />
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-danger)' }}>{error}</p>
          )}
        </div>

        {/* Actions */}
        {flag.status === 'open' && (
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex', gap: 10,
            background: 'var(--color-background)',
          }}>
            <button
              onClick={() => void handleAction('reviewed')}
              disabled={saving}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                background: 'var(--color-primary)', color: '#fff',
                fontWeight: 600, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldCheck size={14} />}
              Mark Reviewed
            </button>
            <button
              onClick={() => void handleAction('dismissed')}
              disabled={saving}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 8,
                border: '1.5px solid var(--color-border)',
                background: 'transparent', color: 'var(--color-text-secondary)',
                fontWeight: 500, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </aside>
    </>
  );
}

// ─── Run Scan Modal ───────────────────────────────────────────────────────────

function RunScanModal({ onClose, onScanComplete }: { onClose: () => void; onScanComplete: () => void }) {
  const [scanType,   setScanType]   = useState<'product' | 'user'>('product');
  const [scanning,   setScanning]   = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [results,    setResults]    = useState<Array<{ id: string; name: string; flagged: boolean }>>([]);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState('');
  const abortRef = useRef(false);

  async function startScan() {
    setScanning(true);
    setProgress(0);
    setResults([]);
    setDone(false);
    setError('');
    abortRef.current = false;

    try {
      // Fetch top-20 most recent items
      const collectionName = scanType === 'product' ? 'products' : 'users';
      const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const items = snap.docs.slice(0, 20).map((d) => ({
        id: d.id,
        name: (d.data() as Record<string, string>).name ?? (d.data() as Record<string, string>).email ?? d.id,
      }));

      const scanned: Array<{ id: string; name: string; flagged: boolean }> = [];

      for (let i = 0; i < items.length; i++) {
        if (abortRef.current) break;
        const item = items[i];
        try {
          const res = await fetch('/api/ai/fraud-scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: scanType, id: item.id }),
          });
          const data = await res.json() as { flagged?: boolean };
          scanned.push({ ...item, flagged: data.flagged ?? false });
        } catch {
          scanned.push({ ...item, flagged: false });
        }
        setProgress(i + 1);
        setResults([...scanned]);
      }

      setDone(true);
      onScanComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed.');
    } finally {
      setScanning(false);
    }
  }

  const flaggedCount = results.filter((r) => r.flagged).length;
  const total = Math.min(20, progress || 20);

  return (
    <>
      <div
        onClick={() => { if (!scanning) onClose(); }}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)', zIndex: 500,
        }}
      />
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        padding: 28,
        width: 440, maxWidth: 'calc(100vw - 32px)',
        zIndex: 501,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color="var(--color-warning)" />
            Run Fraud Scan
          </h2>
          {!scanning && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Scan type */}
        {!scanning && !done && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Select what to scan. The AI will analyse the 20 most recent items for fraud indicators.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['product', 'user'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setScanType(t)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8,
                    border: `1.5px solid ${scanType === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: scanType === t ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent',
                    color: scanType === t ? 'var(--color-primary)' : 'var(--color-text)',
                    fontWeight: scanType === t ? 600 : 400,
                    fontSize: 14, cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {t === 'product' ? 'Products' : 'Users'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Progress */}
        {scanning && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Scanning {scanType === 'product' ? 'products' : 'users'}…
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                {progress} / {total}
              </span>
            </div>
            {/* Progress bar */}
            <div style={{ height: 6, borderRadius: 99, background: 'var(--color-border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${total > 0 ? (progress / total) * 100 : 0}%`,
                background: 'var(--color-primary)',
                borderRadius: 99,
                transition: 'width 0.3s ease',
              }} />
            </div>
            {results.length > 0 && (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {flaggedCount} flag{flaggedCount !== 1 ? 's' : ''} found so far
              </p>
            )}
          </div>
        )}

        {/* Done summary */}
        {done && (
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 10, padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>
              Scan complete
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Scanned {progress} {scanType === 'product' ? 'products' : 'users'} —{' '}
              <strong style={{ color: flaggedCount > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {flaggedCount} flagged
              </strong>
            </p>
          </div>
        )}

        {error && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {!scanning && !done && (
            <>
              <button
                onClick={onClose}
                style={{
                  padding: '10px 20px', borderRadius: 8,
                  border: '1.5px solid var(--color-border)',
                  background: 'transparent', color: 'var(--color-text-secondary)',
                  fontWeight: 500, fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void startScan()}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none',
                  background: 'var(--color-primary)', color: '#fff',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >
                Start Scan
              </button>
            </>
          )}
          {done && (
            <button
              onClick={onClose}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: 'var(--color-primary)', color: '#fff',
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function FraudFlagsPage() {
  const [flags,        setFlags]        = useState<FraudFlag[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<FilterTab>('all');
  const [selectedFlag, setSelectedFlag] = useState<FraudFlag | null>(null);
  const [scanModal,    setScanModal]    = useState(false);

  // ── Subscribe to fraudFlags collection ──────────────────────────────────────
  const loadFlags = useCallback(() => {
    const q = query(collection(db, 'fraudFlags'), orderBy('detectedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FraudFlag));
      setFlags(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = loadFlags();
    return () => unsub();
  }, [loadFlags]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const openCount      = flags.filter((f) => f.status === 'open').length;
  const highCount      = flags.filter((f) => f.severity === 'high').length;
  const reviewedToday  = flags.filter(
    (f) => f.status === 'reviewed' && f.reviewedAt && isToday(f.reviewedAt as Timestamp),
  ).length;

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filtered = flags.filter((f) => {
    if (activeTab === 'open')     return f.status === 'open';
    if (activeTab === 'high')     return f.severity === 'high';
    if (activeTab === 'reviewed') return f.status === 'reviewed';
    return true;
  });

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all',      label: `All (${flags.length})`    },
    { key: 'open',     label: `Open (${openCount})`      },
    { key: 'high',     label: `High Severity (${highCount})` },
    { key: 'reviewed', label: 'Reviewed'                  },
  ];

  const inputStyle: React.CSSProperties = {
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    background: 'none',
    padding: '7px 14px',
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Page title + Run Scan button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={22} color="var(--color-warning)" />
          Fraud Flags
        </h1>
        <button
          onClick={() => setScanModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: 'var(--color-primary)', color: '#fff',
            fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} />
          Run Scan
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard label="Open Flags"      value={openCount}     accent="var(--color-danger)"  />
        <StatCard label="High Severity"   value={highCount}     accent="#b45309"              />
        <StatCard label="Reviewed Today"  value={reviewedToday} accent="var(--color-success)" />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              ...inputStyle,
              color: activeTab === t.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderColor: activeTab === t.key ? 'var(--color-primary)' : 'var(--color-border)',
              background: activeTab === t.key ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent',
              fontWeight: activeTab === t.key ? 600 : 500,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 10 }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Loading fraud flags…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 12,
        }}>
          <ShieldCheck size={40} style={{ color: 'var(--color-success)', marginBottom: 12 }} />
          <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>
            No fraud flags
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {activeTab === 'all'
              ? "Click 'Run Scan' to analyse your marketplace."
              : 'No flags match this filter.'}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['Target', 'Type', 'Severity', 'Reason', 'Detected', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((flag) => (
                <tr
                  key={flag.id}
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '11px 12px', fontWeight: 500, color: 'var(--color-text)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {flag.targetName}
                  </td>
                  <td style={{ padding: '11px 12px', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
                    {flag.targetType}
                  </td>
                  <td style={{ padding: '11px 12px' }}>
                    <SeverityBadge severity={flag.severity} />
                  </td>
                  <td style={{ padding: '11px 12px', color: 'var(--color-text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={flag.reason}>
                    {flag.reason}
                  </td>
                  <td style={{ padding: '11px 12px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatDate(flag.detectedAt)}
                  </td>
                  <td style={{ padding: '11px 12px' }}>
                    <StatusBadge status={flag.status} />
                  </td>
                  <td style={{ padding: '11px 12px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        onClick={() => setSelectedFlag(flag)}
                        style={{
                          padding: '5px 12px', borderRadius: 6, border: '1.5px solid var(--color-border)',
                          background: 'transparent', color: 'var(--color-text)',
                          fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        }}
                      >
                        Review
                      </button>
                      <a
                        href={targetLink(flag)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}
                        title="View target page"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Side panel */}
      {selectedFlag && (
        <ReviewPanel
          flag={selectedFlag}
          onClose={() => setSelectedFlag(null)}
          onUpdate={() => setSelectedFlag(null)}
        />
      )}

      {/* Run Scan modal */}
      {scanModal && (
        <RunScanModal
          onClose={() => setScanModal(false)}
          onScanComplete={() => { /* real-time listener handles refresh */ }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function FraudPage() {
  return (
    <AdminLayout>
      <FraudFlagsPage />
    </AdminLayout>
  );
}
