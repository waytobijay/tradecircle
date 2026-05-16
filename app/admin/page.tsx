/**
 * app/admin/page.tsx
 * /admin index — redirects to /admin/dashboard.
 * Spec ref: section 6.7 (Admin Portal)
 */

import { redirect } from 'next/navigation';

export default function AdminIndexPage() {
  redirect('/admin/dashboard');
}
