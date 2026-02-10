import { MetricEventType, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

interface MetricPayload {
  userId?: string;
  roomId?: string;
  matchId?: string;
  payload?: Prisma.InputJsonValue;
}

export async function recordMetricEvent(eventType: MetricEventType, payload?: MetricPayload): Promise<void> {
  await prisma.metricEvent.create({
    data: {
      eventType,
      userId: payload?.userId,
      roomId: payload?.roomId,
      matchId: payload?.matchId,
      payloadJson: payload?.payload
    }
  });
}

export async function getMetricSummary(dateFrom?: Date, dateTo?: Date) {
  const whereClause =
    dateFrom || dateTo
      ? {
          createdAt: {
            gte: dateFrom,
            lte: dateTo
          }
        }
      : undefined;

  const [loginCount, startCount, completeCount] = await Promise.all([
    prisma.metricEvent.count({
      where: {
        eventType: MetricEventType.LOGIN_SUCCESS,
        ...whereClause
      }
    }),
    prisma.metricEvent.count({
      where: {
        eventType: MetricEventType.MATCH_START,
        ...whereClause
      }
    }),
    prisma.metricEvent.count({
      where: {
        eventType: MetricEventType.MATCH_COMPLETE,
        ...whereClause
      }
    })
  ]);

  return {
    loginCount,
    startedMatchCount: startCount,
    completedMatchCount: completeCount,
    completionRate: startCount === 0 ? 0 : completeCount / startCount
  };
}
