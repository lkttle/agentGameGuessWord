import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { env } from '@/lib/config/env';

const SESSION_COOKIE_NAME = 'a2a_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface SessionPayload {
  userId: string;
  secondmeUserId: string;
  iat: number;
  exp: number;
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function sign(data: string): string {
  return crypto.createHmac('sha256', env.sessionSecret).update(data).digest('base64url');
}

function encode(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(data);
  return `${data}.${signature}`;
}

function decode(token: string): SessionPayload | null {
  const [data, signature] = token.split('.');
  if (!data || !signature) {
    return null;
  }
  const expected = sign(data);
  if (!safeEqual(signature, expected)) {
    return null;
  }
  const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
  if (Date.now() > parsed.exp * 1000) {
    return null;
  }
  return parsed;
}

export async function createSession(userId: string, secondmeUserId: string): Promise<void> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + SESSION_TTL_SECONDS;
  const token = encode({ userId, secondmeUserId, iat, exp });

  const store = await cookies();
  store.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return decode(token);
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}
