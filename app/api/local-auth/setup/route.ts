/**
 * app/api/local-auth/setup/route.ts
 * Create the local bootstrap admin (first-time setup).
 *
 *   POST { name, email, password }
 *     → 409 if a local admin already exists
 *     → 200 + sets session cookies on success
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  readLocalConfig,
  writeLocalConfig,
  hashPassword,
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
  let body: { name?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const name     = (body.name  ?? '').trim();
  const email    = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  if (!name || !email || !password) {
    return NextResponse.json(
      { ok: false, error: 'missing_fields' },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: 'weak_password' },
      { status: 400 },
    );
  }

  const existing = await readLocalConfig();
  if (existing?.admin) {
    return NextResponse.json(
      { ok: false, error: 'already_setup' },
      { status: 409 },
    );
  }

  const { hash, salt } = hashPassword(password);
  await writeLocalConfig({
    admin: {
      name,
      email,
      passwordHash: hash,
      salt,
      createdAt:    new Date().toISOString(),
    },
  });

  const res = NextResponse.json({
    ok:       true,
    redirect: '/admin/firebase-setup',
  });
  res.cookies.set('tc-session', 'local',           cookieOpts());
  res.cookies.set('tc-role',    'admin',           cookieOpts());
  res.cookies.set('tc-admin',   'local-bootstrap', cookieOpts());
  return res;
}
