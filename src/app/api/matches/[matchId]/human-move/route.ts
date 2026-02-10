import { MatchStatus, ParticipantType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';
import { evaluateRound } from '@/lib/game/guess-word-engine';
import {
  FallbackAgentTurnClient,
  runAgentTurnWithRetry
} from '@/lib/agent/orchestrator';

interface HumanMoveBody {
  participantId?: string;
  agentParticipantId?: string;
  targetWord?: string;
  guessWord?: string;
  roundIndex?: number;
}

function isValidGuess(input: string): boolean {
  return /^[a-zA-Z]{2,}$/.test(input);
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
  const guessWord = body.guessWord?.trim().toLowerCase();
  const targetWord = body.targetWord?.trim().toLowerCase();

  if (!guessWord || !targetWord) {
    return NextResponse.json({ error: 'guessWord and targetWord are required' }, { status: 400 });
  }
  if (!isValidGuess(guessWord)) {
    return NextResponse.json({ error: 'Invalid guess format' }, { status: 400 });
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

  let agentTurn: { participantId: string; guessWord: string; usedFallback: boolean } | null = null;
  let agentResult: ReturnType<typeof evaluateRound> | null = null;

  if (!humanResult.isCorrect && body.agentParticipantId) {
    const agentParticipant = match.room.participants.find(
      (participant) =>
        participant.id === body.agentParticipantId && participant.participantType === ParticipantType.AGENT
    );

    if (agentParticipant) {
      const client = new FallbackAgentTurnClient();
      const turn = await runAgentTurnWithRetry(
        agentParticipant.id,
        {
          roundIndex,
          hint: `${targetWord[0]}${'_'.repeat(Math.max(targetWord.length - 1, 0))}`,
          previousGuesses: [guessWord]
        },
        client,
        { timeoutMs: 3000, maxRetries: 2 }
      );

      agentTurn = {
        participantId: agentParticipant.id,
        guessWord: turn.guessWord,
        usedFallback: turn.usedFallback
      };

      agentResult = evaluateRound({
        targetWord,
        guessWord: turn.guessWord,
        attemptIndex: 2
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

    if (agentTurn && agentResult) {
      await tx.roundLog.create({
        data: {
          matchId,
          roundIndex,
          actorType: ParticipantType.AGENT,
          actorId: agentTurn.participantId,
          guessWord: agentTurn.guessWord,
          isCorrect: agentResult.isCorrect,
          scoreDelta: agentResult.scoreDelta,
          timedOut: false
        }
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
    agent: agentTurn
      ? {
          ...agentTurn,
          result: agentResult
        }
      : null
  });
}
