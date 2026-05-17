/**
 * app/api/health/route.ts
 * Public health/diagnostic endpoint.
 *
 * Reports per-env-var presence so you can spot missing values on Vercel
 * without trawling through logs. Returns booleans only — no secret
 * values are exposed.
 *
 *   GET /api/health
 *   → { ok, firebase: {…}, firebaseAdmin, cloudinary: {…}, allFirebaseReady, timestamp }
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const firebase = {
    apiKey:            !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    projectId:         !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    authDomain:        !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    storageBucket:     !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId:             !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    measurementId:     !!process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    vapidKey:          !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  };

  const allFirebaseReady =
    firebase.apiKey &&
    firebase.projectId &&
    firebase.authDomain &&
    firebase.storageBucket &&
    firebase.appId &&
    firebase.messagingSenderId; // REQUIRED for FCM (login page crashes without it)

  const cloudinary = {
    cloudName:    !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    uploadPreset: !!process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
  };

  // Identify missing critical env vars to make the fix obvious
  const missing: string[] = [];
  if (!firebase.apiKey)            missing.push('NEXT_PUBLIC_FIREBASE_API_KEY');
  if (!firebase.projectId)         missing.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  if (!firebase.authDomain)        missing.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  if (!firebase.storageBucket)     missing.push('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
  if (!firebase.appId)             missing.push('NEXT_PUBLIC_FIREBASE_APP_ID');
  if (!firebase.messagingSenderId) missing.push('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) missing.push('FIREBASE_SERVICE_ACCOUNT_JSON');

  return NextResponse.json({
    ok: true,
    firebase,
    firebaseAdmin: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    cloudinary,
    allFirebaseReady,
    missing,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    vercelUrl:   process.env.VERCEL_URL  ?? null,
    timestamp:   new Date().toISOString(),
  });
}
