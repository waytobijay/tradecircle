/**
 * app/api/health/route.ts
 * Public health/diagnostic endpoint.
 *
 * Reports which critical environment variables are present so you can
 * confirm a Vercel deploy is wired up without trawling through logs.
 *
 * Returns booleans only — no secret values are exposed.
 *
 *   GET /api/health
 *   → { ok, firebase, firebaseAdmin, cloudinary, timestamp }
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    firebase: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    firebaseAdmin: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    cloudinary: !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    timestamp: new Date().toISOString(),
  });
}
