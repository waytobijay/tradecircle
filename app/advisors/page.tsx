'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import {
  Search,
  BookOpen,
  GraduationCap,
  MessageSquare,
  X,
  Send,
  CheckCircle,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import BuyerLayout from '@/components/layouts/BuyerLayout';
import type { User } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdvisorData extends User {
  postCount?: number;
}

const SPECIALTIES = [
  'All',
  'Financial',
  'Legal',
  'Agricultural',
  'Trade',
  'Technology',
] as const;

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'var(--color-border)',
          animation: 'tc-pulse 1.4s ease-in-out infinite',
          margin: '0 auto',
        }}
      />
      <div
        style={{
          width: '60%',
          height: 16,
          borderRadius: 8,
          background: 'var(--color-border)',
          animation: 'tc-pulse 1.4s ease-in-out infinite',
          margin: '0 auto',
        }}
      />
      <div
        style={{
          width: '40%',
          height: 12,
          borderRadius: 8,
          background: 'var(--color-border)',
          animation: 'tc-pulse 1.4s ease-in-out infinite',
          margin: '0 auto',
        }}
      />
      <div
        style={{
          width: '80%',
          height: 12,
          borderRadius: 8,
          background: 'var(--color-border)',
          animation: 'tc-pulse 1.4s ease-in-out infinite',
          margin: '0 auto',
        }}
      />
      <div
        style={{
          width: '80%',
          height: 12,
          borderRadius: 8,
          background: 'var(--color-border)',
          animation: 'tc-pulse 1.4s ease-in-out infinite',
          margin: '0 auto',
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <div
          style={{
            flex: 1,
            height: 36,
            borderRadius: 8,
            background: 'var(--color-border)',
            animation: 'tc-pulse 1.4s ease-in-out infinite',
          }}
        />
        <div
          style={{
            flex: 1,
            height: 36,
            borderRadius: 8,
            background: 'var(--color-border)',
            animation: 'tc-pulse 1.4s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  );
}

// ─── Contact modal ────────────────────────────────────────────────────────────

interface ContactModalProps {
  advisor: AdvisorData;
  currentUser: User | null;
  onClose: () => void;
}

function ContactModal({ advisor, currentUser, onClose }: ContactModalProps) {
  const [name, setName] = useState(currentUser?.name ?? '');
  const [email, setEmail] = useState(currentUser?.email ?? '');
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !topic.trim() || !message.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const { addDoc, collection: col, serverTimestamp } = await import('firebase/firestore');
      await addDoc(col(db, 'advisorEnquiries'), {
        fromUserId: currentUser?.uid ?? 'guest',
        toAdvisorId: advisor.uid,
        name: name.trim(),
        email: email.trim(),
        phone: '',
        topic: topic.trim(),
        message: message.trim(),
        attachments: [],
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch {
      setError('Failed to send. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--color-background)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    fontSize: 14,
    color: 'var(--color-text)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 16,
          padding: 28,
          maxWidth: 480,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={18} />
        </button>

        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
          Contact {advisor.name}
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Send an enquiry — they typically respond within 24–48 hours.
        </p>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'color-mix(in srgb, var(--color-success) 14%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <CheckCircle size={28} color="var(--color-success)" />
            </div>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)', margin: '0 0 8px' }}>
              Enquiry Sent!
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 20px' }}>
              {advisor.name} will be in touch soon.
            </p>
            <button
              onClick={onClose}
              style={{
                padding: '9px 24px',
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 5 }}>
                Your Name <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                style={inputStyle}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 5 }}>
                Email <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 5 }}>
                Topic <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Business registration advice"
                style={inputStyle}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 5 }}>
                Message <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Describe what you'd like to ask or discuss…"
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                required
              />
            </div>

            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--color-danger)',
                }}
              >
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '11px 24px',
                background: submitting ? 'var(--color-border)' : 'var(--color-primary)',
                color: submitting ? 'var(--color-text-secondary)' : '#fff',
                border: 'none',
                borderRadius: 9,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: 14,
                transition: 'background 0.15s',
              }}
            >
              {submitting ? (
                <>
                  <div
                    style={{
                      width: 15,
                      height: 15,
                      border: '2px solid var(--color-text-secondary)',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'tc-spin 0.7s linear infinite',
                    }}
                  />
                  Sending…
                </>
              ) : (
                <>
                  <Send size={15} />
                  Send Enquiry
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Advisor card ─────────────────────────────────────────────────────────────

interface AdvisorCardProps {
  advisor: AdvisorData;
  onContact: (advisor: AdvisorData) => void;
}

function AdvisorCard({ advisor, onContact }: AdvisorCardProps) {
  const initials = advisor.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const memberSince = advisor.createdAt
    ? new Date(advisor.createdAt.seconds * 1000).toLocaleDateString('en-AU', {
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 0,
        transition: 'box-shadow 0.18s, border-color 0.18s, transform 0.18s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)';
        el.style.borderColor = 'var(--color-primary)';
        el.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = '';
        el.style.borderColor = 'var(--color-border)';
        el.style.transform = '';
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: advisor.profilePhoto ? 'transparent' : 'var(--color-primary)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 800,
          fontSize: 26,
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        {advisor.profilePhoto ? (
          <img
            src={advisor.profilePhoto}
            alt={advisor.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          initials
        )}
      </div>

      {/* Name */}
      <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
        {advisor.name}
      </p>

      {/* Specialty badge */}
      {advisor.specialty && (
        <span
          style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: 20,
            background: 'color-mix(in srgb, #7c3aed 12%, transparent)',
            color: '#7c3aed',
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          {advisor.specialty}
        </span>
      )}

      {/* Bio excerpt */}
      {advisor.bio && (
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 13,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.55,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {advisor.bio}
        </p>
      )}

      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          marginBottom: 16,
          fontSize: 12,
          color: 'var(--color-text-secondary)',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <BookOpen size={13} />
          {advisor.postCount ?? 0} posts
        </span>
        {memberSince && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Calendar size={13} />
            {memberSince}
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 'auto' }}>
        <Link
          href={`/advisor/${advisor.uid}`}
          style={{
            flex: 1,
            padding: '9px 0',
            background: 'var(--color-background)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            color: 'var(--color-text)',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            textAlign: 'center',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--color-primary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--color-border)'; }}
        >
          View Profile
        </Link>
        <button
          onClick={() => onContact(advisor)}
          style={{
            flex: 1,
            padding: '9px 0',
            background: 'var(--color-primary)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
        >
          <MessageSquare size={13} />
          Contact
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FindAdvisorPage() {
  const user = useAuthStore((s) => s.user);

  const [advisors, setAdvisors] = useState<AdvisorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('All');
  const [contactTarget, setContactTarget] = useState<AdvisorData | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input 400ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Load advisors from Firestore
  const loadAdvisors = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'advisor'),
        limit(20),
      );
      const snap = await getDocs(q);

      // Load post counts in parallel
      const advisorList: AdvisorData[] = await Promise.all(
        snap.docs.map(async (d) => {
          const data = { ...(d.data() as Omit<User, 'uid'>), uid: d.id } as AdvisorData;
          try {
            const { getDocs: gd, query: qr, collection: col, where: wh } = await import('firebase/firestore');
            const postsSnap = await gd(qr(col(db, 'advicePosts'), wh('advisorId', '==', d.id), wh('published', '==', true)));
            data.postCount = postsSnap.size;
          } catch {
            data.postCount = 0;
          }
          return data;
        }),
      );

      setAdvisors(advisorList);
    } catch (err) {
      console.error('[FindAdvisor] load error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAdvisors();
  }, [loadAdvisors]);

  // Client-side filter
  const filtered = advisors.filter((a) => {
    const q = debouncedSearch.toLowerCase();
    const matchSearch =
      !q ||
      a.name.toLowerCase().includes(q) ||
      (a.specialty?.toLowerCase().includes(q) ?? false);
    const matchSpecialty =
      specialty === 'All' || a.specialty?.toLowerCase() === specialty.toLowerCase();
    return matchSearch && matchSpecialty;
  });

  return (
    <BuyerLayout>
      <style>{`
        @keyframes tc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        @keyframes tc-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px 64px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <h1
            style={{
              margin: '0 0 8px',
              fontSize: 30,
              fontWeight: 800,
              color: 'var(--color-text)',
            }}
          >
            Find an Advisor
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 15 }}>
            Connect with specialists in financial, legal, agricultural, trade and technology advice.
          </p>
        </div>

        {/* Search + filter bar */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginBottom: 32,
            flexWrap: 'wrap',
          }}
        >
          {/* Search input */}
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-secondary)',
                pointerEvents: 'none',
              }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or specialty"
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 9,
                color: 'var(--color-text)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Specialty dropdown */}
          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            style={{
              padding: '10px 36px 10px 14px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 9,
              color: 'var(--color-text)',
              fontSize: 14,
              outline: 'none',
              cursor: 'pointer',
              minWidth: 180,
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
            }}
          >
            {SPECIALTIES.map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'All Specialties' : s}
              </option>
            ))}
          </select>
        </div>

        {/* Grid */}
        {loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <GraduationCap
              size={52}
              style={{ color: 'var(--color-text-secondary)', opacity: 0.3, marginBottom: 16 }}
            />
            <p
              style={{
                fontWeight: 700,
                fontSize: 16,
                color: 'var(--color-text)',
                margin: '0 0 6px',
              }}
            >
              No advisors found
            </p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, margin: 0 }}>
              Try adjusting your search or specialty filter.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            {filtered.map((advisor) => (
              <AdvisorCard
                key={advisor.uid}
                advisor={advisor}
                onContact={setContactTarget}
              />
            ))}
          </div>
        )}

        {/* Result count */}
        {!loading && filtered.length > 0 && (
          <p
            style={{
              textAlign: 'center',
              marginTop: 28,
              fontSize: 13,
              color: 'var(--color-text-secondary)',
            }}
          >
            Showing {filtered.length} advisor{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Contact modal */}
      {contactTarget && (
        <ContactModal
          advisor={contactTarget}
          currentUser={user}
          onClose={() => setContactTarget(null)}
        />
      )}
    </BuyerLayout>
  );
}
