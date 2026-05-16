'use client';

/**
 * hooks/useAds.ts
 * Fetches active feed ads from Firestore, filters by schedule,
 * shuffles results (Fisher-Yates), and refreshes every 5 minutes.
 */

import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  limit,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { Ad } from '@/types';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function useAds(): { ads: Ad[]; loading: boolean } {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchAds() {
    try {
      const q = query(
        collection(db, 'ads'),
        where('status', '==', 'active'),
        where('type', '==', 'feed'),
        limit(10),
      );
      const snap = await getDocs(q);

      const now = Timestamp.now();

      const filtered: Ad[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Ad))
        .filter((ad) => {
          const start = ad.schedule.startDate;
          const end = ad.schedule.endDate;
          return (
            start.seconds <= now.seconds &&
            now.seconds <= end.seconds
          );
        });

      setAds(fisherYates(filtered));
    } catch {
      // keep existing ads on error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchAds();

    const timer = setInterval(() => {
      void fetchAds();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ads, loading };
}
