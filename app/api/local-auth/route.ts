/**
 * app/api/local-auth/route.ts
 * Local credential auth — used while Firebase is not yet configured.
 *
 *   POST   /api/local-auth         — login with { email, password }
 *   DELETE /api/local-auth         — clear cookies (logout)
 *   POST   /api/local-auth/setup   — handled in ./setup/route.ts
 *
 * On successful POST we set three cookies (matching the regular
 * Firebase-based session) so the existing middleware accepts the request:
 *   tc-session  = 'local'              HttpOnly, 7 days
 *   tc-role     = 'admin'              HttpOnly, 7 days
 *   tc-admin    = 'local-bootstrap'    HttpOnly, 7 days
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  readLocalConfig,
  verifyPassword,
} from '@/lib/localConfig';

const SEVEN_DAYS = 60 * 60 * 24 * 7;

function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
    maxAge:   SEVEN_DAYS,
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const email    = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: 'missing_credentials' },
      { status: 400 },
    );
  }

  const cfg = await readLocalConfig();
  if (!cfg?.admin) {
    return NextResponse.json(
      { ok: false, error: 'no_local_admin' },
      { status: 404 },
    );
  }

  if (cfg.admin.email.toLowerCase() !== email) {
    return NextResponse.json(
      { ok: false, error: 'invalid_credentials' },
      { status: 401 },
    );
  }

  const ok = verifyPassword(password, cfg.admin.passwordHash, cfg.admin.salt);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: 'invalid_credentials' },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true, redirect: '/admin/dashboard' });
  res.cookies.set('tc-session', 'local',           cookieOpts());
  res.cookies.set('tc-role',    'admin',           cookieOpts());
  res.cookies.set('tc-admin',   'local-bootstrap', cookieOpts());
  return res;
}

export async function DELETE(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  // Expire all three cookies immediately.
  for (const name of ['tc-session', 'tc-role', 'tc-admin']) {
    res.cookies.set(name, '', { ...cookieOpts(), maxAge: 0 });
  }
  return res;
}
