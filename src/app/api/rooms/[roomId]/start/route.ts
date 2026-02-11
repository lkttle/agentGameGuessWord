import { MatchStatus, MetricEventType, RoomStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';
import { assertRoomTransition, validateRoomParticipants } from '@/lib/room/room-state';
import { recordMetricEvent } from '@/lib/metrics/service';

export async function POST(
  _request: Request,
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
  if (room.hostUserId !== user.id) {
    return NextResponse.json({ error: 'Only host can start room' }, { status: 403 });
  }

  const participantValidationError = validateRoomParticipants(
    room.participants,
    4,
    room.mode === 'HUMAN_VS_AGENT'
  );
  if (participantValidationError) {
    return NextResponse.json({ error: participantValidationError }, { status: 400 });
  }

  try {
    assertRoomTransition(room.status, RoomStatus.RUNNING);
  } catch {
    return NextResponse.json({ error: 'Invalid room status transition' }, { status: 409 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedRoom = await tx.room.update({
      where: { id: room.id },
      data: { status: RoomStatus.RUNNING }
    });

    const match = await tx.match.create({
      data: {
        roomId: room.id,
        status: MatchStatus.RUNNING,
        startedAt: new Date()
      }
    });

    return { updatedRoom, match };
  });

  await recordMetricEvent(MetricEventType.MATCH_START, {
    userId: user.id,
    roomId: room.id,
    matchId: result.match.id,
    payload: {
      mode: room.mode,
      participantCount: room.participants.length
    }
  });

  return NextResponse.json({ room: result.updatedRoom, match: result.match });
}
