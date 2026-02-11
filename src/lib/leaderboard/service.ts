import { LeaderboardPeriod } from '@prisma/client';
import { prisma } from '@/lib/db';
import { calculateLeaderboardBonus } from '@/lib/game/guess-word-engine';

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

  // Calculate per-participant scores from round logs
  const participantScoreMap = new Map<string, number>();
  for (const log of match.roundLogs) {
    const current = participantScoreMap.get(log.actorId) ?? 0;
    participantScoreMap.set(log.actorId, current + log.scoreDelta);
  }

  // Rank participants by score descending
  const rankedParticipants = [...participantScoreMap.entries()]
    .sort((a, b) => b[1] - a[1]);

  const playerCount = match.room.participants.length;
  const dateKey = buildDateKey();

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < rankedParticipants.length; i++) {
      const [participantId] = rankedParticipants[i];
      const userId = participantToUser.get(participantId);
      if (!userId) {
        continue;
      }

      const ranking = i + 1;
      const bonus = calculateLeaderboardBonus(playerCount, ranking);
      const isWinner = ranking === 1;
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
          score: { increment: bonus },
          wins: { increment: wins },
          losses: { increment: losses }
        },
        create: {
          userId,
          period: LeaderboardPeriod.ALL_TIME,
          dateKey: 'ALL_TIME',
          score: bonus,
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
          score: { increment: bonus },
          wins: { increment: wins },
          losses: { increment: losses }
        },
        create: {
          userId,
          period: LeaderboardPeriod.DAILY,
          dateKey,
          score: bonus,
          wins,
          losses
        }
      });
    }
  });
}
