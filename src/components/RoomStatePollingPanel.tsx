'use client';

import { useState } from 'react';
import { useRoomStatePolling } from '@/hooks/use-room-state-polling';

export function RoomStatePollingPanel() {
  const [roomIdInput, setRoomIdInput] = useState('');
  const [activeRoomId, setActiveRoomId] = useState('');
  const { data, error, loading } = useRoomStatePolling(activeRoomId, 2000);

  return (
    <section style={{ marginTop: 24, padding: 16, background: '#fff', borderRadius: 12 }}>
      <h2 style={{ marginTop: 0 }}>房间状态轮询（Demo）</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={roomIdInput}
          onChange={(event) => setRoomIdInput(event.target.value)}
          placeholder="输入 roomId"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="button" onClick={() => setActiveRoomId(roomIdInput.trim())}>
          开始轮询
        </button>
      </div>

      <p style={{ color: '#475569' }}>当前轮询 roomId: {activeRoomId || '-'}</p>
      {loading ? <p>加载中...</p> : null}
      {error ? <p style={{ color: '#dc2626' }}>{error}</p> : null}
      <pre style={{ overflowX: 'auto', background: '#0f172a', color: '#e2e8f0', padding: 12 }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}
