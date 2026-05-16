/**
 * app/admin/login-media/page.tsx
 * Admin page — configure the login / landing media background.
 *
 * Writes to Firestore `config/loginMedia`:
 *   { enabled: boolean, slides: Array<{ type: 'video' | 'image', url: string }> }
 *
 * Read by `useMediaBackground()` on the public login + landing hero.
 *
 * UI:
 *   - Master enable toggle
 *   - Editable slide list (reorder / delete / URL edit)
 *   - "Add Slide" modal — type selector + URL input + optional Cloudinary upload
 *   - Live <MediaBackground> preview pane on the right
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  ArrowUp, ArrowDown, Trash2, Plus, Save, Loader2, X, Image as ImageLucide,
  Film, UploadCloud, AlertCircle, CheckCircle2,
} from 'lucide-react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { db, isFirebaseConfigured } from '@/services/firebase';
import { MediaBackground, type MediaSlide } from '@/components/ui/MediaBackground';

// ─── Cloudinary upload (supports both image + video) ────────────────────────

async function cloudinaryUpload(
  file: File,
  cloudName: string,
  uploadPreset: string,
  resourceType: 'image' | 'video',
): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    { method: 'POST', body: formData },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Upload failed (${res.status})`);
  }
  const data = await res.json() as { secure_url: string };
  return { url: data.secure_url };
}

// ─── Add-slide modal ────────────────────────────────────────────────────────

interface AddModalProps {
  onClose: () => void;
  onAdd:   (slide: MediaSlide) => void;
}

function AddSlideModal({ onClose, onAdd }: AddModalProps) {
  const [type, setType]         = useState<'image' | 'video'>('image');
  const [url, setUrl]           = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState('');

  const cloudName    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME    ?? '';
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';
  const canUpload    = !!cloudName && !!uploadPreset;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const { url: uploadedUrl } = await cloudinaryUpload(file, cloudName, uploadPreset, type);
      setUrl(uploadedUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleAdd() {
    if (!url.trim()) { setError('URL is required'); return; }
    onAdd({ type, url: url.trim() });
    onClose();
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 480, padding: 24,
        borderRadius: 14, background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-text)' }}>Add Slide</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Type selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {(['image', 'video'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 10,
                fontWeight: 500, fontSize: 13, cursor: 'pointer',
                background: type === t ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent',
                border: `1.5px solid ${type === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
                color: type === t ? 'var(--color-primary)' : 'var(--color-text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                textTransform: 'capitalize',
              }}
            >
              {t === 'image' ? <ImageLucide size={14} /> : <Film size={14} />}
              {t}
            </button>
          ))}
        </div>

        {/* URL input */}
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
          {type === 'video' ? 'Video URL (mp4 / webm)' : 'Image URL'}
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 13,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)', outline: 'none',
          }}
        />

        {/* Cloudinary upload */}
        {canUpload && (
          <div style={{ marginTop: 12 }}>
            <label
              htmlFor="upload-input"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                border: '1.5px dashed var(--color-border)',
                background: 'var(--color-surface)',
                fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)',
              }}
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
              {uploading ? 'Uploading…' : `Upload ${type}`}
            </label>
            <input
              id="upload-input"
              type="file"
              accept={type === 'video' ? 'video/*' : 'image/*'}
              onChange={handleFile}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {!canUpload && (
          <p style={{ marginTop: 10, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            Configure Cloudinary in <code>NEXT_PUBLIC_CLOUDINARY_*</code> env to enable uploads.
          </p>
        )}

        {error && (
          <p style={{ marginTop: 10, fontSize: 12, color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={14} /> {error}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
              background: 'transparent', border: '1.5px solid var(--color-border)',
              color: 'var(--color-text)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!url.trim() || uploading}
            style={{
              padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: 'var(--color-primary)', border: 'none',
              color: '#fff', cursor: 'pointer',
              opacity: !url.trim() || uploading ? 0.5 : 1,
            }}
          >
            Add Slide
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Slide row ──────────────────────────────────────────────────────────────

interface SlideRowProps {
  slide:    MediaSlide;
  index:    number;
  total:    number;
  onChange: (i: number, slide: MediaSlide) => void;
  onMove:   (i: number, dir: -1 | 1) => void;
  onDelete: (i: number) => void;
}

function SlideRow({ slide, index, total, onChange, onMove, onDelete }: SlideRowProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: 12, borderRadius: 10,
      border: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
    }}>
      {/* Thumbnail */}
      <div style={{
        width: 64, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
        background: '#0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#94a3b8',
      }}>
        {slide.type === 'image' && slide.url
          ? <img src={slide.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : slide.type === 'video'
            ? <Film size={20} />
            : <ImageLucide size={20} />
        }
      </div>

      {/* Type badge */}
      <span style={{
        flexShrink: 0,
        padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        background: slide.type === 'video' ? 'color-mix(in srgb, #8b5cf6 18%, transparent)' : 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
        color:      slide.type === 'video' ? '#8b5cf6' : 'var(--color-primary)',
      }}>
        {slide.type}
      </span>

      {/* URL input */}
      <input
        type="url"
        value={slide.url}
        onChange={(e) => onChange(index, { ...slide, url: e.target.value })}
        style={{
          flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 12,
          border: '1px solid var(--color-border)',
          background: 'var(--color-background)',
          color: 'var(--color-text)', outline: 'none',
        }}
      />

      {/* Up / Down / Delete */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          aria-label="Move up"
          style={iconBtnStyle(index === 0)}
        ><ArrowUp size={14} /></button>
        <button
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1}
          aria-label="Move down"
          style={iconBtnStyle(index === total - 1)}
        ><ArrowDown size={14} /></button>
        <button
          onClick={() => onDelete(index)}
          aria-label="Delete"
          style={{ ...iconBtnStyle(false), color: 'var(--color-danger)' }}
        ><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 8,
    background: 'transparent', border: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  };
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function LoginMediaPage() {
  const [enabled, setEnabled]         = useState(true);
  const [slides, setSlides]           = useState<MediaSlide[]>([]);
  const [blurPx, setBlurPx]           = useState(24);
  const [intervalSec, setIntervalSec] = useState(6);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saveOk, setSaveOk]           = useState(false);
  const [saveErr, setSaveErr]         = useState('');
  const [addOpen, setAddOpen]         = useState(false);

  // Load existing config.
  useEffect(() => {
    if (!isFirebaseConfigured || !db) { setLoading(false); return; }
    let cancelled = false;
    getDoc(doc(db, 'config', 'loginMedia'))
      .then((snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data() as {
            enabled?:     boolean;
            slides?:      MediaSlide[];
            blurPx?:      number;
            intervalSec?: number;
          };
          setEnabled(data.enabled !== false);
          setSlides(Array.isArray(data.slides) ? data.slides : []);
          if (typeof data.blurPx === 'number')      setBlurPx(data.blurPx);
          if (typeof data.intervalSec === 'number') setIntervalSec(data.intervalSec);
        }
      })
      .catch(() => { /* ignore — leave defaults */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const previewSlides = useMemo<MediaSlide[]>(
    () => (enabled ? slides : []),
    [enabled, slides],
  );

  function handleAdd(s: MediaSlide) { setSlides((arr) => [...arr, s]); }
  function handleChange(i: number, s: MediaSlide) {
    setSlides((arr) => arr.map((x, idx) => (idx === i ? s : x)));
  }
  function handleMove(i: number, dir: -1 | 1) {
    setSlides((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function handleDelete(i: number) {
    setSlides((arr) => arr.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!isFirebaseConfigured || !db) {
      setSaveErr('Firebase not configured — cannot save.');
      return;
    }
    setSaving(true);
    setSaveErr('');
    setSaveOk(false);
    try {
      await setDoc(doc(db, 'config', 'loginMedia'), {
        enabled,
        slides: slides.filter((s) => s.url.trim().length > 0),
        blurPx,
        intervalSec,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setSaveOk(true);
      window.setTimeout(() => setSaveOk(false), 2500);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>
            Login Page Media
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Configure the blurred background shown on the login and landing pages.
            Add image slides, video clips, or both — they cross-fade automatically.
          </p>
        </header>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block' }} />
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 20,
          }} className="lm-grid">
            <style>{`
              @media (max-width: 1023px) {
                .lm-grid { grid-template-columns: 1fr !important; }
              }
            `}</style>

            {/* ── Left column: editor ────────────────────────────────── */}
            <section style={{
              padding: 20, borderRadius: 12,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}>
              {/* Master toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingBottom: 16, marginBottom: 16,
                borderBottom: '1px solid var(--color-border)',
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                    Enable custom media background
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    When off, the default gradient shows.
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => setEnabled((v) => !v)}
                  style={{
                    width: 44, height: 24, borderRadius: 999, padding: 2,
                    border: 'none', cursor: 'pointer', position: 'relative',
                    background: enabled ? 'var(--color-primary)' : '#cbd5e1',
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: enabled ? 22 : 2,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>

              {/* Recommended dims hint */}
              <p style={{
                margin: '0 0 14px', fontSize: 11, color: 'var(--color-text-tertiary)',
                padding: '8px 12px', borderRadius: 8,
                background: 'color-mix(in srgb, var(--color-primary) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)',
              }}>
                Recommended: 16:9 ratio, min 1920×1080. Keep images under 5 MB and videos under 10 MB.
              </p>

              {/* Blur + interval sliders */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 500, color: 'var(--color-text)', marginBottom: 4 }}>
                    <span>Blur</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{blurPx}px</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={1}
                    value={blurPx}
                    onChange={(e) => setBlurPx(Number(e.target.value))}
                    style={{ width: '100%' }}
                    aria-label="Background blur in pixels"
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 500, color: 'var(--color-text)', marginBottom: 4 }}>
                    <span>Slide interval</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{intervalSec}s</span>
                  </label>
                  <input
                    type="range"
                    min={2}
                    max={20}
                    step={1}
                    value={intervalSec}
                    onChange={(e) => setIntervalSec(Number(e.target.value))}
                    style={{ width: '100%' }}
                    aria-label="Slide interval in seconds"
                  />
                </div>
              </div>

              {/* Slides list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {slides.length === 0 ? (
                  <div style={{
                    padding: 32, textAlign: 'center', borderRadius: 10,
                    border: '1.5px dashed var(--color-border)',
                    color: 'var(--color-text-secondary)', fontSize: 13,
                  }}>
                    No slides configured. Default gradient will display.
                  </div>
                ) : slides.map((s, i) => (
                  <SlideRow
                    key={i}
                    slide={s}
                    index={i}
                    total={slides.length}
                    onChange={handleChange}
                    onMove={handleMove}
                    onDelete={handleDelete}
                  />
                ))}
              </div>

              {/* Add slide */}
              <button
                onClick={() => setAddOpen(true)}
                style={{
                  width: '100%', padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600,
                  border: '1.5px dashed var(--color-primary)',
                  background: 'color-mix(in srgb, var(--color-primary) 6%, transparent)',
                  color: 'var(--color-primary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Plus size={16} /> Add Slide
              </button>

              {/* Save */}
              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '12px 22px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                    background: 'var(--color-primary)', color: '#fff', border: 'none',
                    cursor: saving ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                {saveOk && (
                  <span style={{ fontSize: 13, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={14} /> Saved
                  </span>
                )}
                {saveErr && (
                  <span style={{ fontSize: 13, color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={14} /> {saveErr}
                  </span>
                )}
              </div>
            </section>

            {/* ── Right column: live preview ────────────────────────── */}
            <section style={{
              padding: 20, borderRadius: 12,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}>
              <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>
                Live Preview
              </h2>
              <div style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16 / 10',
                borderRadius: 12,
                overflow: 'hidden',
                background: '#0f172a',
                border: '1px solid var(--color-border)',
              }}>
                {/* Render MediaBackground inside a containing div by overriding its
                    fixed positioning via an isolating wrapper. The component uses
                    position:fixed which we re-cast to absolute through a transform
                    isolation hack — render it conditionally and contained. */}
                <PreviewBackground slides={previewSlides} blurPx={blurPx} intervalSec={intervalSec} />
                {/* Glass card mockup */}
                <div style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  padding: 20, borderRadius: 16, maxWidth: '70%',
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                  textAlign: 'center',
                }}>
                  <p style={{ margin: 0, fontFamily: 'var(--font-display, Sora), system-ui', fontSize: 18, fontWeight: 700, color: 'var(--color-primary)' }}>
                    TradeCircle
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#475569' }}>
                    Sign in to continue
                  </p>
                </div>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                Preview reflects unsaved changes. Toggle off the master switch to see the fallback gradient.
              </p>
            </section>
          </div>
        )}

        {addOpen && <AddSlideModal onClose={() => setAddOpen(false)} onAdd={handleAdd} />}
      </div>
    </AdminLayout>
  );
}

/**
 * Preview wrapper — renders the same media layers as `<MediaBackground>` but
 * contained absolutely inside its parent (since the real one uses position:fixed
 * for fullscreen page use).
 */
function PreviewBackground({
  slides,
  blurPx,
  intervalSec,
}: {
  slides:      MediaSlide[];
  blurPx:      number;
  intervalSec: number;
}) {
  // Use a transformed wrapper to create a new containing block so that the
  // fixed-positioned MediaBackground anchors to it instead of the viewport.
  return (
    <div style={{
      position: 'absolute', inset: 0,
      transform: 'translateZ(0)',  // create containing block for fixed children
      overflow: 'hidden',
    }}>
      <MediaBackground slides={slides} blurPx={blurPx} overlayOpacity={0.55} intervalSec={intervalSec} />
    </div>
  );
}
