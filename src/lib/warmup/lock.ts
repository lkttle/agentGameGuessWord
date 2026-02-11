import { prisma } from '@/lib/db';

export interface WarmupLockHandle {
  lockKey: string;
  ownerToken: string;
}

export async function acquireWarmupLock(
  lockKey: string,
  options?: { ttlMs?: number }
): Promise<WarmupLockHandle | null> {
  const ttlMs = Math.max(1000, options?.ttlMs ?? 15000);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  const ownerToken = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

  await prisma.warmupLock.deleteMany({
    where: {
      lockKey,
      expiresAt: { lte: now }
    }
  });

  try {
    await prisma.warmupLock.create({
      data: {
        lockKey,
        ownerToken,
        expiresAt
      }
    });

    return { lockKey, ownerToken };
  } catch {
    return null;
  }
}

export async function releaseWarmupLock(handle: WarmupLockHandle | null): Promise<void> {
  if (!handle) {
    return;
  }

  await prisma.warmupLock.deleteMany({
    where: {
      lockKey: handle.lockKey,
      ownerToken: handle.ownerToken
    }
  });
}
