import { GameMode, ParticipantType, RoomStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';

interface CreateRoomBody {
  mode?: GameMode;
  displayName?: string;
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
