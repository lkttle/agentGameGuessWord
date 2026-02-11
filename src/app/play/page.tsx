'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import {
  GAME_MODES,
  PLAY_ENTRY_MODES,
  type GameMode,
  type PlayEntryMode
} from '@/lib/domain/types';

interface SessionUser {
  id: string;
  secondmeUserId?: string | null;
  name?: string | null;
}

interface SessionResponse {
  authenticated: boolean;
  user?: SessionUser;
}

interface CreateRoomResponse {
  room: { id: string };
}

function buildFallbackCreatePayload(selected: ModeOption, alias?: string) {
  return {
    mode: selected.mode,
    displayName: alias?.trim() || undefined
  };
}

interface ModeOption {
  key: PlayEntryMode;
  title: string;
  subtitle: string;
  mode: GameMode;
  autoJoinSelfAgent: boolean;
  defaultParticipantCount: number;
}

const modeOptions: ModeOption[] = [
  {
    key: PLAY_ENTRY_MODES.PLAYER_VS_PLATFORM_AGENT,
    title: '玩家 vs 平台 Agent',
    subtitle: '最快上手，直接挑战平台 Agent',
    mode: GAME_MODES.HUMAN_VS_AGENT,
    autoJoinSelfAgent: false,
    defaultParticipantCount: 2
  },
  {
    key: PLAY_ENTRY_MODES.PLAYER_VS_SELF_AGENT,
    title: '玩家 vs 我的 Agent',
    subtitle: '登录即开战，和你的专属 Agent 对练',
    mode: GAME_MODES.HUMAN_VS_AGENT,
    autoJoinSelfAgent: true,
    defaultParticipantCount: 2
  },
  {
    key: PLAY_ENTRY_MODES.FAST_AGENT_ARENA,
    title: '快节奏 Agent 对战',
    subtitle: '你参战 + Agent 对局，短平快高频开局',
    mode: GAME_MODES.AGENT_VS_AGENT,
    autoJoinSelfAgent: true,
    defaultParticipantCount: 3
  },
  {
    key: PLAY_ENTRY_MODES.MULTI_AGENT_BATTLE,
    title: '多 Agent 混战',
    subtitle: '不局限 1v1，支持多 Agent 参战',
    mode: GAME_MODES.AGENT_VS_AGENT,
    autoJoinSelfAgent: true,
    defaultParticipantCount: 4
  }
];

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store'
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data as T;
}

function PlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const preferredMode = searchParams.get('mode');
  const initialMode = preferredMode === 'HUMAN_VS_AGENT'
    ? PLAY_ENTRY_MODES.PLAYER_VS_PLATFORM_AGENT
    : PLAY_ENTRY_MODES.FAST_AGENT_ARENA;

  const [selectedMode, setSelectedMode] = useState<PlayEntryMode>(initialMode);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [alias, setAlias] = useState('');
  const [participantCount, setParticipantCount] = useState(3);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const modeConfig = useMemo(
    () => modeOptions.find((option) => option.key === selectedMode) ?? modeOptions[0],
    [selectedMode]
  );

  async function ensureSession(): Promise<SessionResponse | null> {
    const session = await apiJson<SessionResponse>('/api/auth/session').catch(
      () => ({ authenticated: false })
    );
    if (session.authenticated) {
      return session;
    }
    const returnTo = `/play?mode=${encodeURIComponent(modeConfig.mode)}`;
    window.location.href = `/api/auth/login?return_to=${encodeURIComponent(returnTo)}`;
    return null;
  }

  async function handleQuickStart() {
    try {
      setError('');
      setBusy('正在为你极速开局...');
      const session = await ensureSession();
      if (!session) {
        return;
      }

      const payload = {
        mode: modeConfig.mode,
        alias: alias.trim() || undefined,
        autoJoinSelfAgent: modeConfig.autoJoinSelfAgent,
        participantCount: showAdvanced
          ? Math.max(2, Math.min(4, Math.floor(participantCount)))
          : modeConfig.defaultParticipantCount
      };

      let createRes: CreateRoomResponse;
      try {
        createRes = await apiJson<CreateRoomResponse>('/api/rooms', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } catch (createError) {
        if (!modeConfig.autoJoinSelfAgent) {
          throw createError;
        }
        createRes = await apiJson<CreateRoomResponse>('/api/rooms', {
          method: 'POST',
          body: JSON.stringify(buildFallbackCreatePayload(modeConfig, alias))
        });
      }

      await apiJson(`/api/rooms/${createRes.room.id}/start`, { method: 'POST', body: '{}' });
      router.push(`/room/${createRes.room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '开局失败，请稍后重试');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="page-container">
      <div className="lobby-header">
        <h1 className="section__title">极速开战</h1>
        <p className="section__desc">
          中文拼音猜词对战：根据每个字的拼音首字母，猜常见中文词语。
        </p>
      </div>

      <div className="alert alert--info mb-md">
        登录后默认使用账户身份，不再手动输入房间 ID 和显示名称。
      </div>
      <div className="alert alert--info mb-md">
        玩法示例：拼音首字母 <strong>CF</strong> 可以对应「吃饭 / 充分 / 出发」。
      </div>

      {error && <div className="alert alert--error mb-md">{error}</div>}
      {busy && (
        <div className="alert alert--info mb-md" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="loading-spinner" />
          {busy}
        </div>
      )}

      <div className="mode-grid">
        {modeOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className="mode-card"
            onClick={() => {
              setSelectedMode(option.key);
              setParticipantCount(option.defaultParticipantCount);
            }}
            style={{
              textAlign: 'left',
              borderColor: selectedMode === option.key ? 'var(--color-primary)' : undefined,
              boxShadow: selectedMode === option.key ? 'var(--shadow-lg)' : undefined
            }}
          >
            <div className="mode-card__title">{option.title}</div>
            <div className="mode-card__desc">{option.subtitle}</div>
          </button>
        ))}
      </div>

      <div className="lobby-card animate-slide-up" style={{ marginTop: 'var(--space-lg)' }}>
        <h2 className="lobby-card__title">两步开局</h2>
        <p className="lobby-card__desc">当前模式：{modeConfig.title}</p>

        <div className="lobby-form">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setShowAdvanced((value) => !value)}
            style={{ justifySelf: 'start' }}
          >
            {showAdvanced ? '收起高级设置' : '展开高级设置'}
          </button>

          {showAdvanced && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="play-alias">可选别名（非必填）</label>
                <input
                  id="play-alias"
                  className="input"
                  value={alias}
                  onChange={(event) => setAlias(event.target.value)}
                  placeholder="默认使用你的账户名称"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="participant-count">参战数量</label>
                <select
                  id="participant-count"
                  className="select"
                  value={participantCount}
                  onChange={(event) => setParticipantCount(Number(event.target.value))}
                >
                  <option value={2}>2 人/Agent</option>
                  <option value={3}>3 人/Agent</option>
                  <option value={4}>4 人/Agent</option>
                </select>
              </div>
            </>
          )}

          <button
            type="button"
            className="btn btn--primary btn--lg btn--full"
            onClick={() => void handleQuickStart()}
            disabled={!!busy}
          >
            {busy ? '开战中...' : '一键快速开战'}
          </button>
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
