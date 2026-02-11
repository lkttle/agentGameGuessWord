import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';
import { consumeMatchQuestion } from '@/lib/warmup/service';

export async function POST(
  _request: Request,
  context: { params: Promise<{ matchId: string }> }
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { matchId } = await context.params;
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      room: {
        select: {
          hostUserId: true,
          status: true
        }
      }
    }
  });

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  if (match.room.hostUserId !== user.id) {
    return NextResponse.json({ error: 'Only host can request question' }, { status: 403 });
  }

  const question = await consumeMatchQuestion(matchId);
  if (!question) {
    return NextResponse.json({ error: 'No question available' }, { status: 409 });
  }

  const queuePending = await prisma.matchQuestion.count({
    where: {
      matchId,
      consumedAt: null
    }
  });

  return NextResponse.json({ question, debug: { queuePending } });
}
