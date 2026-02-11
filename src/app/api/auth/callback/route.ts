import { MetricEventType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { verifyAndConsumeOauthState } from '@/lib/auth/oauth-state';
import { consumeOauthReturnTo } from '@/lib/auth/oauth-state';
import { createSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { env } from '@/lib/config/env';
import { secondMeSdk } from '@/lib/secondme/sdk';
import { recordMetricEvent } from '@/lib/metrics/service';

function normalizeAvatarFromProfile(profile: {
  avatarUrl?: string;
}): string | undefined {
  const raw = profile.avatarUrl;
  if (!raw) {
    return undefined;
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  if (raw.startsWith('//')) {
    return `https:${raw}`;
  }
  return raw;
}

function redirectTo(path: string): Response {
  return NextResponse.redirect(new URL(path, env.appBaseUrl));
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return redirectTo('/?auth_error=missing_code_or_state');
  }

  const validState = await verifyAndConsumeOauthState(state);
  if (!validState) {
    return redirectTo('/?auth_error=invalid_state');
  }

  try {
    const token = await secondMeSdk.exchangeCode(code);
    const profile = await secondMeSdk.getUserInfo(token.accessToken);
    const normalizedAvatarUrl = normalizeAvatarFromProfile(profile);

    const secondmeUserId = profile.userId ?? profile.id;
    if (!secondmeUserId) {
      return redirectTo('/?auth_error=missing_user_id');
    }

    const user = await prisma.user.upsert({
      where: { secondmeUserId },
      update: {
        email: profile.email,
        name: profile.name,
        avatarUrl: normalizedAvatarUrl,
        route: profile.route,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000)
      },
      create: {
        secondmeUserId,
        email: profile.email,
        name: profile.name,
        avatarUrl: normalizedAvatarUrl,
        route: profile.route,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000)
      }
    });

    await createSession(user.id, secondmeUserId);
    await recordMetricEvent(MetricEventType.LOGIN_SUCCESS, {
      userId: user.id,
      payload: { secondmeUserId }
    });

    const returnTo = await consumeOauthReturnTo('/');
    return redirectTo(returnTo);
  } catch (error) {
    console.error('OAuth callback failed', error);
    return redirectTo('/?auth_error=oauth_callback_failed');
  }
}
