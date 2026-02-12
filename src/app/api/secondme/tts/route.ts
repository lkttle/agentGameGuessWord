import { AgentQuestionCacheStatus } from '@prisma/client';
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

const MAX_PROXY_AUDIO_BYTES = 8 * 1024 * 1024;

function ttsProxyAudioEnabled(): boolean {
  return process.env.SECONDME_TTS_PROXY_AUDIO !== '0';
}

function inferAudioMimeType(contentType: string | null, format?: string): string {
  if (typeof contentType === 'string') {
    const normalized = contentType.trim().toLowerCase();
    if (normalized.startsWith('audio/')) {
      return normalized.split(';')[0];
    }
  }

  if (format?.toLowerCase() === 'wav') return 'audio/wav';
  if (format?.toLowerCase() === 'ogg') return 'audio/ogg';
  return 'audio/mpeg';
}

async function fetchAudioAsDataUrl(
  requestId: string,
  audioUrl: string,
  format?: string
): Promise<{ dataUrl: string; mimeType: string; byteLength: number } | null> {
  const response = await fetch(audioUrl, {
    method: 'GET',
    headers: {
      Accept: 'audio/*,*/*;q=0.8'
    },
    cache: 'no-store'
  });

  const contentType = response.headers.get('content-type');
  const contentLength = response.headers.get('content-length');

  ttsServerLog(requestId, 'proxy_audio_fetch_response', {
    status: response.status,
    contentType: contentType ?? null,
    contentLength: contentLength ?? null
  });

  if (!response.ok) {
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  const byteLength = arrayBuffer.byteLength;

  if (byteLength <= 0) {
    ttsServerLog(requestId, 'proxy_audio_empty');
    return null;
  }

  if (byteLength > MAX_PROXY_AUDIO_BYTES) {
    ttsServerLog(requestId, 'proxy_audio_too_large', {
      byteLength,
      maxBytes: MAX_PROXY_AUDIO_BYTES
    });
    return null;
  }

  const mimeType = inferAudioMimeType(contentType, format);
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return {
    dataUrl: `data:${mimeType};base64,${base64}`,
    mimeType,
    byteLength
  };
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

function isCacheTableMissingError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2021'
  );
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

  let cachedAudio: {
    id: string;
    audioDataUrl: string | null;
    sourceAudioUrl: string | null;
    ttsDurationMs: number | null;
    ttsFormat: string | null;
  } | null = null;

  try {
    cachedAudio = await prisma.agentQuestionCache.findFirst({
      where: {
        userId: targetUserId,
        answerText: text,
        status: AgentQuestionCacheStatus.READY
      },
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        audioDataUrl: true,
        sourceAudioUrl: true,
        ttsDurationMs: true,
        ttsFormat: true
      }
    });
  } catch (error) {
    if (!isCacheTableMissingError(error)) {
      throw error;
    }

    ttsServerLog(requestId, 'cache_table_missing_skip_cache_lookup', {
      targetUserId
    });
    cachedAudio = null;
  }

  if (cachedAudio?.audioDataUrl) {
    ttsServerLog(requestId, 'cache_audio_hit_data_url', {
      targetUserId,
      cacheId: cachedAudio.id
    });

    const response = NextResponse.json({
      code: 0,
      data: {
        url: cachedAudio.audioDataUrl,
        sourceUrl: cachedAudio.sourceAudioUrl,
        proxied: true,
        durationMs: cachedAudio.ttsDurationMs ?? 0,
        format: cachedAudio.ttsFormat ?? 'mp3',
        cached: true
      },
      requestId
    });
    response.headers.set('x-tts-request-id', requestId);
    return response;
  }

  if (cachedAudio?.sourceAudioUrl) {
    ttsServerLog(requestId, 'cache_audio_hit_source_url', {
      targetUserId,
      cacheId: cachedAudio.id
    });

    let cachedUrlToPlay = cachedAudio.sourceAudioUrl;
    let proxied = false;
    let mimeType: string | null = null;
    let byteLength: number | null = null;

    if (ttsProxyAudioEnabled()) {
      try {
        const proxiedAudio = await fetchAudioAsDataUrl(requestId, cachedAudio.sourceAudioUrl, cachedAudio.ttsFormat ?? undefined);
        if (proxiedAudio) {
          cachedUrlToPlay = proxiedAudio.dataUrl;
          proxied = true;
          mimeType = proxiedAudio.mimeType;
          byteLength = proxiedAudio.byteLength;

          try {
            await prisma.agentQuestionCache.update({
              where: { id: cachedAudio.id },
              data: {
                audioDataUrl: proxiedAudio.dataUrl
              }
            });
          } catch (updateError) {
            if (!isCacheTableMissingError(updateError)) {
              throw updateError;
            }
            ttsServerLog(requestId, 'cache_table_missing_skip_cache_update', {
              targetUserId,
              cacheId: cachedAudio.id
            });
          }
        }
      } catch (error) {
        ttsServerLog(requestId, 'cache_audio_proxy_failed', {
          targetUserId,
          cacheId: cachedAudio.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const response = NextResponse.json({
      code: 0,
      data: {
        url: cachedUrlToPlay,
        sourceUrl: cachedAudio.sourceAudioUrl,
        proxied,
        mimeType,
        byteLength,
        durationMs: cachedAudio.ttsDurationMs ?? 0,
        format: cachedAudio.ttsFormat ?? 'mp3',
        cached: true
      },
      requestId
    });
    response.headers.set('x-tts-request-id', requestId);
    return response;
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

    let finalResult: Record<string, unknown> = result;

    if (ttsProxyAudioEnabled()) {
      let audioHost: string | null = null;
      try {
        audioHost = new URL(result.url).host;
      } catch {
        audioHost = null;
      }

      ttsServerLog(requestId, 'proxy_audio_fetch_start', {
        targetUserId,
        audioHost
      });

      try {
        const proxiedAudio = await fetchAudioAsDataUrl(requestId, result.url, result.format);
        if (proxiedAudio) {
          finalResult = {
            ...result,
            url: proxiedAudio.dataUrl,
            sourceUrl: result.url,
            proxied: true,
            mimeType: proxiedAudio.mimeType,
            byteLength: proxiedAudio.byteLength
          };

          ttsServerLog(requestId, 'proxy_audio_fetch_success', {
            targetUserId,
            mimeType: proxiedAudio.mimeType,
            byteLength: proxiedAudio.byteLength
          });
        } else {
          ttsServerLog(requestId, 'proxy_audio_fetch_fallback_original_url', {
            targetUserId
          });
        }
      } catch (error) {
        ttsServerLog(requestId, 'proxy_audio_fetch_failed', {
          targetUserId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } else {
      ttsServerLog(requestId, 'proxy_audio_disabled');
    }

    const response = NextResponse.json({
      code: 0,
      data: finalResult,
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
