/**
 * hooks/useMediaBackground.ts
 * Loads the login/landing media background configuration from Firestore.
 *
 * Firestore shape — `config/loginMedia`:
 *   { enabled: boolean,
 *     slides:  Array<{ type: 'video' | 'image', url: string }>,
 *     blurPx?:      number,
 *     intervalSec?: number }
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

const DEFAULT_BLUR_PX     = 24;
const DEFAULT_INTERVAL_SEC = 6;

export interface UseMediaBackgroundResult {
  slides:       MediaSlide[];
  enabled:      boolean;
  blurPx:       number;
  intervalSec:  number;
  loading:      boolean;
}

export function useMediaBackground(): UseMediaBackgroundResult {
  const [slides,      setSlides]      = useState<MediaSlide[]>(DEFAULT_SLIDES);
  const [enabled,     setEnabled]     = useState<boolean>(true);
  const [blurPx,      setBlurPx]      = useState<number>(DEFAULT_BLUR_PX);
  const [intervalSec, setIntervalSec] = useState<number>(DEFAULT_INTERVAL_SEC);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!isFirebaseConfigured || !db) {
      setLoading(false);
      return;
    }

    try {
      getDoc(doc(db, 'config', 'loginMedia'))
        .then((snap) => {
          if (cancelled) return;
          if (!snap.exists()) return; // keep defaults
          const data = snap.data() as {
            enabled?:     boolean;
            slides?:      MediaSlide[];
            blurPx?:      number;
            intervalSec?: number;
          };

          if (typeof data.blurPx === 'number' && data.blurPx >= 0) {
            setBlurPx(data.blurPx);
          }
          if (typeof data.intervalSec === 'number' && data.intervalSec >= 2) {
            setIntervalSec(data.intervalSec);
          }

          if (data.enabled === false) {
            setEnabled(false);
            setSlides([]); // empty → MediaBackground shows fallback gradient
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
    } catch {
      // Defensive — never throw out of the hook.
      if (!cancelled) setLoading(false);
    }

    return () => { cancelled = true; };
  }, []);

  return { slides, enabled, blurPx, intervalSec, loading };
}

export const DEFAULT_LOGIN_MEDIA_SLIDES = DEFAULT_SLIDES;
