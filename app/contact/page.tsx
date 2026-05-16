/**
 * app/contact/page.tsx
 * Contact page — 2-col layout, form with success state, info panel.
 * Spec ref: section 3 (Public pages)
 */

'use client';

import { useState } from 'react';
import PublicLayout from '@/components/layouts/PublicLayout';
import { Mail, Clock, MapPin, ExternalLink, Loader2 } from 'lucide-react';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [errors,   setErrors]   = useState<Partial<typeof form>>({});

  function validate() {
    const e: Partial<typeof form> = {};
    if (!form.name.trim())    e.name    = 'Name is required';
    if (!form.email.trim())   e.email   = 'Email is required';
    if (!form.subject.trim()) e.subject = 'Subject is required';
    if (!form.message.trim()) e.message = 'Message is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSend() {
    if (!validate()) return;
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
    }, 1500);
  }

  function handleChange(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  const inputStyle = (hasErr: boolean): React.CSSProperties => ({
    width: '100%', padding: '10px 14px', borderRadius: 9,
    border: `1.5px solid ${hasErr ? 'var(--color-danger)' : 'var(--color-border)'}`,
    background: 'var(--color-background)', color: 'var(--color-text)',
    fontSize: 14, boxSizing: 'border-box', outline: 'none',
    fontFamily: 'inherit',
  });

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: 'var(--color-text)', marginBottom: 6,
  };

  const errStyle: React.CSSProperties = {
    fontSize: 12, color: 'var(--color-danger)', marginTop: 4,
  };

  return (
    <PublicLayout>
      <style>{`
        .contact-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 40px;
          align-items: flex-start;
        }
        @media (max-width: 860px) {
          .contact-grid { grid-template-columns: 1fr; }
        }
        .contact-input:focus {
          outline: 2px solid var(--color-primary);
          outline-offset: -1px;
          border-color: var(--color-primary) !important;
        }
        .contact-social-link {
          display: flex; align-items: center; gap: 8px;
          text-decoration: none; font-size: 14px; font-weight: 500;
          color: var(--color-text-secondary);
          padding: 4px 0;
          transition: color 0.15s;
        }
        .contact-social-link:hover { color: var(--color-primary); }
      `}</style>

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px' }}>

        {/* Page title */}
        <div style={{ marginBottom: 48, textAlign: 'center' }}>
          <h1 style={{ fontSize: 40, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 12px' }}>
            Get in Touch
          </h1>
          <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', margin: 0 }}>
            Have a question or need help? We would love to hear from you.
          </p>
        </div>

        <div className="contact-grid">

          {/* ── Contact form ─────────────────────────────────────────────────── */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 16, padding: '36px',
          }}>
            {sent ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <Mail size={28} color="var(--color-success)" />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 10 }}>
                  Message sent!
                </h2>
                <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', margin: '0 0 28px', lineHeight: 1.6 }}>
                  We will reply within 24 hours.
                </p>
                <button
                  onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
                  style={{
                    padding: '10px 24px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 600,
                  }}
                >
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 24, marginTop: 0 }}>
                  Send us a message
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>Name *</label>
                    <input
                      className="contact-input"
                      style={inputStyle(!!errors.name)}
                      value={form.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Your name"
                    />
                    {errors.name && <p style={errStyle}>{errors.name}</p>}
                  </div>
                  <div>
                    <label style={labelStyle}>Email *</label>
                    <input
                      className="contact-input"
                      style={inputStyle(!!errors.email)}
                      type="email"
                      value={form.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      placeholder="you@example.com"
                    />
                    {errors.email && <p style={errStyle}>{errors.email}</p>}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Subject *</label>
                  <input
                    className="contact-input"
                    style={inputStyle(!!errors.subject)}
                    value={form.subject}
                    onChange={(e) => handleChange('subject', e.target.value)}
                    placeholder="How can we help?"
                  />
                  {errors.subject && <p style={errStyle}>{errors.subject}</p>}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={labelStyle}>Message *</label>
                  <textarea
                    className="contact-input"
                    style={{ ...inputStyle(!!errors.message), resize: 'vertical' }}
                    rows={6}
                    value={form.message}
                    onChange={(e) => handleChange('message', e.target.value)}
                    placeholder="Tell us more…"
                  />
                  {errors.message && <p style={errStyle}>{errors.message}</p>}
                </div>

                <button
                  onClick={handleSend}
                  disabled={sending}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    width: '100%', padding: '12px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    background: 'var(--color-primary)', color: '#fff',
                    fontSize: 15, fontWeight: 700, opacity: sending ? 0.8 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {sending ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Sending…</> : 'Send Message'}
                </button>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </>
            )}
          </div>

          {/* ── Info panel ───────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Contact info card */}
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 16, padding: '28px 24px',
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 20, marginTop: 0 }}>
                Contact Info
              </h3>

              {[
                { icon: <Mail size={16} />,   label: 'Email',    value: 'support@tradecircle.com' },
                { icon: <Clock size={16} />,  label: 'Hours',    value: 'Mon–Fri 9am–5pm AEST'   },
                { icon: <Mail size={16} />,   label: 'Response', value: 'Within 24 hours'         },
                { icon: <MapPin size={16} />, label: 'Based in', value: 'Australia 🇦🇺'           },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-primary)',
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500 }}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Social links */}
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 16, padding: '24px',
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16, marginTop: 0 }}>
                Follow Us
              </h3>
              {[
                { label: 'Twitter / X',  href: 'https://twitter.com/tradecircle'  },
                { label: 'LinkedIn',     href: 'https://linkedin.com/company/tradecircle' },
                { label: 'Facebook',     href: 'https://facebook.com/tradecircle'  },
              ].map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="contact-social-link">
                  <ExternalLink size={15} />
                  {s.label}
                </a>
              ))}
            </div>
          </div>

        </div>
      </section>
    </PublicLayout>
  );
}
