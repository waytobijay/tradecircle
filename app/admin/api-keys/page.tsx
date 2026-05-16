/**
 * app/admin/api-keys/page.tsx
 * Phase 4 — API key marketplace management.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  collection, getDocs, addDoc, updateDoc, doc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { Plus, X, Key, Copy, Check, BookOpen, AlertTriangle } from 'lucide-react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { db } from '@/services/firebase';
import type { ApiKey, ApiKeyScope } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const SCOPE_OPTIONS: { value: ApiKeyScope; label: string; desc: string }[] = [
  { value: 'read-products',  label: 'Read Products',  desc: 'List and view products' },
  { value: 'write-products', label: 'Write Products', desc: 'Create/update/delete products' },
  { value: 'read-orders',    label: 'Read Orders',    desc: 'View order data' },
  { value: 'read-users',     label: 'Read Users',     desc: 'View user profiles' },
  { value: 'webhooks',       label: 'Webhooks',       desc: 'Subscribe to event webhooks' },
];

const SCOPE_COLORS: Record<ApiKeyScope, { bg: string; color: string }> = {
  'read-products':  { bg: '#EFF6FF', color: '#1D4ED8' },
  'write-products': { bg: '#FEF2F2', color: '#DC2626' },
  'read-orders':    { bg: '#F0FDF4', color: '#16A34A' },
  'read-users':     { bg: '#FFF7ED', color: '#C2410C' },
  'webhooks':       { bg: '#F5F3FF', color: '#7C3AED' },
};

// ─── Crypto helpers ──────────────────────────────────────────────────────────

function generateKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `tc_live_${hex}`;
}

async function hashKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function formatDate(ts: { seconds: number } | null | undefined): string {
  if (!ts) return 'Never';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─── Generate Key Modal ──────────────────────────────────────────────────────

interface GenerateModalProps {
  onClose: () => void;
  onGenerated: (fullKey: string) => void;
}

function GenerateKeyModal({ onClose, onGenerated }: GenerateModalProps) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>(['read-products']);
  const [rateLimit, setRateLimit] = useState(100);
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggleScope(s: ApiKeyScope) {
    setScopes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }
    if (scopes.length === 0) { setError('Select at least one scope.'); return; }
    setSaving(true);
    try {
      const fullKey = generateKey();
      const keyHash = await hashKey(fullKey);
      const prefix = fullKey.slice(0, 12); // "tc_live_xxxx"
      await addDoc(collection(db, 'apiKeys'), {
        name: name.trim(),
        ownerUid: '',
        keyHash,
        prefix,
        scopes,
        rateLimit,
        usageCount: 0,
        revoked: false,
        createdAt: serverTimestamp(),
        ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
      });
      onGenerated(fullKey);
    } catch (err) {
      console.error(err);
      setError('Failed to generate API key.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--color-border)', fontSize: 13,
    background: 'var(--color-background)', color: 'var(--color-text)',
    outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)', overflowY: 'auto', padding: '40px 16px',
    }}>
      <div style={{
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 14, padding: 28, maxWidth: 560, width: '100%',
        boxShadow: '0 16px 48px rgba(0,0,0,0.16)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
            Generate New API Key
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-secondary)', padding: 4,
          }}><X size={18} /></button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
              Name *
            </label>
            <input style={inputStyle} value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Backend" required />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--color-text-secondary)' }}>
              Scopes *
            </label>
            <div style={{
              padding: 14, borderRadius: 8,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {SCOPE_OPTIONS.map((s) => (
                <label key={s.value} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  cursor: 'pointer', fontSize: 13, color: 'var(--color-text)',
                }}>
                  <input type="checkbox" checked={scopes.includes(s.value)}
                    onChange={() => toggleScope(s.value)}
                    style={{ accentColor: 'var(--color-primary)', width: 14, height: 14, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{s.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
              Rate Limit: <strong>{rateLimit} req/min</strong>
            </label>
            <input type="range" min={10} max={1000} step={10} value={rateLimit}
              onChange={(e) => setRateLimit(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--color-primary)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-secondary)' }}>
              <span>10</span><span>1000</span>
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
              Expiration Date (optional)
            </label>
            <input type="date" style={inputStyle} value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)} />
          </div>

          {error && (
            <div style={{
              marginBottom: 14, padding: '9px 12px', borderRadius: 8,
              background: '#FFF1F2', border: '1px solid #FECDD3',
              color: 'var(--color-danger)', fontSize: 13,
            }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              padding: '9px 18px', borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text)',
            }}>Cancel</button>
            <button type="submit" disabled={saving} style={{
              padding: '9px 22px', borderRadius: 8, border: 'none',
              background: 'var(--color-primary)', color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Generating…' : 'Generate Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Key Reveal Modal ────────────────────────────────────────────────────────

function KeyRevealModal({ fullKey, onClose }: { fullKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(fullKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {/* ignore */}
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)', padding: 16,
    }}>
      <div style={{
        background: '#F0FDF4',
        border: '2px solid var(--color-success)',
        borderRadius: 14, padding: 28, maxWidth: 560, width: '100%',
        boxShadow: '0 16px 48px rgba(0,0,0,0.16)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Check size={22} style={{ color: 'var(--color-success)' }} />
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#15803D' }}>
            API Key Generated
          </h3>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '11px 12px', borderRadius: 8,
          background: '#fff', border: '1px solid #BBF7D0',
          marginBottom: 14,
        }}>
          <code style={{
            flex: 1, fontFamily: 'monospace', fontSize: 13,
            color: '#15803D', overflowWrap: 'anywhere',
          }}>{fullKey}</code>
          <button onClick={() => void copyToClipboard()} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 7, border: 'none',
            background: 'var(--color-success)', color: '#fff',
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}>
            {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
        </div>

        <div style={{
          display: 'flex', gap: 10, padding: '10px 12px',
          background: '#FEF3C7', border: '1px solid #FDE68A',
          borderRadius: 8, marginBottom: 20,
        }}>
          <AlertTriangle size={16} style={{ color: '#B45309', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
            <strong>Save this key now. You won't see it again.</strong> The key is hashed in our database and cannot be recovered.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '9px 22px', borderRadius: 8, border: 'none',
            background: 'var(--color-success)', color: '#fff',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>I've saved it</button>
        </div>
      </div>
    </div>
  );
}

// ─── Revoke Confirmation Modal ───────────────────────────────────────────────

function RevokeModal({
  apiKey, onConfirm, onCancel,
}: { apiKey: ApiKey; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)',
    }}>
      <div style={{
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 14, padding: 28, maxWidth: 400, width: '90%',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--color-text)' }}>
          Revoke API Key
        </h3>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 24 }}>
          Revoke <strong>{apiKey.name}</strong>? Any service using this key will lose access immediately.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '9px 18px', borderRadius: 8, border: '1px solid var(--color-border)',
            background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text)',
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: 'var(--color-danger)', color: '#fff',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>Revoke</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [error, setError] = useState('');

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = query(
        collection(db, 'apiKeys'),
        where('revoked', '==', false),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ApiKey, 'id'>) }));
      setKeys(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load API keys.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchKeys(); }, [fetchKeys]);

  async function handleRevoke(k: ApiKey) {
    try {
      await updateDoc(doc(db, 'apiKeys', k.id), { revoked: true });
      setKeys((prev) => prev.filter((x) => x.id !== k.id));
      setRevokeTarget(null);
    } catch {
      setError('Failed to revoke key.');
    }
  }

  return (
    <AdminLayout>
      <style>{`
        .adm-ak-table { width: 100%; border-collapse: collapse; }
        .adm-ak-table th {
          text-align: left; font-size: 11px; font-weight: 600;
          letter-spacing: 0.05em; color: var(--color-text-secondary);
          text-transform: uppercase; padding: 10px 16px;
          border-bottom: 1px solid var(--color-border); white-space: nowrap;
        }
        .adm-ak-table td {
          font-size: 13px; padding: 14px 16px;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text); vertical-align: middle;
        }
        .adm-ak-table tr:last-child td { border-bottom: none; }
        .adm-ak-table tbody tr:hover td { background: var(--color-surface); }
      `}</style>

      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
            API Keys
          </h2>
          <button onClick={() => setModalOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 9, border: 'none',
            background: 'var(--color-primary)', color: '#fff',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            <Plus size={15} /> Generate New Key
          </button>
        </div>

        {error && (
          <div style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 8,
            background: '#FFF1F2', border: '1px solid #FECDD3',
            color: 'var(--color-danger)', fontSize: 13,
          }}>{error}</div>
        )}

        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12, overflow: 'hidden', marginBottom: 20,
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-ak-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Scopes</th>
                  <th>Rate Limit</th>
                  <th>Usage</th>
                  <th>Last Used</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-secondary)' }}>Loading…</td></tr>
                ) : keys.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-secondary)' }}>
                      <Key size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>No API keys yet</div>
                      <div style={{ fontSize: 12 }}>Generate a key to start integrating with the TradeCircle API.</div>
                    </td>
                  </tr>
                ) : (
                  keys.map((k) => (
                    <tr key={k.id}>
                      <td style={{ fontWeight: 600 }}>{k.name}</td>
                      <td>
                        <code style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          {k.prefix}…
                        </code>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {k.scopes.map((s) => {
                            const c = SCOPE_COLORS[s];
                            return (
                              <span key={s} style={{
                                fontSize: 10, fontWeight: 600,
                                padding: '2px 7px', borderRadius: 9999,
                                background: c.bg, color: c.color,
                              }}>{s}</span>
                            );
                          })}
                        </div>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{k.rateLimit}/min</td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{k.usageCount?.toLocaleString() ?? 0}</td>
                      <td style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(k.lastUsedAt)}</td>
                      <td>
                        <button onClick={() => setRevokeTarget(k)} style={{
                          padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                          border: '1px solid #FECDD3', background: 'none', cursor: 'pointer',
                          color: 'var(--color-danger)',
                        }}>Revoke</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Documentation panel */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12, padding: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-primary)', flexShrink: 0,
            }}>
              <BookOpen size={20} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                API Documentation
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Endpoints, authentication, rate limits, and code examples.
              </div>
            </div>
          </div>
          <Link href="/admin/api-keys/docs" style={{
            padding: '9px 18px', borderRadius: 9,
            background: 'var(--color-primary)', color: '#fff',
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>API Docs →</Link>
        </div>
      </div>

      {modalOpen && (
        <GenerateKeyModal
          onClose={() => setModalOpen(false)}
          onGenerated={(k) => { setModalOpen(false); setRevealKey(k); void fetchKeys(); }}
        />
      )}
      {revealKey && (
        <KeyRevealModal fullKey={revealKey} onClose={() => setRevealKey(null)} />
      )}
      {revokeTarget && (
        <RevokeModal
          apiKey={revokeTarget}
          onConfirm={() => void handleRevoke(revokeTarget)}
          onCancel={() => setRevokeTarget(null)}
        />
      )}
    </AdminLayout>
  );
}
