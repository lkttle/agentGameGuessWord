'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';

interface RecentUser {
  id: string;
  name?: string | null;
  secondmeUserId?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
}

interface RecentUsersResponse {
  users?: RecentUser[];
}

const avatarBackgrounds = [
  'linear-gradient(135deg, #7C3AED, #A855F7)',
  'linear-gradient(135deg, #0EA5E9, #38BDF8)',
  'linear-gradient(135deg, #14B8A6, #34D399)',
  'linear-gradient(135deg, #F59E0B, #F97316)',
  'linear-gradient(135deg, #EC4899, #F472B6)',
  'linear-gradient(135deg, #6366F1, #8B5CF6)'
];

function resolveDisplayName(user: RecentUser): string {
  return user.name || user.secondmeUserId || 'SecondMe 玩家';
}

function resolveAvatarText(name: string): string {
  const value = name.trim();
  if (!value) {
    return '玩';
  }
  return value[0] ?? '玩';
}

function resolveAvatarBackground(seed: string): string {
  let hash = 0;
  for (const character of seed) {
    hash = (hash << 5) - hash + character.charCodeAt(0);
    hash |= 0;
  }
  const safeIndex = Math.abs(hash) % avatarBackgrounds.length;
  return avatarBackgrounds[safeIndex] ?? avatarBackgrounds[0];
}

function dedupeUsersByIdentity(users: RecentUser[]): RecentUser[] {
  const seen = new Set<string>();
  const result: RecentUser[] = [];

  users.forEach((user) => {
    const identity = user.secondmeUserId || user.id;
    if (seen.has(identity)) {
      return;
    }
    seen.add(identity);
    result.push(user);
  });

  return result;
}

function CommunityAvatar({ user, displayName }: { user: RecentUser; displayName: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const avatarSeed = user.id || user.secondmeUserId || displayName;
  const fallbackText = resolveAvatarText(displayName);
  const avatarStyle = {
    '--avatar-bg': resolveAvatarBackground(avatarSeed)
  } as CSSProperties;
  const canShowImage = Boolean(user.avatarUrl) && !imageFailed;

  return (
    <span className="hero-community__avatar" style={avatarStyle} aria-hidden="true">
      {canShowImage ? (
        <img
          src={String(user.avatarUrl)}
          alt={`${displayName}头像`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="hero-community__avatar-fallback">{fallbackText}</span>
      )}
    </span>
  );
}

export function HomeRecentUsersTicker() {
  const [users, setUsers] = useState<RecentUser[]>([]);

  useEffect(() => {
    let active = true;

    async function loadRecentUsers() {
      try {
        const res = await fetch('/api/community/recent-logins', { cache: 'no-store' });
        if (!res.ok || !active) {
          return;
        }
        const payload = (await res.json()) as RecentUsersResponse;
        if (!active) {
          return;
        }
        setUsers(Array.isArray(payload.users) ? payload.users : []);
      } catch {
        if (active) {
          setUsers([]);
        }
      }
    }

    void loadRecentUsers();

    const interval = setInterval(() => {
      void loadRecentUsers();
    }, 30_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const marqueeUsers = useMemo(() => {
    if (!users.length) {
      return [];
    }

    const dedupedUsers = dedupeUsersByIdentity(users);

    const prioritizedUsers = dedupedUsers
      .sort((left, right) => {
        const leftCreatedAt = left.createdAt ? Date.parse(left.createdAt) : 0;
        const rightCreatedAt = right.createdAt ? Date.parse(right.createdAt) : 0;

        if (leftCreatedAt !== rightCreatedAt) {
          return rightCreatedAt - leftCreatedAt;
        }

        const leftHasAvatar = Boolean(left.avatarUrl);
        const rightHasAvatar = Boolean(right.avatarUrl);
        if (leftHasAvatar === rightHasAvatar) {
          return 0;
        }
        return leftHasAvatar ? -1 : 1;
      });

    if (!prioritizedUsers.length) {
      return [];
    }

    return [...prioritizedUsers, ...prioritizedUsers];
  }, [users]);

  const recentCount = users.length;

  if (!users.length) {
    return null;
  }

  return (
    <div className="hero-community" aria-label="已登录用户展示">
      <div className="hero-community__header">
        <p className="hero-community__title">
          <span className="hero-community__dot" aria-hidden="true" />
          最近登录：{recentCount} 位 SecondMe 玩家
        </p>
      </div>
      <div className="hero-community__track">
        <div className="hero-community__marquee">
          {marqueeUsers.map((user, index) => {
            const displayName = resolveDisplayName(user);

            return (
              <div
                key={`${user.id}-${index}`}
                className="hero-community__item"
                title={`${displayName} 正在玩`}
              >
                <CommunityAvatar user={user} displayName={displayName} />
                <span className="hero-community__name">{displayName}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
