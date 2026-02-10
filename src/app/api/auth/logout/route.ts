import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/auth/session';

export async function POST(): Promise<Response> {
  await clearSession();
  return NextResponse.json({ ok: true });
}
