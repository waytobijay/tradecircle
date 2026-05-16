'use client';

/**
 * components/home/AdCard.tsx
 * Sponsored ad card injected into the home feed.
 * Matches ProductCard dimensions so it fits naturally in the grid.
 */

import { useEffect } from 'react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { Ad } from '@/types';

interface AdCardProps {
  ad: Ad;
}

export function AdCard({ ad }: AdCardProps) {
  // Increment impressions on render
  useEffect(() => {
    void updateDoc(doc(db, 'ads', ad.id), {
      'stats.impressions': increment(1),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad.id]);

  const hasImage = Boolean(ad.creative.imageUrl);

  function handleCta() {
    void updateDoc(doc(db, 'ads', ad.id), {
      'stats.clicks': increment(1),
    });
    window.open(ad.creative.ctaUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Image / placeholder */}
      <div
        style={{
          position: 'relative',
          height: 200,
          overflow: 'hidden',
          background: hasImage
            ? 'var(--color-background)'
            : 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {hasImage ? (
          <img
            src={ad.creative.imageUrl}
            alt={ad.creative.headline}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <p
            style={{
              margin: 0,
              padding: '0 20px',
              fontSize: 18,
              fontWeight: 700,
              color: '#fff',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            {ad.creative.headline}
          </p>
        )}

        {/* "Sponsored" pill — top-left */}
        <span
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: '#f59e0b',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 9px',
            borderRadius: 999,
            letterSpacing: '0.03em',
          }}
        >
          Sponsored
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: '12px 14px 14px' }}>
        {hasImage && (
          <h3
            style={{
              margin: '0 0 10px',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--color-text)',
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {ad.creative.headline}
          </h3>
        )}

        <button
          type="button"
          onClick={handleCta}
          style={{
            width: '100%',
            padding: '9px',
            borderRadius: 8,
            border: 'none',
            background: '#f59e0b',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.02em',
          }}
        >
          Learn More
        </button>
      </div>
    </div>
  );
}
