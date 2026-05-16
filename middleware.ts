/**
 * middleware.ts
 * Next.js Edge Middleware — route protection for TradeCircle.
 * Spec ref: section 2 (Site Architecture), section 9.7 (Security)
 *
 * ─── How auth works in middleware ───────────────────────────────────────────
 * Firebase Auth stores tokens in IndexedDB (browser-only), which is
 * unavailable in the Edge runtime. Instead, this middleware checks for an
 * HTTP cookie (`tc-session`) that is set server-side after sign-in.
 *
 * Cookie flow (to be wired up in app/api/session/route.ts):
 *   1. User signs in via Firebase Auth (client-side)
 *   2. Client calls POST /api/session with the Firebase ID token
 *   3. /api/session verifies the token with firebase-admin and sets:
 *        tc-session  → httpOnly, Secure, SameSite=Strict (auth presence)
 *        tc-role     → the user's role (buyer | seller | advisor)
 *        tc-admin    → present only for verified adminUsers (httpOnly)
 *   4. On sign-out, client calls DELETE /api/session to clear cookies
 *
 * Until /api/session is wired up, authenticated pages will redirect to
 * /login on hard refresh. Client-side RoleGuard handles the in-app
 * protection in the meantime.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────────
// Cookie names (must match /api/session route)
// ─────────────────────────────────────────────

const SESSION_COOKIE  = 'tc-session';
const ADMIN_COOKIE    = 'tc-admin';

// ─────────────────────────────────────────────
// Route definitions
// ─────────────────────────────────────────────

/**
 * Routes that require NO authentication.
 * Exact matches and prefix matches are handled separately below.
 * Spec ref: section 2 (PUBLIC routes in site map)
 */
const PUBLIC_EXACT: ReadonlySet<string> = new Set([
  '/',
  '/login',
  '/signup',
  '/about',
  '/contact',
  '/faq',
  '/privacy',
  '/terms',
  '/cookies',
  '/search',
]);

/**
 * Route prefixes that are public regardless of what follows.
 * e.g. /signup/buyer, /product/abc123, /advisor/xyz
 */
const PUBLIC_PREFIXES: readonly string[] = [
  '/signup/',
  '/product/',
  '/advisor/',
];

/** Routes that require an active admin session (tc-admin cookie). */
const ADMIN_PREFIX = '/admin';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);
  // Preserve the intended destination so the login page can redirect back
  loginUrl.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

function redirectToHome(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL('/home', request.url));
}

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // ── 1. Always allow public routes ──────────
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const adminCookie   = request.cookies.get(ADMIN_COOKIE)?.value;

  // ── 2. Admin routes (/admin/*) ─────────────
  // Requires both a valid session AND admin cookie.
  // Spec ref: section 6.7 (Admin Portal — admin/super-admin only)
  if (pathname.startsWith(ADMIN_PREFIX)) {
    if (!sessionCookie) {
      return redirectToLogin(request);
    }
    if (!adminCookie) {
      // Authenticated but not an admin — send to their own home
      return redirectToHome(request);
    }
    return NextResponse.next();
  }

  // ── 3. All other protected routes ──────────
  // Requires an active session cookie.
  if (!sessionCookie) {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}

// ─────────────────────────────────────────────
// Matcher config
// Tells Next.js which paths to run this middleware on.
// Excludes: _next internals, static files, images, favicon, API routes.
// ─────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - _next/static  (static chunks)
     *   - _next/image   (image optimisation)
     *   - favicon.ico
     *   - public folder files (png, jpg, svg, etc.)
     *   - /api routes (handled by their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js)$).*)',
  ],
};
