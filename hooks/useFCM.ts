'use client';

/**
 * hooks/useFCM.ts
 * Registers the device FCM token for the signed-in user and subscribes to
 * foreground push messages, writing each one as a Notification Firestore doc
 * so useNotifications picks it up automatically via its existing onSnapshot.
 * Spec ref: section 4.3 (Notifications / Push)
 *
 * Usage:
 *   Call useFCM() once at the authenticated app root (see FCMRegistrar in
 *   AuthProvider). It is a no-op when the user is not signed in.
 */

import { useEffect } from 'react';
import {
  doc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requestFCMToken, onForegroundMessage } from '@/services/fcm';
import { useAuthStore } from '@/store/authStore';
import type { MessagePayload } from 'firebase/messaging';
import type { NotificationType } from '@/types';

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useFCM(): void {
  const uid = useAuthStore((s) => s.user?.uid ?? null);

  useEffect(() => {
    // No-op when unauthenticated
    if (!uid) return;

    let unsubscribeForeground: (() => void) | null = null;

    // ── 1. Request permission & store token ───
    const registerToken = async () => {
      try {
        const token = await requestFCMToken();
        if (!token) return; // permission denied or unsupported — non-fatal

        // Persist (or overwrite) the token so server-side FCM send() can look it up
        await setDoc(
          doc(db, 'fcmTokens', uid),
          { token, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (err) {
        // Non-fatal: the user may have denied permission or the browser may not
        // support the Notifications API (e.g. iOS Safari <16.4, HTTP origins).
        console.warn('[useFCM] Token registration skipped:', err);
      }
    };

    registerToken();

    // ── 2. Listen for foreground messages ─────
    unsubscribeForeground = onForegroundMessage(
      async (payload: MessagePayload) => {
        try {
          const notif = payload.notification;
          const data  = payload.data ?? {};

          // Derive the notification type from the FCM data field, falling back
          // to 'system' so the Notification type constraint is always satisfied.
          const validTypes: NotificationType[] = [
            'message',
            'enquiry',
            'order',
            'follow',
            'system',
          ];
          const rawType = data.type as string | undefined;
          const type: NotificationType =
            rawType && validTypes.includes(rawType as NotificationType)
              ? (rawType as NotificationType)
              : 'system';

          // Write to notifications/{uid}/items/{auto-id}
          // useNotifications already has onSnapshot on this path — it will pick
          // this doc up automatically within milliseconds.
          await addDoc(collection(db, 'notifications', uid, 'items'), {
            type,
            title:     notif?.title ?? data.title ?? 'TradeCircle',
            body:      notif?.body  ?? data.body  ?? '',
            linkTo:    data.linkTo  ?? '/',
            read:      false,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          console.error('[useFCM] Failed to write foreground notification:', err);
        }
      }
    );

    // ── Cleanup ───────────────────────────────
    return () => {
      unsubscribeForeground?.();
    };
  }, [uid]);
}
