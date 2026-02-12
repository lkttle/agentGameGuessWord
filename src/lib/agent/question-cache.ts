import { AgentQuestionCacheStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { secondMeSdk } from '@/lib/secondme/sdk';
import {
  buildPinyinQuestionKey,
  getAllPinyinQuestions,
  parsePinyinQuestionKey
} from '@/lib/game/pinyin-question-bank';
import type { PinyinQuestion } from '@/lib/game/pinyin-question-types';
import { evaluateAgentGuess, extractGuessWord } from '@/lib/game/guess-word-engine';

const MAX_PROXY_AUDIO_BYTES = 8 * 1024 * 1024;
const DEFAULT_PREWARM_CONCURRENCY = 4;
const DEFAULT_PREWARM_RETRIES = 2;
const DEFAULT_PREWARM_BACKOFF_MS = 250;

interface CacheQuestion {
  initialsText: string;
  answer: string;
  category: string;
}

interface CachedAgentResponse {
  answerText: string;
  normalizedGuess: string | null;
  audioDataUrl: string | null;
  sourceAudioUrl: string | null;
  ttsDurationMs: number | null;
  ttsFormat: string | null;
}

export interface PrewarmStats {
  scannedPairs: number;
  generated: number;
  hits: number;
  failed: number;
  elapsedMs: number;
}

interface PrewarmOptions {
  targetUserId?: string;
  maxPairs?: number;
  timeBudgetMs?: number;
  reason?: string;
  concurrency?: number;
  maxRetries?: number;
}

interface LastPrewarmRecord {
  reason: string;
  stats: PrewarmStats;
  finishedAt: string;
  scope: 'global' | 'user';
  userId?: string;
}

export interface PrewarmRuntimeSnapshot {
  isGlobalRunning: boolean;
  runningUserCount: number;
  inFlightPairCount: number;
  lastGlobalPrewarm: LastPrewarmRecord | null;
  lastUserPrewarm: LastPrewarmRecord[];
}

function cacheDebugEnabled(): boolean {
  return process.env.SECONDME_AGENT_CACHE_DEBUG === '1';
}

function cacheLog(event: string, payload?: Record<string, unknown>): void {
  if (!cacheDebugEnabled()) return;
  if (payload) {
    console.info(`[agent-cache] ${event}`, payload);
    return;
  }
  console.info(`[agent-cache] ${event}`);
}

function ttsProxyAudioEnabled(): boolean {
  return process.env.SECONDME_TTS_PROXY_AUDIO !== '0';
}

function parsePositiveInt(raw: unknown, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parsePositiveOrUndefined(raw: unknown): number | undefined {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function inferAudioMimeType(contentType: string | null, format?: string): string {
  if (typeof contentType === 'string') {
    const normalized = contentType.trim().toLowerCase();
    if (normalized.startsWith('audio/')) {
      return normalized.split(';')[0];
    }
  }

  if (format?.toLowerCase() === 'wav') return 'audio/wav';
  if (format?.toLowerCase() === 'ogg') return 'audio/ogg';
  return 'audio/mpeg';
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAudioAsDataUrl(
  audioUrl: string,
  format?: string
): Promise<{ dataUrl: string; sourceAudioUrl: string } | null> {
  const response = await fetch(audioUrl, {
    method: 'GET',
    headers: {
      Accept: 'audio/*,*/*;q=0.8'
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength <= 0 || arrayBuffer.byteLength > MAX_PROXY_AUDIO_BYTES) {
    return null;
  }

  const mimeType = inferAudioMimeType(response.headers.get('content-type'), format);
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return {
    dataUrl: `data:${mimeType};base64,${base64}`,
    sourceAudioUrl: audioUrl
  };
}

function buildPrompt(question: CacheQuestion): string {
  return [
    '你正在参加中文猜词游戏。',
    '每次看到新的拼音提示时，请忽略历史题目，只根据本轮提示作答。',
    `拼音首字母提示：${question.initialsText.toUpperCase()}。`,
    `词语类别提示：${question.category}。`,
    '请直接给出你的猜测，可以自然一点，但尽量控制在20字以内。',
    '不要输出太长内容。'
  ].join('');
}

function ensureQuestion(input: CacheQuestion): CacheQuestion {
  return {
    initialsText: input.initialsText.trim().toUpperCase(),
    answer: input.answer.trim(),
    category: input.category.trim() || '未知分类'
  };
}

function toQuestionFromParsed(question: PinyinQuestion): CacheQuestion {
  return ensureQuestion(question);
}

function getGlobalLocks(): {
  inFlightPairs: Set<string>;
  runningGlobalPrewarm: Promise<PrewarmStats> | null;
  userPrewarmMap: Map<string, Promise<PrewarmStats>>;
  lastGlobalPrewarm: LastPrewarmRecord | null;
  lastUserPrewarmByUserId: Map<string, LastPrewarmRecord>;
} {
  const globalRef = globalThis as typeof globalThis & {
    __agentCacheLocks?: {
      inFlightPairs: Set<string>;
      runningGlobalPrewarm: Promise<PrewarmStats> | null;
      userPrewarmMap: Map<string, Promise<PrewarmStats>>;
      lastGlobalPrewarm: LastPrewarmRecord | null;
      lastUserPrewarmByUserId: Map<string, LastPrewarmRecord>;
    };
  };

  if (!globalRef.__agentCacheLocks) {
    globalRef.__agentCacheLocks = {
      inFlightPairs: new Set<string>(),
      runningGlobalPrewarm: null,
      userPrewarmMap: new Map<string, Promise<PrewarmStats>>(),
      lastGlobalPrewarm: null,
      lastUserPrewarmByUserId: new Map<string, LastPrewarmRecord>()
    };
  }

  return globalRef.__agentCacheLocks;
}

function recordGlobalPrewarmResult(reason: string, stats: PrewarmStats): void {
  const locks = getGlobalLocks();
  locks.lastGlobalPrewarm = {
    reason,
    stats,
    finishedAt: new Date().toISOString(),
    scope: 'global'
  };
}

function recordUserPrewarmResult(userId: string, reason: string, stats: PrewarmStats): void {
  const locks = getGlobalLocks();
  locks.lastUserPrewarmByUserId.set(userId, {
    reason,
    stats,
    finishedAt: new Date().toISOString(),
    scope: 'user',
    userId
  });
}

export function getPrewarmRuntimeSnapshot(): PrewarmRuntimeSnapshot {
  const locks = getGlobalLocks();

  return {
    isGlobalRunning: Boolean(locks.runningGlobalPrewarm),
    runningUserCount: locks.userPrewarmMap.size,
    inFlightPairCount: locks.inFlightPairs.size,
    lastGlobalPrewarm: locks.lastGlobalPrewarm,
    lastUserPrewarm: Array.from(locks.lastUserPrewarmByUserId.values())
      .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))
      .slice(0, 20)
  };
}

function buildPairKey(userId: string, question: CacheQuestion): string {
  return `${userId}|${buildPinyinQuestionKey(question)}`;
}

async function getAccessTokenForUser(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      accessToken: true,
      refreshToken: true,
      tokenExpiresAt: true
    }
  });

  if (!user?.accessToken) {
    return null;
  }

  if (user.tokenExpiresAt && user.tokenExpiresAt < new Date() && user.refreshToken) {
    try {
      const refreshed = await secondMeSdk.refreshAccessToken(user.refreshToken);
      await prisma.user.update({
        where: { id: userId },
        data: {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000)
        }
      });
      return refreshed.accessToken;
    } catch {
      return user.accessToken;
    }
  }

  return user.accessToken;
}

async function readReadyCache(userId: string, question: CacheQuestion): Promise<CachedAgentResponse | null> {
  const cache = await prisma.agentQuestionCache.findUnique({
    where: {
      userId_questionKey: {
        userId,
        questionKey: buildPinyinQuestionKey(question)
      }
    },
    select: {
      status: true,
      answerText: true,
      normalizedGuess: true,
      audioDataUrl: true,
      sourceAudioUrl: true,
      ttsDurationMs: true,
      ttsFormat: true
    }
  });

  if (!cache || cache.status !== AgentQuestionCacheStatus.READY || !cache.answerText.trim()) {
    return null;
  }

  return {
    answerText: cache.answerText,
    normalizedGuess: cache.normalizedGuess,
    audioDataUrl: cache.audioDataUrl,
    sourceAudioUrl: cache.sourceAudioUrl,
    ttsDurationMs: cache.ttsDurationMs,
    ttsFormat: cache.ttsFormat
  };
}

async function writeFailedCache(userId: string, question: CacheQuestion, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.agentQuestionCache.upsert({
    where: {
      userId_questionKey: {
        userId,
        questionKey: buildPinyinQuestionKey(question)
      }
    },
    create: {
      userId,
      questionKey: buildPinyinQuestionKey(question),
      initialsText: question.initialsText,
      answer: question.answer,
      category: question.category,
      answerText: '',
      status: AgentQuestionCacheStatus.FAILED,
      lastError: message
    },
    update: {
      status: AgentQuestionCacheStatus.FAILED,
      lastError: message
    }
  });
}

async function generateAndPersistCache(userId: string, question: CacheQuestion): Promise<CachedAgentResponse> {
  const accessToken = await getAccessTokenForUser(userId);
  if (!accessToken) {
    throw new Error(`no_access_token_for_user:${userId}`);
  }

  const prompt = buildPrompt(question);
  const chat = await secondMeSdk.chatStream(accessToken, {
    message: prompt,
    requestTimeoutMs: 20_000
  });

  const answerText = chat.content.trim();
  if (!answerText) {
    throw new Error('empty_agent_answer');
  }

  const extractedWord = extractGuessWord(answerText, question.answer.length);
  const evaluation = evaluateAgentGuess({
    targetWord: question.answer,
    rawResponse: answerText,
    extractedWord,
    attemptIndex: 1
  });

  const ttsResult = await secondMeSdk.generateTTS(accessToken, {
    text: answerText,
    emotion: 'happy'
  });

  let audioDataUrl: string | null = null;
  let sourceAudioUrl: string | null = ttsResult.url || null;

  if (ttsResult.url && ttsProxyAudioEnabled()) {
    const audioPayload = await fetchAudioAsDataUrl(ttsResult.url, ttsResult.format);
    if (audioPayload) {
      audioDataUrl = audioPayload.dataUrl;
      sourceAudioUrl = audioPayload.sourceAudioUrl;
    }
  }

  await prisma.agentQuestionCache.upsert({
    where: {
      userId_questionKey: {
        userId,
        questionKey: buildPinyinQuestionKey(question)
      }
    },
    create: {
      userId,
      questionKey: buildPinyinQuestionKey(question),
      initialsText: question.initialsText,
      answer: question.answer,
      category: question.category,
      answerText,
      normalizedGuess: evaluation.normalizedGuess,
      audioDataUrl,
      sourceAudioUrl,
      ttsDurationMs: ttsResult.durationMs || null,
      ttsFormat: ttsResult.format ?? null,
      status: AgentQuestionCacheStatus.READY,
      lastError: null,
      generatedAt: new Date()
    },
    update: {
      answerText,
      normalizedGuess: evaluation.normalizedGuess,
      audioDataUrl,
      sourceAudioUrl,
      ttsDurationMs: ttsResult.durationMs || null,
      ttsFormat: ttsResult.format ?? null,
      status: AgentQuestionCacheStatus.READY,
      lastError: null,
      generatedAt: new Date()
    }
  });

  return {
    answerText,
    normalizedGuess: evaluation.normalizedGuess,
    audioDataUrl,
    sourceAudioUrl,
    ttsDurationMs: ttsResult.durationMs || null,
    ttsFormat: ttsResult.format ?? null
  };
}

async function waitForCacheFromOtherWorker(
  userId: string,
  question: CacheQuestion
): Promise<CachedAgentResponse | null> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await sleep(200);
    const cache = await readReadyCache(userId, question);
    if (cache) {
      return cache;
    }
  }
  return null;
}

export function resolveQuestionFromContext(input: {
  questionKey?: string;
  targetWord?: string;
  pinyinHint?: string;
  categoryHint?: string;
}): CacheQuestion | null {
  const parsed = parsePinyinQuestionKey(input.questionKey);
  if (parsed) {
    return toQuestionFromParsed(parsed);
  }

  const answer = input.targetWord?.trim();
  const initialsText = input.pinyinHint?.trim().toUpperCase();
  if (!answer || !initialsText) {
    return null;
  }

  return ensureQuestion({
    answer,
    initialsText,
    category: input.categoryHint?.trim() || '未知分类'
  });
}

export async function getOrCreateCachedAgentResponseByUser(input: {
  userId: string;
  question: CacheQuestion;
}): Promise<CachedAgentResponse | null> {
  const question = ensureQuestion(input.question);
  const cache = await readReadyCache(input.userId, question);
  if (cache) {
    return cache;
  }

  const locks = getGlobalLocks();
  const pairKey = buildPairKey(input.userId, question);

  if (locks.inFlightPairs.has(pairKey)) {
    const waited = await waitForCacheFromOtherWorker(input.userId, question);
    if (waited) {
      return waited;
    }
  }

  locks.inFlightPairs.add(pairKey);
  try {
    return await generateAndPersistCache(input.userId, question);
  } catch (error) {
    await writeFailedCache(input.userId, question, error);
    throw error;
  } finally {
    locks.inFlightPairs.delete(pairKey);
  }
}

export async function getOrCreateCachedAgentResponseByParticipant(input: {
  participantId: string;
  question: CacheQuestion;
}): Promise<CachedAgentResponse | null> {
  const participant = await prisma.participant.findUnique({
    where: { id: input.participantId },
    select: { userId: true }
  });

  if (!participant?.userId) {
    return null;
  }

  return getOrCreateCachedAgentResponseByUser({
    userId: participant.userId,
    question: input.question
  });
}

function prioritizeUsers<T extends { createdAt: Date }>(users: T[]): T[] {
  const sorted = [...users].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const pivot = Math.max(1, Math.ceil(sorted.length * 0.4));
  const newer = sorted.slice(0, pivot);
  const older = sorted.slice(pivot);

  const shuffle = <U,>(items: U[]): U[] => {
    const cloned = [...items];
    for (let index = cloned.length - 1; index > 0; index -= 1) {
      const nextIndex = Math.floor(Math.random() * (index + 1));
      [cloned[index], cloned[nextIndex]] = [cloned[nextIndex], cloned[index]];
    }
    return cloned;
  };

  return [...shuffle(newer), ...shuffle(older)];
}

async function findEligibleUsers(userId?: string): Promise<Array<{ id: string; createdAt: Date }>> {
  return prisma.user.findMany({
    where: {
      secondmeUserId: { not: null },
      accessToken: { not: null },
      ...(userId ? { id: userId } : {})
    },
    select: {
      id: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
}

function getConfiguredConcurrency(input?: number): number {
  return parsePositiveInt(
    input ?? process.env.SECONDME_PREWARM_CONCURRENCY,
    DEFAULT_PREWARM_CONCURRENCY
  );
}

function getConfiguredRetries(input?: number): number {
  return parsePositiveInt(
    input ?? process.env.SECONDME_PREWARM_RETRIES,
    DEFAULT_PREWARM_RETRIES
  );
}

function getConfiguredMaxPairs(input?: number): number | undefined {
  const envValue = process.env.SECONDME_PREWARM_BATCH_SIZE;
  return parsePositiveOrUndefined(input ?? envValue);
}

function getConfiguredTimeBudgetMs(input?: number): number | undefined {
  const envValue = process.env.SECONDME_PREWARM_BUDGET_MS;
  return parsePositiveOrUndefined(input ?? envValue);
}

export async function prewarmQuestionCache(input?: PrewarmOptions): Promise<PrewarmStats> {
  const startedAt = Date.now();
  const maxPairs = getConfiguredMaxPairs(input?.maxPairs);
  const timeBudgetMs = getConfiguredTimeBudgetMs(input?.timeBudgetMs);
  const maxRetries = getConfiguredRetries(input?.maxRetries);
  const concurrency = getConfiguredConcurrency(input?.concurrency);

  const allQuestions = getAllPinyinQuestions();
  const users = prioritizeUsers(await findEligibleUsers(input?.targetUserId));

  if (users.length === 0 || allQuestions.length === 0) {
    return {
      scannedPairs: 0,
      generated: 0,
      hits: 0,
      failed: 0,
      elapsedMs: Date.now() - startedAt
    };
  }

  const userIds = users.map((user) => user.id);
  const readyCaches = await prisma.agentQuestionCache.findMany({
    where: {
      userId: { in: userIds },
      status: AgentQuestionCacheStatus.READY
    },
    select: {
      userId: true,
      questionKey: true
    }
  });

  const readySet = new Set(readyCaches.map((item) => `${item.userId}|${item.questionKey}`));

  const shuffledQuestions = [...allQuestions];
  for (let index = shuffledQuestions.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [shuffledQuestions[index], shuffledQuestions[nextIndex]] = [shuffledQuestions[nextIndex], shuffledQuestions[index]];
  }

  const pairs: Array<{ userId: string; question: CacheQuestion }> = [];

  for (const user of users) {
    for (const question of shuffledQuestions) {
      const key = `${user.id}|${buildPinyinQuestionKey(question)}`;
      if (readySet.has(key)) {
        continue;
      }
      pairs.push({ userId: user.id, question: ensureQuestion(question) });
      if (maxPairs && pairs.length >= maxPairs) {
        break;
      }
    }
    if (maxPairs && pairs.length >= maxPairs) {
      break;
    }
  }

  let generated = 0;
  let hits = 0;
  let failed = 0;
  let cursor = 0;
  let shouldStop = false;

  async function processPairWithRetry(pair: { userId: string; question: CacheQuestion }): Promise<void> {
    const questionKey = buildPinyinQuestionKey(pair.question);
    const cached = await readReadyCache(pair.userId, pair.question);
    if (cached) {
      hits += 1;
      return;
    }

    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const result = await getOrCreateCachedAgentResponseByUser({
          userId: pair.userId,
          question: pair.question
        });

        if (!result?.answerText?.trim()) {
          throw new Error('empty_cache_result');
        }

        generated += 1;
        return;
      } catch (error) {
        if (attempt >= maxRetries) {
          failed += 1;
          cacheLog('prewarm_pair_failed', {
            reason: input?.reason ?? 'manual',
            userId: pair.userId,
            questionKey,
            attempt,
            maxRetries,
            error: error instanceof Error ? error.message : String(error)
          });
          return;
        }

        await sleep(DEFAULT_PREWARM_BACKOFF_MS * (attempt + 1));
      }
      attempt += 1;
    }
  }

  async function worker(workerId: number): Promise<void> {
    while (!shouldStop) {
      if (timeBudgetMs && Date.now() - startedAt > timeBudgetMs) {
        shouldStop = true;
        return;
      }

      const index = cursor;
      cursor += 1;
      if (index >= pairs.length) {
        return;
      }

      const pair = pairs[index];
      await processPairWithRetry(pair);
    }

    cacheLog('prewarm_worker_stop', {
      workerId,
      reason: 'budget_exceeded_or_stopped'
    });
  }

  const workerCount = Math.max(1, Math.min(concurrency, pairs.length || 1));
  await Promise.all(Array.from({ length: workerCount }, (_, index) => worker(index + 1)));

  const stats: PrewarmStats = {
    scannedPairs: pairs.length,
    generated,
    hits,
    failed,
    elapsedMs: Date.now() - startedAt
  };

  cacheLog('prewarm_batch_done', {
    ...stats,
    reason: input?.reason ?? 'manual',
    concurrency,
    maxRetries,
    maxPairs: maxPairs ?? 'all',
    timeBudgetMs: timeBudgetMs ?? 'unlimited'
  });

  return stats;
}

export async function getAgentCacheProgressStats(): Promise<{
  eligibleAgentCount: number;
  questionCount: number;
  totalExpectedPairs: number;
  readyPairCount: number;
  failedPairCount: number;
  pendingPairCount: number;
  coverageRate: number;
  throughputPerSecond: number | null;
  estimatedSecondsRemaining: number | null;
  runtime: PrewarmRuntimeSnapshot;
}> {
  const runtime = getPrewarmRuntimeSnapshot();
  const questionCount = getAllPinyinQuestions().length;

  const eligibleFilter = {
    secondmeUserId: { not: null as string | null },
    accessToken: { not: null as string | null }
  };

  const [eligibleAgentCount, readyPairCount, failedPairCount] = await Promise.all([
    prisma.user.count({ where: eligibleFilter }),
    prisma.agentQuestionCache.count({
      where: {
        status: AgentQuestionCacheStatus.READY,
        user: eligibleFilter
      }
    }),
    prisma.agentQuestionCache.count({
      where: {
        status: AgentQuestionCacheStatus.FAILED,
        user: eligibleFilter
      }
    })
  ]);

  const totalExpectedPairs = eligibleAgentCount * questionCount;
  const pendingPairCount = Math.max(totalExpectedPairs - readyPairCount, 0);
  const coverageRate = totalExpectedPairs > 0 ? readyPairCount / totalExpectedPairs : 1;

  const lastStats = runtime.lastGlobalPrewarm?.stats;
  const throughputPerSecond =
    lastStats && lastStats.elapsedMs > 0
      ? Number((lastStats.generated / (lastStats.elapsedMs / 1000)).toFixed(3))
      : null;

  const estimatedSecondsRemaining =
    throughputPerSecond && throughputPerSecond > 0
      ? Math.ceil(pendingPairCount / throughputPerSecond)
      : null;

  return {
    eligibleAgentCount,
    questionCount,
    totalExpectedPairs,
    readyPairCount,
    failedPairCount,
    pendingPairCount,
    coverageRate,
    throughputPerSecond,
    estimatedSecondsRemaining,
    runtime
  };
}

export function triggerGlobalPrewarm(reason: string): boolean {
  const locks = getGlobalLocks();
  if (locks.runningGlobalPrewarm) {
    return false;
  }

  locks.runningGlobalPrewarm = prewarmQuestionCache({ reason })
    .then((stats) => {
      recordGlobalPrewarmResult(reason, stats);
      return stats;
    })
    .catch((error) => {
      cacheLog('global_prewarm_failed', {
        reason,
        error: error instanceof Error ? error.message : String(error)
      });
      const fallback = {
        scannedPairs: 0,
        generated: 0,
        hits: 0,
        failed: 1,
        elapsedMs: 0
      } satisfies PrewarmStats;
      recordGlobalPrewarmResult(reason, fallback);
      return fallback;
    })
    .finally(() => {
      locks.runningGlobalPrewarm = null;
    });

  return true;
}

export function triggerUserPrewarm(userId: string, reason: string): boolean {
  const locks = getGlobalLocks();
  if (locks.userPrewarmMap.has(userId)) {
    return false;
  }

  const task = prewarmQuestionCache({
    targetUserId: userId,
    reason
  })
    .then((stats) => {
      recordUserPrewarmResult(userId, reason, stats);
      return stats;
    })
    .catch((error) => {
      cacheLog('user_prewarm_failed', {
        userId,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });
      const fallback = {
        scannedPairs: 0,
        generated: 0,
        hits: 0,
        failed: 1,
        elapsedMs: 0
      } satisfies PrewarmStats;
      recordUserPrewarmResult(userId, reason, fallback);
      return fallback;
    })
    .finally(() => {
      locks.userPrewarmMap.delete(userId);
    });

  locks.userPrewarmMap.set(userId, task);
  return true;
}
