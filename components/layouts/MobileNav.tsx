/**
 * components/layouts/MobileNav.tsx
 * Fixed bottom navigation bar — visible on mobile only (hidden md+).
 * Spec ref: section 2 (Navigation — Mobile)
 *
 * Layout:
 *  - 5 icons: Home | Search | Messages | Cart | Profile
 *  - Active route icon tinted with --color-primary
 *  - FAB floating above bar:
 *      Seller  → + List Product  → /products/new
 *      Advisor → + Post Advice   → /advice/new
 *      Buyer   → (no FAB)
 */

'use client';

import Link                from 'next/link';
import { usePathname }     from 'next/navigation';
import {
  Home,
  Search,
  MessageCircle,
  ShoppingCart,
  User,
  Plus,
} from 'lucide-react';
import { useAuthStore }  from '@/store/authStore';
import { useCartStore }  from '@/store/cartStore';
import type { UserRole } from '@/types';

interface MobileNavProps {
  role: UserRole;
}

interface NavItem {
  href:  string;
  icon:  React.ReactNode;
  label: string;
}

export default function MobileNav({ role }: MobileNavProps) {
  const pathname  = usePathname();
  const { user }  = useAuthStore();
  const cartCount = useCartStore((s) => s.getTotalCount());

  const items: NavItem[] = [
    { href: '/home',         icon: <Home size={22} />,          label: 'Home'     },
    { href: '/search',       icon: <Search size={22} />,        label: 'Search'   },
    { href: '/messages',     icon: <MessageCircle size={22} />, label: 'Messages' },
    { href: '/cart',         icon: <ShoppingCart size={22} />,  label: 'Cart'     },
    { href: user ? `/profile/${user.uid}` : '/login',
                             icon: <User size={22} />,          label: 'Profile'  },
  ];

  // FAB config per role
  const fab: { href: string; label: string } | null =
    role === 'seller'  ? { href: '/products/new', label: 'List Product' } :
    role === 'advisor' ? { href: '/advice/new',   label: 'Post Advice'  } :
    null;

  return (
    <>
      <style>{`
        @media (min-width: 768px) { .mn-bar, .mn-fab { display: none !important; } }
        @media (max-width: 767px) { .mn-bar, .mn-fab { display: flex   !important; } }
      `}</style>

      {/* FAB */}
      {fab && (
        <Link href={fab.href} className="mn-fab" style={{
          position: 'fixed', bottom: 72, right: 20,
          zIndex: 200,
          background: 'var(--color-primary)',
          color: '#fff',
          borderRadius: 28,
          padding: '10px 18px',
          alignItems: 'center',
          gap: 6,
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          display: 'none', // overridden by media query
        }}>
          <Plus size={16} />
          {fab.label}
        </Link>
      )}

      {/* Bottom bar */}
      <nav className="mn-bar" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 150,
        height: 62,
        background: 'var(--color-background)',
        borderTop: '1px solid var(--color-border)',
        display: 'none', // overridden by media query
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const isCart = item.href === '/cart';

          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 2, textDecoration: 'none', flex: 1, padding: '6px 0',
              color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              position: 'relative',
            }}>
              {/* Cart badge */}
              {isCart && cartCount > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 'calc(50% - 18px)',
                  background: 'var(--color-danger)', color: '#fff',
                  borderRadius: '50%', width: 15, height: 15,
                  fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid var(--color-background)',
                }}>
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
              {item.icon}
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
