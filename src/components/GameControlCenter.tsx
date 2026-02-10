'use client';

import { useMemo, useState } from 'react';
import {
  GAME_MODES,
  LEADERBOARD_PERIODS,
  PARTICIPANT_TYPES,
  type GameMode,
  type LeaderboardPeriod,
  type ParticipantType
} from '@/lib/domain/types';

interface SessionResponse {
  authenticated: boolean;
  user?: {
    id: string;
    secondmeUserId?: string | null;
    name?: string | null;
    email?: string | null;
  };
}

interface RoomParticipant {
  id: string;
  participantType: ParticipantType;
  displayName: string;
  userId?: string | null;
  seatOrder: number;
}

interface RoomStatePayload {
  room?: {
    id: string;
    mode: GameMode;
    status: string;
    hostUserId: string;
    participants: RoomParticipant[];
    match?: {
      id: string;
      status: string;
      totalRounds: number;
    } | null;
  };
}

interface MatchSummaryPayload {
  matchId: string;
  roomId: string;
  status: string;
  winnerUserId?: string | null;
  totalRounds: number;
  participants: Array<{
    participantId: string;
    displayName: string;
    participantType: ParticipantType;
    score: number;
    correctCount: number;
  }>;
}

interface LeaderboardPayload {
  period: LeaderboardPeriod;
  entries: Array<{
    userId: string;
    score: number;
    wins: number;
    losses: number;
    user: {
      name?: string | null;
      secondmeUserId?: string | null;
    };
  }>;
}

interface MetricsPayload {
  loginCount: number;
  startedMatchCount: number;
  completedMatchCount: number;
  completionRate: number;
}

const DEMO_USERS = {
  host: {
    secondmeUserId: 'demo-host',
    name: 'Demo Host',
    email: 'host@example.com'
  },
  player: {
    secondmeUserId: 'demo-player',
    name: 'Demo Player',
    email: 'player@example.com'
  }
};

function parseApiError(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string') {
      return error;
    }
  }
  return null;
}

function pretty(data: unknown): string {
  if (!data) {
    return '暂无数据';
  }
  return JSON.stringify(data, null, 2);
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    cache: 'no-store'
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    throw new Error(parseApiError(payload) ?? `${response.status} ${response.statusText}`);
  }

  return payload as T;
}

export function GameControlCenter() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [roomState, setRoomState] = useState<RoomStatePayload | null>(null);
  const [matchResult, setMatchResult] = useState<MatchSummaryPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPayload | null>(null);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);

  const [roomMode, setRoomMode] = useState<GameMode>(GAME_MODES.AGENT_VS_AGENT);
  const [hostDisplayName, setHostDisplayName] = useState('Agent Alpha');
  const [joinDisplayName, setJoinDisplayName] = useState('Agent Beta');
  const [joinParticipantType, setJoinParticipantType] = useState<ParticipantType>(
    PARTICIPANT_TYPES.AGENT
  );

  const [roomId, setRoomId] = useState('');
  const [matchId, setMatchId] = useState('');
  const [targetWord, setTargetWord] = useState('apple');
  const [guessWord, setGuessWord] = useState('angle');
  const [humanParticipantId, setHumanParticipantId] = useState('');
  const [agentParticipantId, setAgentParticipantId] = useState('');
  const [winnerUserId, setWinnerUserId] = useState('');
  const [totalRounds, setTotalRounds] = useState('1');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>(
    LEADERBOARD_PERIODS.ALL_TIME
  );

  const [errorMessage, setErrorMessage] = useState('');
  const [lastAction, setLastAction] = useState('准备就绪');
  const [busyAction, setBusyAction] = useState('');

  const sessionUserId = session?.authenticated ? (session.user?.id ?? '') : '';

  const summaryCards = useMemo(
    () => [
      {
        title: '会话状态',
        value: session?.authenticated ? 'Authenticated' : 'Not Logged In',
        detail: session?.user?.name || session?.user?.secondmeUserId || '未登录'
      },
      {
        title: '当前房间',
        value: roomId || '-',
        detail: roomState?.room?.status ?? 'WAITING'
      },
      {
        title: '当前对局',
        value: matchId || '-',
        detail: roomState?.room?.match?.status ?? matchResult?.status ?? 'RUNNING'
      },
      {
        title: '最后操作',
        value: busyAction ? '执行中' : '空闲',
        detail: busyAction || lastAction
      }
    ],
    [busyAction, lastAction, matchId, matchResult?.status, roomId, roomState?.room?.match?.status, roomState?.room?.status, session]
  );

  async function runAction(actionLabel: string, action: () => Promise<void>) {
    try {
      setBusyAction(actionLabel);
      setErrorMessage('');
      await action();
      setLastAction(actionLabel);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusyAction('');
    }
  }

  function syncParticipantIds(participants: RoomParticipant[]) {
    const firstHuman = participants.find(
      (participant) => participant.participantType === PARTICIPANT_TYPES.HUMAN
    );
    const firstAgent = participants.find(
      (participant) => participant.participantType === PARTICIPANT_TYPES.AGENT
    );

    if (firstHuman) {
      setHumanParticipantId(firstHuman.id);
    }
    if (firstAgent) {
      setAgentParticipantId(firstAgent.id);
    }
  }

  async function loadSession() {
    const payload = await requestJson<SessionResponse>('/api/auth/session', { method: 'GET' });
    if (!payload.authenticated) {
      setSession(null);
      return;
    }
    setSession(payload);
    if (!winnerUserId && payload.user?.id) {
      setWinnerUserId(payload.user.id);
    }
  }

  async function refreshSession() {
    await runAction('刷新会话', loadSession);
  }

  async function mockLogin(role: 'host' | 'player') {
    await runAction(`Mock 登录：${role}`, async () => {
      const payload = await requestJson<{ ok: true; user: { id: string } }>('/api/dev/mock-login', {
        method: 'POST',
        body: JSON.stringify(DEMO_USERS[role])
      });

      setWinnerUserId(payload.user.id);
      await loadSession();
    });
  }

  async function logout() {
    await runAction('退出登录', async () => {
      await requestJson('/api/auth/logout', { method: 'POST' });
      setSession(null);
    });
  }

  async function createRoom() {
    await runAction('创建房间', async () => {
      const payload = await requestJson<RoomStatePayload>('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({
          mode: roomMode,
          displayName: hostDisplayName
        })
      });

      if (!payload.room) {
        return;
      }

      setRoomState(payload);
      setRoomId(payload.room.id);
      syncParticipantIds(payload.room.participants);
    });
  }

  async function joinRoom() {
    if (!roomId) {
      setErrorMessage('请先输入 roomId');
      return;
    }

    await runAction('加入房间', async () => {
      const payload = await requestJson<{ participant: RoomParticipant }>(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        body: JSON.stringify({
          participantType: joinParticipantType,
          displayName: joinDisplayName
        })
      });

      if (payload.participant.participantType === PARTICIPANT_TYPES.HUMAN) {
        setHumanParticipantId(payload.participant.id);
      }
      if (payload.participant.participantType === PARTICIPANT_TYPES.AGENT) {
        setAgentParticipantId(payload.participant.id);
      }
      await loadRoomState();
    });
  }

  async function startRoom() {
    if (!roomId) {
      setErrorMessage('请先输入 roomId');
      return;
    }

    await runAction('开始对局', async () => {
      const payload = await requestJson<{
        room: { id: string; status: string };
        match: { id: string; status: string };
      }>(`/api/rooms/${roomId}/start`, {
        method: 'POST',
        body: JSON.stringify({})
      });

      setMatchId(payload.match.id);
      await loadRoomState();
    });
  }

  async function loadRoomState() {
    const payload = await requestJson<RoomStatePayload>(`/api/rooms/${roomId}/state`, {
      method: 'GET'
    });

    setRoomState(payload);
    if (payload.room?.match?.id) {
      setMatchId(payload.room.match.id);
    }
    if (payload.room?.participants) {
      syncParticipantIds(payload.room.participants);
    }
  }

  async function queryRoomState() {
    if (!roomId) {
      setErrorMessage('请先输入 roomId');
      return;
    }

    await runAction('拉取房间状态', loadRoomState);
  }

  async function triggerAgentRound() {
    if (!matchId) {
      setErrorMessage('请先输入 matchId');
      return;
    }

    await runAction('执行 Agent 回合', async () => {
      await requestJson(`/api/matches/${matchId}/agent-round`, {
        method: 'POST',
        body: JSON.stringify({ targetWord })
      });
      await loadRoomState();
      await loadResult();
    });
  }

  async function submitHumanMove() {
    if (!matchId) {
      setErrorMessage('请先输入 matchId');
      return;
    }
    if (!humanParticipantId) {
      setErrorMessage('humanParticipantId 不能为空');
      return;
    }

    await runAction('提交 Human Move', async () => {
      await requestJson(`/api/matches/${matchId}/human-move`, {
        method: 'POST',
        body: JSON.stringify({
          participantId: humanParticipantId,
          agentParticipantId: agentParticipantId || undefined,
          targetWord,
          guessWord
        })
      });

      await loadRoomState();
      await loadResult();
    });
  }

  async function finishRoom() {
    if (!roomId) {
      setErrorMessage('请先输入 roomId');
      return;
    }

    await runAction('结束房间并结算', async () => {
      const parsedTotalRounds = Number(totalRounds);
      await requestJson(`/api/rooms/${roomId}/finish`, {
        method: 'POST',
        body: JSON.stringify({
          winnerUserId: winnerUserId || undefined,
          totalRounds: Number.isFinite(parsedTotalRounds) ? parsedTotalRounds : undefined
        })
      });

      await loadRoomState();
      await loadResult();
      await loadLeaderboard();
    });
  }

  async function loadResult() {
    const payload = await requestJson<MatchSummaryPayload>(`/api/matches/${matchId}/result`, {
      method: 'GET'
    });
    setMatchResult(payload);
  }

  async function queryResult() {
    if (!matchId) {
      setErrorMessage('请先输入 matchId');
      return;
    }

    await runAction('拉取战报', loadResult);
  }

  async function loadLeaderboard() {
    const periodParam = leaderboardPeriod.toLowerCase();
    const payload = await requestJson<LeaderboardPayload>(
      `/api/leaderboard?period=${periodParam}&limit=10`,
      {
        method: 'GET'
      }
    );
    setLeaderboard(payload);
  }

  async function queryLeaderboard() {
    await runAction('拉取排行榜', loadLeaderboard);
  }

  async function loadMetrics() {
    const payload = await requestJson<MetricsPayload>('/api/metrics/summary', {
      method: 'GET'
    });
    setMetrics(payload);
  }

  async function queryMetrics() {
    await runAction('拉取指标', loadMetrics);
  }

  return (
    <section className="dashboard-layout" aria-live="polite">
      <div className="summary-grid">
        {summaryCards.map((card) => (
          <article key={card.title} className="summary-card">
            <p>{card.title}</p>
            <strong>{card.value}</strong>
            <span>{card.detail}</span>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <article className="panel-card">
          <div className="panel-title-row">
            <SignalIcon />
            <h2>1) 登录与会话</h2>
          </div>
          <p className="panel-desc">开发联调优先使用 mock 登录；线上可直接跳转 OAuth。</p>
          <div className="actions-row">
            <button type="button" className="btn-primary" onClick={() => void mockLogin('host')}>
              Mock Host
            </button>
            <button type="button" className="btn-secondary" onClick={() => void mockLogin('player')}>
              Mock Player
            </button>
            <button type="button" className="btn-secondary" onClick={() => void refreshSession()}>
              刷新会话
            </button>
            <button type="button" className="btn-secondary" onClick={() => void logout()}>
              退出
            </button>
            <a className="btn-secondary" href="/api/auth/login">
              OAuth 登录
            </a>
          </div>
          <div className="code-block">{pretty(session)}</div>
        </article>

        <article className="panel-card">
          <div className="panel-title-row">
            <SignalIcon />
            <h2>2) 房间生命周期</h2>
          </div>

          <div className="form-grid">
            <label>
              模式
              <select value={roomMode} onChange={(event) => setRoomMode(event.target.value as GameMode)}>
                <option value={GAME_MODES.AGENT_VS_AGENT}>AGENT_VS_AGENT</option>
                <option value={GAME_MODES.HUMAN_VS_AGENT}>HUMAN_VS_AGENT</option>
              </select>
            </label>
            <label>
              Host 名称
              <input
                value={hostDisplayName}
                onChange={(event) => setHostDisplayName(event.target.value)}
                placeholder="Agent Alpha"
              />
            </label>
            <button type="button" className="btn-primary" onClick={() => void createRoom()}>
              创建房间
            </button>
          </div>

          <div className="form-grid">
            <label>
              Room ID
              <input value={roomId} onChange={(event) => setRoomId(event.target.value.trim())} />
            </label>
            <label>
              加入身份
              <select
                value={joinParticipantType}
                onChange={(event) => setJoinParticipantType(event.target.value as ParticipantType)}
              >
                <option value={PARTICIPANT_TYPES.AGENT}>AGENT</option>
                <option value={PARTICIPANT_TYPES.HUMAN}>HUMAN</option>
              </select>
            </label>
            <label>
              Join 名称
              <input
                value={joinDisplayName}
                onChange={(event) => setJoinDisplayName(event.target.value)}
                placeholder="Agent Beta"
              />
            </label>
          </div>

          <div className="actions-row">
            <button type="button" className="btn-secondary" onClick={() => void joinRoom()}>
              加入房间
            </button>
            <button type="button" className="btn-secondary" onClick={() => void startRoom()}>
              开始对局
            </button>
            <button type="button" className="btn-secondary" onClick={() => void queryRoomState()}>
              查询状态
            </button>
          </div>

          <div className="code-block">{pretty(roomState)}</div>
        </article>

        <article className="panel-card">
          <div className="panel-title-row">
            <SignalIcon />
            <h2>3) 回合执行</h2>
          </div>
          <div className="form-grid">
            <label>
              Match ID
              <input value={matchId} onChange={(event) => setMatchId(event.target.value.trim())} />
            </label>
            <label>
              targetWord
              <input value={targetWord} onChange={(event) => setTargetWord(event.target.value.trim())} />
            </label>
            <label>
              guessWord (Human)
              <input value={guessWord} onChange={(event) => setGuessWord(event.target.value.trim())} />
            </label>
            <label>
              humanParticipantId
              <input
                value={humanParticipantId}
                onChange={(event) => setHumanParticipantId(event.target.value.trim())}
              />
            </label>
            <label>
              agentParticipantId
              <input
                value={agentParticipantId}
                onChange={(event) => setAgentParticipantId(event.target.value.trim())}
              />
            </label>
          </div>
          <div className="actions-row">
            <button type="button" className="btn-primary" onClick={() => void triggerAgentRound()}>
              Agent 回合
            </button>
            <button type="button" className="btn-secondary" onClick={() => void submitHumanMove()}>
              Human Move
            </button>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-title-row">
            <SignalIcon />
            <h2>4) 结算与观测</h2>
          </div>

          <div className="form-grid">
            <label>
              winnerUserId
              <input value={winnerUserId} onChange={(event) => setWinnerUserId(event.target.value.trim())} />
            </label>
            <label>
              totalRounds
              <input value={totalRounds} onChange={(event) => setTotalRounds(event.target.value.trim())} />
            </label>
            <label>
              排行榜周期
              <select
                value={leaderboardPeriod}
                onChange={(event) => setLeaderboardPeriod(event.target.value as LeaderboardPeriod)}
              >
                <option value={LEADERBOARD_PERIODS.ALL_TIME}>ALL_TIME</option>
                <option value={LEADERBOARD_PERIODS.DAILY}>DAILY</option>
              </select>
            </label>
          </div>

          <div className="actions-row">
            <button type="button" className="btn-primary" onClick={() => void finishRoom()}>
              结束房间
            </button>
            <button type="button" className="btn-secondary" onClick={() => void queryResult()}>
              拉取战报
            </button>
            <button type="button" className="btn-secondary" onClick={() => void queryLeaderboard()}>
              拉取榜单
            </button>
            <button type="button" className="btn-secondary" onClick={() => void queryMetrics()}>
              拉取指标
            </button>
          </div>

          <div className="data-grid">
            <div className="code-block">{pretty(matchResult)}</div>
            <div className="code-block">{pretty(leaderboard)}</div>
            <div className="code-block">{pretty(metrics)}</div>
          </div>
        </article>
      </div>

      {sessionUserId ? <p className="hint">当前登录用户 ID: {sessionUserId}</p> : null}
      {busyAction ? <p className="hint">处理中：{busyAction} ...</p> : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </section>
  );
}

function SignalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 17h2v3H4v-3Zm4-4h2v7H8v-7Zm4-3h2v10h-2V10Zm4-4h2v14h-2V6Z"
        fill="currentColor"
      />
    </svg>
  );
}
