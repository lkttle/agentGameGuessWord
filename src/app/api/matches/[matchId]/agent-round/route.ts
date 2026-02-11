import { ParticipantType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';
import {
  buildInitialLetterHint,
  evaluateAgentGuess,
  extractGuessWord,
  timeoutRoundResult
} from '@/lib/game/guess-word-engine';
import {
  FallbackAgentTurnClient,
  runAgentTurnWithRetry
} from '@/lib/agent/orchestrator';
import { SecondMeAgentTurnClient } from '@/lib/agent/secondme-agent-client';
import { getCachedAgentReply } from '@/lib/agent/warmup-cache';

interface AgentRoundBody {
  targetWord?: string;
  roundIndex?: number;
  pinyinHint?: string;
  categoryHint?: string;
  questionKey?: string;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ matchId: string }> }
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { matchId } = await context.params;
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      room: {
        include: {
          participants: true
        }
      }
    }
  });

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }
  if (match.room.hostUserId !== user.id) {
    return NextResponse.json({ error: 'Only host can trigger agent round' }, { status: 403 });
  }

  const body = (await request.json()) as AgentRoundBody;
  const expectedQuestionKey = body.questionKey?.trim();
  const targetWord = body.targetWord?.trim().toLowerCase();
  if (!targetWord) {
    return NextResponse.json({ error: 'targetWord is required' }, { status: 400 });
  }

  const agents = match.room.participants
    .filter((participant) => participant.participantType === ParticipantType.AGENT)
    .sort((a, b) => a.seatOrder - b.seatOrder);

  if (agents.length < 1) {
    return NextResponse.json({ error: 'At least 1 agent participant required' }, { status: 400 });
  }

  const roundIndex = body.roundIndex ?? match.totalRounds + 1;
  const serverQuestionKey = [
    body.pinyinHint?.trim() ?? '',
    targetWord,
    body.categoryHint?.trim() ?? ''
  ].join('|');

  if (expectedQuestionKey && expectedQuestionKey !== serverQuestionKey) {
    return NextResponse.json({
      roundIndex,
      turns: [],
      skipped: true,
      reason: 'stale_question_key'
    });
  }

  const hint = buildInitialLetterHint(targetWord);
  const expectedLength = body.pinyinHint?.length ?? targetWord.length;

  // Try SecondMe agent client first, fall back to dummy client
  let client;
  try {
    client = new SecondMeAgentTurnClient();
  } catch {
    client = new FallbackAgentTurnClient();
  }

  const rawTurns = [];
  const previousGuesses: string[] = [];

  for (const agent of agents) {
    const questionKey = body.questionKey?.trim() || serverQuestionKey;
    if (agent.userId && questionKey) {
      const cached = await getCachedAgentReply(agent.userId, questionKey);
      if (cached?.replyText) {
        rawTurns.push({
          participantId: agent.id,
          guessWord: cached.replyText,
          usedFallback: false,
          attempts: 1
        });
        continue;
      }
    }

    const turn = await runAgentTurnWithRetry(
      agent.id,
      {
        roundIndex,
        hint,
        pinyinHint: body.pinyinHint ?? undefined,
        categoryHint: body.categoryHint?.trim() || undefined,
        questionKey: body.questionKey?.trim() || undefined,
        previousGuesses: [...previousGuesses]
      },
      client,
      { timeoutMs: 15000, maxRetries: 1 }
    );

    rawTurns.push({ participantId: agent.id, ...turn });
  }

  const turns: Array<{
    participantId: string;
    guessWord: string;
    usedFallback: boolean;
    attempts: number;
    isCorrect: boolean;
    scoreDelta: number;
    normalizedGuess: string;
    normalizedTarget: string;
    timedOut: boolean;
  }> = [];

  for (let index = 0; index < rawTurns.length; index += 1) {
    const turn = rawTurns[index];
    const rawResponse = turn.guessWord?.trim() ?? '';
    const extractedWord = extractGuessWord(rawResponse, expectedLength);
    const result = turn.usedFallback
      ? timeoutRoundResult(targetWord)
      : evaluateAgentGuess({
          targetWord,
          rawResponse,
          extractedWord,
          attemptIndex: index + 1
        });

    turns.push({
      participantId: turn.participantId ?? '',
      guessWord: rawResponse,
      usedFallback: turn.usedFallback,
      attempts: turn.attempts,
      ...result
    });

    previousGuesses.push(extractedWord || rawResponse);
    if (result.isCorrect) {
      break;
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.roundLog.createMany({
      data: turns.map((turn) => ({
        matchId,
        roundIndex,
        actorType: ParticipantType.AGENT,
        actorId: turn.participantId,
        guessWord: turn.guessWord,
        isCorrect: turn.isCorrect,
        scoreDelta: turn.scoreDelta,
        timedOut: turn.timedOut
      }))
    });

    await tx.match.update({
      where: { id: matchId },
      data: { totalRounds: roundIndex }
    });
  });

  return NextResponse.json({
    roundIndex,
    hint,
    turns
  });
}
