/**
 * services/loyalty.ts
 * Phase 5 — Loyalty program domain logic.
 *
 * Atomicity: all point mutations use Firestore runTransaction so the
 * account balance and the transaction log can never diverge.
 *
 * Collections:
 *   loyaltyAccounts/{uid}
 *   loyaltyTransactions/{txId}
 *   loyaltyRewards/{rewardId}
 */

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp as FsTimestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type {
  LoyaltyAccount,
  LoyaltyAction,
  LoyaltyReward,
  LoyaltyTier,
} from '@/types';

// ─── Configuration ────────────────────────────────────────────────────────────

export const TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  bronze:   0,
  silver:   500,
  gold:     2000,
  platinum: 5000,
};

export const POINTS_PER_ACTION: Record<Exclude<LoyaltyAction, 'redemption'>, number> = {
  purchase:      10,
  review:        50,
  referral:      200,
  signup:        100,
  'first-order': 250,
};

const TIER_ORDER: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum'];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Calculate the tier a given lifetime-points balance falls in. */
export function calculateTier(points: number): LoyaltyTier {
  let current: LoyaltyTier = 'bronze';
  for (const tier of TIER_ORDER) {
    if (points >= TIER_THRESHOLDS[tier]) current = tier;
  }
  return current;
}

/** Points needed to reach next tier (0 if already platinum). */
export function pointsToNextTier(currentPoints: number): number {
  const tier = calculateTier(currentPoints);
  const idx  = TIER_ORDER.indexOf(tier);
  if (idx === TIER_ORDER.length - 1) return 0;
  const nextTier = TIER_ORDER[idx + 1];
  return Math.max(0, TIER_THRESHOLDS[nextTier] - currentPoints);
}

// ─── Mutations ────────────────────────────────────────────────────────────────

interface AwardMeta {
  orderId?: string;
  reviewId?: string;
  referralId?: string;
  description?: string;
}

/**
 * Award points to a user (creates account if missing, writes a transaction
 * record, and updates the rolling balance atomically).
 */
export async function awardPoints(
  uid: string,
  action: LoyaltyAction,
  points: number,
  meta: AwardMeta = {},
): Promise<void> {
  if (!uid) throw new Error('awardPoints: uid is required');
  if (!Number.isFinite(points)) throw new Error('awardPoints: points must be finite');

  const acctRef = doc(db, 'loyaltyAccounts', uid);
  const txRef   = doc(collection(db, 'loyaltyTransactions'));

  await runTransaction(db, async (trx) => {
    const snap = await trx.get(acctRef);
    const now  = FsTimestamp.now();

    const existing = snap.exists() ? (snap.data() as LoyaltyAccount) : null;
    const prevPts  = existing?.points         ?? 0;
    const prevLife = existing?.lifetimePoints ?? 0;

    const newPoints   = prevPts + points;
    // lifetimePoints only increases on positive deltas
    const newLifetime = prevLife + Math.max(0, points);
    const newTier     = calculateTier(newLifetime);
    const tierProg    = pointsToNextTier(newLifetime);

    if (!snap.exists()) {
      trx.set(acctRef, {
        uid,
        tier:           newTier,
        points:         newPoints,
        lifetimePoints: newLifetime,
        tierProgress:   tierProg,
        joinedAt:       now,
        updatedAt:      now,
      } satisfies LoyaltyAccount);
    } else {
      trx.update(acctRef, {
        tier:           newTier,
        points:         newPoints,
        lifetimePoints: newLifetime,
        tierProgress:   tierProg,
        updatedAt:      now,
      });
    }

    trx.set(txRef, {
      id:          txRef.id,
      uid,
      action,
      points,
      description: meta.description ?? defaultDescription(action, points),
      ...(meta.orderId    ? { orderId:    meta.orderId    } : {}),
      ...(meta.reviewId   ? { reviewId:   meta.reviewId   } : {}),
      ...(meta.referralId ? { referralId: meta.referralId } : {}),
      createdAt: now,
    });
  });
}

/**
 * Redeem a reward — deducts pointsCost from the user's balance and writes a
 * negative redemption transaction.  Returns success=false (without throwing)
 * when the user has insufficient points or the account is missing.
 */
export async function redeemReward(
  uid: string,
  reward: LoyaltyReward,
): Promise<{ success: boolean; message: string }> {
  if (!uid)            return { success: false, message: 'You must be signed in to redeem rewards.' };
  if (!reward.active)  return { success: false, message: 'This reward is no longer available.' };
  if (reward.pointsCost <= 0) {
    return { success: false, message: 'Invalid reward configuration.' };
  }

  const acctRef = doc(db, 'loyaltyAccounts', uid);
  const txRef   = doc(collection(db, 'loyaltyTransactions'));

  try {
    await runTransaction(db, async (trx) => {
      const snap = await trx.get(acctRef);
      if (!snap.exists()) throw new Error('NO_ACCOUNT');

      const acct = snap.data() as LoyaltyAccount;
      if (acct.points < reward.pointsCost) throw new Error('INSUFFICIENT');

      const now       = FsTimestamp.now();
      const newPoints = acct.points - reward.pointsCost;

      trx.update(acctRef, {
        points:    newPoints,
        updatedAt: now,
      });

      trx.set(txRef, {
        id:          txRef.id,
        uid,
        action:      'redemption' as LoyaltyAction,
        points:      -reward.pointsCost,
        description: `Redeemed: ${reward.name}`,
        createdAt:   now,
      });
    });

    return { success: true, message: `Redeemed "${reward.name}" for ${reward.pointsCost} points.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'UNKNOWN';
    if (msg === 'NO_ACCOUNT')   return { success: false, message: 'Loyalty account not found. Earn points first.' };
    if (msg === 'INSUFFICIENT') return { success: false, message: 'Not enough points to redeem this reward.' };
    return { success: false, message: 'Redemption failed. Please try again.' };
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function defaultDescription(action: LoyaltyAction, points: number): string {
  switch (action) {
    case 'purchase':    return `Earned ${points} points from a purchase`;
    case 'review':      return `Earned ${points} points for leaving a review`;
    case 'referral':    return `Earned ${points} points from a referral`;
    case 'signup':      return `Welcome bonus: ${points} points`;
    case 'first-order': return `First-order bonus: ${points} points`;
    case 'redemption':  return `Redeemed ${Math.abs(points)} points`;
  }
}
