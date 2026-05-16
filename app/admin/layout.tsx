/**
 * app/admin/layout.tsx
 * Next.js App Router layout for the /admin route group.
 *
 * NOTE: All admin pages (dashboard, products, users, etc.) already import
 * AdminLayout directly and wrap their own content in it. Adding another
 * AdminLayout wrapper here would double-wrap the sidebar/topbar chrome.
 *
 * This layout intentionally renders {children} only — each page manages its
 * own AdminLayout import. This file exists solely so Next.js recognises
 * /admin as a route group with a shared layout entry point.
 */

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
