/**
 * app/admin/campaigns/page.tsx
 * Phase 5 — Advanced ad campaigns dashboard.
 *
 * Stats, campaign table with expand-to-show variants (A/B testing),
 * traffic-weight sliders, set-winner control, and a 4-step Create Campaign modal.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Sparkles, ChevronDown, ChevronRight, X,
  Target, Crown, ExternalLink,
} from 'lucide-react';
import {
  collection, getDocs, doc, setDoc, updateDoc, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import AdminLayout from '@/components/layouts/AdminLayout';
import { db } from '@/services/firebase';
import { generateAdVariants } from '@/services/aiAdCreative';
import type {
  AdCampaign, AdVariant, AdBiddingModel, AdStatus, AdCreative, Product,
} from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<AdStatus, { bg: string; fg: string }> = {
  active: { bg: 'color-mix(in srgb, var(--color-success) 18%, transparent)', fg: 'var(--color-success)' },
  paused: { bg: 'color-mix(in srgb, var(--color-warning) 18%, transparent)', fg: 'var(--color-warning)' },
  ended:  { bg: 'color-mix(in srgb, var(--color-text-secondary) 18%, transparent)', fg: 'var(--color-text-secondary)' },
};

function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n / d) * 10000) / 100;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdCampaignsPage() {
  const [campaigns, setCampaigns]   = useState<AdCampaign[]>([]);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [showModal, setShowModal]   = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'adCampaigns'), orderBy('createdAt', 'desc')));
      setCampaigns(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdCampaign, 'id'>) })));
    } catch (e) {
      console.error('Failed to load campaigns', e);
    } finally {
      setLoading(false);
    }
  }

  // Aggregate stats
  const stats = useMemo(() => {
    const active      = campaigns.filter((c) => c.status === 'active').length;
    const spendToday  = campaigns.reduce((s, c) => s + (c.spentToDay ?? 0), 0);
    const impressions = campaigns.reduce(
      (s, c) => s + c.variants.reduce((a, v) => a + (v.impressions ?? 0), 0), 0);
    const clicks      = campaigns.reduce(
      (s, c) => s + c.variants.reduce((a, v) => a + (v.clicks ?? 0), 0), 0);
    const ctr = pct(clicks, impressions);
    return { active, spendToday, impressions, clicks, ctr };
  }, [campaigns]);

  // ─── Variant actions ────────────────────────────────────────────────────────
  async function updateVariantWeight(campaign: AdCampaign, variantId: string, weight: number) {
    const variants = campaign.variants.map((v) =>
      v.id === variantId ? { ...v, trafficWeight: weight } : v);
    setCampaigns((cs) => cs.map((c) => c.id === campaign.id ? { ...c, variants } : c));
    try {
      await updateDoc(doc(db, 'adCampaigns', campaign.id), { variants });
    } catch (e) { console.error('Update weight failed', e); }
  }

  async function setWinner(campaign: AdCampaign, variantId: string) {
    const variants = campaign.variants.map((v) =>
      v.id === variantId
        ? { ...v, trafficWeight: 100 }
        : { ...v, trafficWeight: 0 });
    setCampaigns((cs) => cs.map((c) => c.id === campaign.id
      ? { ...c, variants, winningVariantId: variantId, activeVariantId: variantId }
      : c));
    try {
      await updateDoc(doc(db, 'adCampaigns', campaign.id), {
        variants, winningVariantId: variantId, activeVariantId: variantId,
      });
    } catch (e) { console.error('Set winner failed', e); }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>
              Ad Campaigns
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Manage CPM/CPC/CPA bidding, A/B variants, and budget pacing.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--color-primary)', color: '#fff',
              border: 'none', borderRadius: 8, padding: '10px 16px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={16} /> Create Campaign
          </button>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
          gap: 12, marginBottom: 24,
        }}>
          <StatCard label="Active Campaigns" value={stats.active.toString()} />
          <StatCard label="Spend Today"      value={`$${stats.spendToday.toFixed(2)}`} />
          <StatCard label="Impressions"      value={stats.impressions.toLocaleString()} />
          <StatCard label="Avg CTR"          value={`${stats.ctr.toFixed(2)}%`} />
        </div>

        {/* Table */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              Loading campaigns…
            </div>
          ) : campaigns.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              No campaigns yet. Click <b>Create Campaign</b> to get started.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--color-background)' }}>
                    {['', 'Name', 'Status', 'Bidding', 'Bid', 'Budget Used', 'Impr.', 'Clicks', 'CTR', 'Conv.', 'Actions']
                      .map((h) => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const variantTotals = c.variants.reduce(
                      (acc, v) => ({
                        impr: acc.impr + v.impressions,
                        clk:  acc.clk  + v.clicks,
                        conv: acc.conv + v.conversions,
                      }), { impr: 0, clk: 0, conv: 0 });
                    const ctr        = pct(variantTotals.clk, variantTotals.impr);
                    const budgetPct  = c.budget ? Math.min(100, (c.spentTotal / c.budget) * 100) : 0;
                    const isExpanded = expanded === c.id;
                    const colors     = STATUS_COLORS[c.status];

                    return (
                      <>
                        <tr
                          key={c.id}
                          onClick={() => setExpanded(isExpanded ? null : c.id)}
                          style={{ borderTop: '1px solid var(--color-border)', cursor: 'pointer' }}
                        >
                          <td style={td}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                          <td style={{ ...td, fontWeight: 500, color: 'var(--color-text)' }}>{c.name}</td>
                          <td style={td}>
                            <span style={{
                              background: colors.bg, color: colors.fg,
                              padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              textTransform: 'capitalize',
                            }}>{c.status}</span>
                          </td>
                          <td style={td}>{c.biddingModel.toUpperCase()}</td>
                          <td style={td}>${c.bidAmount.toFixed(2)}</td>
                          <td style={{ ...td, minWidth: 160 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                                ${c.spentTotal.toFixed(2)} / ${c.budget.toFixed(2)}
                              </div>
                              <div style={{ height: 6, background: 'var(--color-background)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%', width: `${budgetPct}%`,
                                  background: budgetPct > 90 ? 'var(--color-danger)'
                                    : budgetPct > 70 ? 'var(--color-warning)'
                                    : 'var(--color-primary)',
                                  transition: 'width .2s',
                                }} />
                              </div>
                            </div>
                          </td>
                          <td style={td}>{variantTotals.impr.toLocaleString()}</td>
                          <td style={td}>{variantTotals.clk.toLocaleString()}</td>
                          <td style={td}>{ctr.toFixed(2)}%</td>
                          <td style={td}>{variantTotals.conv.toLocaleString()}</td>
                          <td style={td}>
                            <Link
                              href={`/admin/campaigns/${c.id}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                color: 'var(--color-primary)', textDecoration: 'none', fontSize: 12, fontWeight: 600,
                              }}
                            >
                              View <ExternalLink size={11} />
                            </Link>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr key={`${c.id}-x`}>
                            <td colSpan={11} style={{
                              padding: 16, background: 'var(--color-background)',
                              borderTop: '1px solid var(--color-border)',
                            }}>
                              <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-text)' }}>
                                A/B Variants ({c.variants.length})
                              </h4>
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
                                gap: 12,
                              }}>
                                {c.variants.map((v) => (
                                  <VariantCard
                                    key={v.id}
                                    variant={v}
                                    isWinner={c.winningVariantId === v.id}
                                    onWeightChange={(w) => updateVariantWeight(c, v.id, w)}
                                    onSetWinner={() => setWinner(c, v.id)}
                                  />
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showModal && (
          <CreateCampaignModal
            onClose={() => setShowModal(false)}
            onCreated={() => { setShowModal(false); void load(); }}
          />
        )}
      </div>
    </AdminLayout>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginTop: 6 }}>
        {value}
      </div>
    </div>
  );
}

// ─── Variant card ─────────────────────────────────────────────────────────────
function VariantCard({
  variant, isWinner, onWeightChange, onSetWinner,
}: {
  variant: AdVariant;
  isWinner: boolean;
  onWeightChange: (w: number) => void;
  onSetWinner: () => void;
}) {
  const ctr = pct(variant.clicks, variant.impressions);
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: `1px solid ${isWinner ? 'var(--color-success)' : 'var(--color-border)'}`,
      borderRadius: 10, padding: 12,
    }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {variant.creative.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={variant.creative.imageUrl} alt={variant.name}
            style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{
            width: 64, height: 64, borderRadius: 8, flexShrink: 0,
            background: 'var(--color-background)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text-secondary)', fontSize: 18, fontWeight: 700,
          }}>{variant.name}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong style={{ color: 'var(--color-text)' }}>Variant {variant.name}</strong>
            {isWinner && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                background: 'color-mix(in srgb, var(--color-success) 20%, transparent)',
                color: 'var(--color-success)',
                padding: '1px 6px', borderRadius: 5, fontSize: 10, fontWeight: 700,
              }}>
                <Crown size={10} /> WINNER
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {variant.creative.headline || '(no headline)'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 12, fontSize: 11 }}>
        <Metric label="Impr."  value={variant.impressions.toLocaleString()} />
        <Metric label="Clicks" value={variant.clicks.toLocaleString()} />
        <Metric label="Conv."  value={variant.conversions.toLocaleString()} />
        <Metric label="CTR"    value={`${ctr.toFixed(2)}%`} />
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--color-text-secondary)' }}>
        Spend: <strong style={{ color: 'var(--color-text)' }}>${variant.spend.toFixed(2)}</strong>
      </div>

      <div style={{ marginTop: 10 }}>
        <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Traffic weight</span>
          <span>{variant.trafficWeight}%</span>
        </label>
        <input
          type="range" min={0} max={100} value={variant.trafficWeight}
          onChange={(e) => onWeightChange(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {!isWinner && (
        <button
          onClick={onSetWinner}
          style={{
            marginTop: 8, width: '100%',
            background: 'transparent', color: 'var(--color-primary)',
            border: '1px solid var(--color-primary)', borderRadius: 6,
            padding: '6px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Set Winner
        </button>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: 'var(--color-text-secondary)' }}>{label}</div>
      <div style={{ color: 'var(--color-text)', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)',
  textTransform: 'uppercase', letterSpacing: 0.4,
};
const td: React.CSSProperties = {
  padding: '12px', color: 'var(--color-text-secondary)', verticalAlign: 'middle',
};

// ─── Create Campaign Modal (4 steps) ──────────────────────────────────────────
function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [generating, setGenerating] = useState(false);

  // form fields
  const [name, setName] = useState('');
  const [advertiserId, setAdvertiserId] = useState('');
  const [budget, setBudget] = useState(100);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));

  const [biddingModel, setBiddingModel] = useState<AdBiddingModel>('cpc');
  const [bidAmount, setBidAmount] = useState(0.5);

  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [variants, setVariants] = useState<AdVariant[]>([
    { id: uid(), name: 'A', creative: { imageUrl: '', headline: '', ctaUrl: '' },
      impressions: 0, clicks: 0, conversions: 0, spend: 0, trafficWeight: 50 },
    { id: uid(), name: 'B', creative: { imageUrl: '', headline: '', ctaUrl: '' },
      impressions: 0, clicks: 0, conversions: 0, spend: 0, trafficWeight: 50 },
  ]);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'products'));
        setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) })));
      } catch (e) { console.error('load products', e); }
    })();
  }, []);

  async function aiGenerate() {
    const prod = products.find((p) => p.id === selectedProduct);
    if (!prod) { alert('Pick a product first.'); return; }
    setGenerating(true);
    try {
      const creatives = await generateAdVariants(prod, 3);
      setVariants(creatives.map((c, i) => ({
        id: uid(),
        name: String.fromCharCode(65 + i), // A, B, C
        creative: c,
        impressions: 0, clicks: 0, conversions: 0, spend: 0,
        trafficWeight: Math.floor(100 / creatives.length),
      })));
    } catch (e) {
      console.error('AI generation failed', e);
      alert('AI generation failed. Add variants manually.');
    } finally { setGenerating(false); }
  }

  function updateVariant(idx: number, patch: Partial<AdCreative>) {
    setVariants((vs) => vs.map((v, i) =>
      i === idx ? { ...v, creative: { ...v.creative, ...patch } } : v));
  }

  async function save() {
    if (!name.trim() || !advertiserId.trim()) {
      alert('Name and advertiser required.'); return;
    }
    setSaving(true);
    try {
      const id  = uid() + uid();
      const now = new Date();
      const startTs = { seconds: Math.floor(new Date(startDate).getTime() / 1000), nanoseconds: 0 };
      const endTs   = { seconds: Math.floor(new Date(endDate).getTime()   / 1000), nanoseconds: 0 };
      const payload: Omit<AdCampaign, 'createdAt'> & { createdAt: unknown } = {
        id, advertiserId: advertiserId.trim(), name: name.trim(),
        budget, spentToDay: 0, spentTotal: 0,
        bidAmount, biddingModel,
        startDate: startTs as never, endDate: endTs as never,
        status: 'active',
        variants,
        activeVariantId: variants[0]?.id,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'adCampaigns', id), payload);
      onCreated();
    } catch (e) {
      console.error('Save failed', e);
      alert('Failed to save campaign.');
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
        width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto',
        border: '1px solid var(--color-border)',
      }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: 18, borderBottom: '1px solid var(--color-border)',
        }}>
          <h3 style={{ margin: 0, color: 'var(--color-text)' }}>
            Create Campaign — Step {step} / 4
          </h3>
          <button onClick={onClose} style={iconBtn}><X size={16} /></button>
        </div>

        {/* Step content */}
        <div style={{ padding: 20 }}>
          {step === 1 && (
            <Stack>
              <Field label="Campaign name">
                <input value={name} onChange={(e) => setName(e.target.value)} style={input} />
              </Field>
              <Field label="Advertiser ID">
                <input value={advertiserId} onChange={(e) => setAdvertiserId(e.target.value)} style={input} placeholder="uid of advertiser" />
              </Field>
              <Field label="Budget ($)">
                <input type="number" min={1} value={budget} onChange={(e) => setBudget(Number(e.target.value))} style={input} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Start date">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={input} />
                </Field>
                <Field label="End date">
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={input} />
                </Field>
              </div>
            </Stack>
          )}

          {step === 2 && (
            <Stack>
              <Field label="Bidding model">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {(['cpm', 'cpc', 'cpa', 'flat'] as AdBiddingModel[]).map((m) => (
                    <button key={m} onClick={() => setBiddingModel(m)} style={{
                      padding: '10px', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${biddingModel === m ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: biddingModel === m
                        ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                        : 'var(--color-surface)',
                      color: biddingModel === m ? 'var(--color-primary)' : 'var(--color-text)',
                      fontSize: 13, fontWeight: 600, textTransform: 'uppercase',
                    }}>{m}</button>
                  ))}
                </div>
              </Field>
              <Field label={`Bid amount: $${bidAmount.toFixed(2)}`}>
                <input
                  type="range" min={0.01} max={10} step={0.01}
                  value={bidAmount} onChange={(e) => setBidAmount(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </Field>
            </Stack>
          )}

          {step === 3 && (
            <Stack>
              <Field label="Generate variants from product">
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    style={{ ...input, flex: 1 }}
                  >
                    <option value="">— Select a product —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button
                    onClick={() => void aiGenerate()}
                    disabled={!selectedProduct || generating}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'var(--color-primary)', color: '#fff',
                      border: 'none', borderRadius: 8, padding: '8px 14px',
                      cursor: selectedProduct ? 'pointer' : 'not-allowed',
                      opacity: selectedProduct ? 1 : 0.5, fontSize: 13, fontWeight: 600,
                    }}
                  >
                    <Sparkles size={14} /> {generating ? 'Generating…' : 'Generate with AI'}
                  </button>
                </div>
              </Field>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {variants.map((v, i) => (
                  <div key={v.id} style={{
                    padding: 10, background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)', borderRadius: 8,
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                      Variant {v.name}
                    </div>
                    <input
                      placeholder="Headline"
                      value={v.creative.headline}
                      onChange={(e) => updateVariant(i, { headline: e.target.value })}
                      style={{ ...input, marginBottom: 6 }}
                    />
                    <input
                      placeholder="Image URL"
                      value={v.creative.imageUrl}
                      onChange={(e) => updateVariant(i, { imageUrl: e.target.value })}
                      style={{ ...input, marginBottom: 6 }}
                    />
                    <input
                      placeholder="CTA URL"
                      value={v.creative.ctaUrl}
                      onChange={(e) => updateVariant(i, { ctaUrl: e.target.value })}
                      style={input}
                    />
                  </div>
                ))}
              </div>
            </Stack>
          )}

          {step === 4 && (
            <Stack>
              <ReviewRow k="Name"     v={name} />
              <ReviewRow k="Budget"   v={`$${budget.toFixed(2)}`} />
              <ReviewRow k="Dates"    v={`${startDate} → ${endDate}`} />
              <ReviewRow k="Bidding"  v={`${biddingModel.toUpperCase()} @ $${bidAmount.toFixed(2)}`} />
              <ReviewRow k="Variants" v={`${variants.length} (${variants.map((v) => v.name).join(', ')})`} />
            </Stack>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          padding: 14, borderTop: '1px solid var(--color-border)',
        }}>
          <button
            disabled={step === 1}
            onClick={() => setStep((s) => s - 1)}
            style={{ ...secondaryBtn, opacity: step === 1 ? 0.5 : 1 }}
          >Back</button>
          {step < 4 ? (
            <button onClick={() => setStep((s) => s + 1)} style={primaryBtn}>Next</button>
          ) : (
            <button onClick={() => void save()} disabled={saving} style={primaryBtn}>
              {saving ? 'Launching…' : 'Launch Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stack({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}
function ReviewRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '10px 12px', background: 'var(--color-surface)',
      border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13,
    }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{k}</span>
      <strong style={{ color: 'var(--color-text)' }}>{v}</strong>
    </div>
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
  background: 'var(--color-primary)', color: '#fff',
  border: 'none', borderRadius: 8, padding: '9px 18px',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  background: 'transparent', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', borderRadius: 8,
  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
