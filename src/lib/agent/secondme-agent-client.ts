import { prisma } from '@/lib/db';
import { secondMeSdk } from '@/lib/secondme/sdk';
import type { AgentTurnClient, AgentTurnContext } from './orchestrator';

/**
 * Agent client that uses SecondMe Chat API for generating guesses.
 * Each agent participant is linked to a user with SecondMe credentials.
 */
export class SecondMeAgentTurnClient implements AgentTurnClient {
  private tokenCache = new Map<string, { accessToken: string; expiresAt: Date }>();

  private async getAccessToken(participantId: string): Promise<string | null> {
    // Look up the participant → owner user → get access token
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

    // Check if token is expired and refresh if needed
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
        // If refresh fails, try with existing token
        return user.accessToken;
      }
    }

    return user.accessToken;
  }

  private async getOrCreateSessionId(userId: string): Promise<string | undefined> {
    const session = await prisma.chatSession.findUnique({
      where: { userId_purpose: { userId, purpose: 'game' } }
    });
    return session?.secondmeSessionId;
  }

  private async saveSessionId(userId: string, sessionId: string): Promise<void> {
    await prisma.chatSession.upsert({
      where: { userId_purpose: { userId, purpose: 'game' } },
      update: { secondmeSessionId: sessionId },
      create: { userId, secondmeSessionId: sessionId, purpose: 'game' }
    });
  }

  async generateGuess(agentId: string, context: AgentTurnContext): Promise<string> {
    const accessToken = await this.getAccessToken(agentId);
    if (!accessToken) {
      throw new Error(`No access token for agent participant ${agentId}`);
    }

    // Get participant's owner userId for session management
    const participant = await prisma.participant.findUnique({
      where: { id: agentId },
      select: { userId: true }
    });

    // Build the pinyin initials from pinyinHint (preferred) or hint (fallback)
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
      `拼音首字母提示：${pinyinInitials}。`,
      categoryPrompt,
      previousGuessesPrompt,
      '请先自由地说出你的推理和联想，再给出你最终猜测的中文词语。',
      '最终猜测务必用【答案：xxx】格式单独写在最后一行。'
    ].join('');

    // Get existing session ID for continuity
    let sessionId: string | undefined;
    if (participant?.userId) {
      sessionId = await this.getOrCreateSessionId(participant.userId);
    }

    const result = await secondMeSdk.chatStream(accessToken, {
      message: prompt,
      sessionId,
      requestTimeoutMs: context.timeoutMs
    });

    // Save session ID for future reuse
    if (participant?.userId && result.sessionId) {
      await this.saveSessionId(participant.userId, result.sessionId);
    }

    return result.content.trim();
  }
}
