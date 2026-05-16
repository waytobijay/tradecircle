/**
 * components/home/LandingPage.tsx
 * Unauthenticated marketing landing page — 7 sections.
 * Spec ref: section 3 (Unauthenticated Landing Page)
 *
 * Sections:
 *   1. Hero           — headline + CTAs + animated card stack
 *   2. How It Works   — 3 role cards (hover lift)
 *   3. Product Showcase — horizontal scroll, Firestore (limit 8)
 *   4. Advisor Spotlight — 3 advisor cards, Firestore (limit 3)
 *   5. Trust Signals  — 4 stats + security badges
 *   6. Payment Badges — gateway icon strip
 *   7. Footer         — company name, nav, currency selector, copyright
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Store,
  BookOpen,
  MapPin,
  Shield,
  Lock,
  BadgeCheck,
  ArrowRight,
  Globe,
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { MediaBackground } from '@/components/ui/MediaBackground';
import { useMediaBackground } from '@/hooks/useMediaBackground';
import type { Product, User } from '@/types';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const CURRENCIES = ['AUD', 'USD', 'NPR', 'INR'] as const;
type Currency = (typeof CURRENCIES)[number];

const FOOTER_NAV = [
  { label: 'About',   href: '/about'   },
  { label: 'FAQ',     href: '/faq'     },
  { label: 'Contact', href: '/contact' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms',   href: '/terms'   },
] as const;

const ROLE_CARDS = [
  {
    role:        'Buyer',
    Icon:        ShoppingBag,
    colorVar:    'var(--color-buyer)',
    description: 'Discover products from trusted local sellers. Connect with advisors, compare prices, and buy with confidence.',
    cta:         'Sign Up as Buyer',
    href:        '/signup?role=buyer',
  },
  {
    role:        'Seller',
    Icon:        Store,
    colorVar:    'var(--color-seller)',
    description: 'List your products, reach buyers near you, and grow your business with powerful seller tools.',
    cta:         'Sign Up as Seller',
    href:        '/signup?role=seller',
  },
  {
    role:        'Advisor',
    Icon:        BookOpen,
    colorVar:    'var(--color-advisor)',
    description: 'Share your expertise, answer buyer enquiries, and build your reputation in your trade specialty.',
    cta:         'Sign Up as Advisor',
    href:        '/signup?role=advisor',
  },
] as const;

const PAYMENT_GATEWAYS = [
  { name: 'Stripe',     abbr: 'ST' },
  { name: 'eWAY',       abbr: 'EW' },
  { name: 'Fonepay',    abbr: 'FP' },
  { name: 'eSewa',      abbr: 'ES' },
  { name: 'Khalti',     abbr: 'KH' },
  { name: 'Google Pay', abbr: 'GP' },
] as const;

// ─────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────

function useCompanyName(): string {
  const [name, setName] = useState('TradeCircle');
  useEffect(() => {
    getDoc(doc(db, 'config', 'siteConfig'))
      .then((snap) => {
        const data = snap.data();
        if (data?.branding?.companyName) setName(data.branding.companyName as string);
      })
      .catch(() => {/* fallback already set */});
  }, []);
  return name;
}

interface SiteStats {
  activeUsers:       number;
  productsListed:    number;
  advisorsAvailable: number;
  countriesSupported: number;
}

function useSiteStats(): SiteStats | null {
  const [stats, setStats] = useState<SiteStats | null>(null);
  useEffect(() => {
    getDoc(doc(db, 'config', 'stats'))
      .then((snap) => {
        const data = snap.data();
        if (data) {
          setStats({
            activeUsers:        (data.activeUsers        as number) ?? 0,
            productsListed:     (data.productsListed     as number) ?? 0,
            advisorsAvailable:  (data.advisorsAvailable  as number) ?? 0,
            countriesSupported: (data.countriesSupported as number) ?? 0,
          });
        }
      })
      .catch(() => {/* leave null — skeleton shown */});
  }, []);
  return stats;
}

function useFeaturedProducts(): { products: Product[]; loading: boolean } {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'products'),
      where('active', '==', true),
      orderBy('createdAt', 'desc'),
      limit(8),
    );
    getDocs(q)
      .then((snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product));
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  return { products, loading };
}

interface AdvisorPreview {
  uid:       string;
  name:      string;
  photoUrl?: string;
  specialty?: string;
}

function useFeaturedAdvisors(): { advisors: AdvisorPreview[]; loading: boolean } {
  const [advisors, setAdvisors] = useState<AdvisorPreview[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role',   '==', 'advisor'),
      where('active', '==', true),
      limit(3),
    );
    getDocs(q)
      .then((snap) => {
        setAdvisors(
          snap.docs.map((d) => {
            const u = d.data() as User;
            return {
              uid:       d.id,
              name:      u.name,
              photoUrl:  u.profilePhoto,
              specialty: u.specialty,
            };
          }),
        );
      })
      .catch(() => setAdvisors([]))
      .finally(() => setLoading(false));
  }, []);

  return { advisors, loading };
}

function useCurrency(): [Currency, (c: Currency) => void] {
  const [currency, setCurrencyState] = useState<Currency>('AUD');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('tc-currency') as Currency | null;
    if (saved && (CURRENCIES as readonly string[]).includes(saved)) {
      setCurrencyState(saved);
    }
  }, []);

  function setCurrency(c: Currency) {
    setCurrencyState(c);
    if (typeof window !== 'undefined') localStorage.setItem('tc-currency', c);
  }

  return [currency, setCurrency];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatStat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K+`;
  return `${n}+`;
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('en-AU', {
    style:    'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

// ─────────────────────────────────────────────
// Section 1 — Hero
// ─────────────────────────────────────────────

function HeroSection() {
  const [hovered, setHovered] = useState(false);
  const { slides } = useMediaBackground();

  return (
    <section
      style={{
        position:        'relative',
        minHeight:       '100vh',
        display:         'flex',
        alignItems:      'center',
        padding:         'var(--space-section) var(--space-6)',
        overflow:        'hidden',
        // Solid base — MediaBackground sits behind via fixed z:-1.
        background:      'transparent',
      }}
    >
      {/* Cinematic blurred CMS-managed media background. */}
      <MediaBackground slides={slides} blurPx={28} overlayOpacity={0.62} intervalSec={7} />

      {/* Subtle floating mockup decorations (CSS only) — corners. */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: '12%', right: '6%', width: 180, height: 120,
        borderRadius: 18,
        background: 'rgba(255,255,255,0.10)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        transform: 'rotate(-6deg)',
        pointerEvents: 'none',
        display: 'none',
      }}
        className="tc-hero-decoration"
      />
      <div aria-hidden="true" style={{
        position: 'absolute', bottom: '14%', left: '5%', width: 160, height: 110,
        borderRadius: 18,
        background: 'rgba(255,255,255,0.10)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        transform: 'rotate(8deg)',
        pointerEvents: 'none',
        display: 'none',
      }}
        className="tc-hero-decoration"
      />
      <style>{`
        @media (min-width: 1024px) {
          .tc-hero-decoration { display: block !important; }
        }
      `}</style>
      {/* Centered glass card with headline + CTAs. */}
      <div
        style={{
          position: 'relative',
          maxWidth: 820,
          margin: '0 auto',
          width: '100%',
          padding: 'clamp(28px, 5vw, 48px)',
          borderRadius: 24,
          background: 'rgba(255,255,255,0.10)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.22)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
          textAlign: 'center',
          color: '#ffffff',
        }}
      >
        <h1
          className="font-display font-bold"
          style={{
            margin: 0,
            fontFamily: 'var(--font-display, Sora), system-ui',
            fontSize: 'clamp(2.375rem, 6vw, 3.5rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            color: '#ffffff',
          }}
        >
          The all-in-one trading platform
        </h1>
        <p
          style={{
            margin: '18px auto 0',
            maxWidth: 560,
            fontSize: 'clamp(1rem, 1.6vw, 1.125rem)',
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          Buy, sell, and get expert advice — all in one trusted community marketplace connecting people near you.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginTop: 28,
          }}
        >
          {/* Primary CTA — gradient */}
          <Link
            href="/signup"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 28px',
              borderRadius: 'var(--radius-pill)',
              background: 'linear-gradient(135deg, var(--color-primary), #1e3a8a)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: 15,
              textDecoration: 'none',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              transform: hovered ? 'scale(1.03)' : 'scale(1)',
              boxShadow: hovered
                ? '0 12px 32px rgba(30,58,138,0.45)'
                : '0 6px 18px rgba(30,58,138,0.30)',
            }}
          >
            Get Started
            <ArrowRight size={16} />
          </Link>

          {/* Ghost CTA */}
          <Link
            href="#how-it-works"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 28px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(255,255,255,0.10)',
              color: '#ffffff',
              fontWeight: 500,
              fontSize: 15,
              textDecoration: 'none',
              border: '1.5px solid rgba(255,255,255,0.35)',
              transition: 'background-color 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.20)';
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.55)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.10)';
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.35)';
            }}
          >
            How it works
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Section 2 — How It Works (Role Selector)
// ─────────────────────────────────────────────

function RoleCard({
  role, Icon, colorVar, description, cta, href,
}: {
  role: string;
  Icon: React.ElementType;
  colorVar: string;
  description: string;
  cta: string;
  href: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding:         'var(--space-xl)',
        borderRadius:    'var(--radius-lg)',
        backgroundColor: 'var(--color-bg-primary)',
        border:          `1.5px solid ${hovered ? colorVar : 'var(--color-border)'}`,
        transform:       hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition:      'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
        boxShadow:       hovered ? '0 8px 24px rgba(0,0,0,0.08)' : 'none',
        display:         'flex',
        flexDirection:   'column',
        gap:             'var(--space-base)',
      }}
    >
      <div
        style={{
          width:           '48px',
          height:          '48px',
          borderRadius:    'var(--radius-md)',
          backgroundColor: `color-mix(in srgb, ${colorVar} 12%, transparent)`,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
        }}
      >
        <Icon size={24} style={{ color: colorVar }} />
      </div>

      <div>
        <h3
          className="font-display font-semibold"
          style={{ margin: '0 0 var(--space-xs)', fontSize: '18px', color: 'var(--color-text-primary)' }}
        >
          {role}
        </h3>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
          {description}
        </p>
      </div>

      <Link
        href={href}
        style={{
          display:         'inline-flex',
          alignItems:      'center',
          gap:             'var(--space-xs)',
          padding:         '10px 20px',
          borderRadius:    'var(--radius-md)',
          backgroundColor: hovered ? colorVar : 'transparent',
          color:           hovered ? '#ffffff' : colorVar,
          border:          `1.5px solid ${colorVar}`,
          fontWeight:      600,
          fontSize:        '13px',
          textDecoration:  'none',
          transition:      'background-color 0.2s ease, color 0.2s ease',
          alignSelf:       'flex-start',
        }}
      >
        {cta}
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}

function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      style={{
        padding:         'var(--space-section) var(--space-6)',
        backgroundColor: 'var(--color-bg-secondary)',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
          <h2
            className="font-display font-bold"
            style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-sm)' }}
          >
            How It Works
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Choose your role and get started in minutes.
          </p>
        </div>

        <div
          style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap:                 'var(--space-lg)',
          }}
        >
          {ROLE_CARDS.map((card) => (
            <RoleCard key={card.role} {...card} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Section 3 — Product Showcase
// ─────────────────────────────────────────────

function ProductCardSkeleton() {
  return (
    <div
      className="animate-pulse flex-shrink-0"
      style={{
        width:           '200px',
        borderRadius:    'var(--radius-lg)',
        backgroundColor: 'var(--color-bg-primary)',
        border:          '1px solid var(--color-border)',
        overflow:        'hidden',
      }}
    >
      <div style={{ height: '140px', backgroundColor: 'var(--color-bg-secondary)' }} />
      <div style={{ padding: 'var(--space-sm)' }}>
        <div style={{ height: '14px', borderRadius: '4px', backgroundColor: 'var(--color-bg-secondary)', marginBottom: 'var(--space-xs)' }} />
        <div style={{ height: '12px', borderRadius: '4px', backgroundColor: 'var(--color-bg-secondary)', width: '60%' }} />
      </div>
    </div>
  );
}

function ProductShowcaseSection() {
  const { products, loading } = useFeaturedProducts();

  return (
    <section style={{ padding: 'var(--space-section) 0' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <h2
            className="font-display font-bold"
            style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.5rem)', color: 'var(--color-text-primary)', margin: 0 }}
          >
            Recently Listed Near You
          </h2>
          <Link
            href="/search"
            style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-primary)', textDecoration: 'none' }}
          >
            View all →
          </Link>
        </div>
      </div>

      {/* Horizontal scroll container */}
      <div
        style={{
          paddingLeft:            'var(--space-6)',
          paddingRight:           'var(--space-6)',
          overflowX:              'auto',
          display:                'flex',
          gap:                    'var(--space-base)',
          scrollbarWidth:         'none',
          msOverflowStyle:        'none' as React.CSSProperties['msOverflowStyle'],
          paddingBottom:          'var(--space-xs)',
        }}
      >
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : products.length === 0
            ? (
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', padding: 'var(--space-base) 0' }}>
                No products listed yet — be the first!
              </p>
            )
            : products.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                style={{ textDecoration: 'none', flexShrink: 0 }}
              >
                <div
                  style={{
                    width:           '200px',
                    borderRadius:    'var(--radius-lg)',
                    backgroundColor: 'var(--color-bg-primary)',
                    border:          '1px solid var(--color-border)',
                    overflow:        'hidden',
                    transition:      'box-shadow 0.15s ease, transform 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  }}
                >
                  {/* Product image */}
                  {product.images?.[0]?.url ? (
                    <img
                      src={product.images[0].url}
                      alt={product.name}
                      style={{ width: '100%', height: '140px', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        height:          '140px',
                        backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-secondary))',
                        display:         'flex',
                        alignItems:      'center',
                        justifyContent:  'center',
                      }}
                    >
                      <ShoppingBag size={32} style={{ color: 'var(--color-text-tertiary)' }} />
                    </div>
                  )}

                  <div style={{ padding: 'var(--space-sm)' }}>
                    <p
                      style={{
                        margin:       0,
                        fontWeight:   600,
                        fontSize:     '13px',
                        color:        'var(--color-text-primary)',
                        whiteSpace:   'nowrap',
                        overflow:     'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {product.name}
                    </p>

                    <p style={{ margin: '2px 0', fontSize: '13px', fontWeight: 500, color: 'var(--color-primary)' }}>
                      {formatPrice(product.price, product.currency)}
                    </p>

                    {product.location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                        <MapPin size={11} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {product.location.city}, {product.location.country}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))
        }
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Section 4 — Advisor Spotlight
// ─────────────────────────────────────────────

function AdvisorCardSkeleton() {
  return (
    <div
      className="animate-pulse"
      style={{
        padding:         'var(--space-lg)',
        borderRadius:    'var(--radius-lg)',
        backgroundColor: 'var(--color-bg-primary)',
        border:          '1px solid var(--color-border)',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        gap:             'var(--space-sm)',
        textAlign:       'center',
      }}
    >
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-bg-secondary)' }} />
      <div style={{ height: '14px', width: '100px', borderRadius: '4px', backgroundColor: 'var(--color-bg-secondary)' }} />
      <div style={{ height: '12px', width: '80px',  borderRadius: '4px', backgroundColor: 'var(--color-bg-secondary)' }} />
    </div>
  );
}

function AdvisorSpotlightSection() {
  const { advisors, loading } = useFeaturedAdvisors();

  return (
    <section
      style={{
        padding:         'var(--space-section) var(--space-6)',
        backgroundColor: 'var(--color-bg-secondary)',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-xl)' }}>
          <div>
            <h2
              className="font-display font-bold"
              style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.5rem)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-xs)' }}
            >
              Advisor Spotlight
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              Expert guidance from verified trade advisors.
            </p>
          </div>
          <Link
            href="/advisors"
            style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-advisor)', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Find an Advisor →
          </Link>
        </div>

        <div
          style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap:                 'var(--space-lg)',
          }}
        >
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <AdvisorCardSkeleton key={i} />)
            : advisors.length === 0
              ? (
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                  Advisors coming soon.
                </p>
              )
              : advisors.map((advisor) => (
                <Link
                  key={advisor.uid}
                  href={`/advisors/${advisor.uid}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    style={{
                      padding:         'var(--space-lg)',
                      borderRadius:    'var(--radius-lg)',
                      backgroundColor: 'var(--color-bg-primary)',
                      border:          '1px solid var(--color-border)',
                      display:         'flex',
                      flexDirection:   'column',
                      alignItems:      'center',
                      gap:             'var(--space-sm)',
                      textAlign:       'center',
                      transition:      'box-shadow 0.15s ease, transform 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                    }}
                  >
                    {advisor.photoUrl ? (
                      <img
                        src={advisor.photoUrl}
                        alt={advisor.name}
                        style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width:           '64px',
                          height:          '64px',
                          borderRadius:    '50%',
                          backgroundColor: 'var(--color-advisor)',
                          color:           '#ffffff',
                          display:         'flex',
                          alignItems:      'center',
                          justifyContent:  'center',
                          fontWeight:      600,
                          fontSize:        '20px',
                          fontFamily:      'var(--font-display)',
                        }}
                      >
                        {advisor.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                    )}

                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--color-text-primary)' }}>
                        {advisor.name}
                      </p>
                      {advisor.specialty && (
                        <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--color-advisor)' }}>
                          {advisor.specialty}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))
          }
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Section 5 — Trust Signals
// ─────────────────────────────────────────────

const SECURITY_BADGES = [
  { Icon: Shield,    label: 'Firebase Secured'   },
  { Icon: Lock,      label: 'SSL Encrypted'      },
  { Icon: BadgeCheck,label: 'Verified Accounts'  },
] as const;

function TrustSignalsSection() {
  const stats = useSiteStats();

  const STAT_ITEMS = [
    { label: 'Active Users',        value: stats?.activeUsers       },
    { label: 'Products Listed',     value: stats?.productsListed    },
    { label: 'Advisors Available',  value: stats?.advisorsAvailable  },
    { label: 'Countries Supported', value: stats?.countriesSupported },
  ] as const;

  return (
    <section style={{ padding: 'var(--space-section) var(--space-6)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Stats row */}
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap:                 'var(--space-lg)',
            marginBottom:        'var(--space-xl)',
            textAlign:           'center',
          }}
        >
          {STAT_ITEMS.map(({ label, value }) => (
            <div key={label}>
              {value !== undefined ? (
                <p
                  className="font-display font-bold"
                  style={{ margin: '0 0 var(--space-xs)', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--color-primary)' }}
                >
                  {formatStat(value)}
                </p>
              ) : (
                <div
                  className="animate-pulse"
                  style={{ height: '40px', borderRadius: '6px', backgroundColor: 'var(--color-bg-secondary)', marginBottom: 'var(--space-xs)' }}
                />
              )}
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Security badges */}
        <div
          style={{
            display:        'flex',
            justifyContent: 'center',
            flexWrap:       'wrap',
            gap:            'var(--space-lg)',
          }}
        >
          {SECURITY_BADGES.map(({ Icon, label }) => (
            <div
              key={label}
              style={{
                display:         'flex',
                alignItems:      'center',
                gap:             'var(--space-xs)',
                padding:         '10px 20px',
                borderRadius:    'var(--radius-pill)',
                backgroundColor: 'var(--color-bg-secondary)',
                border:          '1px solid var(--color-border)',
              }}
            >
              <Icon size={16} style={{ color: 'var(--color-success)' }} />
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Section 6 — Payment Badges
// ─────────────────────────────────────────────

function PaymentBadgesSection() {
  return (
    <section
      style={{
        padding:         'var(--space-xl) var(--space-6)',
        backgroundColor: 'var(--color-bg-secondary)',
        borderTop:       '1px solid var(--color-border)',
        borderBottom:    '1px solid var(--color-border)',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <p style={{ margin: '0 0 var(--space-base)', fontSize: '13px', color: 'var(--color-text-tertiary)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Pay your way — regional gateways supported
        </p>
        <div
          style={{
            display:        'flex',
            justifyContent: 'center',
            flexWrap:       'wrap',
            gap:            'var(--space-sm)',
          }}
        >
          {PAYMENT_GATEWAYS.map(({ name, abbr }) => (
            <div
              key={name}
              title={name}
              style={{
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                width:           '64px',
                height:          '40px',
                borderRadius:    'var(--radius-md)',
                backgroundColor: 'var(--color-bg-primary)',
                border:          '1px solid var(--color-border)',
                fontSize:        '11px',
                fontWeight:      700,
                color:           'var(--color-text-secondary)',
                letterSpacing:   '0.04em',
              }}
            >
              {abbr}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Section 7 — Footer
// ─────────────────────────────────────────────

function FooterSection({ companyName }: { companyName: string }) {
  const [currency, setCurrency] = useCurrency();

  return (
    <footer
      style={{
        padding:         'var(--space-xl) var(--space-6) var(--space-lg)',
        backgroundColor: 'var(--color-bg-primary)',
        borderTop:       '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          maxWidth:            '1200px',
          margin:              '0 auto',
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap:                 'var(--space-xl)',
          marginBottom:        'var(--space-xl)',
        }}
      >
        {/* Brand */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
            <div
              style={{
                width:           '28px',
                height:          '28px',
                borderRadius:    '6px',
                backgroundColor: 'var(--color-primary)',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                fontWeight:      700,
                fontSize:        '11px',
                color:           '#ffffff',
                fontFamily:      'var(--font-display)',
              }}
            >
              TC
            </div>
            <span
              className="font-display font-bold"
              style={{ fontSize: '16px', color: 'var(--color-text-primary)' }}
            >
              {companyName}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6, maxWidth: '220px' }}>
            Connecting buyers, sellers, and advisors in one trusted community.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <p style={{ margin: '0 0 var(--space-sm)', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Company
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            {FOOTER_NAV.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                style={{ fontSize: '14px', color: 'var(--color-text-secondary)', textDecoration: 'none' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-primary)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-secondary)')}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Currency selector */}
        <div>
          <p style={{ margin: '0 0 var(--space-sm)', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Currency
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
            <Globe size={14} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              style={{
                padding:         '6px 10px',
                borderRadius:    'var(--radius-md)',
                border:          '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-primary)',
                color:           'var(--color-text-primary)',
                fontSize:        '13px',
                cursor:          'pointer',
                outline:         'none',
              }}
              aria-label="Select currency"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div
        style={{
          maxWidth:      '1200px',
          margin:        '0 auto',
          paddingTop:    'var(--space-base)',
          borderTop:     '1px solid var(--color-border)',
          display:       'flex',
          justifyContent:'space-between',
          alignItems:    'center',
          flexWrap:      'wrap',
          gap:           'var(--space-sm)',
        }}
      >
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
          © {new Date().getFullYear()} {companyName}. All rights reserved.
        </p>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
          Built with ❤️ for communities worldwide.
        </p>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────
// LandingPage
// ─────────────────────────────────────────────

export function LandingPage() {
  const companyName = useCompanyName();

  return (
    <PublicLayout>
      <HeroSection />
      <HowItWorksSection />
      <ProductShowcaseSection />
      <AdvisorSpotlightSection />
      <TrustSignalsSection />
      <PaymentBadgesSection />
      <FooterSection companyName={companyName} />
    </PublicLayout>
  );
}
