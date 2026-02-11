export interface RoundEvaluationInput {
  targetWord: string;
  guessWord: string;
  attemptIndex: number;
  timeoutMs?: number;
}

export interface RoundEvaluationResult {
  isCorrect: boolean;
  scoreDelta: number;
  normalizedGuess: string;
  normalizedTarget: string;
  timedOut: boolean;
}

export interface TimeoutExecutionResult<T> {
  timedOut: boolean;
  value: T;
}

function normalizeWord(value: string): string {
  return value.trim().toLowerCase();
}

export function buildInitialLetterHint(targetWord: string): string {
  const normalized = normalizeWord(targetWord);
  if (!normalized) {
    return '';
  }
  const first = normalized[0];
  return `${first}${'_'.repeat(Math.max(normalized.length - 1, 0))}`;
}

function calculateScoreDelta(isCorrect: boolean, _attemptIndex: number, timedOut: boolean): number {
  if (timedOut || !isCorrect) {
    return 0;
  }
  return 1;
}

export function calculateLeaderboardBonus(
  playerCount: number,
  ranking: number
): number {
  if (ranking < 1 || ranking > 3) return 0;
  if (playerCount === 2) {
    return ranking === 1 ? 1 : 0;
  }
  if (playerCount === 3) {
    if (ranking === 1) return 2;
    if (ranking === 2) return 1;
    return 0;
  }
  if (ranking === 1) return 3;
  if (ranking === 2) return 2;
  if (ranking === 3) return 1;
  return 0;
}

export function evaluateRound(input: RoundEvaluationInput): RoundEvaluationResult {
  const normalizedGuess = normalizeWord(input.guessWord);
  const normalizedTarget = normalizeWord(input.targetWord);
  const isCorrect = normalizedGuess.length > 0 && normalizedGuess === normalizedTarget;

  return {
    isCorrect,
    scoreDelta: calculateScoreDelta(isCorrect, input.attemptIndex, false),
    normalizedGuess,
    normalizedTarget,
    timedOut: false
  };
}

export async function executeWithTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  fallback: () => T
): Promise<TimeoutExecutionResult<T>> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<TimeoutExecutionResult<T>>((resolve) => {
    timer = setTimeout(() => {
      resolve({ timedOut: true, value: fallback() });
    }, timeoutMs);
  });

  const taskPromise = task.then((value) => ({ timedOut: false, value }));
  const result = await Promise.race([taskPromise, timeoutPromise]);

  if (timer) {
    clearTimeout(timer);
  }

  return result;
}

export function timeoutRoundResult(targetWord: string): RoundEvaluationResult {
  const normalizedTarget = normalizeWord(targetWord);
  return {
    isCorrect: false,
    scoreDelta: 0,
    normalizedGuess: '',
    normalizedTarget,
    timedOut: true
  };
}

/**
 * Extract a Chinese word guess from a potentially longer agent response.
 * Agent may respond with sentences like "我猜是朋友" instead of just "朋友".
 */
export function extractGuessWord(response: string, expectedLength: number): string {
  const trimmed = response.trim();
  if (!trimmed) return '';

  // 1. Exact length Chinese characters → return as-is
  const exactMatch = trimmed.match(/^[\u4e00-\u9fff]+$/);
  if (exactMatch && trimmed.length === expectedLength) {
    return trimmed;
  }

  // 2. Extract quoted text: "XX" 「XX」《XX》'XX'
  const quotedPatterns = [
    /[""「]([^""」]+)[""」]/,
    /《([^》]+)》/,
    /['']([^'']+)['']/
  ];
  for (const pattern of quotedPatterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const inner = match[1].trim();
      const chineseOnly = inner.match(/[\u4e00-\u9fff]+/);
      if (chineseOnly) return chineseOnly[0];
    }
  }

  // 3. Find Chinese word segments of expected length
  const lengthRegex = new RegExp(`[\\u4e00-\\u9fff]{${expectedLength}}`, 'g');
  const matches = trimmed.match(lengthRegex);
  if (matches && matches.length > 0) {
    return matches[0];
  }

  // 4. Find any consecutive Chinese characters (2-4)
  const anyChineseMatch = trimmed.match(/[\u4e00-\u9fff]{2,4}/);
  if (anyChineseMatch) {
    return anyChineseMatch[0];
  }

  // 5. Fallback: return trimmed response
  return trimmed;
}

/**
 * Evaluate an agent's guess which may be a full sentence containing the answer.
 * Uses two-layer matching: extracted word exact match + raw response containment.
 */
export function evaluateAgentGuess(input: {
  targetWord: string;
  rawResponse: string;
  extractedWord: string;
  attemptIndex: number;
}): RoundEvaluationResult {
  const normalizedTarget = normalizeWord(input.targetWord);
  const normalizedExtracted = normalizeWord(input.extractedWord);
  const normalizedRaw = normalizeWord(input.rawResponse);

  // Priority 1: extracted word exact match
  if (normalizedExtracted.length > 0 && normalizedExtracted === normalizedTarget) {
    return {
      isCorrect: true,
      scoreDelta: 1,
      normalizedGuess: normalizedExtracted,
      normalizedTarget,
      timedOut: false
    };
  }

  // Priority 2: raw response contains the target word
  if (normalizedRaw.includes(normalizedTarget)) {
    return {
      isCorrect: true,
      scoreDelta: 1,
      normalizedGuess: normalizedExtracted || normalizedRaw,
      normalizedTarget,
      timedOut: false
    };
  }

  return {
    isCorrect: false,
    scoreDelta: 0,
    normalizedGuess: normalizedExtracted || normalizedRaw,
    normalizedTarget,
    timedOut: false
  };
}

export function formatAgentReplyForRoom(
  rawResponse: string,
  extractedWord: string,
  maxLength = 20
): string {
  const normalized = rawResponse.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return extractedWord.trim().slice(0, maxLength);
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const compactAnswer = extractedWord.trim();
  if (compactAnswer) {
    const withPrefix = `答案：${compactAnswer}`;
    if (withPrefix.length <= maxLength) {
      return withPrefix;
    }
    return Array.from(withPrefix).slice(0, maxLength).join('');
  }

  return Array.from(normalized).slice(0, maxLength).join('');
}
