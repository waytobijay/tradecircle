/**
 * app/admin/loyalty/page.tsx
 * Phase 5 — Admin loyalty management.
 *
 * - KPI stats (members, points issued/redeemed, active rewards)
 * - Rewards CRUD (create/edit/delete/toggle active)
 * - Tier-threshold config (saved to config/loyaltySettings)
 * - Points-per-action config (saved to config/loyaltySettings)
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection, deleteDoc, doc, getDoc, getDocs, onSnapshot,
  orderBy, query, serverTimestamp, setDoc, Timestamp as FsTimestamp,
} from 'firebase/firestore';
import {
  Gift, Plus, Edit2, Trash2, X, Loader2, Users as UsersIcon,
  TrendingUp, TrendingDown, Save, Check,
} from 'lucide-react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { db }      from '@/services/firebase';
import { TIER_THRESHOLDS, POINTS_PER_ACTION } from '@/services/loyalty';
import type {
  LoyaltyAccount, LoyaltyReward, LoyaltyTier, LoyaltyTransaction,
} from '@/types';

type RewardType = LoyaltyReward['type'];
const REWARD_TYPES: RewardType[] = ['discount', 'free-shipping', 'product', 'badge'];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminLoyaltyPage() {
  const [rewards,      setRewards]      = useState<LoyaltyReward[]>([]);
  const [accounts,     setAccounts]     = useState<LoyaltyAccount[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading,      setLoading]      = useState(true);

  const [editing,     setEditing]     = useState<Partial<LoyaltyReward> | null>(null);
  const [saving,      setSaving]      = useState(false);

  const [thresholds,  setThresholds]  = useState<Record<LoyaltyTier, number>>(TIER_THRESHOLDS);
  const [pointsCfg,   setPointsCfg]   = useState<Record<string, number>>({ ...POINTS_PER_ACTION });
  const [thrSaving,   setThrSaving]   = useState(false);
  const [thrSaved,    setThrSaved]    = useState(false);
  const [ptsSaving,   setPtsSaving]   = useState(false);
  const [ptsSaved,    setPtsSaved]    = useState(false);

  // Load everything
  useEffect(() => {
    (async () => {
      try {
        const [rewardsSnap, acctSnap, txSnap, cfgSnap] = await Promise.all([
          getDocs(query(collection(db, 'loyaltyRewards'), orderBy('pointsCost', 'asc'))),
          getDocs(collection(db, 'loyaltyAccounts')),
          getDocs(collection(db, 'loyaltyTransactions')),
          getDoc(doc(db, 'config', 'loyaltySettings')),
        ]);

        setRewards(rewardsSnap.docs.map((d) => ({ ...(d.data() as LoyaltyReward), id: d.id })));
        setAccounts(acctSnap.docs.map((d) => d.data() as LoyaltyAccount));
        setTransactions(txSnap.docs.map((d) => ({ ...(d.data() as LoyaltyTransaction), id: d.id })));

        if (cfgSnap.exists()) {
          const data = cfgSnap.data() as { thresholds?: Record<LoyaltyTier, number>; pointsPerAction?: Record<string, number> };
          if (data.thresholds)      setThresholds({ ...TIER_THRESHOLDS, ...data.thresholds });
          if (data.pointsPerAction) setPointsCfg({ ...POINTS_PER_ACTION, ...data.pointsPerAction });
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const stats = useMemo(() => {
    let issued = 0, redeemed = 0;
    for (const tx of transactions) {
      if (tx.points > 0) issued += tx.points;
      else               redeemed += -tx.points;
    }
    return {
      members:    accounts.length,
      issued,
      redeemed,
      activeRewards: rewards.filter((r) => r.active).length,
    };
  }, [accounts, transactions, rewards]);

  // ── Rewards CRUD ────────────────────────────────────────────────────────────

  async function saveReward(reward: Partial<LoyaltyReward>) {
    if (!reward.name || reward.pointsCost == null) return;
    setSaving(true);
    try {
      const id  = reward.id ?? doc(collection(db, 'loyaltyRewards')).id;
      const ref = doc(db, 'loyaltyRewards', id);
      const payload: LoyaltyReward = {
        id,
        name:        reward.name,
        description: reward.description ?? '',
        pointsCost:  Number(reward.pointsCost) || 0,
        type:        reward.type ?? 'discount',
        value:       reward.value != null ? Number(reward.value) : undefined,
        active:      reward.active ?? true,
        imageUrl:    reward.imageUrl || undefined,
      };
      await setDoc(ref, payload, { merge: true });
      setRewards((prev) => {
        const next = prev.filter((r) => r.id !== id);
        next.push(payload);
        return next.sort((a, b) => a.pointsCost - b.pointsCost);
      });
      setEditing(null);
    } finally { setSaving(false); }
  }

  async function deleteReward(id: string) {
    if (!confirm('Delete this reward? This cannot be undone.')) return;
    await deleteDoc(doc(db, 'loyaltyRewards', id));
    setRewards((prev) => prev.filter((r) => r.id !== id));
  }

  async function toggleActive(r: LoyaltyReward) {
    const next = { ...r, active: !r.active };
    await setDoc(doc(db, 'loyaltyRewards', r.id), next, { merge: true });
    setRewards((prev) => prev.map((x) => (x.id === r.id ? next : x)));
  }

  // ── Settings save ───────────────────────────────────────────────────────────

  async function saveThresholds() {
    setThrSaving(true);
    try {
      await setDoc(doc(db, 'config', 'loyaltySettings'),
        { thresholds, updatedAt: FsTimestamp.now() }, { merge: true });
      setThrSaved(true);
      setTimeout(() => setThrSaved(false), 2000);
    } finally { setThrSaving(false); }
  }

  async function savePoints() {
    setPtsSaving(true);
    try {
      await setDoc(doc(db, 'config', 'loyaltySettings'),
        { pointsPerAction: pointsCfg, updatedAt: FsTimestamp.now() }, { merge: true });
      setPtsSaved(true);
      setTimeout(() => setPtsSaved(false), 2000);
    } finally { setPtsSaving(false); }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div style={{ padding: '24px 24px 60px', maxWidth: 1200, margin: '0 auto' }}>

        {/* Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 14, marginBottom: 24,
        }}>
          <StatCard label="Total Members"        value={stats.members.toLocaleString()}        icon={<UsersIcon size={18} />} />
          <StatCard label="Points Issued"        value={stats.issued.toLocaleString()}         icon={<TrendingUp size={18} />} color="var(--color-success)" />
          <StatCard label="Points Redeemed"      value={stats.redeemed.toLocaleString()}       icon={<TrendingDown size={18} />} color="var(--color-warning)" />
          <StatCard label="Active Rewards"       value={stats.activeRewards.toLocaleString()}  icon={<Gift size={18} />} color="var(--color-primary)" />
        </div>

        {/* Rewards table */}
        <div style={sectionHeader}>
          <h2 style={sectionTitle}>Rewards</h2>
          <button
            onClick={() => setEditing({ active: true, type: 'discount', pointsCost: 100 })}
            style={primaryBtn}
          >
            <Plus size={14} /> Add Reward
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 12, overflowX: 'auto', marginBottom: 32,
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--color-background)' }}>
                  <th style={th}>Image</th>
                  <th style={th}>Name</th>
                  <th style={th}>Type</th>
                  <th style={th}>Points Cost</th>
                  <th style={th}>Value</th>
                  <th style={th}>Active</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rewards.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No rewards yet — click "Add Reward" to create one.
                  </td></tr>
                ) : rewards.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={td}>
                      {r.imageUrl
                        ? <img src={r.imageUrl} alt={r.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                        : <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--color-background)',
                            border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Gift size={16} color="var(--color-text-secondary)" />
                          </div>}
                    </td>
                    <td style={td}>{r.name}</td>
                    <td style={{ ...td, textTransform: 'capitalize' }}>{r.type.replace('-', ' ')}</td>
                    <td style={td}>{r.pointsCost.toLocaleString()}</td>
                    <td style={td}>{r.value ?? '—'}</td>
                    <td style={td}>
                      <button onClick={() => void toggleActive(r)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      }}>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 999,
                          fontSize: 11, fontWeight: 700,
                          background: r.active
                            ? 'color-mix(in srgb, var(--color-success) 18%, transparent)'
                            : 'color-mix(in srgb, var(--color-text-secondary) 18%, transparent)',
                          color: r.active ? 'var(--color-success)' : 'var(--color-text-secondary)',
                        }}>{r.active ? 'ACTIVE' : 'INACTIVE'}</span>
                      </button>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => setEditing(r)} style={iconBtn} title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => void deleteReward(r.id)} style={{ ...iconBtn, color: 'var(--color-danger)' }} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tier thresholds */}
        <div style={configCard}>
          <h2 style={{ ...sectionTitle, marginBottom: 14 }}>Tier thresholds</h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Lifetime points required to reach each tier.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {(['bronze', 'silver', 'gold', 'platinum'] as LoyaltyTier[]).map((t) => (
              <label key={t} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={fieldLabel}>{t}</span>
                <input
                  type="number" min={0}
                  value={thresholds[t]}
                  onChange={(e) => setThresholds((prev) => ({ ...prev, [t]: Number(e.target.value) || 0 }))}
                  style={input}
                />
              </label>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={() => void saveThresholds()} disabled={thrSaving} style={primaryBtn}>
              {thrSaving ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                : thrSaved ? <Check size={14} /> : <Save size={14} />}
              {thrSaving ? 'Saving…' : thrSaved ? 'Saved' : 'Save thresholds'}
            </button>
          </div>
        </div>

        {/* Points per action */}
        <div style={{ ...configCard, marginTop: 20 }}>
          <h2 style={{ ...sectionTitle, marginBottom: 14 }}>Points per action</h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Points awarded for each user action.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {Object.keys(pointsCfg).map((k) => (
              <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={fieldLabel}>{k.replace('-', ' ')}</span>
                <input
                  type="number" min={0}
                  value={pointsCfg[k]}
                  onChange={(e) => setPointsCfg((prev) => ({ ...prev, [k]: Number(e.target.value) || 0 }))}
                  style={input}
                />
              </label>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={() => void savePoints()} disabled={ptsSaving} style={primaryBtn}>
              {ptsSaving ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                : ptsSaved ? <Check size={14} /> : <Save size={14} />}
              {ptsSaving ? 'Saving…' : ptsSaved ? 'Saved' : 'Save points'}
            </button>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <EditModal
          initial={editing}
          saving={saving}
          onCancel={() => setEditing(null)}
          onSave={(r) => void saveReward(r)}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </AdminLayout>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditModal({
  initial, saving, onCancel, onSave,
}: {
  initial:  Partial<LoyaltyReward>;
  saving:   boolean;
  onCancel: () => void;
  onSave:   (r: Partial<LoyaltyReward>) => void;
}) {
  const [form, setForm] = useState<Partial<LoyaltyReward>>(initial);

  const update = <K extends keyof LoyaltyReward>(key: K, val: LoyaltyReward[K] | undefined) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--color-background)', border: '1px solid var(--color-border)',
        borderRadius: 14, padding: 24, maxWidth: 480, width: '100%',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 17, color: 'var(--color-text)' }}>
            {form.id ? 'Edit reward' : 'Add reward'}
          </h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Name">
            <input value={form.name ?? ''} onChange={(e) => update('name', e.target.value)} style={input} />
          </Field>
          <Field label="Description">
            <textarea value={form.description ?? ''} onChange={(e) => update('description', e.target.value)}
              rows={3} style={{ ...input, resize: 'vertical' }} />
          </Field>
          <Field label="Type">
            <select value={form.type ?? 'discount'} onChange={(e) => update('type', e.target.value as RewardType)} style={input}>
              {REWARD_TYPES.map((t) => <option key={t} value={t}>{t.replace('-', ' ')}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Points Cost">
              <input type="number" min={0} value={form.pointsCost ?? 0}
                onChange={(e) => update('pointsCost', Number(e.target.value) || 0)} style={input} />
            </Field>
            <Field label="Value (optional)">
              <input type="number" value={form.value ?? ''}
                onChange={(e) => update('value', e.target.value === '' ? undefined : Number(e.target.value))} style={input} />
            </Field>
          </div>
          <Field label="Image URL (optional)">
            <input value={form.imageUrl ?? ''} onChange={(e) => update('imageUrl', e.target.value)} style={input} />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text)' }}>
            <input type="checkbox" checked={form.active ?? true}
              onChange={(e) => update('active', e.target.checked)} />
            Active
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={secondaryBtn}>Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.name} style={primaryBtn}>
            {saving ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components & styles ──────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: {
  label: string; value: React.ReactNode; icon: React.ReactNode; color?: string;
}) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)',
          textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ color: color ?? 'var(--color-text-secondary)' }}>{icon}</span>
      </div>
      <span style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--color-text)' }}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

const sectionHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
};

const sectionTitle: React.CSSProperties = {
  margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--color-text)',
};

const configCard: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 12, padding: 20,
};

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'var(--color-primary)', color: '#fff',
  border: 'none', borderRadius: 8, padding: '8px 14px',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  background: 'var(--color-surface)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', borderRadius: 8,
  padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--color-text-secondary)', padding: 6, marginLeft: 4,
};

const fieldLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)',
  textTransform: 'capitalize',
};

const input: React.CSSProperties = {
  background: 'var(--color-background)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', borderRadius: 8,
  padding: '8px 12px', fontSize: 13, width: '100%', fontFamily: 'inherit',
};

const th: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: 'var(--color-text-secondary)',
};

const td: React.CSSProperties = {
  padding: '12px 14px', color: 'var(--color-text)',
};
