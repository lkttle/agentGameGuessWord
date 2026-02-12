import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { triggerGlobalPrewarm, triggerUserPrewarm } from '@/lib/agent/question-cache';

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      secondmeUserId: true,
      name: true,
      email: true,
      avatarUrl: true,
      route: true
    }
  });

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  triggerGlobalPrewarm('auth_session_access');
  triggerUserPrewarm(user.id, 'auth_session_access_user');

  return NextResponse.json({
    authenticated: true,
    user
  });
}
