import { prisma } from '@/lib/db';

export const GLOBAL_AGENT_STANDBY_SIZE = 8;

export interface StandbyAgent {
  userId: string;
  name: string;
  avatarUrl: string | null;
  selfIntroduction: string | null;
}

function stableRandomize<T>(input: T[]): T[] {
  const list = [...input];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [list[index], list[next]] = [list[next], list[index]];
  }
  return list;
}

export async function ensureGlobalAgentStandbyPool(targetSize = GLOBAL_AGENT_STANDBY_SIZE): Promise<StandbyAgent[]> {
  const existing = await prisma.agentStandbyQueue.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          selfIntroduction: true,
          secondmeUserId: true,
          accessToken: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const validExisting = existing.filter((entry) => entry.user?.secondmeUserId && entry.user?.accessToken);
  const existingIds = new Set(validExisting.map((entry) => entry.userId));

  if (validExisting.length < targetSize) {
    const candidates = await prisma.user.findMany({
      where: {
        secondmeUserId: { not: null },
        accessToken: { not: null },
        id: { notIn: Array.from(existingIds) }
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        selfIntroduction: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(40, targetSize * 5)
    });

    const shuffled = stableRandomize(candidates);
    for (const candidate of shuffled) {
      try {
        await prisma.agentStandbyQueue.create({
          data: {
            userId: candidate.id
          }
        });
      } catch {
        continue;
      }

      const count = await prisma.agentStandbyQueue.count();
      if (count >= targetSize) {
        break;
      }
    }
  }

  const queue = await prisma.agentStandbyQueue.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          selfIntroduction: true,
          secondmeUserId: true,
          accessToken: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const cleaned = queue
    .filter((entry) => entry.user?.secondmeUserId && entry.user?.accessToken)
    .slice(0, targetSize)
    .map((entry) => ({
      userId: entry.userId,
      name: entry.user?.name?.trim() || 'SecondMe 玩家',
      avatarUrl: entry.user?.avatarUrl ?? null,
      selfIntroduction: entry.user?.selfIntroduction ?? null
    }));

  return cleaned;
}

export async function claimStandbyAgents(count: number): Promise<StandbyAgent[]> {
  const targetCount = Math.max(0, Math.floor(count));
  if (targetCount <= 0) {
    return [];
  }

  const pool = await ensureGlobalAgentStandbyPool(Math.max(GLOBAL_AGENT_STANDBY_SIZE, targetCount));
  return pool.slice(0, targetCount);
}
