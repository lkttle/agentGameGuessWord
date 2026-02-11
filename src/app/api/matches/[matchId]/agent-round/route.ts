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
  runAgentTurnsWithRetry
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

  if (agents.length < 1) {
    return NextResponse.json({ error: 'At least 1 agent participant required' }, { status: 400 });
  }

  const roundIndex = body.roundIndex ?? match.totalRounds + 1;
  const hint = buildInitialLetterHint(targetWord);
  const client = new FallbackAgentTurnClient();

  const rawTurns = await runAgentTurnsWithRetry(
    agents.map((agent) => agent.id),
    { roundIndex, hint, previousGuesses: [] },
    client,
    { timeoutMs: 3000, maxRetries: 2 }
  );

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
    const result = turn.usedFallback
      ? timeoutRoundResult(targetWord)
      : evaluateRound({
          targetWord,
          guessWord: turn.guessWord,
          attemptIndex: index + 1
        });

    turns.push({
      participantId: turn.participantId ?? '',
      guessWord: turn.guessWord,
      usedFallback: turn.usedFallback,
      attempts: turn.attempts,
      ...result
    });
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
