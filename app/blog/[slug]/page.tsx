/**
 * app/blog/[slug]/page.tsx
 * Individual blog post page.
 * Spec ref: Phase 3 (Blog)
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  collection, query, where, limit, getDocs,
  doc, updateDoc, increment,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { BlogPost } from '@/types';
import PublicLayout from '@/components/layouts/PublicLayout';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ts: BlogPost['createdAt']): string {
  try {
    return ts.toDate().toLocaleDateString('en-AU', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return '';
  }
}

// ─── Related post card ────────────────────────────────────────────────────────

function RelatedCard({ post, idx }: { post: BlogPost; idx: number }) {
  const GRADIENTS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  ];
  const grad = GRADIENTS[idx % GRADIENTS.length];

  return (
    <Link href={`/blog/${post.slug}`} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12, overflow: 'hidden',
        transition: 'box-shadow 0.2s ease',
      }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 24px rgba(0,0,0,0.1)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
      >
        <div style={{ height: 130, background: post.coverImage ? undefined : grad, overflow: 'hidden' }}>
          {post.coverImage && (
            <img src={post.coverImage} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
        <div style={{ padding: '14px 16px' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--color-primary)',
          }}>
            {post.category}
          </span>
          <h4 style={{
            margin: '6px 0 4px', fontSize: 14, fontWeight: 700,
            color: 'var(--color-text)', lineHeight: 1.35,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {post.title}
          </h4>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            {fmtDate(post.createdAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';

  const [post, setPost]       = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    void (async () => {
      try {
        // Fetch the post
        const q = query(
          collection(db, 'blogPosts'),
          where('slug', '==', slug),
          limit(1),
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const docSnap = snap.docs[0];
        const fetchedPost = { id: docSnap.id, ...docSnap.data() } as BlogPost;
        setPost(fetchedPost);

        // Increment views
        try {
          await updateDoc(doc(db, 'blogPosts', docSnap.id), { views: increment(1) });
        } catch { /* non-critical */ }

        // Fetch related posts (same category)
        const relQ = query(
          collection(db, 'blogPosts'),
          where('published', '==', true),
          where('category', '==', fetchedPost.category),
          limit(4),
        );
        const relSnap = await getDocs(relQ);
        const relatedPosts = relSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as BlogPost))
          .filter((p) => p.id !== fetchedPost.id)
          .slice(0, 3);
        setRelated(relatedPosts);
      } catch (err) {
        console.error('Failed to fetch post', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  return (
    <PublicLayout>
      <style>{`
        .blog-post-content h1,
        .blog-post-content h2,
        .blog-post-content h3 {
          color: var(--color-text);
          margin: 1.4em 0 0.6em;
          line-height: 1.3;
        }
        .blog-post-content h1 { font-size: 1.8em; }
        .blog-post-content h2 { font-size: 1.4em; }
        .blog-post-content h3 { font-size: 1.15em; }
        .blog-post-content p  { color: var(--color-text); line-height: 1.75; margin: 0 0 1em; }
        .blog-post-content ul, .blog-post-content ol {
          color: var(--color-text); line-height: 1.75;
          margin: 0 0 1em; padding-left: 1.5em;
        }
        .blog-post-content a  { color: var(--color-primary); }
        .blog-post-content blockquote {
          border-left: 3px solid var(--color-primary);
          margin: 1.2em 0; padding: 0.6em 1.2em;
          background: color-mix(in srgb, var(--color-primary) 6%, transparent);
          border-radius: 0 8px 8px 0;
          color: var(--color-text-secondary); font-style: italic;
        }
        .blog-post-content img {
          max-width: 100%; border-radius: 8px; margin: 0.8em 0;
        }
        .blog-post-content pre {
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: 8px; padding: 16px; overflow-x: auto;
          font-size: 13px; margin: 1em 0;
        }
        .related-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        @media (max-width: 768px) {
          .related-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Loading */}
      {loading && (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid var(--color-border)',
            borderTopColor: 'var(--color-primary)',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Not found */}
      {!loading && notFound && (
        <div style={{ maxWidth: 600, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📄</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 12px' }}>
            Post not found
          </h1>
          <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', marginBottom: 28 }}>
            The blog post you are looking for does not exist or has been removed.
          </p>
          <Link href="/blog" style={{
            display: 'inline-block', padding: '10px 28px',
            background: 'var(--color-primary)', color: '#fff',
            borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600,
          }}>
            Back to Blog
          </Link>
        </div>
      )}

      {/* Post content */}
      {!loading && post && (
        <>
          {/* Cover image */}
          {post.coverImage && (
            <div style={{ width: '100%', maxHeight: 480, overflow: 'hidden' }}>
              <img
                src={post.coverImage}
                alt={post.title}
                style={{ width: '100%', height: 480, objectFit: 'cover', display: 'block' }}
              />
            </div>
          )}

          {/* Article */}
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px 80px' }}>

            {/* Breadcrumb */}
            <div style={{ marginBottom: 24, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              <Link href="/blog" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
                ← Back to Blog
              </Link>
            </div>

            {/* Meta */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{
                background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                color: 'var(--color-primary)',
                fontSize: 11, fontWeight: 700, padding: '4px 12px',
                borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {post.category}
              </span>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {fmtDate(post.createdAt)}
              </span>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>·</span>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                By <strong style={{ color: 'var(--color-text)' }}>{post.author}</strong>
              </span>
              {post.views > 0 && (
                <>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>·</span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {post.views.toLocaleString()} views
                  </span>
                </>
              )}
            </div>

            {/* Title */}
            <h1 style={{
              margin: '0 0 24px',
              fontSize: 36, fontWeight: 800,
              color: 'var(--color-text)', lineHeight: 1.2,
              letterSpacing: '-0.02em',
            }}>
              {post.title}
            </h1>

            {/* Excerpt */}
            <p style={{
              margin: '0 0 32px',
              fontSize: 18, color: 'var(--color-text-secondary)',
              lineHeight: 1.65, fontStyle: 'italic',
              borderLeft: '3px solid var(--color-primary)',
              paddingLeft: 16,
            }}>
              {post.excerpt}
            </p>

            {/* Content */}
            <div
              className="blog-post-content"
              style={{ fontSize: 16, lineHeight: 1.75 }}
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Tags */}
            {post.tags.length > 0 && (
              <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 10 }}>
                  Tags:
                </span>
                {post.tags.map((tag) => (
                  <span key={tag} style={{
                    display: 'inline-block', margin: '0 6px 6px 0',
                    padding: '4px 12px', borderRadius: 20,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500,
                  }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Related posts */}
          {related.length > 0 && (
            <div style={{
              background: 'var(--color-surface)',
              borderTop: '1px solid var(--color-border)',
              padding: '48px 24px',
            }}>
              <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 24px' }}>
                  Related Posts
                </h2>
                <div className="related-grid">
                  {related.map((p, i) => <RelatedCard key={p.id} post={p} idx={i} />)}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </PublicLayout>
  );
}
