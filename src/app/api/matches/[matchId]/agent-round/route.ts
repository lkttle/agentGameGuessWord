import { ParticipantType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';
import {
  buildInitialLetterHint,
  evaluateRound,
  timeoutRoundResult
} from '@/lib/game/guess-word-engine';
import {
  FallbackAgentTurnClient,
  runAgentTurnWithRetry
} from '@/lib/agent/orchestrator';

interface AgentRoundBody {
  targetWord?: string;
  roundIndex?: number;
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
  const targetWord = body.targetWord?.trim().toLowerCase();
  if (!targetWord) {
    return NextResponse.json({ error: 'targetWord is required' }, { status: 400 });
  }

  const agents = match.room.participants
    .filter((participant) => participant.participantType === ParticipantType.AGENT)
    .sort((a, b) => a.seatOrder - b.seatOrder);

  if (agents.length < 2) {
    return NextResponse.json({ error: 'At least 2 agent participants required' }, { status: 400 });
  }

  const roundIndex = body.roundIndex ?? match.totalRounds + 1;
  const hint = buildInitialLetterHint(targetWord);
  const client = new FallbackAgentTurnClient();

  const firstTurn = await runAgentTurnWithRetry(
    agents[0].id,
    { roundIndex, hint, previousGuesses: [] },
    client,
    { timeoutMs: 3000, maxRetries: 2 }
  );

  const firstResult = firstTurn.usedFallback
    ? timeoutRoundResult(targetWord)
    : evaluateRound({
        targetWord,
        guessWord: firstTurn.guessWord,
        attemptIndex: 1
      });

  const secondTurn = await runAgentTurnWithRetry(
    agents[1].id,
    { roundIndex, hint, previousGuesses: [firstTurn.guessWord] },
    client,
    { timeoutMs: 3000, maxRetries: 2 }
  );

  const secondResult = secondTurn.usedFallback
    ? timeoutRoundResult(targetWord)
    : evaluateRound({
        targetWord,
        guessWord: secondTurn.guessWord,
        attemptIndex: 2
      });

  await prisma.$transaction(async (tx) => {
    await tx.roundLog.createMany({
      data: [
        {
          matchId,
          roundIndex,
          actorType: ParticipantType.AGENT,
          actorId: agents[0].id,
          guessWord: firstTurn.guessWord,
          isCorrect: firstResult.isCorrect,
          scoreDelta: firstResult.scoreDelta,
          timedOut: firstResult.timedOut
        },
        {
          matchId,
          roundIndex,
          actorType: ParticipantType.AGENT,
          actorId: agents[1].id,
          guessWord: secondTurn.guessWord,
          isCorrect: secondResult.isCorrect,
          scoreDelta: secondResult.scoreDelta,
          timedOut: secondResult.timedOut
        }
      ]
    });

    await tx.match.update({
      where: { id: matchId },
      data: { totalRounds: roundIndex }
    });
  });

  return NextResponse.json({
    roundIndex,
    hint,
    turns: [
      { participantId: agents[0].id, ...firstTurn, ...firstResult },
      { participantId: agents[1].id, ...secondTurn, ...secondResult }
    ]
  });
}
