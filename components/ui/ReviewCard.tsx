/**
 * components/ui/ReviewCard.tsx
 * Displays a single review with avatar, star rating, date, and comment.
 * Shows an amber "Under review" badge when moderationStatus === 'pending'.
 */

'use client';

import StarRating from '@/components/ui/StarRating';
import type { Review } from '@/types';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface ReviewWithReviewer extends Review {
  reviewerName: string;
  reviewerPhoto?: string;
}

interface ReviewCardProps {
  review: ReviewWithReviewer;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatDate(ts: Review['createdAt']): string {
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function ReviewCard({ review }: ReviewCardProps) {
  const { reviewerName, reviewerPhoto, rating, comment, createdAt, moderationStatus } = review;

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface, #ffffff)',
        border:          '1px solid var(--color-border)',
        borderRadius:    '12px',
        padding:         '16px',
        display:         'flex',
        flexDirection:   'column',
        gap:             '10px',
      }}
    >
      {/* Header row: avatar + name + date + optional badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        {/* Avatar */}
        {reviewerPhoto ? (
          <img
            src={reviewerPhoto}
            alt={reviewerName}
            style={{
              width:        '40px',
              height:       '40px',
              borderRadius: '50%',
              objectFit:    'cover',
              flexShrink:   0,
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              width:           '40px',
              height:          '40px',
              borderRadius:    '50%',
              backgroundColor: 'var(--color-primary)',
              color:           '#ffffff',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              fontWeight:      700,
              fontSize:        '13px',
              flexShrink:      0,
            }}
          >
            {initials(reviewerName)}
          </div>
        )}

        {/* Name + date */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin:      0,
              fontWeight:  600,
              fontSize:    '14px',
              color:       'var(--color-text)',
              overflow:    'hidden',
              textOverflow:'ellipsis',
              whiteSpace:  'nowrap',
            }}
          >
            {reviewerName}
          </p>
          <p
            style={{
              margin:   0,
              fontSize: '12px',
              color:    'var(--color-text-secondary)',
              marginTop:'1px',
            }}
          >
            {formatDate(createdAt)}
          </p>
        </div>

        {/* Moderation badge */}
        {moderationStatus === 'pending' && (
          <span
            style={{
              flexShrink:      0,
              padding:         '2px 10px',
              borderRadius:    '999px',
              fontSize:        '11px',
              fontWeight:      600,
              backgroundColor: 'color-mix(in srgb, var(--color-warning) 15%, transparent)',
              color:           'var(--color-warning)',
              border:          '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)',
              whiteSpace:      'nowrap',
            }}
          >
            Under review
          </span>
        )}
      </div>

      {/* Star rating */}
      <StarRating value={rating} readOnly size={16} />

      {/* Comment */}
      {comment && (
        <p
          style={{
            margin:     0,
            fontSize:   '14px',
            lineHeight: 1.6,
            color:      'var(--color-text-secondary)',
          }}
        >
          {comment}
        </p>
      )}
    </div>
  );
}
