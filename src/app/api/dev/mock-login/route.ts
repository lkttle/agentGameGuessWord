import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, clearSession } from '@/lib/auth/session';

interface MockLoginBody {
  secondmeUserId?: string;
  name?: string;
  email?: string;
}

function ensureDevOnly(): Response | null {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  const guard = ensureDevOnly();
  if (guard) {
    return guard;
  }

  const body = (await request.json()) as MockLoginBody;
  const secondmeUserId = body.secondmeUserId?.trim();

  if (!secondmeUserId) {
    return NextResponse.json({ error: 'secondmeUserId is required' }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { secondmeUserId },
    update: {
      name: body.name ?? undefined,
      email: body.email ?? undefined
    },
    create: {
      secondmeUserId,
      name: body.name ?? secondmeUserId,
      email: body.email ?? null
    }
  });

  await createSession(user.id, secondmeUserId);
  return NextResponse.json({ ok: true, user });
}

export async function DELETE(): Promise<Response> {
  const guard = ensureDevOnly();
  if (guard) {
    return guard;
  }

  await clearSession();
  return NextResponse.json({ ok: true });
}
