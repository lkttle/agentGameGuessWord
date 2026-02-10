import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  _request: Request,
  context: { params: Promise<{ matchId: string }> }
): Promise<Response> {
  const { matchId } = await context.params;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      room: {
        include: {
          participants: true
        }
      },
      roundLogs: {
        orderBy: { roundIndex: 'asc' }
      }
    }
  });

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  const byActor = new Map<string, { score: number; correctCount: number }>();
  for (const log of match.roundLogs) {
    const current = byActor.get(log.actorId) ?? { score: 0, correctCount: 0 };
    current.score += log.scoreDelta;
    if (log.isCorrect) {
      current.correctCount += 1;
    }
    byActor.set(log.actorId, current);
  }

  const participants = match.room.participants.map((participant) => {
    const stat = byActor.get(participant.id) ?? { score: 0, correctCount: 0 };
    return {
      participantId: participant.id,
      displayName: participant.displayName,
      participantType: participant.participantType,
      score: stat.score,
      correctCount: stat.correctCount
    };
  });

  return NextResponse.json({
    matchId: match.id,
    roomId: match.roomId,
    status: match.status,
    winnerUserId: match.winnerUserId,
    startedAt: match.startedAt,
    endedAt: match.endedAt,
    totalRounds: match.totalRounds,
    participants
  });
}
