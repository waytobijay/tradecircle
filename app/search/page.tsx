/**
 * app/search/page.tsx
 * Product search with sidebar filters, infinite scroll, URL-synced state.
 * Spec ref: section 6.1 (Product Search)
 *
 * Query strategy:
 *  Firestore: where active==true + optional category + optional condition
 *             + orderBy(sort field) + limit(PAGE_SIZE) + startAfter cursor
 *  Client:    text query, price range, product code, location city — avoids
 *             extra composite indexes for every filter combination.
 *
 * Required Firestore composite indexes:
 *  products: active ASC + createdAt DESC
 *  products: active ASC + price ASC
 *  products: active ASC + price DESC
 *  products: active ASC + views DESC
 *  products: active ASC + category ASC + createdAt DESC  (+ condition variants)
 */

'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import Link                    from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  deleteDoc,
  startAfter,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import {
  Filter,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import { db }             from '@/services/firebase';
import { useAuthStore }   from '@/store/authStore';
import { ProductCard }    from '@/components/ProductCard';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { Button }         from '@/components/ui/Button';
import PublicLayout       from '@/components/layouts/PublicLayout';
import type { Product, ProductCondition } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortOption      = 'newest' | 'price_asc' | 'price_desc' | 'most_viewed';
type ConditionFilter = 'all' | ProductCondition;
type PostedByFilter  = 'all' | 'friends' | 'following';

interface Filters {
  query:       string;
  category:    string;
  location:    string;
  minPrice:    number;
  maxPrice:    number;
  condition:   ConditionFilter;
  productCode: string;
  postedBy:    PostedByFilter;
  sort:        SortOption;
}

interface SellerInfo { name: string; avatar?: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;
const MAX_PRICE = 50000;

const DEFAULT_FILTERS: Filters = {
  query: '', category: '', location: '',
  minPrice: 0, maxPrice: MAX_PRICE,
  condition: 'all', productCode: '', postedBy: 'all', sort: 'newest',
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest',      label: 'Newest'           },
  { value: 'price_asc',   label: 'Price: Low → High' },
  { value: 'price_desc',  label: 'Price: High → Low' },
  { value: 'most_viewed', label: 'Most Viewed'       },
];

const CONDITIONS: { value: ConditionFilter; label: string }[] = [
  { value: 'all',         label: 'All'         },
  { value: 'new',         label: 'New'         },
  { value: 'used',        label: 'Used'        },
  { value: 'refurbished', label: 'Refurbished' },
];

const POSTED_BY: { value: PostedByFilter; label: string }[] = [
  { value: 'all',       label: 'All Sellers'   },
  { value: 'friends',   label: 'Friends'       },
  { value: 'following', label: 'Sellers I Follow' },
];

const DEFAULT_CATEGORIES = [
  'Electronics', 'Clothing', 'Furniture', 'Vehicles',
  'Books', 'Sports', 'Garden', 'Toys', 'Food', 'Other',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function filtersFromParams(params: ReturnType<typeof useSearchParams>): Filters {
  return {
    query:       params.get('q')    ?? '',
    category:    params.get('cat')  ?? '',
    location:    params.get('loc')  ?? '',
    minPrice:    Number(params.get('minP'))  || 0,
    maxPrice:    Number(params.get('maxP'))  || MAX_PRICE,
    condition:   (params.get('cond')  ?? 'all')    as ConditionFilter,
    productCode: params.get('code') ?? '',
    postedBy:    (params.get('by')    ?? 'all')    as PostedByFilter,
    sort:        (params.get('sort')  ?? 'newest') as SortOption,
  };
}

function filtersToSearch(f: Filters): string {
  const p = new URLSearchParams();
  if (f.query)                          p.set('q',    f.query);
  if (f.category)                       p.set('cat',  f.category);
  if (f.location)                       p.set('loc',  f.location);
  if (f.minPrice > 0)                   p.set('minP', String(f.minPrice));
  if (f.maxPrice < MAX_PRICE)           p.set('maxP', String(f.maxPrice));
  if (f.condition !== 'all')            p.set('cond', f.condition);
  if (f.productCode)                    p.set('code', f.productCode);
  if (f.postedBy   !== 'all')           p.set('by',   f.postedBy);
  if (f.sort       !== 'newest')        p.set('sort', f.sort);
  const s = p.toString();
  return s ? `?${s}` : '';
}

function clientFilter(products: Product[], f: Filters): Product[] {
  const q   = f.query.toLowerCase();
  const loc = f.location.toLowerCase();
  const cod = f.productCode.toLowerCase();
  return products.filter((p) => {
    if (q   && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
    if (f.minPrice > 0          && p.price < f.minPrice)    return false;
    if (f.maxPrice < MAX_PRICE  && p.price > f.maxPrice)    return false;
    if (cod && !p.productCode?.toLowerCase().includes(cod)) return false;
    if (loc && !p.location.city.toLowerCase().includes(loc))return false;
    return true;
  });
}

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
}

// ─── Skeleton grid ────────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
          <SkeletonLoader variant="image" height={200} borderRadius={0} />
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SkeletonLoader variant="text" width="80%" />
            <SkeletonLoader variant="text" width="40%" height={20} />
            <SkeletonLoader variant="text" width="60%" height={12} />
            <SkeletonLoader variant="text" width="50%" height={12} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <SkeletonLoader height={32} style={{ flex: 1 }} />
              <SkeletonLoader height={32} style={{ flex: 1 }} />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

interface FilterPanelProps {
  local:         Filters;
  categories:    string[];
  geolocating:   boolean;
  onChange:      (patch: Partial<Filters>) => void;
  onApply:       () => void;
  onClear:       () => void;
  onUseLocation: () => void;
}

function FilterPanel({
  local, categories, geolocating,
  onChange, onApply, onClear, onUseLocation,
}: FilterPanelProps) {
  const inputStyle: React.CSSProperties = {
    width: '100%', height: 38, padding: '0 10px',
    borderRadius: 8, border: '1px solid var(--color-border)',
    background: 'var(--color-background)', color: 'var(--color-text)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block',
  };
  const sectionStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 6,
    paddingBottom: 16, borderBottom: '1px solid var(--color-border)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Search text */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Search</label>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--color-text-secondary)' }} />
          <input
            value={local.query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder="Product name or keyword…"
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
      </div>

      {/* Category */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Category</label>
        <select
          value={local.category}
          onChange={(e) => onChange({ category: e.target.value })}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Location */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Location</label>
        <div style={{ position: 'relative' }}>
          <MapPin size={14} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--color-text-secondary)' }} />
          <input
            value={local.location}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="City or suburb…"
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
        <button
          onClick={onUseLocation}
          disabled={geolocating}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: '1px solid var(--color-border)',
            borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
            fontSize: 12, color: 'var(--color-primary)', fontWeight: 500,
            opacity: geolocating ? 0.6 : 1,
          }}
        >
          <MapPin size={12} />
          {geolocating ? 'Locating…' : 'Use My Location'}
        </button>
      </div>

      {/* Price range */}
      <div style={{ ...sectionStyle, gap: 12 }}>
        <label style={labelStyle}>Price Range</label>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
          <span>{fmtPrice(local.minPrice)}</span>
          <span>{local.maxPrice >= MAX_PRICE ? 'Any' : fmtPrice(local.maxPrice)}</span>
        </div>
        <Slider.Root
          min={0} max={MAX_PRICE} step={100}
          value={[local.minPrice, local.maxPrice]}
          onValueChange={(vals: number[]) => {
            const [mn, mx] = vals;
            if (mn !== undefined && mx !== undefined) onChange({ minPrice: mn, maxPrice: mx });
          }}
          style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', height: 20, touchAction: 'none', userSelect: 'none' }}
        >
          <Slider.Track style={{ background: 'var(--color-border)', position: 'relative', flexGrow: 1, height: 4, borderRadius: 2 }}>
            <Slider.Range style={{ position: 'absolute', background: 'var(--color-primary)', height: '100%', borderRadius: 2 }} />
          </Slider.Track>
          {[0, 1].map((i) => (
            <Slider.Thumb
              key={i}
              aria-label={i === 0 ? 'Minimum price' : 'Maximum price'}
              style={{
                display: 'block', width: 16, height: 16, borderRadius: '50%',
                background: 'var(--color-primary)', border: '2px solid var(--color-background)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)', cursor: 'pointer', outline: 'none',
              }}
            />
          ))}
        </Slider.Root>
      </div>

      {/* Condition */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Condition</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CONDITIONS.map((c) => (
            <label key={c.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="radio"
                name="condition"
                checked={local.condition === c.value}
                onChange={() => onChange({ condition: c.value })}
                style={{ accentColor: 'var(--color-primary)' }}
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      {/* Product Code */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Product Code</label>
        <input
          value={local.productCode}
          onChange={(e) => onChange({ productCode: e.target.value })}
          placeholder="Exact code…"
          style={inputStyle}
        />
      </div>

      {/* Posted By */}
      <div style={{ ...sectionStyle, borderBottom: 'none' }}>
        <label style={labelStyle}>Posted By</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {POSTED_BY.map((p) => (
            <label key={p.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="radio"
                name="postedBy"
                checked={local.postedBy === p.value}
                onChange={() => onChange({ postedBy: p.value })}
                style={{ accentColor: 'var(--color-primary)' }}
              />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="primary"  size="sm" onClick={onApply} style={{ flex: 1 }}>Apply Filters</Button>
        <Button variant="ghost"    size="sm" onClick={onClear}>Clear All</Button>
      </div>
    </div>
  );
}

// ─── Main search component ────────────────────────────────────────────────────

function SearchPageInner() {
  const router      = useRouter();
  const params      = useSearchParams();
  const { user }    = useAuthStore();
  const uid         = user?.uid ?? '';

  // ── Filter state ────────────────────────────────────────────────────────────
  const [applied,      setApplied]     = useState<Filters>(() => filtersFromParams(params));
  const [local,        setLocal]       = useState<Filters>(() => filtersFromParams(params));
  const [drawerOpen,   setDrawerOpen]  = useState(false);
  const [geolocating,  setGeolocating] = useState(false);

  // ── Data state ─────────────────────────────────────────────────────────────
  const [products,    setProducts]    = useState<Product[]>([]);
  const [sellers,     setSellers]     = useState<Record<string, SellerInfo>>({});
  const [savedIds,    setSavedIds]    = useState<Set<string>>(new Set());
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [categories,  setCategories]  = useState<string[]>(DEFAULT_CATEGORIES);

  const cursorRef  = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load categories from config ─────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'site'));
        if (snap.exists()) {
          const cats = snap.data()?.categories as string[] | undefined;
          if (cats?.length) setCategories(cats);
        }
      } catch { /* use defaults */ }
    })();
  }, []);

  // ── Load saved IDs for authenticated user ───────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    void (async () => {
      try {
        const snap = await getDocs(collection(db, 'users', uid, 'savedProducts'));
        setSavedIds(new Set(snap.docs.map((d) => d.id)));
      } catch { /* ignore */ }
    })();
  }, [uid]);

  // ── Build + run Firestore query ─────────────────────────────────────────────
  const loadProducts = useCallback(async (filters: Filters, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);

    const sortMap: Record<SortOption, [string, 'asc' | 'desc']> = {
      newest:      ['createdAt', 'desc'],
      price_asc:   ['price',     'asc' ],
      price_desc:  ['price',     'desc'],
      most_viewed: ['views',     'desc'],
    };
    const [sortField, sortDir] = sortMap[filters.sort];

    try {
      // Build constraints
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const constraints: any[] = [where('active', '==', true)];
      if (filters.category)             constraints.push(where('category',  '==', filters.category));
      if (filters.condition !== 'all')  constraints.push(where('condition', '==', filters.condition));
      constraints.push(orderBy(sortField, sortDir));
      if (append && cursorRef.current)  constraints.push(startAfter(cursorRef.current));
      constraints.push(limit(PAGE_SIZE));

      const snap = await getDocs(query(collection(db, 'products'), ...constraints));

      // Update cursor
      if (snap.docs.length > 0) cursorRef.current = snap.docs[snap.docs.length - 1];
      setHasMore(snap.docs.length === PAGE_SIZE);

      const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
      const filtered = clientFilter(raw, filters);

      setProducts((prev) => append ? [...prev, ...filtered] : filtered);

      // Batch-fetch seller info for new products
      const newSellerIds = [...new Set(raw.map((p) => p.sellerId))];
      const missing = newSellerIds.filter((id) => !(id in sellers));
      if (missing.length) {
        const snaps = await Promise.all(missing.map((id) => getDoc(doc(db, 'users', id))));
        const updates: Record<string, SellerInfo> = {};
        snaps.forEach((s) => {
          if (s.exists()) {
            updates[s.id] = {
              name:   (s.data().name   as string) ?? 'Seller',
              avatar: (s.data().profilePhoto as string | undefined),
            };
          }
        });
        setSellers((prev) => ({ ...prev, ...updates }));
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sellers]);

  // ── Re-fetch when applied filters change ────────────────────────────────────
  useEffect(() => {
    cursorRef.current = null;
    void loadProducts(applied, false);
    router.replace(`/search${filtersToSearch(applied)}`, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  // ── Infinite scroll via IntersectionObserver ────────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) {
          void loadProducts(applied, true);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [applied, hasMore, loading, loadingMore, loadProducts]);

  // ── Debounced text search ────────────────────────────────────────────────────
  function handleQueryChange(value: string) {
    setLocal((f) => ({ ...f, query: value }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setApplied((f) => ({ ...f, query: value }));
    }, 400);
  }

  // ── Filter handlers ─────────────────────────────────────────────────────────
  function handleLocalChange(patch: Partial<Filters>) {
    // Intercept query changes for debounce
    if ('query' in patch && typeof patch.query === 'string') {
      handleQueryChange(patch.query);
    } else {
      setLocal((f) => ({ ...f, ...patch }));
    }
  }

  function handleApply() {
    setApplied(local);
    setDrawerOpen(false);
  }

  function handleClear() {
    setLocal(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
    setDrawerOpen(false);
  }

  async function handleUseLocation() {
    if (!navigator.geolocation) return;
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          // Nominatim reverse geocode (replace with paid API in production)
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
            headers: { 'Accept-Language': 'en' },
          });
          const data = await res.json() as { address?: { city?: string; town?: string; village?: string } };
          const city = data.address?.city ?? data.address?.town ?? data.address?.village ?? '';
          if (city) {
            setLocal((f)  => ({ ...f, location: city }));
          }
        } catch { /* ignore */ }
        setGeolocating(false);
      },
      () => setGeolocating(false),
    );
  }

  // ── Save / unsave ────────────────────────────────────────────────────────────
  async function handleSave(productId: string) {
    if (!uid) { router.push('/login'); return; }
    const isSaved = savedIds.has(productId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      isSaved ? next.delete(productId) : next.add(productId);
      return next;
    });
    const ref = doc(db, 'users', uid, 'savedProducts', productId);
    if (isSaved) await deleteDoc(ref);
    else         await setDoc(ref, { savedAt: new Date() });
  }

  // ── Contact seller ───────────────────────────────────────────────────────────
  function handleContact(product: Product) {
    if (!uid) { router.push('/login'); return; }
    router.push(`/messages?uid=${product.sellerId}`);
  }

  // ── Active filter count (for mobile badge) ──────────────────────────────────
  const activeFilterCount = [
    applied.category,
    applied.location,
    applied.productCode,
    applied.condition !== 'all',
    applied.postedBy  !== 'all',
    applied.minPrice  > 0,
    applied.maxPrice  < MAX_PRICE,
  ].filter(Boolean).length;

  // ─── Render ────────────────────────────────────────────────────────────────

  const filterPanelProps: FilterPanelProps = {
    local, categories, geolocating,
    onChange:      handleLocalChange,
    onApply:       handleApply,
    onClear:       handleClear,
    onUseLocation: handleUseLocation,
  };

  return (
    <PublicLayout>
      <style>{`
        @keyframes drawer-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (max-width: 767px)  { .search-sidebar { display: none !important; } .search-filter-btn { display: flex !important; } }
        @media (min-width: 768px)  { .search-sidebar { display: block !important;} .search-filter-btn { display: none !important; } }
        @media (max-width: 639px)  { .search-grid { grid-template-columns: 1fr !important; } }
        @media (min-width: 640px) and (max-width: 1023px) { .search-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (min-width: 1024px) { .search-grid { grid-template-columns: repeat(3, 1fr) !important; } }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>

        {/* ── Top bar: results info + sort + mobile filter button ─────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12, marginBottom: 20,
        }}>
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
            {loading ? 'Loading…' : (
              <>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{products.length}</span>
                {' results'}
                {applied.query && (
                  <> for <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>"{applied.query}"</span></>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Sort dropdown */}
            <div style={{ position: 'relative' }}>
              <select
                value={applied.sort}
                onChange={(e) => setApplied((f) => ({ ...f, sort: e.target.value as SortOption }))}
                style={{
                  padding: '7px 32px 7px 10px', borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-background)', color: 'var(--color-text)',
                  fontSize: 13, outline: 'none', cursor: 'pointer',
                  appearance: 'none',
                }}
              >
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-secondary)', fontSize: 10 }}>▼</span>
            </div>

            {/* Mobile filter button */}
            <button
              className="search-filter-btn"
              onClick={() => setDrawerOpen(true)}
              style={{
                display: 'none', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: activeFilterCount > 0 ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--color-background)',
                color: activeFilterCount > 0 ? 'var(--color-primary)' : 'var(--color-text)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}
            >
              <SlidersHorizontal size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span style={{
                  background: 'var(--color-primary)', color: '#fff',
                  borderRadius: '50%', width: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700,
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Main layout: sidebar + grid ─────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

          {/* Desktop sidebar */}
          <aside
            className="search-sidebar"
            style={{
              width: 260, flexShrink: 0,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12, padding: 16,
              position: 'sticky', top: 80,
              display: 'none', // overridden by media query
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Filter size={15} color="var(--color-primary)" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Filters</span>
              {activeFilterCount > 0 && (
                <span style={{
                  marginLeft: 'auto', fontSize: 11, color: 'var(--color-primary)',
                  cursor: 'pointer', fontWeight: 500,
                }} onClick={handleClear}>
                  Clear ({activeFilterCount})
                </span>
              )}
            </div>
            <FilterPanel {...filterPanelProps} />
          </aside>

          {/* Product grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="search-grid"
              style={{
                display: 'grid',
                gap: 16,
                gridTemplateColumns: 'repeat(3, 1fr)', // overridden by media queries
              }}
            >
              {loading
                ? <SkeletonGrid />
                : products.length === 0
                  ? null
                  : products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        sellerName={sellers[product.sellerId]?.name}
                        sellerAvatar={sellers[product.sellerId]?.avatar}
                        isSaved={savedIds.has(product.id)}
                        onSave={() => void handleSave(product.id)}
                        onContactSeller={() => handleContact(product)}
                      />
                    ))
              }
            </div>

            {/* Empty state */}
            {!loading && products.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '80px 24px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
              }}>
                <Search size={48} color="var(--color-border)" />
                <div>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-text)' }}>
                    No products found
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--color-text-secondary)' }}>
                    Try a different location, category, or keyword.
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleClear}>Clear all filters</Button>
              </div>
            )}

            {/* Load more skeleton */}
            {loadingMore && (
              <div className="search-grid" style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 16 }}>
                <SkeletonGrid />
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} style={{ height: 1, marginTop: 24 }} />

            {/* End of results */}
            {!loading && !hasMore && products.length > 0 && (
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)', padding: '24px 0' }}>
                All results loaded
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile filter drawer ─────────────────────────────────────────── */}
      {drawerOpen && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300 }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            zIndex: 301,
            background: 'var(--color-background)',
            borderRadius: '16px 16px 0 0',
            padding: '0 16px 32px',
            maxHeight: '85vh',
            overflowY: 'auto',
            animation: 'drawer-up 0.25s ease',
          }}>
            {/* Drawer handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 16px' }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>Filters</span>
              <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <FilterPanel {...filterPanelProps} />
          </div>
        </>
      )}
    </PublicLayout>
  );
}

// ─── Default export (Suspense boundary for useSearchParams) ──────────────────

export default function SearchPage() {
  return (
    <Suspense fallback={
      <PublicLayout>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <SkeletonGrid />
          </div>
        </div>
      </PublicLayout>
    }>
      <SearchPageInner />
    </Suspense>
  );
}
