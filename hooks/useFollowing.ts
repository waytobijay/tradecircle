/**
 * hooks/useFollowing.ts
 * Fetches the people the current user follows and the people who follow them.
 *
 * Firestore structure:
 *   follows/{uid}/following/{targetUid}  — docs the current user wrote
 *   follows/*/following/*  (collection group, filtered by targetUid == uid)
 *                          — docs written by other users pointing at current user
 *
 * Both lists are sorted by followedAt descending.
 */

import { useEffect, useState } from 'react';
import {
  collection,
  collectionGroup,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import type { Follow } from '@/types';

interface UseFollowingResult {
  following: Follow[];
  followers: Follow[];
  loading: boolean;
}

export function useFollowing(): UseFollowingResult {
  const { user } = useAuthStore();

  const [following, setFollowing] = useState<Follow[]>([]);
  const [followers, setFollowers] = useState<Follow[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!user) {
      setFollowing([]);
      setFollowers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // ── Who I follow ────────────────────────────────────────────────────
        const followingQuery = query(
          collection(db, 'follows', user!.uid, 'following'),
          orderBy('followedAt', 'desc'),
        );
        const followingSnap = await getDocs(followingQuery);
        const followingList: Follow[] = followingSnap.docs.map((d) => ({
          ...(d.data() as Omit<Follow, 'targetUid'>),
          targetUid: d.data().targetUid ?? d.id,
        }));

        // ── Who follows me ───────────────────────────────────────────────────
        // Collection-group query across all users' `following` subcollections
        // where targetUid == my uid.
        const followersQuery = query(
          collectionGroup(db, 'following'),
          where('targetUid', '==', user!.uid),
          orderBy('followedAt', 'desc'),
        );
        const followersSnap = await getDocs(followersQuery);
        const followersList: Follow[] = followersSnap.docs.map((d) => ({
          ...(d.data() as Omit<Follow, 'targetUid'>),
          // The follower's uid is the parent document id (the `follows/{uid}` segment)
          targetUid: d.ref.parent.parent?.id ?? d.id,
        }));

        if (!cancelled) {
          setFollowing(followingList);
          setFollowers(followersList);
        }
      } catch (err) {
        console.error('[useFollowing] load error', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  return { following, followers, loading };
}
