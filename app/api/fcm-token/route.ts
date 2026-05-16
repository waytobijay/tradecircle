/**
 * app/api/fcm-token/route.ts
 * Server-side route for sending a Firebase Cloud Messaging push notification
 * to a specific user by uid.
 *
 * POST body: { uid: string; title: string; body: string; linkTo?: string }
 *
 * ── Real implementation (when firebase-admin is installed) ────────────────
 * Install: npm install firebase-admin
 * Add to .env.local (server-only):
 *   FIREBASE_ADMIN_PROJECT_ID=...
 *   FIREBASE_ADMIN_CLIENT_EMAIL=...
 *   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
 *
 * Then replace the stub below with the commented-out real implementation.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';

// ─────────────────────────────────────────────
// Request body type
// ─────────────────────────────────────────────

interface FCMSendBody {
  uid:     string;
  title:   string;
  body:    string;
  linkTo?: string;
}

// ─────────────────────────────────────────────
// POST /api/fcm-token
// ─────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  let parsed: FCMSendBody;

  try {
    parsed = (await req.json()) as FCMSendBody;
  } catch {
    return NextResponse.json({ success: false, reason: 'Invalid JSON body' }, { status: 400 });
  }

  const { uid, title, body, linkTo = '/' } = parsed;

  if (!uid || !title || !body) {
    return NextResponse.json(
      { success: false, reason: 'Missing required fields: uid, title, body' },
      { status: 400 }
    );
  }

  // ── Read the FCM token from Firestore ──────
  let token: string | undefined;

  try {
    const tokenSnap = await getDoc(doc(db, 'fcmTokens', uid));
    if (!tokenSnap.exists()) {
      return NextResponse.json(
        { success: false, reason: 'No FCM token registered for this user' },
        { status: 404 }
      );
    }
    token = (tokenSnap.data() as { token?: string }).token;
  } catch (err) {
    console.error('[/api/fcm-token] Firestore read failed:', err);
    return NextResponse.json({ success: false, reason: 'Firestore error' }, { status: 500 });
  }

  if (!token) {
    return NextResponse.json(
      { success: false, reason: 'FCM token field is empty' },
      { status: 404 }
    );
  }

  // ── STUB: firebase-admin not installed ────
  //
  // When firebase-admin is added, replace this block with:
  //
  //   import * as admin from 'firebase-admin';
  //
  //   if (!admin.apps.length) {
  //     admin.initializeApp({
  //       credential: admin.credential.cert({
  //         projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
  //         clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  //         privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  //       }),
  //     });
  //   }
  //
  //   const messageId = await admin.messaging().send({
  //     token,
  //     notification: { title, body },
  //     data: { linkTo },
  //     webpush: {
  //       fcmOptions: { link: linkTo },
  //       notification: { icon: '/icons/icon-192x192.png', badge: '/icons/icon-72x72.png' },
  //     },
  //   });
  //
  //   return NextResponse.json({ success: true, messageId });
  //
  // ─────────────────────────────────────────

  console.warn(
    '[/api/fcm-token] firebase-admin is not installed. ' +
    'Install it and uncomment the real send() implementation in this file. ' +
    `Would have sent "${title}" to uid=${uid} token=${token.slice(0, 20)}…`
  );

  return NextResponse.json(
    {
      success: false,
      reason:  'firebase-admin not installed — see route.ts for the real implementation',
    },
    { status: 501 }
  );
}
