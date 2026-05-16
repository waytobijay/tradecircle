/**
 * app/layout.tsx
 * Root layout — wraps every page in the app.
 * Spec ref: section 9.1 (Tech Stack), section 8.1 (Design System)
 *
 * Responsibilities:
 *   - Sets <html> lang + suppressHydrationWarning (uiStore writes data-theme before hydration)
 *   - Metadata (title template, description, viewport)
 *   - Fonts loaded via next/font/google (self-hosted, preloaded, no render-blocking CSS)
 *   - AuthProvider bootstraps onAuthStateChanged once at the app root
 *   - No layout chrome here — each role layout (Buyer/Seller/Advisor/Admin/Public) handles its own shell
 */

import type { Metadata, Viewport } from 'next';
import { Sora, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';

// ─────────────────────────────────────────────
// Fonts — self-hosted via next/font (no external CSS request)
// CSS variables fall through to the --font-heading / --font-body / --font-mono
// tokens declared in globals.css so existing rules keep working.
// ─────────────────────────────────────────────

const sora = Sora({
  subsets:  ['latin'],
  weight:   ['500', '600', '700'],
  variable: '--font-heading',
  display:  'swap',
});

const dmSans = DM_Sans({
  subsets:  ['latin'],
  weight:   ['400', '500'],
  variable: '--font-body',
  display:  'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets:  ['latin'],
  weight:   ['400'],
  variable: '--font-mono',
  display:  'swap',
});

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

/*
 * NOTE: `export const dynamic = 'force-dynamic'` was previously declared here.
 * It has been removed so static pages (about, privacy, terms, contact, faq,
 * cookies) can be statically optimised. Pages that genuinely require dynamic
 * rendering should declare `dynamic = 'force-dynamic'` themselves (server
 * pages only — client `'use client'` files cannot export route segment config
 * and instead should be wrapped in a server page that uses next/dynamic with
 * ssr: false if pre-render fails).
 */

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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sora.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
