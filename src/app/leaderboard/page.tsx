'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LEADERBOARD_PERIODS, type LeaderboardPeriod } from '@/lib/domain/types';

interface LeaderboardEntry {
  userId: string;
  score: number;
  wins: number;
  losses: number;
  user: {
    name?: string | null;
    secondmeUserId?: string | null;
    avatarUrl?: string | null;
  };
}

interface LeaderboardData {
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<LeaderboardPeriod>(LEADERBOARD_PERIODS.ALL_TIME);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const p = period.toLowerCase();
        const res = await fetch(`/api/leaderboard?period=${p}&limit=20`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [period]);

  function getRankClass(index: number): string {
    if (index === 0) return 'leaderboard-item__rank--1';
    if (index === 1) return 'leaderboard-item__rank--2';
    if (index === 2) return 'leaderboard-item__rank--3';
    return 'leaderboard-item__rank--default';
  }

  return (
    <div className="page-container">
      <div className="leaderboard-header">
        <h1 className="section__title">Leaderboard</h1>
        <p className="section__desc">Top players ranked by total score</p>
      </div>

      <div className="leaderboard-tabs">
        <button
          type="button"
          className={`leaderboard-tab ${period === LEADERBOARD_PERIODS.ALL_TIME ? 'leaderboard-tab--active' : ''}`}
          onClick={() => setPeriod(LEADERBOARD_PERIODS.ALL_TIME)}
        >
          All Time
        </button>
        <button
          type="button"
          className={`leaderboard-tab ${period === LEADERBOARD_PERIODS.DAILY ? 'leaderboard-tab--active' : ''}`}
          onClick={() => setPeriod(LEADERBOARD_PERIODS.DAILY)}
        >
          Today
        </button>
      </div>

      {loading ? (
        <div className="flex-center" style={{ padding: 'var(--space-3xl)' }}>
          <span className="loading-spinner" />
        </div>
      ) : !data?.entries?.length ? (
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          </div>
          <h3 className="empty-state__title">No Rankings Yet</h3>
          <p className="empty-state__desc">Play some games to appear on the leaderboard!</p>
          <Link href="/play" className="btn btn--primary mt-lg" style={{ display: 'inline-flex' }}>
            Play Now
          </Link>
        </div>
      ) : (
        <div className="leaderboard-list animate-fade-in">
          {data.entries.map((entry, index) => (
            <div key={entry.userId} className="leaderboard-item">
              <div className={`leaderboard-item__rank ${getRankClass(index)}`}>
                {index + 1}
              </div>
              <div className="leaderboard-item__info">
                <div className="leaderboard-item__name">
                  {entry.user.name || entry.user.secondmeUserId || 'Anonymous'}
                </div>
                <div className="leaderboard-item__record">
                  {entry.wins}W / {entry.losses}L
                </div>
              </div>
              <div className="leaderboard-item__score">{entry.score}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
