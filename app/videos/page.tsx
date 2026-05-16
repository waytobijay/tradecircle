/**
 * app/videos/page.tsx
 * TikTok-style vertical video discovery feed.
 * Phase 5 — Video marketplace.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link                            from 'next/link';
import {
  collection, query, where, orderBy, limit, getDocs,
  doc, updateDoc, increment,
} from 'firebase/firestore';
import {
  Heart, MessageCircle, Share2, Volume2, VolumeX, Plus, ShoppingBag,
} from 'lucide-react';
import { db }            from '@/services/firebase';
import { useAuthStore }  from '@/store/authStore';
import BuyerLayout       from '@/components/layouts/BuyerLayout';
import type { ProductVideo } from '@/types';

export default function VideosPage() {
  const { user } = useAuthStore();
  const isSeller = user?.role === 'seller';

  const [videos, setVideos] = useState<ProductVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Load videos
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = query(
          collection(db, 'productVideos'),
          where('active', '==', true),
          orderBy('createdAt', 'desc'),
          limit(20),
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        setVideos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProductVideo, 'id'>) })));
      } catch (err) {
        console.error('[videos] load failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // IntersectionObserver: auto-play in-view, pause out-of-view
  useEffect(() => {
    if (videos.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('data-video-id') ?? '';
          const el = videoRefs.current[id];
          if (!el) return;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
            el.play().catch(() => { /* autoplay blocked */ });
          } else {
            el.pause();
          }
        });
      },
      { threshold: [0, 0.7, 1] },
    );
    const nodes = containerRef.current?.querySelectorAll('[data-video-id]') ?? [];
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [videos]);

  const handleLike = async (v: ProductVideo) => {
    if (liked[v.id]) return;
    setLiked((prev) => ({ ...prev, [v.id]: true }));
    setVideos((prev) => prev.map((x) => x.id === v.id ? { ...x, likes: x.likes + 1 } : x));
    try {
      await updateDoc(doc(db, 'productVideos', v.id), { likes: increment(1) });
    } catch (err) {
      console.error('[videos] like failed', err);
    }
  };

  return (
    <BuyerLayout>
      <div
        ref={containerRef}
        style={{
          height: 'calc(100vh - 64px - 80px)',
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          background: '#000',
          position: 'relative',
        }}
      >
        {loading && (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
          }}>
            Loading videos…
          </div>
        )}

        {!loading && videos.length === 0 && (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', flexDirection: 'column', gap: 12, padding: 20, textAlign: 'center',
          }}>
            <p style={{ fontSize: 18, fontWeight: 600 }}>No videos yet</p>
            <p style={{ fontSize: 14, color: '#aaa' }}>Be the first to share a product video.</p>
          </div>
        )}

        {videos.map((v) => (
          <div
            key={v.id}
            data-video-id={v.id}
            style={{
              height: '100%',
              scrollSnapAlign: 'start',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#000',
            }}
          >
            <video
              ref={(el) => { videoRefs.current[v.id] = el; }}
              src={v.videoUrl}
              poster={v.thumbnailUrl}
              loop
              muted={muted}
              playsInline
              autoPlay
              style={{
                width: '100%', height: '100%', objectFit: 'contain',
              }}
            />

            {/* Top overlay: mute toggle */}
            <div style={{
              position: 'absolute', top: 12, right: 12,
              display: 'flex', gap: 8,
            }}>
              <button
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Unmute' : 'Mute'}
                style={{
                  background: 'rgba(0,0,0,0.45)', border: 'none', cursor: 'pointer',
                  color: '#fff', borderRadius: '50%', width: 38, height: 38,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>

            {/* Right sidebar */}
            <div style={{
              position: 'absolute', right: 12, bottom: 100,
              display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center',
            }}>
              <button
                onClick={() => void handleLike(v)}
                aria-label="Like"
                style={{
                  background: 'rgba(0,0,0,0.45)', border: 'none', cursor: 'pointer',
                  color: liked[v.id] ? 'var(--color-danger)' : '#fff',
                  borderRadius: '50%', width: 48, height: 48,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Heart size={22} fill={liked[v.id] ? 'currentColor' : 'none'} />
              </button>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, marginTop: -10 }}>
                {v.likes}
              </span>

              <button
                aria-label="Comments"
                style={{
                  background: 'rgba(0,0,0,0.45)', border: 'none', cursor: 'pointer',
                  color: '#fff', borderRadius: '50%', width: 48, height: 48,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <MessageCircle size={22} />
              </button>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, marginTop: -10 }}>0</span>

              <button
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.share) {
                    void navigator.share({ title: v.title, url: window.location.href });
                  }
                }}
                aria-label="Share"
                style={{
                  background: 'rgba(0,0,0,0.45)', border: 'none', cursor: 'pointer',
                  color: '#fff', borderRadius: '50%', width: 48, height: 48,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Share2 size={22} />
              </button>
            </div>

            {/* Bottom overlay */}
            <div style={{
              position: 'absolute', left: 16, right: 80, bottom: 24,
              color: '#fff',
            }}>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                @{v.sellerId.slice(0, 10)}
              </p>
              <p style={{ fontSize: 14, marginBottom: 10, lineHeight: 1.4 }}>{v.title}</p>
              {v.productId && (
                <Link
                  href={`/product/${v.productId}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'var(--color-primary)', color: '#fff',
                    padding: '8px 14px', borderRadius: 24,
                    textDecoration: 'none', fontSize: 13, fontWeight: 600,
                  }}
                >
                  <ShoppingBag size={14} /> Shop Product →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Floating upload FAB (sellers only) */}
      {isSeller && (
        <Link
          href="/videos/upload"
          aria-label="Upload video"
          style={{
            position: 'fixed', right: 20, bottom: 96, zIndex: 50,
            background: 'var(--color-primary)', color: '#fff',
            width: 56, height: 56, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
            textDecoration: 'none',
          }}
        >
          <Plus size={26} />
        </Link>
      )}
    </BuyerLayout>
  );
}
