import { MatchStatus, RoomStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';
import { assertRoomTransition } from '@/lib/room/room-state';

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
  if (room.participants.length < 2) {
    return NextResponse.json({ error: 'At least two participants required' }, { status: 400 });
  }

  assertRoomTransition(room.status, RoomStatus.RUNNING);

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

  return NextResponse.json({ room: result.updatedRoom, match: result.match });
}
