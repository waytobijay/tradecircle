'use client'; // only used browser-side

/**
 * services/fcm.ts
 * Firebase Cloud Messaging utilities: permission request, token retrieval,
 * and foreground message subscription.
 * Spec ref: section 4.3 (Notifications / Push)
 *
 * Usage:
 *   const token = await requestFCMToken();
 *   const unsub  = onForegroundMessage((payload) => { ... });
 */

import { getMessaging, getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { app } from '@/services/firebase';

// VAPID public key — set NEXT_PUBLIC_FIREBASE_VAPID_KEY in .env.local
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '';

// ─────────────────────────────────────────────
// requestFCMToken
// ─────────────────────────────────────────────

/**
 * Request notification permission and return the FCM registration token.
 *
 * - Registers the service worker at /firebase-messaging-sw.js.
 * - Returns null when:
 *     • running server-side
 *     • Notifications API is unavailable (non-HTTPS or old browser)
 *     • the user denied or dismissed the permission prompt
 */
export async function requestFCMToken(): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const messaging = getMessaging(app);
  const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: swReg,
  });

  return token ?? null;
}

// ─────────────────────────────────────────────
// onForegroundMessage
// ─────────────────────────────────────────────

/**
 * Subscribe to foreground FCM messages (tab is open and focused).
 * Background messages are handled by the service worker.
 *
 * @param handler  Called with the raw MessagePayload on each incoming message.
 * @returns        Unsubscribe function — call it on component unmount.
 */
export function onForegroundMessage(
  handler: (payload: MessagePayload) => void
): () => void {
  const messaging = getMessaging(app);
  return onMessage(messaging, handler);
}
