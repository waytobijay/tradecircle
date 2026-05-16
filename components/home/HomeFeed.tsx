'use client';

/**
 * components/home/HomeFeed.tsx
 * Authenticated home feed — 3-column desktop layout.
 * Spec ref: section 3 (Authenticated Home Feed)
 *
 * Layout:
 *   Desktop — Left sidebar (240px) | Center feed (flex-1) | Right sidebar (280px)
 *   Mobile  — Center feed only
 *
 * Features:
 *   - Filter tabs: All | Products | Advice | Near Me | Following
 *   - [📍 Set My Location] toggle button
 *   - Real-time "New posts available" toast via onSnapshot
 *   - Infinite scroll via IntersectionObserver
 *   - Skeleton loaders (3 cards while fetching)
 *   - Empty state
 *   - Right sidebar: Trending Products, Nearby Sellers, Suggested Advisors (mock)
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import {
  MapPin,
  RefreshCw,
  Bookmark,
  ShoppingBag,
  BookOpen,
  MessageSquare,
  Eye,
  MessageCircle,
  Loader2,
  Heart,
} from 'lucide-react';
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import type { Product, AdvicePost } from '@/types';
import { AdCard } from '@/components/home/AdCard';
import { useAds } from '@/hooks/useAds';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type FeedFilter = 'all' | 'products' | 'advice' | 'near-me' | 'following';

interface ProductFeedItem {
  type: 'product';
  id: string;
  createdAt: Timestamp;
  data: Product;
}

interface AdviceFeedItem {
  type: 'advice';
  id: string;
  createdAt: Timestamp;
  data: AdvicePost;
}

type FeedItem = ProductFeedItem | AdviceFeedItem;

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PAGE_SIZE = 12;

const FILTER_TABS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'products', label: 'Products' },
  { key: 'advice', label: 'Advice' },
  { key: 'near-me', label: 'Near Me' },
  { key: 'following', label: 'Following' },
];

// Mock right sidebar data
const TRENDING_PRODUCTS = [
  { name: 'Organic Fertiliser 20kg', price: 'AUD 45' },
  { name: 'Irrigation Drip Kit', price: 'AUD 120' },
  { name: 'Seedling Trays (50-pack)', price: 'AUD 18' },
];

const NEARBY_SELLERS = [
  { name: 'Green Valley Farms', location: 'Melbourne, AU' },
  { name: 'Sunrise Agro Supplies', location: 'Sydney, AU' },
  { name: 'Happy Harvest Co.', location: 'Brisbane, AU' },
];

const SUGGESTED_ADVISORS = [
  { name: 'Dr. Puja Sharma', specialty: 'Soil Science' },
  { name: 'James Whitfield', specialty: 'Crop Management' },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function timeAgo(seconds: number): string {
  const s = Math.floor(Date.now() / 1000 - seconds);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

// ─────────────────────────────────────────────
// useFeed hook
// ─────────────────────────────────────────────

function useFeed(filter: FeedFilter) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const productCursor = useRef<QueryDocumentSnapshot | null>(null);
  const adviceCursor = useRef<QueryDocumentSnapshot | null>(null);

  const fetchProducts = useCallback(async (isFirst: boolean): Promise<FeedItem[]> => {
    const constraints = [
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
      ...(isFirst || !productCursor.current ? [] : [startAfter(productCursor.current)]),
    ];
    const snap = await getDocs(query(collection(db, 'products'), ...constraints));
    if (snap.docs.length > 0) productCursor.current = snap.docs[snap.docs.length - 1];
    return snap.docs.map((d) => ({
      type: 'product' as const,
      id: d.id,
      createdAt: d.data().createdAt as Timestamp,
      data: { id: d.id, ...d.data() } as Product,
    }));
  }, []);

  const fetchAdvice = useCallback(async (isFirst: boolean): Promise<FeedItem[]> => {
    const constraints = [
      where('published', '==', true),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
      ...(isFirst || !adviceCursor.current ? [] : [startAfter(adviceCursor.current)]),
    ];
    const snap = await getDocs(query(collection(db, 'advicePosts'), ...constraints));
    if (snap.docs.length > 0) adviceCursor.current = snap.docs[snap.docs.length - 1];
    return snap.docs.map((d) => ({
      type: 'advice' as const,
      id: d.id,
      createdAt: d.data().createdAt as Timestamp,
      data: { id: d.id, ...d.data() } as AdvicePost,
    }));
  }, []);

  const load = useCallback(async (isFirst: boolean) => {
    if (isFirst) {
      productCursor.current = null;
      adviceCursor.current = null;
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      let fetched: FeedItem[] = [];
      if (filter === 'products') {
        fetched = await fetchProducts(isFirst);
      } else if (filter === 'advice') {
        fetched = await fetchAdvice(isFirst);
      } else {
        const [prods, advices] = await Promise.all([
          fetchProducts(isFirst),
          fetchAdvice(isFirst),
        ]);
        fetched = [...prods, ...advices].sort(
          (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0),
        );
      }
      setItems((prev) => (isFirst ? fetched : [...prev, ...fetched]));
      setHasMore(fetched.length >= PAGE_SIZE);
    } catch {
      // keep existing items on error
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, fetchProducts, fetchAdvice]);

  useEffect(() => { void load(true); }, [load]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) void load(false);
  }, [load, loadingMore, hasMore]);

  const refresh = useCallback(() => void load(true), [load]);

  return { items, loading, loadingMore, hasMore, loadMore, refresh };
}

// ─────────────────────────────────────────────
// New posts watcher
// ─────────────────────────────────────────────

function useNewPostCount(filter: FeedFilter, loadedAt: Date): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    if (filter === 'advice') return;

    const q = query(
      collection(db, 'products'),
      where('createdAt', '>', Timestamp.fromDate(loadedAt)),
    );
    const unsub = onSnapshot(q, (snap) => setCount(snap.size));
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return count;
}

// ─────────────────────────────────────────────
// Skeleton card
// ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{ height: 200, background: 'var(--color-background)', animation: 'hf-pulse 1.4s ease-in-out infinite' }} />
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ height: 14, borderRadius: 4, background: 'var(--color-background)', width: '70%', animation: 'hf-pulse 1.4s ease-in-out infinite' }} />
        <div style={{ height: 12, borderRadius: 4, background: 'var(--color-background)', width: '40%', animation: 'hf-pulse 1.4s ease-in-out infinite' }} />
        <div style={{ height: 12, borderRadius: 4, background: 'var(--color-background)', width: '55%', animation: 'hf-pulse 1.4s ease-in-out infinite' }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Product feed card
// ─────────────────────────────────────────────

function ProductFeedCard({ item }: { item: ProductFeedItem }) {
  const p = item.data;
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgUrl = p.images?.[0]?.url ?? '';
  const initials = p.sellerId.charAt(0).toUpperCase();
  const postedAgo = p.createdAt?.seconds ? timeAgo(p.createdAt.seconds) : '';

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Image */}
      <div style={{ position: 'relative', height: 200, background: 'var(--color-background)', overflow: 'hidden' }}>
        {imgUrl && (
          <img
            src={imgUrl}
            alt={p.name}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.2s',
            }}
          />
        )}
        {/* Location badge */}
        {p.location && (
          <span style={{
            position: 'absolute', bottom: 8, left: 8,
            background: 'rgba(0,0,0,0.6)', color: '#fff',
            fontSize: 11, fontWeight: 600,
            padding: '2px 8px', borderRadius: 999,
            display: 'flex', alignItems: 'center', gap: 3,
            backdropFilter: 'blur(4px)',
          }}>
            <MapPin size={10} />
            {p.location.city}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '12px 14px 14px' }}>
        {/* Name + price */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
          <h3 style={{
            margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text)',
            flex: 1, overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {p.name}
          </h3>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {p.currency} {p.price.toLocaleString()}
          </span>
        </div>

        {/* Seller + posted time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', background: 'var(--color-primary)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, flexShrink: 0,
          }}>
            {initials}
          </div>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Seller
          </span>
          {postedAgo && (
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', flexShrink: 0 }}>
              {postedAgo}
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            href={`/messages?product=${p.id}&seller=${p.sellerId}`}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '8px', borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'transparent', color: 'var(--color-text)',
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
            }}
          >
            <MessageCircle size={14} />
            Contact Seller
          </Link>
          <Link
            href={`/products/${p.id}`}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '8px', borderRadius: 8,
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
            }}
          >
            <Eye size={14} />
            View
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Advice feed card
// ─────────────────────────────────────────────

function AdviceFeedCard({ item }: { item: AdviceFeedItem }) {
  const a = item.data;
  const initials = a.advisorId.charAt(0).toUpperCase();

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      padding: '16px',
    }}>
      {/* Header: advisor avatar + name + subject */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Advisor
          </p>
          <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 600,
            color: 'var(--color-primary)', background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
            padding: '1px 8px', borderRadius: 999,
          }}>
            {a.subject}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.3 }}>
        {a.title}
      </h3>

      {/* Description — 2 lines */}
      <p style={{
        margin: '0 0 12px', fontSize: 14, lineHeight: 1.6,
        color: 'var(--color-text-secondary)',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {a.description}
      </p>

      {/* Read More */}
      <Link
        href={`/advice/${a.id}`}
        style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}
      >
        Read More →
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────
// Left sidebar
// ─────────────────────────────────────────────

interface SidebarUserShape {
  name: string;
  role: string;
  profilePhoto?: string;
}

function LeftSidebar({ user }: { user: SidebarUserShape }) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const quickLinks = [
    { label: 'My Products', href: '/my-products', Icon: ShoppingBag },
    { label: 'My Advice', href: '/my-advice', Icon: BookOpen },
    { label: 'Bookmarks', href: '/saved', Icon: Bookmark },
    { label: 'Messages', href: '/messages', Icon: MessageSquare },
  ];

  return (
    <aside style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* User mini-card */}
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 10, textAlign: 'center',
      }}>
        {user.profilePhoto ? (
          <img src={user.profilePhoto} alt={user.name} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700,
          }}>
            {initials}
          </div>
        )}
        <div>
          <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
            {user.name}
          </p>
          <span style={{
            display: 'inline-block', padding: '2px 10px', borderRadius: 999,
            background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
            color: 'var(--color-primary)', fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
          }}>
            {user.role}
          </span>
        </div>
      </div>

      {/* Quick links */}
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 12, padding: '8px', display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {quickLinks.map(({ label, href, Icon }) => (
          <Link
            key={href + label}
            href={href}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 8,
              fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)',
              textDecoration: 'none', transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.background = 'var(--color-background)';
              el.style.color = 'var(--color-text)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.background = 'transparent';
              el.style.color = 'var(--color-text-secondary)';
            }}
          >
            <Icon size={15} style={{ flexShrink: 0 }} />
            {label}
          </Link>
        ))}
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────
// Right sidebar (mock data)
// ─────────────────────────────────────────────

function RightSidebar() {
  const sectionStyle: React.CSSProperties = {
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 12, padding: '14px 16px',
  };
  const headingStyle: React.CSSProperties = {
    margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--color-text)',
  };

  return (
    <aside style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 12, width: 280 }}>
      {/* Trending Products */}
      <div style={sectionStyle}>
        <p style={headingStyle}>Trending Products</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TRENDING_PRODUCTS.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                {p.name}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>
                {p.price}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Nearby Sellers */}
      <div style={sectionStyle}>
        <p style={headingStyle}>Nearby Sellers</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {NEARBY_SELLERS.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {s.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <MapPin size={9} />
                  {s.location}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested Advisors */}
      <div style={sectionStyle}>
        <p style={headingStyle}>Suggested Advisors</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SUGGESTED_ADVISORS.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: 'color-mix(in srgb, var(--color-primary) 20%, var(--color-surface))',
                color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {a.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.name}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  {a.specialty}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────
// New posts toast
// ─────────────────────────────────────────────

function NewPostsToast({ count, onRefresh }: { count: number; onRefresh: () => void }) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onRefresh}
      style={{
        position: 'sticky', top: 80, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 6,
        margin: '0 auto 16px', padding: '10px 20px',
        borderRadius: 999, background: 'var(--color-primary)', color: '#fff',
        border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      }}
    >
      <RefreshCw size={14} />
      {count} new post{count > 1 ? 's' : ''} available — tap to refresh
    </button>
  );
}

// ─────────────────────────────────────────────
// HomeFeed
// ─────────────────────────────────────────────

export function HomeFeed() {
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [locationSet, setLocationSet] = useState(false);
  const loadedAt = useMemo(() => new Date(), []);

  const { items, loading, loadingMore, hasMore, loadMore, refresh } = useFeed(filter);
  const newCount = useNewPostCount(filter, loadedAt);
  const { ads } = useAds();

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !loadingMore && hasMore) loadMore(); },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore, loadingMore, hasMore]);

  if (!user) return null;

  return (
    <>
      <style>{`
        @keyframes hf-pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        .hf-left  { display: none; }
        .hf-right { display: none; }
        @media (min-width: 1024px) {
          .hf-left  { display: block; }
          .hf-right { display: flex; flex-direction: column; }
        }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 80px' }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

          {/* Left sidebar — desktop only */}
          <div className="hf-left" style={{ width: 240, flexShrink: 0 }}>
            <LeftSidebar user={{ name: user.name, role: user.role, profilePhoto: user.profilePhoto }} />
          </div>

          {/* Center feed */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Filter tabs + location toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none', flex: 1, minWidth: 0 }}>
                {FILTER_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    style={{
                      padding: '7px 16px', borderRadius: 999,
                      border: `1.5px solid ${filter === key ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: filter === key ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                      color: filter === key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      fontSize: 13, fontWeight: filter === key ? 700 : 400,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Location toggle */}
              <button
                type="button"
                onClick={() => setLocationSet((v) => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 12px', borderRadius: 999,
                  border: `1.5px solid ${locationSet ? 'var(--color-success)' : 'var(--color-border)'}`,
                  background: locationSet ? 'color-mix(in srgb, var(--color-success) 10%, transparent)' : 'transparent',
                  color: locationSet ? 'var(--color-success)' : 'var(--color-text-secondary)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                <MapPin size={14} />
                {locationSet ? 'Location Set' : '📍 Set My Location'}
              </button>
            </div>

            {/* New posts toast */}
            <NewPostsToast count={newCount} onRefresh={refresh} />

            {/* Feed items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {loading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : items.length === 0 ? (
                <div style={{
                  padding: '80px 20px', textAlign: 'center',
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 12,
                }}>
                  <Heart size={40} style={{ color: 'var(--color-text-secondary)', marginBottom: 12 }} />
                  <p style={{ margin: 0, fontSize: 15, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                    No posts yet — follow sellers or check back soon
                  </p>
                </div>
              ) : (
                items.map((item, index) => {
                  const feedCard = item.type === 'product' ? (
                    <ProductFeedCard key={item.id} item={item} />
                  ) : (
                    <AdviceFeedCard key={item.id} item={item} />
                  );

                  // After every 8th item (1-based), inject an ad
                  if (ads.length > 0 && (index + 1) % 8 === 0) {
                    const adIndex = Math.floor((index + 1) / 8) - 1;
                    const ad = ads[adIndex % ads.length];
                    return [feedCard, <AdCard key={`ad-${index}`} ad={ad} />];
                  }

                  return feedCard;
                })
              )}

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} style={{ height: 1 }} />

              {/* Load more indicator */}
              {loadingMore && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                  <Loader2 size={20} style={{ color: 'var(--color-primary)', animation: 'hf-spin 1s linear infinite' }} />
                </div>
              )}

              {!hasMore && !loading && items.length > 0 && (
                <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)', padding: '16px 0' }}>
                  You&apos;re all caught up
                </p>
              )}
            </div>
            <style>{`@keyframes hf-spin { to { transform: rotate(360deg); } }`}</style>
          </div>

          {/* Right sidebar — desktop only */}
          <div className="hf-right" style={{ flexShrink: 0 }}>
            <RightSidebar />
          </div>
        </div>
      </div>
    </>
  );
}
