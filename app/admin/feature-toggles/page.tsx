/**
 * app/admin/feature-toggles/page.tsx
 * Admin — Feature Toggles
 * Spec ref: section 6.7 (Admin Portal > Feature Toggles)
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  ShoppingBag, Users, MessageSquare, Bell, ShoppingCart, Star,
  Heart, Megaphone, Cpu, Globe, Layers, Map, BarChart2, BookOpen,
} from 'lucide-react';
import { db } from '@/services/firebase';
import AdminLayout from '@/components/layouts/AdminLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

type RoleBadge = 'All' | 'Buyer' | 'Seller' | 'Admin';

interface Feature {
  key: string;
  name: string;
  description: string;
  role: RoleBadge;
  icon: React.ElementType;
  defaultOn: boolean;
}

// ─── Feature definitions ──────────────────────────────────────────────────────

const FEATURES: Feature[] = [
  { key: 'marketplace',       name: 'Marketplace',         description: 'Core marketplace listing and browsing functionality',      role: 'All',    icon: ShoppingBag,   defaultOn: true  },
  { key: 'advisorySystem',    name: 'Advisory System',     description: 'Expert advisor profiles, posts, and consultations',        role: 'All',    icon: Users,         defaultOn: true  },
  { key: 'messaging',         name: 'Messaging',           description: 'Direct messages between buyers and sellers',               role: 'All',    icon: MessageSquare, defaultOn: true  },
  { key: 'notifications',     name: 'Notifications',       description: 'Push and email notification delivery system',              role: 'All',    icon: Bell,          defaultOn: true  },
  { key: 'cartCheckout',      name: 'Cart & Checkout',     description: 'Shopping cart, payment gateway, and order flow',          role: 'Buyer',  icon: ShoppingCart,  defaultOn: true  },
  { key: 'reviewsRatings',    name: 'Reviews & Ratings',   description: 'Product and seller review submission and display',         role: 'All',    icon: Star,          defaultOn: true  },
  { key: 'savedItems',        name: 'Saved Items',         description: 'Wishlist and saved product functionality for buyers',      role: 'Buyer',  icon: Heart,         defaultOn: true  },
  { key: 'adsSystem',         name: 'Ads System',          description: 'Sponsored listings and advertisement placements',          role: 'Admin',  icon: Megaphone,     defaultOn: false },
  { key: 'aiFeatures',        name: 'AI Features',         description: 'AI-powered recommendations, search, and chat support',    role: 'Admin',  icon: Cpu,           defaultOn: false },
  { key: 'guestCheckout',     name: 'Guest Checkout',      description: 'Allow unregistered users to complete purchases',          role: 'Buyer',  icon: Globe,         defaultOn: false },
  { key: 'socialFeed',        name: 'Social Feed',         description: 'Activity feed, posts, and community interactions',        role: 'All',    icon: Layers,        defaultOn: true  },
  { key: 'locationDiscovery', name: 'Location Discovery',  description: 'Geo-based product and seller discovery features',         role: 'All',    icon: Map,           defaultOn: true  },
  { key: 'sellerAnalytics',   name: 'Seller Analytics',    description: 'Sales dashboards, revenue charts, and insights',          role: 'Seller', icon: BarChart2,     defaultOn: true  },
  { key: 'blogCms',           name: 'Blog / CMS',          description: 'Platform blog, articles, and content management system',  role: 'All',    icon: BookOpen,      defaultOn: true  },
];

// ─── Role badge colors ────────────────────────────────────────────────────────

const ROLE_STYLES: Record<RoleBadge, { bg: string; color: string }> = {
  All:    { bg: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)'  },
  Buyer:  { bg: 'color-mix(in srgb, var(--color-success) 12%, transparent)', color: 'var(--color-success)'  },
  Seller: { bg: 'color-mix(in srgb, var(--color-warning) 14%, transparent)', color: 'var(--color-warning)'  },
  Admin:  { bg: 'color-mix(in srgb, #7c3aed 12%, transparent)',              color: '#7c3aed'               },
};

type ToggleMap = Record<string, boolean>;

function buildDefault(): ToggleMap {
  return Object.fromEntries(FEATURES.map((f) => [f.key, f.defaultOn]));
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function BigToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
        background: on ? 'var(--color-primary)' : 'var(--color-border)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 27 : 3,
        width: 22, height: 22, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
      }} />
    </button>
  );
}

// ─── Feature Card ─────────────────────────────────────────────────────────────

function FeatureCard({
  feature,
  enabled,
  onToggle,
}: {
  feature: Feature;
  enabled: boolean;
  onToggle: () => void;
}) {
  const Icon = feature.icon;
  const roleStyle = ROLE_STYLES[feature.role];

  return (
    <div style={{
      background: 'var(--color-surface)', border: `1px solid ${enabled ? 'color-mix(in srgb, var(--color-primary) 25%, var(--color-border))' : 'var(--color-border)'}`,
      borderRadius: 12, padding: '18px 20px',
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: enabled
              ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
              : 'var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s',
          }}>
            <Icon size={18} style={{ color: enabled ? 'var(--color-primary)' : 'var(--color-text-secondary)', transition: 'color 0.2s' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{feature.name}</span>
              <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: roleStyle.bg, color: roleStyle.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {feature.role}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              {feature.description}
            </p>
          </div>
        </div>
        <BigToggle on={enabled} onChange={onToggle} />
      </div>
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
          background: enabled ? 'var(--color-success)' : 'var(--color-border)',
          transition: 'background 0.2s',
        }} />
        <span style={{ fontSize: 11, color: enabled ? 'var(--color-success)' : 'var(--color-text-secondary)', fontWeight: 600, transition: 'color 0.2s' }}>
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeatureTogglesPage() {
  const [toggles,  setToggles]  = useState<ToggleMap>(buildDefault());
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  }

  useEffect(() => {
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'siteConfig'));
        if (snap.exists()) {
          const data = snap.data() as { featureToggles?: ToggleMap };
          if (data.featureToggles) setToggles({ ...buildDefault(), ...data.featureToggles });
        }
      } catch { /* use defaults */ }
      finally { setLoading(false); }
    })();
  }, []);

  async function handleToggle(key: string) {
    const next = { ...toggles, [key]: !toggles[key] };
    setToggles(next);
    try {
      await setDoc(doc(db, 'config', 'siteConfig'), { featureToggles: next }, { merge: true });
      showToast('Feature updated');
    } catch (err) {
      console.error(err);
      setToggles(toggles); // revert
      showToast('Failed to save');
    }
  }

  const enabledCount  = Object.values(toggles).filter(Boolean).length;
  const disabledCount = FEATURES.length - enabledCount;

  return (
    <AdminLayout>
      <style>{`
        @keyframes shimmer { 0%{opacity:1} 50%{opacity:0.4} 100%{opacity:1} }
        @keyframes slideUp { from{transform:translateY(10px);opacity:0} to{transform:translateY(0);opacity:1} }
        .feat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
        @media (max-width: 768px) { .feat-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>Feature Toggles</h2>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>Enable or disable platform features — changes save automatically</p>
          </div>
          {!loading && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ padding: '6px 14px', borderRadius: 8, background: 'color-mix(in srgb, var(--color-success) 12%, transparent)', fontSize: 13, fontWeight: 600, color: 'var(--color-success)' }}>
                {enabledCount} On
              </div>
              <div style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                {disabledCount} Off
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="feat-grid">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-border)', animation: 'shimmer 1.4s ease-in-out infinite', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ width: '60%', height: 14, borderRadius: 6, background: 'var(--color-border)', animation: 'shimmer 1.4s ease-in-out infinite', marginBottom: 8 }} />
                    <div style={{ width: '90%', height: 12, borderRadius: 6, background: 'var(--color-border)', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="feat-grid">
            {FEATURES.map((feature) => (
              <FeatureCard
                key={feature.key}
                feature={feature}
                enabled={toggles[feature.key] ?? feature.defaultOn}
                onToggle={() => void handleToggle(feature.key)}
              />
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 600,
          background: 'var(--color-text)', color: 'var(--color-background)',
          padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', animation: 'slideUp 0.2s ease',
        }}>
          {toast}
        </div>
      )}
    </AdminLayout>
  );
}
