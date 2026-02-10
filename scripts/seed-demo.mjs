import 'dotenv/config';
import { PrismaClient, MatchStatus, ParticipantType, RoomStatus, GameMode } from '@prisma/client';

const prisma = new PrismaClient();

function nowMinus(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function main() {
  const host = await prisma.user.upsert({
    where: { secondmeUserId: 'demo-host' },
    update: { name: 'Demo Host' },
    create: {
      secondmeUserId: 'demo-host',
      name: 'Demo Host',
      email: 'host@example.com'
    }
  });

  const player = await prisma.user.upsert({
    where: { secondmeUserId: 'demo-player' },
    update: { name: 'Demo Player' },
    create: {
      secondmeUserId: 'demo-player',
      name: 'Demo Player',
      email: 'player@example.com'
    }
  });

  const room = await prisma.room.create({
    data: {
      mode: GameMode.HUMAN_VS_AGENT,
      status: RoomStatus.FINISHED,
      hostUserId: host.id
    }
  });

  const humanParticipant = await prisma.participant.create({
    data: {
      roomId: room.id,
      userId: player.id,
      participantType: ParticipantType.HUMAN,
      displayName: 'Demo Player',
      seatOrder: 1,
      isReady: true
    }
  });

  const agentParticipant = await prisma.participant.create({
    data: {
      roomId: room.id,
      participantType: ParticipantType.AGENT,
      displayName: 'Demo Agent',
      seatOrder: 2,
      isReady: true
    }
  });

  const match = await prisma.match.create({
    data: {
      roomId: room.id,
      status: MatchStatus.FINISHED,
      winnerUserId: player.id,
      totalRounds: 2,
      startedAt: nowMinus(5),
      endedAt: nowMinus(1)
    }
  });

  await prisma.roundLog.createMany({
    data: [
      {
        matchId: match.id,
        roundIndex: 1,
        actorType: ParticipantType.HUMAN,
        actorId: humanParticipant.id,
        guessWord: 'apple',
        isCorrect: true,
        scoreDelta: 12,
        timedOut: false
      },
      {
        matchId: match.id,
        roundIndex: 2,
        actorType: ParticipantType.AGENT,
        actorId: agentParticipant.id,
        guessWord: 'angle',
        isCorrect: false,
        scoreDelta: 0,
        timedOut: false
      }
    ]
  });

  console.log(JSON.stringify({ roomId: room.id, matchId: match.id }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
