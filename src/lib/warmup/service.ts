import { prisma } from '@/lib/db';
import {
  claimStandbyAgents,
  ensureGlobalAgentStandbyPool,
  GLOBAL_AGENT_STANDBY_SIZE
} from '@/lib/agent/standby-pool';
import {
  ensureGlobalQuestionQueue,
  ensureMatchQuestionQueue,
  consumeNextMatchQuestion,
  GLOBAL_WARMUP_QUESTION_QUEUE_SIZE,
  MATCH_QUESTION_QUEUE_SIZE,
  type QuestionQueueItem
} from '@/lib/game/question-queue';
import { warmupAgentQuestions } from '@/lib/agent/warmup-cache';
import { acquireWarmupLock, releaseWarmupLock } from '@/lib/warmup/lock';

async function runWithLock<T>(lockKey: string, runner: () => Promise<T>): Promise<T | null> {
  const lock = await acquireWarmupLock(lockKey, { ttlMs: 15000 });
  if (!lock) {
    return null;
  }

  try {
    return await runner();
  } finally {
    await releaseWarmupLock(lock);
  }
}

export async function prewarmGlobalQueues(): Promise<void> {
  await runWithLock('global_warmup', async () => {
    const agents = await ensureGlobalAgentStandbyPool(GLOBAL_AGENT_STANDBY_SIZE);
    const questions = await ensureGlobalQuestionQueue(GLOBAL_WARMUP_QUESTION_QUEUE_SIZE);
    await warmupAgentQuestions(
      agents.map((item) => item.userId),
      questions
    );

    return true;
  });
}

export async function ensureMatchPrepared(matchId: string): Promise<void> {
  await runWithLock(`match_prepare:${matchId}`, async () => {
    await ensureMatchQuestionQueue(matchId, MATCH_QUESTION_QUEUE_SIZE);
    const agents = await prisma.participant.findMany({
      where: {
        room: {
          match: {
            id: matchId
          }
        },
        participantType: 'AGENT',
        userId: { not: null }
      },
      select: { userId: true }
    });

    const questions = await prisma.matchQuestion.findMany({
      where: {
        matchId,
        consumedAt: null
      },
      orderBy: { createdAt: 'asc' },
      take: MATCH_QUESTION_QUEUE_SIZE,
      select: {
        questionKey: true,
        initialsText: true,
        initialsJson: true,
        answer: true,
        category: true
      }
    });

    const questionItems: QuestionQueueItem[] = questions.map((item) => ({
      questionKey: item.questionKey,
      initialsText: item.initialsText,
      initials: Array.isArray(item.initialsJson)
        ? item.initialsJson.map((value) => String(value))
        : item.initialsText.split(''),
      answer: item.answer,
      category: item.category
    }));

    const userIds = agents.map((item) => item.userId).filter((value): value is string => Boolean(value));
    await warmupAgentQuestions(userIds, questionItems);

    return true;
  });
}

export async function consumeMatchQuestion(matchId: string): Promise<QuestionQueueItem | null> {
  const consumed = await runWithLock(`match_consume_question:${matchId}`, async () => {
    await ensureMatchQuestionQueue(matchId, MATCH_QUESTION_QUEUE_SIZE);
    const next = await consumeNextMatchQuestion(matchId);

    if (!next) {
      return null;
    }

    await ensureMatchQuestionQueue(matchId, MATCH_QUESTION_QUEUE_SIZE);

    const standbyAgents = await ensureGlobalAgentStandbyPool(GLOBAL_AGENT_STANDBY_SIZE);
    const roomAgents = await prisma.participant.findMany({
      where: {
        room: { match: { id: matchId } },
        participantType: 'AGENT',
        userId: { not: null }
      },
      select: { userId: true }
    });

    const userIds = Array.from(new Set([
      ...standbyAgents.map((item) => item.userId),
      ...roomAgents.map((item) => item.userId).filter((value): value is string => Boolean(value))
    ]));

    const activeQuestions = await prisma.matchQuestion.findMany({
      where: {
        matchId,
        consumedAt: null
      },
      orderBy: { createdAt: 'asc' },
      take: MATCH_QUESTION_QUEUE_SIZE,
      select: {
        questionKey: true,
        initialsText: true,
        initialsJson: true,
        answer: true,
        category: true
      }
    });

    const activeItems: QuestionQueueItem[] = activeQuestions.map((item) => ({
      questionKey: item.questionKey,
      initialsText: item.initialsText,
      initials: Array.isArray(item.initialsJson)
        ? item.initialsJson.map((value) => String(value))
        : item.initialsText.split(''),
      answer: item.answer,
      category: item.category
    }));

    await warmupAgentQuestions(userIds, activeItems);
    return next;
  });

  if (consumed) {
    return consumed;
  }

  const existing = await prisma.matchQuestion.findFirst({
    where: { matchId, consumedAt: null },
    orderBy: { createdAt: 'asc' },
    select: {
      questionKey: true,
      initialsText: true,
      initialsJson: true,
      answer: true,
      category: true
    }
  });

  if (!existing) {
    return null;
  }

  return {
    questionKey: existing.questionKey,
    initialsText: existing.initialsText,
    initials: Array.isArray(existing.initialsJson)
      ? existing.initialsJson.map((value) => String(value))
      : existing.initialsText.split(''),
    answer: existing.answer,
    category: existing.category
  };
}

export async function pickStandbyAgentsForRoom(count: number): Promise<Array<{
  userId: string;
  name: string;
  avatarUrl: string | null;
  selfIntroduction: string | null;
}>> {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount <= 0) {
    return [];
  }

  const picked = await runWithLock('claim_standby_agents', async () => {
    const selected = await claimStandbyAgents(safeCount);
    const selectedIds = selected.map((item) => item.userId);
    if (selectedIds.length > 0) {
      await prisma.agentStandbyQueue.deleteMany({
        where: { userId: { in: selectedIds } }
      });
    }
    return selected;
  });

  const result = picked ?? [];

  void prewarmGlobalQueues();
  return result;
}
