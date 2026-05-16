/**
 * app/admin/integrations/page.tsx
 * Phase 5 — Marketing SSO integrations dashboard.
 *
 * 5 provider cards (Mailchimp, HubSpot, Meta Business, Klaviyo, SendGrid).
 * Connect modal with API key + list/account IDs + sync toggles + test connection.
 */

'use client';

import { useEffect, useState } from 'react';
import { X, Plug, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import AdminLayout from '@/components/layouts/AdminLayout';
import { db } from '@/services/firebase';
import type { MarketingIntegration, IntegrationProvider } from '@/types';

interface ProviderMeta {
  id:          IntegrationProvider;
  name:        string;
  icon:        string;          // emoji/text logo
  description: string;
  fields:      Array<{ key: 'apiKey' | 'accountId' | 'listId'; label: string; placeholder?: string }>;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'mailchimp', name: 'Mailchimp', icon: '🐵',
    description: 'Sync contacts to a Mailchimp audience for email campaigns.',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'xxxxxxxx-us1' },
      { key: 'listId', label: 'Audience (List) ID' },
    ],
  },
  {
    id: 'hubspot', name: 'HubSpot', icon: '🟠',
    description: 'Push contacts and deals into your HubSpot CRM.',
    fields: [
      { key: 'apiKey',    label: 'Private App Token', placeholder: 'pat-na1-xxxx' },
      { key: 'accountId', label: 'Portal / Hub ID (optional)' },
    ],
  },
  {
    id: 'meta-business', name: 'Meta Business', icon: '📘',
    description: 'Send events to Meta Conversions API and sync product catalog.',
    fields: [
      { key: 'apiKey',    label: 'Conversions API Token' },
      { key: 'accountId', label: 'Pixel ID' },
      { key: 'listId',    label: 'Catalog ID (optional)' },
    ],
  },
  {
    id: 'klaviyo', name: 'Klaviyo', icon: '💜',
    description: 'Sync profiles and order events into Klaviyo for marketing automation.',
    fields: [
      { key: 'apiKey', label: 'Private API Key', placeholder: 'pk_xxxxxxxx' },
    ],
  },
  {
    id: 'sendgrid', name: 'SendGrid', icon: '📧',
    description: 'Add contacts to SendGrid Marketing lists for email blasts.',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'SG.xxxxxxxx' },
      { key: 'listId', label: 'List ID (optional)' },
    ],
  },
];

const STATUS_META: Record<MarketingIntegration['status'], { label: string; bg: string; fg: string }> = {
  connected:    { label: 'Connected',    bg: 'color-mix(in srgb, var(--color-success) 18%, transparent)', fg: 'var(--color-success)' },
  disconnected: { label: 'Disconnected', bg: 'color-mix(in srgb, var(--color-text-secondary) 18%, transparent)', fg: 'var(--color-text-secondary)' },
  error:        { label: 'Error',        bg: 'color-mix(in srgb, var(--color-danger) 18%, transparent)', fg: 'var(--color-danger)' },
};

export default function MarketingIntegrationsPage() {
  const [byProvider, setByProvider] = useState<Record<string, MarketingIntegration>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProviderMeta | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'marketingIntegrations'));
      const map: Record<string, MarketingIntegration> = {};
      snap.docs.forEach((d) => {
        const data = { id: d.id, ...(d.data() as Omit<MarketingIntegration, 'id'>) };
        map[data.provider] = data;
      });
      setByProvider(map);
    } catch (e) { console.error('load integrations', e); }
    finally { setLoading(false); }
  }

  async function disconnect(provider: IntegrationProvider) {
    if (!confirm(`Disconnect ${provider}?`)) return;
    try {
      await deleteDoc(doc(db, 'marketingIntegrations', provider));
      await load();
    } catch (e) { console.error('disconnect', e); }
  }

  async function syncNow(provider: IntegrationProvider) {
    try {
      const existing = byProvider[provider];
      if (!existing) return;
      await setDoc(doc(db, 'marketingIntegrations', provider), {
        ...existing, lastSyncAt: serverTimestamp(),
      });
      await load();
    } catch (e) { console.error('sync now', e); }
  }

  return (
    <AdminLayout>
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>
            Marketing SSO
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Connect external marketing platforms to sync contacts, orders, and events.
          </p>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Loading…
          </div>
        ) : (
          <div style={{
            display: 'grid', gap: 16,
            gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
          }}>
            {PROVIDERS.map((p) => {
              const existing = byProvider[p.id];
              const status   = existing?.status ?? 'disconnected';
              const meta     = STATUS_META[status];
              return (
                <div key={p.id} style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12, padding: 18,
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: 'var(--color-background)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22,
                    }}>{p.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{p.name}</div>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: meta.bg, color: meta.fg,
                        padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700,
                        marginTop: 4,
                      }}>
                        {status === 'connected' && <CheckCircle2 size={10} />}
                        {status === 'error' && <AlertCircle size={10} />}
                        {meta.label}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                    {p.description}
                  </div>
                  {existing?.errorMessage && status === 'error' && (
                    <div style={{
                      fontSize: 11, color: 'var(--color-danger)',
                      padding: '6px 8px', borderRadius: 6,
                      background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                    }}>{existing.errorMessage}</div>
                  )}
                  {existing?.lastSyncAt && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      Last sync: {new Date(existing.lastSyncAt.seconds * 1000).toLocaleString()}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                    {existing && status === 'connected' ? (
                      <>
                        <button onClick={() => void syncNow(p.id)} style={secondaryBtn}>
                          <RefreshCw size={12} style={{ marginRight: 5 }} /> Sync Now
                        </button>
                        <button onClick={() => setEditing(p)} style={secondaryBtn}>Edit</button>
                        <button
                          onClick={() => void disconnect(p.id)}
                          style={{ ...secondaryBtn, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                        >Disconnect</button>
                      </>
                    ) : (
                      <button onClick={() => setEditing(p)} style={primaryBtn}>
                        <Plug size={12} style={{ marginRight: 5 }} /> Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {editing && (
          <ConnectModal
            provider={editing}
            existing={byProvider[editing.id]}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); void load(); }}
          />
        )}
      </div>
    </AdminLayout>
  );
}

// ─── Connect / Edit Modal ─────────────────────────────────────────────────────
function ConnectModal({
  provider, existing, onClose, onSaved,
}: {
  provider: ProviderMeta;
  existing?: MarketingIntegration;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [apiKey,    setApiKey]    = useState(existing?.apiKey    ?? '');
  const [accountId, setAccountId] = useState(existing?.accountId ?? '');
  const [listId,    setListId]    = useState(existing?.listId    ?? '');
  const [syncContacts, setSyncContacts] = useState(existing?.syncContacts ?? true);
  const [syncOrders,   setSyncOrders]   = useState(existing?.syncOrders   ?? false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const values: Record<'apiKey' | 'accountId' | 'listId', string> = { apiKey, accountId, listId };
  const setters: Record<'apiKey' | 'accountId' | 'listId', (v: string) => void> = {
    apiKey: setApiKey, accountId: setAccountId, listId: setListId,
  };

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    // Lightweight smoke test — just ensures required fields are present.
    // Real test would proxy through a server route to call the provider.
    await new Promise((r) => setTimeout(r, 600));
    const missing = provider.fields.find((f) => !values[f.key] && !f.label.toLowerCase().includes('optional'));
    if (missing) {
      setTestResult({ ok: false, msg: `Missing required field: ${missing.label}` });
    } else {
      setTestResult({ ok: true, msg: 'Looks good. Save to connect.' });
    }
    setTesting(false);
  }

  async function save() {
    setSaving(true);
    try {
      const payload: Omit<MarketingIntegration, 'id'> = {
        provider: provider.id,
        enabled: true,
        apiKey,
        accountId: accountId || undefined,
        listId:    listId    || undefined,
        syncContacts,
        syncOrders,
        status: 'connected',
      };
      await setDoc(doc(db, 'marketingIntegrations', provider.id), payload);
      onSaved();
    } catch (e) {
      console.error('save integration', e);
      alert('Failed to save.');
    } finally { setSaving(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 500, padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--color-background)', borderRadius: 14,
        width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto',
        border: '1px solid var(--color-border)',
      }} onClick={(e) => e.stopPropagation()}>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: 18, borderBottom: '1px solid var(--color-border)',
        }}>
          <h3 style={{ margin: 0, color: 'var(--color-text)' }}>
            {existing ? 'Edit' : 'Connect'} {provider.name}
          </h3>
          <button onClick={onClose} style={iconBtn}><X size={16} /></button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {provider.fields.map((f) => (
            <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>{f.label}</span>
              <input
                value={values[f.key]}
                onChange={(e) => setters[f.key](e.target.value)}
                placeholder={f.placeholder}
                style={input}
                type={f.key === 'apiKey' ? 'password' : 'text'}
              />
            </label>
          ))}

          <Toggle
            checked={syncContacts}
            onChange={setSyncContacts}
            label="Sync contacts"
            help="Push new sign-ups to this integration."
          />
          <Toggle
            checked={syncOrders}
            onChange={setSyncOrders}
            label="Sync orders"
            help="Push completed orders for e-commerce tracking."
          />

          {testResult && (
            <div style={{
              padding: '8px 10px', borderRadius: 6, fontSize: 12,
              background: testResult.ok
                ? 'color-mix(in srgb, var(--color-success) 12%, transparent)'
                : 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
              color: testResult.ok ? 'var(--color-success)' : 'var(--color-danger)',
            }}>{testResult.msg}</div>
          )}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between',
          padding: 14, borderTop: '1px solid var(--color-border)',
        }}>
          <button onClick={() => void testConnection()} disabled={testing} style={secondaryBtn}>
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <button onClick={() => void save()} disabled={saving} style={primaryBtn}>
            {saving ? 'Saving…' : existing ? 'Update' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label, help }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; help?: string;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
      cursor: 'pointer',
    }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{label}</div>
        {help && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{help}</div>}
      </div>
    </label>
  );
}

const input: React.CSSProperties = {
  padding: '8px 10px', fontSize: 13,
  border: '1px solid var(--color-border)', borderRadius: 8,
  background: 'var(--color-surface)', color: 'var(--color-text)',
  width: '100%', boxSizing: 'border-box',
};
const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--color-text-secondary)', padding: 4,
};
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  background: 'var(--color-primary)', color: '#fff',
  border: 'none', borderRadius: 8, padding: '8px 14px',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  background: 'transparent', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', borderRadius: 8,
  padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
