import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';
import { secondMeSdk } from '@/lib/secondme/sdk';

interface TTSRequestBody {
  text?: string;
  emotion?: string;
  userId?: string;
  participantId?: string;
}

function ttsDebugEnabled(): boolean {
  return process.env.SECONDME_TTS_DEBUG === '1' || process.env.NEXT_PUBLIC_TTS_DEBUG === '1';
}

function ttsServerLog(requestId: string, event: string, payload?: Record<string, unknown>): void {
  if (!ttsDebugEnabled()) return;
  if (payload) {
    console.info(`[tts][api][${requestId}] ${event}`, payload);
    return;
  }
  console.info(`[tts][api][${requestId}] ${event}`);
}

export async function POST(request: Request): Promise<Response> {
  const requestId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`).slice(0, 8);
  const startAt = Date.now();

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    ttsServerLog(requestId, 'unauthorized');
    return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 });
  }

  const body = (await request.json()) as TTSRequestBody;
  const text = body.text?.trim();
  if (!text) {
    ttsServerLog(requestId, 'invalid_text', { currentUserId: currentUser.id });
    return NextResponse.json({ error: 'text is required', requestId }, { status: 400 });
  }

  ttsServerLog(requestId, 'request_received', {
    currentUserId: currentUser.id,
    participantId: body.participantId ?? null,
    requestedUserId: body.userId ?? null,
    textLength: text.length,
    textPreview: text.slice(0, 40)
  });

  // Prefer participant owner token (agent voice), then explicit userId, then current user
  let targetUserId = body.userId || currentUser.id;

  if (body.participantId) {
    const participant = await prisma.participant.findUnique({
      where: { id: body.participantId },
      select: { userId: true }
    });

    if (participant?.userId) {
      targetUserId = participant.userId;
    }

    ttsServerLog(requestId, 'participant_resolved', {
      participantId: body.participantId,
      participantUserId: participant?.userId ?? null,
      targetUserId
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { accessToken: true, refreshToken: true, tokenExpiresAt: true }
  });

  if (!user?.accessToken) {
    ttsServerLog(requestId, 'missing_access_token', {
      targetUserId,
      hasRefreshToken: Boolean(user?.refreshToken)
    });
    return NextResponse.json({ error: 'No access token available', requestId }, { status: 400 });
  }

  let accessToken = user.accessToken;

  // Refresh token if expired
  if (user.tokenExpiresAt && user.tokenExpiresAt < new Date() && user.refreshToken) {
    ttsServerLog(requestId, 'refresh_token_start', {
      targetUserId,
      expiresAt: user.tokenExpiresAt.toISOString()
    });

    try {
      const newToken = await secondMeSdk.refreshAccessToken(user.refreshToken);
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          accessToken: newToken.accessToken,
          refreshToken: newToken.refreshToken,
          tokenExpiresAt: new Date(Date.now() + newToken.expiresIn * 1000)
        }
      });
      accessToken = newToken.accessToken;
      ttsServerLog(requestId, 'refresh_token_success', {
        targetUserId,
        expiresIn: newToken.expiresIn
      });
    } catch {
      // Use existing token as fallback
      ttsServerLog(requestId, 'refresh_token_failed_use_old', { targetUserId });
    }
  }

  try {
    ttsServerLog(requestId, 'generate_tts_start', {
      targetUserId,
      emotion: body.emotion ?? 'happy'
    });

    const result = await secondMeSdk.generateTTS(accessToken, {
      text,
      emotion: body.emotion ?? 'happy'
    });

    if (!result.url) {
      ttsServerLog(requestId, 'generate_tts_no_url', {
        targetUserId,
        durationMs: result.durationMs
      });
      return NextResponse.json(
        { error: 'TTS generation succeeded but no audio url returned', requestId },
        { status: 502 }
      );
    }

    ttsServerLog(requestId, 'generate_tts_success', {
      targetUserId,
      durationMs: result.durationMs,
      format: result.format ?? null,
      elapsedMs: Date.now() - startAt
    });

    const response = NextResponse.json({
      code: 0,
      data: result,
      requestId
    });
    response.headers.set('x-tts-request-id', requestId);
    return response;
  } catch (error) {
    ttsServerLog(requestId, 'generate_tts_failed', {
      targetUserId,
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - startAt
    });
    return NextResponse.json(
      {
        error: 'TTS generation failed',
        requestId,
        detail: error instanceof Error ? error.message : String(error)
      },
      { status: 502 }
    );
  }
}
