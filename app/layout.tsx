/**
 * app/layout.tsx
 * Root layout — wraps every page in the app.
 * Spec ref: section 9.1 (Tech Stack), section 8.1 (Design System)
 *
 * Responsibilities:
 *   - Sets <html> lang + suppressHydrationWarning (uiStore writes data-theme before hydration)
 *   - Metadata (title template, description, viewport)
 *   - Fonts are loaded via @import in globals.css (Sora / DM Sans / JetBrains Mono)
 *   - AuthProvider bootstraps onAuthStateChanged once at the app root
 *   - No layout chrome here — each role layout (Buyer/Seller/Advisor/Admin/Public) handles its own shell
 */

import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';

// ─────────────────────────────────────────────
// Metadata
// ─────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    default:  'TradeCircle',
    template: '%s | TradeCircle',
  },
  description: 'The all-in-one platform connecting buyers, sellers, and trade advisors.',
  keywords:    ['trade', 'commerce', 'advisors', 'marketplace', 'B2B'],
  authors:     [{ name: 'TradeCircle' }],
  robots:      { index: true, follow: true },
};

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  maximumScale: 1,
};

/**
 * Force dynamic rendering for all routes.
 * Reason: The app is fully Firebase-backed client-side (Auth + Firestore
 * onSnapshot listeners). Static pre-rendering at build time tries to evaluate
 * client modules and fails because the Firebase SDK requires window/browser
 * APIs. Forcing dynamic = 'force-dynamic' here makes Vercel render every route
 * on demand, which is the correct mode for a real-time data app.
 */
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Root layout
// ─────────────────────────────────────────────

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /*
     * suppressHydrationWarning: uiStore.applyTheme() sets data-theme on <html>
     * synchronously during client init, which would cause a hydration mismatch
     * without this flag. Safe to suppress — the only diff is data-theme.
     */
    <html lang="en" suppressHydrationWarning>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
