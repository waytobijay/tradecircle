/**
 * app/products/[id]/edit/page.tsx
 * Edit an existing product listing — seller only.
 * Spec ref: section 6.3 (List a Product — edit variant)
 *
 * Mirrors /products/new but:
 *   - Fetches existing product data on mount and pre-fills form
 *   - Verifies product.sellerId === auth user (ownership guard)
 *   - Updates Firestore doc instead of creating a new one
 *   - Preserves existing Cloudinary images; new uploads appended
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter }       from 'next/navigation';
import { useForm }                    from 'react-hook-form';
import { zodResolver }                from '@hookform/resolvers/zod';
import { z }                          from 'zod';
import {
  Upload, X, GripVertical,
  Bold, Italic, List,
  ChevronDown, CheckCircle,
  Loader2, AlertCircle, ArrowLeft,
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
import SellerLayout     from '@/components/layouts/SellerLayout';
import SkeletonLoader   from '@/components/ui/SkeletonLoader';
import type {
  Product,
  ProductCurrency,
  ProductCondition,
  ProductImage,
} from '@/types';

// ─────────────────────────────────────────────
// Schema
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
  id:           string;
  file?:        File;        // new upload — not yet on Cloudinary
  previewUrl:   string;
  cloudinaryId?: string;    // existing — from Firestore
  cloudinaryUrl?: string;   // existing — from Firestore
  uploading:    boolean;
  error?:       string;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const CATEGORIES = [
  'Electronics', 'Vehicles', 'Property', 'Furniture', 'Clothing & Apparel',
  'Garden & Outdoors', 'Sports & Fitness', 'Books & Stationery',
  'Home Appliances', 'Toys & Games', 'Jewellery & Accessories',
  'Agricultural', 'Business & Industrial', 'Other',
];

const COUNTRIES = [
  'Australia', 'New Zealand', 'Nepal', 'India', 'United States',
  'United Kingdom', 'Canada', 'Singapore', 'Other',
];

const CURRENCY_SYMBOL: Record<ProductCurrency, string> = {
  AUD: 'A$', USD: '$', NPR: 'रू', INR: '₹',
};

// ─────────────────────────────────────────────
// Description toolbar (same as /products/new)
// ─────────────────────────────────────────────

interface ToolbarProps {
  onInsert: (wrap: string) => void;
}

function DescriptionToolbar({ onInsert }: ToolbarProps) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: '6px 10px',
      background: 'var(--color-bg-tertiary)',
      borderBottom: '1px solid var(--color-border)',
      borderRadius: '8px 8px 0 0',
    }}>
      {[
        { label: 'B', title: 'Bold',   wrap: '**' },
        { label: 'I', title: 'Italic', wrap: '_' },
        { label: '•', title: 'List',   wrap: '\n- ' },
      ].map((btn) => (
        <button
          key={btn.label}
          type="button"
          title={btn.title}
          onClick={() => onInsert(btn.wrap)}
          style={{
            width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text-secondary)',
          }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Upload image to Cloudinary (best-effort)
// ─────────────────────────────────────────────

async function uploadToCloudinary(
  file: File,
  cloudName: string,
  uploadPreset: string
): Promise<{ url: string; publicId: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );
  if (!res.ok) throw new Error('Cloudinary upload failed');
  const data = (await res.json()) as { secure_url: string; public_id: string };
  return { url: data.secure_url, publicId: data.public_id };
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

function EditProductInner() {
  const params     = useParams<{ id: string }>();
  const productId  = params?.id ?? '';
  const router     = useRouter();
  const { user }   = useAuthStore();

  // Product load state
  const [fetching, setFetching]       = useState(true);
  const [notFound, setNotFound]       = useState(false);
  const [forbidden, setForbidden]     = useState(false);
  const [currency, setCurrency]       = useState<ProductCurrency>('AUD');
  const [cloudName, setCloudName]     = useState('');
  const [uploadPreset, setUploadPreset] = useState('');

  // Images
  const [images, setImages]           = useState<ImageEntry[]>([]);
  const [imageError, setImageError]   = useState('');
  const [dragOver, setDragOver]       = useState(false);
  const [dragIndex, setDragIndex]     = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragOverIndexRef = useRef<number | null>(null);

  // Submit state
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState('');
  const [saved, setSaved]             = useState(false);
  const [saveMode, setSaveMode]       = useState<'draft' | 'publish'>('publish');

  // Description ref for toolbar insert
  const descRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const descValue = watch('description', '');

  // ── Load product + config ─────────────────

  useEffect(() => {
    if (!productId || !user) return;

    Promise.all([
      getDoc(doc(db, 'products', productId)),
      getDoc(doc(db, 'config', 'site')),
    ])
      .then(([productSnap, configSnap]) => {
        if (!productSnap.exists()) { setNotFound(true); return; }

        const data = productSnap.data() as Product;
        if (data.sellerId !== user.uid) { setForbidden(true); return; }

        // Pre-fill form
        reset({
          name:        data.name,
          productCode: data.productCode ?? '',
          category:    data.category,
          condition:   data.condition,
          description: data.description,
          price:       data.price,
          negotiable:  data.negotiable ?? false,
          city:        data.location.city,
          country:     data.location.country,
        });

        setCurrency(data.currency);

        // Populate image entries from existing Firestore data
        setImages(
          (data.images ?? []).map((img: ProductImage, i: number) => ({
            id:           `existing-${i}`,
            previewUrl:   img.url,
            cloudinaryId: img.cloudinaryId,
            cloudinaryUrl: img.url,
            uploading:    false,
          }))
        );

        // Config for currency + Cloudinary
        if (configSnap.exists()) {
          const cfg = configSnap.data() as {
            currency?: { active?: string };
            cloudinary?: { cloudName?: string; uploadPreset?: string };
          };
          if (cfg.currency?.active) setCurrency(cfg.currency.active as ProductCurrency);
          if (cfg.cloudinary?.cloudName)    setCloudName(cfg.cloudinary.cloudName);
          if (cfg.cloudinary?.uploadPreset) setUploadPreset(cfg.cloudinary.uploadPreset);
        }
      })
      .catch((err) => {
        console.error('[EditProduct] fetch error', err);
        setNotFound(true);
      })
      .finally(() => setFetching(false));
  }, [productId, user, reset]);

  // ── Image handling ────────────────────────

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const remaining = 5 - images.length;
    if (remaining <= 0) { setImageError('Maximum 5 images allowed'); return; }
    setImageError('');

    const toAdd = arr.slice(0, remaining);
    const newEntries: ImageEntry[] = toAdd.map((file) => ({
      id:         `new-${crypto.randomUUID()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      uploading:  false,
    }));
    setImages((prev) => [...prev, ...newEntries]);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const entry = prev.find((e) => e.id === id);
      if (entry?.file) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((e) => e.id !== id);
    });
    setImageError('');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  // Drag-to-reorder
  const handleDragStart = (idx: number) => setDragIndex(idx);

  const handleDragOverImg = (idx: number) => {
    dragOverIndexRef.current = idx;
  };

  const handleDragEndImg = () => {
    const from = dragIndex;
    const to   = dragOverIndexRef.current;
    if (from !== null && to !== null && from !== to) {
      setImages((prev) => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    }
    setDragIndex(null);
    dragOverIndexRef.current = null;
  };

  // ── Description toolbar ───────────────────

  const handleToolbarInsert = (wrap: string) => {
    const el = descRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const cur   = descValue;
    const selected = cur.slice(start, end);
    const next  = cur.slice(0, start) + wrap + selected + (wrap.startsWith('\n') ? '' : wrap) + cur.slice(end);
    setValue('description', next, { shouldValidate: true });
    setTimeout(() => {
      el.selectionStart = start + wrap.length;
      el.selectionEnd   = start + wrap.length + selected.length;
      el.focus();
    }, 0);
  };

  // ── Submit ────────────────────────────────

  const onSubmit = async (data: FormValues) => {
    if (images.length === 0) { setImageError('Add at least one product image'); return; }
    setSaving(true);
    setSaveError('');

    try {
      // Upload any new images to Cloudinary
      const finalImages: ProductImage[] = [];

      for (const img of images) {
        if (img.cloudinaryUrl) {
          // Existing Cloudinary image — keep as-is
          finalImages.push({ url: img.cloudinaryUrl, cloudinaryId: img.cloudinaryId ?? '' });
        } else if (img.file && cloudName && uploadPreset) {
          // New upload
          setImages((prev) =>
            prev.map((e) => e.id === img.id ? { ...e, uploading: true } : e)
          );
          const { url, publicId } = await uploadToCloudinary(img.file, cloudName, uploadPreset);
          finalImages.push({ url, cloudinaryId: publicId });
          setImages((prev) =>
            prev.map((e) =>
              e.id === img.id
                ? { ...e, uploading: false, cloudinaryUrl: url, cloudinaryId: publicId }
                : e
            )
          );
        } else {
          // No Cloudinary configured — use object URL as placeholder
          finalImages.push({ url: img.previewUrl, cloudinaryId: '' });
        }
      }

      await updateDoc(doc(db, 'products', productId), {
        name:        data.name,
        productCode: data.productCode ?? '',
        category:    data.category,
        condition:   data.condition,
        description: data.description,
        images:      finalImages,
        price:       data.price,
        currency,
        negotiable:  data.negotiable,
        location:    { city: data.city, country: data.country },
        active:      saveMode === 'publish',
        updatedAt:   serverTimestamp(),
      });

      setSaved(true);
      setTimeout(() => router.push('/my-products'), 1800);
    } catch (err) {
      console.error('[EditProduct] save error', err);
      setSaveError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Guard states ──────────────────────────

  if (fetching) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px' }}>
        <SkeletonLoader width={200} height={28} style={{ marginBottom: 24 }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ marginBottom: 24 }}>
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
          Product not found
        </h2>
        <button
          onClick={() => router.push('/my-products')}
          style={{
            marginTop: 16, padding: '9px 22px',
            background: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: 9,
            cursor: 'pointer', fontWeight: 600, fontSize: 14,
          }}
        >
          My Products
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
        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--color-text-secondary)' }}>
          You don't have permission to edit this listing.
        </p>
        <button
          onClick={() => router.push('/my-products')}
          style={{
            padding: '9px 22px',
            background: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: 9,
            cursor: 'pointer', fontWeight: 600, fontSize: 14,
          }}
        >
          My Products
        </button>
      </div>
    );
  }

  if (saved) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <CheckCircle size={48} color="var(--color-success)" style={{ marginBottom: 16 }} />
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
          Listing updated!
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)' }}>
          Redirecting to My Products…
        </p>
      </div>
    );
  }

  // ── Form ──────────────────────────────────

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '10px 14px',
    background: 'var(--color-bg-secondary)',
    border: `1px solid ${hasError ? 'var(--color-danger)' : 'var(--color-border)'}`,
    borderRadius: 8,
    fontSize: 14,
    color: 'var(--color-text)',
    outline: 'none',
    boxSizing: 'border-box',
  });

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text)',
    marginBottom: 6,
  };

  const fieldStyle: React.CSSProperties = { marginBottom: 20 };

  const errorStyle: React.CSSProperties = {
    margin: '4px 0 0', fontSize: 12, color: 'var(--color-danger)',
  };

  return (
    <>
      <style>{`
        .ep-select { appearance: none; }
        .ep-select::-ms-expand { display: none; }
        @keyframes ep-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 100px' }}>

        {/* Back + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button
            type="button"
            onClick={() => router.push('/my-products')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36,
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '50%',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} color="var(--color-text)" />
          </button>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>
            Edit Listing
          </h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>

          {/* ── Section 1: Basic Details ──────── */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: 'var(--color-text)', paddingBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
              Basic Details
            </h2>

            <div style={fieldStyle}>
              <label style={labelStyle}>
                Product Name <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input {...register('name')} placeholder="e.g. iPhone 14 Pro Max 256GB" style={inputStyle(!!errors.name)} />
              {errors.name && <p style={errorStyle}>{errors.name.message}</p>}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>
                Product Code / SKU{' '}
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-tertiary)' }}>(optional)</span>
              </label>
              <input {...register('productCode')} placeholder="e.g. SKU-001" style={inputStyle(false)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Category <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    {...register('category')}
                    className="ep-select"
                    style={{ ...inputStyle(!!errors.category), paddingRight: 36 }}
                  >
                    <option value="">Select a category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} color="var(--color-text-secondary)" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
                {errors.category && <p style={errorStyle}>{errors.category.message}</p>}
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Condition <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    {...register('condition')}
                    className="ep-select"
                    style={{ ...inputStyle(!!errors.condition), paddingRight: 36 }}
                  >
                    <option value="new">New</option>
                    <option value="used">Used</option>
                    <option value="refurbished">Refurbished</option>
                  </select>
                  <ChevronDown size={16} color="var(--color-text-secondary)" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 2: Description ─────────── */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: 'var(--color-text)', paddingBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
              Description
            </h2>

            <div style={fieldStyle}>
              <label style={labelStyle}>
                Description <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <DescriptionToolbar onInsert={handleToolbarInsert} />
              <textarea
                {...register('description', {
                  onChange: () => {},
                })}
                ref={(el) => {
                  register('description').ref(el);
                  descRef.current = el;
                }}
                rows={7}
                placeholder="Describe your product — condition, features, reason for selling…"
                style={{
                  ...inputStyle(!!errors.description),
                  borderRadius: '0 0 8px 8px',
                  borderTop: 'none',
                  resize: 'vertical',
                  lineHeight: 1.6,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {errors.description
                  ? <p style={errorStyle}>{errors.description.message}</p>
                  : <span />
                }
                <span style={{ fontSize: 12, color: (descValue?.length ?? 0) > 1900 ? 'var(--color-warning)' : 'var(--color-text-tertiary)' }}>
                  {descValue?.length ?? 0} / 2000
                </span>
              </div>
            </div>
          </section>

          {/* ── Section 3: Photos ─────────────── */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: 'var(--color-text)', paddingBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
              Photos
            </h2>

            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Drag to reorder — the first image is your primary photo. Min 1, max 5.
            </p>

            {/* Thumbnails grid */}
            {images.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                {images.map((img, idx) => (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => { e.preventDefault(); handleDragOverImg(idx); }}
                    onDragEnd={handleDragEndImg}
                    style={{
                      position: 'relative', width: 88, height: 88,
                      borderRadius: 10, overflow: 'hidden',
                      border: idx === 0
                        ? '2px solid var(--color-primary)'
                        : '1px solid var(--color-border)',
                      cursor: 'grab',
                      opacity: dragIndex === idx ? 0.5 : 1,
                    }}
                  >
                    {img.uploading ? (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-tertiary)' }}>
                        <div style={{ width: 20, height: 20, border: '2px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'ep-spin 0.6s linear infinite' }} />
                      </div>
                    ) : (
                      <img src={img.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    {idx === 0 && (
                      <span style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--color-primary)', padding: '1px 6px', borderRadius: 20 }}>
                        Primary
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 20, height: 20, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.65)',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                      }}
                    >
                      <X size={11} color="#fff" />
                    </button>
                    <div style={{ position: 'absolute', top: 4, left: 4 }}>
                      <GripVertical size={12} color="rgba(255,255,255,0.8)" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Drop zone */}
            {images.length < 5 && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 12,
                  padding: '28px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver
                    ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)'
                    : 'var(--color-bg-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                <Upload size={28} color={dragOver ? 'var(--color-primary)' : 'var(--color-text-tertiary)'} style={{ marginBottom: 8 }} />
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                  Drop photos here or click to browse
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                  JPG, PNG, WEBP — max 5MB each — {images.length}/5 used
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); }}
              style={{ display: 'none' }}
            />

            {imageError && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={13} /> {imageError}
              </p>
            )}
          </section>

          {/* ── Section 4: Pricing ─────────────── */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: 'var(--color-text)', paddingBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
              Pricing
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>
                  Price <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)',
                  }}>
                    {CURRENCY_SYMBOL[currency]}
                  </span>
                  <input
                    {...register('price')}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    style={{ ...inputStyle(!!errors.price), paddingLeft: 36 }}
                  />
                </div>
                {errors.price && <p style={errorStyle}>{errors.price.message}</p>}
              </div>

              <div>
                <label style={labelStyle}>Currency</label>
                <div style={{
                  ...inputStyle(false),
                  background: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-secondary)',
                  cursor: 'not-allowed',
                  display: 'flex', alignItems: 'center',
                }}>
                  {currency}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                  Set in admin config
                </p>
              </div>
            </div>

            {/* Negotiable toggle */}
            <label style={{
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              padding: '12px 14px',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
            }}>
              <input
                {...register('negotiable')}
                type="checkbox"
                style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                  Price is negotiable
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  Shows "negotiable" badge on your listing
                </p>
              </div>
            </label>
          </section>

          {/* ── Section 5: Location ─────────────── */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: 'var(--color-text)', paddingBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
              Location
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  City <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input {...register('city')} placeholder="e.g. Sydney" style={inputStyle(!!errors.city)} />
                {errors.city && <p style={errorStyle}>{errors.city.message}</p>}
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Country <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    {...register('country')}
                    className="ep-select"
                    style={{ ...inputStyle(!!errors.country), paddingRight: 36 }}
                  >
                    <option value="">Select country</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} color="var(--color-text-secondary)" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
                {errors.country && <p style={errorStyle}>{errors.country.message}</p>}
              </div>
            </div>
          </section>

          {/* ── Save error ────────────────────── */}
          {saveError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px',
              background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
              borderRadius: 8, marginBottom: 20,
              fontSize: 13, color: 'var(--color-danger)',
            }}>
              <AlertCircle size={15} />
              {saveError}
            </div>
          )}

          {/* ── Action buttons ────────────────── */}
          <div style={{
            position: 'sticky', bottom: 0,
            background: 'var(--color-bg)',
            borderTop: '1px solid var(--color-border)',
            padding: '14px 0',
            display: 'flex', gap: 12, justifyContent: 'flex-end',
          }}>
            <button
              type="button"
              onClick={() => router.push('/my-products')}
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
              onClick={() => setSaveMode('draft')}
              disabled={saving}
              style={{
                padding: '10px 22px',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 9,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: 14,
                opacity: saving ? 0.6 : 1,
              }}
            >
              Save as Draft
            </button>

            <button
              type="submit"
              onClick={() => setSaveMode('publish')}
              disabled={saving}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 22px',
                background: saving ? 'var(--color-bg-tertiary)' : 'var(--color-primary)',
                color: saving ? 'var(--color-text-secondary)' : '#fff',
                border: 'none', borderRadius: 9,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: 14,
              }}
            >
              {saving ? (
                <>
                  <div style={{ width: 16, height: 16, border: '2px solid var(--color-text-secondary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'ep-spin 0.6s linear infinite' }} />
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

export default function EditProductPage() {
  return (
    <RoleGuard allowedRoles={['seller']}>
      <SellerLayout>
        <EditProductInner />
      </SellerLayout>
    </RoleGuard>
  );
}
