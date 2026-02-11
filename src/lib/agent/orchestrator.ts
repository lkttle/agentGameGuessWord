import { executeWithTimeout } from '@/lib/game/guess-word-engine';

export interface AgentTurnContext {
  roundIndex: number;
  hint: string;
  pinyinHint?: string;
  previousGuesses: string[];
  instruction?: string;
  timeoutMs?: number;
}

export interface AgentTurnResult {
  participantId?: string;
  guessWord: string;
  usedFallback: boolean;
  attempts: number;
}

export interface AgentTurnClient {
  generateGuess(agentId: string, context: AgentTurnContext): Promise<string>;
}

export class FallbackAgentTurnClient implements AgentTurnClient {
  async generateGuess(_agentId: string, _context: AgentTurnContext): Promise<string> {
    return '';
  }
}

function normalizeGuess(raw: string): string {
  return raw.trim();
}

export async function runAgentTurnWithRetry(
  agentId: string,
  context: AgentTurnContext,
  client: AgentTurnClient,
  options?: {
    timeoutMs?: number;
    maxRetries?: number;
    fallbackGuess?: string;
  }
): Promise<AgentTurnResult> {
  const timeoutMs = options?.timeoutMs ?? 4000;
  const maxRetries = options?.maxRetries ?? 2;
  const fallbackGuess = options?.fallbackGuess ?? '';

  let attempts = 0;
  while (attempts <= maxRetries) {
    attempts += 1;
    try {
      const execution = await executeWithTimeout(
        client.generateGuess(agentId, {
          ...context,
          timeoutMs
        }),
        timeoutMs,
        () => fallbackGuess
      );

      if (execution.timedOut) {
        return {
          guessWord: normalizeGuess(execution.value),
          usedFallback: true,
          attempts
        };
      }

      return {
        guessWord: normalizeGuess(execution.value),
        usedFallback: false,
        attempts
      };
    } catch {
      if (attempts > maxRetries) {
        return {
          guessWord: normalizeGuess(fallbackGuess),
          usedFallback: true,
          attempts
        };
      }
    }
  }

  return {
    guessWord: normalizeGuess(fallbackGuess),
    usedFallback: true,
    attempts
  };
}

export async function runAgentTurnsWithRetry(
  participantIds: string[],
  context: AgentTurnContext,
  client: AgentTurnClient,
  options?: {
    timeoutMs?: number;
    maxRetries?: number;
    fallbackGuess?: string;
  }
): Promise<AgentTurnResult[]> {
  const turns = await Promise.all(
    participantIds.map(async (participantId) => {
      const turn = await runAgentTurnWithRetry(
        participantId,
        {
          ...context,
          previousGuesses: [...context.previousGuesses]
        },
        client,
        options
      );

      return {
        participantId,
        ...turn
      };
    })
  );

  return turns;
}
