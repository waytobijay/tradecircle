/**
 * app/notifications/page.tsx
 * Notifications feed — all roles.
 * Spec ref: section 4.3 (Notifications)
 *
 * Layout: grouped by Today / Earlier
 * Types: message | enquiry | order_update | advisor_response | system | new_follower
 * - Mark all as read
 * - Individual dismiss
 * - Real-time via Firestore onSnapshot on users/{uid}/notifications
 *
 * Firestore schema:
 *   users/{uid}/notifications/{notifId}
 *     type:      NotifType
 *     title:     string
 *     body:      string
 *     linkTo?:   string   — route to navigate on click
 *     read:      boolean
 *     createdAt: Timestamp
 */

'use client';

import { useEffect, useState }   from 'react';
import { useRouter }             from 'next/navigation';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
  limit,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  Bell,
  MessageSquare,
  HelpCircle,
  ShoppingBag,
  BookOpen,
  Info,
  UserPlus,
  CheckCheck,
  X,
  Loader2,
} from 'lucide-react';
import { db }           from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import BuyerLayout      from '@/components/layouts/BuyerLayout';
import SellerLayout     from '@/components/layouts/SellerLayout';
import AdvisorLayout    from '@/components/layouts/AdvisorLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifType =
  | 'message'
  | 'enquiry'
  | 'order_update'
  | 'advisor_response'
  | 'system'
  | 'new_follower';

interface Notification {
  id:        string;
  type:      NotifType;
  title:     string;
  body:      string;
  linkTo?:   string;
  read:      boolean;
  createdAt?: { seconds: number };
}

// ─── Config per type ──────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  NotifType,
  { icon: React.ReactNode; accent: string }
> = {
  message:          { icon: <MessageSquare size={18} />, accent: 'var(--color-primary)' },
  enquiry:          { icon: <HelpCircle    size={18} />, accent: '#8b5cf6' },
  order_update:     { icon: <ShoppingBag   size={18} />, accent: '#f59e0b' },
  advisor_response: { icon: <BookOpen      size={18} />, accent: '#10b981' },
  system:           { icon: <Info          size={18} />, accent: '#6b7280' },
  new_follower:     { icon: <UserPlus      size={18} />, accent: '#3b82f6' },
};

// ─── Time helpers ─────────────────────────────────────────────────────────────

function isToday(seconds: number): boolean {
  const d = new Date(seconds * 1000);
  const n = new Date();
  return (
    d.getDate()    === n.getDate()    &&
    d.getMonth()   === n.getMonth()   &&
    d.getFullYear() === n.getFullYear()
  );
}

function formatTime(seconds: number): string {
  const d    = new Date(seconds * 1000);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)        return 'just now';
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NotifSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            display:      'flex',
            gap:          'var(--space-3)',
            padding:      'var(--space-4)',
            background:   'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border:       '1px solid var(--color-border)',
            alignItems:   'center',
          }}
        >
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: '60%', height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite', marginBottom: 6 }} />
            <div style={{ width: '85%', height: 12, borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Notification item ────────────────────────────────────────────────────────

function NotifItem({
  notif,
  onRead,
  onDismiss,
}: {
  notif:     Notification;
  onRead:    (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const router = useRouter();
  const cfg    = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.system;

  function handleClick() {
    if (!notif.read) onRead(notif.id);
    if (notif.linkTo) router.push(notif.linkTo);
  }

  return (
    <div
      style={{
        display:    'flex',
        gap:        'var(--space-3)',
        padding:    'var(--space-4)',
        background: notif.read ? 'var(--color-surface)' : 'color-mix(in srgb, var(--color-primary) 5%, var(--color-surface))',
        borderRadius: 'var(--radius-lg)',
        border:     `1px solid ${notif.read ? 'var(--color-border)' : 'color-mix(in srgb, var(--color-primary) 25%, var(--color-border))'}`,
        cursor:     notif.linkTo ? 'pointer' : 'default',
        transition: 'background 0.15s, border-color 0.15s',
        alignItems: 'flex-start',
        position:   'relative',
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        if (notif.linkTo) (e.currentTarget as HTMLDivElement).style.background =
          notif.read
            ? 'var(--color-surface-2)'
            : 'color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background =
          notif.read
            ? 'var(--color-surface)'
            : 'color-mix(in srgb, var(--color-primary) 5%, var(--color-surface))';
      }}
    >
      {/* Icon */}
      <div
        style={{
          width:          40,
          height:         40,
          borderRadius:   '50%',
          background:     `color-mix(in srgb, ${cfg.accent} 14%, transparent)`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          color:          cfg.accent,
          flexShrink:     0,
        }}
      >
        {cfg.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
          <p
            style={{
              margin:     0,
              fontWeight: notif.read ? 500 : 700,
              fontSize:   'var(--text-sm)',
              color:      'var(--color-text)',
            }}
          >
            {notif.title}
          </p>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-3)', flexShrink: 0, marginTop: 2 }}>
            {notif.createdAt ? formatTime(notif.createdAt.seconds) : ''}
          </span>
        </div>
        <p
          style={{
            margin:   '3px 0 0',
            fontSize: 'var(--text-xs)',
            color:    'var(--color-text-2)',
            lineHeight: 1.5,
          }}
        >
          {notif.body}
        </p>
      </div>

      {/* Unread dot */}
      {!notif.read && (
        <div
          style={{
            width:        8,
            height:       8,
            borderRadius: '50%',
            background:   'var(--color-primary)',
            flexShrink:   0,
            marginTop:    6,
          }}
        />
      )}

      {/* Dismiss */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(notif.id); }}
        title="Dismiss"
        style={{
          position:       'absolute',
          top:            'var(--space-2)',
          right:          'var(--space-2)',
          width:          24,
          height:         24,
          borderRadius:   'var(--radius-sm)',
          border:         'none',
          background:     'transparent',
          color:          'var(--color-text-3)',
          cursor:         'pointer',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          opacity:        0,
          transition:     'opacity 0.15s, color 0.15s',
        }}
        className="notif-dismiss"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const user        = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const router      = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]             = useState(true);
  const [markingAll, setMarkingAll]       = useState(false);

  const uid = user?.uid ?? '';

  // Real-time listener
  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, 'users', uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );

    const unsub: Unsubscribe = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification)));
      setLoading(false);
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  // Mark single as read
  async function markRead(id: string) {
    await updateDoc(doc(db, 'users', uid, 'notifications', id), { read: true });
  }

  // Dismiss (soft delete by marking dismissed)
  async function dismiss(id: string) {
    await updateDoc(doc(db, 'users', uid, 'notifications', id), { dismissed: true });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  // Mark all read
  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    setMarkingAll(true);
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, 'users', uid, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } finally {
      setMarkingAll(false);
    }
  }

  // Group
  const today   = notifications.filter((n) => n.createdAt && isToday(n.createdAt.seconds));
  const earlier = notifications.filter((n) => !n.createdAt || !isToday(n.createdAt.seconds));
  const unreadCount = notifications.filter((n) => !n.read).length;

  const LayoutWrapper =
    user.role === 'seller'
      ? SellerLayout
      : user.role === 'advisor'
      ? AdvisorLayout
      : BuyerLayout;

  return (
    <LayoutWrapper>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>

        {/* Header */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            marginBottom:   'var(--space-6)',
            flexWrap:       'wrap',
            gap:            'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Bell size={22} style={{ color: 'var(--color-primary)' }} />
            <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text)' }}>
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span
                style={{
                  padding:      '2px 10px',
                  background:   'var(--color-primary)',
                  color:        '#fff',
                  borderRadius: 'var(--radius-full)',
                  fontSize:     'var(--text-xs)',
                  fontWeight:   700,
                }}
              >
                {unreadCount} new
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              style={{
                display:      'inline-flex',
                alignItems:   'center',
                gap:          'var(--space-2)',
                padding:      'var(--space-2) var(--space-4)',
                background:   'var(--color-surface)',
                border:       '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color:        'var(--color-text-2)',
                fontSize:     'var(--text-sm)',
                fontWeight:   600,
                cursor:       markingAll ? 'not-allowed' : 'pointer',
                opacity:      markingAll ? 0.7 : 1,
                transition:   'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.borderColor = 'var(--color-primary)';
                b.style.color       = 'var(--color-primary)';
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.borderColor = 'var(--color-border)';
                b.style.color       = 'var(--color-text-2)';
              }}
            >
              {markingAll ? <Loader2 size={14} /> : <CheckCheck size={14} />}
              Mark all as read
            </button>
          )}
        </div>

        {loading ? (
          <NotifSkeleton />
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-16) 0' }}>
            <div
              style={{
                width:          80,
                height:         80,
                borderRadius:   '50%',
                background:     'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                margin:         '0 auto var(--space-4)',
              }}
            >
              <Bell size={36} style={{ color: 'var(--color-primary)', opacity: 0.6 }} />
            </div>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 'var(--text-base)' }}>
              All caught up!
            </p>
            <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
              No notifications yet — check back later.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

            {/* Today */}
            {today.length > 0 && (
              <section>
                <p
                  style={{
                    margin:        '0 0 var(--space-2)',
                    fontSize:      'var(--text-xs)',
                    fontWeight:    700,
                    color:         'var(--color-text-3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                  }}
                >
                  Today
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {today.map((n) => (
                    <NotifItem key={n.id} notif={n} onRead={markRead} onDismiss={dismiss} />
                  ))}
                </div>
              </section>
            )}

            {/* Earlier */}
            {earlier.length > 0 && (
              <section>
                <p
                  style={{
                    margin:        '0 0 var(--space-2)',
                    fontSize:      'var(--text-xs)',
                    fontWeight:    700,
                    color:         'var(--color-text-3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                  }}
                >
                  Earlier
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {earlier.map((n) => (
                    <NotifItem key={n.id} notif={n} onRead={markRead} onDismiss={dismiss} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
        /* Show dismiss button on row hover */
        div:hover > .notif-dismiss,
        div:hover .notif-dismiss {
          opacity: 1 !important;
        }
      `}</style>
    </LayoutWrapper>
  );
}
