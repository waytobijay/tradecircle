/**
 * hooks/useFeed.ts
 * Social feed hook with cursor-based pagination and manual refresh.
 * Spec ref: section 3 (Authenticated Home Feed), section 9.4
 *
 * Reads from the `products` Firestore collection (and in future `advicePosts`).
 * Each page loads PAGE_SIZE=12 items; loadMore() appends the next page.
 *
 * Usage:
 *   const { items, loading, loadingMore, hasMore, loadMore, refresh } =
 *     useFeed('all');
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  Query,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { Product } from '@/types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type FeedFilter = 'all' | 'products' | 'advice' | 'near-me' | 'following';

export interface FeedItem {
  type: 'product' | 'advice';
  id: string;
  data: Product | Record<string, unknown>;
  createdAt: { seconds: number; nanoseconds: number };
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PAGE_SIZE = 12;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function docToFeedItem(
  docSnap: QueryDocumentSnapshot<DocumentData>,
  type: 'product' | 'advice'
): FeedItem {
  const data = docSnap.data();
  return {
    type,
    id: docSnap.id,
    data: { id: docSnap.id, ...data } as Product | Record<string, unknown>,
    createdAt: data.createdAt ?? { seconds: 0, nanoseconds: 0 },
  };
}

/**
 * Build the Firestore query for the given filter.
 * Currently all filters except 'advice' read from `products`.
 * 'advice' reads from `advicePosts`.
 * 'near-me' and 'following' are server-filtered by client code at the
 * component level for MVP — they reuse the same base query.
 */
function buildBaseQuery(filter: FeedFilter, afterCursor?: QueryDocumentSnapshot<DocumentData>): Query<DocumentData> {
  const collectionName = filter === 'advice' ? 'advicePosts' : 'products';
  const ref = collection(db, collectionName);

  const constraints = [
    orderBy('createdAt', 'desc'),
    limit(PAGE_SIZE),
    ...(afterCursor ? [startAfter(afterCursor)] : []),
  ] as Parameters<typeof query>[1][];

  return query(ref, ...constraints);
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useFeed(filter: FeedFilter = 'all') {
  const [items, setItems]               = useState<FeedItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [hasMore, setHasMore]           = useState(true);

  // Cursor pointing to the last fetched document for startAfter pagination
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  // Derive item type from filter
  const itemType: 'product' | 'advice' = filter === 'advice' ? 'advice' : 'product';

  // ── Initial load / refresh ─────────────────

  const refresh = useCallback(async () => {
    setLoading(true);
    setHasMore(true);
    lastDocRef.current = null;

    try {
      const q = buildBaseQuery(filter);
      const snapshot = await getDocs(q);

      const fetched: FeedItem[] = snapshot.docs.map((d) =>
        docToFeedItem(d, itemType)
      );

      setItems(fetched);

      if (snapshot.docs.length > 0) {
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
      }

      if (snapshot.docs.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (err) {
      console.error('[useFeed] refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, itemType]);

  // ── Load more (next page) ──────────────────

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDocRef.current) return;

    setLoadingMore(true);

    try {
      const q = buildBaseQuery(filter, lastDocRef.current);
      const snapshot = await getDocs(q);

      const fetched: FeedItem[] = snapshot.docs.map((d) =>
        docToFeedItem(d, itemType)
      );

      setItems((prev) => [...prev, ...fetched]);

      if (snapshot.docs.length > 0) {
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
      }

      if (snapshot.docs.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (err) {
      console.error('[useFeed] loadMore error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [filter, hasMore, itemType, loadingMore]);

  // ── Run refresh when filter changes ───────

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
  };
}
