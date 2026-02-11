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
  ownerUserId?: string | null;
  agentSource?: 'SELF' | 'PLATFORM' | null;
  status?: 'ACTIVE';
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
      <div className="word-display__label">拼音首字母提示</div>
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
  const agentBadge = participant.participantType === PARTICIPANT_TYPES.AGENT
    ? participant.agentSource === 'SELF'
      ? 'SELF'
      : 'PLATFORM'
    : null;
  const participantTypeLabel = participant.participantType === PARTICIPANT_TYPES.HUMAN ? '人类' : 'Agent';

  return (
    <div className="player-card">
      <div className={`player-card__avatar ${avatarClass}`}>{initial}</div>
      <div className="player-card__info">
        <div className="player-card__name">
          {participant.displayName}
          {isHost && <span style={{ fontSize: '0.75rem', color: 'var(--color-accent)', marginLeft: '6px' }}>房主</span>}
          {agentBadge && (
            <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', marginLeft: '6px' }}>
              {agentBadge}
            </span>
          )}
        </div>
        <div className="player-card__type">{participantTypeLabel}</div>
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
  const [targetWord, setTargetWord] = useState('吃饭');
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
  const agentParticipants = participants.filter(p => p.participantType === PARTICIPANT_TYPES.AGENT);

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
      setError(err instanceof Error ? err.message : '操作失败，请稍后重试');
    } finally {
      setBusy('');
    }
  }

  async function handleStart() {
    await runAction('开始对局中...', async () => {
      await api(`/api/rooms/${roomId}/start`, { method: 'POST', body: '{}' });
    });
  }

  async function handleAgentRound() {
    await runAction('Agent 回合进行中...', async () => {
      await api(`/api/matches/${match!.id}/agent-round`, {
        method: 'POST',
        body: JSON.stringify({ targetWord, roundIndex: (match?.totalRounds ?? 0) + 1 })
      });
    });
  }

  async function handleHumanMove() {
    if (!guessWord.trim()) { setError('请输入你猜测的中文词语'); return; }
    await runAction('提交猜词中...', async () => {
      await api(`/api/matches/${match!.id}/human-move`, {
        method: 'POST',
        body: JSON.stringify({
          participantId: humanParticipant?.id,
          agentParticipantId: agentParticipants[0]?.id,
          autoAgentResponse: true,
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
    await runAction('结算对局中...', async () => {
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
              {room?.mode === GAME_MODES.AGENT_VS_AGENT ? '多 Agent 对战' : '人类 vs Agent'}
              </span>
            <h1 className="room-header__title">猜词对战房间</h1>
            <span className="room-header__id">房间号：{roomId}</span>
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
        <div className="alert alert--info mb-md">
          玩法：根据拼音首字母猜中文词语。示例：<strong>CF</strong> 可对应「吃饭 / 充分 / 出发」。
        </div>

        {/* WAITING State */}
        {room?.status === 'WAITING' && (
          <div className="waiting-state animate-fade-in">
            <div>
              <h2 className="waiting-state__title">等待参与者加入</h2>
              <p className="waiting-state__desc">
                房间已创建。若需更多参与者，可分享房间号。
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
                  等待对手加入...
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
                开始对局
              </button>
            )}
            {!isHost && (
              <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                等待房主开始对局...
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
                  <div className="round-info__label">回合</div>
                  <div className="round-info__value">{match.totalRounds || 1}</div>
                </div>
                <div className="round-info__item">
                  <div className="round-info__label">状态</div>
                  <div className="round-info__value" style={{ color: 'var(--color-success)' }}>
                    {match.status}
                  </div>
                </div>
                <div className="round-info__item">
                  <div className="round-info__label">模式</div>
                  <div className="round-info__value">
                    {room.mode === GAME_MODES.AGENT_VS_AGENT ? 'A2A' : 'HvA'}
                  </div>
                </div>
              </div>

              {/* Game Controls */}
              {isHost && (
                <div className="card">
                  <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1rem' }}>对局控制</h3>
                  <div className="form-group mb-md">
                    <label className="form-label" htmlFor="target-word">标准答案词语（2-4字）</label>
                    <input
                      id="target-word"
                      className="input"
                      value={targetWord}
                      onChange={e => setTargetWord(e.target.value.trim())}
                      placeholder="请输入答案词语，例如：吃饭"
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
                      运行多 Agent 回合
                    </button>
                  ) : (
                    <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                      <div className="guess-form">
                        <input
                          className="input"
                          value={guessWord}
                          onChange={e => setGuessWord(e.target.value)}
                          placeholder="输入你猜的中文词语"
                          onKeyDown={e => { if (e.key === 'Enter') void handleHumanMove(); }}
                        />
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => void handleHumanMove()}
                          disabled={!!busy}
                        >
                          提交猜词
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
                    结束对局并结算
                  </button>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="arena__sidebar">
              {/* Players */}
              <div className="card">
                <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1rem' }}>参与者</h3>
                <div className="players-list">
                  {participants.map(p => (
                    <PlayerCard key={p.id} participant={p} isHost={p.userId === room.hostUserId} scores={scores} />
                  ))}
                </div>
              </div>

              {/* Round Log */}
              {match.roundLogs && match.roundLogs.length > 0 && (
                <div className="round-log">
                  <div className="round-log__header">回合记录</div>
                  <div className="round-log__list">
                    {match.roundLogs.map((log) => {
                      const player = participants.find(p => p.id === log.participantId);
                      return (
                        <div key={log.id} className="round-log__item">
                          <span className="round-log__round">R{log.roundIndex}</span>
                          <span className="round-log__player">{player?.displayName ?? '?'}</span>
                          <span className="round-log__word">{log.guessWord}</span>
                          <span className={`round-log__result ${log.isCorrect ? 'round-log__result--correct' : 'round-log__result--wrong'}`}>
                            {log.isCorrect ? '命中' : '未中'}
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
              <h2 className="waiting-state__title">对局结束！</h2>
              <p className="waiting-state__desc">可查看完整结果并继续下一局拼音猜词对战。</p>
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
                查看完整结果
              </Link>
              <Link href="/play" className="btn btn--secondary btn--lg">
                再来一局
              </Link>
              <Link href="/leaderboard" className="btn btn--ghost btn--lg">
                排行榜
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
