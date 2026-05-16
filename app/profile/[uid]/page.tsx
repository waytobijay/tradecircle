/**
 * app/profile/[uid]/page.tsx
 * Public profile — view another user's profile.
 * Spec ref: section 4.2 (User Profile)
 *
 * - If uid === own uid → redirect to /profile
 * - Header: cover | avatar | name | role badge | location | member since
 * - Actions: [Message] + role-specific CTA (Contact Advisor / View Products)
 * - Tabs by target role:
 *     Seller  → Products | About | Reviews
 *     Advisor → Advice   | About | Contact
 *     Buyer   → About
 */

'use client';

import { useEffect, useState }  from 'react';
import Link                     from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  MapPin,
  Star,
  MessageSquare,
  BookOpen,
  Package,
  Phone,
  Calendar,
  ExternalLink,
  Loader2,
  ChevronLeft,
} from 'lucide-react';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db }             from '@/services/firebase';
import { useAuthStore }   from '@/store/authStore';
import BuyerLayout        from '@/components/layouts/BuyerLayout';
import SellerLayout       from '@/components/layouts/SellerLayout';
import AdvisorLayout      from '@/components/layouts/AdvisorLayout';
import PublicLayout       from '@/components/layouts/PublicLayout';
import FollowButton       from '@/components/ui/FollowButton';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicUser {
  uid: string;
  displayName: string;
  email: string;
  role: 'buyer' | 'seller' | 'advisor';
  photoURL: string;
  coverURL?: string;
  bio?: string;
  city?: string;
  country?: string;
  phone?: string;
  brandName?: string;
  specialty?: string;
  createdAt?: { seconds: number };
  active?: boolean;
}

interface Product {
  id: string;
  name: string;
  price: number;
  images: string[];
  category: string;
  condition: string;
  city?: string;
  createdAt?: { seconds: number };
  active: boolean;
  views?: number;
}

interface AdvicePost {
  id: string;
  title: string;
  subject: string;
  coverImage?: string;
  createdAt?: { seconds: number };
  views?: number;
}

interface Review {
  id: string;
  buyerName: string;
  buyerPhoto?: string;
  rating: number;
  comment: string;
  createdAt?: { seconds: number };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-4)' }}>
      <div
        style={{
          height: 180,
          borderRadius: 'var(--radius-xl)',
          background: 'var(--color-surface-2)',
          marginBottom: 'var(--space-6)',
          animation: 'pulse 1.4s ease-in-out infinite',
        }}
      />
      <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: 'var(--color-surface-2)',
            animation: 'pulse 1.4s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              width: 180,
              height: 20,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface-2)',
              marginBottom: 'var(--space-2)',
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
          <div
            style={{
              width: 100,
              height: 14,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface-2)',
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Star row ─────────────────────────────────────────────────────────────────

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          fill={n <= rating ? 'var(--color-warning)' : 'transparent'}
          stroke={n <= rating ? 'var(--color-warning)' : 'var(--color-text-3)'}
        />
      ))}
    </span>
  );
}

// ─── Products tab ─────────────────────────────────────────────────────────────

function ProductsTab({ uid, currency }: { uid: string; currency: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const q   = query(
          collection(db, 'products'),
          where('sellerId', '==', uid),
          where('active', '==', true),
          orderBy('createdAt', 'desc'),
          limit(12),
        );
        const snap = await getDocs(q);
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [uid]);

  if (loading) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 220,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-surface-2)',
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-10) 0', color: 'var(--color-text-2)' }}>
        <Package size={40} style={{ marginBottom: 'var(--space-3)', opacity: 0.4 }} />
        <p>No products listed yet.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 'var(--space-3)',
      }}
    >
      {products.map((p) => (
        <Link
          key={p.id}
          href={`/products/${p.id}`}
          style={{ textDecoration: 'none' }}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              transition: 'transform 0.18s, box-shadow 0.18s',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px var(--color-shadow)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = '';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '';
            }}
          >
            <div style={{ position: 'relative', paddingBottom: '66%', background: 'var(--color-surface-2)' }}>
              {p.images?.[0] && (
                <img
                  src={p.images[0]}
                  alt={p.name}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              )}
            </div>
            <div style={{ padding: 'var(--space-3)' }}>
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text)',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.3,
                }}
              >
                {p.name}
              </p>
              <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                {currency} {p.price.toLocaleString()}
              </p>
              {p.city && (
                <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <MapPin size={11} /> {p.city}
                </p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Advice tab ───────────────────────────────────────────────────────────────

function AdviceTab({ uid }: { uid: string }) {
  const [posts, setPosts]   = useState<AdvicePost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const q   = query(
          collection(db, 'advicePosts'),
          where('advisorId', '==', uid),
          where('published', '==', true),
          orderBy('createdAt', 'desc'),
          limit(10),
        );
        const snap = await getDocs(q);
        setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdvicePost)));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [uid]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 80,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-surface-2)',
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-10) 0', color: 'var(--color-text-2)' }}>
        <BookOpen size={40} style={{ marginBottom: 'var(--space-3)', opacity: 0.4 }} />
        <p>No advice posts published yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/advice/${post.id}`}
          style={{ textDecoration: 'none' }}
        >
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-3)',
              transition: 'border-color 0.18s',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)';
            }}
          >
            {post.coverImage && (
              <img
                src={post.coverImage}
                alt={post.title}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 'var(--radius-md)',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  fontSize: 'var(--text-sm)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {post.title}
              </p>
              {post.subject && (
                <p style={{ margin: '2px 0 0', color: 'var(--color-text-2)', fontSize: 'var(--text-xs)' }}>
                  {post.subject}
                </p>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)', color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
                {post.views != null && <span>{post.views.toLocaleString()} views</span>}
                {post.createdAt && (
                  <span>
                    {new Date(post.createdAt.seconds * 1000).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>
            </div>
            <ExternalLink size={16} style={{ color: 'var(--color-text-3)', flexShrink: 0, alignSelf: 'center' }} />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Reviews tab ──────────────────────────────────────────────────────────────

function ReviewsTab({ uid }: { uid: string }) {
  const [reviews, setReviews]   = useState<Review[]>([]);
  const [loading, setLoading]   = useState(true);
  const [avgRating, setAvgRating] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const q    = query(
          collection(db, 'reviews'),
          where('sellerId', '==', uid),
          orderBy('createdAt', 'desc'),
          limit(20),
        );
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review));
        setReviews(data);
        if (data.length) {
          setAvgRating(data.reduce((s, r) => s + r.rating, 0) / data.length);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [uid]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 96,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-surface-2)',
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Summary */}
      {reviews.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            background: 'var(--color-surface-2)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <span style={{ fontSize: 40, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>
            {avgRating.toFixed(1)}
          </span>
          <div>
            <StarRow rating={Math.round(avgRating)} size={18} />
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
              {reviews.length} review{reviews.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* List */}
      {!reviews.length ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-10) 0', color: 'var(--color-text-2)' }}>
          <Star size={40} style={{ marginBottom: 'var(--space-3)', opacity: 0.4 }} />
          <p>No reviews yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {reviews.map((r) => (
            <div
              key={r.id}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    overflow: 'hidden',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  {r.buyerPhoto ? (
                    <img src={r.buyerPhoto} alt={r.buyerName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    r.buyerName?.[0]?.toUpperCase()
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                    {r.buyerName}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <StarRow rating={r.rating} />
                    {r.createdAt && (
                      <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
                        {new Date(r.createdAt.seconds * 1000).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {r.comment && (
                <p style={{ margin: 0, color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
                  {r.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── About tab ────────────────────────────────────────────────────────────────

function AboutTab({ user }: { user: PublicUser }) {
  const ROLE_COLOR: Record<string, string> = {
    buyer:   'var(--color-buyer,   #3b82f6)',
    seller:  'var(--color-seller,  #8b5cf6)',
    advisor: 'var(--color-advisor, #10b981)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Bio */}
      {user.bio && (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
          }}
        >
          <h4 style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
            About
          </h4>
          <p style={{ margin: 0, color: 'var(--color-text-2)', lineHeight: 1.6, fontSize: 'var(--text-sm)', whiteSpace: 'pre-line' }}>
            {user.bio}
          </p>
        </div>
      )}

      {/* Details card */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        {(user.city || user.country) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
            <MapPin size={15} style={{ color: ROLE_COLOR[user.role], flexShrink: 0 }} />
            <span>{[user.city, user.country].filter(Boolean).join(', ')}</span>
          </div>
        )}

        {user.phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
            <Phone size={15} style={{ color: ROLE_COLOR[user.role], flexShrink: 0 }} />
            <span>{user.phone}</span>
          </div>
        )}

        {user.createdAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
            <Calendar size={15} style={{ color: ROLE_COLOR[user.role], flexShrink: 0 }} />
            <span>
              Member since{' '}
              {new Date(user.createdAt.seconds * 1000).toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        )}

        {user.role === 'seller' && user.brandName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
            <Package size={15} style={{ color: ROLE_COLOR[user.role], flexShrink: 0 }} />
            <span>Brand: <strong style={{ color: 'var(--color-text)' }}>{user.brandName}</strong></span>
          </div>
        )}

        {user.role === 'advisor' && user.specialty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
            <BookOpen size={15} style={{ color: ROLE_COLOR[user.role], flexShrink: 0 }} />
            <span>Specialty: <strong style={{ color: 'var(--color-text)' }}>{user.specialty}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Contact Advisor tab ──────────────────────────────────────────────────────

function ContactAdvisorTab({ advisor }: { advisor: PublicUser }) {
  const router = useRouter();

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-6)',
        textAlign: 'center',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'color-mix(in srgb, var(--color-advisor, #10b981) 15%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto var(--space-4)',
        }}
      >
        <BookOpen size={28} style={{ color: 'var(--color-advisor, #10b981)' }} />
      </div>

      <h3 style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text)', fontSize: 'var(--text-lg)' }}>
        Book a Consultation
      </h3>
      <p style={{ margin: '0 0 var(--space-5)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
        Send {advisor.displayName} a consultation request. Describe your situation and they'll get back to you directly.
      </p>

      <button
        onClick={() => router.push(`/messages?advisorId=${advisor.uid}`)}
        style={{
          width: '100%',
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--color-advisor, #10b981)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontWeight: 600,
          fontSize: 'var(--text-sm)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-2)',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
      >
        <MessageSquare size={16} />
        Send Consultation Request
      </button>

      {advisor.phone && (
        <p style={{ marginTop: 'var(--space-3)', color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
          Or call directly: <strong style={{ color: 'var(--color-text-2)' }}>{advisor.phone}</strong>
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublicProfilePage() {
  const { uid }        = useParams<{ uid: string }>();
  const router         = useRouter();
  const authUser       = useAuthStore((s) => s.user);
  const authLoading    = useAuthStore((s) => s.loading);

  const [profile, setProfile]     = useState<PublicUser | null>(null);
  const [notFound, setNotFound]   = useState(false);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState(0);
  const [currency, setCurrency]   = useState('$');
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Redirect to own profile if viewing self
  useEffect(() => {
    if (!authLoading && authUser && authUser.uid === uid) {
      router.replace('/profile');
    }
  }, [authLoading, authUser, uid, router]);

  // Load target user + follow counts
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }
        setProfile({ uid: snap.id, ...snap.data() } as PublicUser);

        // Follower count — collection-group query where targetUid == uid
        try {
          const followersQ = query(
            collectionGroup(db, 'following'),
            where('targetUid', '==', uid),
          );
          const followersSnap = await getCountFromServer(followersQ);
          setFollowerCount(followersSnap.data().count);
        } catch {
          /* non-critical — counts remain 0 */
        }

        // Following count — subcollection of the target user
        try {
          const followingQ = collection(db, 'follows', uid, 'following');
          const followingSnap = await getCountFromServer(followingQ);
          setFollowingCount(followingSnap.data().count);
        } catch {
          /* non-critical */
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [uid]);

  // Load currency from config
  useEffect(() => {
    async function loadCurrency() {
      try {
        const configSnap = await getDoc(doc(db, 'config', 'site'));
        if (configSnap.exists()) {
          setCurrency(configSnap.data().currencySymbol ?? '$');
        }
      } catch {
        /* keep default */
      }
    }
    loadCurrency();
  }, []);

  // ─── Tab definitions ──────────────────────────────────────────────────────

  const TABS =
    profile?.role === 'seller'
      ? ['Products', 'About', 'Reviews']
      : profile?.role === 'advisor'
      ? ['Advice', 'About', 'Contact']
      : ['About'];

  const ROLE_COLOR: Record<string, string> = {
    buyer:   'var(--color-buyer,   #3b82f6)',
    seller:  'var(--color-seller,  #8b5cf6)',
    advisor: 'var(--color-advisor, #10b981)',
  };

  const roleColor = profile ? (ROLE_COLOR[profile.role] ?? 'var(--color-primary)') : 'var(--color-primary)';

  // ─── Layout wrapper ───────────────────────────────────────────────────────

  const LayoutWrapper =
    !authUser
      ? PublicLayout
      : authUser.role === 'seller'
      ? SellerLayout
      : authUser.role === 'advisor'
      ? AdvisorLayout
      : BuyerLayout;

  // ─── Render ───────────────────────────────────────────────────────────────

  if (authLoading || (authUser?.uid === uid)) return null;

  if (loading) {
    return (
      <LayoutWrapper>
        <ProfileSkeleton />
      </LayoutWrapper>
    );
  }

  if (notFound || !profile) {
    return (
      <LayoutWrapper>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-10) var(--space-4)', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-lg)' }}>User not found.</p>
          <button
            onClick={() => router.back()}
            style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-2) var(--space-5)',
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Go back
          </button>
        </div>
      </LayoutWrapper>
    );
  }

  const initials = profile.displayName
    ? profile.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <LayoutWrapper>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-4)' }}>

        {/* Back */}
        <button
          onClick={() => router.back()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-2)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            padding: '0 0 var(--space-3)',
          }}
        >
          <ChevronLeft size={16} /> Back
        </button>

        {/* Cover */}
        <div
          style={{
            position: 'relative',
            height: 180,
            borderRadius: 'var(--radius-xl)',
            background: profile.coverURL
              ? 'none'
              : `linear-gradient(135deg, ${roleColor} 0%, color-mix(in srgb, ${roleColor} 60%, transparent) 100%)`,
            overflow: 'hidden',
            marginBottom: 'var(--space-6)',
          }}
        >
          {profile.coverURL && (
            <img
              src={profile.coverURL}
              alt="Cover"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}

          {/* Avatar */}
          <div
            style={{
              position: 'absolute',
              bottom: -44,
              left: 'var(--space-6)',
              width: 88,
              height: 88,
              borderRadius: '50%',
              border: '4px solid var(--color-bg)',
              background: roleColor,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 28,
              boxShadow: '0 2px 12px var(--color-shadow)',
            }}
          >
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              initials
            )}
          </div>
        </div>

        {/* Identity + actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            paddingLeft: 'calc(88px + var(--space-6) + var(--space-4))',
            marginBottom: 'var(--space-5)',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          {/* Name / role */}
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 'var(--text-2xl)',
                fontWeight: 700,
                color: 'var(--color-text)',
                lineHeight: 1.1,
              }}
            >
              {profile.displayName}
            </h1>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-1)',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 10px',
                  borderRadius: 'var(--radius-full)',
                  background: `color-mix(in srgb, ${roleColor} 15%, transparent)`,
                  color: roleColor,
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  textTransform: 'capitalize',
                  letterSpacing: '0.03em',
                }}
              >
                {profile.role}
              </span>

              {(profile.city || profile.country) && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    color: 'var(--color-text-3)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  <MapPin size={11} />
                  {[profile.city, profile.country].filter(Boolean).join(', ')}
                </span>
              )}
            </div>

            {/* Follower / following counts */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-2)' }}>
                <strong style={{ color: 'var(--color-text)', fontWeight: 700 }}>{followerCount}</strong>
                {' '}follower{followerCount !== 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-2)' }}>
                <strong style={{ color: 'var(--color-text)', fontWeight: 700 }}>{followingCount}</strong>
                {' '}following
              </span>
            </div>
          </div>

          {/* Actions */}
          {authUser && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0, alignItems: 'center' }}>
              <FollowButton
                targetUid={profile.uid}
                targetName={profile.displayName}
                targetRole={profile.role}
                targetPhoto={profile.photoURL || undefined}
                size="md"
              />
              <Link
                href={`/messages?uid=${profile.uid}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: 'var(--space-2) var(--space-4)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = roleColor;
                  (e.currentTarget as HTMLAnchorElement).style.color       = roleColor;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--color-border)';
                  (e.currentTarget as HTMLAnchorElement).style.color       = 'var(--color-text)';
                }}
              >
                <MessageSquare size={15} />
                Message
              </Link>

              {profile.role === 'advisor' && (
                <button
                  onClick={() => {
                    setTab(TABS.indexOf('Contact'));
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    padding: 'var(--space-2) var(--space-4)',
                    background: roleColor,
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    color: '#fff',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                >
                  <BookOpen size={15} />
                  Book Consultation
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            borderBottom: '2px solid var(--color-border)',
            marginBottom: 'var(--space-5)',
          }}
        >
          {TABS.map((label, i) => (
            <button
              key={label}
              onClick={() => setTab(i)}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                background: 'none',
                border: 'none',
                borderBottom: tab === i ? `2px solid ${roleColor}` : '2px solid transparent',
                marginBottom: -2,
                color: tab === i ? roleColor : 'var(--color-text-2)',
                fontWeight: tab === i ? 700 : 500,
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: 'color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {profile.role === 'seller' && (
          <>
            {tab === 0 && <ProductsTab uid={uid} currency={currency} />}
            {tab === 1 && <AboutTab user={profile} />}
            {tab === 2 && <ReviewsTab uid={uid} />}
          </>
        )}
        {profile.role === 'advisor' && (
          <>
            {tab === 0 && <AdviceTab uid={uid} />}
            {tab === 1 && <AboutTab user={profile} />}
            {tab === 2 && <ContactAdvisorTab advisor={profile} />}
          </>
        )}
        {profile.role === 'buyer' && (
          <>
            {tab === 0 && <AboutTab user={profile} />}
          </>
        )}

      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
      `}</style>
    </LayoutWrapper>
  );
}
