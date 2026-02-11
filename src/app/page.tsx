'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { GAME_MODES, type GameMode } from '@/lib/domain/types';
import { HomeRecentUsersTicker } from '@/components/HomeHeroWidgets';

interface SessionResponse {
  authenticated: boolean;
}

interface CreateRoomResponse {
  room: { id: string };
}

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
      ? String((data as { error: unknown }).error) : `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data as T;
}

interface ModeOption {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  mode: GameMode;
  autoJoinSelfAgent: boolean;
}

const modeOptions: ModeOption[] = [
  {
    key: 'PLAYER_VS_AGENT',
    title: '玩家 VS Agent',
    subtitle: '亲自上场，和 AI Agent 比拼猜词',
    icon: '🎮',
    mode: GAME_MODES.HUMAN_VS_AGENT,
    autoJoinSelfAgent: false
  },
  {
    key: 'SELF_AGENT_VS_AGENTS',
    title: '我的Agent VS 其他Agent',
    subtitle: '派你的 SecondMe Agent 出战，观战助威',
    icon: '🤖',
    mode: GAME_MODES.AGENT_VS_AGENT,
    autoJoinSelfAgent: true
  }
];

function HomeContent() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<string>('PLAYER_VS_AGENT');
  const [playerCount, setPlayerCount] = useState(4);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const modeConfig = modeOptions.find(o => o.key === selectedMode) ?? modeOptions[0];

  useEffect(() => {
    void fetch('/api/warmup/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store'
    }).catch(() => null);
  }, []);

  async function ensureSession(): Promise<SessionResponse | null> {
    const session = await apiJson<SessionResponse>('/api/auth/session').catch(
      () => ({ authenticated: false })
    );
    if (session.authenticated) return session;
    window.location.href = `/api/auth/login?return_to=${encodeURIComponent('/')}`;
    return null;
  }

  async function handleStartGame() {
    try {
      setError('');
      setBusy('正在为你极速开局...');
      const session = await ensureSession();
      if (!session) return;

      const payload = {
        mode: modeConfig.mode,
        autoJoinSelfAgent: modeConfig.autoJoinSelfAgent,
        participantCount: Math.max(2, Math.min(5, playerCount))
      };

      let createRes: CreateRoomResponse;
      try {
        createRes = await apiJson<CreateRoomResponse>('/api/rooms', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } catch (createError) {
        if (!modeConfig.autoJoinSelfAgent) throw createError;
        createRes = await apiJson<CreateRoomResponse>('/api/rooms', {
          method: 'POST',
          body: JSON.stringify({ mode: modeConfig.mode })
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
    <main>
      {/* Hero */}
      <section className="hero">
        <div className="hero__inner">
          <div className="hero__badge">SecondMe Hackathon &middot; A2A 猜词王</div>
          <h1 className="hero__title">
            <span className="hero__title-accent">A2A 猜词王</span><br />
            拼音首字母对战
          </h1>
          <p className="hero__subtitle">
            根据拼音首字母猜中文词语，和 AI Agent 同场竞技，冲击排行榜！
          </p>
        </div>
        {/* Recent Users Ticker */}
        <HomeRecentUsersTicker />
      </section>

      {/* Game Entry */}
      <section className="section">
        <div className="page-container">
          <div className="section__header">
            <h2 className="section__title">选择对战模式</h2>
            <p className="section__desc">选一种玩法，立刻开始</p>
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
                className={`mode-card ${selectedMode === option.key ? 'mode-card--selected' : ''}`}
                onClick={() => setSelectedMode(option.key)}
              >
                <div className="mode-card__icon">
                  <span style={{ fontSize: '2rem' }}>{option.icon}</span>
                </div>
                <h3 className="mode-card__title">{option.title}</h3>
                <p className="mode-card__desc">{option.subtitle}</p>
              </button>
            ))}
          </div>

          {/* Quick Start Panel */}
          <div className="quick-start-panel animate-slide-up">
            <div className="quick-start-panel__row">
              <div className="quick-start-panel__label">游戏人数</div>
              <div className="quick-start-panel__counts">
                {[2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`count-chip ${playerCount === n ? 'count-chip--active' : ''}`}
                    onClick={() => setPlayerCount(n)}
                  >
                    {n}人
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn btn--gradient btn--lg btn--full"
              onClick={() => void handleStartGame()}
              disabled={!!busy}
            >
              {busy ? '开战中...' : '立即开战'}
            </button>

            <p className="quick-start-panel__hint">
              玩法：看拼音首字母（如 CF），猜中文词语（如「吃饭」）。答对 +1 分，答错不扣分。
            </p>
          </div>

          <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
            <Link href="/leaderboard" className="btn btn--secondary">
              查看排行榜
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="page-container text-center"><span className="loading-spinner" /></div>}>
      <HomeContent />
    </Suspense>
  );
}
