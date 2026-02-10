'use client';

import { useEffect, useMemo, useState } from 'react';

interface RoomStateResponse {
  room?: unknown;
  error?: string;
}

export function useRoomStatePolling(roomId: string, intervalMs = 2000) {
  const [data, setData] = useState<RoomStateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    if (!roomId.trim()) {
      return null;
    }
    return `/api/rooms/${roomId.trim()}/state`;
  }, [roomId]);

  useEffect(() => {
    if (!endpoint) {
      setData(null);
      setError(null);
      return;
    }

    let active = true;

    const fetchState = async () => {
      setLoading(true);
      try {
        const response = await fetch(endpoint, { cache: 'no-store' });
        const payload = (await response.json()) as RoomStateResponse;
        if (!active) {
          return;
        }
        if (!response.ok) {
          setError(payload.error ?? 'Failed to load room state');
          return;
        }
        setData(payload);
        setError(null);
      } catch {
        if (active) {
          setError('Network error while polling room state');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchState();
    const timer = setInterval(() => {
      void fetchState();
    }, intervalMs);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [endpoint, intervalMs]);

  return {
    data,
    loading,
    error
  };
}
