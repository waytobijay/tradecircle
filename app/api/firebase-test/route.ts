/**
 * app/api/firebase-test/route.ts
 * Validate a Firebase config payload before the wizard saves it.
 *
 *   POST { apiKey, authDomain, projectId, storageBucket, appId, messagingSenderId }
 *     → { ok: true }                    when the SDK accepts the keys
 *     → { ok: false, error: '...' }     otherwise
 *
 * We initialise a *named*, throw-away Firebase app so we don't pollute the
 * shared default app used by the rest of the platform.
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

interface Body {
  apiKey?:            string;
  authDomain?:        string;
  projectId?:         string;
  storageBucket?:     string;
  appId?:             string;
  messagingSenderId?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const required: (keyof Body)[] = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing = required.filter((k) => !body[k]);
  if (missing.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Missing required fields: ${missing.join(', ')}` },
      { status: 400 },
    );
  }

  // Unique name so concurrent tests don't collide and so we never touch
  // the default app instance used by services/firebase.ts.
  const testName = `tc-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const app = initializeApp(
      {
        apiKey:            body.apiKey,
        authDomain:        body.authDomain,
        projectId:         body.projectId,
        storageBucket:     body.storageBucket,
        appId:             body.appId,
        messagingSenderId: body.messagingSenderId,
      },
      testName,
    );

    // Touching getAuth() forces the SDK to parse the config; if it's
    // malformed (missing apiKey, etc.) this throws synchronously.
    const auth = getAuth(app);
    const opts = auth.app.options;
    if (!opts.apiKey || !opts.projectId) {
      throw new Error('Config rejected by Firebase SDK');
    }

    // Clean up so we don't leak app instances.
    try {
      await deleteApp(app);
    } catch {
      /* ignore */
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Best-effort cleanup if init partially succeeded.
    const stale = getApps().find((a) => a.name === testName);
    if (stale) {
      try { await deleteApp(stale); } catch { /* ignore */ }
    }
    const message = err instanceof Error ? err.message : 'Unknown Firebase error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
