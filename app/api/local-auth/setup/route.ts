/**
 * app/api/local-auth/setup/route.ts
 * Create the bootstrap super-admin (first-time setup).
 *
 * Behaviour:
 *   - Local dev (writable filesystem):
 *       writes to .tradecircle-local/config.json via lib/localConfig
 *   - Production / Vercel (read-only filesystem):
 *       writes directly to Firebase Auth + Firestore via firebase-admin
 *       (requires FIREBASE_SERVICE_ACCOUNT_JSON env var)
 *
 *   POST { name, email, password }
 *     → 409 if admin already exists
 *     → 503 if running on Vercel without firebase-admin configured
 *     → 200 + sets session cookies on success
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  readLocalConfig,
  writeLocalConfig,
  hashPassword,
} from '@/lib/localConfig';
import { adminAuth, adminDb } from '@/services/firebase-admin';

const SEVEN_DAYS = 60 * 60 * 24 * 7;

function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
    maxAge:   SEVEN_DAYS,
  };
}

/** Detect read-only deploy environments (Vercel, AWS Lambda). */
function isReadOnlyEnv(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
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
      { ok: false, error: 'missing_fields', message: 'Name, email and password are required.' },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: 'weak_password', message: 'Password must be at least 8 characters.' },
      { status: 400 },
    );
  }

  // ── Production / Vercel path — write to Firebase directly ────────────
  if (isReadOnlyEnv()) {
    const auth = adminAuth();
    const db   = adminDb();

    if (!auth || !db) {
      return NextResponse.json(
        {
          ok: false,
          error: 'admin_sdk_not_configured',
          message:
            'FIREBASE_SERVICE_ACCOUNT_JSON env var is not set on this deployment. ' +
            'Add it in Vercel → Settings → Environment Variables, then redeploy.',
        },
        { status: 503 },
      );
    }

    try {
      // Check if any super-admin already exists
      const existingSnap = await db
        .collection('adminUsers')
        .where('role', '==', 'super-admin')
        .limit(1)
        .get();
      if (!existingSnap.empty) {
        return NextResponse.json(
          { ok: false, error: 'already_setup' },
          { status: 409 },
        );
      }

      // Create Firebase Auth user
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
        emailVerified: false,
      });

      // Write adminUsers/{uid} doc
      const FieldValue = (await import('firebase-admin/firestore')).FieldValue;
      await db.collection('adminUsers').doc(userRecord.uid).set({
        id:    userRecord.uid,
        name,
        email,
        role:  'super-admin',
        permissions: {
          users: true, products: true, advisories: true, enquiries: true,
          orders: true, ads: true, aiSettings: true, cms: true,
          featureToggles: true, config: true, analytics: true,
          exports: true, backup: true,
        },
        createdAt: FieldValue.serverTimestamp(),
        active: true,
      });

      const res = NextResponse.json({
        ok:       true,
        redirect: '/admin/dashboard?welcome=true',
        mode:     'firebase',
      });
      res.cookies.set('tc-session', userRecord.uid, cookieOpts());
      res.cookies.set('tc-role',    'admin',        cookieOpts());
      res.cookies.set('tc-admin',   userRecord.uid, cookieOpts());
      return res;
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'auth/email-already-exists') {
        return NextResponse.json(
          {
            ok: false,
            error: 'email_in_use',
            message:
              'This email already exists in Firebase Auth. Use a different email, ' +
              'or delete the existing user in Firebase Console.',
          },
          { status: 409 },
        );
      }
      console.error('[setup] firebase admin error:', e);
      return NextResponse.json(
        {
          ok: false,
          error: 'firebase_error',
          message: e.message ?? 'Failed to create admin in Firebase.',
        },
        { status: 500 },
      );
    }
  }

  // ── Local dev path — write to .tradecircle-local/config.json ─────────
  try {
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
      mode:     'local',
    });
    res.cookies.set('tc-session', 'local',           cookieOpts());
    res.cookies.set('tc-role',    'admin',           cookieOpts());
    res.cookies.set('tc-admin',   'local-bootstrap', cookieOpts());
    return res;
  } catch (err) {
    const e = err as Error;
    console.error('[setup] local config write failed:', e);
    return NextResponse.json(
      {
        ok: false,
        error: 'local_write_failed',
        message:
          'Failed to write local config file. ' +
          'On serverless platforms (Vercel/Lambda), the filesystem is read-only. ' +
          'Set FIREBASE_SERVICE_ACCOUNT_JSON env var to use Firebase instead.',
      },
      { status: 500 },
    );
  }
}
