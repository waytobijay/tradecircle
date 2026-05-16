/**
 * app/api/local-auth/reset/route.ts
 * Deletes the local bootstrap admin so /setup can be re-run.
 *
 * SECURITY: This endpoint is local-dev only — it refuses to run on
 * serverless platforms (Vercel/Lambda) where the filesystem is read-only
 * and the local config doesn't exist anyway.
 *
 * No authentication required because:
 *   1. It only works in local dev
 *   2. The only side-effect is to allow re-running /setup
 *   3. The pre-existing local admin's email/hash are deleted but no further
 *      access is granted — the operator still has to re-create the admin
 *
 * DELETE /api/local-auth/reset
 */

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const CONFIG_DIR  = path.join(process.cwd(), '.tradecircle-local');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export async function DELETE(): Promise<NextResponse> {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return NextResponse.json(
      {
        ok: false,
        error: 'not_available_in_production',
        message: 'Reset is only available in local development.',
      },
      { status: 403 },
    );
  }

  try {
    // Read existing config, strip admin field, write back. This preserves
    // sessionSecret and any saved firebase/cloudinary credentials.
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8').catch(() => null);
    if (!raw) {
      return NextResponse.json({ ok: true, alreadyEmpty: true });
    }
    const config = JSON.parse(raw);
    delete config.admin;
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');

    const res = NextResponse.json({ ok: true });
    // Also clear any active session so the operator returns to /setup cleanly
    for (const name of ['tc-session', 'tc-role', 'tc-admin']) {
      res.cookies.set(name, '', { path: '/', maxAge: 0 });
    }
    return res;
  } catch (err) {
    const e = err as Error;
    return NextResponse.json(
      { ok: false, error: 'reset_failed', message: e.message },
      { status: 500 },
    );
  }
}
