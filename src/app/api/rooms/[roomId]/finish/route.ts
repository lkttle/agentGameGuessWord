import { MatchStatus, RoomStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';
import { assertRoomTransition } from '@/lib/room/room-state';

interface FinishRoomBody {
  winnerUserId?: string;
  totalRounds?: number;
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
  const room = await prisma.room.findUnique({ where: { id: roomId } });

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }
  if (room.hostUserId !== user.id) {
    return NextResponse.json({ error: 'Only host can finish room' }, { status: 403 });
  }

  assertRoomTransition(room.status, RoomStatus.FINISHED);

  const body = (await request.json()) as FinishRoomBody;

  const result = await prisma.$transaction(async (tx) => {
    const updatedRoom = await tx.room.update({
      where: { id: room.id },
      data: { status: RoomStatus.FINISHED }
    });

    const match = await tx.match.update({
      where: { roomId: room.id },
      data: {
        status: MatchStatus.FINISHED,
        winnerUserId: body.winnerUserId,
        totalRounds: body.totalRounds ?? undefined,
        endedAt: new Date()
      }
    });

    return { updatedRoom, match };
  });

  return NextResponse.json({ room: result.updatedRoom, match: result.match });
}
