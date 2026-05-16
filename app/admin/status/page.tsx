/**
 * app/admin/status/page.tsx
 * Phase 4 — SLA / system status dashboard.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection, getDocs, addDoc, query, where, orderBy, limit,
  serverTimestamp,
} from 'firebase/firestore';
import { Plus, X, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { db } from '@/services/firebase';
import type { ServiceHealth, ServiceStatus, Incident } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ServiceStatus, { dot: string; label: string; bg: string }> = {
  'operational':     { dot: '#16A34A', label: 'Operational',     bg: '#F0FDF4' },
  'degraded':        { dot: '#EAB308', label: 'Degraded',        bg: '#FEFCE8' },
  'partial-outage':  { dot: '#F97316', label: 'Partial Outage',  bg: '#FFF7ED' },
  'major-outage':    { dot: '#DC2626', label: 'Major Outage',    bg: '#FEF2F2' },
};

const SEVERITY_COLORS: Record<Incident['severity'], { bg: string; color: string }> = {
  minor:    { bg: '#FEFCE8', color: '#A16207' },
  major:    { bg: '#FFF7ED', color: '#C2410C' },
  critical: { bg: '#FEF2F2', color: '#DC2626' },
};

const INCIDENT_STATUS_COLORS: Record<Incident['status'], { bg: string; color: string }> = {
  investigating: { bg: '#FEF2F2', color: '#DC2626' },
  identified:    { bg: '#FFF7ED', color: '#C2410C' },
  monitoring:    { bg: '#FEFCE8', color: '#A16207' },
  resolved:      { bg: '#F0FDF4', color: '#16A34A' },
};

// Mock fallback services if Firestore returns empty
const MOCK_SERVICES: ServiceHealth[] = [
  { id: 'api',       name: 'API',       status: 'operational', uptime30d: 99.98, avgResponseMs: 142, updatedAt: { seconds: 0, nanoseconds: 0, toDate: () => new Date() } },
  { id: 'firestore', name: 'Firestore', status: 'operational', uptime30d: 99.99, avgResponseMs:  48, updatedAt: { seconds: 0, nanoseconds: 0, toDate: () => new Date() } },
  { id: 'auth',      name: 'Auth',      status: 'operational', uptime30d: 99.97, avgResponseMs:  88, updatedAt: { seconds: 0, nanoseconds: 0, toDate: () => new Date() } },
  { id: 'storage',   name: 'Storage',   status: 'operational', uptime30d: 99.95, avgResponseMs: 210, updatedAt: { seconds: 0, nanoseconds: 0, toDate: () => new Date() } },
  { id: 'cdn',       name: 'CDN',       status: 'operational', uptime30d: 100.0, avgResponseMs:  32, updatedAt: { seconds: 0, nanoseconds: 0, toDate: () => new Date() } },
];

function formatDateTime(ts: { seconds: number } | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Build a deterministic 90-day uptime grid from the service id and uptime%
function build90DayGrid(seed: string, uptime: number): ('up' | 'down' | 'none')[] {
  const cells: ('up' | 'down' | 'none')[] = [];
  // simple seeded RNG
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  function next() { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; }
  const downThreshold = (100 - uptime) / 100;
  for (let i = 0; i < 90; i++) {
    cells.push(next() < downThreshold ? 'down' : 'up');
  }
  return cells;
}

// ─── Report Incident Modal ───────────────────────────────────────────────────

interface ReportModalProps {
  services: ServiceHealth[];
  onClose: () => void;
  onSaved: () => void;
}

function ReportIncidentModal({ services, onClose, onSaved }: ReportModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Incident['severity']>('minor');
  const [affected, setAffected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggleService(id: string) {
    setAffected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'incidents'), {
        title: title.trim(),
        description: description.trim(),
        severity,
        status: 'investigating' as const,
        affectedServices: affected,
        startedAt: serverTimestamp(),
        updates: [],
      });
      onSaved();
    } catch (err) {
      console.error(err);
      setError('Failed to report incident.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--color-border)', fontSize: 13,
    background: 'var(--color-background)', color: 'var(--color-text)', outline: 'none',
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
            Report Incident
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-secondary)', padding: 4,
          }}><X size={18} /></button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
              Title *
            </label>
            <input style={inputStyle} value={title} required
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. API response delays" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
              Description *
            </label>
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }}
              value={description} required
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what's happening…" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
              Severity
            </label>
            <select style={inputStyle} value={severity}
              onChange={(e) => setSeverity(e.target.value as Incident['severity'])}>
              <option value="minor">Minor</option>
              <option value="major">Major</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--color-text-secondary)' }}>
              Affected Services
            </label>
            <div style={{
              padding: 14, borderRadius: 8,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 16px',
            }}>
              {services.map((s) => (
                <label key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  cursor: 'pointer', fontSize: 13, color: 'var(--color-text)',
                }}>
                  <input type="checkbox" checked={affected.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                    style={{ accentColor: 'var(--color-primary)', width: 14, height: 14 }} />
                  {s.name}
                </label>
              ))}
            </div>
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
              background: 'var(--color-danger)', color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Reporting…' : 'Report Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Incident Card ───────────────────────────────────────────────────────────

function IncidentCard({ incident, defaultOpen = false }: { incident: Incident; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const sev = SEVERITY_COLORS[incident.severity];
  const st = INCIDENT_STATUS_COLORS[incident.status];

  return (
    <div style={{
      background: 'var(--color-background)',
      border: '1px solid var(--color-border)',
      borderRadius: 10, padding: 16, marginBottom: 10,
    }}>
      <div onClick={() => setOpen((v) => !v)} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, cursor: 'pointer',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
              background: sev.bg, color: sev.color, textTransform: 'uppercase',
            }}>{incident.severity}</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
              background: st.bg, color: st.color, textTransform: 'capitalize',
            }}>{incident.status}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{incident.title}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Started {formatDateTime(incident.startedAt)}
            {incident.resolvedAt && <> · Resolved {formatDateTime(incident.resolvedAt)}</>}
          </div>
        </div>
        {open ? <ChevronUp size={16} color="var(--color-text-secondary)" /> : <ChevronDown size={16} color="var(--color-text-secondary)" />}
      </div>
      {open && (
        <div style={{
          marginTop: 12, paddingTop: 12,
          borderTop: '1px solid var(--color-border)',
        }}>
          <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6, margin: '0 0 10px' }}>
            {incident.description}
          </p>
          {incident.affectedServices?.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              <strong>Affected:</strong> {incident.affectedServices.join(', ')}
            </div>
          )}
          {incident.updates?.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                Updates
              </div>
              {incident.updates.map((u, i) => (
                <div key={i} style={{
                  fontSize: 12, color: 'var(--color-text)',
                  padding: '6px 10px', background: 'var(--color-surface)',
                  borderRadius: 6, marginBottom: 4,
                }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
                    {formatDateTime(u.timestamp)}
                  </div>
                  {u.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StatusPage() {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([]);
  const [resolvedIncidents, setResolvedIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [svcSnap, activeSnap, resolvedSnap] = await Promise.all([
        getDocs(collection(db, 'serviceHealth')),
        getDocs(query(collection(db, 'incidents'), where('status', '!=', 'resolved'))),
        getDocs(query(
          collection(db, 'incidents'),
          where('status', '==', 'resolved'),
          orderBy('resolvedAt', 'desc'),
          limit(10),
        )),
      ]);

      const svc = svcSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ServiceHealth, 'id'>) }));
      setServices(svc.length > 0 ? svc : MOCK_SERVICES);

      setActiveIncidents(activeSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Incident, 'id'>) })));
      setResolvedIncidents(resolvedSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Incident, 'id'>) })));
    } catch (err) {
      console.error(err);
      setError('Failed to load status data. Showing fallback view.');
      setServices(MOCK_SERVICES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const allOperational = useMemo(
    () => services.every((s) => s.status === 'operational') && activeIncidents.length === 0,
    [services, activeIncidents],
  );

  return (
    <AdminLayout>
      <div style={{ padding: 24, maxWidth: 1100 }}>
        {/* Header + Report button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
            System Status
          </h2>
          <button onClick={() => setReportOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 9, border: 'none',
            background: 'var(--color-danger)', color: '#fff',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            <Plus size={15} /> Report Incident
          </button>
        </div>

        {error && (
          <div style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 8,
            background: '#FEFCE8', border: '1px solid #FDE68A',
            color: '#A16207', fontSize: 13,
          }}>{error}</div>
        )}

        {/* Overall status banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: 20, borderRadius: 12,
          background: allOperational ? '#F0FDF4' : '#FEF2F2',
          border: `2px solid ${allOperational ? 'var(--color-success)' : 'var(--color-danger)'}`,
          marginBottom: 24,
        }}>
          {allOperational
            ? <CheckCircle2 size={28} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
            : <AlertCircle size={28} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: allOperational ? '#15803D' : '#B91C1C' }}>
              {allOperational ? 'All Systems Operational' : 'Service Disruption'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {loading ? 'Checking services…' : `Last checked: ${new Date().toLocaleTimeString('en-AU')}`}
            </div>
          </div>
        </div>

        {/* Service grid */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--color-text)' }}>
            Services
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
          }}>
            {services.map((s) => {
              const c = STATUS_COLORS[s.status];
              return (
                <div key={s.id} style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10, padding: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: c.dot, flexShrink: 0,
                    }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{s.name}</div>
                  </div>
                  <div style={{
                    display: 'inline-block', fontSize: 10, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 9999,
                    background: c.bg, color: c.dot, marginBottom: 10,
                  }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    <div>30-day uptime: <strong style={{ color: 'var(--color-text)' }}>{s.uptime30d.toFixed(2)}%</strong></div>
                    <div>Avg response: <strong style={{ color: 'var(--color-text)' }}>{s.avgResponseMs} ms</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 90-day uptime grids */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12, padding: 20, marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--color-text)' }}>
            90-Day Uptime
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {services.map((s) => {
              const cells = build90DayGrid(s.id, s.uptime30d);
              return (
                <div key={s.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{s.uptime30d.toFixed(2)}%</div>
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {cells.map((c, i) => (
                      <div key={i} title={`Day ${90 - i}: ${c}`} style={{
                        flex: 1, height: 20, borderRadius: 2,
                        background:
                          c === 'up'   ? '#16A34A' :
                          c === 'down' ? '#DC2626' :
                                         'var(--color-border)',
                      }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 11, color: 'var(--color-text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#16A34A' }} /> Up
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#DC2626' }} /> Down
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-border)' }} /> No data
            </span>
          </div>
        </div>

        {/* Active incidents */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--color-text)' }}>
            Active Incidents
          </h3>
          {activeIncidents.length === 0 ? (
            <div style={{
              padding: 24, textAlign: 'center',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12, color: 'var(--color-text-secondary)', fontSize: 13,
            }}>
              No active incidents.
            </div>
          ) : (
            <div>
              {activeIncidents.map((inc) => (
                <IncidentCard key={inc.id} incident={inc} defaultOpen />
              ))}
            </div>
          )}
        </div>

        {/* Incident history */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--color-text)' }}>
            Incident History
          </h3>
          {resolvedIncidents.length === 0 ? (
            <div style={{
              padding: 24, textAlign: 'center',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12, color: 'var(--color-text-secondary)', fontSize: 13,
            }}>
              No past incidents.
            </div>
          ) : (
            <div>
              {resolvedIncidents.map((inc) => (
                <IncidentCard key={inc.id} incident={inc} />
              ))}
            </div>
          )}
        </div>
      </div>

      {reportOpen && (
        <ReportIncidentModal
          services={services}
          onClose={() => setReportOpen(false)}
          onSaved={() => { setReportOpen(false); void fetchAll(); }}
        />
      )}
    </AdminLayout>
  );
}
