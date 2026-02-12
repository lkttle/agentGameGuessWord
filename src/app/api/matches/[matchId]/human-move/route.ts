import { MatchStatus, ParticipantType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db';
import { evaluateRound, timeoutRoundResult } from '@/lib/game/guess-word-engine';
import {
  buildPinyinQuestionKey,
  parsePinyinQuestionKey
} from '@/lib/game/pinyin-question-bank';

interface HumanMoveBody {
  participantId?: string;
  targetWord?: string;
  guessWord?: string;
  roundIndex?: number;
  pinyinHint?: string;
  categoryHint?: string;
  questionKey?: string;
  timedOut?: boolean;
}

function isValidGuess(input: string): boolean {
  return /^[\u4e00-\u9fff]{2,4}$/.test(input);
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
  body: HumanMoveBody,
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

  const body = (await request.json()) as HumanMoveBody;
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
      skipped: true,
      reason: 'stale_round_index'
    });
  }

  if (roundIndex > match.totalRounds + 1) {
    return NextResponse.json({ error: 'roundIndex is too far ahead of current match state' }, { status: 409 });
  }

  const humanParticipant = match.room.participants.find(
    (participant) =>
      participant.id === participantId &&
      participant.userId === user.id &&
      participant.participantType === ParticipantType.HUMAN
  );

  if (!humanParticipant) {
    return NextResponse.json({ error: 'Invalid human participant or out-of-turn action' }, { status: 403 });
  }

  const parsedQuestion = parsePinyinQuestionKey(rawQuestionKey);
  if (!parsedQuestion) {
    return NextResponse.json({ error: 'questionKey is invalid' }, { status: 400 });
  }

  const normalizedQuestionKey = buildPinyinQuestionKey(parsedQuestion);
  if (hasQuestionContextMismatch(body, parsedQuestion)) {
    return NextResponse.json({
      roundIndex,
      human: {
        participantId: humanParticipant.id,
        guessWord: '',
        result: timeoutRoundResult(parsedQuestion.answer)
      },
      agents: [],
      skipped: true,
      reason: 'stale_question_key'
    });
  }

  const timedOut = body.timedOut === true;
  const guessWord = body.guessWord?.trim() ?? '';

  if (!timedOut) {
    if (!guessWord) {
      return NextResponse.json({ error: 'guessWord is required' }, { status: 400 });
    }
    if (!isValidGuess(guessWord)) {
      return NextResponse.json({ error: 'guessWord must be a 2-4 Chinese word' }, { status: 400 });
    }
  }

  const humanResult = timedOut
    ? timeoutRoundResult(parsedQuestion.answer)
    : evaluateRound({ targetWord: parsedQuestion.answer, guessWord, attemptIndex: 1 });

  await prisma.$transaction(async (tx) => {
    await tx.roundLog.create({
      data: {
        matchId,
        roundIndex,
        actorType: ParticipantType.HUMAN,
        actorId: humanParticipant.id,
        guessWord: timedOut ? null : guessWord,
        isCorrect: humanResult.isCorrect,
        scoreDelta: humanResult.scoreDelta,
        timedOut: humanResult.timedOut
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
    human: {
      participantId: humanParticipant.id,
      guessWord: timedOut ? '' : guessWord,
      result: humanResult
    },
    agents: []
  });
}
