'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { GAME_MODES, PARTICIPANT_TYPES, type GameMode, type ParticipantType } from '@/lib/domain/types';

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store'
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }
  if (!res.ok) {
    const msg = data && typeof data === 'object' && 'error' in data
      ? String((data as { error: unknown }).error)
      : `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data as T;
}

function PlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'HUMAN_VS_AGENT'
    ? GAME_MODES.HUMAN_VS_AGENT
    : GAME_MODES.AGENT_VS_AGENT;

  const [mode, setMode] = useState<GameMode>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinType, setJoinType] = useState<ParticipantType>(PARTICIPANT_TYPES.AGENT);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  async function ensureSession(): Promise<boolean> {
    const session = await apiJson<{ authenticated: boolean }>('/api/auth/session');
    if (session.authenticated) return true;
    // Auto mock-login for dev
    await apiJson('/api/dev/mock-login', {
      method: 'POST',
      body: JSON.stringify({
        secondmeUserId: `user-${Date.now()}`,
        name: displayName || joinName || 'Player',
        email: `player-${Date.now()}@demo.local`
      })
    });
    return true;
  }

  async function handleCreate() {
    try {
      setError('');
      setBusy('Creating room...');
      await ensureSession();
      const name = displayName.trim() || (mode === GAME_MODES.AGENT_VS_AGENT ? 'Agent Alpha' : 'Player');
      const res = await apiJson<{ room: { id: string } }>('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ mode, displayName: name })
      });
      router.push(`/room/${res.room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setBusy('');
    }
  }

  async function handleJoin() {
    if (!joinRoomId.trim()) {
      setError('Please enter a Room ID');
      return;
    }
    try {
      setError('');
      setBusy('Joining room...');
      await ensureSession();
      const name = joinName.trim() || 'Challenger';
      await apiJson(`/api/rooms/${joinRoomId.trim()}/join`, {
        method: 'POST',
        body: JSON.stringify({ participantType: joinType, displayName: name })
      });
      router.push(`/room/${joinRoomId.trim()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="page-container">
      <div className="lobby-header">
        <h1 className="section__title">Game Lobby</h1>
        <p className="section__desc">Create a new battle or join an existing room</p>
      </div>

      {error && <div className="alert alert--error mb-md">{error}</div>}
      {busy && (
        <div className="alert alert--info mb-md" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="loading-spinner" />
          {busy}
        </div>
      )}

      <div className="lobby-grid">
        {/* Create Room */}
        <div className="lobby-card animate-slide-up">
          <h2 className="lobby-card__title">Create Room</h2>
          <p className="lobby-card__desc">Set up a new game room and invite others to join.</p>

          <div className="lobby-form">
            <div className="form-group">
              <label className="form-label" htmlFor="create-mode">Game Mode</label>
              <select
                id="create-mode"
                className="select"
                value={mode}
                onChange={(e) => setMode(e.target.value as GameMode)}
              >
                <option value={GAME_MODES.AGENT_VS_AGENT}>Agent vs Agent</option>
                <option value={GAME_MODES.HUMAN_VS_AGENT}>Human vs Agent</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="create-name">Display Name</label>
              <input
                id="create-name"
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={mode === GAME_MODES.AGENT_VS_AGENT ? 'Agent Alpha' : 'Your name'}
              />
            </div>

            <div style={{ background: 'var(--purple-50)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--purple-800)', margin: 0 }}>
                {mode === GAME_MODES.AGENT_VS_AGENT
                  ? 'Watch two AI agents battle it out! You act as the referee.'
                  : 'Challenge an AI agent with your word-guessing skills!'}
              </p>
            </div>

            <button
              type="button"
              className="btn btn--primary btn--lg btn--full"
              onClick={() => void handleCreate()}
              disabled={!!busy}
            >
              {busy === 'Creating room...' ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </div>

        {/* Join Room */}
        <div className="lobby-card animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="lobby-card__title">Join Room</h2>
          <p className="lobby-card__desc">Enter a room code to join an existing game.</p>

          <div className="lobby-form">
            <div className="form-group">
              <label className="form-label" htmlFor="join-room">Room ID</label>
              <input
                id="join-room"
                className="input"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                placeholder="Paste room ID here"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="join-type">Join As</label>
              <select
                id="join-type"
                className="select"
                value={joinType}
                onChange={(e) => setJoinType(e.target.value as ParticipantType)}
              >
                <option value={PARTICIPANT_TYPES.AGENT}>Agent</option>
                <option value={PARTICIPANT_TYPES.HUMAN}>Human</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="join-name">Display Name</label>
              <input
                id="join-name"
                className="input"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Challenger"
              />
            </div>

            <button
              type="button"
              className="btn btn--secondary btn--lg btn--full"
              onClick={() => void handleJoin()}
              disabled={!!busy}
            >
              {busy === 'Joining room...' ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="page-container text-center"><span className="loading-spinner" /></div>}>
      <PlayContent />
    </Suspense>
  );
}
