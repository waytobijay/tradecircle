/**
 * hooks/useNotifications.ts
 * Real-time notification hook using Firestore onSnapshot.
 * Spec ref: section 4.3 (Notifications)
 *
 * Collection path: notifications/{uid}/items
 *
 * Usage:
 *   const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
 *     useNotifications();
 */

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import type { Notification } from '@/types';

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useNotifications() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);

  // ── Real-time subscription ─────────────────
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const uid = user.uid;

    const itemsRef = collection(db, 'notifications', uid, 'items');
    const q = query(itemsRef, orderBy('createdAt', 'desc'), limit(50));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Notification[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Notification, 'id'>),
        }));

        setNotifications(items);
        setUnreadCount(items.filter((n) => !n.read).length);
        setLoading(false);
      },
      (error) => {
        console.error('[useNotifications] onSnapshot error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // ── markAsRead ─────────────────────────────

  async function markAsRead(notificationId: string): Promise<void> {
    if (!user?.uid) return;

    const notifRef = doc(
      db,
      'notifications',
      user.uid,
      'items',
      notificationId
    );

    await updateDoc(notifRef, { read: true });
  }

  // ── markAllAsRead ──────────────────────────

  async function markAllAsRead(): Promise<void> {
    if (!user?.uid) return;

    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);

    for (const notif of unread) {
      const notifRef = doc(
        db,
        'notifications',
        user.uid,
        'items',
        notif.id
      );
      batch.update(notifRef, { read: true });
    }

    await batch.commit();
  }

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  };
}
