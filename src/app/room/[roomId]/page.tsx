'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GAME_MODES,
  PARTICIPANT_TYPES,
  type GameMode,
  type ParticipantType
} from '@/lib/domain/types';

/* ----------------------------------------------------------------
   Types
   ---------------------------------------------------------------- */
interface Participant {
  id: string;
  userId: string | null;
  participantType: ParticipantType;
  displayName: string;
  seatOrder: number;
  score?: number;
}

interface RoundLogEntry {
  id: string;
  roundIndex: number;
  participantId: string;
  guessWord: string;
  isCorrect: boolean;
  scoreDelta: number;
}

interface RoomState {
  room: {
    id: string;
    mode: GameMode;
    status: string;
    hostUserId: string;
    participants: Participant[];
    match: {
      id: string;
      status: string;
      totalRounds: number;
      roundLogs?: RoundLogEntry[];
    } | null;
  };
}

interface SessionData {
  authenticated: boolean;
  user?: { id: string; name?: string | null };
}

/* ----------------------------------------------------------------
   API helper
   ---------------------------------------------------------------- */
async function api<T>(url: string, init?: RequestInit): Promise<T> {
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
      ? String((data as { error: unknown }).error) : `${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

/* ----------------------------------------------------------------
   Word Display Component
   ---------------------------------------------------------------- */
function WordDisplay({ hint }: { hint: string }) {
  const letters = hint.split('');
  return (
    <div className="word-display">
      <div className="word-display__label">Target Word Hint</div>
      <div className="word-display__letters">
        {letters.map((letter, i) => (
          <div
            key={i}
            className={`word-display__letter ${
              letter !== '_' ? 'word-display__letter--revealed' : 'word-display__letter--blank'
            }`}
          >
            {letter === '_' ? '\u00A0' : letter}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   Player Card
   ---------------------------------------------------------------- */
function PlayerCard({ participant, isHost, scores }: {
  participant: Participant;
  isHost: boolean;
  scores: Map<string, number>;
}) {
  const initial = participant.displayName.charAt(0).toUpperCase();
  const score = scores.get(participant.id) ?? 0;
  const avatarClass = participant.participantType === PARTICIPANT_TYPES.HUMAN
    ? 'player-card__avatar--human' : 'player-card__avatar--agent';

  return (
    <div className="player-card">
      <div className={`player-card__avatar ${avatarClass}`}>{initial}</div>
      <div className="player-card__info">
        <div className="player-card__name">
          {participant.displayName}
          {isHost && <span style={{ fontSize: '0.75rem', color: 'var(--color-accent)', marginLeft: '6px' }}>HOST</span>}
        </div>
        <div className="player-card__type">{participant.participantType}</div>
      </div>
      <div className="player-card__score">{score}</div>
    </div>
  );
}

/* ----------------------------------------------------------------
   Main Room Page
   ---------------------------------------------------------------- */
export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [targetWord, setTargetWord] = useState('apple');
  const [guessWord, setGuessWord] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compute scores from round logs
  const scores = new Map<string, number>();
  if (roomState?.room.match?.roundLogs) {
    for (const log of roomState.room.match.roundLogs) {
      scores.set(log.participantId, (scores.get(log.participantId) ?? 0) + log.scoreDelta);
    }
  }

  const room = roomState?.room;
  const match = room?.match;
  const isHost = session?.user?.id === room?.hostUserId;
  const participants = room?.participants ?? [];

  const humanParticipant = participants.find(p => p.participantType === PARTICIPANT_TYPES.HUMAN);
  const agentParticipant = participants.find(p => p.participantType === PARTICIPANT_TYPES.AGENT);

  // Generate hint from target word
  const hint = targetWord
    ? targetWord[0] + '_'.repeat(targetWord.length - 1)
    : '';

  const fetchRoom = useCallback(async () => {
    try {
      const data = await api<RoomState>(`/api/rooms/${roomId}/state`);
      setRoomState(data);
    } catch {
      // Silently handle polling errors
    }
  }, [roomId]);

  // Load session + initial room state
  useEffect(() => {
    async function init() {
      try {
        const s = await api<SessionData>('/api/auth/session');
        setSession(s);
      } catch { /* ignore */ }
      await fetchRoom();
    }
    void init();
  }, [fetchRoom]);

  // Polling
  useEffect(() => {
    if (!roomId) return;
    pollingRef.current = setInterval(() => { void fetchRoom(); }, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [roomId, fetchRoom]);

  async function runAction(label: string, action: () => Promise<void>) {
    try {
      setError('');
      setBusy(label);
      await action();
      await fetchRoom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy('');
    }
  }

  async function handleStart() {
    await runAction('Starting game...', async () => {
      await api(`/api/rooms/${roomId}/start`, { method: 'POST', body: '{}' });
    });
  }

  async function handleAgentRound() {
    await runAction('Running agent round...', async () => {
      await api(`/api/matches/${match!.id}/agent-round`, {
        method: 'POST',
        body: JSON.stringify({ targetWord, roundIndex: (match?.totalRounds ?? 0) + 1 })
      });
    });
  }

  async function handleHumanMove() {
    if (!guessWord.trim()) { setError('Enter your guess'); return; }
    await runAction('Submitting guess...', async () => {
      await api(`/api/matches/${match!.id}/human-move`, {
        method: 'POST',
        body: JSON.stringify({
          participantId: humanParticipant?.id,
          agentParticipantId: agentParticipant?.id,
          targetWord,
          guessWord: guessWord.trim()
        })
      });
      setGuessWord('');
    });
  }

  async function handleFinish() {
    const winner = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
    const winnerParticipant = winner ? participants.find(p => p.id === winner[0]) : null;
    await runAction('Finishing match...', async () => {
      await api(`/api/rooms/${roomId}/finish`, {
        method: 'POST',
        body: JSON.stringify({
          winnerUserId: winnerParticipant?.userId ?? session?.user?.id,
          totalRounds: match?.totalRounds ?? 1
        })
      });
    });
  }

  // Loading state
  if (!roomState) {
    return (
      <div className="room-page">
        <div className="room-body flex-center" style={{ minHeight: '50vh' }}>
          <span className="loading-spinner" />
        </div>
      </div>
    );
  }

  const statusClass = room?.status === 'RUNNING' ? 'running'
    : room?.status === 'FINISHED' ? 'finished' : 'waiting';

  return (
    <div className="room-page">
      {/* Room Header */}
      <div className="room-header">
        <div className="room-header__inner">
          <div className="room-header__info">
            <span className="room-header__mode">
              {room?.mode === GAME_MODES.AGENT_VS_AGENT ? 'Agent vs Agent' : 'Human vs Agent'}
            </span>
            <h1 className="room-header__title">Game Room</h1>
            <span className="room-header__id">Room: {roomId}</span>
          </div>
          <div className={`room-status-badge room-status-badge--${statusClass}`}>
            <span className="room-status-badge__dot" />
            {room?.status}
          </div>
        </div>
      </div>

      {/* Room Body */}
      <div className="room-body">
        {error && <div className="alert alert--error mb-md">{error}</div>}
        {busy && (
          <div className="alert alert--info mb-md" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="loading-spinner" /> {busy}
          </div>
        )}

        {/* WAITING State */}
        {room?.status === 'WAITING' && (
          <div className="waiting-state animate-fade-in">
            <div>
              <h2 className="waiting-state__title">Waiting for Players</h2>
              <p className="waiting-state__desc">
                Share the Room ID with other players to join. At least 2 players needed to start.
              </p>
            </div>

            <div style={{
              background: 'var(--purple-50)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-lg)',
              fontFamily: 'var(--font-mono)',
              fontSize: '1.1rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: 'var(--color-primary)',
              wordBreak: 'break-all'
            }}>
              {roomId}
            </div>

            <div className="players-list">
              {participants.map(p => (
                <PlayerCard key={p.id} participant={p} isHost={p.userId === room.hostUserId} scores={scores} />
              ))}
              {participants.length < 2 && (
                <div className="player-card player-card--empty">
                  Waiting for opponent...
                </div>
              )}
            </div>

            {isHost && participants.length >= 2 && (
              <button
                type="button"
                className="btn btn--gradient btn--lg"
                onClick={() => void handleStart()}
                disabled={!!busy}
              >
                Start Game
              </button>
            )}
            {!isHost && (
              <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                Waiting for the host to start the game...
              </p>
            )}
          </div>
        )}

        {/* RUNNING State */}
        {room?.status === 'RUNNING' && match && (
          <div className="arena animate-fade-in">
            <div className="arena__main">
              {/* Word Display */}
              <WordDisplay hint={hint} />

              {/* Round Info */}
              <div className="round-info">
                <div className="round-info__item">
                  <div className="round-info__label">Round</div>
                  <div className="round-info__value">{match.totalRounds || 1}</div>
                </div>
                <div className="round-info__item">
                  <div className="round-info__label">Status</div>
                  <div className="round-info__value" style={{ color: 'var(--color-success)' }}>
                    {match.status}
                  </div>
                </div>
                <div className="round-info__item">
                  <div className="round-info__label">Mode</div>
                  <div className="round-info__value">
                    {room.mode === GAME_MODES.AGENT_VS_AGENT ? 'A2A' : 'HvA'}
                  </div>
                </div>
              </div>

              {/* Game Controls */}
              {isHost && (
                <div className="card">
                  <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1rem' }}>Game Controls</h3>
                  <div className="form-group mb-md">
                    <label className="form-label" htmlFor="target-word">Target Word</label>
                    <input
                      id="target-word"
                      className="input"
                      value={targetWord}
                      onChange={e => setTargetWord(e.target.value.trim())}
                      placeholder="Enter target word"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                  </div>

                  {room.mode === GAME_MODES.AGENT_VS_AGENT ? (
                    <button
                      type="button"
                      className="btn btn--primary btn--full"
                      onClick={() => void handleAgentRound()}
                      disabled={!!busy}
                    >
                      Run Agent Round
                    </button>
                  ) : (
                    <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                      <div className="guess-form">
                        <input
                          className="input"
                          value={guessWord}
                          onChange={e => setGuessWord(e.target.value)}
                          placeholder="Type your guess..."
                          onKeyDown={e => { if (e.key === 'Enter') void handleHumanMove(); }}
                        />
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => void handleHumanMove()}
                          disabled={!!busy}
                        >
                          Guess
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn--accent btn--full mt-md"
                    onClick={() => void handleFinish()}
                    disabled={!!busy}
                  >
                    End Game & Settle
                  </button>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="arena__sidebar">
              {/* Players */}
              <div className="card">
                <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1rem' }}>Players</h3>
                <div className="players-list">
                  {participants.map(p => (
                    <PlayerCard key={p.id} participant={p} isHost={p.userId === room.hostUserId} scores={scores} />
                  ))}
                </div>
              </div>

              {/* Round Log */}
              {match.roundLogs && match.roundLogs.length > 0 && (
                <div className="round-log">
                  <div className="round-log__header">Round History</div>
                  <div className="round-log__list">
                    {match.roundLogs.map((log) => {
                      const player = participants.find(p => p.id === log.participantId);
                      return (
                        <div key={log.id} className="round-log__item">
                          <span className="round-log__round">R{log.roundIndex}</span>
                          <span className="round-log__player">{player?.displayName ?? '?'}</span>
                          <span className="round-log__word">{log.guessWord}</span>
                          <span className={`round-log__result ${log.isCorrect ? 'round-log__result--correct' : 'round-log__result--wrong'}`}>
                            {log.isCorrect ? 'HIT' : 'MISS'}
                          </span>
                          <span className="round-log__score">
                            {log.scoreDelta > 0 ? `+${log.scoreDelta}` : log.scoreDelta}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FINISHED State */}
        {room?.status === 'FINISHED' && match && (
          <div className="waiting-state animate-fade-in">
            <div>
              <h2 className="waiting-state__title">Game Over!</h2>
              <p className="waiting-state__desc">The match has ended. Check the full results below.</p>
            </div>

            <div className="players-list">
              {participants
                .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
                .map(p => (
                  <PlayerCard key={p.id} participant={p} isHost={p.userId === room.hostUserId} scores={scores} />
                ))}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href={`/results/${match.id}`} className="btn btn--gradient btn--lg">
                View Full Results
              </Link>
              <Link href="/play" className="btn btn--secondary btn--lg">
                Play Again
              </Link>
              <Link href="/leaderboard" className="btn btn--ghost btn--lg">
                Leaderboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
