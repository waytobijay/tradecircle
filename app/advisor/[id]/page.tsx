/**
 * app/advisor/[id]/page.tsx
 * Public advisor profile page.
 * Spec ref: section 6.5 (Advisor Profile)
 *
 * Tabs:
 *   1. Advice Posts — paginated list of published guides
 *   2. About        — bio, specialty, contact info
 *   3. Contact Me   — enquiry form (React Hook Form + Zod)
 *
 * Firestore:
 *   users/{id}                            — advisor profile
 *   advicePosts (where advisorId == id, published == true)
 *   advisorEnquiries                      — write-only on submit
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
  increment,
  updateDoc,
} from 'firebase/firestore';
import {
  User,
  BookOpen,
  MessageSquare,
  MapPin,
  Calendar,
  ChevronRight,
  Image as ImageIcon,
  Paperclip,
  X,
  Send,
  AlertCircle,
  CheckCircle,
  Eye,
} from 'lucide-react';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import BuyerLayout from '@/components/layouts/BuyerLayout';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import FollowButton from '@/components/ui/FollowButton';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import type { User as UserType, AdvicePost } from '@/types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type ActiveTab = 'posts' | 'about' | 'contact';

// ─────────────────────────────────────────────
// Contact form schema
// ─────────────────────────────────────────────

const enquirySchema = z.object({
  name:    z.string().min(2, 'Name must be at least 2 characters'),
  email:   z.string().email('Enter a valid email address'),
  phone:   z.string().optional(),
  topic:   z.string().min(3, 'Enter a topic or subject'),
  message: z.string().min(20, 'Message must be at least 20 characters'),
});

type EnquiryForm = z.infer<typeof enquirySchema>;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatMemberSince(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString('en-AU', {
    month: 'long', year: 'numeric',
  });
}

function timeAgo(seconds: number): string {
  const diff = (Date.now() / 1000) - seconds;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(seconds * 1000).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─────────────────────────────────────────────
// Advice Post list item
// ─────────────────────────────────────────────

function AdvicePostCard({ post }: { post: AdvicePost }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/advice/${post.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        gap: 16,
        padding: '16px 0',
        borderBottom: '1px solid var(--color-border)',
        textDecoration: 'none',
        transition: 'opacity 0.15s',
        opacity: hovered ? 0.8 : 1,
      }}
    >
      {/* Cover image or placeholder */}
      <div style={{
        width: 88,
        height: 66,
        borderRadius: 10,
        overflow: 'hidden',
        flexShrink: 0,
        background: 'var(--color-bg-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {post.steps[0]?.images[0] ? (
          <img
            src={post.steps[0].images[0]}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <BookOpen size={24} color="var(--color-text-secondary)" />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: '0 0 4px',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--color-text)',
          display: '-webkit-box',
          WebkitLineClamp: 1,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {post.title}
        </p>
        <p style={{
          margin: '0 0 8px',
          fontSize: 13,
          color: 'var(--color-text-secondary)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          lineHeight: 1.45,
        }}>
          {post.description}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 20,
            background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
            color: 'var(--color-primary)',
          }}>
            {post.subject}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            {timeAgo(post.createdAt.seconds)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            <Eye size={11} />
            {post.views ?? 0}
          </span>
        </div>
      </div>

      <ChevronRight size={16} color="var(--color-text-tertiary)" style={{ flexShrink: 0, marginTop: 4 }} />
    </Link>
  );
}

// ─────────────────────────────────────────────
// Contact tab — enquiry form
// ─────────────────────────────────────────────

interface ContactTabProps {
  advisorId: string;
  advisorName: string;
}

function ContactTab({ advisorId, advisorName }: ContactTabProps) {
  const { user } = useAuthStore();

  const [attachments, setAttachments]   = useState<File[]>([]);
  const [submitting, setSubmitting]     = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [submitError, setSubmitError]   = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EnquiryForm>({
    resolver: zodResolver(enquirySchema),
    defaultValues: {
      name:  user?.name  ?? '',
      email: user?.email ?? '',
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const valid = files.filter((f) => {
      if (f.size > 10 * 1024 * 1024) return false; // max 10MB
      if (!f.type.startsWith('image/')) return false;
      return true;
    });
    setAttachments((prev) => {
      const combined = [...prev, ...valid];
      return combined.slice(0, 3); // max 3
    });
    // reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async (data: EnquiryForm) => {
    setSubmitting(true);
    setSubmitError('');
    try {
      // In production: upload attachments to Cloudinary first, then store URLs
      // For now: store placeholder strings (uploadUrls would be returned by Cloudinary)
      const attachmentUrls: string[] = attachments.map((f) => f.name);

      await addDoc(collection(db, 'advisorEnquiries'), {
        fromUserId:  user?.uid ?? 'guest',
        toAdvisorId: advisorId,
        name:        data.name,
        email:       data.email,
        phone:       data.phone ?? '',
        topic:       data.topic,
        message:     data.message,
        attachments: attachmentUrls,
        status:      'pending',
        createdAt:   serverTimestamp(),
      });

      // Increment enquiries count on advisor's sellerAnalytics doc (best-effort)
      try {
        await updateDoc(doc(db, 'sellerAnalytics', advisorId), {
          totalEnquiries: increment(1),
        });
      } catch {
        // silently ignore — doc may not exist yet
      }

      setSubmitted(true);
      reset();
      setAttachments([]);
    } catch (err) {
      console.error('[ContactTab] submit error', err);
      setSubmitError('Failed to send. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <CheckCircle size={30} color="var(--color-success)" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
          Enquiry Sent!
        </h3>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--color-text-secondary)' }}>
          {advisorName} will respond to your enquiry soon.
        </p>
        <button
          onClick={() => setSubmitted(false)}
          style={{
            padding: '8px 20px',
            background: 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Send Another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: 560 }}>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
        Send an enquiry to <strong style={{ color: 'var(--color-text)' }}>{advisorName}</strong>. They typically respond within 24–48 hours.
      </p>

      {/* Name */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
          Your Name <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <input
          {...register('name')}
          placeholder="Full name"
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'var(--color-bg-secondary)',
            border: `1px solid ${errors.name ? 'var(--color-danger)' : 'var(--color-border)'}`,
            borderRadius: 8,
            fontSize: 14,
            color: 'var(--color-text)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {errors.name && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-danger)' }}>
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Email */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
          Email Address <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <input
          {...register('email')}
          type="email"
          placeholder="you@example.com"
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'var(--color-bg-secondary)',
            border: `1px solid ${errors.email ? 'var(--color-danger)' : 'var(--color-border)'}`,
            borderRadius: 8,
            fontSize: 14,
            color: 'var(--color-text)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {errors.email && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-danger)' }}>
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Phone (optional) */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
          Phone <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-tertiary)' }}>(optional)</span>
        </label>
        <input
          {...register('phone')}
          type="tel"
          placeholder="+61 400 000 000"
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            fontSize: 14,
            color: 'var(--color-text)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Topic */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
          Topic / Subject <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <input
          {...register('topic')}
          placeholder="e.g. Business registration advice"
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'var(--color-bg-secondary)',
            border: `1px solid ${errors.topic ? 'var(--color-danger)' : 'var(--color-border)'}`,
            borderRadius: 8,
            fontSize: 14,
            color: 'var(--color-text)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {errors.topic && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-danger)' }}>
            {errors.topic.message}
          </p>
        )}
      </div>

      {/* Message */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
          Message <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <textarea
          {...register('message')}
          rows={5}
          placeholder="Describe what you'd like to ask or discuss…"
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'var(--color-bg-secondary)',
            border: `1px solid ${errors.message ? 'var(--color-danger)' : 'var(--color-border)'}`,
            borderRadius: 8,
            fontSize: 14,
            color: 'var(--color-text)',
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.5,
            boxSizing: 'border-box',
          }}
        />
        {errors.message && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-danger)' }}>
            {errors.message.message}
          </p>
        )}
      </div>

      {/* Attachments */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
          Photos{' '}
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-tertiary)' }}>
            (optional, max 3, 10MB each)
          </span>
        </label>

        {attachments.length < 3 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'var(--color-bg-secondary)',
              border: '1.5px dashed var(--color-border)',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--color-text-secondary)',
              marginBottom: attachments.length ? 10 : 0,
            }}
          >
            <Paperclip size={15} />
            Attach photo
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {attachments.map((file, idx) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  width: 72,
                  height: 72,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid var(--color-border)',
                }}
              >
                <img
                  src={URL.createObjectURL(file)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 20, height: 20,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.65)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  <X size={11} color="#fff" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {submitError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px',
          background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          color: 'var(--color-danger)',
        }}>
          <AlertCircle size={15} />
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 28px',
          background: submitting ? 'var(--color-bg-tertiary)' : 'var(--color-primary)',
          color: submitting ? 'var(--color-text-secondary)' : '#fff',
          border: 'none',
          borderRadius: 10,
          cursor: submitting ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          fontSize: 15,
          transition: 'background 0.15s',
        }}
      >
        {submitting ? (
          <>
            <div style={{
              width: 16, height: 16,
              border: '2px solid var(--color-text-secondary)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'adv-spin 0.6s linear infinite',
            }} />
            Sending…
          </>
        ) : (
          <>
            <Send size={16} />
            Send Enquiry
          </>
        )}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────
// About tab
// ─────────────────────────────────────────────

function AboutTab({ advisor }: { advisor: UserType }) {
  return (
    <div style={{ maxWidth: 600 }}>
      {advisor.bio ? (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
            About
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {advisor.bio}
          </p>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {advisor.specialty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <BookOpen size={16} color="var(--color-primary)" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Specialty</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{advisor.specialty}</p>
            </div>
          </div>
        )}

        {advisor.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <MapPin size={16} color="var(--color-primary)" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                {advisor.location.city}, {advisor.location.country}
              </p>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Calendar size={16} color="var(--color-primary)" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Member since</p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
              {formatMemberSince(advisor.createdAt.seconds)}
            </p>
          </div>
        </div>

        {advisor.email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <MessageSquare size={16} color="var(--color-primary)" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact</p>
              <a href={`mailto:${advisor.email}`} style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>
                {advisor.email}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

const POSTS_PAGE_SIZE = 10;

export default function AdvisorProfilePage() {
  const params = useParams<{ id: string }>();
  const advisorId = params?.id ?? '';

  const [advisor, setAdvisor]         = useState<UserType | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(true);
  const [notFound, setNotFound]       = useState(false);

  const [posts, setPosts]             = useState<AdvicePost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsHasMore, setPostsHasMore] = useState(true);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const [postCount, setPostCount]     = useState(0);

  const [activeTab, setActiveTab]     = useState<ActiveTab>('posts');

  const postsCursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const sentinelRef    = useRef<HTMLDivElement | null>(null);

  // ── Fetch advisor profile ──────────────────

  useEffect(() => {
    if (!advisorId) return;
    setAdvisorLoading(true);

    getDoc(doc(db, 'users', advisorId))
      .then((snap) => {
        if (!snap.exists() || snap.data().role !== 'advisor') {
          setNotFound(true);
          return;
        }
        setAdvisor({ ...(snap.data() as Omit<UserType, 'uid'>), uid: snap.id });
      })
      .catch((err) => {
        console.error('[AdvisorProfile] fetch error', err);
        setNotFound(true);
      })
      .finally(() => setAdvisorLoading(false));
  }, [advisorId]);

  // ── Fetch advice posts (first page) ───────

  const fetchPosts = useCallback(async (append: boolean) => {
    if (!advisorId) return;
    if (append) setPostsLoadingMore(true);
    else        setPostsLoading(true);

    try {
      let q = query(
        collection(db, 'advicePosts'),
        where('advisorId', '==', advisorId),
        where('published', '==', true),
        orderBy('createdAt', 'desc'),
        limit(POSTS_PAGE_SIZE)
      );
      if (append && postsCursorRef.current) {
        q = query(
          collection(db, 'advicePosts'),
          where('advisorId', '==', advisorId),
          where('published', '==', true),
          orderBy('createdAt', 'desc'),
          limit(POSTS_PAGE_SIZE),
          startAfter(postsCursorRef.current)
        );
      }

      const snap = await getDocs(q);

      if (snap.empty) {
        setPostsHasMore(false);
        if (!append) setPosts([]);
        return;
      }

      postsCursorRef.current = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < POSTS_PAGE_SIZE) setPostsHasMore(false);

      const fetched: AdvicePost[] = snap.docs.map((d) => ({
        ...(d.data() as Omit<AdvicePost, 'id'>),
        id: d.id,
      }));

      if (!append) setPostCount(fetched.length); // approximate — first page only
      setPosts((prev) => (append ? [...prev, ...fetched] : fetched));
    } catch (err) {
      console.error('[AdvisorProfile] posts fetch error', err);
    } finally {
      setPostsLoading(false);
      setPostsLoadingMore(false);
    }
  }, [advisorId]);

  useEffect(() => {
    postsCursorRef.current = null;
    setPostsHasMore(true);
    fetchPosts(false);
  }, [fetchPosts]);

  // Infinite scroll on posts tab
  useEffect(() => {
    if (activeTab !== 'posts') return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && postsHasMore && !postsLoadingMore && !postsLoading) {
          fetchPosts(true);
        }
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [activeTab, postsHasMore, postsLoadingMore, postsLoading, fetchPosts]);

  // ── Not found ─────────────────────────────

  if (!advisorLoading && notFound) {
    return (
      <BuyerLayout>
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <User size={48} color="var(--color-text-tertiary)" style={{ marginBottom: 16 }} />
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
            Advisor not found
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--color-text-secondary)' }}>
            This advisor profile doesn't exist or is no longer active.
          </p>
          <Link href="/advisors" style={{
            padding: '9px 22px',
            background: 'var(--color-primary)',
            color: '#fff',
            borderRadius: 9,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14,
          }}>
            Browse Advisors
          </Link>
        </div>
      </BuyerLayout>
    );
  }

  // ── Render ─────────────────────────────────

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'posts',   label: 'Advice Posts' },
    { key: 'about',   label: 'About' },
    { key: 'contact', label: 'Contact Me' },
  ];

  return (
    <>
      <style>{`
        @keyframes adv-spin { to { transform: rotate(360deg); } }
        .adv-tab-btn { background: none; border: none; cursor: pointer; transition: color 0.15s; }
        .adv-tab-btn:hover { color: var(--color-primary) !important; }
      `}</style>

      <BuyerLayout>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 0 80px' }}>

          {/* ── Profile header ──────────────────── */}
          {advisorLoading ? (
            <>
              <SkeletonLoader width="100%" height={160} />
              <div style={{ padding: '0 20px' }}>
                <SkeletonLoader
                  variant="avatar"
                  height={88}
                  style={{ marginTop: -44, marginBottom: 12, border: '4px solid var(--color-bg)' }}
                />
                <SkeletonLoader width={180} height={20} style={{ marginBottom: 8 }} />
                <SkeletonLoader width={120} height={14} />
              </div>
            </>
          ) : advisor ? (
            <>
              {/* Cover */}
              <div style={{
                height: 160,
                background: advisor.coverPhoto
                  ? `url(${advisor.coverPhoto}) center/cover no-repeat`
                  : 'linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 60%, transparent) 100%)',
              }} />

              {/* Avatar + info */}
              <div style={{ padding: '0 20px 0', position: 'relative' }}>
                {/* Avatar */}
                <div style={{
                  width: 88, height: 88,
                  borderRadius: '50%',
                  border: '4px solid var(--color-bg)',
                  background: advisor.profilePhoto
                    ? `url(${advisor.profilePhoto}) center/cover no-repeat`
                    : 'var(--color-bg-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: -44,
                  marginBottom: 10,
                  overflow: 'hidden',
                }}>
                  {!advisor.profilePhoto && (
                    <User size={36} color="var(--color-text-secondary)" />
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <div>
                    <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {advisor.name}
                      {advisor.verified && (
                        <VerifiedBadge size="md" label="Verified Advisor" />
                      )}
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {advisor.specialty && (
                        <span style={{
                          fontSize: 12, fontWeight: 600, padding: '3px 10px',
                          borderRadius: 20,
                          background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                          color: 'var(--color-primary)',
                        }}>
                          {advisor.specialty}
                        </span>
                      )}
                      <span style={{
                        fontSize: 12, fontWeight: 600, padding: '3px 10px',
                        borderRadius: 20,
                        background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
                        color: 'var(--color-success)',
                      }}>
                        Advisor
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FollowButton
                      targetUid={advisor.uid}
                      targetName={advisor.name}
                      targetRole="advisor"
                      targetPhoto={advisor.profilePhoto}
                      size="md"
                    />
                    <button
                      onClick={() => setActiveTab('contact')}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '9px 20px',
                        background: 'var(--color-primary)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 9,
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      <MessageSquare size={15} />
                      Contact
                    </button>
                  </div>
                </div>

                {/* Stats row */}
                <div style={{
                  display: 'flex',
                  gap: 24,
                  paddingBottom: 16,
                  borderBottom: '1px solid var(--color-border)',
                  flexWrap: 'wrap',
                }}>
                  {[
                    { label: 'Posts', value: posts.length },
                    { label: 'Member since', value: formatMemberSince(advisor.createdAt.seconds) },
                    ...(advisor.location
                      ? [{ label: 'Location', value: `${advisor.location.city}, ${advisor.location.country}` }]
                      : []
                    ),
                  ].map((stat) => (
                    <div key={stat.label}>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {stat.label}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {/* ── Tabs ────────────────────────────── */}
          <div style={{
            display: 'flex',
            gap: 0,
            padding: '0 20px',
            borderBottom: '1px solid var(--color-border)',
            marginTop: 4,
          }}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className="adv-tab-btn"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '12px 20px',
                  fontSize: 14,
                  fontWeight: activeTab === tab.key ? 700 : 500,
                  color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  borderBottom: activeTab === tab.key
                    ? '2px solid var(--color-primary)'
                    : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab content ─────────────────────── */}
          <div style={{ padding: '24px 20px' }}>

            {/* Posts tab */}
            {activeTab === 'posts' && (
              <>
                {postsLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--color-border)' }}>
                        <SkeletonLoader width={88} height={66} borderRadius={10} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <SkeletonLoader width="70%" height={15} style={{ marginBottom: 8 }} />
                          <SkeletonLoader width="90%" height={12} style={{ marginBottom: 4 }} />
                          <SkeletonLoader width="80%" height={12} style={{ marginBottom: 10 }} />
                          <SkeletonLoader width={80} height={18} borderRadius={20} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : posts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <BookOpen size={36} color="var(--color-text-tertiary)" style={{ marginBottom: 12 }} />
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)' }}>
                      No published advice posts yet.
                    </p>
                  </div>
                ) : (
                  <>
                    {posts.map((post) => (
                      <AdvicePostCard key={post.id} post={post} />
                    ))}

                    {postsLoadingMore && (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                        <div style={{
                          width: 24, height: 24,
                          border: '3px solid var(--color-border)',
                          borderTopColor: 'var(--color-primary)',
                          borderRadius: '50%',
                          animation: 'adv-spin 0.7s linear infinite',
                        }} />
                      </div>
                    )}

                    {!postsHasMore && posts.length > 0 && (
                      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                        All posts loaded
                      </p>
                    )}

                    <div ref={sentinelRef} style={{ height: 1 }} />
                  </>
                )}
              </>
            )}

            {/* About tab */}
            {activeTab === 'about' && advisor && (
              <AboutTab advisor={advisor} />
            )}

            {/* Contact tab */}
            {activeTab === 'contact' && advisor && (
              <ContactTab advisorId={advisorId} advisorName={advisor.name} />
            )}
          </div>
        </div>
      </BuyerLayout>
    </>
  );
}
