/**
 * components/layouts/AdminLayout.tsx
 * Shell for all admin portal pages.
 * Spec ref: section 6.7 (Admin Navigation)
 *
 * Layout:
 *  - Left sidebar: 240px expanded / 64px collapsed (desktop)
 *                  Overlay drawer on mobile
 *  - Top bar: page title (derived from pathname) + admin avatar + logout
 *  - All nav items from spec section 6.7
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link                                          from 'next/link';
import { usePathname, useRouter }                    from 'next/navigation';
import { signOut }                                   from 'firebase/auth';
import {
  LayoutDashboard, Users, Shield, Package, BookOpen,
  MessageSquare, ShoppingBag, Megaphone, Bot, FileText,
  ToggleLeft, Settings, BarChart2, Download, Database, HardDrive,
  ChevronLeft, ChevronRight, Menu, X, LogOut, User, Receipt, TrendingUp,
  AlertTriangle, UserCog, Key, Activity, Palette, CreditCard, Globe2, Gift,
  Target, Plug,
} from 'lucide-react';
import { auth }         from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';

interface AdminLayoutProps {
  children: React.ReactNode;
}

// ─── Nav items ────────────────────────────────────────────────────────────────

interface NavItem {
  href:  string;
  icon:  React.ReactNode;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/dashboard',        icon: <LayoutDashboard size={18} />, label: 'Dashboard'       },
  { href: '/admin/users',            icon: <Users           size={18} />, label: 'Users'           },
  { href: '/admin/fraud',            icon: <AlertTriangle   size={18} />, label: 'Fraud Flags'     },
  { href: '/admin/admin-users',      icon: <Shield          size={18} />, label: 'Admin Users'     },
  { href: '/admin/roles',            icon: <UserCog         size={18} />, label: 'Regional Roles'  },
  { href: '/admin/api-keys',         icon: <Key             size={18} />, label: 'API Keys'        },
  { href: '/admin/status',           icon: <Activity        size={18} />, label: 'System Status'   },
  { href: '/admin/tenant-branding',  icon: <Palette         size={18} />, label: 'Tenant Branding' },
  { href: '/admin/billing',          icon: <CreditCard      size={18} />, label: 'Operator Billing'},
  { href: '/admin/loyalty',          icon: <Gift            size={18} />, label: 'Loyalty Program' },
  { href: '/admin/campaigns',        icon: <Target          size={18} />, label: 'Ad Campaigns'    },
  { href: '/admin/integrations',     icon: <Plug            size={18} />, label: 'Marketing SSO'   },
  { href: '/admin/data-residency',   icon: <Globe2          size={18} />, label: 'Data Residency'  },
  { href: '/admin/products',         icon: <Package         size={18} />, label: 'Products'        },
  { href: '/admin/advisories',       icon: <BookOpen        size={18} />, label: 'Advisories'      },
  { href: '/admin/enquiries',        icon: <MessageSquare   size={18} />, label: 'Enquiries'       },
  { href: '/admin/orders',           icon: <ShoppingBag     size={18} />, label: 'Orders'          },
  { href: '/admin/ads',              icon: <Megaphone       size={18} />, label: 'Ads'             },
  { href: '/admin/ai-settings',      icon: <Bot             size={18} />, label: 'AI Settings'     },
  { href: '/admin/cms',              icon: <FileText        size={18} />, label: 'CMS'             },
  { href: '/admin/feature-toggles',  icon: <ToggleLeft      size={18} />, label: 'Feature Toggles' },
  { href: '/admin/configuration',    icon: <Settings        size={18} />, label: 'Configuration'   },
  { href: '/admin/tax',              icon: <Receipt         size={18} />, label: 'Tax'             },
  { href: '/admin/analytics',        icon: <BarChart2       size={18} />, label: 'Analytics'       },
  { href: '/admin/analytics-integrations', icon: <TrendingUp size={18} />, label: 'Integrations'  },
  { href: '/admin/exports',          icon: <Download        size={18} />, label: 'Exports'         },
  { href: '/admin/backup',           icon: <Database        size={18} />, label: 'System Backup'   },
  { href: '/admin/storage',          icon: <HardDrive       size={18} />, label: 'Storage'          },
];

const PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard':       'Dashboard',
  '/admin/users':           'Users',
  '/admin/fraud':           'Fraud Flags',
  '/admin/admin-users':     'Admin Users',
  '/admin/roles':           'Regional Roles',
  '/admin/api-keys':        'API Keys',
  '/admin/status':          'System Status',
  '/admin/tenant-branding': 'Tenant Branding',
  '/admin/billing':         'Operator Billing',
  '/admin/loyalty':         'Loyalty Program',
  '/admin/campaigns':       'Ad Campaigns',
  '/admin/integrations':    'Marketing SSO',
  '/admin/data-residency':  'Data Residency',
  '/admin/operators':       'Operators',
  '/admin/geo-ads':         'Geo-Targeted Ads',
  '/admin/products':        'Products',
  '/admin/advisories':      'Advisories',
  '/admin/enquiries':       'Enquiries',
  '/admin/orders':          'Orders',
  '/admin/ads':             'Ads',
  '/admin/ai-settings':     'AI Settings',
  '/admin/cms':             'CMS',
  '/admin/feature-toggles': 'Feature Toggles',
  '/admin/configuration':   'Configuration',
  '/admin/tax':             'Tax',
  '/admin/analytics':                  'Analytics',
  '/admin/analytics-integrations':     'Integrations',
  '/admin/exports':                    'Exports',
  '/admin/backup':          'System Backup',
  '/admin/storage':         'Storage',
};

// ─── Component ────────────────────────────────────────────────────────────────

const SIDEBAR_W   = 240;
const COLLAPSED_W = 64;

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname            = usePathname();
  const router              = useRouter();
  const { user, clearAuth } = useAuthStore();

  const [collapsed,    setCollapsed]    = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pageTitle = PAGE_TITLES[pathname] ?? 'Admin';
  const sidebarW  = collapsed ? COLLAPSED_W : SIDEBAR_W;
  const initials  = user?.name?.charAt(0).toUpperCase() ?? 'A';

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const handleLogout = useCallback(async () => {
    await signOut(auth);
    clearAuth();
    router.push('/login');
  }, [clearAuth, router]);

  // ── Sidebar nav item ──────────────────────────────────────────────────────
  function NavLink({ item }: { item: NavItem }) {
    const active = pathname === item.href || pathname.startsWith(item.href + '/');
    return (
      <Link href={item.href} style={{
        display: 'flex', alignItems: 'center',
        gap: collapsed ? 0 : 12,
        padding: collapsed ? '10px 0' : '10px 14px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 8, textDecoration: 'none', fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--color-primary)' : 'var(--color-text)',
        background: active ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
        transition: 'background 0.15s, color 0.15s',
        whiteSpace: 'nowrap', overflow: 'hidden',
        margin: '1px 0',
        position: 'relative',
      }}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.background = 'var(--color-surface)';
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = 'transparent';
        }}
        title={collapsed ? item.label : undefined}
      >
        <span style={{ flexShrink: 0, color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
          {item.icon}
        </span>
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  }

  // ── Sidebar content (shared between desktop + mobile drawer) ─────────────
  function SidebarContent({ mobile = false }: { mobile?: boolean }) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        padding: mobile ? '16px 12px' : `16px ${collapsed ? '8px' : '12px'}`,
        overflowY: 'auto',
      }}>
        {/* Logo + collapse toggle */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed && !mobile ? 'center' : 'space-between',
          marginBottom: 20, paddingBottom: 12,
          borderBottom: '1px solid var(--color-border)',
        }}>
          {(!collapsed || mobile) && (
            <Link href="/admin/dashboard" style={{ textDecoration: 'none' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)' }}>
                TC Admin
              </span>
            </Link>
          )}
          {!mobile && (
            <button
              onClick={() => setCollapsed((v) => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-secondary)', padding: 4, borderRadius: 6,
                display: 'flex', alignItems: 'center',
              }}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
          {mobile && (
            <button
              onClick={() => setMobileOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1 }}>
          {NAV_ITEMS.map((item) => <NavLink key={item.href} item={item} />)}
        </nav>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          .adm-sidebar-desktop { display: none !important; }
          .adm-hamburger        { display: flex !important; }
        }
        @media (min-width: 768px) {
          .adm-sidebar-desktop { display: flex !important; }
          .adm-hamburger        { display: none !important; }
        }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-background)' }}>

        {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
        <aside
          className="adm-sidebar-desktop"
          style={{
            width: sidebarW, flexShrink: 0,
            position: 'fixed', top: 0, left: 0, bottom: 0,
            background: 'var(--color-surface)',
            borderRight: '1px solid var(--color-border)',
            flexDirection: 'column',
            transition: 'width 0.2s ease',
            zIndex: 90,
            display: 'none', // overridden by media query
          }}
        >
          <SidebarContent />
        </aside>

        {/* ── Mobile drawer overlay ────────────────────────────────────────── */}
        {mobileOpen && (
          <>
            <div
              onClick={() => setMobileOpen(false)}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                zIndex: 200,
              }}
            />
            <aside style={{
              position: 'fixed', top: 0, left: 0, bottom: 0,
              width: SIDEBAR_W,
              background: 'var(--color-surface)',
              borderRight: '1px solid var(--color-border)',
              zIndex: 201,
              display: 'flex', flexDirection: 'column',
            }}>
              <SidebarContent mobile />
            </aside>
          </>
        )}

        {/* ── Main area ────────────────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          marginLeft: 0,
          display: 'flex', flexDirection: 'column',
          // Desktop: push right by sidebar width
        }}
          className="adm-main"
        >
          <style>{`
            @media (min-width: 768px) {
              .adm-main { margin-left: ${sidebarW}px !important; transition: margin-left 0.2s ease; }
            }
          `}</style>

          {/* Top bar */}
          <header style={{
            position: 'sticky', top: 0, zIndex: 80,
            height: 60,
            background: 'var(--color-background)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center',
            padding: '0 20px',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Hamburger — mobile only */}
              <button
                className="adm-hamburger"
                onClick={() => setMobileOpen(true)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text)', padding: 4, display: 'none',
                  alignItems: 'center',
                }}
                aria-label="Open menu"
              >
                <Menu size={22} />
              </button>
              <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-text)' }}>
                {pageTitle}
              </h1>
            </div>

            {/* Right: avatar + logout */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px',
                }}
              >
                {user?.profilePhoto
                  ? <img src={user.profilePhoto} alt={user.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  : <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'var(--color-primary)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 600,
                    }}>{initials}</div>
                }
                <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500 }}>
                  {user?.name ?? 'Admin'}
                </span>
              </button>

              {dropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: 'var(--color-background)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10, padding: '6px 0', minWidth: 160,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                  zIndex: 300,
                }}>
                  <Link href="/admin/dashboard" style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 16px', textDecoration: 'none', fontSize: 14,
                    color: 'var(--color-text)',
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <User size={15} color="var(--color-text-secondary)" /> Profile
                  </Link>
                  <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
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
          </header>

          {/* Page content */}
          <main style={{ flex: 1, overflowY: 'auto' }}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
