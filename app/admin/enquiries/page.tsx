/**
 * app/admin/enquiries/page.tsx
 * Admin — Advisor Enquiries management
 * Spec ref: section 6.7 (Admin Portal > Enquiries)
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import {
  MessageCircle, Search, X, Phone, Mail, Paperclip,
  CheckCircle, Clock, Eye,
} from 'lucide-react';
import { db } from '@/services/firebase';
import AdminLayout from '@/components/layouts/AdminLayout';
import type { AdvisorEnquiry, EnquiryStatus } from '@/types';

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_ENQUIRIES: AdvisorEnquiry[] = [
  { id: 'enq001', fromUserId: 'u1', toAdvisorId: 'a1', name: 'Aisha Patel', email: 'aisha@example.com', phone: '+61 400 001 001', topic: 'Wool Export Regulations', message: 'Hi, I am interested in exporting fine wool from Australia to Nepal. Could you please advise on the regulatory requirements, customs documentation, and any trade agreements that might apply? I have a small farm in regional NSW and am looking to start exporting within the next 6 months.', attachments: ['doc1.pdf', 'farm-cert.jpg'], status: 'pending', createdAt: { seconds: 1716500000, nanoseconds: 0, toDate: () => new Date(1716500000000) } },
  { id: 'enq002', fromUserId: 'u2', toAdvisorId: 'a2', name: 'Marco Bianchi', email: 'marco@example.com', phone: '+61 400 002 002', topic: 'Market Entry Strategy', message: 'I am an Italian olive oil producer looking to enter the Australian market. What are the import requirements and how should I price my product competitively? Any advice on distribution channels would also be helpful.', attachments: ['product-sheet.pdf'], status: 'responded', createdAt: { seconds: 1716400000, nanoseconds: 0, toDate: () => new Date(1716400000000) } },
  { id: 'enq003', fromUserId: 'u3', toAdvisorId: 'a1', name: 'Lena Fischer', email: 'lena@example.com', phone: '+61 400 003 003', topic: 'Organic Certification Process', message: 'What is the process for getting organic certification in Australia? How long does it take and what are the costs involved? I have a vegetable farm and want to add value to my products.', attachments: [], status: 'pending', createdAt: { seconds: 1716300000, nanoseconds: 0, toDate: () => new Date(1716300000000) } },
  { id: 'enq004', fromUserId: 'u4', toAdvisorId: 'a3', name: 'John Kim', email: 'john@example.com', phone: '+61 400 004 004', topic: 'Dairy Trade Finance', message: 'I run a dairy cooperative and am exploring trade finance options for international sales. What instruments are commonly used and which banks specialize in this area?', attachments: ['financials.xlsx'], status: 'responded', createdAt: { seconds: 1716200000, nanoseconds: 0, toDate: () => new Date(1716200000000) } },
  { id: 'enq005', fromUserId: 'u5', toAdvisorId: 'a2', name: 'Sara Kim', email: 'sara@example.com', topic: 'Customs Duty Exemptions', message: 'Are there any customs duty exemptions for agricultural equipment imports? We are planning to purchase specialized harvesting machinery from Europe.', attachments: [], status: 'pending', createdAt: { seconds: 1716100000, nanoseconds: 0, toDate: () => new Date(1716100000000) } },
];

const ADVISOR_NAMES: Record<string, string> = {
  a1: 'Dr. Rachel Green',
  a2: 'James Thornton',
  a3: 'Mei Lin',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: { seconds: number } | undefined): string {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EnquiryStatus }) {
  const isPending = status === 'pending';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: isPending ? 'color-mix(in srgb, var(--color-warning) 14%, transparent)' : 'color-mix(in srgb, var(--color-success) 12%, transparent)',
      color: isPending ? 'var(--color-warning)' : 'var(--color-success)',
    }}>
      {isPending ? <Clock size={11} /> : <CheckCircle size={11} />}
      {isPending ? 'Pending' : 'Responded'}
    </span>
  );
}

// ─── View Modal ───────────────────────────────────────────────────────────────

function EnquiryModal({
  enquiry,
  advisorName,
  onClose,
  onMarkResponded,
}: {
  enquiry: AdvisorEnquiry;
  advisorName: string;
  onClose: () => void;
  onMarkResponded: () => void;
}) {
  const [marking, setMarking] = useState(false);

  async function handleMarkResponded() {
    setMarking(true);
    try {
      await updateDoc(doc(db, 'advisorEnquiries', enquiry.id), { status: 'responded' });
      onMarkResponded();
    } catch (err) {
      console.error(err);
    } finally {
      setMarking(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)', overflowY: 'auto', padding: '40px 16px',
    }}>
      <div style={{
        background: 'var(--color-background)', border: '1px solid var(--color-border)',
        borderRadius: 14, padding: 28, maxWidth: 560, width: '100%',
        boxShadow: '0 16px 48px rgba(0,0,0,0.16)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>{enquiry.topic}</h3>
            <div style={{ marginTop: 6 }}><StatusBadge status={enquiry.status} /></div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4, marginTop: -4 }}><X size={18} /></button>
        </div>

        {/* Sender info */}
        <div style={{ padding: 14, background: 'var(--color-surface)', borderRadius: 10, border: '1px solid var(--color-border)', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Sender Details</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text)' }}>
              <MessageCircle size={13} style={{ color: 'var(--color-text-secondary)' }} />
              <strong>{enquiry.name}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              <Mail size={13} /> {enquiry.email}
            </div>
            {enquiry.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                <Phone size={13} /> {enquiry.phone}
              </div>
            )}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Advisor: <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{advisorName}</span>
            &nbsp;·&nbsp;{formatDate(enquiry.createdAt)}
          </div>
        </div>

        {/* Message */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Message</div>
          <div style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.7, background: 'var(--color-surface)', borderRadius: 10, border: '1px solid var(--color-border)', padding: 14 }}>
            {enquiry.message}
          </div>
        </div>

        {/* Attachments */}
        {enquiry.attachments.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Attachments ({enquiry.attachments.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {enquiry.attachments.map((att, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  <Paperclip size={12} /> {att}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text)' }}>Close</button>
          {enquiry.status === 'pending' && (
            <button
              onClick={() => void handleMarkResponded()}
              disabled={marking}
              style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--color-success)', color: '#fff', cursor: marking ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: marking ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <CheckCircle size={14} /> {marking ? 'Marking…' : 'Mark as Responded'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminEnquiriesPage() {
  const [enquiries,     setEnquiries]     = useState<AdvisorEnquiry[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState<'All' | EnquiryStatus>('All');
  const [viewTarget,    setViewTarget]    = useState<AdvisorEnquiry | null>(null);
  const [advisorNames,  setAdvisorNames]  = useState<Record<string, string>>(ADVISOR_NAMES);

  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'advisorEnquiries'));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdvisorEnquiry));
      setEnquiries(data.length > 0 ? data : MOCK_ENQUIRIES);
    } catch {
      setEnquiries(MOCK_ENQUIRIES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchEnquiries(); }, [fetchEnquiries]);

  function handleMarkResponded() {
    if (!viewTarget) return;
    setEnquiries((prev) => prev.map((e) => e.id === viewTarget.id ? { ...e, status: 'responded' } : e));
    setViewTarget((prev) => prev ? { ...prev, status: 'responded' } : prev);
  }

  const filtered = enquiries.filter((e) => {
    if (statusFilter !== 'All' && e.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!e.name.toLowerCase().includes(q) && !e.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const total     = enquiries.length;
  const pending   = enquiries.filter((e) => e.status === 'pending').length;
  const responded = enquiries.filter((e) => e.status === 'responded').length;

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none',
  };

  return (
    <AdminLayout>
      <style>{`
        @keyframes shimmer { 0%{opacity:1} 50%{opacity:0.4} 100%{opacity:1} }
        .enq-row:hover td { background: var(--color-surface); }
        .enq-table { width:100%; border-collapse:collapse; }
        .enq-table th { text-align:left;font-size:11px;font-weight:600;letter-spacing:0.05em;color:var(--color-text-secondary);text-transform:uppercase;padding:10px 16px;border-bottom:1px solid var(--color-border);white-space:nowrap; }
        .enq-table td { font-size:13px;padding:13px 16px;border-bottom:1px solid var(--color-border);color:var(--color-text);vertical-align:middle; }
        .enq-table tr:last-child td { border-bottom:none; }
      `}</style>

      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>Advisor Enquiries</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>Review and manage enquiries sent to advisors</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
          {[
            { label: 'Total', value: total,     color: 'var(--color-primary)' },
            { label: 'Pending',    value: pending,   color: 'var(--color-warning)' },
            { label: 'Responded',  value: responded, color: 'var(--color-success)' },
          ].map((s) => (
            <div key={s.label} style={{ flex: '1 1 120px', padding: '16px 20px', background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, padding: 14, background: 'var(--color-surface)', borderRadius: 10, border: '1px solid var(--color-border)' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
            <input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 32, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'All' | EnquiryStatus)} style={inputStyle}>
            <option value="All">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="responded">Responded</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="enq-table">
              <thead>
                <tr>
                  <th>From Name</th>
                  <th>Email</th>
                  <th>Advisor</th>
                  <th>Topic</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {[100, 160, 120, 180, 80, 80, 60].map((w, j) => (
                        <td key={j} style={{ padding: '13px 16px' }}>
                          <div style={{ width: w, height: 13, borderRadius: 6, background: 'var(--color-border)', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-secondary)' }}>
                      <MessageCircle size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>No enquiries found</div>
                      <div style={{ fontSize: 12 }}>Try adjusting your filters.</div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((enq) => (
                    <tr key={enq.id} className="enq-row">
                      <td style={{ fontWeight: 600 }}>{enq.name}</td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{enq.email}</td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{advisorNames[enq.toAdvisorId] ?? enq.toAdvisorId}</td>
                      <td style={{ maxWidth: 200 }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{enq.topic}</div>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(enq.createdAt)}</td>
                      <td><StatusBadge status={enq.status} /></td>
                      <td>
                        <button
                          onClick={() => setViewTarget(enq)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--color-primary)' }}
                        >
                          <Eye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {viewTarget && (
        <EnquiryModal
          enquiry={viewTarget}
          advisorName={advisorNames[viewTarget.toAdvisorId] ?? viewTarget.toAdvisorId}
          onClose={() => setViewTarget(null)}
          onMarkResponded={handleMarkResponded}
        />
      )}
    </AdminLayout>
  );
}
