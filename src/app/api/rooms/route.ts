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

  const participantConfigs = buildParticipantConfigs({
    host: user,
    mode: body.mode,
    autoJoinSelfAgent: Boolean(body.autoJoinSelfAgent),
    participantCount: body.participantCount,
    participantsConfig: body.participantsConfig,
    preferredDisplayName: body.displayName,
    alias: normalizeAlias(body.alias)
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
