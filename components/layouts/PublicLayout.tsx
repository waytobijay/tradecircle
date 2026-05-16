/**
 * components/layouts/PublicLayout.tsx
 * Unauthenticated pages shell.
 * Spec ref: section 2 (Site Architecture & Navigation)
 *
 * Navbar:
 *  - Transparent at top, solid after scrolling 50px
 *  - Left:   Logo (reads companyName from config/site, fallback "TradeCircle")
 *  - Centre: Home | Browse Products | Advisors
 *  - Right:  [Login] outline + [Sign Up] primary
 *  - Mobile: hamburger → slide-down drawer
 */

'use client';

import { useEffect, useState } from 'react';
import Link                    from 'next/link';
import { usePathname }         from 'next/navigation';
import { doc, getDoc }         from 'firebase/firestore';
import { Menu, X }             from 'lucide-react';
import { db }                  from '@/services/firebase';

interface PublicLayoutProps {
  children: React.ReactNode;
}

const NAV_LINKS = [
  { href: '/',         label: 'Home'            },
  { href: '/search',   label: 'Browse Products' },
  { href: '/advisors', label: 'Advisors'        },
];

export default function PublicLayout({ children }: PublicLayoutProps) {
  const pathname                      = usePathname();
  const [scrolled,     setScrolled]   = useState(false);
  const [drawerOpen,   setDrawerOpen] = useState(false);
  const [companyName,  setCompanyName] = useState('TradeCircle');

  // Solid navbar after 50 px scroll
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Company name from Firestore config
  useEffect(() => {
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'site'));
        if (snap.exists()) {
          const name = snap.data()?.branding?.companyName as string | undefined;
          if (name) setCompanyName(name);
        }
      } catch { /* keep default */ }
    })();
  }, []);

  // Close drawer on navigation
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const btnBase: React.CSSProperties = {
    padding: '8px 18px', borderRadius: 8, fontSize: 14,
    fontWeight: 500, cursor: 'pointer',
  };

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          .pl-desktop { display: none !important; }
          .pl-mobile  { display: flex !important; }
        }
        @media (min-width: 768px) {
          .pl-desktop { display: flex !important; }
          .pl-mobile  { display: none !important; }
        }
      `}</style>

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header style={{
        position:     'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background:   scrolled ? 'var(--color-background)' : 'transparent',
        borderBottom: scrolled ? '1px solid var(--color-border)' : 'none',
        boxShadow:    scrolled ? '0 1px 8px rgba(0,0,0,0.07)' : 'none',
        transition:   'background 0.25s ease, box-shadow 0.25s ease',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 20px',
          height: 64, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>

          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.02em' }}>
              {companyName}
            </span>
          </Link>

          {/* Desktop centre nav */}
          <nav className="pl-desktop" style={{ gap: 32 }}>
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} style={{
                textDecoration: 'none', fontSize: 14,
                fontWeight: pathname === l.href ? 600 : 400,
                color: pathname === l.href ? 'var(--color-primary)' : 'var(--color-text)',
                transition: 'color 0.15s',
              }}>
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Desktop right buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="pl-desktop" style={{ gap: 10 }}>
              <Link href="/login">
                <button style={{ ...btnBase, border: '1.5px solid var(--color-primary)', background: 'transparent', color: 'var(--color-primary)' }}>
                  Login
                </button>
              </Link>
              <Link href="/signup">
                <button style={{ ...btnBase, border: 'none', background: 'var(--color-primary)', color: '#fff' }}>
                  Sign Up
                </button>
              </Link>
            </div>

            {/* Hamburger */}
            <button
              className="pl-mobile"
              onClick={() => setDrawerOpen((v) => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)', padding: 4, alignItems: 'center' }}
              aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            >
              {drawerOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile slide-down drawer */}
        <div style={{
          overflow: 'hidden',
          maxHeight: drawerOpen ? 340 : 0,
          transition: 'max-height 0.3s ease',
          background: 'var(--color-background)',
          borderTop: drawerOpen ? '1px solid var(--color-border)' : 'none',
        }}>
          <div style={{ padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} style={{
                textDecoration: 'none', fontSize: 15, padding: '12px 0',
                borderBottom: '1px solid var(--color-border)',
                fontWeight: pathname === l.href ? 600 : 400,
                color: pathname === l.href ? 'var(--color-primary)' : 'var(--color-text)',
              }}>
                {l.label}
              </Link>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <Link href="/login" style={{ flex: 1 }}>
                <button style={{ ...btnBase, width: '100%', border: '1.5px solid var(--color-primary)', background: 'transparent', color: 'var(--color-primary)' }}>
                  Login
                </button>
              </Link>
              <Link href="/signup" style={{ flex: 1 }}>
                <button style={{ ...btnBase, width: '100%', border: 'none', background: 'var(--color-primary)', color: '#fff' }}>
                  Sign Up
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Page content — offset for fixed navbar */}
      <main style={{ paddingTop: 64 }}>{children}</main>
    </>
  );
}
