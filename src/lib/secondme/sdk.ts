import { env } from '@/lib/config/env';

interface SecondMeEnvelope<T> {
  code: number;
  message?: string;
  data: T;
}

export interface SecondMeTokenData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope?: string;
  tokenType?: string;
}

export interface SecondMeUserInfo {
  id?: string;
  userId?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  route?: string;
}

function pickFirstString(
  raw: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return undefined;
}

function normalizeAvatarUrl(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (value.startsWith('//')) {
    return `https:${value}`;
  }
  if (value.startsWith('/')) {
    return `${env.secondmeApiBaseUrl}${value}`;
  }
  return value;
}

function resolveEndpoint(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  return `${env.secondmeApiBaseUrl}${pathOrUrl}`;
}

function normalizeTokenData(raw: Record<string, unknown>): SecondMeTokenData {
  return {
    accessToken: String(raw.access_token ?? raw.accessToken ?? ''),
    refreshToken: String(raw.refresh_token ?? raw.refreshToken ?? ''),
    expiresIn: Number(raw.expires_in ?? raw.expiresIn ?? 0),
    scope: raw.scope ? String(raw.scope) : undefined,
    tokenType: raw.token_type ? String(raw.token_type) : undefined
  };
}

export class SecondMeSdk {
  buildAuthorizeUrl(state: string, scopes: string[]): string {
    const params = new URLSearchParams({
      client_id: env.secondmeClientId,
      redirect_uri: env.secondmeOauthRedirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state
    });
    return `${env.secondmeOauthUrl}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<SecondMeTokenData> {
    const form = new URLSearchParams({
      client_id: env.secondmeClientId,
      client_secret: env.secondmeClientSecret,
      redirect_uri: env.secondmeOauthRedirectUri,
      grant_type: 'authorization_code',
      code
    });

    const response = await fetch(resolveEndpoint(env.secondmeTokenCodeEndpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: form.toString(),
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`SecondMe token exchange failed: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as SecondMeEnvelope<Record<string, unknown>>;
    if (payload.code !== 0) {
      throw new Error(`SecondMe token exchange rejected: code=${payload.code}`);
    }

    return normalizeTokenData(payload.data);
  }

  async refreshAccessToken(refreshToken: string): Promise<SecondMeTokenData> {
    const form = new URLSearchParams({
      client_id: env.secondmeClientId,
      client_secret: env.secondmeClientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });

    const response = await fetch(resolveEndpoint(env.secondmeTokenRefreshEndpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: form.toString(),
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`SecondMe token refresh failed: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as SecondMeEnvelope<Record<string, unknown>>;
    if (payload.code !== 0) {
      throw new Error(`SecondMe token refresh rejected: code=${payload.code}`);
    }

    return normalizeTokenData(payload.data);
  }

  async getUserInfo(accessToken: string): Promise<SecondMeUserInfo> {
    const response = await fetch(`${env.secondmeApiBaseUrl}/api/secondme/user/info`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`SecondMe user info failed: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as SecondMeEnvelope<Record<string, unknown>>;
    if (payload.code !== 0) {
      throw new Error(`SecondMe user info rejected: code=${payload.code}`);
    }

    const data = payload.data;

    const userId = pickFirstString(data, ['userId', 'user_id', 'uid']);
    const id = pickFirstString(data, ['id']);
    const name = pickFirstString(data, ['name', 'nickname', 'nick_name']);
    const email = pickFirstString(data, ['email']);
    const avatarRaw = pickFirstString(data, ['avatarUrl', 'avatar_url', 'avatar', 'picture', 'headImg', 'head_img']);
    const route = pickFirstString(data, ['route']);

    return {
      id,
      userId,
      name,
      email,
      avatarUrl: normalizeAvatarUrl(avatarRaw),
      route
    };
  }
}

export const secondMeSdk = new SecondMeSdk();
