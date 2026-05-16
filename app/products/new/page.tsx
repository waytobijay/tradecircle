/**
 * app/products/new/page.tsx
 * List a Product form — seller only.
 * Spec ref: section 6.3 (List a Product)
 *
 * Form sections:
 *   1. Basic Details    — name, SKU, category, condition
 *   2. Description      — rich textarea with formatting toolbar, 2000 char limit
 *   3. Photos           — drag-drop upload zone, Cloudinary, max 5, drag-to-reorder
 *   4. Pricing          — price, currency (from config, read-only), negotiable toggle
 *   5. Location         — city, country, "use profile location" checkbox
 *
 * Actions: [Save as Draft] [Publish Listing]
 */

'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter }    from 'next/navigation';
import { useForm }      from 'react-hook-form';
import { zodResolver }  from '@hookform/resolvers/zod';
import { z }            from 'zod';
import {
  Upload,
  X,
  GripVertical,
  Bold,
  Italic,
  List,
  ImageIcon,
  ChevronDown,
  CheckCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db }           from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { RoleGuard }    from '@/components/guards/RoleGuard';
import { SellerLayout } from '@/components/layouts/SellerLayout';
import { ProductDescriptionGenerator } from '@/components/ai/ProductDescriptionGenerator';
import { ImageTagger }  from '@/components/ai/ImageTagger';
import type { ProductCurrency, ProductCondition } from '@/types';

// ─────────────────────────────────────────────
// Zod Schema
// ─────────────────────────────────────────────

const schema = z.object({
  name:        z.string().min(2, 'Product name is required').max(100),
  productCode: z.string().max(50).optional(),
  category:    z.string().min(1, 'Select a category'),
  condition:   z.enum(['new', 'used', 'refurbished'] as const),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Max 2,000 characters'),
  price:       z.coerce.number({ invalid_type_error: 'Enter a valid price' }).min(0.01, 'Price must be greater than 0'),
  negotiable:  z.boolean().default(false),
  city:        z.string().min(1, 'City is required'),
  country:     z.string().min(1, 'Country is required'),
});

type FormValues = z.infer<typeof schema>;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ImageEntry {
  id:          string;      // local uuid
  file?:       File;
  previewUrl:  string;      // object URL or cloudinary URL
  cloudinaryId?: string;
  cloudinaryUrl?: string;
  uploading:   boolean;
  error?:      string;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const CONDITIONS: { value: ProductCondition; label: string }[] = [
  { value: 'new',         label: 'New'         },
  { value: 'used',        label: 'Used'        },
  { value: 'refurbished', label: 'Refurbished' },
];

const DEFAULT_CATEGORIES = [
  'Electronics', 'Clothing', 'Furniture', 'Vehicles',
  'Tools', 'Books', 'Sports', 'Other',
];

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE  = 5 * 1024 * 1024; // 5 MB
const MAX_IMAGES     = 5;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 11);
}

async function uploadToCloudinary(file: File): Promise<{ url: string; publicId: string }> {
  const cloudName   = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
  const uploadPreset= process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary env vars not configured');
  }

  const form = new FormData();
  form.append('file',           file);
  form.append('upload_preset',  uploadPreset);
  form.append('folder',         'tradecircle/products');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: form },
  );

  if (!res.ok) throw new Error(`Cloudinary upload failed: ${res.status}`);

  const data = await res.json() as { secure_url: string; public_id: string };
  return { url: data.secure_url, publicId: data.public_id };
}

// ─────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────

function useCategories(): string[] {
  const [cats, setCats] = useState<string[]>(DEFAULT_CATEGORIES);
  useEffect(() => {
    getDoc(doc(db, 'config', 'siteConfig'))
      .then((snap) => {
        const d = snap.data();
        if (Array.isArray(d?.productCategories) && d.productCategories.length > 0) {
          setCats(d.productCategories as string[]);
        }
      })
      .catch(() => {/* use defaults */});
  }, []);
  return cats;
}

function useConfigCurrency(): ProductCurrency {
  const [currency, setCurrency] = useState<ProductCurrency>('AUD');
  useEffect(() => {
    getDoc(doc(db, 'config', 'siteConfig'))
      .then((snap) => {
        const d = snap.data();
        if (d?.currency?.active) setCurrency(d.currency.active as ProductCurrency);
      })
      .catch(() => {/* use default */});
  }, []);
  return currency;
}

// ─────────────────────────────────────────────
// Description editor with toolbar
// ─────────────────────────────────────────────

function DescriptionEditor({
  value,
  onChange,
  error,
}: {
  value:    string;
  onChange: (v: string) => void;
  error?:   string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX = 2000;

  function wrapSelection(prefix: string, suffix: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value: v } = ta;
    const selected = v.slice(start, end) || 'text';
    const before   = v.slice(0, start);
    const after    = v.slice(end);
    const next     = `${before}${prefix}${selected}${suffix}${after}`;
    onChange(next.slice(0, MAX));
    // restore cursor after state update
    requestAnimationFrame(() => {
      ta.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
      ta.focus();
    });
  }

  const tools = [
    { title: 'Bold',        Icon: Bold,   action: () => wrapSelection('**', '**') },
    { title: 'Italic',      Icon: Italic, action: () => wrapSelection('_', '_')   },
    { title: 'Bullet list', Icon: List,   action: () => {
      const ta = textareaRef.current;
      if (!ta) return;
      const { selectionStart, value: v } = ta;
      const insert = '\n- ';
      const next = v.slice(0, selectionStart) + insert + v.slice(selectionStart);
      onChange(next.slice(0, MAX));
    }},
  ] as const;

  const remaining = MAX - (value?.length ?? 0);

  return (
    <div>
      {/* Toolbar */}
      <div
        style={{
          display:         'flex',
          gap:             '4px',
          padding:         '6px 8px',
          borderRadius:    'var(--radius-md) var(--radius-md) 0 0',
          border:          '1.5px solid var(--color-border)',
          borderBottom:    'none',
          backgroundColor: 'var(--color-bg-secondary)',
        }}
      >
        {tools.map(({ title, Icon, action }) => (
          <button
            key={title}
            type="button"
            title={title}
            onClick={action}
            style={{
              width:           '30px',
              height:          '28px',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              borderRadius:    'var(--radius-sm)',
              border:          'none',
              backgroundColor: 'transparent',
              color:           'var(--color-text-secondary)',
              cursor:          'pointer',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-bg-primary)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
          >
            <Icon size={14} />
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: remaining < 100 ? 'var(--color-danger)' : 'var(--color-text-tertiary)', alignSelf: 'center' }}>
          {remaining} left
        </span>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX))}
        rows={8}
        placeholder="Describe your product — condition details, what's included, pickup/delivery options…"
        style={{
          width:           '100%',
          padding:         '10px 12px',
          borderRadius:    '0 0 var(--radius-md) var(--radius-md)',
          border:          `1.5px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
          backgroundColor: 'var(--color-bg-primary)',
          color:           'var(--color-text-primary)',
          fontSize:        '14px',
          outline:         'none',
          resize:          'vertical',
          minHeight:       '160px',
          boxSizing:       'border-box',
          fontFamily:      'var(--font-body)',
          lineHeight:      1.6,
        }}
      />
      {error && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Image Upload Zone
// ─────────────────────────────────────────────

function ImageUploadZone({
  images,
  onChange,
}: {
  images:   ImageEntry[];
  onChange: (images: ImageEntry[]) => void;
}) {
  const inputRef    = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragIdx,  setDragIdx]  = useState<number | null>(null);
  const [overIdx,  setOverIdx]  = useState<number | null>(null);

  async function processFiles(files: File[]) {
    const accepted = files
      .filter((f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE)
      .slice(0, MAX_IMAGES - images.length);

    if (accepted.length === 0) return;

    // Create preview entries immediately
    const entries: ImageEntry[] = accepted.map((file) => ({
      id:         uid(),
      file,
      previewUrl: URL.createObjectURL(file),
      uploading:  true,
    }));

    onChange([...images, ...entries]);

    // Upload in parallel
    const updated = await Promise.all(
      entries.map(async (entry) => {
        try {
          const { url, publicId } = await uploadToCloudinary(entry.file!);
          return { ...entry, cloudinaryUrl: url, cloudinaryId: publicId, uploading: false };
        } catch {
          return { ...entry, uploading: false, error: 'Upload failed' };
        }
      }),
    );

    onChange((prev: ImageEntry[]) => {
      const base = prev.filter((p) => !entries.find((e) => e.id === p.id));
      return [...base, ...updated];
    });
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    void processFiles(files);
  }

  function removeImage(id: string) {
    onChange(images.filter((img) => img.id !== id));
  }

  // Drag-to-reorder
  function handleThumbDragStart(idx: number) { setDragIdx(idx); }
  function handleThumbDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setOverIdx(idx);
  }
  function handleThumbDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...images];
    const [moved]   = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    onChange(reordered);
    setDragIdx(null);
    setOverIdx(null);
  }

  const canAdd = images.length < MAX_IMAGES;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      {/* Drop zone */}
      {canAdd && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border:          `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius:    'var(--radius-lg)',
            padding:         'var(--space-xl)',
            textAlign:       'center',
            cursor:          'pointer',
            backgroundColor: dragOver
              ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)'
              : 'var(--color-bg-secondary)',
            transition:      'border-color 0.15s ease, background-color 0.15s ease',
          }}
        >
          <Upload size={28} style={{ color: dragOver ? 'var(--color-primary)' : 'var(--color-text-tertiary)', marginBottom: '8px' }} />
          <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
            Drag & drop photos here
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
            or click to browse — JPG, PNG, WEBP up to 5 MB each · {images.length}/{MAX_IMAGES} added
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(',')}
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files) void processFiles(Array.from(e.target.files));
              e.target.value = '';
            }}
          />
        </div>
      )}

      {/* Thumbnail grid */}
      {images.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px' }}>
          {images.map((img, i) => (
            <div
              key={img.id}
              draggable
              onDragStart={() => handleThumbDragStart(i)}
              onDragOver={(e) => handleThumbDragOver(e, i)}
              onDrop={() => handleThumbDrop(i)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              style={{
                position:        'relative',
                borderRadius:    'var(--radius-md)',
                overflow:        'hidden',
                aspectRatio:     '1',
                border:          `2px solid ${overIdx === i ? 'var(--color-primary)' : i === 0 ? 'var(--color-success)' : 'var(--color-border)'}`,
                opacity:         dragIdx === i ? 0.5 : 1,
                cursor:          'grab',
                backgroundColor: 'var(--color-bg-secondary)',
                transition:      'border-color 0.15s ease',
              }}
            >
              <img
                src={img.previewUrl}
                alt={`Upload ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />

              {/* Uploading overlay */}
              {img.uploading && (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={20} style={{ color: '#ffffff', animation: 'spin 1s linear infinite' }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {/* Error overlay */}
              {img.error && (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(220,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={18} style={{ color: '#ffffff' }} />
                </div>
              )}

              {/* Primary badge */}
              {i === 0 && !img.uploading && !img.error && (
                <span style={{ position: 'absolute', bottom: '4px', left: '4px', fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', backgroundColor: 'var(--color-success)', color: '#ffffff', letterSpacing: '0.04em' }}>
                  PRIMARY
                </span>
              )}

              {/* Drag handle */}
              <div style={{ position: 'absolute', top: '4px', left: '4px', color: 'rgba(255,255,255,0.8)' }}>
                <GripVertical size={14} />
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                aria-label="Remove image"
                style={{
                  position:        'absolute',
                  top:             '4px',
                  right:           '4px',
                  width:           '20px',
                  height:          '20px',
                  borderRadius:    '50%',
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  color:           '#ffffff',
                  border:          'none',
                  cursor:          'pointer',
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  padding:         0,
                }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
        First image is the primary listing photo. Drag thumbnails to reorder.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Form field wrapper
// ─────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  children,
  hint,
}: {
  label:    string;
  required?: boolean;
  error?:   string;
  children: React.ReactNode;
  hint?:    string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
        {label}{required && <span style={{ color: 'var(--color-danger)', marginLeft: '2px' }}>*</span>}
      </label>
      {children}
      {hint  && !error && <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-tertiary)' }}>{hint}</p>}
      {error && <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────

function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-base)', paddingBottom: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)' }}>
      <div
        style={{
          width:           '26px',
          height:          '26px',
          borderRadius:    '50%',
          backgroundColor: 'var(--color-primary)',
          color:           '#ffffff',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          fontSize:        '12px',
          fontWeight:      700,
          flexShrink:      0,
        }}
      >
        {number}
      </div>
      <h2
        className="font-display font-semibold"
        style={{ margin: 0, fontSize: '16px', color: 'var(--color-text-primary)' }}
      >
        {title}
      </h2>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

function NewProductForm() {
  const router     = useRouter();
  const { user }   = useAuthStore();
  const categories = useCategories();
  const currency   = useConfigCurrency();

  const [images,      setImages]      = useState<ImageEntry[]>([]);
  const [submitError, setSubmitError] = useState('');
  const [success,     setSuccess]     = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver:      zodResolver(schema),
    defaultValues: {
      condition:  'new',
      negotiable: false,
      city:       user?.location?.city    ?? '',
      country:    user?.location?.country ?? '',
    },
  });

  const description    = watch('description') ?? '';
  const useProfileLoc  = watch('city') === (user?.location?.city ?? '') &&
                         watch('country') === (user?.location?.country ?? '');

  // First uploaded image URL (for AI auto-tagging)
  const firstImageUrl  = images.find((img) => img.cloudinaryUrl)?.cloudinaryUrl ?? '';

  function handleTagsGenerated(result: { category: string; tags: string[]; description: string }) {
    if (result.category) {
      setValue('category', result.category, { shouldValidate: true });
    }
    // Tags field is not in the current schema; apply description if the description field is empty
    if (result.description && !description) {
      setValue('description', result.description, { shouldValidate: true });
    }
  }

  const inputStyle: React.CSSProperties = {
    width:           '100%',
    padding:         '10px 12px',
    borderRadius:    'var(--radius-md)',
    border:          '1.5px solid var(--color-border)',
    backgroundColor: 'var(--color-bg-primary)',
    color:           'var(--color-text-primary)',
    fontSize:        '14px',
    outline:         'none',
    boxSizing:       'border-box',
  };

  async function submitForm(data: FormValues, publishActive: boolean) {
    setSubmitError('');

    // Ensure at least one image
    if (images.length === 0) {
      setSubmitError('Please upload at least one product photo.');
      return;
    }

    // Ensure all uploads are complete
    const uploading = images.some((img) => img.uploading);
    if (uploading) {
      setSubmitError('Please wait for all images to finish uploading.');
      return;
    }

    const hasErrors = images.some((img) => img.error);
    if (hasErrors) {
      setSubmitError('Some images failed to upload. Remove them and try again.');
      return;
    }

    try {
      const productImages = images.map((img) => ({
        url:         img.cloudinaryUrl ?? img.previewUrl,
        cloudinaryId: img.cloudinaryId ?? '',
      }));

      const docRef = await addDoc(collection(db, 'products'), {
        sellerId:    user!.uid,
        name:        data.name,
        productCode: data.productCode ?? null,
        category:    data.category,
        condition:   data.condition,
        description: data.description,
        images:      productImages,
        price:       data.price,
        currency,
        negotiable:  data.negotiable,
        location:    { city: data.city, country: data.country },
        active:      publishActive,
        views:       0,
        createdAt:   serverTimestamp(),
      });

      setSuccess(true);
      setTimeout(() => {
        router.push(publishActive ? `/products/${docRef.id}` : '/my-products');
      }, 1500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save listing. Please try again.');
    }
  }

  if (success) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: 'var(--space-section) var(--space-6)', textAlign: 'center' }}>
        <CheckCircle size={52} style={{ color: 'var(--color-success)', marginBottom: 'var(--space-base)' }} />
        <h2 className="font-display font-bold" style={{ fontSize: '22px', color: 'var(--color-text-primary)', margin: '0 0 var(--space-xs)' }}>
          Listing Saved!
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Redirecting…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: 'var(--space-base) var(--space-6) var(--space-section)' }}>
      <h1
        className="font-display font-bold"
        style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-xl)' }}
      >
        List a Product
      </h1>

      <form noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>

        {/* ── Section 1: Basic Details ── */}
        <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-lg)', backgroundColor: 'var(--color-bg-primary)' }}>
          <SectionHeader number={1} title="Basic Details" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-base)' }}>

            <Field label="Product Name" required error={errors.name?.message}>
              <input type="text" placeholder="e.g. Sony α7 III Camera Body" {...register('name')} style={{ ...inputStyle, borderColor: errors.name ? 'var(--color-danger)' : 'var(--color-border)' }} />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-base)' }} className="tablet:grid-cols-2">
              <Field label="Product Code / SKU" error={errors.productCode?.message} hint="Optional — helps buyers search by code">
                <input type="text" placeholder="e.g. SONY-A7M3" {...register('productCode')} style={inputStyle} />
              </Field>

              <Field label="Category" required error={errors.category?.message}>
                <div style={{ position: 'relative' }}>
                  <select
                    {...register('category')}
                    style={{ ...inputStyle, appearance: 'none', paddingRight: '32px', cursor: 'pointer', borderColor: errors.category ? 'var(--color-danger)' : 'var(--color-border)' }}
                  >
                    <option value="">Select category…</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-tertiary)' }} />
                </div>
              </Field>
            </div>

            <Field label="Condition" required error={errors.condition?.message}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {CONDITIONS.map(({ value, label }) => {
                  const selected = watch('condition') === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setValue('condition', value, { shouldValidate: true })}
                      style={{
                        flex:            1,
                        padding:         '9px 0',
                        borderRadius:    'var(--radius-md)',
                        border:          `1.5px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        backgroundColor: selected ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                        color:           selected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        fontWeight:      selected ? 600 : 400,
                        fontSize:        '13px',
                        cursor:          'pointer',
                        transition:      'all 0.15s ease',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        </div>

        {/* ── Section 2: Description ── */}
        <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-lg)', backgroundColor: 'var(--color-bg-primary)' }}>
          <SectionHeader number={2} title="Description" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <ProductDescriptionGenerator
              productName={watch('name') ?? ''}
              category={watch('category') ?? ''}
              condition={watch('condition') ?? ''}
              onGenerated={(desc) => setValue('description', desc, { shouldValidate: true })}
            />
            <Field label="Product Description" required error={errors.description?.message}>
              <DescriptionEditor
                value={description}
                onChange={(v) => setValue('description', v, { shouldValidate: true })}
                error={errors.description?.message}
              />
            </Field>
          </div>
        </div>

        {/* ── Section 3: Photos ── */}
        <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-lg)', backgroundColor: 'var(--color-bg-primary)' }}>
          <SectionHeader number={3} title="Photos" />
          <ImageUploadZone
            images={images}
            onChange={(imgs) => setImages(typeof imgs === 'function' ? (imgs as (prev: ImageEntry[]) => ImageEntry[])(images) : imgs)}
          />
          <div style={{ marginTop: 'var(--space-sm)' }}>
            <ImageTagger
              imageUrl={firstImageUrl}
              onTagsGenerated={handleTagsGenerated}
            />
          </div>
        </div>

        {/* ── Section 4: Pricing ── */}
        <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-lg)', backgroundColor: 'var(--color-bg-primary)' }}>
          <SectionHeader number={4} title="Pricing" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-base)' }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-sm)', alignItems: 'end' }}>
              <Field label="Price" required error={errors.price?.message}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  {...register('price')}
                  style={{ ...inputStyle, borderColor: errors.price ? 'var(--color-danger)' : 'var(--color-border)' }}
                />
              </Field>
              <div
                style={{
                  padding:         '10px 16px',
                  borderRadius:    'var(--radius-md)',
                  border:          '1.5px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  fontSize:        '14px',
                  fontWeight:      600,
                  color:           'var(--color-text-secondary)',
                  whiteSpace:      'nowrap',
                  height:          'fit-content',
                }}
                title="Currency is configured by the admin"
              >
                {currency}
              </div>
            </div>

            {/* Negotiable toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', userSelect: 'none' }}>
              <div
                onClick={() => setValue('negotiable', !watch('negotiable'))}
                style={{
                  width:           '40px',
                  height:          '22px',
                  borderRadius:    '11px',
                  backgroundColor: watch('negotiable') ? 'var(--color-primary)' : 'var(--color-border)',
                  position:        'relative',
                  cursor:          'pointer',
                  transition:      'background-color 0.2s ease',
                  flexShrink:      0,
                }}
              >
                <div style={{
                  position:   'absolute',
                  top:        '3px',
                  left:       watch('negotiable') ? '21px' : '3px',
                  width:      '16px',
                  height:     '16px',
                  borderRadius:'50%',
                  backgroundColor: '#ffffff',
                  transition: 'left 0.2s ease',
                  boxShadow:  '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
              <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
                Price is negotiable
              </span>
            </label>
          </div>
        </div>

        {/* ── Section 5: Location ── */}
        <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-lg)', backgroundColor: 'var(--color-bg-primary)' }}>
          <SectionHeader number={5} title="Location" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-base)' }}>

            {/* Use profile location checkbox */}
            {user?.location && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={useProfileLoc}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setValue('city',    user.location?.city    ?? '', { shouldValidate: true });
                      setValue('country', user.location?.country ?? '', { shouldValidate: true });
                    }
                  }}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  Use my profile location ({user.location.city}, {user.location.country})
                </span>
              </label>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-base)' }}>
              <Field label="City" required error={errors.city?.message}>
                <input type="text" placeholder="e.g. Sydney" {...register('city')} style={{ ...inputStyle, borderColor: errors.city ? 'var(--color-danger)' : 'var(--color-border)' }} />
              </Field>
              <Field label="Country" required error={errors.country?.message}>
                <input type="text" placeholder="e.g. Australia" {...register('country')} style={{ ...inputStyle, borderColor: errors.country ? 'var(--color-danger)' : 'var(--color-border)' }} />
              </Field>
            </div>
          </div>
        </div>

        {/* ── Error banner ── */}
        {submitError && (
          <div
            style={{
              display:         'flex',
              alignItems:      'flex-start',
              gap:             'var(--space-sm)',
              padding:         'var(--space-sm) var(--space-base)',
              borderRadius:    'var(--radius-md)',
              backgroundColor: 'color-mix(in srgb, var(--color-danger) 8%, transparent)',
              border:          '1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)',
              color:           'var(--color-danger)',
              fontSize:        '13px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            {submitError}
          </div>
        )}

        {/* ── Action buttons ── */}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit((data) => submitForm(data, false))}
            style={{
              padding:         '12px 24px',
              borderRadius:    'var(--radius-md)',
              border:          '1.5px solid var(--color-border)',
              backgroundColor: 'transparent',
              color:           isSubmitting ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
              fontWeight:      600,
              fontSize:        '14px',
              cursor:          isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            Save as Draft
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit((data) => submitForm(data, true))}
            style={{
              display:         'flex',
              alignItems:      'center',
              gap:             '8px',
              padding:         '12px 28px',
              borderRadius:    'var(--radius-md)',
              border:          'none',
              backgroundColor: isSubmitting ? 'var(--color-bg-secondary)' : 'var(--color-primary)',
              color:           isSubmitting ? 'var(--color-text-tertiary)' : '#ffffff',
              fontWeight:      600,
              fontSize:        '14px',
              cursor:          isSubmitting ? 'not-allowed' : 'pointer',
              transition:      'background-color 0.15s ease',
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                Saving…
              </>
            ) : (
              <>
                <ImageIcon size={15} />
                Publish Listing
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────
// Export — seller-only guard
// ─────────────────────────────────────────────

export default function NewProductPage() {
  return (
    <RoleGuard allowedRoles={['seller']}>
      <SellerLayout>
        <NewProductForm />
      </SellerLayout>
    </RoleGuard>
  );
}
