/**
 * app/following/page.tsx
 * Lists the people the current user follows and who follows them.
 *
 * Tabs:
 *   Following — people I follow (with Unfollow button)
 *   Followers — people who follow me
 *
 * Each entry: avatar/initials, display name, role badge, FollowButton,
 * link to their public profile.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import BuyerLayout  from '@/components/layouts/BuyerLayout';
import FollowButton from '@/components/ui/FollowButton';
import { useFollowing } from '@/hooks/useFollowing';
import { useAuthStore }  from '@/store/authStore';
import type { Follow } from '@/types';

// ─────────────────────────────────────────────
// Role badge colour map
// ─────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  buyer:   'var(--color-primary, #3b82f6)',
  seller:  '#8b5cf6',
  advisor: 'var(--color-success, #10b981)',
};

// ─────────────────────────────────────────────
// Skeleton card
// ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 0',
        borderBottom: '1px solid var(--color-border)',
        animation: 'fol-pulse 1.4s ease-in-out infinite',
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-surface)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: 140, height: 14, borderRadius: 6, background: 'var(--color-surface)', marginBottom: 8 }} />
        <div style={{ width: 60, height: 11, borderRadius: 10, background: 'var(--color-surface)' }} />
      </div>
      <div style={{ width: 72, height: 28, borderRadius: 14, background: 'var(--color-surface)' }} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Single person row
// ─────────────────────────────────────────────

function PersonRow({ person, showFollowButton }: { person: Follow; showFollowButton: boolean }) {
  const initials = person.targetName
    ? person.targetName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const roleColor = ROLE_COLOR[person.targetRole] ?? 'var(--color-primary)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Avatar */}
      <Link
        href={`/profile/${person.targetUid}`}
        style={{ textDecoration: 'none', flexShrink: 0 }}
        aria-label={`View ${person.targetName}'s profile`}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: person.targetPhoto ? 'transparent' : roleColor,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {person.targetPhoto ? (
            <img
              src={person.targetPhoto}
              alt={person.targetName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            initials
          )}
        </div>
      </Link>

      {/* Name + role badge */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link
          href={`/profile/${person.targetUid}`}
          style={{ textDecoration: 'none' }}
        >
          <p
            style={{
              margin: '0 0 4px',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--color-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {person.targetName || 'Unknown User'}
          </p>
        </Link>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 9px',
            borderRadius: 20,
            background: `color-mix(in srgb, ${roleColor} 14%, transparent)`,
            color: roleColor,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'capitalize' as const,
          }}
        >
          {person.targetRole}
        </span>
      </div>

      {/* Follow / Unfollow button */}
      {showFollowButton && (
        <FollowButton
          targetUid={person.targetUid}
          targetName={person.targetName}
          targetRole={person.targetRole}
          targetPhoto={person.targetPhoto}
          size="sm"
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────

function EmptyState({ tab }: { tab: 'following' | 'followers' }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <Users size={28} color="var(--color-primary)" />
      </div>
      {tab === 'following' ? (
        <>
          <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
            Not following anyone yet
          </p>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Discover advisors and sellers to follow and stay updated on their latest posts and products.
          </p>
          <Link
            href="/advisors"
            style={{
              display: 'inline-block',
              padding: '9px 22px',
              background: 'var(--color-primary)',
              color: '#fff',
              borderRadius: 9,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Discover Advisors
          </Link>
        </>
      ) : (
        <>
          <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
            No followers yet
          </p>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            When someone follows you, they'll appear here.
          </p>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

type ActiveTab = 'following' | 'followers';

const TABS: { key: ActiveTab; label: string }[] = [
  { key: 'following', label: 'Following' },
  { key: 'followers', label: 'Followers' },
];

export default function FollowingPage() {
  const { user } = useAuthStore();
  const { following, followers, loading } = useFollowing();
  const [activeTab, setActiveTab] = useState<ActiveTab>('following');

  const list = activeTab === 'following' ? following : followers;

  return (
    <>
      <style>{`
        @keyframes fol-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
        .fol-tab { background: none; border: none; cursor: pointer; transition: color 0.15s; }
        .fol-tab:hover { color: var(--color-primary) !important; }
      `}</style>

      <BuyerLayout>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 0 80px' }}>

          {/* Page title */}
          <h1
            style={{
              margin: '0 0 4px',
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--color-text)',
              padding: '24px 20px 0',
            }}
          >
            Network
          </h1>
          <p style={{ margin: '0 0 0', fontSize: 14, color: 'var(--color-text-secondary)', padding: '0 20px 4px' }}>
            People you follow and who follow you
          </p>

          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              padding: '8px 20px 0',
              borderBottom: '1px solid var(--color-border)',
              marginTop: 8,
            }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className="fol-tab"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: activeTab === tab.key ? 700 : 500,
                  color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  borderBottom: activeTab === tab.key
                    ? '2px solid var(--color-primary)'
                    : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {tab.label}
                {!loading && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {tab.key === 'following' ? following.length : followers.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          <div style={{ padding: '0 20px' }}>
            {loading ? (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </>
            ) : list.length === 0 ? (
              <EmptyState tab={activeTab} />
            ) : (
              list.map((person) => (
                <PersonRow
                  key={person.targetUid}
                  person={person}
                  showFollowButton={activeTab === 'following' || !!user}
                />
              ))
            )}
          </div>
        </div>
      </BuyerLayout>
    </>
  );
}
