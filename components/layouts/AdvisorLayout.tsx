/**
 * components/layouts/AdvisorLayout.tsx
 * Authenticated shell for Advisor role.
 * Spec ref: section 2 (Navigation — Advisor)
 *
 * Navbar:
 *  - Left:   Logo
 *  - Centre: Home | My Advice | Enquiries | Messages
 *  - Right:  Notification bell + Profile dropdown
 * Dropdown: Profile / Settings / Logout
 * Bottom: MobileNav
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link                                          from 'next/link';
import { usePathname, useRouter }                    from 'next/navigation';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { signOut }                                   from 'firebase/auth';
import {
  Bell, ChevronDown,
  User, Settings, LogOut,
} from 'lucide-react';
import { db, auth }     from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import MobileNav        from './MobileNav';

interface AdvisorLayoutProps {
  children: React.ReactNode;
}

const NAV_LINKS = [
  { href: '/home',       label: 'Home'      },
  { href: '/my-advice',  label: 'My Advice' },
  { href: '/enquiries',  label: 'Enquiries' },
  { href: '/messages',   label: 'Messages'  },
];

export default function AdvisorLayout({ children }: AdvisorLayoutProps) {
  const pathname            = usePathname();
  const router              = useRouter();
  const { user, clearAuth } = useAuthStore();
  const uid                 = user?.uid ?? '';

  const [unread,       setUnread]       = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'notifications', uid, 'items'),
      where('read', '==', false),
      limit(20),
    );
    return onSnapshot(q, (snap) => setUnread(snap.size));
  }, [uid]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setDropdownOpen(false); }, [pathname]);

  const handleLogout = useCallback(async () => {
    setDropdownOpen(false);
    await signOut(auth);
    clearAuth();
    router.push('/login');
  }, [clearAuth, router]);

  const initials = user?.name?.charAt(0).toUpperCase() ?? '?';

  return (
    <>
      <style>{`
        @media (max-width: 767px) { .al-desktop { display: none !important; } }
        @media (min-width: 768px) { .al-desktop { display: flex !important; } }
      `}</style>

      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--color-background)',
        borderBottom: '1px solid var(--color-border)',
        height: 64,
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 20px',
          height: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>

          <Link href="/home" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-advisor, #7c3aed)', letterSpacing: '-0.02em' }}>
              TradeCircle
            </span>
          </Link>

          <nav className="al-desktop" style={{ gap: 28 }}>
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} style={{
                textDecoration: 'none', fontSize: 14,
                fontWeight: pathname.startsWith(l.href) ? 600 : 400,
                color: pathname.startsWith(l.href) ? 'var(--color-advisor, #7c3aed)' : 'var(--color-text)',
                transition: 'color 0.15s',
              }}>
                {l.label}
              </Link>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

            {/* Bell */}
            <Link href="/notifications" style={{ position: 'relative', padding: 8, display: 'flex', color: 'var(--color-text)', textDecoration: 'none' }}>
              <Bell size={20} />
              {unread > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  background: 'var(--color-danger)', color: '#fff',
                  borderRadius: '50%', width: 16, height: 16,
                  fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid var(--color-background)',
                }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>

            {/* Avatar dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '4px 6px', borderRadius: 8,
                }}
              >
                {user?.profilePhoto
                  ? <img src={user.profilePhoto} alt={user.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  : <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'var(--color-advisor, #7c3aed)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 600,
                    }}>{initials}</div>
                }
                <ChevronDown size={14} color="var(--color-text-secondary)" className="al-desktop" style={{ display: 'none' }} />
              </button>

              {dropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: 'var(--color-background)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12, padding: '6px 0',
                  minWidth: 180,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                  zIndex: 200,
                }}>
                  {[
                    { href: `/profile/${uid}`, icon: <User size={15} />,     label: 'Profile'  },
                    { href: '/settings',       icon: <Settings size={15} />, label: 'Settings' },
                  ].map((item) => (
                    <Link key={item.href} href={item.href} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 16px', textDecoration: 'none', fontSize: 14,
                      color: 'var(--color-text)',
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ color: 'var(--color-text-secondary)' }}>{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                  <div style={{ borderTop: '1px solid var(--color-border)', margin: '6px 0' }} />
                  <button
                    onClick={() => void handleLogout()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '9px 16px', background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: 14, color: 'var(--color-danger)', textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main style={{ paddingTop: 64, paddingBottom: 80 }}>{children}</main>
      <MobileNav role="advisor" />
    </>
  );
}



export { AdvisorLayout };
