import { NextResponse } from 'next/server';
import { prewarmGlobalQueues } from '@/lib/warmup/service';

export async function POST(): Promise<Response> {
  void prewarmGlobalQueues();
  return NextResponse.json({ ok: true });
}
