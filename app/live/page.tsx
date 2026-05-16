/**
 * app/live/page.tsx
 * Live streams discovery — Live Now / Scheduled tabs.
 * Phase 5 — Live streaming.
 */

'use client';

import { useEffect, useState } from 'react';
import Link                    from 'next/link';
import {
  collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { Radio, Calendar, Users, Bell } from 'lucide-react';
import { db }            from '@/services/firebase';
import BuyerLayout       from '@/components/layouts/BuyerLayout';
import type { LiveStream } from '@/types';

type Tab = 'live' | 'scheduled';

export default function LiveDiscoveryPage() {
  const [tab, setTab] = useState<Tab>('live');
  const [liveNow,   setLiveNow]   = useState<LiveStream[]>([]);
  const [scheduled, setScheduled] = useState<LiveStream[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [liveSnap, schedSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'liveStreams'),
            where('status', '==', 'live'),
            orderBy('viewerCount', 'desc'),
            limit(30),
          )),
          getDocs(query(
            collection(db, 'liveStreams'),
            where('status', '==', 'scheduled'),
            orderBy('scheduledFor', 'asc'),
            limit(30),
          )),
        ]);
        if (cancelled) return;
        setLiveNow(liveSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LiveStream, 'id'>) })));
        setScheduled(schedSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LiveStream, 'id'>) })));
      } catch (err) {
        console.error('[live] load failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const list = tab === 'live' ? liveNow : scheduled;

  return (
    <BuyerLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>
          Live Shopping
        </h1>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 20,
          borderBottom: '1px solid var(--color-border)',
        }}>
          <TabButton active={tab === 'live'} onClick={() => setTab('live')}>
            <Radio size={14} color="var(--color-danger)" /> Live Now
            {liveNow.length > 0 && (
              <span style={{
                background: 'var(--color-danger)', color: '#fff',
                fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
              }}>{liveNow.length}</span>
            )}
          </TabButton>
          <TabButton active={tab === 'scheduled'} onClick={() => setTab('scheduled')}>
            <Calendar size={14} /> Scheduled
          </TabButton>
        </div>

        {loading && (
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>
        )}

        {!loading && list.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: 'var(--color-text-secondary)',
          }}>
            {tab === 'live'
              ? 'No live streams right now. Check back soon.'
              : 'No upcoming scheduled streams.'}
          </div>
        )}

        {!loading && list.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}>
            {list.map((s) => (
              <StreamCard key={s.id} stream={s} mode={tab} />
            ))}
          </div>
        )}
      </div>
    </BuyerLayout>
  );
}

function TabButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '10px 16px', fontSize: 14,
        fontWeight: active ? 600 : 500,
        color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
        borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
        marginBottom: -1,
        display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      {children}
    </button>
  );
}

function StreamCard({ stream, mode }: { stream: LiveStream; mode: Tab }) {
  const dt = stream.scheduledFor?.toDate
    ? stream.scheduledFor.toDate()
    : new Date((stream.scheduledFor?.seconds ?? 0) * 1000);

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 12, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        position: 'relative',
        paddingBottom: '56.25%', background: '#000',
      }}>
        {stream.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stream.thumbnailUrl}
            alt={stream.title}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', objectFit: 'cover',
            }}
          />
        )}
        {mode === 'live' && (
          <>
            <span style={{
              position: 'absolute', top: 8, left: 8,
              background: 'var(--color-danger)', color: '#fff',
              fontSize: 11, fontWeight: 700, padding: '3px 8px',
              borderRadius: 4, letterSpacing: '0.05em',
            }}>● LIVE</span>
            <span style={{
              position: 'absolute', top: 8, right: 8,
              background: 'rgba(0,0,0,0.6)', color: '#fff',
              fontSize: 11, fontWeight: 600, padding: '3px 8px',
              borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Users size={11} /> {stream.viewerCount}
            </span>
          </>
        )}
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <p style={{
          fontSize: 14, fontWeight: 600, color: 'var(--color-text)',
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {stream.title}
        </p>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {stream.sellerName}
        </p>
        {mode === 'scheduled' && (
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            {dt.toLocaleString()}
          </p>
        )}

        {mode === 'live' ? (
          <Link
            href={`/live/${stream.id}`}
            style={{
              marginTop: 'auto',
              background: 'var(--color-primary)', color: '#fff',
              padding: '8px 12px', borderRadius: 8,
              textAlign: 'center', textDecoration: 'none',
              fontSize: 13, fontWeight: 600,
            }}
          >
            Watch Live
          </Link>
        ) : (
          <button
            onClick={() => alert('Reminder set! (placeholder)')}
            style={{
              marginTop: 'auto',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              padding: '8px 12px', borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Bell size={13} /> Set Reminder
          </button>
        )}
      </div>
    </div>
  );
}
