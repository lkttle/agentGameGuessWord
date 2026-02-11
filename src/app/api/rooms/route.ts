import { GameMode, ParticipantType, RoomStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';
import {
  buildParticipantConfigs,
  normalizeAlias,
  validateParticipantConfigs,
  type ParticipantConfigInput
} from '@/lib/room/participants';
import { pickStandbyAgentsForRoom } from '@/lib/warmup/service';

interface CreateRoomBody {
  mode?: GameMode;
  displayName?: string;
  alias?: string;
  autoJoinSelfAgent?: boolean;
  participantCount?: number;
  participantsConfig?: ParticipantConfigInput[];
}

function isValidMode(mode: unknown): mode is GameMode {
  return mode === 'AGENT_VS_AGENT' || mode === 'HUMAN_VS_AGENT';
}

export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as CreateRoomBody;
  if (!isValidMode(body.mode)) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }

  const useLegacyPath =
    body.alias === undefined &&
    body.autoJoinSelfAgent === undefined &&
    body.participantCount === undefined &&
    body.participantsConfig === undefined;

  if (useLegacyPath) {
    const displayName = body.displayName?.trim() || user.name || 'Host';
    const hostParticipantType =
      body.mode === GameMode.AGENT_VS_AGENT ? ParticipantType.AGENT : ParticipantType.HUMAN;

    const room = await prisma.room.create({
      data: {
        mode: body.mode,
        status: RoomStatus.WAITING,
        hostUserId: user.id,
        participants: {
          create: {
            participantType: hostParticipantType,
            userId: user.id,
            displayName,
            seatOrder: 1,
            isReady: true
          }
        }
      },
      include: {
        participants: true
      }
    });

    return NextResponse.json({ room });
  }

  // Pick prewarmed standby agents first (cache-friendly)
  const requestedCount = Math.max(2, Math.min(5, body.participantCount ?? 2));
  const autoJoinSelf = Boolean(body.autoJoinSelfAgent);

  // Slots available for real agents (total - host - optional self agent)
  const realAgentSlots = requestedCount - 1 - (autoJoinSelf ? 1 : 0);
  const standbyAgents = realAgentSlots > 0
    ? await pickStandbyAgentsForRoom(realAgentSlots + 1)
    : [];
  const realUsers = standbyAgents
    .filter((item) => item.userId !== user.id)
    .slice(0, realAgentSlots)
    .map((item) => ({
      id: item.userId,
      name: item.name
    }));

  // Build participantsConfig with real users injected
  const realUserConfigs: ParticipantConfigInput[] = realUsers.map((ru) => ({
    type: ParticipantType.AGENT,
    displayName: `${ru.name || 'SecondMe 玩家'} 的 Agent`,
    userId: ru.id,
    ownerUserId: ru.id,
    agentSource: 'SELF' as const
  }));

  const participantConfigs = buildParticipantConfigs({
    host: user,
    mode: body.mode,
    autoJoinSelfAgent: autoJoinSelf,
    participantCount: body.participantCount,
    participantsConfig: body.participantsConfig,
    preferredDisplayName: body.displayName,
    alias: normalizeAlias(body.alias),
    realUserAgents: realUserConfigs
  });

  const validationError = validateParticipantConfigs(participantConfigs, body.mode);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const room = await prisma.room.create({
    data: {
      mode: body.mode,
      status: RoomStatus.WAITING,
      hostUserId: user.id,
      participants: {
        create: participantConfigs.map((participant, index) => ({
          participantType: participant.type,
          userId: participant.userId,
          displayName: participant.displayName?.trim() ||
            (participant.type === ParticipantType.HUMAN ? user.name || 'Player' : `Agent ${index + 1}`),
          seatOrder: index + 1,
          isReady: true
        }))
      }
    },
    include: {
      participants: true
    }
  });

  return NextResponse.json({ room });
}
