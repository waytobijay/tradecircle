/**
 * app/products/[id]/page.tsx
 * Product detail page.
 * Spec ref: section 6.2 (Product Detail Page)
 *
 * Layout:
 *   Top: image gallery (primary + thumbnail strip) | right panel (name, price, seller, CTA)
 *   Below fold: similar products grid | more from this seller grid
 *
 * Features:
 *   - Image gallery with selected index; video slide support
 *   - Slide-in Contact Seller panel (React Hook Form + Zod)
 *   - Add to Cart (cartStore)
 *   - Sticky CTA bar on mobile
 *   - Description expand/collapse (> 300 chars)
 *   - Skeleton loader + 404 state
 */

'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  MapPin,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  MessageCircle,
  X,
  CheckCircle,
  Play,
  Star,
} from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db }            from '@/services/firebase';
import { useAuthStore }  from '@/store/authStore';
import { useCartStore }  from '@/store/cartStore';
import { BuyerLayout }   from '@/components/layouts/BuyerLayout';
import { SellerLayout }  from '@/components/layouts/SellerLayout';
import { AdvisorLayout } from '@/components/layouts/AdvisorLayout';
import { PublicLayout }  from '@/components/layouts/PublicLayout';
import type { Product, User } from '@/types';
import ReviewSection from '@/components/reviews/ReviewSection';

// ─────────────────────────────────────────────
// Zod schema — Contact Seller form
// ─────────────────────────────────────────────

const contactSchema = z.object({
  name:    z.string().min(2, 'Name is required'),
  email:   z.string().email('Valid email required'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(1000),
});
type ContactForm = z.infer<typeof contactSchema>;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function memberSince(ts: Timestamp | undefined): string {
  if (!ts) return '';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-AU', {
    month: 'long', year: 'numeric',
  });
}

function conditionColor(condition: string): { bg: string; text: string } {
  if (condition === 'new')         return { bg: 'color-mix(in srgb, var(--color-success) 12%, transparent)', text: 'var(--color-success)' };
  if (condition === 'refurbished') return { bg: 'color-mix(in srgb, var(--color-warning) 12%, transparent)', text: 'var(--color-warning)' };
  return { bg: 'var(--color-bg-secondary)', text: 'var(--color-text-secondary)' };
}

// ─────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────

interface ProductDetailResult {
  product: Product | null;
  loading: boolean;
  notFound: boolean;
}

function useProduct(id: string): ProductDetailResult {
  const [product,  setProduct]  = useState<Product | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'products', id))
      .then((snap) => {
        if (!snap.exists()) { setNotFound(true); return; }
        setProduct({ id: snap.id, ...snap.data() } as Product);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  return { product, loading, notFound };
}

function useSeller(sellerId: string | undefined): User | null {
  const [seller, setSeller] = useState<User | null>(null);
  useEffect(() => {
    if (!sellerId) return;
    getDoc(doc(db, 'users', sellerId))
      .then((snap) => { if (snap.exists()) setSeller({ uid: snap.id, ...snap.data() } as User); })
      .catch(() => {/* leave null */});
  }, [sellerId]);
  return seller;
}

function useSimilarProducts(category: string, currentId: string): Product[] {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    if (!category) return;
    getDocs(
      query(
        collection(db, 'products'),
        where('active',   '==', true),
        where('category', '==', category),
        orderBy('createdAt', 'desc'),
        limit(5),
      ),
    )
      .then((snap) => {
        setProducts(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Product)
            .filter((p) => p.id !== currentId)
            .slice(0, 4),
        );
      })
      .catch(() => {/* leave empty */});
  }, [category, currentId]);
  return products;
}

function useMoreFromSeller(sellerId: string | undefined, currentId: string): Product[] {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    if (!sellerId) return;
    getDocs(
      query(
        collection(db, 'products'),
        where('active',   '==', true),
        where('sellerId', '==', sellerId),
        orderBy('createdAt', 'desc'),
        limit(5),
      ),
    )
      .then((snap) => {
        setProducts(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Product)
            .filter((p) => p.id !== currentId)
            .slice(0, 4),
        );
      })
      .catch(() => {/* leave empty */});
  }, [sellerId, currentId]);
  return products;
}

// ─────────────────────────────────────────────
// Image Gallery
// ─────────────────────────────────────────────

interface GalleryImage {
  url:   string;
  isVideo?: boolean;
}

function ImageGallery({ images }: { images: GalleryImage[] }) {
  const [selected, setSelected] = useState(0);
  const total = images.length;

  function prev() { setSelected((i) => (i === 0 ? total - 1 : i - 1)); }
  function next() { setSelected((i) => (i === total - 1 ? 0 : i + 1)); }

  const current = images[selected];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      {/* Primary image */}
      <div
        style={{
          position:        'relative',
          borderRadius:    'var(--radius-lg)',
          overflow:        'hidden',
          backgroundColor: 'var(--color-bg-secondary)',
          aspectRatio:     '4/3',
        }}
      >
        {current?.isVideo ? (
          <video
            src={current.url}
            controls
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <img
            src={current?.url}
            alt={`Product image ${selected + 1}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}

        {/* Prev / next arrows */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous image"
              style={{
                position:        'absolute',
                left:            'var(--space-sm)',
                top:             '50%',
                transform:       'translateY(-50%)',
                width:           '36px',
                height:          '36px',
                borderRadius:    '50%',
                backgroundColor: 'rgba(0,0,0,0.45)',
                color:           '#ffffff',
                border:          'none',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                cursor:          'pointer',
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next image"
              style={{
                position:        'absolute',
                right:           'var(--space-sm)',
                top:             '50%',
                transform:       'translateY(-50%)',
                width:           '36px',
                height:          '36px',
                borderRadius:    '50%',
                backgroundColor: 'rgba(0,0,0,0.45)',
                color:           '#ffffff',
                border:          'none',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                cursor:          'pointer',
              }}
            >
              <ChevronRight size={18} />
            </button>

            {/* Dot indicators */}
            <div
              style={{
                position:       'absolute',
                bottom:         'var(--space-sm)',
                left:           '50%',
                transform:      'translateX(-50%)',
                display:        'flex',
                gap:            '6px',
              }}
            >
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-label={`Go to image ${i + 1}`}
                  style={{
                    width:           i === selected ? '20px' : '8px',
                    height:          '8px',
                    borderRadius:    '4px',
                    backgroundColor: i === selected ? '#ffffff' : 'rgba(255,255,255,0.5)',
                    border:          'none',
                    cursor:          'pointer',
                    padding:         0,
                    transition:      'width 0.2s ease, background-color 0.2s ease',
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {total > 1 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={`View image ${i + 1}`}
              style={{
                flexShrink:      0,
                width:           '68px',
                height:          '68px',
                borderRadius:    'var(--radius-md)',
                overflow:        'hidden',
                border:          `2px solid ${i === selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                cursor:          'pointer',
                padding:         0,
                backgroundColor: 'var(--color-bg-secondary)',
                position:        'relative',
              }}
            >
              {img.isVideo ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-tertiary)' }}>
                  <Play size={20} style={{ color: 'var(--color-text-secondary)' }} />
                </div>
              ) : (
                <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Contact Seller Panel (slide-in)
// ─────────────────────────────────────────────

function ContactPanel({
  open,
  onClose,
  seller,
  product,
}: {
  open:    boolean;
  onClose: () => void;
  seller:  User | null;
  product: Product;
}) {
  const { user }   = useAuthStore();
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name:    user?.name  ?? '',
      email:   user?.email ?? '',
      message: '',
    },
  });

  // Reset on close
  useEffect(() => {
    if (!open) { setSent(false); reset(); }
  }, [open, reset]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  async function onSubmit(data: ContactForm) {
    try {
      // Create / find conversation between buyer and seller
      const convoId = [user?.uid ?? 'guest', product.sellerId].sort().join('_');

      await addDoc(collection(db, 'messages', convoId, 'items'), {
        senderId:    user?.uid ?? null,
        senderName:  data.name,
        senderEmail: data.email,
        text:        `Re: ${product.name}\n\n${data.message}`,
        productId:   product.id,
        productName: product.name,
        timestamp:   serverTimestamp(),
        read:        false,
      });

      setSent(true);
    } catch {
      // surface error inline
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

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          aria-hidden="true"
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 49, backgroundColor: 'rgba(0,0,0,0.4)' }}
        />
      )}

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Contact Seller"
        style={{
          position:        'fixed',
          top:             0,
          right:           0,
          bottom:          0,
          zIndex:          50,
          width:           'min(440px, 100vw)',
          backgroundColor: 'var(--color-bg-primary)',
          borderLeft:      '1px solid var(--color-border)',
          boxShadow:       '-8px 0 32px rgba(0,0,0,0.10)',
          transform:       open ? 'translateX(0)' : 'translateX(100%)',
          transition:      'transform 0.3s ease',
          display:         'flex',
          flexDirection:   'column',
          overflow:        'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display:      'flex',
            alignItems:   'center',
            justifyContent:'space-between',
            padding:      'var(--space-base) var(--space-lg)',
            borderBottom: '1px solid var(--color-border)',
            flexShrink:   0,
          }}
        >
          <h2
            className="font-display font-semibold"
            style={{ margin: 0, fontSize: '16px', color: 'var(--color-text-primary)' }}
          >
            Contact Seller
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px', display: 'flex' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-lg)' }}>
          {sent ? (
            /* Success state */
            <div style={{ textAlign: 'center', paddingTop: 'var(--space-xl)' }}>
              <CheckCircle
                size={48}
                style={{ color: 'var(--color-success)', marginBottom: 'var(--space-base)' }}
              />
              <h3
                className="font-display font-semibold"
                style={{ margin: '0 0 var(--space-xs)', fontSize: '18px', color: 'var(--color-text-primary)' }}
              >
                Message Sent!
              </h3>
              <p style={{ margin: '0 0 var(--space-lg)', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                {seller?.name ?? 'The seller'} will receive your message shortly.
              </p>
              {user && (
                <Link
                  href="/messages"
                  onClick={onClose}
                  style={{
                    display:         'inline-flex',
                    alignItems:      'center',
                    gap:             '6px',
                    padding:         '10px 20px',
                    borderRadius:    'var(--radius-md)',
                    backgroundColor: 'var(--color-primary)',
                    color:           '#ffffff',
                    fontWeight:      600,
                    fontSize:        '14px',
                    textDecoration:  'none',
                  }}
                >
                  View in Messages
                </Link>
              )}
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-base)' }}>
              {/* Product reference */}
              <div
                style={{
                  display:         'flex',
                  gap:             'var(--space-sm)',
                  alignItems:      'center',
                  padding:         'var(--space-sm)',
                  borderRadius:    'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  marginBottom:    'var(--space-xs)',
                }}
              >
                {product.images?.[0]?.url && (
                  <img
                    src={product.images[0].url}
                    alt={product.name}
                    style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }}
                  />
                )}
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                    {product.name}
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-primary)', fontWeight: 600 }}>
                    {product.currency} {product.price.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Name */}
              <div>
                <label htmlFor="cp-name" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                  Your Name *
                </label>
                <input id="cp-name" type="text" {...register('name')} style={inputStyle} />
                {errors.name && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-danger)' }}>{errors.name.message}</p>}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="cp-email" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                  Email *
                </label>
                <input id="cp-email" type="email" {...register('email')} style={inputStyle} />
                {errors.email && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-danger)' }}>{errors.email.message}</p>}
              </div>

              {/* Message */}
              <div>
                <label htmlFor="cp-message" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                  Message *
                </label>
                <textarea
                  id="cp-message"
                  rows={5}
                  {...register('message')}
                  placeholder={`Hi${seller?.name ? ` ${seller.name}` : ''}, I'm interested in this product…`}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '120px' }}
                />
                {errors.message && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-danger)' }}>{errors.message.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding:         '12px',
                  borderRadius:    'var(--radius-md)',
                  backgroundColor: isSubmitting ? 'var(--color-bg-secondary)' : 'var(--color-primary)',
                  color:           isSubmitting ? 'var(--color-text-tertiary)' : '#ffffff',
                  fontWeight:      600,
                  fontSize:        '14px',
                  border:          'none',
                  cursor:          isSubmitting ? 'not-allowed' : 'pointer',
                  transition:      'background-color 0.15s ease',
                }}
              >
                {isSubmitting ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Mini Product Card (for below-fold grids)
// ─────────────────────────────────────────────

function MiniProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/products/${product.id}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          borderRadius:    'var(--radius-lg)',
          border:          '1px solid var(--color-border)',
          overflow:        'hidden',
          backgroundColor: 'var(--color-bg-primary)',
          transition:      'box-shadow 0.15s ease, transform 0.15s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform  = 'translateY(-2px)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform  = 'translateY(0)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        }}
      >
        {product.images?.[0]?.url ? (
          <img
            src={product.images[0].url}
            alt={product.name}
            style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', aspectRatio: '4/3', backgroundColor: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingCart size={24} style={{ color: 'var(--color-text-tertiary)' }} />
          </div>
        )}
        <div style={{ padding: 'var(--space-sm)' }}>
          <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {product.name}
          </p>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)' }}>
            {product.currency} {product.price.toLocaleString()}
          </p>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div
      className="animate-pulse"
      style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6)' }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-xl)' }} className="desktop:grid-cols-[1fr_400px]">
        <div>
          <div style={{ borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-bg-secondary)', aspectRatio: '4/3', width: '100%' }} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ width: '68px', height: '68px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)', flexShrink: 0 }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-base)' }}>
          <div style={{ height: '28px', borderRadius: '6px', backgroundColor: 'var(--color-bg-secondary)', width: '80%' }} />
          <div style={{ height: '36px', borderRadius: '6px', backgroundColor: 'var(--color-bg-secondary)', width: '40%' }} />
          <div style={{ height: '80px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)' }} />
          <div style={{ height: '120px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)' }} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Product Detail Page inner
// ─────────────────────────────────────────────

function ProductDetailInner() {
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const id           = typeof params.id === 'string' ? params.id : '';
  const orderId      = searchParams.get('orderId') ?? undefined;
  const { user }     = useAuthStore();
  const addToCart    = useCartStore((s) => s.addItem);

  const { product, loading, notFound } = useProduct(id);
  const seller   = useSeller(product?.sellerId);
  const similar  = useSimilarProducts(product?.category ?? '', id);
  const moreSeller = useMoreFromSeller(product?.sellerId, id);

  const [panelOpen,   setPanelOpen]   = useState(false);
  const [expanded,    setExpanded]    = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  function handleAddToCart() {
    if (!product) return;
    addToCart({
      id:       product.id,
      name:     product.name,
      price:    product.price,
      currency: product.currency,
      imageUrl: product.images?.[0]?.url,
      sellerId: product.sellerId,
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2500);
  }

  const LayoutComponent =
    !user                   ? PublicLayout  :
    user.role === 'seller'  ? SellerLayout  :
    user.role === 'advisor' ? AdvisorLayout :
    BuyerLayout;

  if (loading) {
    return <LayoutComponent><PageSkeleton /></LayoutComponent>;
  }

  if (notFound || !product) {
    return (
      <LayoutComponent>
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: 'var(--space-section) var(--space-6)', textAlign: 'center' }}>
          <ShoppingCart size={48} style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-base)' }} />
          <h1 className="font-display font-bold" style={{ fontSize: '24px', color: 'var(--color-text-primary)', margin: '0 0 var(--space-sm)' }}>
            Product Not Found
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
            This listing may have been removed or is no longer available.
          </p>
          <button
            type="button"
            onClick={() => router.push('/search')}
            style={{
              padding: '10px 24px', borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-primary)', color: '#ffffff',
              border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}
          >
            Browse Products
          </button>
        </div>
      </LayoutComponent>
    );
  }

  const images: GalleryImage[] = (product.images ?? []).map((img) => ({
    url:     img.url,
    isVideo: img.url.endsWith('.mp4') || img.url.endsWith('.webm'),
  }));

  const cond    = conditionColor(product.condition);
  const descLong = (product.description?.length ?? 0) > 300;

  return (
    <LayoutComponent>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-base) var(--space-6) var(--space-section)' }}>

        {/* ── Main layout ────────────────────── */}
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-xl)', alignItems: 'start' }}
          className="desktop:grid-cols-[1fr_400px]"
        >
          {/* Left — gallery */}
          {images.length > 0 ? (
            <ImageGallery images={images} />
          ) : (
            <div style={{ borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-bg-secondary)', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={48} style={{ color: 'var(--color-text-tertiary)' }} />
            </div>
          )}

          {/* Right — details panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-base)' }}>

            {/* Badges */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize', backgroundColor: cond.bg, color: cond.text }}>
                {product.condition}
              </span>
              <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 500, backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
                {product.category}
              </span>
            </div>

            {/* Name */}
            <h1
              className="font-display font-bold"
              style={{ margin: 0, fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', color: 'var(--color-text-primary)', lineHeight: 1.2 }}
            >
              {product.name}
            </h1>

            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>
                {product.currency} {product.price.toLocaleString()}
              </span>
              {product.negotiable && (
                <span style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>negotiable</span>
              )}
            </div>

            {/* Location + product code */}
            <div style={{ display: 'flex', gap: 'var(--space-base)', flexWrap: 'wrap', alignItems: 'center' }}>
              {product.location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={13} style={{ color: 'var(--color-text-tertiary)' }} />
                  <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    {product.location.city}, {product.location.country}
                  </span>
                </div>
              )}
              {product.productCode && (
                <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                  SKU: <code style={{ fontFamily: 'var(--font-mono)' }}>{product.productCode}</code>
                </span>
              )}
            </div>

            {/* Seller card */}
            {seller && (
              <div
                style={{
                  padding:         'var(--space-base)',
                  borderRadius:    'var(--radius-lg)',
                  border:          '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  display:         'flex',
                  alignItems:      'center',
                  gap:             'var(--space-sm)',
                }}
              >
                {seller.profilePhoto ? (
                  <img src={seller.profilePhoto} alt={seller.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: 'var(--color-seller)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                    {seller.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                    {seller.name}
                  </p>
                  {seller.createdAt && (
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                      Member since {memberSince(seller.createdAt)}
                    </p>
                  )}
                </div>
                <Link
                  href={`/profile/${seller.uid}`}
                  style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  View Profile
                </Link>
              </div>
            )}

            {/* Description */}
            <div>
              <p
                style={{
                  margin:   0,
                  fontSize: '14px',
                  lineHeight: 1.7,
                  color:    'var(--color-text-secondary)',
                  overflow:       expanded ? 'visible' : 'hidden',
                  display:        expanded ? 'block' : '-webkit-box',
                  WebkitLineClamp: expanded ? undefined : 4,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {product.description}
              </p>
              {descLong && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  style={{ marginTop: '6px', background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>

            {/* CTA buttons — hidden on mobile (sticky bar used instead) */}
            <div className="hidden tablet:flex" style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
              <button
                type="button"
                onClick={handleAddToCart}
                style={{
                  flex:            1,
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  gap:             '8px',
                  padding:         '13px',
                  borderRadius:    'var(--radius-md)',
                  backgroundColor: addedToCart ? 'var(--color-success)' : 'var(--color-primary)',
                  color:           '#ffffff',
                  fontWeight:      600,
                  fontSize:        '14px',
                  border:          'none',
                  cursor:          'pointer',
                  transition:      'background-color 0.25s ease',
                }}
              >
                <ShoppingCart size={16} />
                {addedToCart ? 'Added!' : 'Add to Cart'}
              </button>
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                style={{
                  flex:            1,
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  gap:             '8px',
                  padding:         '13px',
                  borderRadius:    'var(--radius-md)',
                  backgroundColor: 'transparent',
                  color:           'var(--color-text-primary)',
                  border:          '1.5px solid var(--color-border)',
                  fontWeight:      600,
                  fontSize:        '14px',
                  cursor:          'pointer',
                }}
              >
                <MessageCircle size={16} />
                Contact Seller
              </button>
            </div>
          </div>
        </div>

        {/* ── Below fold ───────────────────────── */}

        {/* Similar products */}
        {similar.length > 0 && (
          <section style={{ marginTop: 'var(--space-section)' }}>
            <h2 className="font-display font-semibold" style={{ margin: '0 0 var(--space-base)', fontSize: '18px', color: 'var(--color-text-primary)' }}>
              Similar Products
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-base)' }} className="tablet:grid-cols-4">
              {similar.map((p) => <MiniProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}

        {/* More from this seller */}
        {moreSeller.length > 0 && (
          <section style={{ marginTop: 'var(--space-xl)' }}>
            <h2 className="font-display font-semibold" style={{ margin: '0 0 var(--space-base)', fontSize: '18px', color: 'var(--color-text-primary)' }}>
              More from {seller?.name ?? 'this seller'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-base)' }} className="tablet:grid-cols-4">
              {moreSeller.map((p) => <MiniProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}

        {/* Reviews section */}
        <ReviewSection sellerId={product.sellerId} orderId={orderId} />
      </div>

      {/* ── Mobile sticky CTA bar ──────────────── */}
      <div
        className="tablet:hidden"
        style={{
          position:        'fixed',
          bottom:          '56px', // above mobile nav
          left:            0,
          right:           0,
          zIndex:          35,
          display:         'flex',
          gap:             'var(--space-sm)',
          padding:         'var(--space-sm) var(--space-base)',
          backgroundColor: 'var(--color-bg-primary)',
          borderTop:       '1px solid var(--color-border)',
          boxShadow:       '0 -4px 16px rgba(0,0,0,0.06)',
        }}
      >
        <button
          type="button"
          onClick={handleAddToCart}
          style={{
            flex:            1,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            gap:             '8px',
            padding:         '12px',
            borderRadius:    'var(--radius-md)',
            backgroundColor: addedToCart ? 'var(--color-success)' : 'var(--color-primary)',
            color:           '#ffffff',
            fontWeight:      600,
            fontSize:        '14px',
            border:          'none',
            cursor:          'pointer',
            transition:      'background-color 0.25s ease',
          }}
        >
          <ShoppingCart size={16} />
          {addedToCart ? 'Added!' : 'Add to Cart'}
        </button>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          style={{
            flex:            1,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            gap:             '8px',
            padding:         '12px',
            borderRadius:    'var(--radius-md)',
            backgroundColor: 'transparent',
            color:           'var(--color-text-primary)',
            border:          '1.5px solid var(--color-border)',
            fontWeight:      600,
            fontSize:        '14px',
            cursor:          'pointer',
          }}
        >
          <MessageCircle size={16} />
          Contact
        </button>
      </div>

      {/* Contact Seller panel */}
      <ContactPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        seller={seller}
        product={product}
      />
    </LayoutComponent>
  );
}

// ─────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────

export default function ProductDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen animate-pulse" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6)' }}>
          <div style={{ height: '400px', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-bg-secondary)' }} />
        </div>
      </div>
    }>
      <ProductDetailInner />
    </Suspense>
  );
}
