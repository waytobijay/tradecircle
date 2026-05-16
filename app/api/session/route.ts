/**
 * app/api/session/route.ts
 * Cookie-based session management for TradeCircle.
 * Spec ref: middleware.ts cookie contract (tc-session, tc-role, tc-admin)
 *
 * NOTE: This implementation decodes the Firebase JWT payload manually
 * without server-side signature verification. This is acceptable for MVP.
 * Replace with firebase-admin token verification once the package is added.
 *
 * Cookie contract (must match middleware.ts):
 *   tc-session  → uid of the signed-in user
 *   tc-role     → 'buyer' | 'seller' | 'advisor'
 *   tc-admin    → uid of the admin user (present only when isAdmin === true)
 */

import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const SESSION_COOKIE = 'tc-session';
const ROLE_COOKIE    = 'tc-role';
const ADMIN_COOKIE   = 'tc-admin';
const MAX_AGE        = 60 * 60 * 24 * 7; // 7 days in seconds

const IS_PRODUCTION  = process.env.NODE_ENV === 'production';

// ─────────────────────────────────────────────
// JWT helpers (no signature verification — MVP)
// ─────────────────────────────────────────────

interface FirebaseClaims {
  sub?: string;   // uid
  uid?: string;
  email?: string;
  exp?: number;
}

/**
 * Decode the payload segment of a Firebase JWT without verifying the signature.
 * Firebase JWTs are structured as header.payload.signature, each base64url-encoded.
 */
function decodeJwtPayload(idToken: string): FirebaseClaims {
  try {
    const segments = idToken.split('.');
    if (segments.length !== 3) {
      throw new Error('Invalid JWT structure — expected 3 segments.');
    }

    // base64url → base64 → Buffer → JSON
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    // Pad to a multiple of 4
    const padded = base64 + '=='.slice(0, (4 - (base64.length % 4)) % 4);
    const jsonStr = Buffer.from(padded, 'base64').toString('utf8');

    return JSON.parse(jsonStr) as FirebaseClaims;
  } catch {
    throw new Error('Failed to decode JWT payload.');
  }
}

// ─────────────────────────────────────────────
// Cookie helpers
// ─────────────────────────────────────────────

interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
}

const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure:   IS_PRODUCTION,
  sameSite: 'lax',
  path:     '/',
  maxAge:   MAX_AGE,
};

const CLEAR_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure:   IS_PRODUCTION,
  sameSite: 'lax',
  path:     '/',
  maxAge:   0,
};

// ─────────────────────────────────────────────
// POST /api/session
// Exchange Firebase ID token for session cookies.
// Body: { idToken: string, role: string, isAdmin: boolean }
// ─────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      idToken?: string;
      role?: string;
      isAdmin?: boolean;
    };

    const { idToken, role, isAdmin = false } = body;

    if (!idToken) {
      return NextResponse.json(
        { error: 'idToken is required.' },
        { status: 400 }
      );
    }

    if (!role || !['buyer', 'seller', 'advisor'].includes(role)) {
      return NextResponse.json(
        { error: 'role must be one of: buyer, seller, advisor.' },
        { status: 400 }
      );
    }

    // Decode JWT payload (MVP: no signature verification)
    let claims: FirebaseClaims;
    try {
      claims = decodeJwtPayload(idToken);
    } catch {
      return NextResponse.json(
        { error: 'Invalid ID token.' },
        { status: 401 }
      );
    }

    // Check token expiry
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
      return NextResponse.json(
        { error: 'ID token has expired.' },
        { status: 401 }
      );
    }

    const uid = claims.uid ?? claims.sub;
    if (!uid) {
      return NextResponse.json(
        { error: 'Could not extract uid from token.' },
        { status: 401 }
      );
    }

    // Build response and set cookies
    const response = NextResponse.json(
      {
        authenticated: true,
        uid,
        email: claims.email ?? null,
        role,
        isAdmin,
      },
      { status: 200 }
    );

    response.cookies.set(SESSION_COOKIE, uid, COOKIE_OPTIONS);
    response.cookies.set(ROLE_COOKIE, role, COOKIE_OPTIONS);

    if (isAdmin) {
      response.cookies.set(ADMIN_COOKIE, uid, COOKIE_OPTIONS);
    }

    return response;
  } catch (err) {
    console.error('[/api/session POST]', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// DELETE /api/session
// Clear all session cookies (sign-out).
// ─────────────────────────────────────────────

export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json(
    { authenticated: false },
    { status: 200 }
  );

  response.cookies.set(SESSION_COOKIE, '', CLEAR_OPTIONS);
  response.cookies.set(ROLE_COOKIE, '', CLEAR_OPTIONS);
  response.cookies.set(ADMIN_COOKIE, '', CLEAR_OPTIONS);

  return response;
}

// ─────────────────────────────────────────────
// GET /api/session
// Return current session status from cookies.
// ─────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionValue = request.cookies.get(SESSION_COOKIE)?.value ?? null;
  const roleValue    = request.cookies.get(ROLE_COOKIE)?.value ?? null;
  const adminValue   = request.cookies.get(ADMIN_COOKIE)?.value ?? null;

  const authenticated = Boolean(sessionValue);

  return NextResponse.json(
    {
      authenticated,
      uid:     authenticated ? sessionValue : null,
      role:    authenticated ? roleValue    : null,
      isAdmin: Boolean(adminValue),
    },
    { status: 200 }
  );
}
