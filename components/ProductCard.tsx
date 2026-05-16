/**
 * components/ProductCard.tsx
 * Reusable product card for feed, search results, and grids.
 * Spec ref: section 8.5 (ProductCard component)
 *
 * Layout:
 *  - Image (4:3, object-cover, lazy load + skeleton while loading)
 *  - Bookmark button overlay (top-right of image)
 *  - Product name (2-line clamp)
 *  - Price (CurrencyDisplay)
 *  - Location (LocationBadge)
 *  - Seller row (24px avatar + name)
 *  - Posted time (relative, muted)
 *  - [Contact Seller] secondary + [View] primary buttons
 *
 * Hover: card lifts translateY(-4px) + deeper shadow
 * Bookmark: bounce-scale animation on click
 *
 * Props note: Product type only carries sellerId.
 * Pass sellerName + sellerAvatar from the parent (avoids N+1 Firestore reads).
 */

'use client';

import { useState }        from 'react';
import Link                from 'next/link';
import { Bookmark }        from 'lucide-react';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { LocationBadge }   from '@/components/ui/LocationBadge';
import { SkeletonLoader }  from '@/components/ui/SkeletonLoader';
import { Button }          from '@/components/ui/Button';
import type { Product }    from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductCardProps {
  product:          Product;
  /** Resolved seller display name — fetch in parent to avoid N+1 reads */
  sellerName?:      string;
  /** Resolved seller avatar URL */
  sellerAvatar?:    string;
  onContactSeller?: () => void;
  onAddToCart?:     () => void;
  onSave?:          () => void;
  isSaved?:         boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(seconds: number): string {
  const s = Math.floor((Date.now() / 1000) - seconds);
  if (s < 60)    return 'Just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  if (d === 1)   return 'Yesterday';
  if (d < 30)    return `${d} days ago`;
  if (d < 365)   return `${Math.floor(d / 30)} months ago`;
  return `${Math.floor(d / 365)} years ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductCard({
  product,
  sellerName   = 'Seller',
  sellerAvatar,
  onContactSeller,
  onSave,
  isSaved      = false,
}: ProductCardProps) {
  const [hovered,    setHovered]    = useState(false);
  const [imgLoaded,  setImgLoaded]  = useState(false);
  const [imgError,   setImgError]   = useState(false);
  const [bouncing,   setBouncing]   = useState(false);

  const imgUrl     = !imgError ? (product.images[0]?.url ?? '') : '';
  const postedAgo  = product.createdAt?.seconds
    ? timeAgo(product.createdAt.seconds)
    : '';

  function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBouncing(true);
    onSave?.();
  }

  const initials = sellerName.charAt(0).toUpperCase();

  return (
    <>
      <style>{`
        @keyframes bm-bounce {
          0%   { transform: scale(1);    }
          40%  { transform: scale(1.35); }
          70%  { transform: scale(0.88); }
          100% { transform: scale(1);    }
        }
        .pc-name {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

      <article
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display:       'flex',
          flexDirection: 'column',
          background:    'var(--color-surface)',
          border:        '1px solid var(--color-border)',
          borderRadius:  12,
          overflow:      'hidden',
          cursor:        'pointer',
          transition:    'transform 0.2s ease, box-shadow 0.2s ease',
          transform:     hovered ? 'translateY(-4px)' : 'translateY(0)',
          boxShadow:     hovered
            ? '0 12px 32px rgba(0,0,0,0.12)'
            : '0 1px 4px rgba(0,0,0,0.05)',
        }}
      >
        {/* ── Image ──────────────────────────────────────────────────────── */}
        <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden', flexShrink: 0 }}>

          {/* Skeleton while loading */}
          {!imgLoaded && !imgError && (
            <SkeletonLoader
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                borderRadius: 0,
              }}
            />
          )}

          {/* Fallback placeholder (no image / error) */}
          {(imgError || !imgUrl) && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'var(--color-bg-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-text-secondary)', fontSize: 13,
            }}>
              No image
            </div>
          )}

          {imgUrl && (
            <img
              src={imgUrl}
              alt={product.name}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => { setImgError(true); setImgLoaded(true); }}
              style={{
                width:      '100%',
                height:     '100%',
                objectFit:  'cover',
                display:    'block',
                opacity:    imgLoaded && !imgError ? 1 : 0,
                transition: 'opacity 0.2s ease',
              }}
            />
          )}

          {/* Condition badge */}
          <span style={{
            position:     'absolute', top: 8, left: 8,
            background:   'rgba(0,0,0,0.55)',
            color:        '#fff',
            fontSize:     10,
            fontWeight:   600,
            padding:      '2px 7px',
            borderRadius: 999,
            textTransform: 'capitalize',
            backdropFilter: 'blur(4px)',
          }}>
            {product.condition}
          </span>

          {/* Bookmark button */}
          <button
            onClick={handleSave}
            aria-label={isSaved ? 'Remove from saved' : 'Save product'}
            onAnimationEnd={() => setBouncing(false)}
            style={{
              position:   'absolute', top: 8, right: 8,
              background: 'rgba(255,255,255,0.92)',
              border:     'none',
              borderRadius: '50%',
              width:      32, height: 32,
              display:    'flex', alignItems: 'center', justifyContent: 'center',
              cursor:     'pointer',
              color:      isSaved ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              backdropFilter: 'blur(4px)',
              animation:  bouncing ? 'bm-bounce 0.32s ease' : 'none',
              transition: 'color 0.15s',
            }}
          >
            <Bookmark
              size={16}
              fill={isSaved ? 'var(--color-primary)' : 'none'}
              strokeWidth={2}
            />
          </button>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>

          {/* Product name */}
          <h3
            className="pc-name"
            style={{
              margin:     0,
              fontSize:   15,
              fontWeight: 600,
              color:      'var(--color-text)',
              lineHeight: 1.4,
            }}
          >
            {product.name}
          </h3>

          {/* Price */}
          <CurrencyDisplay
            amount={product.price}
            currency={product.currency}
            style={{
              fontSize:   17,
              fontWeight: 700,
              color:      'var(--color-primary)',
            }}
          />

          {/* Location */}
          <LocationBadge
            city={product.location.city}
            country={product.location.country}
            size="sm"
          />

          {/* Seller row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {sellerAvatar
              ? (
                  <img
                    src={sellerAvatar}
                    alt={sellerName}
                    style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                )
              : (
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--color-primary)',
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                  }}>
                    {initials}
                  </div>
                )
            }
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              {sellerName}
            </span>
            {product.negotiable && (
              <span style={{
                marginLeft: 'auto',
                fontSize: 10, fontWeight: 600,
                color: 'var(--color-success, #16a34a)',
                background: 'color-mix(in srgb, var(--color-success, #16a34a) 12%, transparent)',
                padding: '2px 6px', borderRadius: 999,
              }}>
                Negotiable
              </span>
            )}
          </div>

          {/* Posted time */}
          {postedAgo && (
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              Posted {postedAgo}
            </span>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => { e.preventDefault(); onContactSeller?.(); }}
              style={{ flex: 1, fontSize: 12 }}
            >
              Contact Seller
            </Button>
            <Link
              href={`/products/${product.id}`}
              style={{ flex: 1, textDecoration: 'none' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="primary"
                size="sm"
                style={{ width: '100%', fontSize: 12 }}
              >
                View
              </Button>
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
