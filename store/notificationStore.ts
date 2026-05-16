/**
 * store/notificationStore.ts
 * Global notification state via Zustand.
 * Spec ref: section 9.3 (notifications/{uid}/items/{notificationId})
 *
 * Usage:
 *   const { notifications, unreadCount, addNotification } = useNotificationStore()
 *   useNotificationStore((s) => s.markAllAsRead)()
 */

import { create } from 'zustand';
import type { Notification } from '@/types';

// ─────────────────────────────────────────────
// State + Actions shape
// ─────────────────────────────────────────────

interface NotificationState {
  /** All fetched notifications, newest first. */
  notifications: Notification[];

  /** Cached count of unread notifications — avoids re-filtering on every render. */
  unreadCount: number;

  /**
   * Replace the full notification list (e.g. after initial Firestore fetch).
   * Recomputes unreadCount from the new list.
   */
  setNotifications: (notifications: Notification[]) => void;

  /**
   * Prepend a single notification (e.g. from a Firestore onSnapshot listener).
   * Increments unreadCount if the notification is unread.
   */
  addNotification: (notification: Notification) => void;

  /**
   * Mark a single notification as read by id.
   * Decrements unreadCount (floor 0).
   */
  markAsRead: (id: string) => void;

  /** Mark every notification as read and reset unreadCount to 0. */
  markAllAsRead: () => void;

  /**
   * Directly set the unread badge count — useful when syncing from Firestore
   * metadata without loading the full notification list.
   */
  setUnreadCount: (count: number) => void;
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useNotificationStore = create<NotificationState>((set) => ({
  // ── Initial state ──────────────────────────
  notifications: [],
  unreadCount:   0,

  // ── Actions ────────────────────────────────

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount:   state.unreadCount + (notification.read ? 0 : 1),
    })),

  markAsRead: (id) =>
    set((state) => {
      const target = state.notifications.find((n) => n.id === id);
      // If already read (or not found), skip — don't go negative.
      if (!target || target.read) return state;
      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount:   0,
    })),

  setUnreadCount: (unreadCount) => set({ unreadCount }),
}));
