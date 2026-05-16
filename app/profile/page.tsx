/**
 * app/profile/page.tsx
 * Own profile page — view + edit.
 * Spec ref: section 4.2 (User Profile)
 *
 * Header: cover photo | circular avatar | name | role badge | location | member since | [Edit Profile]
 * Tabs (role-based):
 *   Seller  → My Products | About | Reviews & Ratings
 *   Buyer   → About | Saved Products
 *   Advisor → My Advice | About | Contact Me
 *
 * Edit Profile: inline modal — RHF + Zod, Cloudinary photo uploads, Firestore update.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link                            from 'next/link';
import { useRouter }                   from 'next/navigation';
import { useForm }                     from 'react-hook-form';
import { zodResolver }                 from '@hookform/resolvers/zod';
import { z }                           from 'zod';
import {
  Camera,
  MapPin,
  Star,
  Edit2,
  X,
  Loader2,
  CheckCircle,
  Package,
  BookOpen,
  Bookmark,
  Phone,
  Eye,
} from 'lucide-react';
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { updateProfile }   from 'firebase/auth';
import { auth, db }        from '@/services/firebase';
import { useAuthStore }    from '@/store/authStore';
import { BuyerLayout }     from '@/components/layouts/BuyerLayout';
import { SellerLayout }    from '@/components/layouts/SellerLayout';
import { AdvisorLayout }   from '@/components/layouts/AdvisorLayout';
import type { Product, AdvicePost, Review, User } from '@/types';

// ─────────────────────────────────────────────
// Cloudinary helper
// ─────────────────────────────────────────────

async function uploadPhoto(file: File, folder: string): Promise<string> {
  const cloudName    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME    ?? '';
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';
  const form = new FormData();
  form.append('file',          file);
  form.append('upload_preset', uploadPreset);
  form.append('folder',        `tradecircle/${folder}`);
  const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form });
  const data = await res.json() as { secure_url: string };
  return data.secure_url;
}

// ─────────────────────────────────────────────
// Edit Profile schema
// ─────────────────────────────────────────────

const editSchema = z.object({
  name:      z.string().min(2, 'Name is required').max(80),
  bio:       z.string().max(500).optional(),
  phone:     z.string().max(30).optional(),
  city:      z.string().max(60).optional(),
  country:   z.string().max(60).optional(),
  brand:     z.string().max(80).optional(),
  specialty: z.string().max(100).optional(),
});
type EditForm = z.infer<typeof editSchema>;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function memberSince(ts: { seconds: number } | undefined): string {
  if (!ts) return '';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          fill={n <= Math.round(rating) ? 'var(--color-warning)' : 'none'}
          style={{ color: 'var(--color-warning)' }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Edit Profile Modal
// ─────────────────────────────────────────────

function EditProfileModal({
  user,
  onClose,
  onSaved,
}: {
  user:    User;
  onClose: () => void;
  onSaved: (updated: Partial<User>) => void;
}) {
  const [avatarPreview, setAvatarPreview] = useState(user.profilePhoto ?? '');
  const [coverPreview,  setCoverPreview]  = useState(user.coverPhoto   ?? '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover,  setUploadingCover]  = useState(false);
  const [saveError,  setSaveError]  = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef  = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EditForm>({
    resolver:      zodResolver(editSchema),
    defaultValues: {
      name:      user.name,
      bio:       user.bio       ?? '',
      phone:     user.phone     ?? '',
      city:      user.location?.city    ?? '',
      country:   user.location?.country ?? '',
      brand:     user.brand     ?? '',
      specialty: user.specialty ?? '',
    },
  });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  async function handlePhotoChange(
    file: File,
    folder: string,
    setPreview: (url: string) => void,
    setUploading: (v: boolean) => void,
  ) {
    setUploading(true);
    try {
      const url = await uploadPhoto(file, folder);
      setPreview(url);
    } catch {
      // leave existing preview
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(data: EditForm) {
    setSaveError('');
    try {
      const updates: Partial<User> & Record<string, unknown> = {
        name:         data.name,
        bio:          data.bio       || null,
        phone:        data.phone     || null,
        location:     { city: data.city ?? '', country: data.country ?? '' },
        profilePhoto: avatarPreview  || null,
        coverPhoto:   coverPreview   || null,
        ...(user.role === 'seller'  && { brand:     data.brand     || null }),
        ...(user.role === 'advisor' && { specialty: data.specialty || null }),
      };

      await updateDoc(doc(db, 'users', user.uid), updates);

      // Sync Firebase Auth display name + photo
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: data.name,
          photoURL:    avatarPreview || null,
        });
      }

      onSaved(updates as Partial<User>);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save. Try again.');
    }
  }

  const inputStyle: React.CSSProperties = {
    width:           '100%',
    padding:         '9px 12px',
    borderRadius:    'var(--radius-md)',
    border:          '1.5px solid var(--color-border)',
    backgroundColor: 'var(--color-bg-primary)',
    color:           'var(--color-text-primary)',
    fontSize:        '14px',
    outline:         'none',
    boxSizing:       'border-box',
  };

  return (
    <>
      <div aria-hidden="true" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 49, backgroundColor: 'rgba(0,0,0,0.5)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit Profile"
        style={{
          position:        'fixed',
          top:             '50%',
          left:            '50%',
          transform:       'translate(-50%, -50%)',
          zIndex:          50,
          width:           'min(520px, calc(100vw - 32px))',
          maxHeight:       '90vh',
          overflowY:       'auto',
          borderRadius:    'var(--radius-xl)',
          backgroundColor: 'var(--color-bg-primary)',
          border:          '1px solid var(--color-border)',
          boxShadow:       '0 20px 60px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-base) var(--space-lg)', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-primary)', zIndex: 1 }}>
          <h2 className="font-display font-semibold" style={{ margin: 0, fontSize: '16px', color: 'var(--color-text-primary)' }}>Edit Profile</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px', display: 'flex' }} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-base)' }}>

          {/* Cover photo */}
          <div>
            <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Cover Photo</p>
            <div
              onClick={() => coverInputRef.current?.click()}
              style={{
                position:        'relative',
                height:          '100px',
                borderRadius:    'var(--radius-md)',
                backgroundColor: coverPreview ? undefined : 'var(--color-bg-secondary)',
                backgroundImage: coverPreview ? `url(${coverPreview})` : undefined,
                backgroundSize:  'cover',
                backgroundPosition: 'center',
                border:          '1.5px dashed var(--color-border)',
                cursor:          'pointer',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
              }}
            >
              {uploadingCover
                ? <Loader2 size={20} style={{ color: 'var(--color-text-tertiary)', animation: 'spin 1s linear infinite' }} />
                : <Camera size={20} style={{ color: coverPreview ? 'rgba(255,255,255,0.8)' : 'var(--color-text-tertiary)' }} />
              }
            </div>
            <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handlePhotoChange(e.target.files[0], 'covers', setCoverPreview, setUploadingCover)} />
          </div>

          {/* Avatar */}
          <div>
            <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Profile Photo</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-base)' }}>
              <div
                onClick={() => avatarInputRef.current?.click()}
                style={{
                  width:           '72px',
                  height:          '72px',
                  borderRadius:    '50%',
                  backgroundColor: 'var(--color-bg-secondary)',
                  backgroundImage: avatarPreview ? `url(${avatarPreview})` : undefined,
                  backgroundSize:  'cover',
                  backgroundPosition: 'center',
                  border:          '2px solid var(--color-border)',
                  cursor:          'pointer',
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  flexShrink:      0,
                }}
              >
                {!avatarPreview && <Camera size={20} style={{ color: 'var(--color-text-tertiary)' }} />}
                {uploadingAvatar && (
                  <div style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '72px', height: '72px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                    <Loader2 size={16} style={{ color: '#fff', animation: 'spin 1s linear infinite' }} />
                  </div>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                Click to upload · JPG, PNG or WEBP · max 5 MB
              </p>
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handlePhotoChange(e.target.files[0], 'avatars', setAvatarPreview, setUploadingAvatar)} />
          </div>

          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>Full Name *</label>
            <input type="text" {...register('name')} style={{ ...inputStyle, borderColor: errors.name ? 'var(--color-danger)' : 'var(--color-border)' }} />
            {errors.name && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-danger)' }}>{errors.name.message}</p>}
          </div>

          {/* Bio */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>Bio / Description</label>
            <textarea rows={3} {...register('bio')} placeholder="Tell buyers or advisors about yourself…" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-body)' }} />
          </div>

          {/* Role-specific fields */}
          {user.role === 'seller' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>Brand / Business Name</label>
              <input type="text" {...register('brand')} style={inputStyle} />
            </div>
          )}
          {user.role === 'advisor' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>Specialty / Area of Expertise</label>
              <input type="text" {...register('specialty')} style={inputStyle} />
            </div>
          )}

          {/* Phone */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>Phone Number</label>
            <input type="tel" {...register('phone')} style={inputStyle} />
          </div>

          {/* Location */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>City</label>
              <input type="text" {...register('city')} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>Country</label>
              <input type="text" {...register('country')} style={inputStyle} />
            </div>
          </div>

          {saveError && (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-danger)', padding: '8px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'color-mix(in srgb, var(--color-danger) 8%, transparent)' }}>
              {saveError}
            </p>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: 'var(--space-xs)' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || uploadingAvatar || uploadingCover}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px', borderRadius: 'var(--radius-md)', border: 'none', backgroundColor: isSubmitting ? 'var(--color-bg-secondary)' : 'var(--color-primary)', color: isSubmitting ? 'var(--color-text-tertiary)' : '#ffffff', fontWeight: 600, fontSize: '14px', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
              {isSubmitting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><CheckCircle size={14} /> Save Changes</>}
            </button>
          </div>
        </form>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Tab components
// ─────────────────────────────────────────────

function ProductsTab({ uid }: { uid: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, 'products'), where('sellerId', '==', uid), orderBy('createdAt', 'desc'), limit(12)))
      .then((snap) => setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse" style={{ borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)', aspectRatio: '1' }} />
      ))}
    </div>
  );

  if (products.length === 0) return (
    <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
      <Package size={32} style={{ color: 'var(--color-text-tertiary)', marginBottom: '8px' }} />
      <p style={{ margin: 0 }}>No products listed yet.</p>
      <Link href="/products/new" style={{ marginTop: '12px', display: 'inline-block', color: 'var(--color-primary)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>+ List your first product</Link>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
      {products.map((p) => (
        <Link key={p.id} href={`/products/${p.id}`} style={{ textDecoration: 'none' }}>
          <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}>
            {p.images?.[0]?.url
              ? <img src={p.images[0].url} alt={p.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: '100%', aspectRatio: '1', backgroundColor: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={24} style={{ color: 'var(--color-text-tertiary)' }} /></div>
            }
            <div style={{ padding: '6px 8px' }}>
              <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>{p.currency} {p.price.toLocaleString()}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function AdviceTab({ uid }: { uid: string }) {
  const [posts,   setPosts]   = useState<AdvicePost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, 'advicePosts'), where('advisorId', '==', uid), where('published', '==', true), orderBy('createdAt', 'desc'), limit(10)))
      .then((snap) => setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdvicePost)))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse" style={{ height: '72px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)' }} />
      ))}
    </div>
  );

  if (posts.length === 0) return (
    <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
      <BookOpen size={32} style={{ color: 'var(--color-text-tertiary)', marginBottom: '8px' }} />
      <p style={{ margin: 0 }}>No advice posts yet.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {posts.map((post) => (
        <Link key={post.id} href={`/advice/${post.id}`} style={{ textDecoration: 'none' }}>
          <div style={{ padding: 'var(--space-sm) var(--space-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-primary)', transition: 'box-shadow 0.15s' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 10px rgba(0,0,0,0.06)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = 'none')}
          >
            <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>{post.title}</p>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-advisor)' }}>{post.subject}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                <Eye size={12} /> {post.views ?? 0}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function ReviewsTab({ uid }: { uid: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, 'reviews'), where('sellerId', '==', uid), orderBy('createdAt', 'desc'), limit(20)))
      .then((snap) => setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Review))      )
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, [uid]);

  const avg = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  if (loading) return (
    <div className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ height: '80px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)' }} />
      ))}
    </div>
  );

  return (
    <div>
      {reviews.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-base)', padding: 'var(--space-base)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>{avg.toFixed(1)}</span>
          <div>
            <StarRow rating={avg} />
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <p style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-secondary)', fontSize: '14px' }}>No reviews yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {reviews.map((r) => (
            <div key={r.id} style={{ padding: 'var(--space-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <StarRow rating={r.rating} />
                <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                  {r.createdAt ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : ''}
                </span>
              </div>
              {r.comment && <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AboutTab({ user }: { user: User }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-base)' }}>
      {user.bio ? (
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>{user.bio}</p>
      ) : (
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>No bio added yet.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {user.phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Phone size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{user.phone}</span>
          </div>
        )}
        {user.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{user.location.city}, {user.location.country}</span>
          </div>
        )}
        {user.role === 'seller' && user.brand && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Brand:</span>
            <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{user.brand}</span>
          </div>
        )}
        {user.role === 'advisor' && user.specialty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Specialty:</span>
            <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{user.specialty}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SavedTab({ uid }: { uid: string }) {
  const [saved,   setSaved]   = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, 'users', uid, 'savedItems'), orderBy('savedAt', 'desc'), limit(20)))
      .then(async (snap) => {
        const productIds = snap.docs.map((d) => d.id);
        if (productIds.length === 0) { setSaved([]); return; }
        const products = await Promise.all(
          productIds.map((id) =>
            getDocs(query(collection(db, 'products'), where('__name__', '==', id), limit(1)))
              .then((s) => s.docs[0] ? ({ id: s.docs[0].id, ...s.docs[0].data() } as Product) : null)
          )
        );
        setSaved(products.filter((p): p is Product => p !== null));
      })
      .catch(() => setSaved([]))
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse" style={{ borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)', aspectRatio: '1' }} />
      ))}
    </div>
  );

  if (saved.length === 0) return (
    <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
      <Bookmark size={32} style={{ color: 'var(--color-text-tertiary)', marginBottom: '8px' }} />
      <p style={{ margin: 0 }}>No saved items yet — browse and bookmark products.</p>
      <Link href="/search" style={{ marginTop: '12px', display: 'inline-block', color: 'var(--color-primary)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>Browse Products →</Link>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
      {saved.map((p) => (
        <Link key={p.id} href={`/products/${p.id}`} style={{ textDecoration: 'none' }}>
          <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}>
            {p.images?.[0]?.url
              ? <img src={p.images[0].url} alt={p.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: '100%', aspectRatio: '1', backgroundColor: 'var(--color-bg-secondary)' }} />
            }
            <div style={{ padding: '6px 8px' }}>
              <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>{p.currency} {p.price.toLocaleString()}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// ProfilePage
// ─────────────────────────────────────────────

export default function ProfilePage() {
  const { user: storeUser, setUser } = useAuthStore();
  const [localUser, setLocalUser]    = useState<User | null>(null);
  const [editOpen,  setEditOpen]     = useState(false);
  const [activeTab, setActiveTab]    = useState(0);

  useEffect(() => {
    if (storeUser) setLocalUser(storeUser);
  }, [storeUser]);

  const user = localUser ?? storeUser;

  if (!user) return null;

  const roleColor = `var(--color-${user.role})`;

  const TABS = user.role === 'seller'
    ? ['My Products', 'About', 'Reviews']
    : user.role === 'advisor'
      ? ['My Advice', 'About']
      : ['About', 'Saved Items'];

  const LayoutComponent =
    user.role === 'seller'  ? SellerLayout  :
    user.role === 'advisor' ? AdvisorLayout :
    BuyerLayout;

  function handleSaved(updated: Partial<User>) {
    const merged = { ...user, ...updated } as User;
    setLocalUser(merged);
    setUser(merged);
  }

  const initials = user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <LayoutComponent>
      <div style={{ maxWidth: '860px', margin: '0 auto', paddingBottom: 'var(--space-section)' }}>

        {/* ── Cover + Avatar header ─────────────── */}
        <div style={{ position: 'relative', marginBottom: 'calc(44px + var(--space-base))' }}>
          {/* Cover */}
          <div
            style={{
              height:          '180px',
              backgroundColor: `color-mix(in srgb, ${roleColor} 15%, var(--color-bg-secondary))`,
              backgroundImage: user.coverPhoto ? `url(${user.coverPhoto})` : undefined,
              backgroundSize:  'cover',
              backgroundPosition: 'center',
            }}
          />

          {/* Avatar — overlaps cover */}
          <div
            style={{
              position:      'absolute',
              bottom:        '-44px',
              left:          'var(--space-6)',
              width:         '88px',
              height:        '88px',
              borderRadius:  '50%',
              border:        '3px solid var(--color-bg-primary)',
              overflow:      'hidden',
              backgroundColor: roleColor,
              display:       'flex',
              alignItems:    'center',
              justifyContent:'center',
              boxShadow:     '0 2px 12px rgba(0,0,0,0.12)',
            }}
          >
            {user.profilePhoto
              ? <img src={user.profilePhoto} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-display)' }}>{initials}</span>
            }
          </div>

          {/* Edit button */}
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            style={{
              position:        'absolute',
              bottom:          'calc(-44px + var(--space-sm))',
              right:           'var(--space-6)',
              display:         'flex',
              alignItems:      'center',
              gap:             '6px',
              padding:         '8px 16px',
              borderRadius:    'var(--radius-md)',
              border:          '1.5px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-primary)',
              color:           'var(--color-text-primary)',
              fontWeight:      600,
              fontSize:        '13px',
              cursor:          'pointer',
              boxShadow:       '0 1px 4px rgba(0,0,0,0.08)',
            }}
          >
            <Edit2 size={14} />
            Edit Profile
          </button>
        </div>

        {/* ── Identity ─────────────────────────── */}
        <div style={{ padding: '0 var(--space-6) var(--space-base)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: '4px' }}>
            <h1 className="font-display font-bold" style={{ margin: 0, fontSize: 'clamp(1.25rem, 3vw, 1.5rem)', color: 'var(--color-text-primary)' }}>
              {user.name}
            </h1>
            <span style={{ padding: '2px 10px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize', backgroundColor: `color-mix(in srgb, ${roleColor} 12%, transparent)`, color: roleColor }}>
              {user.role}
            </span>
          </div>

          {user.role === 'seller' && user.brand && (
            <p style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>{user.brand}</p>
          )}
          {user.role === 'advisor' && user.specialty && (
            <p style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--color-advisor)' }}>{user.specialty}</p>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-base)', flexWrap: 'wrap', marginTop: '6px' }}>
            {user.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={13} style={{ color: 'var(--color-text-tertiary)' }} />
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{user.location.city}, {user.location.country}</span>
              </div>
            )}
            <span style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>
              Member since {memberSince(user.createdAt)}
            </span>
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────── */}
        <div style={{ borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-lg)', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <div style={{ display: 'flex', padding: '0 var(--space-6)' }}>
            {TABS.map((tab, i) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(i)}
                style={{
                  padding:        '12px 16px',
                  border:         'none',
                  backgroundColor:'transparent',
                  color:          i === activeTab ? roleColor : 'var(--color-text-secondary)',
                  fontWeight:     i === activeTab ? 600 : 400,
                  fontSize:       '14px',
                  cursor:         'pointer',
                  borderBottom:   `2px solid ${i === activeTab ? roleColor : 'transparent'}`,
                  whiteSpace:     'nowrap',
                  transition:     'color 0.15s ease',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ──────────────────────── */}
        <div style={{ padding: '0 var(--space-6)' }}>
          {user.role === 'seller' && (
            activeTab === 0 ? <ProductsTab uid={user.uid} /> :
            activeTab === 1 ? <AboutTab user={user} /> :
            <ReviewsTab uid={user.uid} />
          )}
          {user.role === 'advisor' && (
            activeTab === 0 ? <AdviceTab uid={user.uid} /> :
            <AboutTab user={user} />
          )}
          {user.role === 'buyer' && (
            activeTab === 0 ? <AboutTab user={user} /> :
            <SavedTab uid={user.uid} />
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editOpen && (
        <EditProfileModal
          user={user}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </LayoutComponent>
  );
}
