/**
 * services/firebase-admin.ts
 * Server-side Firebase Admin SDK initialiser.
 *
 * Reads credentials from the FIREBASE_SERVICE_ACCOUNT_JSON env var (the full
 * service-account JSON, stringified). Returns `null` from every helper when the
 * env var is missing or malformed — callers should treat that as "admin SDK
 * not configured" and degrade gracefully.
 *
 * Usage:
 *   import { adminDb, adminAuth } from '@/services/firebase-admin';
 *   const db = adminDb();
 *   if (!db) return NextResponse.json({ configured: false });
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let app: App | null = null;

export function getAdminApp(): App | null {
  if (app) return app;
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!svc) return null;
  try {
    const credentials = JSON.parse(svc);
    app =
      getApps().length === 0
        ? initializeApp({ credential: cert(credentials) })
        : getApps()[0];
    return app;
  } catch (e) {
    console.error('[firebase-admin] Failed to init:', e);
    return null;
  }
}

export const adminDb = () => {
  const a = getAdminApp();
  return a ? getFirestore(a) : null;
};

export const adminAuth = () => {
  const a = getAdminApp();
  return a ? getAuth(a) : null;
};
