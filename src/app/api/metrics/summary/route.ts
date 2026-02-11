import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getMetricSummary } from '@/lib/metrics/service';
import { prisma } from '@/lib/db';

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const dateFrom = from ? new Date(from) : undefined;
  const dateTo = to ? new Date(to) : undefined;

  const summary = await getMetricSummary(dateFrom, dateTo);

  const modeDistribution = await getModeDistribution(dateFrom, dateTo);
  return NextResponse.json({
    ...summary,
    modeDistribution
  });
}

async function getModeDistribution(dateFrom?: Date, dateTo?: Date) {
  const whereClause = {
    eventType: 'MATCH_START' as const,
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            gte: dateFrom,
            lte: dateTo
          }
        }
      : {})
  };

  const events = await prisma.metricEvent.findMany({
    where: whereClause,
    select: { payloadJson: true }
  });

  const result: Record<string, number> = {};
  for (const event of events) {
    const payload = event.payloadJson;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      continue;
    }
    const mode = 'mode' in payload ? String((payload as { mode?: unknown }).mode) : 'UNKNOWN';
    result[mode] = (result[mode] ?? 0) + 1;
  }

  return result;
}
