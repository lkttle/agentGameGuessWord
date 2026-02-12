import { prisma } from '@/lib/db';
import { secondMeSdk } from '@/lib/secondme/sdk';
import type { AgentTurnClient, AgentTurnContext } from './orchestrator';
import {
  getOrCreateCachedAgentResponseByParticipant,
  resolveQuestionFromContext
} from './question-cache';

/**
 * Agent client that uses SecondMe Chat API for generating guesses.
 * Each agent participant is linked to a user with SecondMe credentials.
 */
export class SecondMeAgentTurnClient implements AgentTurnClient {

  private async getAccessToken(participantId: string): Promise<string | null> {
    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      include: {
        user: {
          select: {
            id: true,
            accessToken: true,
            refreshToken: true,
            tokenExpiresAt: true
          }
        }
      }
    });

    if (!participant?.user?.accessToken) {
      return null;
    }

    const user = participant.user;

    if (user.tokenExpiresAt && user.tokenExpiresAt < new Date() && user.refreshToken) {
      try {
        const newToken = await secondMeSdk.refreshAccessToken(user.refreshToken);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            accessToken: newToken.accessToken,
            refreshToken: newToken.refreshToken,
            tokenExpiresAt: new Date(Date.now() + newToken.expiresIn * 1000)
          }
        });
        return newToken.accessToken;
      } catch {
        return user.accessToken;
      }
    }

    return user.accessToken;
  }

  async generateGuess(agentId: string, context: AgentTurnContext): Promise<string> {
    const question = resolveQuestionFromContext({
      questionKey: context.questionKey,
      pinyinHint: context.pinyinHint,
      categoryHint: context.categoryHint
    });

    if (question) {
      try {
        const cached = await getOrCreateCachedAgentResponseByParticipant({
          participantId: agentId,
          question
        });

        if (cached?.answerText?.trim()) {
          return cached.answerText.trim();
        }
      } catch {
        // fallback to live request below
      }
    }

    const accessToken = await this.getAccessToken(agentId);
    if (!accessToken) {
      throw new Error(`No access token for agent participant ${agentId}`);
    }

    const pinyinInitials = context.pinyinHint
      ? context.pinyinHint.toUpperCase()
      : context.hint.replace(/_/g, '').toUpperCase();

    const categoryHint = context.categoryHint?.trim();
    const recentGuesses = context.previousGuesses
      .map((word) => word.trim())
      .filter((word) => word.length > 0)
      .slice(-6);

    const categoryPrompt = categoryHint ? `词语类别提示：${categoryHint}。\n` : '';
    const previousGuessesPrompt = recentGuesses.length > 0
      ? `已猜过（尽量不要重复）：${recentGuesses.join('、')}。\n`
      : '';

    const prompt = [
      '你正在参加中文猜词游戏。',
      '每次看到新的拼音提示时，请忽略历史题目，只根据本轮提示作答。',
      `拼音首字母提示：${pinyinInitials}。`,
      categoryPrompt,
      previousGuessesPrompt,
      '请直接给出你的猜测，可以自然一点，但尽量控制在20字以内。',
      '不要输出太长内容。'
    ].join('');

    const result = await secondMeSdk.chatStream(accessToken, {
      message: prompt,
      requestTimeoutMs: context.timeoutMs
    });

    return result.content.trim();
  }
}
