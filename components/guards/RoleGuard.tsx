/**
 * components/guards/RoleGuard.tsx
 * Role-based route protection component.
 * Spec ref: section 2 (Role-based navigation)
 *
 * Behaviour:
 *   - Auth resolving  → centred spinner
 *   - Unauthenticated → redirect /login
 *   - Wrong role      → redirect /home
 *   - Correct role    → render children
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children:     React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user, role, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (role && !allowedRoles.includes(role)) router.replace('/home');
  }, [user, role, loading, allowedRoles, router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid var(--color-border)',
          borderTop: '3px solid var(--color-primary)',
          animation: 'rg-spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes rg-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user || (role && !allowedRoles.includes(role))) return null;

  return <>{children}</>;
}
