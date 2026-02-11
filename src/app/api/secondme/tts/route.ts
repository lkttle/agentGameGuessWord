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

export async function POST(request: Request): Promise<Response> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as TTSRequestBody;
  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

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
  }
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { accessToken: true, refreshToken: true, tokenExpiresAt: true }
  });

  if (!user?.accessToken) {
    return NextResponse.json({ error: 'No access token available' }, { status: 400 });
  }

  let accessToken = user.accessToken;

  // Refresh token if expired
  if (user.tokenExpiresAt && user.tokenExpiresAt < new Date() && user.refreshToken) {
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
    } catch {
      // Use existing token as fallback
    }
  }

  try {
    const result = await secondMeSdk.generateTTS(accessToken, {
      text,
      emotion: body.emotion ?? 'happy'
    });

    if (!result.url) {
      return NextResponse.json(
        { error: 'TTS generation succeeded but no audio url returned' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      code: 0,
      data: result
    });
  } catch (error) {
    console.error('TTS generation failed:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'TTS generation failed' },
      { status: 502 }
    );
  }
}
