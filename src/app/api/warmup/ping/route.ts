import { NextResponse } from 'next/server';
import { prewarmGlobalQueues } from '@/lib/warmup/service';

export async function POST(): Promise<Response> {
  void prewarmGlobalQueues().catch((error) => {
    console.warn('[warmup:ping] prewarm skipped', {
      error: error instanceof Error ? error.message : String(error)
    });
  });
  return NextResponse.json({ ok: true });
}
