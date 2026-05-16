/**
 * app/live/[id]/page.tsx
 * Live stream viewer — video + featured products + live chat.
 * Phase 5 — Live streaming.
 *
 * NOTE: Real HLS playback requires hls.js or native Safari support; this
 * implementation uses a plain <video> tag for MP4/HLS-on-Safari fallback.
 * For production add hls.js for cross-browser HLS support.
 */

'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import Link                from 'next/link';
import { useParams }       from 'next/navigation';
import {
  addDoc, collection, doc, getDoc, getDocs, limit as fbLimit,
  onSnapshot, orderBy, query, serverTimestamp, where, documentId,
} from 'firebase/firestore';
import {
  Radio, Users, Send, Heart, ShoppingBag,
} from 'lucide-react';
import { db }            from '@/services/firebase';
import { useAuthStore }  from '@/store/authStore';
import BuyerLayout       from '@/components/layouts/BuyerLayout';
import type { LiveStream, Product, StreamChatMessage } from '@/types';

interface FloatingHeart {
  id: number;
  left: number;
}

export default function LiveStreamViewerPage() {
  const params = useParams<{ id: string }>();
  const streamId = params.id;
  const { user } = useAuthStore();

  const [stream,   setStream]   = useState<LiveStream | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [messages, setMessages] = useState<StreamChatMessage[]>([]);
  const [input,    setInput]    = useState('');
  const [hearts,   setHearts]   = useState<FloatingHeart[]>([]);
  const [duration, setDuration] = useState(0);

  const chatEndRef  = useRef<HTMLDivElement>(null);
  const heartIdRef  = useRef(0);

  // Load stream
  useEffect(() => {
    if (!streamId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'liveStreams', streamId));
        if (!snap.exists() || cancelled) return;
        const data = { id: snap.id, ...(snap.data() as Omit<LiveStream, 'id'>) };
        setStream(data);

        // Load featured products (chunks of 10 for `in` query)
        if (data.productIds && data.productIds.length > 0) {
          const ids = data.productIds.slice(0, 10);
          const psnap = await getDocs(query(
            collection(db, 'products'),
            where(documentId(), 'in', ids),
          ));
          if (cancelled) return;
          setProducts(psnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) })));
        }
      } catch (err) {
        console.error('[live viewer] load failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [streamId]);

  // Realtime chat
  useEffect(() => {
    if (!streamId) return;
    const q = query(
      collection(db, 'liveStreams', streamId, 'chat'),
      orderBy('createdAt', 'asc'),
      fbLimit(200),
    );
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StreamChatMessage, 'id'>) })));
    });
  }, [streamId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Duration timer (if live)
  useEffect(() => {
    if (!stream?.startedAt) return;
    const start = stream.startedAt.toDate
      ? stream.startedAt.toDate().getTime()
      : (stream.startedAt.seconds ?? 0) * 1000;
    const tick = () => setDuration(Math.floor((Date.now() - start) / 1000));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [stream?.startedAt]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || !user || !streamId) return;
    const text = input.trim();
    setInput('');
    try {
      await addDoc(collection(db, 'liveStreams', streamId, 'chat'), {
        streamId,
        senderUid:  user.uid,
        senderName: user.name ?? 'Anonymous',
        text,
        createdAt:  serverTimestamp(),
      });
    } catch (err) {
      console.error('[live viewer] send failed', err);
    }
  }

  function spawnHeart() {
    const id = ++heartIdRef.current;
    const left = 8 + Math.random() * 40;
    setHearts((prev) => [...prev, { id, left }]);
    window.setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== id));
    }, 2400);
  }

  function fmtDuration(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  if (!stream) {
    return (
      <BuyerLayout>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          Loading stream…
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout>
      <style>{`
        @keyframes floatHeart {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-260px) scale(1.6); opacity: 0; }
        }
        @media (max-width: 900px) {
          .live-grid { grid-template-columns: 1fr !important; }
          .live-chat { height: 360px !important; }
        }
      `}</style>

      <div
        className="live-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '70% 30%',
          gap: 16,
          padding: 16,
          maxWidth: 1400,
          margin: '0 auto',
        }}
      >
        {/* Left: video + products */}
        <div>
          <div style={{
            position: 'relative',
            background: '#000',
            borderRadius: 12,
            overflow: 'hidden',
            paddingBottom: '56.25%',
          }}>
            <video
              src={stream.streamUrl ?? ''}
              poster={stream.thumbnailUrl}
              controls
              autoPlay
              playsInline
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
              }}
            />

            {/* LIVE + viewers + duration */}
            <div style={{
              position: 'absolute', top: 12, left: 12,
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              {stream.status === 'live' && (
                <span style={{
                  background: 'var(--color-danger)', color: '#fff',
                  fontSize: 11, fontWeight: 700, padding: '4px 8px',
                  borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Radio size={11} /> LIVE
                </span>
              )}
              <span style={{
                background: 'rgba(0,0,0,0.6)', color: '#fff',
                fontSize: 11, padding: '4px 8px', borderRadius: 4,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Users size={11} /> {stream.viewerCount}
              </span>
              {stream.status === 'live' && (
                <span style={{
                  background: 'rgba(0,0,0,0.6)', color: '#fff',
                  fontSize: 11, padding: '4px 8px', borderRadius: 4,
                }}>
                  {fmtDuration(duration)}
                </span>
              )}
            </div>

            {/* Floating hearts */}
            <div style={{
              position: 'absolute', right: 16, bottom: 16,
              pointerEvents: 'none', width: 60, height: 280,
            }}>
              {hearts.map((h) => (
                <Heart
                  key={h.id}
                  size={28}
                  fill="var(--color-danger)"
                  color="var(--color-danger)"
                  style={{
                    position: 'absolute', bottom: 0, left: h.left,
                    animation: 'floatHeart 2.4s ease-out forwards',
                  }}
                />
              ))}
            </div>

            <button
              onClick={spawnHeart}
              aria-label="Send heart"
              style={{
                position: 'absolute', right: 16, bottom: 16,
                background: 'rgba(0,0,0,0.5)', border: 'none',
                color: '#fff', cursor: 'pointer',
                width: 44, height: 44, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Heart size={20} />
            </button>
          </div>

          {/* Title & seller */}
          <div style={{ padding: '14px 4px' }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
              {stream.title}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              {stream.sellerName}
            </p>
            {stream.description && (
              <p style={{ fontSize: 13, color: 'var(--color-text)', marginTop: 8 }}>
                {stream.description}
              </p>
            )}
          </div>

          {/* Featured products carousel */}
          {products.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{
                fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
                marginBottom: 8,
              }}>
                Featured Products
              </p>
              <div style={{
                display: 'flex', gap: 10, overflowX: 'auto',
                paddingBottom: 8,
              }}>
                {products.map((p) => (
                  <div key={p.id} style={{
                    flexShrink: 0, width: 160,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 10, overflow: 'hidden',
                  }}>
                    {p.images?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0].url}
                        alt={p.name}
                        style={{ width: '100%', height: 110, objectFit: 'cover' }}
                      />
                    )}
                    <div style={{ padding: 8 }}>
                      <p style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--color-text)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.name}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 700, marginTop: 2 }}>
                        {p.currency} {p.price}
                      </p>
                      <Link
                        href={`/product/${p.id}`}
                        style={{
                          marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: 4, background: 'var(--color-primary)', color: '#fff',
                          padding: '6px 8px', borderRadius: 6,
                          fontSize: 11, fontWeight: 600, textDecoration: 'none',
                        }}
                      >
                        <ShoppingBag size={11} /> Buy Now
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: chat */}
        <div
          className="live-chat"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            display: 'flex', flexDirection: 'column',
            height: 'calc(100vh - 64px - 80px - 32px)',
          }}
        >
          <div style={{
            padding: '12px 14px', borderBottom: '1px solid var(--color-border)',
            fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
          }}>
            Live Chat
          </div>

          <div style={{
            flex: 1, overflowY: 'auto', padding: 12,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {messages.length === 0 && (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center', marginTop: 20 }}>
                Be the first to say hi.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} style={{ fontSize: 13, color: 'var(--color-text)' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{m.senderName}</span>
                <span style={{ marginLeft: 6 }}>{m.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form
            onSubmit={sendMessage}
            style={{
              padding: 10, borderTop: '1px solid var(--color-border)',
              display: 'flex', gap: 6,
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={user ? 'Say something…' : 'Sign in to chat'}
              disabled={!user}
              style={{
                flex: 1,
                background: 'var(--color-background)',
                border: '1px solid var(--color-border)',
                borderRadius: 8, padding: '8px 10px',
                color: 'var(--color-text)', fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!user || !input.trim()}
              aria-label="Send"
              style={{
                background: 'var(--color-primary)', color: '#fff',
                border: 'none', cursor: 'pointer',
                width: 36, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </BuyerLayout>
  );
}
