import { LeaderboardPeriod } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const periodParam = url.searchParams.get('period')?.toLowerCase();
  const limit = Number(url.searchParams.get('limit') ?? '20');

  const period = periodParam === 'daily' ? LeaderboardPeriod.DAILY : LeaderboardPeriod.ALL_TIME;

  const dateKey = period === LeaderboardPeriod.DAILY ? new Date().toISOString().slice(0, 10) : 'ALL_TIME';

  const entries = await prisma.leaderboardEntry.findMany({
    where: {
      period,
      dateKey
    },
    orderBy: [{ score: 'desc' }, { wins: 'desc' }, { updatedAt: 'asc' }],
    take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20,
    include: {
      user: {
        select: {
          id: true,
          secondmeUserId: true,
          name: true,
          avatarUrl: true
        }
      }
    }
  });

  return NextResponse.json({ period, entries });
}
