import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { prewarmQuestionCache, triggerGlobalPrewarm, triggerUserPrewarm } from '@/lib/agent/question-cache';

interface PrewarmRequestBody {
  scope?: 'all' | 'self';
  sync?: boolean;
}

export async function POST(request: Request): Promise<Response> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: PrewarmRequestBody = {};
  try {
    body = (await request.json()) as PrewarmRequestBody;
  } catch {
    body = {};
  }

  const scope = body.scope === 'self' ? 'self' : 'all';
  const sync = body.sync === true;

  if (sync) {
    const stats = await prewarmQuestionCache({
      targetUserId: scope === 'self' ? currentUser.id : undefined,
      reason: `api_sync_${scope}`
    });
    return NextResponse.json({ started: true, mode: 'sync', scope, stats });
  }

  const started = scope === 'self'
    ? triggerUserPrewarm(currentUser.id, 'api_async_self')
    : triggerGlobalPrewarm('api_async_all');

  return NextResponse.json({
    started,
    mode: 'async',
    scope
  });
}
