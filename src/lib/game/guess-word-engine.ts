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

function calculateScoreDelta(isCorrect: boolean, attemptIndex: number, timedOut: boolean): number {
  if (timedOut || !isCorrect) {
    return 0;
  }
  const bonus = Math.max(5 - Math.max(attemptIndex, 1), 0);
  return 10 + bonus;
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
