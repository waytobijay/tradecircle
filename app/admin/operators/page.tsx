/**
 * app/admin/operators/page.tsx
 * Admin — Operator Management (Phase 4 placeholder)
 * Spec ref: section 13.14 (Phase 4 — Multi-tenant architecture)
 */

'use client';

import { Globe, Palette, CreditCard, Shield, Users, Lock } from 'lucide-react';
import AdminLayout from '@/components/layouts/AdminLayout';

// ─── Feature Preview Item ─────────────────────────────────────────────────────

interface FeaturePreview {
  icon: React.ElementType;
  title: string;
  description: string;
}

const FEATURES: FeaturePreview[] = [
  {
    icon: Globe,
    title: 'Custom Domain',
    description: 'Each operator runs on their own domain (e.g. marketplace.yourcompany.com).',
  },
  {
    icon: Palette,
    title: 'White-Label Branding',
    description: 'Full brand control — logo, colours, fonts, and custom CSS per operator.',
  },
  {
    icon: CreditCard,
    title: 'Operator Billing',
    description: 'Per-operator subscription billing with usage-based overage and invoicing.',
  },
  {
    icon: Shield,
    title: 'Data Isolation',
    description: 'Strict Firestore data partitioning so each operator sees only their data.',
  },
  {
    icon: Users,
    title: 'Regional Admins',
    description: 'Country-level and region-level admin roles scoped to their territory.',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OperatorsPage() {
  return (
    <AdminLayout>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .op-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
      `}</style>

      <div style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>

        {/* Header ──────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 32, animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Globe size={22} style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
                Operator Management
              </h2>
              <span style={{
                display: 'inline-block', marginTop: 4,
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: 'color-mix(in srgb, var(--color-warning) 14%, transparent)',
                color: 'var(--color-warning)', letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                Phase 4
              </span>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.65, maxWidth: 620 }}>
            Multi-tenant operator management is a Phase 4 feature. Each operator instance will have
            its own custom domain, branding, billing, and data isolation.
          </p>
        </div>

        {/* Coming Soon banner ──────────────────────────────────────────────── */}
        <div style={{
          border: '1.5px dashed var(--color-border)',
          borderRadius: 16, padding: '36px 32px', textAlign: 'center',
          background: 'var(--color-surface)', marginBottom: 32,
          animation: 'fadeIn 0.35s ease',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
            background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Lock size={28} style={{ color: 'var(--color-primary)' }} />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
            Coming in Phase 4
          </h3>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, maxWidth: 480, marginInline: 'auto' }}>
            The operator management console is currently in planning. Once available, you will be
            able to provision, configure, and bill multiple independent marketplace instances from
            this single admin panel.
          </p>
          <a
            href="/contact"
            style={{
              display: 'inline-block', padding: '10px 24px',
              background: 'var(--color-primary)', color: '#fff',
              borderRadius: 8, textDecoration: 'none',
              fontSize: 14, fontWeight: 600,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.85'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
          >
            Contact us to set up your operator instance
          </a>
        </div>

        {/* Feature Preview ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 8 }}>
          <h4 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Feature Preview
          </h4>
          <div className="op-grid">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12, padding: '16px 18px',
                  display: 'flex', flexDirection: 'column', gap: 10,
                  animation: 'fadeIn 0.4s ease',
                }}
              >
                {/* Icon + lock badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9,
                    background: 'color-mix(in srgb, var(--color-border) 60%, transparent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={18} style={{ color: 'var(--color-text-secondary)' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Lock size={11} style={{ color: 'var(--color-text-secondary)' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Phase 4
                    </span>
                  </div>
                </div>

                {/* Text */}
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                    {title}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
