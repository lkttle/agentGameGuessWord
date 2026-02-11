import { type Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getPinyinQuestionCandidates } from '@/lib/game/pinyin-question-bank';
import type { PinyinQuestion } from '@/lib/game/pinyin-question-types';
import { toValidatedQuestion } from '@/lib/game/pinyin-question-validator';

export interface QuestionQueueItem {
  questionKey: string;
  initialsText: string;
  initials: string[];
  answer: string;
  category: string;
}

export const GLOBAL_WARMUP_QUESTION_QUEUE_SIZE = 5;
export const MATCH_QUESTION_QUEUE_SIZE = 5;

export function buildQuestionKey(question: Pick<PinyinQuestion, 'initialsText' | 'answer' | 'category'>): string {
  return `${question.initialsText}|${question.answer.trim().toLowerCase()}|${question.category.trim()}`;
}

function fromGlobalQuestionRecord(record: {
  questionKey: string;
  initialsText: string;
  initialsJson: Prisma.JsonValue;
  answer: string;
  category: string;
}): QuestionQueueItem {
  const initials = Array.isArray(record.initialsJson)
    ? record.initialsJson.map((value) => String(value))
    : record.initialsText.split('');

  return {
    questionKey: record.questionKey,
    initialsText: record.initialsText,
    initials,
    answer: record.answer,
    category: record.category
  };
}

function randomQuestions(count: number, excludedKeys: Set<string>): PinyinQuestion[] {
  const shuffled = [...getPinyinQuestionCandidates()];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[next]] = [shuffled[next], shuffled[index]];
  }

  const picked: PinyinQuestion[] = [];
  for (const candidate of shuffled) {
    const question = toValidatedQuestion(candidate);
    const key = buildQuestionKey(question);
    if (excludedKeys.has(key)) {
      continue;
    }
    picked.push(question);
    excludedKeys.add(key);
    if (picked.length >= count) {
      break;
    }
  }

  return picked;
}

export async function ensureGlobalQuestionQueue(targetSize = GLOBAL_WARMUP_QUESTION_QUEUE_SIZE): Promise<QuestionQueueItem[]> {
  const existing = await prisma.warmupQuestionQueue.findMany({
    orderBy: { createdAt: 'asc' }
  });

  if (existing.length > targetSize) {
    const overflow = existing.slice(targetSize);
    await prisma.warmupQuestionQueue.deleteMany({
      where: { id: { in: overflow.map((item) => item.id) } }
    });
  }

  if (existing.length < targetSize) {
    const needCount = targetSize - existing.length;
    const existingKeys = new Set(existing.map((item) => item.questionKey));
    const candidates = randomQuestions(Math.max(needCount * 3, needCount), existingKeys);

    for (const question of candidates) {
      const questionKey = buildQuestionKey(question);
      try {
        await prisma.warmupQuestionQueue.create({
          data: {
            questionKey,
            initialsText: question.initialsText,
            initialsJson: question.initials,
            answer: question.answer,
            category: question.category
          }
        });
      } catch {
        continue;
      }

      const freshCount = await prisma.warmupQuestionQueue.count();
      if (freshCount >= targetSize) {
        break;
      }
    }
  }

  const finalRecords = await prisma.warmupQuestionQueue.findMany({
    orderBy: { createdAt: 'asc' },
    take: targetSize
  });

  return finalRecords.map(fromGlobalQuestionRecord);
}

export async function ensureMatchQuestionQueue(matchId: string, targetSize = MATCH_QUESTION_QUEUE_SIZE): Promise<void> {
  const active = await prisma.matchQuestion.count({
    where: { matchId, consumedAt: null }
  });

  if (active > targetSize) {
    const overflow = await prisma.matchQuestion.findMany({
      where: {
        matchId,
        consumedAt: null
      },
      orderBy: { createdAt: 'asc' },
      skip: targetSize,
      select: { id: true }
    });

    if (overflow.length > 0) {
      await prisma.matchQuestion.deleteMany({
        where: {
          id: {
            in: overflow.map((item) => item.id)
          }
        }
      });
    }
    return;
  }

  if (active >= targetSize) {
    return;
  }

  const consumedKeys = await prisma.matchQuestion.findMany({
    where: {
      matchId,
      consumedAt: { not: null }
    },
    select: { questionKey: true }
  });
  const activeKeys = await prisma.matchQuestion.findMany({
    where: {
      matchId,
      consumedAt: null
    },
    select: { questionKey: true }
  });
  const matchExcluded = new Set([
    ...consumedKeys.map((item) => item.questionKey),
    ...activeKeys.map((item) => item.questionKey)
  ]);

  const globalQueue = await ensureGlobalQuestionQueue(targetSize + 2);
  for (const item of globalQueue) {
    if (matchExcluded.has(item.questionKey)) {
      continue;
    }

    try {
      await prisma.matchQuestion.create({
        data: {
          matchId,
          questionKey: item.questionKey,
          initialsText: item.initialsText,
          initialsJson: item.initials,
          answer: item.answer,
          category: item.category
        }
      });
      matchExcluded.add(item.questionKey);
    } catch {
      continue;
    }

    const count = await prisma.matchQuestion.count({ where: { matchId, consumedAt: null } });
    if (count >= targetSize) {
      break;
    }
  }

  const afterRefill = await prisma.matchQuestion.count({
    where: { matchId, consumedAt: null }
  });

  if (afterRefill < targetSize) {
    const fallback = randomQuestions(targetSize - afterRefill + 2, matchExcluded);
    for (const question of fallback) {
      const questionKey = buildQuestionKey(question);
      try {
        await prisma.matchQuestion.create({
          data: {
            matchId,
            questionKey,
            initialsText: question.initialsText,
            initialsJson: question.initials,
            answer: question.answer,
            category: question.category
          }
        });
        matchExcluded.add(questionKey);
      } catch {
        continue;
      }

      const count = await prisma.matchQuestion.count({ where: { matchId, consumedAt: null } });
      if (count >= targetSize) {
        break;
      }
    }
  }
}

export async function consumeNextMatchQuestion(matchId: string): Promise<QuestionQueueItem | null> {
  const next = await prisma.matchQuestion.findFirst({
    where: { matchId, consumedAt: null },
    orderBy: { createdAt: 'asc' }
  });

  if (!next) {
    return null;
  }

  const updated = await prisma.matchQuestion.updateMany({
    where: {
      id: next.id,
      consumedAt: null
    },
    data: {
      consumedAt: new Date()
    }
  });

  if (updated.count === 0) {
    return null;
  }

  return fromGlobalQuestionRecord(next);
}
