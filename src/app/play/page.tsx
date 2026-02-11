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
    const session = await apiJson<{ authenticated: boolean }>('/api/auth/session').catch(() => ({ authenticated: false }));
    if (session.authenticated) {
      return true;
    }
    const returnTo = `/play?mode=${encodeURIComponent(mode)}`;
    window.location.href = `/api/auth/login?return_to=${encodeURIComponent(returnTo)}`;
    return false;
  }

  async function handleCreate() {
    try {
      setError('');
      setBusy('正在创建房间...');
      const ok = await ensureSession();
      if (!ok) {
        return;
      }
      const name = displayName.trim() || (mode === GAME_MODES.AGENT_VS_AGENT ? 'Agent Alpha' : 'Player');
      const res = await apiJson<{ room: { id: string } }>('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ mode, displayName: name })
      });
      router.push(`/room/${res.room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建房间失败');
    } finally {
      setBusy('');
    }
  }

  async function handleJoin() {
    if (!joinRoomId.trim()) {
      setError('请输入房间 ID');
      return;
    }
    try {
      setError('');
      setBusy('正在加入房间...');
      const ok = await ensureSession();
      if (!ok) {
        return;
      }
      const name = joinName.trim() || 'Challenger';
      await apiJson(`/api/rooms/${joinRoomId.trim()}/join`, {
        method: 'POST',
        body: JSON.stringify({ participantType: joinType, displayName: name })
      });
      router.push(`/room/${joinRoomId.trim()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入房间失败');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="page-container">
      <div className="lobby-header">
        <h1 className="section__title">对战大厅</h1>
        <p className="section__desc">支持 Agent vs Agent 与 Human vs Agent 两种模式</p>
      </div>

      <div className="alert alert--info mb-md">
        核心用户来自 SecondMe：开始对战前将通过 SecondMe OAuth2 登录。
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
          <h2 className="lobby-card__title">创建房间</h2>
          <p className="lobby-card__desc">新建一局对战并邀请其他玩家加入。</p>

          <div className="lobby-form">
            <div className="form-group">
              <label className="form-label" htmlFor="create-mode">对战模式</label>
              <select
                id="create-mode"
                className="select"
                value={mode}
                onChange={(e) => setMode(e.target.value as GameMode)}
              >
                <option value={GAME_MODES.AGENT_VS_AGENT}>Agent vs Agent（核心）</option>
                <option value={GAME_MODES.HUMAN_VS_AGENT}>Human vs Agent（挑战）</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="create-name">显示名称</label>
              <input
                id="create-name"
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={mode === GAME_MODES.AGENT_VS_AGENT ? 'Agent Alpha' : '你的昵称'}
              />
            </div>

            <div style={{ background: 'var(--purple-50)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--purple-800)', margin: 0 }}>
                {mode === GAME_MODES.AGENT_VS_AGENT
                  ? '观看两个 AI Agent 自主对战，你可以作为裁判围观全程。'
                  : '你将直接挑战 AI Agent，用猜词实力争取胜利。'}
              </p>
            </div>

            <button
              type="button"
              className="btn btn--primary btn--lg btn--full"
              onClick={() => void handleCreate()}
              disabled={!!busy}
            >
              {busy === '正在创建房间...' ? '创建中...' : '创建房间'}
            </button>
          </div>
        </div>

        {/* Join Room */}
        <div className="lobby-card animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="lobby-card__title">加入房间</h2>
          <p className="lobby-card__desc">输入房间 ID 并选择身份后加入对战。</p>

          <div className="lobby-form">
            <div className="form-group">
              <label className="form-label" htmlFor="join-room">房间 ID</label>
              <input
                id="join-room"
                className="input"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                placeholder="请输入房间 ID"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="join-type">加入身份</label>
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
              <label className="form-label" htmlFor="join-name">显示名称</label>
              <input
                id="join-name"
                className="input"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="挑战者"
              />
            </div>

            <button
              type="button"
              className="btn btn--secondary btn--lg btn--full"
              onClick={() => void handleJoin()}
              disabled={!!busy}
            >
              {busy === '正在加入房间...' ? '加入中...' : '加入房间'}
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
