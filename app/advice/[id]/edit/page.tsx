/**
 * app/advice/[id]/edit/page.tsx
 * Edit an existing advice post — Advisor only.
 * Spec ref: section 6.6 (Create Advice Post — edit variant)
 *
 * Mirrors /advice/new but:
 *   - Fetches existing post on mount and pre-fills form (useFieldArray for steps)
 *   - Verifies post.advisorId === auth user (ownership guard)
 *   - updateDoc instead of addDoc
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter }        from 'next/navigation';
import { useForm, useFieldArray }      from 'react-hook-form';
import { zodResolver }                 from '@hookform/resolvers/zod';
import { z }                           from 'zod';
import {
  BookOpen, Plus, Trash2, GripVertical,
  Image as ImageIcon, X, Eye, Lock,
  ChevronUp, ChevronDown, ArrowLeft,
  AlertCircle, CheckCircle,
} from 'lucide-react';
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db }           from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { RoleGuard }    from '@/components/guards/RoleGuard';
import AdvisorLayout    from '@/components/layouts/AdvisorLayout';
import SkeletonLoader   from '@/components/ui/SkeletonLoader';
import type { AdvicePost, AdviceVisibility } from '@/types';

// ─────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────

const stepSchema = z.object({
  heading:  z.string().min(1, 'Step heading is required'),
  body:     z.string().min(1, 'Step body is required'),
  imageUrl: z.string().optional(),
});

const schema = z.object({
  title:       z.string().min(3, 'Title must be at least 3 characters').max(120),
  subject:     z.string().min(2, 'Subject / category is required').max(80),
  description: z.string().min(20, 'Introduction must be at least 20 characters').max(3000),
  steps:       z.array(stepSchema).min(1, 'Add at least one step'),
  tags:        z.string().optional(),
  visibility:  z.enum(['public', 'circle'] as const),
});

type FormValues = z.infer<typeof schema>;
type StepEntry  = z.infer<typeof stepSchema>;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function uploadToCloudinary(
  file: File,
  cloudName: string,
  uploadPreset: string
): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', uploadPreset);
  const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Cloudinary upload failed');
  const data = (await res.json()) as { secure_url: string };
  return data.secure_url;
}

// ─────────────────────────────────────────────
// Step card
// ─────────────────────────────────────────────

interface StepCardProps {
  index:         number;
  total:         number;
  error?:        { heading?: { message?: string }; body?: { message?: string } };
  onRemove:      () => void;
  onMoveUp:      () => void;
  onMoveDown:    () => void;
  imageUrl:      string;
  onImageChange: (url: string) => void;
  dragIndex:     number | null;
  onDragStart:   () => void;
  onDragOver:    () => void;
  onDragEnd:     () => void;
  register:      ReturnType<typeof useForm<FormValues>>['register'];
  cloudName:     string;
  uploadPreset:  string;
}

function StepCard({
  index, total, error, onRemove, onMoveUp, onMoveDown,
  imageUrl, onImageChange,
  dragIndex, onDragStart, onDragOver, onDragEnd,
  register, cloudName, uploadPreset,
}: StepCardProps) {
  const [collapsed, setCollapsed]   = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [uploadErr, setUploadErr]   = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!cloudName || !uploadPreset) {
      // Fallback — use object URL
      onImageChange(URL.createObjectURL(file));
      return;
    }
    setUploading(true);
    setUploadErr('');
    try {
      const url = await uploadToCloudinary(file, cloudName, uploadPreset);
      onImageChange(url);
    } catch {
      setUploadErr('Upload failed — try again');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDragEnd={onDragEnd}
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        marginBottom: 12,
        opacity: dragIndex === index ? 0.5 : 1,
        cursor: 'default',
      }}
    >
      {/* Step header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px',
        borderBottom: collapsed ? 'none' : '1px solid var(--color-border)',
        cursor: 'grab',
      }}>
        <GripVertical size={16} color="var(--color-text-tertiary)" />
        <span style={{
          fontSize: 12, fontWeight: 700,
          padding: '2px 10px', borderRadius: 20,
          background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
          color: 'var(--color-primary)',
        }}>
          Step {index + 1}
        </span>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={onMoveUp} disabled={index === 0}
          style={{ background: 'none', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', padding: 4, opacity: index === 0 ? 0.3 : 1 }}>
          <ChevronUp size={14} color="var(--color-text-secondary)" />
        </button>
        <button type="button" onClick={onMoveDown} disabled={index === total - 1}
          style={{ background: 'none', border: 'none', cursor: index === total - 1 ? 'not-allowed' : 'pointer', padding: 4, opacity: index === total - 1 ? 0.3 : 1 }}>
          <ChevronDown size={14} color="var(--color-text-secondary)" />
        </button>
        <button type="button" onClick={() => setCollapsed((v) => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
        <button type="button" onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-danger)' }}>
          <Trash2 size={15} />
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: '14px 16px' }}>
          {/* Heading */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 5 }}>
              Step Heading <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              {...register(`steps.${index}.heading`)}
              placeholder={`Step ${index + 1} heading`}
              style={{
                width: '100%', padding: '9px 12px',
                background: 'var(--color-bg)',
                border: `1px solid ${error?.heading ? 'var(--color-danger)' : 'var(--color-border)'}`,
                borderRadius: 7, fontSize: 13, color: 'var(--color-text)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            {error?.heading && <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--color-danger)' }}>{error.heading.message}</p>}
          </div>

          {/* Body */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 5 }}>
              Step Description <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <textarea
              {...register(`steps.${index}.body`)}
              rows={4}
              placeholder="Explain this step in detail…"
              style={{
                width: '100%', padding: '9px 12px',
                background: 'var(--color-bg)',
                border: `1px solid ${error?.body ? 'var(--color-danger)' : 'var(--color-border)'}`,
                borderRadius: 7, fontSize: 13, color: 'var(--color-text)',
                outline: 'none', resize: 'vertical', lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
            {error?.body && <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--color-danger)' }}>{error.body.message}</p>}
          </div>

          {/* Image */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 5 }}>
              Step Image{' '}
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-tertiary)' }}>(optional)</span>
            </label>

            {imageUrl ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={imageUrl} alt="" style={{ height: 80, width: 'auto', maxWidth: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--color-border)' }} />
                <button
                  type="button"
                  onClick={() => onImageChange('')}
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.7)', border: 'none',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}
                >
                  <X size={11} color="#fff" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px',
                  background: 'var(--color-bg)',
                  border: '1.5px dashed var(--color-border)',
                  borderRadius: 7, cursor: uploading ? 'wait' : 'pointer',
                  fontSize: 12, color: 'var(--color-text-secondary)',
                }}
              >
                {uploading ? (
                  <div style={{ width: 14, height: 14, border: '2px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'ae-spin 0.6s linear infinite' }} />
                ) : (
                  <ImageIcon size={14} />
                )}
                {uploading ? 'Uploading…' : 'Add image'}
              </button>
            )}

            {uploadErr && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-danger)' }}>{uploadErr}</p>}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

function EditAdviceInner() {
  const params   = useParams<{ id: string }>();
  const postId   = params?.id ?? '';
  const router   = useRouter();
  const { user } = useAuthStore();

  const [fetching, setFetching]     = useState(true);
  const [notFound, setNotFound]     = useState(false);
  const [forbidden, setForbidden]   = useState(false);
  const [cloudName, setCloudName]   = useState('');
  const [uploadPreset, setUploadPreset] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [saved, setSaved]           = useState(false);
  const [publishMode, setPublishMode] = useState(true);

  const [dragIndex, setDragIndex]   = useState<number | null>(null);
  const dragOverRef                 = useRef<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { steps: [], visibility: 'public' },
  });

  const { fields, append, remove, move } = useFieldArray({ control, name: 'steps' });
  const stepValues = watch('steps');

  // ── Fetch post + config ───────────────────

  useEffect(() => {
    if (!postId || !user) return;

    Promise.all([
      getDoc(doc(db, 'advicePosts', postId)),
      getDoc(doc(db, 'config', 'site')),
    ])
      .then(([postSnap, configSnap]) => {
        if (!postSnap.exists()) { setNotFound(true); return; }

        const data = postSnap.data() as AdvicePost;
        if (data.advisorId !== user.uid) { setForbidden(true); return; }

        setPublishMode(data.published);

        reset({
          title:       data.title,
          subject:     data.subject,
          description: data.description,
          steps:       (data.steps ?? []).map((s) => ({
            heading:  s.title,
            body:     s.description,
            imageUrl: s.images[0] ?? '',
          })),
          tags:       (data.tags ?? []).join(', '),
          visibility: data.visibility,
        });

        if (configSnap.exists()) {
          const cfg = configSnap.data() as {
            cloudinary?: { cloudName?: string; uploadPreset?: string };
          };
          if (cfg.cloudinary?.cloudName)    setCloudName(cfg.cloudinary.cloudName);
          if (cfg.cloudinary?.uploadPreset) setUploadPreset(cfg.cloudinary.uploadPreset);
        }
      })
      .catch((err) => {
        console.error('[EditAdvice] fetch error', err);
        setNotFound(true);
      })
      .finally(() => setFetching(false));
  }, [postId, user, reset]);

  // ── Drag reorder ──────────────────────────

  const handleDragStart = (idx: number) => setDragIndex(idx);
  const handleDragOverStep = (idx: number) => { dragOverRef.current = idx; };
  const handleDragEnd = () => {
    const from = dragIndex;
    const to   = dragOverRef.current;
    if (from !== null && to !== null && from !== to) move(from, to);
    setDragIndex(null);
    dragOverRef.current = null;
  };

  // ── Submit ────────────────────────────────

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const steps = data.steps.map((s) => ({
        title:       s.heading,
        description: s.body,
        images:      s.imageUrl ? [s.imageUrl] : [],
      }));

      const tags = (data.tags ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await updateDoc(doc(db, 'advicePosts', postId), {
        title:       data.title,
        subject:     data.subject,
        description: data.description,
        steps,
        tags,
        visibility:  data.visibility,
        published:   publishMode,
        updatedAt:   serverTimestamp(),
      });

      setSaved(true);
      setTimeout(() => router.push('/my-advice'), 1800);
    } catch (err) {
      console.error('[EditAdvice] submit error', err);
      setSubmitError('Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Guard states ──────────────────────────

  if (fetching) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px' }}>
        <SkeletonLoader width={200} height={28} style={{ marginBottom: 24 }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <SkeletonLoader width={120} height={14} style={{ marginBottom: 8 }} />
            <SkeletonLoader width="100%" height={44} borderRadius={8} />
          </div>
        ))}
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <AlertCircle size={40} color="var(--color-text-tertiary)" style={{ marginBottom: 12 }} />
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
          Post not found
        </h2>
        <button onClick={() => router.push('/my-advice')}
          style={{ marginTop: 16, padding: '9px 22px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          My Advice
        </button>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <AlertCircle size={40} color="var(--color-danger)" style={{ marginBottom: 12 }} />
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
          Access denied
        </h2>
        <button onClick={() => router.push('/my-advice')}
          style={{ marginTop: 16, padding: '9px 22px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          My Advice
        </button>
      </div>
    );
  }

  if (saved) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <CheckCircle size={48} color="var(--color-success)" style={{ marginBottom: 16 }} />
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
          Post updated!
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)' }}>
          Redirecting to My Advice…
        </p>
      </div>
    );
  }

  // ── Form ──────────────────────────────────

  const inputStyle = (hasErr: boolean): React.CSSProperties => ({
    width: '100%', padding: '10px 14px',
    background: 'var(--color-bg-secondary)',
    border: `1px solid ${hasErr ? 'var(--color-danger)' : 'var(--color-border)'}`,
    borderRadius: 8, fontSize: 14, color: 'var(--color-text)',
    outline: 'none', boxSizing: 'border-box',
  });

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: 'var(--color-text)', marginBottom: 6,
  };

  const sectionHeadStyle: React.CSSProperties = {
    margin: '0 0 18px', fontSize: 16, fontWeight: 700,
    color: 'var(--color-text)', paddingBottom: 8,
    borderBottom: '1px solid var(--color-border)',
  };

  return (
    <>
      <style>{`
        @keyframes ae-spin { to { transform: rotate(360deg); } }
        .ae-vis-btn { transition: all 0.15s; }
        .ae-vis-btn:hover { filter: brightness(0.95); }
      `}</style>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 100px' }}>

        {/* Back + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button type="button" onClick={() => router.push('/my-advice')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '50%', cursor: 'pointer' }}>
            <ArrowLeft size={16} color="var(--color-text)" />
          </button>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>
            Edit Advice Post
          </h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>

          {/* ── Section 1: Core fields ─────────── */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={sectionHeadStyle}>Post Details</h2>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Title <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input {...register('title')} placeholder="e.g. How to register a business in Australia" style={inputStyle(!!errors.title)} />
              {errors.title && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-danger)' }}>{errors.title.message}</p>}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Subject / Category <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input {...register('subject')} placeholder="e.g. Legal & Compliance" style={inputStyle(!!errors.subject)} />
              {errors.subject && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-danger)' }}>{errors.subject.message}</p>}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Introduction <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <textarea
                {...register('description')}
                rows={5}
                placeholder="Introduce the topic and what readers will learn…"
                style={{ ...inputStyle(!!errors.description), resize: 'vertical', lineHeight: 1.6 }}
              />
              {errors.description && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-danger)' }}>{errors.description.message}</p>}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Tags <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-tertiary)' }}>(optional — comma separated)</span></label>
              <input {...register('tags')} placeholder="e.g. legal, business, startup" style={inputStyle(false)} />
            </div>

            {/* Visibility */}
            <div>
              <label style={labelStyle}>Visibility</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {([
                  { val: 'public', label: 'Public', desc: 'Visible to everyone', Icon: Eye },
                  { val: 'circle', label: 'Circle Only', desc: 'Followers only',   Icon: Lock },
                ] as const).map(({ val, label, desc, Icon }) => {
                  const active = watch('visibility') === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      className="ae-vis-btn"
                      onClick={() => setValue('visibility', val as AdviceVisibility)}
                      style={{
                        flex: 1, padding: '12px 14px', textAlign: 'left',
                        background: active
                          ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                          : 'var(--color-bg-secondary)',
                        border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        borderRadius: 10, cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <Icon size={15} color={active ? 'var(--color-primary)' : 'var(--color-text-secondary)'} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--color-primary)' : 'var(--color-text)' }}>
                          {label}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>{desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── Section 2: Steps ──────────────── */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={sectionHeadStyle}>Step-by-Step Guide</h2>

            {errors.steps?.root && (
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-danger)' }}>
                {errors.steps.root.message}
              </p>
            )}

            {fields.map((field, idx) => (
              <StepCard
                key={field.id}
                index={idx}
                total={fields.length}
                error={errors.steps?.[idx]}
                onRemove={() => remove(idx)}
                onMoveUp={() => move(idx, idx - 1)}
                onMoveDown={() => move(idx, idx + 1)}
                imageUrl={stepValues?.[idx]?.imageUrl ?? ''}
                onImageChange={(url) => setValue(`steps.${idx}.imageUrl`, url)}
                dragIndex={dragIndex}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={() => handleDragOverStep(idx)}
                onDragEnd={handleDragEnd}
                register={register}
                cloudName={cloudName}
                uploadPreset={uploadPreset}
              />
            ))}

            <button
              type="button"
              onClick={() => append({ heading: '', body: '', imageUrl: '' })}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '12px 16px',
                background: 'color-mix(in srgb, var(--color-primary) 7%, transparent)',
                border: '1.5px dashed var(--color-primary)',
                borderRadius: 10, cursor: 'pointer',
                fontSize: 14, fontWeight: 600, color: 'var(--color-primary)',
                justifyContent: 'center',
              }}
            >
              <Plus size={16} />
              Add Step
            </button>
          </section>

          {/* ── Error ─────────────────────────── */}
          {submitError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px',
              background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
              borderRadius: 8, marginBottom: 20,
              fontSize: 13, color: 'var(--color-danger)',
            }}>
              <AlertCircle size={15} />
              {submitError}
            </div>
          )}

          {/* ── Sticky footer ─────────────────── */}
          <div style={{
            position: 'sticky', bottom: 0,
            background: 'var(--color-bg)',
            borderTop: '1px solid var(--color-border)',
            padding: '14px 0',
            display: 'flex', gap: 12, justifyContent: 'flex-end',
          }}>
            <button
              type="button"
              onClick={() => router.push('/my-advice')}
              style={{
                padding: '10px 22px',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 9, cursor: 'pointer',
                fontWeight: 600, fontSize: 14,
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              onClick={() => setPublishMode(false)}
              disabled={submitting}
              style={{
                padding: '10px 22px',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 9,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: 14,
                opacity: submitting ? 0.6 : 1,
              }}
            >
              Save as Draft
            </button>

            <button
              type="submit"
              onClick={() => setPublishMode(true)}
              disabled={submitting}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 22px',
                background: submitting ? 'var(--color-bg-tertiary)' : 'var(--color-primary)',
                color: submitting ? 'var(--color-text-secondary)' : '#fff',
                border: 'none', borderRadius: 9,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: 14,
              }}
            >
              {submitting ? (
                <>
                  <div style={{ width: 16, height: 16, border: '2px solid var(--color-text-secondary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'ae-spin 0.6s linear infinite' }} />
                  Saving…
                </>
              ) : (
                'Save & Publish'
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────

export default function EditAdvicePage() {
  return (
    <RoleGuard allowedRoles={['advisor']}>
      <AdvisorLayout>
        <EditAdviceInner />
      </AdvisorLayout>
    </RoleGuard>
  );
}
