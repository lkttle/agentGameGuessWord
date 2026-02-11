import { MatchStatus, ParticipantType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';
import {
  evaluateRound,
  evaluateAgentGuess,
  extractGuessWord,
  timeoutRoundResult
} from '@/lib/game/guess-word-engine';
import {
  FallbackAgentTurnClient,
  runAgentTurnsWithRetry
} from '@/lib/agent/orchestrator';
import { SecondMeAgentTurnClient } from '@/lib/agent/secondme-agent-client';

interface HumanMoveBody {
  participantId?: string;
  agentParticipantId?: string;
  autoAgentResponse?: boolean;
  targetWord?: string;
  guessWord?: string;
  roundIndex?: number;
  pinyinHint?: string;
  categoryHint?: string;
}

function isValidGuess(input: string): boolean {
  return /^[\u4e00-\u9fff]{2,4}$/.test(input);
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
  const guessWord = body.guessWord?.trim();
  const targetWord = body.targetWord?.trim();

  if (!guessWord || !targetWord) {
    return NextResponse.json({ error: 'guessWord and targetWord are required' }, { status: 400 });
  }
  if (!isValidGuess(targetWord)) {
    return NextResponse.json({ error: 'targetWord must be a 2-4 Chinese word' }, { status: 400 });
  }
  if (!isValidGuess(guessWord)) {
    return NextResponse.json({ error: 'guessWord must be a 2-4 Chinese word' }, { status: 400 });
  }

  const humanParticipant = match.room.participants.find(
    (participant) =>
      participant.id === body.participantId &&
      participant.userId === user.id &&
      participant.participantType === ParticipantType.HUMAN
  );

  if (!humanParticipant) {
    return NextResponse.json({ error: 'Invalid human participant or out-of-turn action' }, { status: 403 });
  }

  const roundIndex = body.roundIndex ?? match.totalRounds + 1;
  const humanResult = evaluateRound({ targetWord, guessWord, attemptIndex: 1 });
  const expectedLength = body.pinyinHint?.length ?? targetWord.length;

  const agentTurns: Array<{
    participantId: string;
    guessWord: string;
    usedFallback: boolean;
    result: ReturnType<typeof evaluateRound>;
  }> = [];

  if (!humanResult.isCorrect && (body.agentParticipantId || body.autoAgentResponse !== false)) {
    const agentParticipants = match.room.participants
      .filter((participant) => participant.participantType === ParticipantType.AGENT)
      .sort((left, right) => left.seatOrder - right.seatOrder);

    const selectedAgent = body.agentParticipantId
      ? agentParticipants.filter((participant) => participant.id === body.agentParticipantId)
      : agentParticipants;

    // Try SecondMe agent client first, fall back to dummy client
    let client;
    try {
      client = new SecondMeAgentTurnClient();
    } catch {
      client = new FallbackAgentTurnClient();
    }
    const previousGuesses = [guessWord];
    const rawTurns = await runAgentTurnsWithRetry(
      selectedAgent.map((participant) => participant.id),
      {
        roundIndex,
        hint: `${targetWord[0]}${'_'.repeat(Math.max(targetWord.length - 1, 0))}`,
        pinyinHint: body.pinyinHint ?? undefined,
        categoryHint: body.categoryHint?.trim() || undefined,
        previousGuesses: [...previousGuesses]
      },
      client,
      { timeoutMs: 15000, maxRetries: 1 }
    );

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
            attemptIndex: index + 2
          });

      agentTurns.push({
        participantId: turn.participantId ?? '',
        guessWord: rawResponse,
        usedFallback: turn.usedFallback,
        result
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.roundLog.create({
      data: {
        matchId,
        roundIndex,
        actorType: ParticipantType.HUMAN,
        actorId: humanParticipant.id,
        guessWord,
        isCorrect: humanResult.isCorrect,
        scoreDelta: humanResult.scoreDelta,
        timedOut: false
      }
    });

    if (agentTurns.length > 0) {
      await tx.roundLog.createMany({
        data: agentTurns.map((agentTurn) => ({
          matchId,
          roundIndex,
          actorType: ParticipantType.AGENT,
          actorId: agentTurn.participantId,
          guessWord: agentTurn.guessWord,
          isCorrect: agentTurn.result.isCorrect,
          scoreDelta: agentTurn.result.scoreDelta,
          timedOut: false
        }))
      });
    }

    await tx.match.update({
      where: { id: matchId },
      data: { totalRounds: roundIndex }
    });
  });

  return NextResponse.json({
    roundIndex,
    human: {
      participantId: humanParticipant.id,
      guessWord,
      result: humanResult
    },
    agents: agentTurns
  });
}
