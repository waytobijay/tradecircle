/**
 * app/saved/page.tsx
 * Buyer saved / bookmarked products page.
 * Spec ref: section 4.3 (Saved Items)
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { Bookmark, Search, Trash2, MapPin, Tag } from 'lucide-react';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import BuyerLayout from '@/components/layouts/BuyerLayout';
import { RoleGuard } from '@/components/guards/RoleGuard';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import type { Product, ProductCurrency } from '@/types';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PAGE_SIZE = 12;

const CURRENCY_SYMBOL: Record<ProductCurrency, string> = {
  AUD: 'A$',
  USD: '$',
  NPR: 'रू',
  INR: '₹',
};

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface SavedProduct extends Product {
  savedAt: number; // epoch ms
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function fmtPrice(price: number, currency: ProductCurrency): string {
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${CURRENCY_SYMBOL[currency]}${price.toLocaleString()}`;
  }
}

function timeAgo(epochMs: number): string {
  const diff = (Date.now() - epochMs) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(epochMs).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short',
  });
}

// ─────────────────────────────────────────────
// SavedCard
// ─────────────────────────────────────────────

interface SavedCardProps {
  product: SavedProduct;
  onRemove: (productId: string) => void;
  removing: boolean;
}

function SavedCard({ product, onRemove, removing }: SavedCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError]   = useState(false);
  const [hovered, setHovered]     = useState(false);

  const primaryImage = product.images[0]?.url;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
        transform: hovered && !removing ? 'translateY(-4px)' : 'none',
        boxShadow: hovered && !removing
          ? '0 12px 32px rgba(0,0,0,0.12)'
          : '0 2px 8px rgba(0,0,0,0.06)',
        opacity: removing ? 0.4 : 1,
        pointerEvents: removing ? 'none' : 'auto',
      }}
    >
      {/* Image */}
      <Link
        href={`/products/${product.id}`}
        style={{
          display: 'block',
          position: 'relative',
          aspectRatio: '4/3',
          overflow: 'hidden',
          background: 'var(--color-bg-tertiary)',
        }}
      >
        {!imgLoaded && !imgError && (
          <SkeletonLoader
            width="100%"
            height="100%"
            style={{ position: 'absolute', inset: 0 }}
          />
        )}
        {primaryImage && !imgError ? (
          <img
            src={primaryImage}
            alt={product.name}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: imgLoaded ? 'block' : 'none',
            }}
          />
        ) : imgError ? (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Tag size={32} color="var(--color-text-secondary)" />
          </div>
        ) : null}

        {/* Condition badge */}
        <span style={{
          position: 'absolute', top: 8, left: 8,
          background:
            product.condition === 'new'         ? 'color-mix(in srgb, var(--color-success) 90%, transparent)'
            : product.condition === 'used'      ? 'color-mix(in srgb, var(--color-warning) 90%, transparent)'
            : 'color-mix(in srgb, var(--color-primary) 90%, transparent)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 20,
          textTransform: 'capitalize',
        }}>
          {product.condition}
        </span>
      </Link>

      {/* Body */}
      <div style={{ padding: '12px 14px 14px' }}>
        <Link href={`/products/${product.id}`} style={{ textDecoration: 'none' }}>
          <p style={{
            margin: '0 0 4px',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-text)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.35,
            minHeight: 38,
          }}>
            {product.name}
          </p>
        </Link>

        <p style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: 'var(--color-primary)' }}>
          {fmtPrice(product.price, product.currency)}
          {product.negotiable && (
            <span style={{
              fontSize: 11, fontWeight: 500,
              color: 'var(--color-success)', marginLeft: 6,
            }}>
              negotiable
            </span>
          )}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <MapPin size={12} color="var(--color-text-secondary)" />
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            {product.location.city}, {product.location.country}
          </span>
        </div>

        <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '0 0 12px' }}>
          Saved {timeAgo(product.savedAt)}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            href={`/products/${product.id}`}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '8px 0',
              background: 'var(--color-primary)',
              color: '#fff',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            View
          </Link>
          <button
            onClick={() => onRemove(product.id)}
            aria-label="Remove from saved"
            style={{
              padding: '8px 12px',
              background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
              color: 'var(--color-danger)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton grid
// ─────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 20,
    }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            borderRadius: 14,
            overflow: 'hidden',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <SkeletonLoader width="100%" height={180} />
          <div style={{ padding: '12px 14px 14px' }}>
            <SkeletonLoader width="85%" height={14} style={{ marginBottom: 8 }} />
            <SkeletonLoader width="50%" height={14} style={{ marginBottom: 8 }} />
            <SkeletonLoader width="65%" height={12} style={{ marginBottom: 12 }} />
            <SkeletonLoader width="100%" height={36} borderRadius={8} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{
        width: 80, height: 80,
        borderRadius: '50%',
        background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px',
      }}>
        <Bookmark size={36} color="var(--color-primary)" />
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
        No saved items yet
      </h2>
      <p style={{
        margin: '0 0 24px',
        fontSize: 14,
        color: 'var(--color-text-secondary)',
        maxWidth: 320,
        marginLeft: 'auto',
        marginRight: 'auto',
        lineHeight: 1.6,
      }}>
        Browse products and tap the bookmark icon to save items for later.
      </p>
      <Link
        href="/search"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 24px',
          background: 'var(--color-primary)',
          color: '#fff',
          borderRadius: 10,
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        <Search size={16} />
        Browse Products
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

function SavedPageInner() {
  const { user } = useAuthStore();

  const [products, setProducts]       = useState<SavedProduct[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [removing, setRemoving]       = useState<Set<string>>(new Set());

  const cursorRef   = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // ── Fetch a page ───────────────────────────

  const fetchPage = useCallback(async (append: boolean) => {
    if (!user) return;
    if (append) setLoadingMore(true);
    else        setLoading(true);

    try {
      const savedRef = collection(db, 'users', user.uid, 'savedProducts');
      let q = query(savedRef, orderBy('savedAt', 'desc'), limit(PAGE_SIZE));
      if (append && cursorRef.current) {
        q = query(
          savedRef,
          orderBy('savedAt', 'desc'),
          limit(PAGE_SIZE),
          startAfter(cursorRef.current)
        );
      }

      const snap = await getDocs(q);

      if (snap.empty) {
        setHasMore(false);
        if (!append) setProducts([]);
        return;
      }

      cursorRef.current = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < PAGE_SIZE) setHasMore(false);

      // Batch-fetch product docs
      const productPromises = snap.docs.map((savedDoc) =>
        getDoc(doc(db, 'products', savedDoc.id))
      );
      const productSnaps = await Promise.all(productPromises);

      const fetched: SavedProduct[] = [];
      snap.docs.forEach((savedDoc, idx) => {
        const pSnap = productSnaps[idx];
        if (!pSnap.exists()) return; // product removed by seller
        const data     = pSnap.data() as Omit<Product, 'id'>;
        const savedData = savedDoc.data() as { savedAt?: { seconds: number } };
        fetched.push({
          ...data,
          id: pSnap.id,
          savedAt: savedData.savedAt
            ? savedData.savedAt.seconds * 1000
            : Date.now(),
        });
      });

      setProducts((prev) => (append ? [...prev, ...fetched] : fetched));
    } catch (err) {
      console.error('[SavedPage] fetch error', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    cursorRef.current = null;
    setHasMore(true);
    fetchPage(false);
  }, [fetchPage]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          fetchPage(true);
        }
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchPage]);

  // ── Remove ─────────────────────────────────

  const handleRemove = useCallback(async (productId: string) => {
    if (!user) return;
    setRemoving((prev) => new Set(prev).add(productId));
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'savedProducts', productId));
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (err) {
      console.error('[SavedPage] remove error', err);
    } finally {
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  }, [user]);

  // ── Render ─────────────────────────────────

  return (
    <>
      <style>{`
        .sv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
        @media (max-width: 640px) { .sv-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; } }
        @media (max-width: 380px) { .sv-grid { grid-template-columns: 1fr !important; } }
        @keyframes sv-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>
              Saved Items
            </h1>
            {!loading && products.length > 0 && (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {products.length} item{products.length !== 1 ? 's' : ''} bookmarked
              </p>
            )}
          </div>

          <Link
            href="/search"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <Search size={15} />
            Browse more
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <SkeletonGrid />
        ) : products.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="sv-grid">
              {products.map((product) => (
                <SavedCard
                  key={product.id}
                  product={product}
                  onRemove={handleRemove}
                  removing={removing.has(product.id)}
                />
              ))}
            </div>

            {loadingMore && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                <div style={{
                  width: 28, height: 28,
                  border: '3px solid var(--color-border)',
                  borderTopColor: 'var(--color-primary)',
                  borderRadius: '50%',
                  animation: 'sv-spin 0.7s linear infinite',
                }} />
              </div>
            )}

            {!hasMore && products.length > 0 && (
              <p style={{
                textAlign: 'center', marginTop: 32,
                fontSize: 13, color: 'var(--color-text-tertiary)',
              }}>
                All saved items loaded
              </p>
            )}

            <div ref={sentinelRef} style={{ height: 1 }} />
          </>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────

export default function SavedPage() {
  return (
    <RoleGuard allowedRoles={['buyer']}>
      <BuyerLayout>
        <SavedPageInner />
      </BuyerLayout>
    </RoleGuard>
  );
}
