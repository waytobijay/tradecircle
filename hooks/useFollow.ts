/**
 * hooks/useFollow.ts
 * Returns follow state for a given target user and exposes a toggle action.
 *
 * Firestore structure:
 *   follows/{currentUser.uid}/following/{targetUid}  — one doc per follow
 *
 * followerCount uses a Firestore collection-group aggregate query
 * (getCountFromServer) across all `following` subcollections where
 * targetUid matches, so no denormalized counter field is needed.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getCountFromServer,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';

interface UseFollowResult {
  isFollowing: boolean;
  followerCount: number;
  loading: boolean;
  toggle: () => Promise<void>;
}

export function useFollow(targetUid: string): UseFollowResult {
  const { user } = useAuthStore();

  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  // Resolve the follow document reference for the current user → target
  const followDocRef = user
    ? doc(db, 'follows', user.uid, 'following', targetUid)
    : null;

  // ── On mount: check isFollowing + fetch followerCount ────────────────────

  useEffect(() => {
    if (!targetUid) {
      setLoading(false);
      return;
    }

    // No auth user — short-circuit
    if (!user) {
      setIsFollowing(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function init() {
      setLoading(true);
      try {
        // 1. Check if current user is following the target
        const followSnap = await getDoc(followDocRef!);
        if (!cancelled) setIsFollowing(followSnap.exists());

        // 2. Count total followers for the target via collection-group query
        const followersQuery = query(
          collectionGroup(db, 'following'),
          where('targetUid', '==', targetUid),
        );
        const countSnap = await getCountFromServer(followersQuery);
        if (!cancelled) setFollowerCount(countSnap.data().count);
      } catch (err) {
        console.error('[useFollow] init error', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [targetUid, user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle follow/unfollow ────────────────────────────────────────────────

  const toggle = useCallback(async () => {
    if (!user || !followDocRef || toggling) return;

    setToggling(true);
    const wasFollowing = isFollowing;

    // Optimistic update
    setIsFollowing(!wasFollowing);
    setFollowerCount((c) => (wasFollowing ? Math.max(0, c - 1) : c + 1));

    try {
      if (wasFollowing) {
        await deleteDoc(followDocRef);
      } else {
        await setDoc(followDocRef, {
          targetUid,
          targetName: '',   // caller provides name via FollowButton props
          targetRole: '',   // same — will be overwritten by FollowButton
          followedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('[useFollow] toggle error', err);
      // Rollback optimistic update on failure
      setIsFollowing(wasFollowing);
      setFollowerCount((c) => (wasFollowing ? c + 1 : Math.max(0, c - 1)));
    } finally {
      setToggling(false);
    }
  }, [user, followDocRef, isFollowing, toggling, targetUid]);

  // If no authenticated user, return safe defaults
  if (!user) {
    return {
      isFollowing: false,
      followerCount,
      loading: false,
      toggle: async () => {},
    };
  }

  return {
    isFollowing,
    followerCount,
    loading: loading || toggling,
    toggle,
  };
}
