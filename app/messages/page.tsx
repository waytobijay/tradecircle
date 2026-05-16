/**
 * app/messages/page.tsx
 * Real-time direct messaging — all roles.
 * Spec ref: section 4.4 (Messaging)
 *
 * Layout:
 *   Left panel  — conversation list (avatar, name, last message, unread badge)
 *   Right panel — chat thread (WhatsApp-style bubbles, timestamps)
 *
 * Features:
 *   - Text messages
 *   - Image attachments (max 3, 10 MB each) → Cloudinary upload
 *   - Voice notes (hold-to-record MediaRecorder → Cloudinary raw upload)
 *   - Read receipts: ✓ sent → ✓✓ delivered → blue ✓✓ read
 *   - Typing indicator: written to Firestore, TTL-cleared on blur
 *   - Real-time via Firestore onSnapshot
 *   - URL params: ?uid=X or ?advisorId=X → auto-open/create conversation
 *
 * Firestore schema:
 *   messages/{convId}
 *     participants:     string[]
 *     participantNames: Record<uid, string>
 *     participantPhotos: Record<uid, string>
 *     lastMessage:      string
 *     lastAt:           Timestamp
 *     unread:           Record<uid, number>
 *
 *   messages/{convId}/items/{msgId}
 *     senderId:  string
 *     type:      'text' | 'image' | 'audio'
 *     text?:     string
 *     imageUrls?: string[]
 *     audioUrl?: string
 *     createdAt: Timestamp
 *     delivered: boolean
 *     read:      boolean
 */

'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  Send,
  Image as ImageIcon,
  Mic,
  MicOff,
  X,
  Check,
  CheckCheck,
  Phone,
  ArrowLeft,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { db }           from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import BuyerLayout      from '@/components/layouts/BuyerLayout';
import SellerLayout     from '@/components/layouts/SellerLayout';
import AdvisorLayout    from '@/components/layouts/AdvisorLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  id:               string;
  participants:     string[];
  participantNames: Record<string, string>;
  participantPhotos: Record<string, string>;
  lastMessage:      string;
  lastAt?:          { seconds: number };
  unread:           Record<string, number>;
}

type MessageType = 'text' | 'image' | 'audio';

interface Message {
  id:         string;
  senderId:   string;
  type:       MessageType;
  text?:      string;
  imageUrls?: string[];
  audioUrl?:  string;
  createdAt?: { seconds: number };
  delivered:  boolean;
  read:       boolean;
}

// ─── Cloudinary helper ────────────────────────────────────────────────────────

async function uploadToCloudinary(
  file: File,
  resourceType: 'image' | 'video' | 'raw' = 'image',
): Promise<string> {
  const cloudName   = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';
  const fd          = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', uploadPreset);
  const res  = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    { method: 'POST', body: fd },
  );
  const json = await res.json() as { secure_url: string };
  return json.secure_url;
}

// ─── Conv ID helper ───────────────────────────────────────────────────────────

function convId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

// ─── Time format ──────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const date = new Date(seconds * 1000);
  const now  = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60_000)           return 'just now';
  if (diff < 3_600_000)        return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000)       return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 7 * 86_400_000)   return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMsgTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Read receipt icon ────────────────────────────────────────────────────────

function Receipt({ delivered, read }: { delivered: boolean; read: boolean }) {
  if (read) {
    return <CheckCheck size={13} style={{ color: '#60a5fa' }} />;
  }
  if (delivered) {
    return <CheckCheck size={13} style={{ color: 'rgba(255,255,255,0.6)' }} />;
  }
  return <Check size={13} style={{ color: 'rgba(255,255,255,0.6)' }} />;
}

// ─── Conversation list item ───────────────────────────────────────────────────

function ConversationItem({
  conv,
  myUid,
  active,
  onClick,
}: {
  conv:    Conversation;
  myUid:   string;
  active:  boolean;
  onClick: () => void;
}) {
  const otherId   = conv.participants.find((p) => p !== myUid) ?? '';
  const otherName = conv.participantNames[otherId] ?? 'Unknown';
  const otherPhoto = conv.participantPhotos[otherId];
  const unread    = conv.unread[myUid] ?? 0;
  const initial   = otherName[0]?.toUpperCase() ?? '?';

  return (
    <button
      onClick={onClick}
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:         'var(--space-3)',
        padding:     'var(--space-3) var(--space-4)',
        width:       '100%',
        background:  active ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
        border:      'none',
        borderLeft:  active ? '3px solid var(--color-primary)' : '3px solid transparent',
        cursor:      'pointer',
        textAlign:   'left',
        transition:  'background 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-2)';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width:          44,
          height:         44,
          borderRadius:   '50%',
          background:     'var(--color-primary)',
          overflow:       'hidden',
          flexShrink:     0,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          color:          '#fff',
          fontWeight:     700,
          fontSize:       'var(--text-base)',
          position:       'relative',
        }}
      >
        {otherPhoto ? (
          <img src={otherPhoto} alt={otherName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : initial}
      </div>

      {/* Name + preview */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <p
            style={{
              margin:       0,
              fontWeight:   unread > 0 ? 700 : 600,
              fontSize:     'var(--text-sm)',
              color:        'var(--color-text)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
              maxWidth:     130,
            }}
          >
            {otherName}
          </p>
          {conv.lastAt && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-3)', flexShrink: 0 }}>
              {formatTime(conv.lastAt.seconds)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p
            style={{
              margin:       '1px 0 0',
              fontSize:     'var(--text-xs)',
              color:        unread > 0 ? 'var(--color-text)' : 'var(--color-text-3)',
              fontWeight:   unread > 0 ? 600 : 400,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
              maxWidth:     140,
            }}
          >
            {conv.lastMessage || 'Start a conversation'}
          </p>
          {unread > 0 && (
            <span
              style={{
                minWidth:       18,
                height:         18,
                borderRadius:   'var(--radius-full)',
                background:     'var(--color-primary)',
                color:          '#fff',
                fontSize:       10,
                fontWeight:     700,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                padding:        '0 4px',
                flexShrink:     0,
              }}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, myUid }: { msg: Message; myUid: string }) {
  const isMe = msg.senderId === myUid;

  return (
    <div
      style={{
        display:       'flex',
        justifyContent: isMe ? 'flex-end' : 'flex-start',
        marginBottom:  'var(--space-1)',
      }}
    >
      <div
        style={{
          maxWidth:     '72%',
          padding:      'var(--space-2) var(--space-3)',
          borderRadius: isMe
            ? 'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)'
            : 'var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)',
          background:   isMe ? 'var(--color-primary)' : 'var(--color-surface)',
          border:       isMe ? 'none' : '1px solid var(--color-border)',
          color:        isMe ? '#fff' : 'var(--color-text)',
          wordBreak:    'break-word',
        }}
      >
        {/* Images */}
        {msg.type === 'image' && msg.imageUrls && (
          <div
            style={{
              display:             'grid',
              gridTemplateColumns: msg.imageUrls.length === 1 ? '1fr' : '1fr 1fr',
              gap:                 'var(--space-1)',
              marginBottom:        msg.text ? 'var(--space-2)' : 0,
            }}
          >
            {msg.imageUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt="attachment"
                style={{
                  width:        '100%',
                  borderRadius: 'var(--radius-md)',
                  objectFit:    'cover',
                  maxHeight:    220,
                  cursor:       'pointer',
                }}
                onClick={() => window.open(url, '_blank')}
              />
            ))}
          </div>
        )}

        {/* Audio */}
        {msg.type === 'audio' && msg.audioUrl && (
          <audio
            controls
            src={msg.audioUrl}
            style={{ display: 'block', width: '100%', minWidth: 200, marginBottom: msg.text ? 'var(--space-2)' : 0 }}
          />
        )}

        {/* Text */}
        {msg.text && (
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
            {msg.text}
          </p>
        )}

        {/* Time + receipts */}
        <div
          style={{
            display:        'flex',
            justifyContent: 'flex-end',
            alignItems:     'center',
            gap:            3,
            marginTop:      4,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color:    isMe ? 'rgba(255,255,255,0.65)' : 'var(--color-text-3)',
            }}
          >
            {msg.createdAt ? formatMsgTime(msg.createdAt.seconds) : ''}
          </span>
          {isMe && <Receipt delivered={msg.delivered} read={msg.read} />}
        </div>
      </div>
    </div>
  );
}

// ─── Image preview strip ──────────────────────────────────────────────────────

function ImagePreviewStrip({
  files,
  onRemove,
}: {
  files:    File[];
  onRemove: (i: number) => void;
}) {
  return (
    <div
      style={{
        display:    'flex',
        gap:        'var(--space-2)',
        padding:    'var(--space-2) var(--space-3)',
        borderTop:  '1px solid var(--color-border)',
        flexWrap:   'wrap',
      }}
    >
      {files.map((f, i) => {
        const url = URL.createObjectURL(f);
        return (
          <div key={i} style={{ position: 'relative' }}>
            <img
              src={url}
              alt=""
              style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', objectFit: 'cover' }}
            />
            <button
              onClick={() => onRemove(i)}
              style={{
                position:       'absolute',
                top:            -6,
                right:          -6,
                width:          20,
                height:         20,
                borderRadius:   '50%',
                background:     'var(--color-error, #ef4444)',
                border:         'none',
                color:          '#fff',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                cursor:         'pointer',
                padding:        0,
              }}
            >
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Inner content (needs useSearchParams) ─────────────────────────────────────

function MessagesInner() {
  const user       = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const router     = useRouter();
  const searchParams = useSearchParams();

  const myUid = user?.uid ?? '';

  // ─── State ───────────────────────────────────────────────────────────────────

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convsLoading, setConvsLoading]   = useState(true);
  const [activeConvId, setActiveConvId]   = useState<string | null>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading]     = useState(false);
  const [text, setText]                   = useState('');
  const [sending, setSending]             = useState(false);
  const [imageFiles, setImageFiles]       = useState<File[]>([]);
  const [isRecording, setIsRecording]     = useState(false);
  const [recordSecs, setRecordSecs]       = useState(0);
  const [otherTyping, setOtherTyping]     = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const fileRef      = useRef<HTMLInputElement>(null);
  const mediaRef     = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<Blob[]>([]);
  const recordTimer  = useRef<NodeJS.Timeout | null>(null);
  const typingTimer  = useRef<NodeJS.Timeout | null>(null);
  const unsubMsgRef  = useRef<Unsubscribe | null>(null);
  const unsubTypRef  = useRef<Unsubscribe | null>(null);

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeConvId) ?? null,
    [conversations, activeConvId],
  );

  const otherId = activeConv?.participants.find((p) => p !== myUid) ?? '';
  const otherName  = activeConv?.participantNames[otherId] ?? '';
  const otherPhoto = activeConv?.participantPhotos[otherId];

  // ─── Auth guard ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  // ─── Load / listen conversations ──────────────────────────────────────────────

  useEffect(() => {
    if (!myUid) return;

    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', myUid),
      orderBy('lastAt', 'desc'),
      limit(50),
    );

    const unsub = onSnapshot(q, (snap) => {
      setConversations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Conversation)));
      setConvsLoading(false);
    });

    return () => unsub();
  }, [myUid]);

  // ─── Handle URL param — auto-open conversation ────────────────────────────────

  useEffect(() => {
    const targetUid = searchParams.get('uid') ?? searchParams.get('advisorId');
    if (!targetUid || !myUid) return;

    const cid = convId(myUid, targetUid);

    // Check if it exists already, else create skeleton
    getDoc(doc(db, 'messages', cid)).then(async (snap) => {
      if (!snap.exists()) {
        // Fetch target user name/photo
        const targetSnap = await getDoc(doc(db, 'users', targetUid));
        const targetData = targetSnap.data() ?? {};
        await setDoc(doc(db, 'messages', cid), {
          participants:      [myUid, targetUid],
          participantNames:  {
            [myUid]:     user?.displayName ?? '',
            [targetUid]: targetData.displayName ?? '',
          },
          participantPhotos: {
            [myUid]:     user?.photoURL ?? '',
            [targetUid]: targetData.photoURL ?? '',
          },
          lastMessage: '',
          lastAt:      serverTimestamp(),
          unread:      { [myUid]: 0, [targetUid]: 0 },
        });
      }
      setActiveConvId(cid);
      setMobileShowThread(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, myUid]);

  // ─── Listen messages for active conversation ──────────────────────────────────

  useEffect(() => {
    unsubMsgRef.current?.();
    unsubTypRef.current?.();
    if (!activeConvId) return;

    setMsgsLoading(true);

    const q = query(
      collection(db, 'messages', activeConvId, 'items'),
      orderBy('createdAt', 'asc'),
      limit(100),
    );

    unsubMsgRef.current = onSnapshot(q, async (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
      setMsgsLoading(false);

      // Mark unread messages from other as read
      const unreadFromOther = snap.docs.filter(
        (d) => d.data().senderId !== myUid && !d.data().read,
      );
      await Promise.all(
        unreadFromOther.map((d) => updateDoc(d.ref, { read: true, delivered: true })),
      );

      // Reset my unread count
      if (unreadFromOther.length > 0) {
        await updateDoc(doc(db, 'messages', activeConvId), {
          [`unread.${myUid}`]: 0,
        });
      }
    });

    // Typing indicator
    const typingRef = doc(db, 'typing', activeConvId);
    unsubTypRef.current = onSnapshot(typingRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setOtherTyping(!!(data[otherId] && Date.now() / 1000 - data[otherId] < 5));
      } else {
        setOtherTyping(false);
      }
    });

    return () => {
      unsubMsgRef.current?.();
      unsubTypRef.current?.();
    };
  }, [activeConvId, myUid, otherId]);

  // ─── Scroll to bottom on new message ─────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherTyping]);

  // ─── Typing signal ────────────────────────────────────────────────────────────

  async function signalTyping() {
    if (!activeConvId || !myUid) return;
    await setDoc(
      doc(db, 'typing', activeConvId),
      { [myUid]: Math.floor(Date.now() / 1000) },
      { merge: true },
    );
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(async () => {
      await setDoc(doc(db, 'typing', activeConvId), { [myUid]: 0 }, { merge: true });
    }, 4000);
  }

  // ─── Send message ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (
    type:      MessageType,
    payload:   { text?: string; imageUrls?: string[]; audioUrl?: string },
  ) => {
    if (!activeConvId || !myUid) return;

    const msgData = {
      senderId:  myUid,
      type,
      ...payload,
      createdAt: serverTimestamp(),
      delivered: false,
      read:      false,
    };

    await addDoc(collection(db, 'messages', activeConvId, 'items'), msgData);

    const preview =
      type === 'text'
        ? (payload.text ?? '')
        : type === 'image'
        ? '📷 Photo'
        : '🎤 Voice note';

    await updateDoc(doc(db, 'messages', activeConvId), {
      lastMessage:          preview,
      lastAt:               serverTimestamp(),
      [`unread.${otherId}`]: (activeConv?.unread[otherId] ?? 0) + 1,
    });
  }, [activeConvId, myUid, otherId, activeConv]);

  async function handleSendText() {
    const trimmed = text.trim();
    if (!trimmed && !imageFiles.length) return;
    setSending(true);
    try {
      if (imageFiles.length) {
        const urls = await Promise.all(
          imageFiles.map((f) => uploadToCloudinary(f, 'image')),
        );
        await sendMessage('image', { imageUrls: urls, text: trimmed || undefined });
        setImageFiles([]);
      } else {
        await sendMessage('text', { text: trimmed });
      }
      setText('');
    } finally {
      setSending(false);
    }
  }

  // ─── Image attach ─────────────────────────────────────────────────────────────

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).slice(0, 3 - imageFiles.length);
    const valid  = picked.filter((f) => f.size <= 10 * 1024 * 1024);
    setImageFiles((prev) => [...prev, ...valid].slice(0, 3));
    e.target.value = '';
  }

  // ─── Voice recording ──────────────────────────────────────────────────────────

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr     = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.start();
      mediaRef.current = mr;
      setIsRecording(true);
      setRecordSecs(0);
      recordTimer.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch {
      /* microphone denied */
    }
  }

  async function stopRecording(send: boolean) {
    const mr = mediaRef.current;
    if (!mr) return;

    if (recordTimer.current) clearInterval(recordTimer.current);
    setIsRecording(false);
    setRecordSecs(0);

    mr.onstop = async () => {
      mr.stream.getTracks().forEach((t) => t.stop());
      if (!send) return;
      setSending(true);
      try {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        const url  = await uploadToCloudinary(file, 'video'); // Cloudinary uses 'video' for audio
        await sendMessage('audio', { audioUrl: url });
      } finally {
        setSending(false);
      }
    };
    mr.stop();
  }

  // ─── Open conversation ────────────────────────────────────────────────────────

  function openConv(conv: Conversation) {
    setActiveConvId(conv.id);
    setMobileShowThread(true);
    setMessages([]);
  }

  // ─── Layout ───────────────────────────────────────────────────────────────────

  const LayoutWrapper =
    user?.role === 'seller'
      ? SellerLayout
      : user?.role === 'advisor'
      ? AdvisorLayout
      : BuyerLayout;

  if (authLoading || !user) return null;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <LayoutWrapper>
      <div
        style={{
          display:    'flex',
          height:     'calc(100vh - 64px)',
          overflow:   'hidden',
          background: 'var(--color-bg)',
        }}
      >
        {/* ── Left: Conversation list ───────────────────────────────────────── */}
        <div
          style={{
            width:       320,
            flexShrink:  0,
            borderRight: '1px solid var(--color-border)',
            background:  'var(--color-surface)',
            display:     mobileShowThread ? 'none' : 'flex',
            flexDirection: 'column',
          }}
          className="messages-list"
        >
          {/* List header */}
          <div
            style={{
              padding:      'var(--space-4)',
              borderBottom: '1px solid var(--color-border)',
              flexShrink:   0,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
              Messages
            </h2>
          </div>

          {/* Conversations */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {convsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap:     'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ width: 120, height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite', marginBottom: 6 }} />
                    <div style={{ width: 180, height: 12, borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                  </div>
                </div>
              ))
            ) : conversations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-4)' }}>
                <MessageSquare size={40} style={{ color: 'var(--color-text-3)', opacity: 0.4, marginBottom: 'var(--space-3)' }} />
                <p style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
                  No conversations yet.
                </p>
              </div>
            ) : (
              conversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  myUid={myUid}
                  active={conv.id === activeConvId}
                  onClick={() => openConv(conv)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right: Chat thread ────────────────────────────────────────────── */}
        <div
          style={{
            flex:          1,
            display:       (!mobileShowThread && window?.innerWidth < 640) ? 'none' : 'flex',
            flexDirection: 'column',
            minWidth:      0,
          }}
          className="messages-thread"
        >
          {!activeConvId ? (
            /* Empty state */
            <div
              style={{
                flex:           1,
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            'var(--space-3)',
                color:          'var(--color-text-3)',
              }}
            >
              <MessageSquare size={56} style={{ opacity: 0.25 }} />
              <p style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 500 }}>
                Select a conversation
              </p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          'var(--space-3)',
                  padding:      'var(--space-3) var(--space-4)',
                  borderBottom: '1px solid var(--color-border)',
                  background:   'var(--color-surface)',
                  flexShrink:   0,
                }}
              >
                {/* Mobile back */}
                <button
                  onClick={() => { setMobileShowThread(false); setActiveConvId(null); }}
                  style={{
                    background: 'none',
                    border:     'none',
                    cursor:     'pointer',
                    color:      'var(--color-text-2)',
                    padding:    0,
                    display:    'flex',
                  }}
                  className="mobile-back-btn"
                >
                  <ArrowLeft size={20} />
                </button>

                <div
                  style={{
                    width:          40,
                    height:         40,
                    borderRadius:   '50%',
                    background:     'var(--color-primary)',
                    overflow:       'hidden',
                    flexShrink:     0,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    color:          '#fff',
                    fontWeight:     700,
                    fontSize:       'var(--text-base)',
                  }}
                >
                  {otherPhoto ? (
                    <img src={otherPhoto} alt={otherName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    otherName[0]?.toUpperCase()
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                    {otherName}
                  </p>
                  {otherTyping && (
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-primary)', fontStyle: 'italic' }}>
                      typing…
                    </p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div
                style={{
                  flex:       1,
                  overflowY:  'auto',
                  padding:    'var(--space-4)',
                  display:    'flex',
                  flexDirection: 'column',
                  gap:        'var(--space-1)',
                  background: 'var(--color-bg)',
                }}
              >
                {msgsLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8) 0' }}>
                    <Loader2 size={24} style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--color-text-3)' }}>
                    <p style={{ fontSize: 'var(--text-sm)' }}>No messages yet. Say hello!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} myUid={myUid} />
                  ))
                )}

                {/* Typing bubble */}
                {otherTyping && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div
                      style={{
                        padding:      'var(--space-2) var(--space-3)',
                        background:   'var(--color-surface)',
                        border:       '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)',
                        display:      'flex',
                        gap:          4,
                        alignItems:   'center',
                      }}
                    >
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          style={{
                            width:           7,
                            height:          7,
                            borderRadius:    '50%',
                            background:      'var(--color-text-3)',
                            display:         'inline-block',
                            animation:       `typingDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Image preview */}
              {imageFiles.length > 0 && (
                <ImagePreviewStrip
                  files={imageFiles}
                  onRemove={(i) => setImageFiles((prev) => prev.filter((_, idx) => idx !== i))}
                />
              )}

              {/* Input bar */}
              <div
                style={{
                  display:      'flex',
                  alignItems:   'flex-end',
                  gap:          'var(--space-2)',
                  padding:      'var(--space-3) var(--space-4)',
                  borderTop:    '1px solid var(--color-border)',
                  background:   'var(--color-surface)',
                  flexShrink:   0,
                }}
              >
                {/* Image attach */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={imageFiles.length >= 3 || isRecording}
                  title="Attach image"
                  style={{
                    width:          36,
                    height:         36,
                    borderRadius:   'var(--radius-md)',
                    border:         '1px solid var(--color-border)',
                    background:     'var(--color-surface-2)',
                    color:          'var(--color-text-2)',
                    cursor:         imageFiles.length >= 3 || isRecording ? 'not-allowed' : 'pointer',
                    opacity:        imageFiles.length >= 3 || isRecording ? 0.5 : 1,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    flexShrink:     0,
                    transition:     'color 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-2)'; }}
                >
                  <ImageIcon size={18} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />

                {/* Text input */}
                {!isRecording ? (
                  <textarea
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      signalTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendText();
                      }
                    }}
                    placeholder="Type a message…"
                    rows={1}
                    style={{
                      flex:        1,
                      padding:     'var(--space-2) var(--space-3)',
                      background:  'var(--color-surface-2)',
                      border:      '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      color:       'var(--color-text)',
                      fontSize:    'var(--text-sm)',
                      outline:     'none',
                      resize:      'none',
                      lineHeight:  1.5,
                      maxHeight:   120,
                      overflowY:   'auto',
                    }}
                  />
                ) : (
                  /* Recording indicator */
                  <div
                    style={{
                      flex:        1,
                      padding:     'var(--space-2) var(--space-3)',
                      background:  'color-mix(in srgb, var(--color-error, #ef4444) 10%, transparent)',
                      border:      '1px solid var(--color-error, #ef4444)',
                      borderRadius: 'var(--radius-md)',
                      display:     'flex',
                      alignItems:  'center',
                      gap:         'var(--space-2)',
                    }}
                  >
                    <span
                      style={{
                        width:        8,
                        height:       8,
                        borderRadius: '50%',
                        background:   'var(--color-error, #ef4444)',
                        animation:    'pulse 1s ease-in-out infinite',
                        flexShrink:   0,
                      }}
                    />
                    <span style={{ color: 'var(--color-error, #ef4444)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                      Recording {recordSecs}s
                    </span>
                    <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', marginLeft: 'auto' }}>
                      Release to send · tap × to cancel
                    </span>
                  </div>
                )}

                {/* Voice / cancel recording */}
                {isRecording ? (
                  <button
                    type="button"
                    onClick={() => stopRecording(false)}
                    title="Cancel recording"
                    style={{
                      width:          36,
                      height:         36,
                      borderRadius:   'var(--radius-md)',
                      border:         '1px solid var(--color-error, #ef4444)',
                      background:     'var(--color-surface-2)',
                      color:          'var(--color-error, #ef4444)',
                      cursor:         'pointer',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      flexShrink:     0,
                    }}
                  >
                    <X size={18} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onMouseDown={startRecording}
                    onMouseUp={() => stopRecording(true)}
                    onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                    onTouchEnd={(e) => { e.preventDefault(); stopRecording(true); }}
                    disabled={!!text.trim() || imageFiles.length > 0}
                    title="Hold to record voice note"
                    style={{
                      width:          36,
                      height:         36,
                      borderRadius:   'var(--radius-md)',
                      border:         '1px solid var(--color-border)',
                      background:     'var(--color-surface-2)',
                      color:          'var(--color-text-2)',
                      cursor:         text.trim() || imageFiles.length > 0 ? 'not-allowed' : 'pointer',
                      opacity:        text.trim() || imageFiles.length > 0 ? 0.4 : 1,
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      flexShrink:     0,
                      transition:     'color 0.15s',
                      userSelect:     'none',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-2)'; }}
                  >
                    <Mic size={18} />
                  </button>
                )}

                {/* Send */}
                <button
                  type="button"
                  onClick={handleSendText}
                  disabled={(!text.trim() && !imageFiles.length) || sending || isRecording}
                  style={{
                    width:          36,
                    height:         36,
                    borderRadius:   'var(--radius-md)',
                    border:         'none',
                    background:     'var(--color-primary)',
                    color:          '#fff',
                    cursor:         (!text.trim() && !imageFiles.length) || sending || isRecording ? 'not-allowed' : 'pointer',
                    opacity:        (!text.trim() && !imageFiles.length) || sending || isRecording ? 0.5 : 1,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    flexShrink:     0,
                    transition:     'opacity 0.15s',
                  }}
                >
                  {sending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%           { transform: translateY(-5px); opacity: 1; }
        }

        /* Desktop: always show list, never show back button */
        @media (min-width: 640px) {
          .messages-list   { display: flex !important; }
          .messages-thread { display: flex !important; }
          .mobile-back-btn { display: none !important; }
        }
      `}</style>
    </LayoutWrapper>
  );
}

// ─── Page (Suspense boundary for useSearchParams) ─────────────────────────────

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesInner />
    </Suspense>
  );
}
