/**
 * app/videos/upload/page.tsx
 * Seller video upload — drag-drop, Cloudinary, browser-side thumbnail.
 * Phase 5 — Video marketplace.
 *
 * NOTE: Cloudinary upload uses `resource_type: 'video'` — this requires
 * the upload preset (NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) to permit video
 * uploads. Configure in your Cloudinary dashboard.
 */

'use client';

import {
  useEffect, useRef, useState, ChangeEvent, DragEvent, FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  addDoc, collection, getDocs, query, serverTimestamp, where,
} from 'firebase/firestore';
import { Upload, Loader2, X, CheckCircle, AlertCircle } from 'lucide-react';
import { db }            from '@/services/firebase';
import { useAuthStore }  from '@/store/authStore';
import SellerLayout      from '@/components/layouts/SellerLayout';
import type { Product }  from '@/types';

const MAX_BYTES   = 50 * 1024 * 1024;     // 50MB
const ACCEPT_MIME = ['video/mp4', 'video/webm'];

export default function VideoUploadPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const uid = user?.uid ?? '';

  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [productId, setProductId]       = useState('');
  const [tagsRaw, setTagsRaw]           = useState('');
  const [products, setProducts]         = useState<Product[]>([]);

  const [file, setFile]                 = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null);
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);
  const [durationSec, setDurationSec]   = useState<number>(0);
  const [dragOver, setDragOver]         = useState(false);

  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);

  const videoElRef  = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  const cloudName    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';

  // Load seller's products
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const q = query(collection(db, 'products'), where('sellerId', '==', uid));
        const snap = await getDocs(q);
        if (cancelled) return;
        setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) })));
      } catch (err) {
        console.error('[upload] product list failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  // Cleanup object URL
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  function validateFile(f: File): string | null {
    if (!ACCEPT_MIME.includes(f.type)) return 'Only MP4 or WebM videos are supported.';
    if (f.size > MAX_BYTES) return 'Video must be 50 MB or smaller.';
    return null;
  }

  function handleFile(f: File) {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError(null);
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setThumbDataUrl(null);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  // After preview loads, seek to 1s and capture thumbnail
  function onPreviewLoaded() {
    const v = videoElRef.current;
    if (!v) return;
    setDurationSec(Math.floor(v.duration || 0));
    const seekTo = Math.min(1, (v.duration || 1) / 2);
    const handler = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = v.videoWidth  || 640;
      canvas.height = v.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      try {
        setThumbDataUrl(canvas.toDataURL('image/jpeg', 0.8));
      } catch (err) {
        console.warn('[upload] thumbnail capture failed', err);
      }
      v.removeEventListener('seeked', handler);
    };
    v.addEventListener('seeked', handler);
    try { v.currentTime = seekTo; } catch { /* noop */ }
  }

  // Convert data URL to Blob for upload
  function dataUrlToBlob(dataUrl: string): Blob {
    const [meta, b64] = dataUrl.split(',');
    const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? 'image/jpeg';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  async function cloudinaryUpload(blob: Blob | File, resourceType: 'video' | 'image'): Promise<string> {
    const form = new FormData();
    form.append('file', blob);
    form.append('upload_preset', uploadPreset);
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      { method: 'POST', body: form },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message ?? `Upload failed (${res.status})`);
    }
    const data = await res.json() as { secure_url: string };
    return data.secure_url;
  }

  async function handlePublish(e: FormEvent) {
    e.preventDefault();
    if (!uid)        { setError('You must be logged in.'); return; }
    if (!file)       { setError('Choose a video file.'); return; }
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!cloudName || !uploadPreset) {
      setError('Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / _UPLOAD_PRESET.');
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(10);

    try {
      // 1. Upload video
      const videoUrl = await cloudinaryUpload(file, 'video');
      setProgress(70);

      // 2. Upload thumbnail (if captured) — else use empty string
      let thumbUrl = '';
      if (thumbDataUrl) {
        const blob = dataUrlToBlob(thumbDataUrl);
        thumbUrl = await cloudinaryUpload(blob, 'image');
      }
      setProgress(90);

      // 3. Write Firestore doc
      const tags = tagsRaw.split(',').map((s) => s.trim()).filter(Boolean);
      await addDoc(collection(db, 'productVideos'), {
        sellerId:     uid,
        productId:    productId || null,
        title:        title.trim(),
        description:  description.trim(),
        videoUrl,
        thumbnailUrl: thumbUrl,
        durationSec,
        views:        0,
        likes:        0,
        tags,
        createdAt:    serverTimestamp(),
        active:       true,
      });

      setProgress(100);
      setSuccess(true);
      setTimeout(() => router.push('/videos'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  }

  function clearFile() {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setThumbDataUrl(null);
    setDurationSec(0);
  }

  return (
    <SellerLayout>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: 'var(--color-text)' }}>
          Upload Product Video
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
          Share short product videos to engage buyers in the video feed.
        </p>

        <form onSubmit={handlePublish} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Drag-drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 12, padding: 24,
              background: 'var(--color-surface)',
              cursor: 'pointer', textAlign: 'center',
              minHeight: 200,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 10,
            }}
          >
            {!file && (
              <>
                <Upload size={32} color="var(--color-text-secondary)" />
                <p style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500 }}>
                  Drag &amp; drop a video, or click to browse
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  MP4 or WebM · max 50 MB
                </p>
              </>
            )}

            {file && previewUrl && (
              <div style={{ width: '100%', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                <video
                  ref={videoElRef}
                  src={previewUrl}
                  controls
                  muted
                  onLoadedMetadata={onPreviewLoaded}
                  style={{ width: '100%', maxHeight: 360, borderRadius: 8, background: '#000' }}
                />
                <button
                  type="button"
                  onClick={clearFile}
                  aria-label="Remove video"
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    border: 'none', cursor: 'pointer',
                    borderRadius: '50%', width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={16} />
                </button>
                <p style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
                  {durationSec > 0 && ` · ${durationSec}s`}
                </p>
                {thumbDataUrl && (
                  <p style={{ marginTop: 6, fontSize: 12, color: 'var(--color-success)' }}>
                    <CheckCircle size={12} style={{ verticalAlign: 'middle' }} /> Thumbnail captured
                  </p>
                )}
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/webm"
              onChange={onInputChange}
              style={{ display: 'none' }}
            />
          </div>

          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Title */}
          <Field label="Title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              style={inputStyle}
            />
          </Field>

          {/* Description */}
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          {/* Product select */}
          <Field label="Linked product (optional)">
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              style={inputStyle}
            >
              <option value="">— None —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>

          {/* Tags */}
          <Field label="Tags (comma-separated)">
            <input
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="electronics, demo, review"
              style={inputStyle}
            />
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

          {uploading && (
            <div>
              <div style={{
                height: 6, background: 'var(--color-surface)',
                borderRadius: 3, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${progress}%`, height: '100%',
                  background: 'var(--color-primary)',
                  transition: 'width 0.3s',
                }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6 }}>
                Uploading… {progress}%
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || success || !file}
            style={{
              background: success ? 'var(--color-success)' : 'var(--color-primary)',
              color: '#fff', border: 'none', cursor: uploading || !file ? 'not-allowed' : 'pointer',
              padding: '12px 16px', borderRadius: 10, fontSize: 15, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: (uploading || !file) ? 0.7 : 1,
            }}
          >
            {uploading && <Loader2 size={16} className="spin" />}
            {success ? 'Published!' : uploading ? 'Publishing…' : 'Publish Video'}
          </button>
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
