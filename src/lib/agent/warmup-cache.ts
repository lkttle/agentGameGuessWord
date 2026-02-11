import { WarmupCacheStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { secondMeSdk } from '@/lib/secondme/sdk';
import { runAgentTurnWithRetry } from '@/lib/agent/orchestrator';
import { evaluateAgentGuess, extractGuessWord, timeoutRoundResult } from '@/lib/game/guess-word-engine';
import { buildQuestionKey, type QuestionQueueItem } from '@/lib/game/question-queue';

interface WarmupRecord {
  questionKey: string;
  replyText: string;
  status: WarmupCacheStatus;
  ttsUrl: string | null;
  ttsFormat: string | null;
  ttsDurationMs: number | null;
}

interface WarmupContext {
  roundIndex: number;
  hint: string;
  pinyinHint: string;
  categoryHint: string;
  questionKey: string;
  previousGuesses: string[];
  timeoutMs: number;
}

class UserScopedSecondMeClient {
  async generateGuess(userId: string, context: WarmupContext): Promise<string> {
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
      throw new Error('missing_user_token');
    }

    let accessToken = user.accessToken;
    if (user.tokenExpiresAt && user.tokenExpiresAt < new Date() && user.refreshToken) {
      try {
        const refreshed = await secondMeSdk.refreshAccessToken(user.refreshToken);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000)
          }
        });
        accessToken = refreshed.accessToken;
      } catch {
        accessToken = user.accessToken;
      }
    }

    const categoryPrompt = context.categoryHint ? `词语类别提示：${context.categoryHint}。` : '';
    const previousGuessesPrompt = context.previousGuesses.length > 0
      ? `已猜过（尽量避免重复）：${context.previousGuesses.join('、')}。`
      : '';

    const prompt = [
      '你正在参加中文猜词游戏。',
      `拼音首字母提示：${context.pinyinHint}。`,
      categoryPrompt,
      previousGuessesPrompt,
      '回答限制在20字以内，但保持自然口语化。',
      '请直接输出你的猜测，不要解释规则。'
    ].join('');

    const result = await secondMeSdk.chatStream(accessToken, {
      message: prompt,
      requestTimeoutMs: context.timeoutMs
    });

    return result.content.trim();
  }
}

const warmupClient = new UserScopedSecondMeClient();

export function buildQuestionCacheKey(question: Pick<QuestionQueueItem, 'initialsText' | 'answer' | 'category'>): string {
  return buildQuestionKey(question);
}

function buildInitialLetterHint(answer: string): string {
  if (!answer) return '';
  return `${answer[0]}${'_'.repeat(Math.max(0, answer.length - 1))}`;
}

async function ensureWarmupRecord(userId: string, question: QuestionQueueItem): Promise<void> {
  const existing = await prisma.agentWarmupCache.findUnique({
    where: {
      userId_questionKey: {
        userId,
        questionKey: question.questionKey
      }
    }
  });

  if (existing?.status === WarmupCacheStatus.READY) {
    return;
  }

  await prisma.agentWarmupCache.upsert({
    where: {
      userId_questionKey: {
        userId,
        questionKey: question.questionKey
      }
    },
    create: {
      userId,
      questionKey: question.questionKey,
      replyText: '',
      status: WarmupCacheStatus.PENDING
    },
    update: {
      status: WarmupCacheStatus.PENDING,
      errorMessage: null
    }
  });

  const turn = await runAgentTurnWithRetry(
    userId,
    {
      roundIndex: 1,
      hint: buildInitialLetterHint(question.answer),
      pinyinHint: question.initialsText,
      categoryHint: question.category,
      questionKey: question.questionKey,
      previousGuesses: [],
      timeoutMs: 10000
    },
    warmupClient,
    {
      timeoutMs: 12000,
      maxRetries: 1,
      fallbackGuess: ''
    }
  );

  const rawResponse = turn.guessWord?.trim() ?? '';
  const extractedWord = extractGuessWord(rawResponse, question.initials.length);
  const fallbackResult = timeoutRoundResult(question.answer);
  void (turn.usedFallback
    ? fallbackResult
    : evaluateAgentGuess({
        targetWord: question.answer,
        rawResponse,
        extractedWord,
        attemptIndex: 1
      }));

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        accessToken: true,
        refreshToken: true,
        tokenExpiresAt: true
      }
    });

    let accessToken = user?.accessToken ?? null;
    if (user?.tokenExpiresAt && user.tokenExpiresAt < new Date() && user.refreshToken) {
      try {
        const refreshed = await secondMeSdk.refreshAccessToken(user.refreshToken);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000)
          }
        });
        accessToken = refreshed.accessToken;
      } catch {
        accessToken = user.accessToken;
      }
    }

    if (!accessToken) {
      throw new Error('missing_access_token');
    }

    const tts = await secondMeSdk.generateTTS(accessToken, {
      text: rawResponse || question.answer,
      emotion: 'happy'
    });

    await prisma.agentWarmupCache.update({
      where: {
        userId_questionKey: {
          userId,
          questionKey: question.questionKey
        }
      },
      data: {
        replyText: rawResponse,
        status: WarmupCacheStatus.READY,
        ttsUrl: tts.url || null,
        ttsFormat: tts.format ?? null,
        ttsDurationMs: tts.durationMs ?? null,
        errorMessage: null
      }
    });
  } catch (error) {
    await prisma.agentWarmupCache.update({
      where: {
        userId_questionKey: {
          userId,
          questionKey: question.questionKey
        }
      },
      data: {
        replyText: rawResponse,
        status: rawResponse ? WarmupCacheStatus.READY : WarmupCacheStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    });
  }
}

export async function warmupAgentQuestions(userIds: string[], questions: QuestionQueueItem[]): Promise<void> {
  const uniqueUsers = Array.from(new Set(userIds.filter(Boolean)));
  const uniqueQuestions = Array.from(new Map(questions.map((item) => [item.questionKey, item])).values());

  for (const userId of uniqueUsers) {
    for (const question of uniqueQuestions) {
      await ensureWarmupRecord(userId, question);
    }
  }
}

export async function getCachedAgentReply(userId: string, questionKey: string): Promise<WarmupRecord | null> {
  const record = await prisma.agentWarmupCache.findUnique({
    where: {
      userId_questionKey: {
        userId,
        questionKey
      }
    },
    select: {
      questionKey: true,
      replyText: true,
      status: true,
      ttsUrl: true,
      ttsFormat: true,
      ttsDurationMs: true
    }
  });

  if (!record || record.status !== WarmupCacheStatus.READY || !record.replyText) {
    return null;
  }

  return record;
}

export async function getQuestionItemByKey(questionKey: string): Promise<QuestionQueueItem | null> {
  const record = await prisma.warmupQuestionQueue.findUnique({
    where: { questionKey },
    select: {
      questionKey: true,
      initialsText: true,
      initialsJson: true,
      answer: true,
      category: true
    }
  });

  if (!record) {
    return null;
  }

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
