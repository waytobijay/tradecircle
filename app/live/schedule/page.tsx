/**
 * app/live/schedule/page.tsx
 * Seller — schedule or start a live stream.
 * Phase 5 — Live streaming.
 *
 * NOTE: Actual streaming requires an external RTMP/HLS provider
 * (e.g. Mux, Cloudflare Stream, Agora, IVS). This page only writes
 * the schedule/metadata document — the streamUrl field is a placeholder
 * that should be populated by your streaming provider integration.
 */

'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter }                      from 'next/navigation';
import {
  addDoc, collection, getDocs, query, serverTimestamp,
  Timestamp as FbTimestamp, where,
} from 'firebase/firestore';
import {
  Loader2, AlertCircle, Radio, Calendar, Upload,
} from 'lucide-react';
import { db }            from '@/services/firebase';
import { useAuthStore }  from '@/store/authStore';
import SellerLayout      from '@/components/layouts/SellerLayout';
import type { Product }  from '@/types';

export default function LiveSchedulePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const uid = user?.uid ?? '';

  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [products, setProducts]       = useState<Product[]>([]);
  const [thumbFile, setThumbFile]     = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);

  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cloudName    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'products'), where('sellerId', '==', uid)));
        if (cancelled) return;
        setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) })));
      } catch (err) {
        console.error('[live schedule] load products', err);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  function toggleProduct(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function onThumbChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Thumbnail must be an image.'); return; }
    setError(null);
    setThumbFile(f);
    if (thumbPreview) URL.revokeObjectURL(thumbPreview);
    setThumbPreview(URL.createObjectURL(f));
  }

  async function uploadThumbnail(): Promise<string> {
    if (!thumbFile) return '';
    if (!cloudName || !uploadPreset) {
      throw new Error('Cloudinary not configured');
    }
    const form = new FormData();
    form.append('file', thumbFile);
    form.append('upload_preset', uploadPreset);
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: form },
    );
    if (!res.ok) throw new Error(`Thumbnail upload failed (${res.status})`);
    const data = await res.json() as { secure_url: string };
    return data.secure_url;
  }

  async function submit(goLiveNow: boolean, e: FormEvent) {
    e.preventDefault();
    if (!uid) { setError('You must be logged in.'); return; }
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!goLiveNow && !scheduledFor) { setError('Pick a date and time.'); return; }

    setBusy(true);
    setError(null);

    try {
      const thumbnailUrl = await uploadThumbnail();
      const now = new Date();
      const scheduledDate = goLiveNow ? now : new Date(scheduledFor);

      const ref = await addDoc(collection(db, 'liveStreams'), {
        sellerId:     uid,
        sellerName:   user?.name ?? 'Seller',
        title:        title.trim(),
        description:  description.trim(),
        productIds:   selectedIds,
        thumbnailUrl,
        streamUrl:    '',  // populated by streaming provider integration
        scheduledFor: FbTimestamp.fromDate(scheduledDate),
        startedAt:    goLiveNow ? FbTimestamp.fromDate(now) : null,
        status:       goLiveNow ? 'live' : 'scheduled',
        viewerCount:  0,
        peakViewers:  0,
        createdAt:    serverTimestamp(),
      });

      if (goLiveNow) {
        router.push(`/live/${ref.id}`);
      } else {
        router.push('/live');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create stream');
      setBusy(false);
    }
  }

  return (
    <SellerLayout>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
          Schedule a Live Stream
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
          Connect with buyers in real time. You can go live now or schedule for later.
        </p>

        <form style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Title">
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              maxLength={120} required style={inputStyle}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              maxLength={500} rows={3} style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          <Field label="Featured products (select multiple)">
            <div style={{
              maxHeight: 200, overflowY: 'auto',
              border: '1px solid var(--color-border)',
              borderRadius: 8, padding: 8,
              background: 'var(--color-background)',
            }}>
              {products.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: 8 }}>
                  No products yet.
                </p>
              )}
              {products.map((p) => (
                <label
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: 6, cursor: 'pointer',
                    fontSize: 13, color: 'var(--color-text)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleProduct(p.id)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Scheduled date & time (for scheduled streams)">
            <input
              type="datetime-local" value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Thumbnail">
            <div style={{
              border: '1px dashed var(--color-border)',
              borderRadius: 8, padding: 12,
              background: 'var(--color-surface)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {thumbPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbPreview} alt="Thumbnail"
                  style={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 6 }}
                />
              ) : (
                <div style={{
                  width: 120, height: 68, background: 'var(--color-background)',
                  borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-text-secondary)',
                }}>
                  <Upload size={20} />
                </div>
              )}
              <label style={{
                cursor: 'pointer', fontSize: 13, color: 'var(--color-primary)',
                fontWeight: 600,
              }}>
                {thumbPreview ? 'Change' : 'Upload thumbnail'}
                <input
                  type="file" accept="image/*"
                  onChange={onThumbChange}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </Field>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid var(--color-danger)',
              color: 'var(--color-danger)', borderRadius: 8,
              padding: 10, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              disabled={busy}
              onClick={(e) => void submit(true, e)}
              style={{
                flex: 1,
                background: 'var(--color-danger)', color: '#fff',
                border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
                padding: '12px 16px', borderRadius: 10,
                fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? <Loader2 size={16} className="spin" /> : <Radio size={16} />}
              Go Live Now
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={(e) => void submit(false, e)}
              style={{
                flex: 1,
                background: 'var(--color-primary)', color: '#fff',
                border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
                padding: '12px 16px', borderRadius: 10,
                fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? <Loader2 size={16} className="spin" /> : <Calendar size={16} />}
              Schedule
            </button>
          </div>
        </form>
      </div>
    </SellerLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--color-background)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  color: 'var(--color-text)',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
};
