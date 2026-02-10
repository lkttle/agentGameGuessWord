import crypto from 'node:crypto';
import { cookies } from 'next/headers';

const OAUTH_STATE_COOKIE = 'a2a_oauth_state';
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export async function issueOauthState(): Promise<string> {
  const value = crypto.randomBytes(24).toString('hex');
  const store = await cookies();
  store.set({
    name: OAUTH_STATE_COOKIE,
    value,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS
  });
  return value;
}

export async function verifyAndConsumeOauthState(received: string): Promise<boolean> {
  const store = await cookies();
  const current = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);
  if (!current || !received) {
    return false;
  }
  return safeEqual(current, received);
}
