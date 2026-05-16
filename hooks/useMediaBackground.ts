/**
 * hooks/useMediaBackground.ts
 * Loads the login/landing media background slides from Firestore.
 *
 * Firestore shape — `config/loginMedia`:
 *   { enabled: boolean, slides: Array<{ type: 'video' | 'image', url: string }> }
 *
 * Falls back to default Unsplash slides when:
 *   - Firebase is not configured
 *   - The doc does not exist
 *   - `enabled === false`
 *   - Read fails for any reason
 */

'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/services/firebase';
import type { MediaSlide } from '@/components/ui/MediaBackground';

const DEFAULT_SLIDES: MediaSlide[] = [
  { type: 'image', url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1920&q=80' },
  { type: 'image', url: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=1920&q=80' },
  { type: 'image', url: 'https://images.unsplash.com/photo-1573483587126-d3d0a1f3ad1d?w=1920&q=80' },
];

export interface UseMediaBackgroundResult {
  slides:  MediaSlide[];
  loading: boolean;
}

export function useMediaBackground(): UseMediaBackgroundResult {
  const [slides,  setSlides]  = useState<MediaSlide[]>(DEFAULT_SLIDES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!isFirebaseConfigured || !db) {
      setLoading(false);
      return;
    }

    getDoc(doc(db, 'config', 'loginMedia'))
      .then((snap) => {
        if (cancelled) return;
        if (!snap.exists()) return; // keep defaults
        const data = snap.data() as { enabled?: boolean; slides?: MediaSlide[] };
        if (data.enabled === false) {
          // Master toggle off — return empty so MediaBackground shows its
          // default gradient fallback.
          setSlides([]);
          return;
        }
        const cleaned = (data.slides ?? [])
          .filter((s) => s && typeof s.url === 'string' && s.url.length > 0)
          .map((s) => ({
            type: s.type === 'video' ? 'video' : 'image',
            url:  s.url,
          })) as MediaSlide[];
        if (cleaned.length > 0) setSlides(cleaned);
      })
      .catch(() => { /* keep defaults */ })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return { slides, loading };
}

export const DEFAULT_LOGIN_MEDIA_SLIDES = DEFAULT_SLIDES;
