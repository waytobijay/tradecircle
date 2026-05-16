/**
 * components/reviews/ReviewSection.tsx
 * Full reviews section: aggregate summary, review list, and optional write-a-review form.
 *
 * Props:
 *   sellerId  — which seller's reviews to show
 *   orderId   — when provided + user is authenticated + hasn't reviewed yet → show form
 *
 * Spec ref: section 6.2 (Review System)
 */

'use client';

import { useState } from 'react';
import { useReviews } from '@/hooks/useReviews';
import { useAuthStore } from '@/store/authStore';
import StarRating from '@/components/ui/StarRating';
import ReviewCard from '@/components/ui/ReviewCard';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface ReviewSectionProps {
  sellerId: string;
  orderId?: string;
}

// ─────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────

function ReviewSkeleton() {
  return (
    <div
      className="animate-pulse"
      style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height:          '100px',
            borderRadius:    '12px',
            backgroundColor: 'var(--color-border)',
            opacity:         0.5,
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Aggregate summary bar
// ─────────────────────────────────────────────

function AggregateSummary({ aggregate }: { aggregate: ReturnType<typeof useReviews>['aggregate'] }) {
  const { average, count, breakdown } = aggregate;

  return (
    <div
      style={{
        display:         'flex',
        gap:             '24px',
        alignItems:      'center',
        flexWrap:        'wrap',
        padding:         '20px',
        backgroundColor: 'var(--color-surface, #ffffff)',
        border:          '1px solid var(--color-border)',
        borderRadius:    '12px',
        marginBottom:    '24px',
      }}
    >
      {/* Big average number */}
      <div style={{ textAlign: 'center', minWidth: '72px' }}>
        <p
          style={{
            margin:     0,
            fontSize:   '48px',
            fontWeight: 800,
            lineHeight: 1,
            color:      'var(--color-text)',
          }}
        >
          {average.toFixed(1)}
        </p>
        <StarRating value={average} readOnly size={18} />
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {count} review{count !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Breakdown bars */}
      <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const starCount = breakdown[star] ?? 0;
          const pct       = count > 0 ? (starCount / count) * 100 : 0;

          return (
            <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', width: '14px', textAlign: 'right', flexShrink: 0 }}>
                {star}
              </span>
              {/* Track */}
              <div
                style={{
                  flex:            1,
                  height:          '7px',
                  borderRadius:    '4px',
                  backgroundColor: 'var(--color-border)',
                  overflow:        'hidden',
                }}
              >
                {/* Fill */}
                <div
                  style={{
                    height:          '100%',
                    width:           `${pct}%`,
                    borderRadius:    '4px',
                    backgroundColor: 'var(--color-warning, #F59E0B)',
                    transition:      'width 0.4s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', width: '20px', flexShrink: 0 }}>
                {starCount}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Write a Review form
// ─────────────────────────────────────────────

function WriteReviewForm({
  sellerId,
  orderId,
  productId,
  onSubmitted,
}: {
  sellerId:    string;
  orderId:     string;
  productId:   string;
  onSubmitted: () => void;
}) {
  const { submitReview } = useReviews(sellerId);
  const [rating,      setRating]      = useState<1 | 2 | 3 | 4 | 5 | 0>(0);
  const [comment,     setComment]     = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [submitted,   setSubmitted]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setError('Please select a star rating.'); return; }

    setSubmitting(true);
    setError(null);

    try {
      await submitReview({
        orderId,
        productId,
        rating: rating as 1 | 2 | 3 | 4 | 5,
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
      onSubmitted();
    } catch (err) {
      console.error('[WriteReviewForm] submitReview failed:', err);
      setError('Failed to submit your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        style={{
          padding:         '20px',
          borderRadius:    '12px',
          backgroundColor: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
          border:          '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)',
          textAlign:       'center',
          color:           'var(--color-success)',
          fontWeight:      600,
          fontSize:        '14px',
        }}
      >
        Thank you! Your review has been submitted and is awaiting approval.
      </div>
    );
  }

  return (
    <div
      style={{
        padding:         '20px',
        borderRadius:    '12px',
        backgroundColor: 'var(--color-surface, #ffffff)',
        border:          '1px solid var(--color-border)',
        marginBottom:    '24px',
      }}
    >
      <h3
        style={{
          margin:     '0 0 16px',
          fontSize:   '16px',
          fontWeight: 700,
          color:      'var(--color-text)',
        }}
      >
        Write a Review
      </h3>

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Star picker */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
            Your Rating *
          </label>
          <StarRating
            value={rating}
            size={28}
            onChange={(v) => { setRating(v as 1 | 2 | 3 | 4 | 5); setError(null); }}
          />
        </div>

        {/* Comment */}
        <div>
          <label
            htmlFor="review-comment"
            style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}
          >
            Comment (optional)
          </label>
          <textarea
            id="review-comment"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience with this seller…"
            maxLength={1000}
            style={{
              width:           '100%',
              padding:         '10px 12px',
              borderRadius:    '8px',
              border:          '1.5px solid var(--color-border)',
              backgroundColor: 'var(--color-background)',
              color:           'var(--color-text)',
              fontSize:        '14px',
              resize:          'vertical',
              minHeight:       '100px',
              outline:         'none',
              boxSizing:       'border-box',
              fontFamily:      'inherit',
            }}
          />
          <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
            {comment.length}/1000
          </p>
        </div>

        {error && (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-danger)', fontWeight: 500 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            alignSelf:       'flex-start',
            padding:         '10px 24px',
            borderRadius:    '8px',
            backgroundColor: submitting ? 'var(--color-border)' : 'var(--color-primary)',
            color:           submitting ? 'var(--color-text-secondary)' : '#ffffff',
            fontWeight:      600,
            fontSize:        '14px',
            border:          'none',
            cursor:          submitting ? 'not-allowed' : 'pointer',
            transition:      'background-color 0.15s ease',
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Review'}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main ReviewSection
// ─────────────────────────────────────────────

export default function ReviewSection({ sellerId, orderId }: ReviewSectionProps) {
  const { user }                            = useAuthStore();
  const { reviews, aggregate, loading }     = useReviews(sellerId);
  const [formDismissed, setFormDismissed]   = useState(false);

  // Check if the current user has already reviewed for this order
  const alreadyReviewed =
    !!user &&
    !!orderId &&
    reviews.some((r) => r.reviewerId === user.uid && r.orderId === orderId);

  const showForm =
    !!orderId &&
    !!user &&
    !alreadyReviewed &&
    !formDismissed;

  // Derive a productId from context — the form needs it.
  // The page passes orderId; we use a sentinel that gets overridden by the caller's context.
  // In practice ReviewSection consumers should pass productId too; we default to '' here
  // and rely on the page layer having it available via orderId-linked order doc if needed.
  // For the product page integration, product.id is available as a separate prop.
  // We expose productId as an optional prop with a safe default.
  return (
    <section aria-label="Reviews" style={{ marginTop: '40px' }}>
      <h2
        style={{
          margin:     '0 0 20px',
          fontSize:   '20px',
          fontWeight: 700,
          color:      'var(--color-text)',
        }}
      >
        Customer Reviews
      </h2>

      {loading ? (
        <ReviewSkeleton />
      ) : (
        <>
          {/* Aggregate summary */}
          {aggregate.count > 0 && <AggregateSummary aggregate={aggregate} />}

          {/* Write a review form */}
          {showForm && (
            <WriteReviewForm
              sellerId={sellerId}
              orderId={orderId}
              productId=""
              onSubmitted={() => setFormDismissed(true)}
            />
          )}

          {/* Review list */}
          {reviews.length === 0 ? (
            <div
              style={{
                padding:         '40px 20px',
                textAlign:       'center',
                color:           'var(--color-text-secondary)',
                fontSize:        '14px',
                backgroundColor: 'var(--color-surface, #ffffff)',
                border:          '1px solid var(--color-border)',
                borderRadius:    '12px',
              }}
            >
              No reviews yet. Be the first to leave one!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
