import { LeaderboardPeriod } from '@prisma/client';
import { prisma } from '@/lib/db';

function buildDateKey(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function updateLeaderboardForFinishedRoom(roomId: string): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { roomId },
    include: {
      room: {
        include: {
          participants: true
        }
      },
      roundLogs: true
    }
  });

  if (!match || match.status !== 'FINISHED') {
    return;
  }

  const participantToUser = new Map(
    match.room.participants
      .filter((participant) => participant.userId)
      .map((participant) => [participant.id, participant.userId as string])
  );

  const scoreMap = new Map<string, number>();
  for (const log of match.roundLogs) {
    const userId = participantToUser.get(log.actorId);
    if (!userId) {
      continue;
    }
    const current = scoreMap.get(userId) ?? 0;
    scoreMap.set(userId, current + log.scoreDelta);
  }

  const winnerUserId = match.winnerUserId;
  const dateKey = buildDateKey();

  await prisma.$transaction(async (tx) => {
    for (const [userId, score] of scoreMap.entries()) {
      const isWinner = winnerUserId === userId;
      const wins = isWinner ? 1 : 0;
      const losses = isWinner ? 0 : 1;

      await tx.leaderboardEntry.upsert({
        where: {
          userId_period_dateKey: {
            userId,
            period: LeaderboardPeriod.ALL_TIME,
            dateKey: 'ALL_TIME'
          }
        },
        update: {
          score: { increment: score },
          wins: { increment: wins },
          losses: { increment: losses }
        },
        create: {
          userId,
          period: LeaderboardPeriod.ALL_TIME,
          dateKey: 'ALL_TIME',
          score,
          wins,
          losses
        }
      });

      await tx.leaderboardEntry.upsert({
        where: {
          userId_period_dateKey: {
            userId,
            period: LeaderboardPeriod.DAILY,
            dateKey
          }
        },
        update: {
          score: { increment: score },
          wins: { increment: wins },
          losses: { increment: losses }
        },
        create: {
          userId,
          period: LeaderboardPeriod.DAILY,
          dateKey,
          score,
          wins,
          losses
        }
      });
    }
  });
}
