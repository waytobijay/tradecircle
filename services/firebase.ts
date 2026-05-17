/**
 * services/firebase.ts
 * Initialises Firebase and exports shared service instances.
 * Spec ref: section 9.1 (Firebase as primary backend)
 *
 * Bootstrap-friendly behaviour:
 *   - If `NEXT_PUBLIC_FIREBASE_API_KEY` is present we initialise normally.
 *   - Otherwise we DO NOT initialise — `db`, `auth`, and `storage` are all
 *     `null`. Callers must handle the unconfigured case gracefully. The
 *     `/setup` page and `/admin/firebase-setup` wizard both work without
 *     Firebase being live.
 *
 * NOTE: This module is shared between client and server. Direct reads from
 * the local-config file happen only via API routes — we never touch `fs`
 * from this module since it'd break the client bundle.
 *
 * Usage:
 *   import { db, auth, storage, isFirebaseConfigured } from '@/services/firebase'
 *   if (!db) { ... handle no-op ... }
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore }                     from 'firebase/firestore';
import { getAuth, Auth }                               from 'firebase/auth';
import { getStorage, FirebaseStorage }                 from 'firebase/storage';

// ─────────────────────────────────────────────
// Config — env vars only on this module path.
// (Local-config values are pulled into env at deploy time by the wizard.)
// ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // messagingSenderId is REQUIRED by firebase/messaging (FCM). Without it,
  // getMessaging() throws "messaging/missing-app-config-values" and crashes
  // any page that mounts FCMRegistrar (or imports the messaging module).
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  // measurementId is optional — only used when Analytics is enabled.
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
} as const;

export const isFirebaseConfigured: boolean =
  !!firebaseConfig.apiKey && !!firebaseConfig.projectId && !!firebaseConfig.appId;

// ─────────────────────────────────────────────
// Initialisation — no-op when env is missing.
// ─────────────────────────────────────────────

let _app:     FirebaseApp      | null = null;
let _db:      Firestore        | null = null;
let _auth:    Auth             | null = null;
let _storage: FirebaseStorage  | null = null;

if (isFirebaseConfigured) {
  try {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    _db      = getFirestore(_app);
    _auth    = getAuth(_app);
    _storage = getStorage(_app);
  } catch (err) {
    console.error('[TradeCircle] Firebase init failed:', err);
  }
} else if (typeof window !== 'undefined' || process.env.NODE_ENV === 'development') {
  // One clear, actionable warning — not a wall of per-key warnings.
  console.warn(
    '[TradeCircle] Firebase not configured — visit /admin/firebase-setup to ' +
    'connect your Firebase project. Running in local-bootstrap mode.',
  );
}

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

/**
 * NOTE on `null`:
 *   The `as Firestore` / `as Auth` casts below preserve type-compatibility
 *   for the bulk of the codebase, but at runtime these are `null` when
 *   Firebase isn't configured. New code should prefer
 *   `isFirebaseConfigured` + null-checks. Existing imports that assume
 *   non-null will throw, which is correct — those paths shouldn't be hit
 *   in bootstrap mode.
 */
export const app     = _app     as unknown as FirebaseApp;
export const db      = _db      as unknown as Firestore;
export const auth    = _auth    as unknown as Auth;
export const storage = _storage as unknown as FirebaseStorage;
