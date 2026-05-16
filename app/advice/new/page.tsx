/**
 * app/advice/new/page.tsx
 * Create a new advice post — Advisor only.
 * Spec ref: section 4 (Journey 4 — Advisor Posts Step-by-Step Advice)
 *
 * Fields:
 *   - Title *
 *   - Subject (category/topic) *
 *   - Description (rich textarea)
 *   - Cover Image → Cloudinary upload
 *   - Step-by-step sections: each has a heading + body + optional image
 *     (add / remove / drag-to-reorder via HTML5 DnD)
 *   - Tags (comma-separated)
 *   - Visibility: Public | Circle
 *
 * Two submit buttons:
 *   [Save as Draft]  → published: false
 *   [Publish]        → published: true
 *
 * On success → redirect to /my-advice
 */

'use client';

import { useRef, useState }  from 'react';
import { useRouter }         from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver }       from '@hookform/resolvers/zod';
import { z }                 from 'zod';
import {
  BookOpen,
  Plus,
  Trash2,
  GripVertical,
  Image as ImageIcon,
  X,
  Loader2,
  Eye,
  Lock,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db }           from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { RoleGuard }    from '@/components/guards/RoleGuard';
import AdvisorLayout    from '@/components/layouts/AdvisorLayout';

// ─── Types / schema ───────────────────────────────────────────────────────────

const stepSchema = z.object({
  heading: z.string().min(1, 'Step heading is required'),
  body:    z.string().min(1, 'Step body is required'),
  imageUrl: z.string().optional(),
});

const postSchema = z.object({
  title:      z.string().min(3, 'Title must be at least 3 characters'),
  subject:    z.string().min(2, 'Subject is required'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  tags:       z.string().optional(),
  visibility: z.enum(['public', 'circle']),
  steps:      z.array(stepSchema).min(1, 'Add at least one step'),
});

type PostForm = z.infer<typeof postSchema>;

// ─── Cloudinary upload ────────────────────────────────────────────────────────

async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';
  const fd           = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', uploadPreset);
  const res  = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: fd },
  );
  const json = await res.json() as { secure_url: string };
  return json.secure_url;
}

// ─── Shared input style ───────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width:        '100%',
  padding:      'var(--space-2) var(--space-3)',
  background:   'var(--color-surface-2)',
  border:       '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color:        'var(--color-text)',
  fontSize:     'var(--text-sm)',
  outline:      'none',
  boxSizing:    'border-box',
  transition:   'border-color 0.15s',
};

function Field({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-2)' }}>
        {label}{required && <span style={{ color: 'var(--color-error, #ef4444)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint  && <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-3)' }}>{hint}</p>}
      {error && <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-error, #ef4444)' }}>{error}</p>}
    </div>
  );
}

// ─── Cover image upload zone ──────────────────────────────────────────────────

function CoverUpload({
  url,
  uploading,
  onFile,
  onClear,
}: {
  url:       string;
  uploading: boolean;
  onFile:    (f: File) => void;
  onClear:   () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) onFile(file);
  }

  return (
    <div>
      {url ? (
        <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', height: 200 }}>
          <img src={url} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <button
            type="button"
            onClick={onClear}
            style={{
              position: 'absolute', top: 8, right: 8,
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)', border: 'none',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => ref.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          style={{
            height:         180,
            borderRadius:   'var(--radius-lg)',
            border:         `2px dashed ${drag ? 'var(--color-advisor, #10b981)' : 'var(--color-border)'}`,
            background:     drag ? 'color-mix(in srgb, var(--color-advisor, #10b981) 6%, transparent)' : 'var(--color-surface-2)',
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            'var(--space-2)',
            cursor:         'pointer',
            transition:     'border-color 0.15s, background 0.15s',
          }}
        >
          {uploading ? (
            <Loader2 size={28} style={{ color: 'var(--color-advisor, #10b981)', animation: 'spin 1s linear infinite' }} />
          ) : (
            <>
              <ImageIcon size={28} style={{ color: 'var(--color-text-3)' }} />
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-2)', fontWeight: 500 }}>
                Click or drag to upload cover image
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-3)' }}>
                JPG, PNG, WEBP · max 10 MB
              </p>
            </>
          )}
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onFile(f);
        e.target.value = '';
      }} />
    </div>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({
  index,
  total,
  register,
  error,
  onRemove,
  onMoveUp,
  onMoveDown,
  stepImageUrl,
  stepImageUploading,
  onStepImageFile,
  onStepImageClear,
}: {
  index:              number;
  total:              number;
  register:           ReturnType<typeof useForm<PostForm>>['register'];
  error?:             { heading?: { message?: string }; body?: { message?: string } };
  onRemove:           () => void;
  onMoveUp:           () => void;
  onMoveDown:         () => void;
  stepImageUrl:       string;
  stepImageUploading: boolean;
  onStepImageFile:    (f: File) => void;
  onStepImageClear:   () => void;
}) {
  const imgRef = useRef<HTMLInputElement>(null);

  return (
    <div
      style={{
        background:   'var(--color-surface)',
        border:       '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow:     'hidden',
      }}
    >
      {/* Step header */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            'var(--space-2)',
          padding:        'var(--space-3) var(--space-4)',
          background:     'var(--color-surface-2)',
          borderBottom:   '1px solid var(--color-border)',
        }}
      >
        <GripVertical size={16} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />
        <span
          style={{
            width:          24,
            height:         24,
            borderRadius:   '50%',
            background:     'var(--color-advisor, #10b981)',
            color:          '#fff',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       'var(--text-xs)',
            fontWeight:     700,
            flexShrink:     0,
          }}
        >
          {index + 1}
        </span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
          Step {index + 1}
        </span>
        {/* Reorder */}
        <button type="button" onClick={onMoveUp} disabled={index === 0}
          style={{ background: 'none', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', color: index === 0 ? 'var(--color-text-3)' : 'var(--color-text-2)', padding: 4, opacity: index === 0 ? 0.4 : 1 }}
        ><ChevronUp size={15} /></button>
        <button type="button" onClick={onMoveDown} disabled={index === total - 1}
          style={{ background: 'none', border: 'none', cursor: index === total - 1 ? 'not-allowed' : 'pointer', color: index === total - 1 ? 'var(--color-text-3)' : 'var(--color-text-2)', padding: 4, opacity: index === total - 1 ? 0.4 : 1 }}
        ><ChevronDown size={15} /></button>
        {/* Remove */}
        <button type="button" onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 4, transition: 'color 0.15s' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-error, #ef4444)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-3)'; }}
        ><Trash2 size={15} /></button>
      </div>

      {/* Step body */}
      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Field label="Step Heading" required error={error?.heading?.message}>
          <input
            {...register(`steps.${index}.heading`)}
            placeholder="e.g. Gather your documents"
            style={INPUT}
          />
        </Field>

        <Field label="Step Description" required error={error?.body?.message}>
          <textarea
            {...register(`steps.${index}.body`)}
            rows={4}
            placeholder="Explain this step in detail…"
            style={{ ...INPUT, resize: 'vertical' }}
          />
        </Field>

        {/* Step image */}
        <div>
          <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-2)' }}>
            Step Image <span style={{ color: 'var(--color-text-3)', fontWeight: 400 }}>(optional)</span>
          </label>
          {stepImageUrl ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img src={stepImageUrl} alt={`step-${index}`} style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 'var(--radius-md)', display: 'block' }} />
              <button
                type="button"
                onClick={onStepImageClear}
                style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--color-error, #ef4444)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              ><X size={11} /></button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imgRef.current?.click()}
              disabled={stepImageUploading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--color-surface-2)',
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-2)',
                cursor: stepImageUploading ? 'not-allowed' : 'pointer',
                fontSize: 'var(--text-xs)', fontWeight: 600,
              }}
            >
              {stepImageUploading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ImageIcon size={14} />}
              {stepImageUploading ? 'Uploading…' : 'Add Image'}
            </button>
          )}
          <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onStepImageFile(f);
            e.target.value = '';
          }} />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewAdvicePage() {
  const user   = useAuthStore((s) => s.user);
  const router = useRouter();

  const [coverUrl, setCoverUrl]           = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [stepImages, setStepImages]       = useState<string[]>([]);
  const [stepImgUploading, setStepImgUploading] = useState<boolean[]>([]);
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState('');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<PostForm>({
    resolver:     zodResolver(postSchema),
    defaultValues: {
      title:       '',
      subject:     '',
      description: '',
      tags:        '',
      visibility:  'public',
      steps:       [{ heading: '', body: '', imageUrl: '' }],
    },
  });

  const { fields, append, remove, move } = useFieldArray({ control, name: 'steps' });
  const visibility = watch('visibility');

  // ─── Cover image ────────────────────────────────────────────────────────────

  async function handleCoverFile(file: File) {
    setCoverUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setCoverUrl(url);
    } finally {
      setCoverUploading(false);
    }
  }

  // ─── Step image ─────────────────────────────────────────────────────────────

  async function handleStepImageFile(index: number, file: File) {
    setStepImgUploading((prev) => { const a = [...prev]; a[index] = true; return a; });
    try {
      const url = await uploadToCloudinary(file);
      setStepImages((prev) => { const a = [...prev]; a[index] = url; return a; });
      setValue(`steps.${index}.imageUrl`, url);
    } finally {
      setStepImgUploading((prev) => { const a = [...prev]; a[index] = false; return a; });
    }
  }

  function clearStepImage(index: number) {
    setStepImages((prev) => { const a = [...prev]; a[index] = ''; return a; });
    setValue(`steps.${index}.imageUrl`, '');
  }

  // ─── Add step ────────────────────────────────────────────────────────────────

  function addStep() {
    append({ heading: '', body: '', imageUrl: '' });
    setStepImages((prev) => [...prev, '']);
    setStepImgUploading((prev) => [...prev, false]);
  }

  function removeStep(index: number) {
    if (fields.length <= 1) return;
    remove(index);
    setStepImages((prev) => prev.filter((_, i) => i !== index));
    setStepImgUploading((prev) => prev.filter((_, i) => i !== index));
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  async function onSubmit(data: PostForm, publishActive: boolean) {
    if (!user) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await addDoc(collection(db, 'advicePosts'), {
        advisorId:   user.uid,
        advisorName: user.displayName ?? '',
        title:       data.title,
        subject:     data.subject,
        description: data.description,
        coverImage:  coverUrl,
        tags:        data.tags
          ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        visibility:  data.visibility,
        steps:       data.steps.map((s, i) => ({
          heading:  s.heading,
          body:     s.body,
          imageUrl: stepImages[i] ?? '',
        })),
        published:   publishActive,
        views:       0,
        enquiries:   0,
        replies:     0,
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
      router.push('/my-advice');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <RoleGuard allowedRoles={['advisor']}>
      <AdvisorLayout>
        <div style={{ maxWidth: 780, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg)', background: 'color-mix(in srgb, var(--color-advisor, #10b981) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-advisor, #10b981)', flexShrink: 0 }}>
              <BookOpen size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text)' }}>
                Create Advice Post
              </h1>
              <p style={{ margin: '2px 0 0', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
                Share your expertise with the TradeCircle community.
              </p>
            </div>
          </div>

          <form onSubmit={(e) => e.preventDefault()}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

              {/* ── Basic info ────────────────────────────────────────── */}
              <section
                style={{
                  background:   'var(--color-surface)',
                  border:       '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding:      'var(--space-5)',
                  display:      'flex',
                  flexDirection: 'column',
                  gap:          'var(--space-4)',
                }}
              >
                <h2 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
                  Basic Information
                </h2>

                <Field label="Title" required error={errors.title?.message}>
                  <input
                    {...register('title')}
                    placeholder="e.g. How to Register a Business in Australia"
                    style={INPUT}
                  />
                </Field>

                <Field label="Subject / Topic" required error={errors.subject?.message}
                  hint="e.g. Legal, Financial, Agricultural, Trade">
                  <input
                    {...register('subject')}
                    placeholder="Legal"
                    style={INPUT}
                  />
                </Field>

                <Field label="Description" required error={errors.description?.message}
                  hint="A summary that appears in search results and your profile.">
                  <textarea
                    {...register('description')}
                    rows={5}
                    placeholder="Provide context and a brief overview of what this post covers…"
                    style={{ ...INPUT, resize: 'vertical' }}
                  />
                </Field>

                <Field label="Tags" hint="Comma-separated, e.g. tax, ABN, compliance">
                  <input
                    {...register('tags')}
                    placeholder="tax, ABN, compliance"
                    style={INPUT}
                  />
                </Field>
              </section>

              {/* ── Cover image ───────────────────────────────────────── */}
              <section
                style={{
                  background:   'var(--color-surface)',
                  border:       '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding:      'var(--space-5)',
                }}
              >
                <h2 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
                  Cover Image
                </h2>
                <CoverUpload
                  url={coverUrl}
                  uploading={coverUploading}
                  onFile={handleCoverFile}
                  onClear={() => setCoverUrl('')}
                />
              </section>

              {/* ── Steps ─────────────────────────────────────────────── */}
              <section
                style={{
                  background:   'var(--color-surface)',
                  border:       '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding:      'var(--space-5)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--color-border)' }}>
                  <h2 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text)' }}>
                    Step-by-Step Guide
                  </h2>
                  <button
                    type="button"
                    onClick={addStep}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
                      padding: 'var(--space-1) var(--space-3)',
                      background: 'color-mix(in srgb, var(--color-advisor, #10b981) 12%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--color-advisor, #10b981) 40%, transparent)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-advisor, #10b981)',
                      fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <Plus size={14} /> Add Step
                  </button>
                </div>

                {errors.steps?.root && (
                  <p style={{ margin: '0 0 var(--space-3)', color: 'var(--color-error, #ef4444)', fontSize: 'var(--text-sm)' }}>
                    {errors.steps.root.message}
                  </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {fields.map((field, i) => (
                    <StepCard
                      key={field.id}
                      index={i}
                      total={fields.length}
                      register={register}
                      error={errors.steps?.[i]}
                      onRemove={() => removeStep(i)}
                      onMoveUp={() => move(i, i - 1)}
                      onMoveDown={() => move(i, i + 1)}
                      stepImageUrl={stepImages[i] ?? ''}
                      stepImageUploading={stepImgUploading[i] ?? false}
                      onStepImageFile={(f) => handleStepImageFile(i, f)}
                      onStepImageClear={() => clearStepImage(i)}
                    />
                  ))}
                </div>
              </section>

              {/* ── Visibility ────────────────────────────────────────── */}
              <section
                style={{
                  background:   'var(--color-surface)',
                  border:       '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding:      'var(--space-5)',
                }}
              >
                <h2 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
                  Visibility
                </h2>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  {([
                    { value: 'public' as const, label: 'Public',  desc: 'Visible to everyone on TradeCircle.',       icon: <Eye  size={18} /> },
                    { value: 'circle' as const, label: 'Circle',  desc: 'Only visible to users in your circle.',     icon: <Lock size={18} /> },
                  ]).map((opt) => (
                    <label
                      key={opt.value}
                      style={{
                        flex:         1,
                        display:      'flex',
                        alignItems:   'flex-start',
                        gap:          'var(--space-3)',
                        padding:      'var(--space-3)',
                        borderRadius: 'var(--radius-lg)',
                        border:       `1px solid ${visibility === opt.value ? 'var(--color-advisor, #10b981)' : 'var(--color-border)'}`,
                        background:   visibility === opt.value ? 'color-mix(in srgb, var(--color-advisor, #10b981) 8%, transparent)' : 'transparent',
                        cursor:       'pointer',
                        transition:   'border-color 0.15s, background 0.15s',
                      }}
                    >
                      <input
                        type="radio"
                        {...register('visibility')}
                        value={opt.value}
                        style={{ marginTop: 2, accentColor: 'var(--color-advisor, #10b981)' }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: visibility === opt.value ? 'var(--color-advisor, #10b981)' : 'var(--color-text)', marginBottom: 2 }}>
                          {opt.icon}
                          <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{opt.label}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-2)' }}>{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </section>

              {/* ── Submit error ──────────────────────────────────────── */}
              {submitError && (
                <p style={{ color: 'var(--color-error, #ef4444)', fontSize: 'var(--text-sm)', margin: 0 }}>
                  {submitError}
                </p>
              )}

              {/* ── Actions ───────────────────────────────────────────── */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => router.back()}
                  style={{
                    padding: 'var(--space-2) var(--space-5)',
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', color: 'var(--color-text-2)',
                    fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>

                {/* Save as Draft */}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmit((data) => onSubmit(data, false))}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-5)',
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', color: 'var(--color-text)',
                    fontWeight: 600, fontSize: 'var(--text-sm)',
                    cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-primary)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'; }}
                >
                  {submitting ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                  Save as Draft
                </button>

                {/* Publish */}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmit((data) => onSubmit(data, true))}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-5)',
                    background: 'var(--color-advisor, #10b981)', border: 'none',
                    borderRadius: 'var(--radius-md)', color: '#fff',
                    fontWeight: 700, fontSize: 'var(--text-sm)',
                    cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = submitting ? '0.7' : '1'; }}
                >
                  {submitting ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Eye size={15} />}
                  Publish Post
                </button>
              </div>

            </div>
          </form>
        </div>

        <style>{`
          @keyframes spin  { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
        `}</style>
      </AdvisorLayout>
    </RoleGuard>
  );
}
