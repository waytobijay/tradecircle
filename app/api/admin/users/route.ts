/**
 * app/api/admin/users/route.ts
 * Server-side user CRUD endpoints for the admin panel.
 *
 *   POST   /api/admin/users  — create a Firebase Auth user + Firestore user doc
 *   PATCH  /api/admin/users  — update auth display name + Firestore user doc
 *   DELETE /api/admin/users  — delete from Firebase Auth + Firestore
 *
 * Auth: requires the `tc-admin` cookie (matches middleware contract).
 * If firebase-admin is not configured, returns 501 with a clear message.
 *
 * Every action writes an entry to the `adminLogs` Firestore collection,
 * tagged with status='success' or 'failed' (+ errorMessage on failure).
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/services/firebase-admin';
import type { AdminLogAction, UserRole } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function unauthorized(): NextResponse {
  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 403 });
}

function notConfigured(): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error:
        'firebase-admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON in .env.local to enable admin user management.',
    },
    { status: 501 },
  );
}

function requireAdmin(req: NextRequest): string | null {
  const v = req.cookies.get('tc-admin')?.value;
  return v ? v : null;
}

async function writeLog(
  adminUid: string,
  action: AdminLogAction,
  targetUid: string | undefined,
  status: 'success' | 'failed',
  errorMessage?: string,
): Promise<void> {
  try {
    const db = adminDb();
    if (!db) return;
    await db.collection('adminLogs').add({
      adminUid,
      action,
      ...(targetUid ? { targetUid } : {}),
      status,
      ...(errorMessage ? { errorMessage } : {}),
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('[admin/users] failed to write adminLog:', e);
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidRole(r: unknown): r is UserRole {
  return r === 'buyer' || r === 'seller' || r === 'advisor';
}

function randomPassword(): string {
  // 16 chars, mixed — strong enough for a one-time temp password
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// ─── POST — create user ──────────────────────────────────────────────────────

interface CreateBody {
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  sendEmail?: boolean;
  phone?: string;
  location?: { city?: string; country?: string };
  brand?: string;
  specialty?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const adminUid = requireAdmin(req);
  if (!adminUid) return unauthorized();

  const auth = adminAuth();
  const db = adminDb();
  if (!auth || !db) return notConfigured();

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }

  const { name, email, role, password, sendEmail, phone, location, brand, specialty } = body;

  if (!name || !email || !isValidEmail(email) || !isValidRole(role)) {
    return NextResponse.json(
      { ok: false, error: 'Missing or invalid fields: name, email, role.' },
      { status: 400 },
    );
  }
  if (!sendEmail && (!password || password.length < 8)) {
    return NextResponse.json(
      { ok: false, error: 'Password must be at least 8 characters (or enable sendEmail).' },
      { status: 400 },
    );
  }

  let createdUid: string | undefined;
  try {
    const finalPassword = password && password.length >= 8 ? password : randomPassword();

    const userRecord = await auth.createUser({
      email,
      emailVerified: false,
      password: finalPassword,
      displayName: name,
      disabled: false,
    });
    createdUid = userRecord.uid;

    const doc: Record<string, unknown> = {
      uid: userRecord.uid,
      name,
      email,
      role,
      active: true,
      emailVerified: false,
      verified: false,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (phone) doc.phone = phone;
    if (location && (location.city || location.country)) {
      doc.location = { city: location.city ?? '', country: location.country ?? '' };
    }
    if (role === 'seller' && brand) doc.brand = brand;
    if (role === 'advisor' && specialty) doc.specialty = specialty;

    await db.collection('users').doc(userRecord.uid).set(doc);

    let resetLink: string | undefined;
    if (sendEmail) {
      try {
        resetLink = await auth.generatePasswordResetLink(email);
      } catch (e) {
        console.error('[admin/users] generatePasswordResetLink failed:', e);
      }
    }

    await writeLog(adminUid, 'user-create', userRecord.uid, 'success');

    return NextResponse.json({
      ok: true,
      uid: userRecord.uid,
      ...(sendEmail ? { resetLink } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeLog(adminUid, 'user-create', createdUid, 'failed', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// ─── PATCH — update user ─────────────────────────────────────────────────────

interface PatchBody {
  uid: string;
  name?: string;
  role?: UserRole;
  phone?: string;
  location?: { city?: string; country?: string };
  brand?: string;
  specialty?: string;
  active?: boolean;
  bio?: string;
  // Special action: send a password reset email and return the link
  sendPasswordReset?: boolean;
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const adminUid = requireAdmin(req);
  if (!adminUid) return unauthorized();

  const auth = adminAuth();
  const db = adminDb();
  if (!auth || !db) return notConfigured();

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }

  if (!body.uid) {
    return NextResponse.json({ ok: false, error: 'uid is required' }, { status: 400 });
  }

  // ── Side-action: password reset link ─────────────────────────────────
  if (body.sendPasswordReset) {
    try {
      const userRec = await auth.getUser(body.uid);
      const link = await auth.generatePasswordResetLink(userRec.email!);
      await writeLog(adminUid, 'user-update', body.uid, 'success');
      return NextResponse.json({ ok: true, resetLink: link });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await writeLog(adminUid, 'user-update', body.uid, 'failed', msg);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
  }

  try {
    // Update Firebase Auth (display name + disabled flag)
    const authUpdate: Record<string, unknown> = {};
    if (typeof body.name === 'string') authUpdate.displayName = body.name;
    if (typeof body.active === 'boolean') authUpdate.disabled = !body.active;
    if (Object.keys(authUpdate).length > 0) {
      await auth.updateUser(body.uid, authUpdate);
    }

    // Update Firestore
    const fsUpdate: Record<string, unknown> = {};
    if (typeof body.name === 'string') fsUpdate.name = body.name;
    if (body.role && isValidRole(body.role)) fsUpdate.role = body.role;
    if (typeof body.phone === 'string') fsUpdate.phone = body.phone;
    if (typeof body.bio === 'string') fsUpdate.bio = body.bio;
    if (body.location) {
      fsUpdate.location = {
        city: body.location.city ?? '',
        country: body.location.country ?? '',
      };
    }
    if (typeof body.brand === 'string') fsUpdate.brand = body.brand;
    if (typeof body.specialty === 'string') fsUpdate.specialty = body.specialty;
    if (typeof body.active === 'boolean') fsUpdate.active = body.active;

    if (Object.keys(fsUpdate).length > 0) {
      await db.collection('users').doc(body.uid).update(fsUpdate);
    }

    const action: AdminLogAction =
      typeof body.active === 'boolean'
        ? body.active
          ? 'user-unban'
          : 'user-ban'
        : 'user-update';

    await writeLog(adminUid, action, body.uid, 'success');
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeLog(adminUid, 'user-update', body.uid, 'failed', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// ─── DELETE — remove user ────────────────────────────────────────────────────

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const adminUid = requireAdmin(req);
  if (!adminUid) return unauthorized();

  const auth = adminAuth();
  const db = adminDb();
  if (!auth || !db) return notConfigured();

  let body: { uid?: string };
  try {
    body = (await req.json()) as { uid?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }

  const uid = body.uid;
  if (!uid) {
    return NextResponse.json({ ok: false, error: 'uid is required' }, { status: 400 });
  }

  try {
    // Delete from Firebase Auth — tolerate "user not found" so Firestore-only ghosts can be cleaned up
    try {
      await auth.deleteUser(uid);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'auth/user-not-found') throw e;
    }
    await db.collection('users').doc(uid).delete();

    await writeLog(adminUid, 'user-delete', uid, 'success');
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeLog(adminUid, 'user-delete', uid, 'failed', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
