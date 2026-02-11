import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';
import { toRoomParticipantView } from '@/lib/room/room-state';

export async function GET(
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
    include: {
      participants: {
        include: {
          user: {
            select: { avatarUrl: true, selfIntroduction: true }
          }
        }
      },
      match: {
        include: {
          roundLogs: {
            orderBy: [{ roundIndex: 'desc' }, { createdAt: 'desc' }],
            take: 20
          }
        }
      }
    }
  });

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  return NextResponse.json({
    room: {
      ...room,
      participants: room.participants
        .map(toRoomParticipantView)
        .sort((a, b) => a.seatOrder - b.seatOrder)
    }
  });
}
