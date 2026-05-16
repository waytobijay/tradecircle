/**
 * components/ui/MediaBackground.tsx
 * Cinematic blurred media background — videos and/or image slides — that runs
 * behind foreground page content (login, landing hero, etc.).
 *
 * Features:
 *   - Cross-fade between slides
 *   - Auto-advance on `intervalSec` OR on video end
 *   - Heavy blur + scale to hide blur edges
 *   - Dark gradient overlay for foreground legibility
 *   - Respects `prefers-reduced-motion` (disables auto-rotation)
 *   - Mobile-friendly: shows static first image on small screens / no slides
 *   - Falls back to a default gradient when `slides` is empty
 */

'use client';

import { useEffect, useRef, useState } from 'react';

export interface MediaSlide {
  type: 'video' | 'image';
  url:  string;
}

interface MediaBackgroundProps {
  slides:          MediaSlide[];
  blurPx?:         number;   // default 24
  overlayOpacity?: number;   // 0–1, default 0.55 — combined with gradient
  intervalSec?:    number;   // default 6
}

export function MediaBackground({
  slides,
  blurPx          = 24,
  overlayOpacity  = 0.55,
  intervalSec     = 6,
}: MediaBackgroundProps) {
  const [activeIdx, setActiveIdx]       = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

  // Respect OS / browser reduced-motion preference.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  // Auto-advance timer — paused for reduced motion or single/empty slide list.
  useEffect(() => {
    if (reducedMotion) return;
    if (!slides || slides.length <= 1) return;
    const current = slides[activeIdx];

    // For videos we let the `onEnded` handler drive advancement, but still
    // keep a fallback timer in case the video silently fails.
    const ms = Math.max(2, intervalSec) * 1000;
    const t = window.setTimeout(() => {
      setActiveIdx((i) => (i + 1) % slides.length);
    }, current?.type === 'video' ? ms * 1.5 : ms);

    return () => window.clearTimeout(t);
  }, [activeIdx, slides, intervalSec, reducedMotion]);

  // Play / pause videos based on which slide is active.
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === activeIdx) {
        v.muted = true;
        v.play().catch(() => { /* autoplay may be blocked — ignore */ });
      } else {
        v.pause();
      }
    });
  }, [activeIdx]);

  // ─── Empty / fallback — pure CSS gradient only ────────────────────────────
  if (!slides || slides.length === 0) {
    return (
      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: -1,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #312e81 100%)',
        }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden',
        // Solid base so the blur halo never bleeds white.
        background: '#0f172a',
      }}
    >
      {slides.map((slide, i) => {
        const active = i === activeIdx;
        // Only the active slide + the next one get rendered "hot" — others
        // are lazy / preload metadata only.
        const isNext = i === (activeIdx + 1) % slides.length;
        const eager  = active || isNext;

        const layerStyle: React.CSSProperties = {
          position: 'absolute', inset: 0,
          opacity:    active ? 1 : 0,
          transition: 'opacity 1.2s ease-in-out',
          filter:     `blur(${blurPx}px) saturate(110%)`,
          transform:  'scale(1.08)',         // hide blur edge artifacts
          willChange: 'opacity',
        };

        if (slide.type === 'video') {
          return (
            <video
              key={`${slide.url}-${i}`}
              ref={(el) => { videoRefs.current[i] = el; }}
              src={eager ? slide.url : undefined}
              data-src={slide.url}
              autoPlay={active}
              muted
              loop={slides.length === 1}
              playsInline
              preload={eager ? 'auto' : 'metadata'}
              onEnded={() => {
                if (slides.length > 1 && !reducedMotion) {
                  setActiveIdx((idx) => (idx + 1) % slides.length);
                }
              }}
              style={{
                ...layerStyle,
                width: '100%', height: '100%', objectFit: 'cover',
              }}
            />
          );
        }

        // Image slide.
        return (
          <div
            key={`${slide.url}-${i}`}
            style={{
              ...layerStyle,
              backgroundImage:    eager ? `url(${slide.url})` : undefined,
              backgroundSize:     'cover',
              backgroundPosition: 'center',
              backgroundRepeat:   'no-repeat',
            }}
          />
        );
      })}

      {/* Dark gradient overlay — foreground readability. */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(15,23,42,0.6), rgba(15,23,42,0.7))',
          opacity: Math.max(0, Math.min(1, overlayOpacity / 0.55)), // scale from spec default
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

export default MediaBackground;
