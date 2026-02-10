import { ParticipantType, RoomStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';

interface JoinRoomBody {
  displayName?: string;
  participantType?: ParticipantType;
}

function isValidParticipantType(value: unknown): value is ParticipantType {
  return value === 'HUMAN' || value === 'AGENT';
}

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> }
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { roomId } = await context.params;
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { participants: true }
  });

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }
  if (room.status !== RoomStatus.WAITING) {
    return NextResponse.json({ error: 'Room is not joinable' }, { status: 409 });
  }

  const existing = room.participants.find((item) => item.userId === user.id);
  if (existing) {
    return NextResponse.json({ participant: existing, room });
  }

  const body = (await request.json()) as JoinRoomBody;
  const participantType = isValidParticipantType(body.participantType)
    ? body.participantType
    : ParticipantType.HUMAN;

  const maxSeat = room.participants.reduce((max, participant) => Math.max(max, participant.seatOrder), 0);

  const participant = await prisma.participant.create({
    data: {
      roomId,
      participantType,
      userId: user.id,
      displayName: body.displayName?.trim() || user.name || 'Player',
      seatOrder: maxSeat + 1,
      isReady: true
    }
  });

  return NextResponse.json({ participant });
}
