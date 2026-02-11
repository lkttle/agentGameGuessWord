import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { secondMeSdk } from '@/lib/secondme/sdk';

interface CommunityUserRow {
  id: string;
  name: string | null;
  secondmeUserId: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}

async function refreshTokenIfNeeded(user: CommunityUserRow): Promise<string | null> {
  if (!user.accessToken) {
    return null;
  }

  const expiresSoon = user.tokenExpiresAt
    ? user.tokenExpiresAt.getTime() <= Date.now() + 60_000
    : false;

  if (!expiresSoon || !user.refreshToken) {
    return user.accessToken;
  }

  try {
    const refreshed = await secondMeSdk.refreshAccessToken(user.refreshToken);
    const nextRefreshToken = refreshed.refreshToken || user.refreshToken;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        accessToken: refreshed.accessToken,
        refreshToken: nextRefreshToken,
        tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000)
      }
    });

    return refreshed.accessToken;
  } catch {
    return user.accessToken;
  }
}

async function resolveAvatarWithSdk(user: CommunityUserRow): Promise<{ avatarUrl: string | null; name: string | null }> {
  const usableAccessToken = await refreshTokenIfNeeded(user);
  if (!usableAccessToken) {
    return { avatarUrl: user.avatarUrl, name: user.name };
  }

  try {
    const profile = await secondMeSdk.getUserInfo(usableAccessToken);
    const avatarUrl = profile.avatarUrl ?? user.avatarUrl ?? null;
    const name = profile.name ?? user.name ?? null;

    if (avatarUrl !== user.avatarUrl || name !== user.name) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          avatarUrl,
          name
        }
      });
    }

    return { avatarUrl, name };
  } catch {
    return { avatarUrl: user.avatarUrl, name: user.name };
  }
}

export async function GET(): Promise<Response> {
  const users = await prisma.user.findMany({
    where: {
      secondmeUserId: {
        not: null
      }
    },
    select: {
      id: true,
      name: true,
      secondmeUserId: true,
      avatarUrl: true,
      createdAt: true,
      accessToken: true,
      refreshToken: true,
      tokenExpiresAt: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 24
  });

  const usersWithSdkAvatar = await Promise.all(
    users.map(async (user) => {
      const sdkProfile = await resolveAvatarWithSdk(user);
      return {
        id: user.id,
        name: sdkProfile.name,
        secondmeUserId: user.secondmeUserId,
        avatarUrl: sdkProfile.avatarUrl,
        createdAt: user.createdAt.toISOString()
      };
    })
  );

  const usersWithAvatarFirst = usersWithSdkAvatar
    .filter((user) => Boolean(user.avatarUrl))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  const fallbackUsers = usersWithSdkAvatar
    .filter((user) => !user.avatarUrl)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  const orderedUsers = [...usersWithAvatarFirst, ...fallbackUsers];

  return NextResponse.json({ users: orderedUsers });
}
