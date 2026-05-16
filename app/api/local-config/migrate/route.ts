/**
 * app/api/local-config/migrate/route.ts
 * Migrate the local bootstrap admin into the real Firebase project.
 *
 * Requires the Firebase Admin SDK to be configured
 * (FIREBASE_SERVICE_ACCOUNT_JSON in env). Reads the local admin from
 * `.tradecircle-local/config.json` and:
 *   1. Creates (or fetches) a Firebase Auth user for that email.
 *      We use a random throwaway password — the operator should sign in
 *      via "Forgot password" or re-set via the wizard later.
 *   2. Writes adminUsers/{uid} with role='super-admin' and all permissions.
 *
 * POST → { ok, uid, email, message } | { ok:false, error }
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminAuth, adminDb } from '@/services/firebase-admin';
import { readLocalConfig } from '@/lib/localConfig';

const ALL_PERMISSIONS = {
  users:          true,
  products:       true,
  config:         true,
  exports:        true,
  analytics:      true,
  backup:         true,
  advisories:     true,
  enquiries:      true,
  orders:         true,
  ads:            true,
  aiSettings:     true,
  cms:            true,
  featureToggles: true,
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!req.cookies.get('tc-admin')?.value) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const auth = adminAuth();
  const db   = adminDb();
  if (!auth || !db) {
    return NextResponse.json(
      { ok: false, error: 'firebase_admin_not_configured' },
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

  const { email, name } = cfg.admin;

  // Step 1: get-or-create the Auth user.
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
  } catch {
    const tmpPassword = crypto.randomBytes(24).toString('base64');
    const created     = await auth.createUser({
      email,
      displayName:   name,
      password:      tmpPassword,
      emailVerified: true,
    });
    uid = created.uid;
  }

  // Step 2: write adminUsers/{uid} doc.
  await db.collection('adminUsers').doc(uid).set(
    {
      name,
      email,
      role:        'super-admin',
      permissions: ALL_PERMISSIONS,
      active:      true,
      createdAt:   new Date(),
      migratedFromLocal: true,
    },
    { merge: true },
  );

  return NextResponse.json({
    ok:      true,
    uid,
    email,
    message:
      'Admin migrated. Use "Forgot password" on the login page to set your Firebase password.',
  });
}
