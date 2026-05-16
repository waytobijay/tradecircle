/**
 * services/firebase.ts
 * Initialises Firebase and exports shared service instances.
 * Spec ref: section 9.1 (Firebase as primary backend)
 *
 * Usage:
 *   import { db, auth, storage } from '@/services/firebase'
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// ─────────────────────────────────────────────
// Config — all values from environment variables
// Never hardcode keys here. Spec ref: section 9.7
// ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey:        process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId:     process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  authDomain:    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId:         process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

// ─────────────────────────────────────────────
// Validate required env vars at startup
// Surfaces missing config clearly in development
// ─────────────────────────────────────────────
const requiredVars: Array<keyof typeof firebaseConfig> = [
  'apiKey',
  'projectId',
  'authDomain',
  'storageBucket',
  'appId',
];

if (typeof window !== 'undefined' || process.env.NODE_ENV === 'development') {
  requiredVars.forEach((key) => {
    if (!firebaseConfig[key]) {
      console.warn(
        `[TradeCircle] Missing Firebase env var: NEXT_PUBLIC_FIREBASE_${key
          .replace(/([A-Z])/g, '_$1')
          .toUpperCase()}`
      );
    }
  });
}

// ─────────────────────────────────────────────
// Initialisation — guarded against double-init
// Next.js hot-reload can call this module twice;
// getApps() check prevents "already initialised" error.
// ─────────────────────────────────────────────
const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ─────────────────────────────────────────────
// Service exports
// ─────────────────────────────────────────────

/** Firestore database instance — all collection reads/writes go through this */
const db: Firestore = getFirestore(app);

/** Firebase Auth instance — email/password + Google OAuth */
const auth: Auth = getAuth(app);

/** Firebase Storage instance — used for backup files and fallback media */
const storage: FirebaseStorage = getStorage(app);

export { app, db, auth, storage };
