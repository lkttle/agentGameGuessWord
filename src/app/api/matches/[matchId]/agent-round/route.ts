import { MatchStatus, ParticipantType } from '@prisma/client';
import { NextResponse } from 'next/server';
import {
  FallbackAgentTurnClient,
  runAgentTurnWithRetry
} from '@/lib/agent/orchestrator';
import { SecondMeAgentTurnClient } from '@/lib/agent/secondme-agent-client';
import { getCurrentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db';
import {
  buildInitialLetterHint,
  evaluateAgentGuess,
  extractGuessWord,
  timeoutRoundResult
} from '@/lib/game/guess-word-engine';
import {
  buildPinyinQuestionKey,
  parsePinyinQuestionKey
} from '@/lib/game/pinyin-question-bank';

interface AgentRoundBody {
  targetWord?: string;
  roundIndex?: number;
  pinyinHint?: string;
  categoryHint?: string;
  questionKey?: string;
  participantId?: string;
}

function parseRoundIndex(value: unknown, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) {
    throw new Error('roundIndex must be a positive integer');
  }
  return num;
}

function hasQuestionContextMismatch(
  body: AgentRoundBody,
  parsedQuestion: { initialsText: string; answer: string; category: string }
): boolean {
  if (body.targetWord?.trim() && body.targetWord.trim() !== parsedQuestion.answer) {
    return true;
  }

  if (body.pinyinHint?.trim() && body.pinyinHint.trim().toUpperCase() !== parsedQuestion.initialsText) {
    return true;
  }

  if (body.categoryHint?.trim() && body.categoryHint.trim() !== parsedQuestion.category) {
    return true;
  }

  return false;
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
  if (match.status !== MatchStatus.RUNNING) {
    return NextResponse.json({ error: 'Match is not running' }, { status: 409 });
  }
  if (match.room.hostUserId !== user.id) {
    return NextResponse.json({ error: 'Only host can trigger agent round' }, { status: 403 });
  }

  const body = (await request.json()) as AgentRoundBody;
  const participantId = body.participantId?.trim();
  if (!participantId) {
    return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
  }

  const rawQuestionKey = body.questionKey?.trim();
  if (!rawQuestionKey) {
    return NextResponse.json({ error: 'questionKey is required' }, { status: 400 });
  }

  let roundIndex: number;
  try {
    roundIndex = parseRoundIndex(body.roundIndex, match.totalRounds + 1);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid roundIndex' },
      { status: 400 }
    );
  }

  if (roundIndex < match.totalRounds) {
    return NextResponse.json({
      roundIndex,
      turns: [],
      skipped: true,
      reason: 'stale_round_index'
    });
  }

  if (roundIndex > match.totalRounds + 1) {
    return NextResponse.json({ error: 'roundIndex is too far ahead of current match state' }, { status: 409 });
  }

  const agent = match.room.participants.find(
    (participant) => participant.id === participantId && participant.participantType === ParticipantType.AGENT
  );

  if (!agent) {
    return NextResponse.json({ error: 'participantId is not a valid agent in this room' }, { status: 400 });
  }

  const parsedQuestion = parsePinyinQuestionKey(rawQuestionKey);
  if (!parsedQuestion) {
    return NextResponse.json({ error: 'questionKey is invalid' }, { status: 400 });
  }

  const normalizedQuestionKey = buildPinyinQuestionKey(parsedQuestion);
  if (hasQuestionContextMismatch(body, parsedQuestion)) {
    return NextResponse.json({
      roundIndex,
      turns: [],
      skipped: true,
      reason: 'stale_question_key'
    });
  }

  const hint = buildInitialLetterHint(parsedQuestion.answer);
  const expectedLength = parsedQuestion.initialsText.length;

  let client;
  try {
    client = new SecondMeAgentTurnClient();
  } catch {
    client = new FallbackAgentTurnClient();
  }

  const turn = await runAgentTurnWithRetry(
    agent.id,
    {
      roundIndex,
      hint,
      pinyinHint: parsedQuestion.initialsText,
      categoryHint: parsedQuestion.category,
      questionKey: normalizedQuestionKey,
      previousGuesses: []
    },
    client,
    { timeoutMs: 15000, maxRetries: 1 }
  );

  const rawResponse = turn.guessWord?.trim() ?? '';
  const extractedWord = extractGuessWord(rawResponse, expectedLength);
  const result = turn.usedFallback
    ? timeoutRoundResult(parsedQuestion.answer)
    : evaluateAgentGuess({
        targetWord: parsedQuestion.answer,
        rawResponse,
        extractedWord,
        attemptIndex: 1
      });

  await prisma.$transaction(async (tx) => {
    await tx.roundLog.create({
      data: {
        matchId,
        roundIndex,
        actorType: ParticipantType.AGENT,
        actorId: turn.participantId ?? agent.id,
        guessWord: rawResponse,
        isCorrect: result.isCorrect,
        scoreDelta: result.scoreDelta,
        timedOut: result.timedOut
      }
    });

    await tx.match.update({
      where: { id: matchId },
      data: { totalRounds: roundIndex }
    });
  });

  return NextResponse.json({
    roundIndex,
    questionKey: normalizedQuestionKey,
    hint,
    turns: [
      {
        participantId: turn.participantId ?? agent.id,
        guessWord: rawResponse,
        usedFallback: turn.usedFallback,
        attempts: turn.attempts,
        ...result
      }
    ]
  });
}
