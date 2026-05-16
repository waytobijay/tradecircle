/**
 * components/ui/FollowButton.tsx
 * Follow / Unfollow button with optimistic state and spinner.
 *
 * Props:
 *   targetUid   — uid of the profile to follow
 *   targetName  — display name (stored in the Follow doc)
 *   targetRole  — user role (stored in the Follow doc)
 *   targetPhoto — optional photo URL (stored in the Follow doc)
 *   size        — 'sm' (28px) | 'md' (36px, default)
 *
 * Behaviour:
 *   - Hidden when targetUid === currentUser.uid (can't follow yourself)
 *   - Redirects to /login when unauthenticated user clicks
 *   - Shows "Follow" (outline) or "Following" (filled green)
 *   - Spinner replaces text while in flight
 *   - Uses useFollow for initial isFollowing state, then manages it locally
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useFollow } from '@/hooks/useFollow';
import type { UserRole } from '@/types';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface FollowButtonProps {
  targetUid: string;
  targetName: string;
  targetRole: UserRole;
  targetPhoto?: string;
  size?: 'sm' | 'md';
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function FollowButton({
  targetUid,
  targetName,
  targetRole,
  targetPhoto,
  size = 'md',
}: FollowButtonProps) {
  const router = useRouter();
  const { user } = useAuthStore();

  // Seed the local state from the hook (which checks Firestore on mount)
  const { isFollowing: hookIsFollowing, loading: hookLoading } = useFollow(targetUid);

  // Local state for optimistic updates once the hook has resolved
  const [localIsFollowing, setLocalIsFollowing] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  // Once the hook resolves, adopt its value as baseline
  useEffect(() => {
    if (!hookLoading) {
      setLocalIsFollowing(hookIsFollowing);
    }
  }, [hookLoading, hookIsFollowing]);

  // Don't render if viewing own profile
  if (user && user.uid === targetUid) return null;

  const isFollowing = localIsFollowing ?? hookIsFollowing;
  const loading = hookLoading || toggling;

  // ── Styles ───────────────────────────────────────────────────────────────

  const height   = size === 'sm' ? 28 : 36;
  const fontSize = size === 'sm' ? 12 : 14;
  const paddingX = size === 'sm' ? 12 : 18;

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height,
    padding: `0 ${paddingX}px`,
    borderRadius: height / 2,
    fontSize,
    fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  };

  const followingStyle: React.CSSProperties = {
    ...baseStyle,
    background: 'var(--color-success)',
    border: '1.5px solid var(--color-success)',
    color: '#fff',
    opacity: loading ? 0.7 : 1,
  };

  const notFollowingStyle: React.CSSProperties = {
    ...baseStyle,
    background: 'transparent',
    border: '1.5px solid var(--color-border)',
    color: 'var(--color-text)',
    opacity: loading ? 0.7 : 1,
  };

  // ── Handler ──────────────────────────────────────────────────────────────

  const handleClick = useCallback(async () => {
    if (loading) return;

    // Redirect unauthenticated users
    if (!user) {
      router.push('/login');
      return;
    }

    const followDocRef = doc(db, 'follows', user.uid, 'following', targetUid);
    const willUnfollow = isFollowing;

    // Optimistic update
    setLocalIsFollowing(!isFollowing);
    setToggling(true);

    try {
      if (willUnfollow) {
        await deleteDoc(followDocRef);
      } else {
        await setDoc(followDocRef, {
          targetUid,
          targetName,
          targetRole,
          ...(targetPhoto ? { targetPhoto } : {}),
          followedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('[FollowButton] toggle error', err);
      // Rollback optimistic update on failure
      setLocalIsFollowing(willUnfollow);
    } finally {
      setToggling(false);
    }
  }, [loading, user, router, targetUid, targetName, targetRole, targetPhoto, isFollowing]);

  // ── Spinner ───────────────────────────────────────────────────────────────

  const spinnerSize = size === 'sm' ? 12 : 14;

  const spinner = (
    <span
      style={{
        display: 'inline-block',
        width: spinnerSize,
        height: spinnerSize,
        border: `2px solid ${isFollowing ? 'rgba(255,255,255,0.5)' : 'var(--color-border)'}`,
        borderTopColor: isFollowing ? '#fff' : 'var(--color-text)',
        borderRadius: '50%',
        animation: 'fb-spin 0.6s linear infinite',
      }}
    />
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes fb-spin { to { transform: rotate(360deg); } }
      `}</style>
      <button
        onClick={handleClick}
        disabled={loading}
        aria-label={isFollowing ? `Unfollow ${targetName}` : `Follow ${targetName}`}
        style={isFollowing ? followingStyle : notFollowingStyle}
      >
        {loading ? spinner : (isFollowing ? 'Following' : 'Follow')}
      </button>
    </>
  );
}
