/**
 * app/api/setup-check/route.ts
 * Reports whether the first-time admin setup has been completed.
 *
 * GET → { setupComplete: boolean, configured: boolean }
 *   - configured=false means the Firebase Admin SDK env vars are missing,
 *     so we cannot answer authoritatively. The setup page should still load
 *     in that case (allow the user to bootstrap from the client).
 *
 * Cached for 60s via `Cache-Control` to reduce Firestore reads while the
 * platform is being warmed up.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function GET(): Promise<NextResponse> {
  const db = adminDb();
  if (!db) {
    return NextResponse.json(
      { setupComplete: false, configured: false },
      {
        status: 200,
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
      },
    );
  }

  try {
    const snap = await db
      .collection('adminUsers')
      .where('role', '==', 'super-admin')
      .limit(1)
      .get();

    const setupComplete = !snap.empty;

    return NextResponse.json(
      { setupComplete, configured: true },
      {
        status: 200,
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
      },
    );
  } catch (err) {
    console.error('[/api/setup-check] Failed to query adminUsers:', err);
    return NextResponse.json(
      { setupComplete: false, configured: true, error: 'query_failed' },
      { status: 500 },
    );
  }
}
