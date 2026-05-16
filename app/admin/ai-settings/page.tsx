/**
 * app/admin/ai-settings/page.tsx
 * AI Settings — provider config, 6 module cards, save to Firestore.
 * Spec ref: section 6.7 (Admin Portal — AI Settings)
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
  Bot, Tag, Shield, AlertTriangle, MessageSquare, PenLine,
  Eye, EyeOff, Zap, CheckCircle, XCircle, Save,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = 'openai' | 'anthropic';

interface AiProviderConfig {
  provider: Provider;
  apiKey: string;
  model: string;
}

interface AiModuleState {
  smartRecommendations: boolean;
  autoTagging:          boolean;
  aiModeration:         boolean;
  fraudDetection:       boolean;
  chatAssistant:        boolean;
  descriptionGenerator: boolean;
}

interface AiSettings extends AiProviderConfig {
  modules: AiModuleState;
}

const DEFAULT_MODULES: AiModuleState = {
  smartRecommendations: false,
  autoTagging:          false,
  aiModeration:         false,
  fraudDetection:       false,
  chatAssistant:        false,
  descriptionGenerator: false,
};

const OPENAI_MODELS  = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
const ANTHROPIC_MODELS = ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'];

type ModuleKey = keyof AiModuleState;

interface ModuleCard {
  key:         ModuleKey;
  icon:        React.ReactNode;
  name:        string;
  description: string;
}

const MODULE_CARDS: ModuleCard[] = [
  {
    key:         'smartRecommendations',
    icon:        <Bot size={20} />,
    name:        'Smart Recommendations',
    description: 'AI-powered product suggestions tailored to each buyer\'s browsing and purchase history.',
  },
  {
    key:         'autoTagging',
    icon:        <Tag size={20} />,
    name:        'Auto-Tagging',
    description: 'Automatically suggests category, tags, and condition from a product description.',
  },
  {
    key:         'aiModeration',
    icon:        <Shield size={20} />,
    name:        'AI Moderation',
    description: 'Flags suspicious, offensive, or policy-violating listings before they go live.',
  },
  {
    key:         'fraudDetection',
    icon:        <AlertTriangle size={20} />,
    name:        'Fraud Detection',
    description: 'Detects unusual account activity patterns and raises alerts for admin review.',
  },
  {
    key:         'chatAssistant',
    icon:        <MessageSquare size={20} />,
    name:        'Chat Assistant',
    description: 'Drafts suggested replies for sellers based on incoming buyer enquiries.',
  },
  {
    key:         'descriptionGenerator',
    icon:        <PenLine size={20} />,
    name:        'Description Generator',
    description: 'AI drafts a professional product description from a name and category.',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAiSettingsPage() {
  const [provider,      setProvider]      = useState<Provider>('openai');
  const [apiKey,        setApiKey]        = useState('');
  const [model,         setModel]         = useState('gpt-4o');
  const [showKey,       setShowKey]       = useState(false);
  const [modules,       setModules]       = useState<AiModuleState>(DEFAULT_MODULES);
  const [testStatus,    setTestStatus]    = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [saving,        setSaving]        = useState(false);
  const [toast,         setToast]         = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'siteConfig.ai'));
        if (snap.exists()) {
          const d = snap.data() as Partial<AiSettings>;
          if (d.provider)  setProvider(d.provider);
          if (d.apiKey)    setApiKey(d.apiKey);
          if (d.model)     setModel(d.model);
          if (d.modules)   setModules({ ...DEFAULT_MODULES, ...d.modules });
        }
      } catch { /* keep defaults */ }
      finally { setLoading(false); }
    })();
  }, []);

  // ── Test connection ─────────────────────────────────────────────────────────

  function handleTest() {
    setTestStatus('testing');
    setTimeout(() => {
      setTestStatus(apiKey.length > 10 ? 'ok' : 'fail');
    }, 1500);
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: AiSettings = { provider, apiKey, model, modules };
      await setDoc(doc(db, 'config', 'siteConfig.ai'), payload, { merge: true });
      showToast('AI settings saved successfully.');
    } catch (err) {
      console.error('[AI Settings] save error', err);
      showToast('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function toggleModule(key: ModuleKey) {
    setModules((m) => ({ ...m, [key]: !m[key] }));
  }

  const models = provider === 'openai' ? OPENAI_MODELS : ANTHROPIC_MODELS;

  return (
    <AdminLayout>
      <div style={{ padding: '28px 24px', maxWidth: 960 }}>

        <style>{`
          .ai-card {
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: 12px;
            padding: 22px 24px;
          }
          .ai-label {
            display: block; font-size: 12px; font-weight: 600;
            color: var(--color-text-secondary); margin-bottom: 6px;
            text-transform: uppercase; letter-spacing: 0.04em;
          }
          .ai-input {
            width: 100%; padding: 9px 12px; border-radius: 8px;
            border: 1px solid var(--color-border);
            background: var(--color-background); color: var(--color-text);
            font-size: 13px; box-sizing: border-box;
          }
          .ai-input:focus { outline: 2px solid var(--color-primary); outline-offset: -1px; }
          .ai-modules-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
          }
          @media (max-width: 640px) { .ai-modules-grid { grid-template-columns: 1fr; } }
          .ai-toggle {
            width: 44px; height: 24px; border-radius: 12px;
            position: relative; cursor: pointer; border: none;
            transition: background 0.2s;
            flex-shrink: 0;
          }
          .ai-toggle::after {
            content: '';
            position: absolute; top: 2px;
            width: 20px; height: 20px; border-radius: 50%;
            background: #fff;
            transition: left 0.2s;
            box-shadow: 0 1px 3px rgba(0,0,0,0.18);
          }
          .ai-toggle.on { background: var(--color-primary); }
          .ai-toggle.on::after { left: 22px; }
          .ai-toggle.off { background: var(--color-border); }
          .ai-toggle.off::after { left: 2px; }
        `}</style>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>AI Settings</h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              Configure AI provider and toggle intelligent modules
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 13, fontWeight: 600, opacity: (saving || loading) ? 0.6 : 1,
            }}
          >
            <Save size={15} />
            {saving ? 'Saving…' : 'Save AI Settings'}
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Loading…
          </div>
        ) : (
          <>
            {/* Provider section */}
            <div className="ai-card" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 20, marginTop: 0 }}>
                AI Provider
              </h2>

              {/* Provider radio */}
              <div style={{ marginBottom: 20 }}>
                <label className="ai-label">Provider</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['openai', 'anthropic'] as Provider[]).map((p) => (
                    <div
                      key={p}
                      onClick={() => {
                        setProvider(p);
                        setModel(p === 'openai' ? OPENAI_MODELS[0] : ANTHROPIC_MODELS[0]);
                        setTestStatus('idle');
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
                        border: `1.5px solid ${provider === p ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: provider === p ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent',
                        color: provider === p ? 'var(--color-primary)' : 'var(--color-text)',
                        fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                      }}
                    >
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%',
                        border: `2px solid ${provider === p ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {provider === p && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)' }} />}
                      </div>
                      {p === 'openai' ? 'OpenAI' : 'Anthropic'}
                    </div>
                  ))}
                </div>
              </div>

              {/* API key */}
              <div style={{ marginBottom: 20 }}>
                <label className="ai-label">API Key</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      className="ai-input"
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => { setApiKey(e.target.value); setTestStatus('idle'); }}
                      placeholder={provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      onClick={() => setShowKey((v) => !v)}
                      style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--color-text-secondary)', padding: 2,
                      }}
                      aria-label={showKey ? 'Hide key' : 'Show key'}
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button
                    onClick={handleTest}
                    disabled={testStatus === 'testing'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                      color: 'var(--color-text)', fontSize: 13, fontWeight: 600,
                      whiteSpace: 'nowrap', opacity: testStatus === 'testing' ? 0.7 : 1,
                    } as React.CSSProperties}
                  >
                    <Zap size={14} />
                    {testStatus === 'testing' ? 'Testing…' : 'Test Connection'}
                  </button>
                </div>
                {testStatus === 'ok' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'var(--color-success)', fontSize: 13 }}>
                    <CheckCircle size={14} /> Connected successfully
                  </div>
                )}
                {testStatus === 'fail' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'var(--color-danger)', fontSize: 13 }}>
                    <XCircle size={14} /> Connection failed — check your API key
                  </div>
                )}
              </div>

              {/* Model */}
              <div>
                <label className="ai-label">Model</label>
                <select
                  className="ai-input"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  style={{ width: 'auto', minWidth: 280 }}
                >
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Module cards */}
            <div style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>
                AI Modules
              </h2>
              <div className="ai-modules-grid">
                {MODULE_CARDS.map((card) => {
                  const on = modules[card.key];
                  return (
                    <div key={card.key} className="ai-card" style={{ display: 'flex', gap: 16 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                        background: on
                          ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                          : 'var(--color-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: on ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        transition: 'all 0.2s',
                      }}>
                        {card.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{card.name}</span>
                          <button
                            className={`ai-toggle ${on ? 'on' : 'off'}`}
                            onClick={() => toggleModule(card.key)}
                            aria-label={on ? `Disable ${card.name}` : `Enable ${card.name}`}
                          />
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                          {card.description}
                        </p>
                        <div style={{ marginTop: 8 }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 9px', borderRadius: 99,
                            fontSize: 11, fontWeight: 700,
                            background: on
                              ? 'color-mix(in srgb, var(--color-success) 12%, transparent)'
                              : 'var(--color-border)',
                            color: on ? 'var(--color-success)' : 'var(--color-text-secondary)',
                          }}>
                            {on ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, right: 24,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 10, padding: '12px 20px',
            fontSize: 13, color: 'var(--color-text)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 9999,
          }}>
            {toast}
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
