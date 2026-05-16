/**
 * hooks/useReviews.ts
 * Fetches approved reviews for a seller, enriches them with reviewer profile
 * data, computes a RatingAggregate, and exposes submitReview.
 *
 * Spec ref: section 6.2 (Review System)
 *
 * Usage:
 *   const { reviews, aggregate, loading, submitReview } = useReviews(sellerId)
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import type { RatingAggregate, Review } from '@/types';
import type { ReviewWithReviewer } from '@/components/ui/ReviewCard';

// ─────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────

export interface UseReviewsReturn {
  reviews:      ReviewWithReviewer[];
  aggregate:    RatingAggregate;
  loading:      boolean;
  submitReview: (params: {
    orderId:   string;
    rating:    1 | 2 | 3 | 4 | 5;
    comment?:  string;
    productId: string;
  }) => Promise<void>;
}

// ─────────────────────────────────────────────
// Aggregate computation
// ─────────────────────────────────────────────

function computeAggregate(reviews: Review[]): RatingAggregate {
  const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;

  for (const r of reviews) {
    breakdown[r.rating] = (breakdown[r.rating] ?? 0) + 1;
    total += r.rating;
  }

  const count   = reviews.length;
  const average = count > 0 ? Math.round((total / count) * 10) / 10 : 0;

  return { average, count, breakdown };
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useReviews(sellerId: string): UseReviewsReturn {
  const [reviews, setReviews] = useState<ReviewWithReviewer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, 'reviews'),
      where('sellerId',          '==', sellerId),
      where('moderationStatus',  '==', 'approved'),
      orderBy('createdAt',       'desc'),
    );

    getDocs(q)
      .then(async (snap) => {
        const rawReviews = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Review,
        );

        // Batch-fetch reviewer user docs (deduplicate reviewer IDs)
        const uniqueReviewerIds = [...new Set(rawReviews.map((r) => r.reviewerId))];

        const userDocs = await Promise.all(
          uniqueReviewerIds.map((uid) => getDoc(doc(db, 'users', uid))),
        );

        const userMap: Record<string, { name: string; photo?: string }> = {};
        for (const snap of userDocs) {
          if (snap.exists()) {
            const data = snap.data();
            userMap[snap.id] = {
              name:  data.name ?? 'Anonymous',
              photo: data.profilePhoto,
            };
          }
        }

        const enriched: ReviewWithReviewer[] = rawReviews.map((r) => ({
          ...r,
          reviewerName:  userMap[r.reviewerId]?.name  ?? 'Anonymous',
          reviewerPhoto: userMap[r.reviewerId]?.photo,
        }));

        setReviews(enriched);
      })
      .catch((err) => {
        console.error('[useReviews] Failed to fetch reviews:', err);
        setReviews([]);
      })
      .finally(() => setLoading(false));
  }, [sellerId]);

  // Compute aggregate from current reviews list
  const aggregate = useMemo(() => computeAggregate(reviews), [reviews]);

  // ── submitReview ─────────────────────────────

  async function submitReview(params: {
    orderId:   string;
    rating:    1 | 2 | 3 | 4 | 5;
    comment?:  string;
    productId: string;
  }): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Must be signed in to submit a review');

    await addDoc(collection(db, 'reviews'), {
      reviewerId:        currentUser.uid,
      sellerId,
      orderId:           params.orderId,
      productId:         params.productId,
      rating:            params.rating,
      comment:           params.comment ?? '',
      moderationStatus:  'pending',
      createdAt:         serverTimestamp(),
    });
  }

  return { reviews, aggregate, loading, submitReview };
}
