/**
 * app/api/setup-check/route.ts
 * Reports whether the first-time admin setup has been completed AND whether
 * Firebase is configured.
 *
 * GET → {
 *   setupComplete:       boolean,   // local bootstrap admin exists
 *   firebaseConfigured:  boolean,   // NEXT_PUBLIC_FIREBASE_API_KEY exists OR
 *                                   // local config has firebase.apiKey
 *   configured:          boolean,   // legacy alias for setupComplete callers
 * }
 *
 * Never cached — the login page polls this on mount to choose between the
 * Firebase and local-bootstrap auth paths.
 */

import { NextResponse } from 'next/server';
import { readLocalConfig } from '@/lib/localConfig';

export async function GET(): Promise<NextResponse> {
  const cfg = await readLocalConfig();

  const envHasFirebase = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const localHasFirebase = !!cfg?.firebase?.apiKey;

  const setupComplete      = !!cfg?.admin;
  const firebaseConfigured = envHasFirebase || localHasFirebase;

  return NextResponse.json(
    {
      setupComplete,
      firebaseConfigured,
      configured: setupComplete, // back-compat for older callers
    },
    {
      status:  200,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
