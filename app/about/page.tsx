/**
 * app/about/page.tsx
 * About page — hero, mission, values, story, differentiators, team, CTA.
 * Spec ref: section 3 (Public pages)
 */

'use client';

import Link from 'next/link';
import PublicLayout from '@/components/layouts/PublicLayout';
import { ShieldCheck, Users, Eye } from 'lucide-react';

// ─── Data ─────────────────────────────────────────────────────────────────────

const VALUES = [
  {
    icon:        <ShieldCheck size={28} />,
    title:       'Trust',
    description: 'Every user is verified and every listing reviewed. We build confidence at every step of the trade.',
    color:       'var(--color-primary)',
  },
  {
    icon:        <Users size={28} />,
    title:       'Community',
    description: 'Local connections, real relationships. We believe the best trade happens between neighbours.',
    color:       '#7C3AED',
  },
  {
    icon:        <Eye size={28} />,
    title:       'Transparency',
    description: 'Open pricing, honest ratings, no hidden fees. What you see is exactly what you get.',
    color:       '#059669',
  },
];

const DIFFERENTIATORS = [
  {
    title:       'Multi-role Architecture',
    description: 'One platform for Buyers, Sellers, and Trade Advisors — each with a tailored dashboard and workflow.',
  },
  {
    title:       'Multi-currency Payments',
    description: 'Support for AUD, USD, NPR, and INR with real-time conversion and local payment gateways.',
  },
  {
    title:       'White-label Admin',
    description: 'Full-featured admin portal with analytics, CMS, AI tooling, and feature toggles — ready to rebrand.',
  },
];

const TEAM = [
  { initials: 'AB', name: 'Alex Bright',    role: 'Co-founder & CEO'       },
  { initials: 'PK', name: 'Priya Kumar',    role: 'Head of Product'        },
  { initials: 'MB', name: 'Marco Bianchi',  role: 'Lead Engineer'          },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <PublicLayout>
      <style>{`
        .about-values-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        @media (max-width: 768px) { .about-values-grid { grid-template-columns: 1fr; } }
        .about-story-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          align-items: center;
        }
        @media (max-width: 768px) { .about-story-grid { grid-template-columns: 1fr; } }
        .about-diff-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        @media (max-width: 768px) { .about-diff-grid { grid-template-columns: 1fr; } }
        .about-team-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        @media (max-width: 600px) { .about-team-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 70%, #1e293b) 100%)',
        padding: '80px 24px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <h1 style={{ fontSize: 48, fontWeight: 800, color: '#fff', margin: '0 0 16px', lineHeight: 1.1 }}>
            About TradeCircle
          </h1>
          <p style={{ fontSize: 20, color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.6 }}>
            A community-first marketplace connecting buyers, sellers, and trade advisors across borders and currencies.
          </p>
        </div>
      </section>

      {/* ── Mission pull-quote ────────────────────────────────────────────────── */}
      <section style={{ padding: '64px 24px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <blockquote style={{
            fontSize: 28, fontStyle: 'italic', fontWeight: 600,
            color: 'var(--color-text)', lineHeight: 1.4, margin: 0,
            borderLeft: '4px solid var(--color-primary)',
            paddingLeft: 32, textAlign: 'left',
          }}>
            "We believe trade is better when it's local, trusted, and human."
          </blockquote>
        </div>
      </section>

      {/* ── Values ───────────────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-text)', textAlign: 'center', marginBottom: 48 }}>
            Our Values
          </h2>
          <div className="about-values-grid">
            {VALUES.map((v) => (
              <div
                key={v.title}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 16, padding: '32px 28px',
                  textAlign: 'center',
                }}
              >
                <div style={{
                  width: 60, height: 60, borderRadius: 14,
                  background: `color-mix(in srgb, ${v.color} 12%, transparent)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: v.color, margin: '0 auto 20px',
                }}>
                  {v.icon}
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>
                  {v.title}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>
                  {v.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Our Story ────────────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 24px', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="about-story-grid">
            <div>
              <h2 style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-text)', marginBottom: 20 }}>Our Story</h2>
              <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: 16 }}>
                TradeCircle started with a simple observation: trading local goods felt unnecessarily complicated.
                Sellers struggled with limited reach, buyers lacked trust signals, and specialist advisors had no platform to share their knowledge.
              </p>
              <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                We built TradeCircle to solve all three problems at once — a single platform where everyone in the trade ecosystem
                has a purpose-built space and the tools they actually need.
              </p>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              borderRadius: 20, padding: '40px 32px',
              display: 'flex', flexDirection: 'column', gap: 28,
            }}>
              {[
                { value: '2024',          label: 'Founded' },
                { value: '5 Countries',   label: 'And growing' },
                { value: 'Growing Daily', label: 'New users every day' },
              ].map((stat) => (
                <div key={stat.value}>
                  <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{stat.value}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How We're Different ───────────────────────────────────────────────── */}
      <section style={{ padding: '72px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-text)', textAlign: 'center', marginBottom: 48 }}>
            How We Are Different
          </h2>
          <div className="about-diff-grid">
            {DIFFERENTIATORS.map((d, i) => (
              <div
                key={d.title}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 14, padding: '28px 24px',
                  background: 'var(--color-surface)',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8, marginBottom: 16,
                  background: 'var(--color-primary)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800,
                }}>
                  {i + 1}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)', marginBottom: 10 }}>
                  {d.title}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>
                  {d.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ─────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 24px', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-text)', marginBottom: 48 }}>Meet the Team</h2>
          <div className="about-team-grid">
            {TEAM.map((member) => (
              <div key={member.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'var(--color-primary)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 700,
                }}>
                  {member.initials}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{member.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>{member.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: 'var(--color-text)', marginBottom: 16 }}>
            Ready to join?
          </h2>
          <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
            Join thousands of traders already building connections on TradeCircle.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup">
              <button style={{
                padding: '13px 30px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'var(--color-primary)', color: '#fff',
                fontSize: 15, fontWeight: 700,
              }}>
                Get Started Free →
              </button>
            </Link>
            <Link href="/search">
              <button style={{
                padding: '13px 30px', borderRadius: 10, cursor: 'pointer',
                border: '1.5px solid var(--color-border)', background: 'var(--color-surface)',
                color: 'var(--color-text)', fontSize: 15, fontWeight: 600,
              }}>
                Browse Products →
              </button>
            </Link>
          </div>
        </div>
      </section>

    </PublicLayout>
  );
}
