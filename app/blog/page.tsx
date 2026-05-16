/**
 * app/blog/page.tsx
 * Public blog listing page — fetches published posts from Firestore.
 * Spec ref: Phase 3 (Blog)
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  collection, query, where, orderBy, limit,
  getDocs, startAfter, QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { BlogPost } from '@/types';
import PublicLayout from '@/components/layouts/PublicLayout';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ts: BlogPost['createdAt']): string {
  try {
    return ts.toDate().toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// Gradient placeholders when no cover image
const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
];

function gradientFor(idx: number) {
  return GRADIENTS[idx % GRADIENTS.length];
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes blog-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        .blog-sk { animation: blog-pulse 1.5s ease-in-out infinite; background: var(--color-border); border-radius: 6px; }
      `}</style>
      <div className="blog-sk" style={{ height: 180 }} />
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="blog-sk" style={{ height: 20, width: '40%' }} />
        <div className="blog-sk" style={{ height: 22, width: '90%' }} />
        <div className="blog-sk" style={{ height: 16, width: '80%' }} />
        <div className="blog-sk" style={{ height: 16, width: '65%' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <div className="blog-sk" style={{ height: 14, width: '30%' }} />
          <div className="blog-sk" style={{ height: 14, width: '20%' }} />
        </div>
      </div>
    </div>
  );
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({ post, idx }: { post: BlogPost; idx: number }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Cover image */}
      <div style={{ position: 'relative', height: 180, overflow: 'hidden', flexShrink: 0 }}>
        {post.coverImage ? (
          <img
            src={post.coverImage}
            alt={post.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: gradientFor(idx) }} />
        )}
        {/* Category pill */}
        <span style={{
          position: 'absolute', top: 12, left: 12,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
          color: '#fff', fontSize: 11, fontWeight: 600,
          padding: '4px 10px', borderRadius: 20,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {post.category}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', flex: 1, gap: 8 }}>
        <h3 style={{
          margin: 0, fontSize: 16, fontWeight: 700,
          color: 'var(--color-text)', lineHeight: 1.35,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {post.title}
        </h3>
        <p style={{
          margin: 0, fontSize: 13, color: 'var(--color-text-secondary)',
          lineHeight: 1.55,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
          flex: 1,
        }}>
          {post.excerpt}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{post.author}</span>
            {' · '}
            {fmtDate(post.createdAt)}
          </div>
          <Link href={`/blog/${post.slug}`} style={{
            textDecoration: 'none', fontSize: 12, fontWeight: 600,
            color: 'var(--color-primary)',
          }}>
            Read More →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;

export default function BlogPage() {
  const [posts, setPosts]           = useState<BlogPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]       = useState(false);
  const [lastDoc, setLastDoc]       = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = ['All', ...Array.from(new Set(posts.map((p) => p.category))).sort()];

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'blogPosts'),
        where('published', '==', true),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BlogPost));
      setPosts(fetched);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to fetch blog posts', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'blogPosts'),
        where('published', '==', true),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BlogPost));
      setPosts((prev) => [...prev, ...fetched]);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load more posts', err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => { void fetchPosts(); }, [fetchPosts]);

  const filtered = activeCategory === 'All'
    ? posts
    : posts.filter((p) => p.category === activeCategory);

  return (
    <PublicLayout>
      <style>{`
        .blog-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        @media (max-width: 1024px) { .blog-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px)  { .blog-grid { grid-template-columns: 1fr; } }
        .blog-cat-tab {
          padding: 7px 18px; border-radius: 20px; border: 1.5px solid var(--color-border);
          background: transparent; cursor: pointer; font-size: 13px; font-weight: 500;
          color: var(--color-text-secondary); transition: all 0.15s;
          white-space: nowrap;
        }
        .blog-cat-tab.active {
          background: var(--color-primary); border-color: var(--color-primary);
          color: #fff;
        }
        .blog-cat-tab:hover:not(.active) {
          border-color: var(--color-primary); color: var(--color-primary);
        }
      `}</style>

      {/* Hero banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-primary) 0%, #764ba2 100%)',
        color: '#fff', textAlign: 'center',
        padding: '72px 24px 64px',
      }}>
        <h1 style={{ margin: 0, fontSize: 42, fontWeight: 800, letterSpacing: '-0.02em' }}>
          TradeCircle Blog
        </h1>
        <p style={{ margin: '14px auto 0', maxWidth: 520, fontSize: 17, opacity: 0.9, lineHeight: 1.6 }}>
          Insights, guides, and stories from the world of trade, agriculture, and commerce.
        </p>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Category filters */}
        {!loading && categories.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`blog-cat-tab${activeCategory === cat ? ' active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="blog-grid">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : filtered.length === 0
              ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: 'var(--color-text-secondary)' }}>
                  <p style={{ fontSize: 18, fontWeight: 600 }}>No posts found</p>
                  <p style={{ fontSize: 14, marginTop: 8 }}>Check back soon for new content.</p>
                </div>
              )
              : filtered.map((post, idx) => <PostCard key={post.id} post={post} idx={idx} />)
          }
        </div>

        {/* Load More */}
        {!loading && hasMore && activeCategory === 'All' && (
          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <button
              onClick={() => void loadMore()}
              disabled={loadingMore}
              style={{
                padding: '12px 36px', borderRadius: 8,
                background: loadingMore ? 'var(--color-border)' : 'var(--color-primary)',
                color: '#fff', border: 'none', cursor: loadingMore ? 'default' : 'pointer',
                fontSize: 14, fontWeight: 600, transition: 'background 0.15s',
              }}
            >
              {loadingMore ? 'Loading…' : 'Load More Posts'}
            </button>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
