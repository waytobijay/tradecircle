/**
 * app/admin/data-residency/page.tsx
 * Admin — Data Region selection (Phase 4)
 * Reads/writes config/siteConfig.dataRegion (single-tenant fallback for tenants/{tenantId}.dataRegion)
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  Globe2, ShieldCheck, AlertTriangle, Check, Loader2,
} from 'lucide-react';
import { db } from '@/services/firebase';
import AdminLayout from '@/components/layouts/AdminLayout';
import type { DataRegion, RegionInfo } from '@/types';

const REGIONS: RegionInfo[] = [
  { code: 'us-central1',          name: 'Iowa, USA',            flag: '🇺🇸', jurisdiction: 'USA',     latencyMs: 220 },
  { code: 'us-east1',             name: 'South Carolina, USA',  flag: '🇺🇸', jurisdiction: 'USA',     latencyMs: 240 },
  { code: 'europe-west1',         name: 'Belgium',              flag: '🇮🇪', jurisdiction: 'EU-GDPR', latencyMs: 290 },
  { code: 'asia-southeast1',      name: 'Singapore',            flag: '🇸🇬', jurisdiction: 'SG',      latencyMs: 95  },
  { code: 'asia-south1',          name: 'Mumbai, India',        flag: '🇮🇳', jurisdiction: 'IN',      latencyMs: 145 },
  { code: 'australia-southeast1', name: 'Sydney, Australia',    flag: '🇦🇺', jurisdiction: 'AU',      latencyMs: 5   },
];

const DEFAULT_REGION: DataRegion = 'australia-southeast1';

export default function DataResidencyPage() {
  const [active, setActive] = useState<DataRegion>(DEFAULT_REGION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<DataRegion | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'siteConfig'));
        if (snap.exists()) {
          const data = snap.data() as { dataRegion?: DataRegion };
          if (data.dataRegion) setActive(data.dataRegion);
        }
      } catch {/* ignore */}
      finally { setLoading(false); }
    })();
  }, []);

  const setAsActive = useCallback(async (code: DataRegion) => {
    setSaving(code);
    try {
      await setDoc(doc(db, 'config', 'siteConfig'), { dataRegion: code }, { merge: true });
      setActive(code);
    } catch (e) {
      console.error('Failed to set region', e);
    } finally {
      setSaving(null);
    }
  }, []);

  return (
    <AdminLayout>
      <style>{`
        .dr-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 640px) { .dr-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 980px) { .dr-grid { grid-template-columns: repeat(3, 1fr); } }
        .dr-map {
          background:
            linear-gradient(var(--color-border) 1px, transparent 1px) 0 0 / 32px 32px,
            linear-gradient(90deg, var(--color-border) 1px, transparent 1px) 0 0 / 32px 32px,
            var(--color-surface);
        }
      `}</style>

      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>Data Residency</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Choose the cloud region where your tenant data is stored at rest.
          </p>
        </div>

        {/* Warning banner */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: 14, borderRadius: 10, marginBottom: 20,
          background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
        }}>
          <AlertTriangle size={18} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
              Changing data region requires a migration.
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Contact support to schedule a migration window. Active region changes here are tracked, but data movement happens during a planned migration.
            </p>
          </div>
        </div>

        {/* World map placeholder */}
        <div className="dr-map" style={{
          height: 220, borderRadius: 12,
          border: '1px solid var(--color-border)',
          marginBottom: 24,
          position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <Globe2 size={42} style={{ opacity: 0.6 }} />
            <p style={{ margin: '8px 0 0', fontSize: 12 }}>Global region map</p>
          </div>
        </div>

        {/* Region cards */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <Loader2 size={24} className="spin" />
            <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <div className="dr-grid" style={{ marginBottom: 32 }}>
            {REGIONS.map((r) => {
              const isActive = r.code === active;
              const isSaving = saving === r.code;
              return (
                <div key={r.code} style={{
                  background: 'var(--color-surface)',
                  border: `2px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 12, padding: 18,
                  display: 'flex', flexDirection: 'column', gap: 10,
                  position: 'relative',
                }}>
                  {isActive && (
                    <span style={{
                      position: 'absolute', top: -10, right: 14,
                      background: 'var(--color-primary)', color: '#fff',
                      fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Check size={11} /> Active
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 30, lineHeight: 1 }}>{r.flag}</span>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{r.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{r.code}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                      background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)',
                      color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>{r.jurisdiction}</span>
                  </div>

                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    Typical latency: <strong style={{ color: 'var(--color-text)' }}>{r.latencyMs}ms</strong>
                  </p>

                  <button
                    onClick={() => void setAsActive(r.code)}
                    disabled={isActive || isSaving}
                    style={{
                      marginTop: 'auto', padding: '8px 14px', borderRadius: 8,
                      background: isActive ? 'var(--color-border)' : 'var(--color-primary)',
                      color: isActive ? 'var(--color-text-secondary)' : '#fff',
                      border: 'none', fontSize: 12, fontWeight: 600,
                      cursor: isActive || isSaving ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    {isSaving ? <Loader2 size={13} className="spin" /> : null}
                    {isActive ? 'Active' : isSaving ? 'Saving…' : 'Set as Active'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Compliance info */}
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 12, padding: 20,
        }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
            <ShieldCheck size={16} /> Compliance & Commitments
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>GDPR (EU regions)</p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                EU data stored in Belgium (europe-west1). Right-to-erasure and DPA available on request.
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>Privacy Act (AU)</p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                Australian Privacy Principles compliance with Sydney region (australia-southeast1).
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>Data residency commitments</p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                Data at rest stays in the selected region. Backups replicated to a paired region in the same jurisdiction.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
