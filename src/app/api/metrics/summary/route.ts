import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getMetricSummary } from '@/lib/metrics/service';

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
  return NextResponse.json(summary);
}
