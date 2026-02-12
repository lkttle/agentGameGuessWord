import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getAgentCacheProgressStats } from '@/lib/agent/question-cache';

export async function GET(): Promise<Response> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = await getAgentCacheProgressStats();
  return NextResponse.json({
    ...stats,
    serverTime: new Date().toISOString()
  });
}
