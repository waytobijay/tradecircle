/**
 * app/referrals/page.tsx
 * Phase 5 — Buyer-facing referral program page.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection, doc, getDoc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, Timestamp as FsTimestamp, where,
} from 'firebase/firestore';
import {
  Copy, Check, Share2, ChevronDown, ChevronUp,
  MessageCircle, Mail, Share2 as Twitter, ThumbsUp as Facebook, Users as UsersIcon,
} from 'lucide-react';
import BuyerLayout      from '@/components/layouts/BuyerLayout';
import { db }           from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import type { Referral, ReferralCode } from '@/types';

const SHARE_BASE = 'https://tradecircle.com/signup?ref=';
const REFERRAL_REWARD = 200;   // owner points per qualified referral
const SIGNUP_BONUS    = 100;   // new user points on signup

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic 8-char code from uid (no crypto required). */
function codeFromUid(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
  const base = Math.abs(h).toString(36).toUpperCase().padStart(6, '0');
  const tail = uid.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase().padEnd(4, 'X');
  return (base + tail).slice(0, 8);
}

function fmtDate(seconds: number): string {
  try { return new Date(seconds * 1000).toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReferralsPage() {
  const { user } = useAuthStore();
  const uid       = user?.uid ?? '';
  const name      = user?.name ?? 'A friend';

  const [refCode,   setRefCode]   = useState<ReferralCode | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied,    setCopied]    = useState<'code' | 'link' | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [loading,   setLoading]   = useState(true);

  // Generate/fetch the user's code
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const code = codeFromUid(uid);
    const ref  = doc(db, 'referralCodes', code);

    (async () => {
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setRefCode(snap.data() as ReferralCode);
        } else {
          const fresh: ReferralCode = {
            code,
            ownerUid:     uid,
            ownerName:    name,
            uses:         0,
            rewardPoints: REFERRAL_REWARD,
            signupBonus:  SIGNUP_BONUS,
            createdAt:    FsTimestamp.now(),
            active:       true,
          };
          await setDoc(ref, fresh);
          setRefCode(fresh);
        }
      } catch {
        // Offline / permissions — render with in-memory code so the UI still works
        setRefCode({
          code,
          ownerUid:     uid,
          ownerName:    name,
          uses:         0,
          rewardPoints: REFERRAL_REWARD,
          signupBonus:  SIGNUP_BONUS,
          createdAt:    FsTimestamp.now(),
          active:       true,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [uid, name]);

  // Live referrals for stats + table
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'referrals'),
      where('referrerUid', '==', uid),
      orderBy('signupAt', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      setReferrals(snap.docs.map((d) => ({ ...(d.data() as Referral), id: d.id })));
    }, () => setReferrals([]));
  }, [uid]);

  const code      = refCode?.code ?? '—';
  const shareUrl  = `${SHARE_BASE}${code}`;
  const shareText = `Join me on TradeCircle! Use my code ${code} and get ${SIGNUP_BONUS} bonus points. ${shareUrl}`;

  const stats = useMemo(() => {
    let qualified = 0, pending = 0, points = 0;
    for (const r of referrals) {
      if (r.status === 'pending') pending++;
      else { qualified++; points += r.pointsAwarded ?? 0; }
    }
    return { total: referrals.length, qualified, pending, points };
  }, [referrals]);

  async function handleCopy(text: string, kind: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  }

  return (
    <BuyerLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 60px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>
          Refer friends, earn rewards
        </h1>
        <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--color-text-secondary)' }}>
          Earn <strong>{REFERRAL_REWARD}</strong> points for every friend who joins and makes a purchase.
        </p>

        {/* ── Share card ──────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 70%, #000) 100%)',
          color: '#fff', borderRadius: 16, padding: 28, marginBottom: 24,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Your referral code
          </div>
          <div style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 40, fontWeight: 700, letterSpacing: '0.15em',
            wordBreak: 'break-all', marginBottom: 16,
          }}>
            {loading ? '········' : code}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
            <button onClick={() => void handleCopy(code, 'code')}
              style={shareBtnLight}>
              {copied === 'code' ? <Check size={14} /> : <Copy size={14} />}
              {copied === 'code' ? 'Copied!' : 'Copy Code'}
            </button>
            <button onClick={() => void handleCopy(shareUrl, 'link')}
              style={shareBtnLight}>
              {copied === 'link' ? <Check size={14} /> : <Share2 size={14} />}
              {copied === 'link' ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>Share via</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <SocialLink href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              icon={<MessageCircle size={14} />} label="WhatsApp" />
            <SocialLink href={`mailto:?subject=${encodeURIComponent('Join me on TradeCircle')}&body=${encodeURIComponent(shareText)}`}
              icon={<Mail size={14} />} label="Email" />
            <SocialLink href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
              icon={<Twitter size={14} />} label="Twitter" />
            <SocialLink href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              icon={<Facebook size={14} />} label="Facebook" />
          </div>
        </div>

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 14, marginBottom: 24,
        }}>
          <StatCard label="Total Referrals"   value={stats.total} />
          <StatCard label="Qualified"         value={stats.qualified} color="var(--color-success)" />
          <StatCard label="Pending"           value={stats.pending}   color="var(--color-warning)" />
          <StatCard label="Points Earned"     value={stats.points.toLocaleString()} color="var(--color-primary)" />
        </div>

        {/* ── Recent referrals ────────────────────────────────────────── */}
        <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>
          Recent referrals
        </h2>

        {referrals.length === 0 ? (
          <div style={{
            background: 'var(--color-surface)', border: '1px dashed var(--color-border)',
            borderRadius: 12, padding: 36, textAlign: 'center',
          }}>
            <UsersIcon size={32} color="var(--color-text-secondary)" />
            <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--color-text-secondary)' }}>
              No referrals yet. Share your code to start earning!
            </p>
          </div>
        ) : (
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 12, overflowX: 'auto',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--color-background)' }}>
                  <th style={th}>Friend</th>
                  <th style={th}>Signup Date</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={td}>{r.referredUid.slice(0, 8)}…</td>
                    <td style={td}>{fmtDate(r.signupAt?.seconds ?? 0)}</td>
                    <td style={td}><StatusBadge status={r.status} /></td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>
                      {r.pointsAwarded > 0 ? `+${r.pointsAwarded}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Terms ────────────────────────────────────────────────────── */}
        <button
          onClick={() => setTermsOpen((v) => !v)}
          style={{
            marginTop: 24, background: 'none', border: 'none', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0,
            color: 'var(--color-text-secondary)', fontSize: 13, fontWeight: 500,
          }}
        >
          Terms {termsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {termsOpen && (
          <div style={{
            marginTop: 10, padding: 16,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 10, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6,
          }}>
            Earn {REFERRAL_REWARD} points per qualified referral. Friends get {SIGNUP_BONUS} points
            on signup. A referral becomes qualified once your friend completes their first order.
            Points are awarded automatically and cannot be combined with other welcome promotions.
            TradeCircle reserves the right to revoke points obtained through fraudulent activity.
          </div>
        )}
      </div>
    </BuyerLayout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)',
        textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 700, color: color ?? 'var(--color-text)' }}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: Referral['status'] }) {
  const map = {
    pending:   { bg: 'var(--color-warning)', label: 'Pending'   },
    qualified: { bg: 'var(--color-success)', label: 'Qualified' },
    rewarded:  { bg: 'var(--color-primary)', label: 'Rewarded'  },
  } as const;
  const { bg, label } = map[status];
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px',
      background: `color-mix(in srgb, ${bg} 18%, transparent)`,
      color: bg, fontSize: 11, fontWeight: 700, borderRadius: 999,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>{label}</span>
  );
}

function SocialLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={shareBtnLight}>
      {icon}{label}
    </a>
  );
}

// ─── Style tokens ─────────────────────────────────────────────────────────────

const shareBtnLight: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'rgba(255,255,255,0.18)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.3)',
  fontSize: 13, fontWeight: 600,
  padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
  textDecoration: 'none',
};

const th: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: 'var(--color-text-secondary)',
};

const td: React.CSSProperties = {
  padding: '12px 14px', color: 'var(--color-text)',
};
