/**
 * app/enquiries/page.tsx
 * Advisor — incoming consultation requests inbox.
 * Spec ref: section 4.3 (Advisor Dashboard → /enquiries)
 *
 * Layout:
 *   Stats: Total | Pending | Responded
 *   Filter tabs: All | Pending | Responded
 *   Paginated card list: buyer avatar, name, subject, date, status
 *   Detail modal: full message, attached photos, reply textarea, [Send Reply]
 *     → addDoc to messages/{convId}/items
 *     → updateDoc enquiry status: 'responded'
 *     → updateDoc enquiry.replies++ on advicePost (if linked)
 *
 * Firestore schema:
 *   advisorEnquiries/{id}
 *     advisorId:  string
 *     buyerId:    string
 *     buyerName:  string
 *     buyerPhoto?: string
 *     subject:    string
 *     message:    string
 *     photos?:    string[]
 *     status:     'pending' | 'responded'
 *     createdAt:  Timestamp
 *     repliedAt?: Timestamp
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter }                                 from 'next/navigation';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import {
  HelpCircle,
  Clock,
  CheckCircle,
  X,
  Send,
  Loader2,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  InboxIcon,
} from 'lucide-react';
import { db }           from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { RoleGuard }    from '@/components/guards/RoleGuard';
import AdvisorLayout    from '@/components/layouts/AdvisorLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

type EnquiryStatus = 'pending' | 'responded';
type FilterTab     = 'all' | 'pending' | 'responded';

interface Enquiry {
  id:          string;
  advisorId:   string;
  buyerId:     string;
  buyerName:   string;
  buyerPhoto?: string;
  subject:     string;
  message:     string;
  photos?:     string[];
  status:      EnquiryStatus;
  createdAt?:  { seconds: number };
  repliedAt?:  { seconds: number };
}

interface Stats {
  total:     number;
  pending:   number;
  responded: number;
}

const PAGE_SIZE = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function convId(a: string, b: string) {
  return [a, b].sort().join('_');
}

function timeAgo(seconds: number): string {
  const diff = (Date.now() - seconds * 1000) / 1000;
  if (diff < 60)       return 'just now';
  if (diff < 3600)     return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)   return `${Math.floor(diff / 86400)}d ago`;
  return new Date(seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, accent, loading }: {
  label: string; value: number; icon: React.ReactNode; accent: string; loading: boolean;
}) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: `color-mix(in srgb, ${accent} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        {loading
          ? <div style={{ width: 52, height: 22, borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
          : <p style={{ margin: 0, fontWeight: 800, fontSize: 'var(--text-2xl)', color: 'var(--color-text)', lineHeight: 1 }}>{value}</p>
        }
        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-3)', fontWeight: 500 }}>{label}</p>
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EnquiryStatus }) {
  const isPending = status === 'pending';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-xs)', fontWeight: 700,
      background: isPending
        ? 'color-mix(in srgb, #f59e0b 14%, transparent)'
        : 'color-mix(in srgb, var(--color-advisor, #10b981) 14%, transparent)',
      color: isPending ? '#f59e0b' : 'var(--color-advisor, #10b981)',
    }}>
      {isPending ? 'Pending' : 'Responded'}
    </span>
  );
}

// ─── Enquiry card ─────────────────────────────────────────────────────────────

function EnquiryCard({ enquiry, onClick }: { enquiry: Enquiry; onClick: () => void }) {
  const initial = enquiry.buyerName?.[0]?.toUpperCase() ?? '?';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start',
        padding: 'var(--space-4)',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)', cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.borderColor = 'var(--color-advisor, #10b981)';
        b.style.boxShadow   = '0 4px 16px var(--color-shadow)';
      }}
      onMouseLeave={(e) => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.borderColor = 'var(--color-border)';
        b.style.boxShadow   = '';
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%', background: 'var(--color-advisor, #10b981)',
        overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: 'var(--text-base)',
      }}>
        {enquiry.buyerPhoto
          ? <img src={enquiry.buyerPhoto} alt={enquiry.buyerName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initial}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
            {enquiry.buyerName}
          </p>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-3)', flexShrink: 0 }}>
            {enquiry.createdAt ? timeAgo(enquiry.createdAt.seconds) : ''}
          </span>
        </div>
        <p style={{ margin: '0 0 var(--space-1)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {enquiry.subject}
        </p>
        <p style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-2)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5 }}>
          {enquiry.message}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <StatusBadge status={enquiry.status} />
          {enquiry.photos?.length ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 'var(--text-xs)', color: 'var(--color-text-3)' }}>
              <ImageIcon size={11} /> {enquiry.photos.length} photo{enquiry.photos.length > 1 ? 's' : ''}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

function EnquiryModal({
  enquiry,
  advisorId,
  advisorName,
  onClose,
  onReplied,
}: {
  enquiry:     Enquiry;
  advisorId:   string;
  advisorName: string;
  onClose:     () => void;
  onReplied:   (id: string) => void;
}) {
  const [reply, setReply]     = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(enquiry.status === 'responded');
  const [error, setError]     = useState('');

  async function handleSend() {
    if (!reply.trim()) return;
    setSending(true);
    setError('');
    try {
      const cid = convId(advisorId, enquiry.buyerId);

      // Ensure conversation doc exists
      await setDoc(doc(db, 'messages', cid), {
        participants:      [advisorId, enquiry.buyerId],
        participantNames:  { [advisorId]: advisorName, [enquiry.buyerId]: enquiry.buyerName },
        participantPhotos: { [advisorId]: '', [enquiry.buyerId]: enquiry.buyerPhoto ?? '' },
        lastMessage:       reply.trim(),
        lastAt:            serverTimestamp(),
        unread:            { [advisorId]: 0, [enquiry.buyerId]: 1 },
      }, { merge: true });

      // Send message
      await addDoc(collection(db, 'messages', cid, 'items'), {
        senderId:  advisorId,
        type:      'text',
        text:      reply.trim(),
        createdAt: serverTimestamp(),
        delivered: false,
        read:      false,
      });

      // Mark enquiry as responded
      await updateDoc(doc(db, 'advisorEnquiries', enquiry.id), {
        status:    'responded',
        repliedAt: serverTimestamp(),
      });

      onReplied(enquiry.id);
      setSent(true);
      setReply('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 1 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
              Consultation Request
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-3)' }}>
              from {enquiry.buyerName}{enquiry.createdAt ? ` · ${timeAgo(enquiry.createdAt.seconds)}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <StatusBadge status={sent ? 'responded' : enquiry.status} />
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={15} />
            </button>
          </div>
        </div>

        <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Buyer info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-advisor, #10b981)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
              {enquiry.buyerPhoto
                ? <img src={enquiry.buyerPhoto} alt={enquiry.buyerName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : enquiry.buyerName?.[0]?.toUpperCase()}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text)' }}>{enquiry.buyerName}</p>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-3)' }}>Buyer</p>
            </div>
          </div>

          {/* Subject */}
          <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)' }}>
            <p style={{ margin: '0 0 2px', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subject</p>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-primary)' }}>{enquiry.subject}</p>
          </div>

          {/* Message */}
          <div>
            <p style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Message</p>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{enquiry.message}</p>
          </div>

          {/* Attached photos */}
          {enquiry.photos && enquiry.photos.length > 0 && (
            <div>
              <p style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Attached Photos ({enquiry.photos.length})
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {enquiry.photos.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`attachment-${i}`}
                    onClick={() => window.open(url, '_blank')}
                    style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid var(--color-border)', transition: 'opacity 0.15s' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.85'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '1'; }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Reply section */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
            <p style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <MessageSquare size={15} style={{ color: 'var(--color-advisor, #10b981)' }} />
              {sent ? 'Reply Sent' : 'Reply via Direct Message'}
            </p>

            {sent ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3)', background: 'color-mix(in srgb, var(--color-advisor, #10b981) 10%, transparent)', borderRadius: 'var(--radius-md)' }}>
                <CheckCircle size={16} style={{ color: 'var(--color-advisor, #10b981)' }} />
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-advisor, #10b981)', fontWeight: 600 }}>
                  Your reply has been sent to {enquiry.buyerName}.
                </p>
              </div>
            ) : (
              <>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={4}
                  placeholder={`Write your reply to ${enquiry.buyerName}…`}
                  style={{
                    width: '100%', padding: 'var(--space-3)',
                    background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', color: 'var(--color-text)',
                    fontSize: 'var(--text-sm)', outline: 'none', resize: 'vertical',
                    boxSizing: 'border-box', lineHeight: 1.6,
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--color-advisor, #10b981)'; }}
                  onBlur={(e)  => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--color-border)'; }}
                />
                {error && <p style={{ margin: '4px 0 0', color: 'var(--color-error, #ef4444)', fontSize: 'var(--text-xs)' }}>{error}</p>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
                  <button
                    onClick={handleSend}
                    disabled={!reply.trim() || sending}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
                      padding: 'var(--space-2) var(--space-5)',
                      background: 'var(--color-advisor, #10b981)', border: 'none',
                      borderRadius: 'var(--radius-md)', color: '#fff',
                      fontWeight: 700, fontSize: 'var(--text-sm)',
                      cursor: !reply.trim() || sending ? 'not-allowed' : 'pointer',
                      opacity: !reply.trim() || sending ? 0.6 : 1,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {sending ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
                    {sending ? 'Sending…' : 'Send Reply'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-4)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', alignItems: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: 140, height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite', marginBottom: 6 }} />
        <div style={{ width: '80%', height: 12, borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite', marginBottom: 4 }} />
        <div style={{ width: '60%', height: 10, borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EnquiriesPage() {
  const user   = useAuthStore((s) => s.user);
  const router = useRouter();
  const uid    = user?.uid ?? '';

  const [enquiries, setEnquiries]   = useState<Enquiry[]>([]);
  const [stats, setStats]           = useState<Stats>({ total: 0, pending: 0, responded: 0 });
  const [loading, setLoading]       = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [filter, setFilter]         = useState<FilterTab>('all');
  const [hasMore, setHasMore]       = useState(false);
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState<Enquiry | null>(null);

  const lastDocRef   = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const pageStackRef = useRef<QueryDocumentSnapshot<DocumentData>[]>([]);

  // Load stats (all, no pagination)
  useEffect(() => {
    if (!uid) return;
    async function load() {
      setStatsLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'advisorEnquiries'), where('advisorId', '==', uid)));
        let pending = 0, responded = 0;
        snap.docs.forEach((d) => {
          if (d.data().status === 'pending') pending++;
          else responded++;
        });
        setStats({ total: snap.size, pending, responded });
      } finally {
        setStatsLoading(false);
      }
    }
    load();
  }, [uid]);

  const loadPage = useCallback(async (cursor: QueryDocumentSnapshot<DocumentData> | null, tab: FilterTab) => {
    if (!uid) return;
    setLoading(true);
    try {
      const constraints = [
        where('advisorId', '==', uid),
        ...(tab !== 'all' ? [where('status', '==', tab)] : []),
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(PAGE_SIZE + 1),
      ] as Parameters<typeof query>[1][];

      const q    = query(collection(db, 'advisorEnquiries'), ...constraints);
      const snap = await getDocs(q);
      const docs = snap.docs.slice(0, PAGE_SIZE);
      setHasMore(snap.docs.length > PAGE_SIZE);
      lastDocRef.current = docs[docs.length - 1] ?? null;
      setEnquiries(docs.map((d) => ({ id: d.id, ...d.data() } as Enquiry)));
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (uid) {
      pageStackRef.current = [];
      setPage(1);
      loadPage(null, filter);
    }
  }, [uid, filter, loadPage]);

  function nextPage() {
    if (!lastDocRef.current) return;
    pageStackRef.current.push(lastDocRef.current);
    setPage((p) => p + 1);
    loadPage(lastDocRef.current, filter);
  }

  function prevPage() {
    const stack = pageStackRef.current;
    stack.pop();
    setPage((p) => p - 1);
    loadPage(stack[stack.length - 1] ?? null, filter);
  }

  // After reply, flip status in local list
  function handleReplied(id: string) {
    setEnquiries((prev) => prev.map((e) => e.id === id ? { ...e, status: 'responded' } : e));
    setStats((s) => ({ ...s, pending: Math.max(0, s.pending - 1), responded: s.responded + 1 }));
  }

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'all',       label: 'All' },
    { id: 'pending',   label: `Pending (${stats.pending})` },
    { id: 'responded', label: 'Responded' },
  ];

  return (
    <RoleGuard allowedRoles={['advisor']}>
      <AdvisorLayout>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg)', background: 'color-mix(in srgb, var(--color-advisor, #10b981) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-advisor, #10b981)', flexShrink: 0 }}>
              <HelpCircle size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text)' }}>Enquiries</h1>
              <p style={{ margin: '2px 0 0', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
                Incoming consultation requests from buyers.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            <StatCard label="Total"     value={stats.total}     icon={<InboxIcon    size={20} />} accent="var(--color-primary)"           loading={statsLoading} />
            <StatCard label="Pending"   value={stats.pending}   icon={<Clock        size={20} />} accent="#f59e0b"                        loading={statsLoading} />
            <StatCard label="Responded" value={stats.responded} icon={<CheckCircle  size={20} />} accent="var(--color-advisor, #10b981)"  loading={statsLoading} />
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--color-border)', marginBottom: 'var(--space-4)', gap: 0 }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  background: 'none', border: 'none',
                  borderBottom: filter === tab.id ? '2px solid var(--color-advisor, #10b981)' : '2px solid transparent',
                  marginBottom: -2,
                  color: filter === tab.id ? 'var(--color-advisor, #10b981)' : 'var(--color-text-2)',
                  fontWeight: filter === tab.id ? 700 : 500,
                  fontSize: 'var(--text-sm)', cursor: 'pointer',
                  transition: 'color 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* List */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : enquiries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-16) 0' }}>
              <HelpCircle size={48} style={{ color: 'var(--color-text-3)', opacity: 0.3, marginBottom: 'var(--space-3)' }} />
              <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                {filter === 'pending' ? 'No pending enquiries' : filter === 'responded' ? 'No responded enquiries' : 'No enquiries yet'}
              </p>
              <p style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
                {filter === 'all' ? 'Enquiries from buyers will appear here once they contact you.' : 'Try switching to a different filter.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {enquiries.map((e) => (
                <EnquiryCard key={e.id} enquiry={e} onClick={() => setSelected(e)} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && enquiries.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-6)' }}>
              <p style={{ margin: 0, color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>Page {page}</p>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button onClick={prevPage} disabled={page === 1}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-1) var(--space-3)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: page === 1 ? 'var(--color-text-3)' : 'var(--color-text)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}>
                  <ChevronLeft size={15} /> Prev
                </button>
                <button onClick={nextPage} disabled={!hasMore}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-1) var(--space-3)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: !hasMore ? 'var(--color-text-3)' : 'var(--color-text)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: !hasMore ? 'not-allowed' : 'pointer', opacity: !hasMore ? 0.5 : 1 }}>
                  Next <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail modal */}
        {selected && (
          <EnquiryModal
            enquiry={selected}
            advisorId={uid}
            advisorName={user?.displayName ?? ''}
            onClose={() => setSelected(null)}
            onReplied={handleReplied}
          />
        )}

        <style>{`
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
          @keyframes spin  { to{transform:rotate(360deg)} }
        `}</style>
      </AdvisorLayout>
    </RoleGuard>
  );
}
