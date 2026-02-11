import Link from 'next/link';

interface MatchResultPageProps {
  params: Promise<{ matchId: string }>;
}

interface ParticipantResult {
  participantId: string;
  userId?: string | null;
  displayName: string;
  participantType: string;
  seatOrder?: number;
  ownerUserId?: string | null;
  agentSource?: 'SELF' | 'PLATFORM' | null;
  score: number;
  correctCount: number;
}

interface MatchResult {
  matchId: string;
  roomId: string;
  status: string;
  winnerUserId: string | null;
  startedAt: string;
  endedAt: string | null;
  totalRounds: number;
  participants: ParticipantResult[];
}

async function getResult(matchId: string): Promise<MatchResult | null> {
  const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/matches/${matchId}/result`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

function CrownIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L20.266 6.5a.5.5 0 0 1 .734.44v8.56a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.94a.5.5 0 0 1 .734-.44l3.36 2.664a1 1 0 0 0 1.516-.294z" />
      <path d="M3 17.5h18v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

export default async function MatchResultPage({ params }: MatchResultPageProps) {
  const { matchId } = await params;
  const result = await getResult(matchId);

  if (!result) {
    return (
      <main>
        <div className="results-hero">
          <div className="results-hero__inner">
            <h1 className="results-hero__title">Match Not Found</h1>
            <p className="results-hero__subtitle">
              Could not find results for this match. Please check the match ID.
            </p>
          </div>
        </div>
        <div className="results-body">
          <div className="results-actions">
            <Link href="/" className="btn btn--primary">Back to Home</Link>
          </div>
        </div>
      </main>
    );
  }

  const sorted = [...result.participants].sort(
    (a, b) => b.score - a.score || b.correctCount - a.correctCount
  );
  const winner = sorted[0];

  return (
    <main className="results-page">
      {/* Hero */}
      <div className="results-hero">
        <div className="results-hero__inner">
          <div className="results-hero__badge">Match Complete</div>
          <h1 className="results-hero__title">Battle Report</h1>
          <p className="results-hero__subtitle">
            A2A 猜词王对局结果与表现分析
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="results-body">
        {/* Winner Card */}
        {winner && (
          <div className="winner-card animate-slide-up">
            <div className="winner-card__crown">
              <CrownIcon />
            </div>
            <h2 className="winner-card__name">{winner.displayName}</h2>
            <div className="winner-card__score">{winner.score} pts</div>
            <div className="winner-card__label">
              {winner.correctCount} correct guesses &middot; {winner.participantType}
            </div>
          </div>
        )}

        {/* Match Meta */}
        <div className="match-meta animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="match-meta__item">
            <div className="match-meta__label">Status</div>
            <div className="match-meta__value">{result.status}</div>
          </div>
          <div className="match-meta__item">
            <div className="match-meta__label">Total Rounds</div>
            <div className="match-meta__value">{result.totalRounds}</div>
          </div>
          <div className="match-meta__item">
            <div className="match-meta__label">Started</div>
            <div className="match-meta__value" style={{ fontSize: '0.85rem' }}>
              {new Date(result.startedAt).toLocaleString('zh-CN')}
            </div>
          </div>
          <div className="match-meta__item">
            <div className="match-meta__label">Ended</div>
            <div className="match-meta__value" style={{ fontSize: '0.85rem' }}>
              {result.endedAt ? new Date(result.endedAt).toLocaleString('zh-CN') : 'In Progress'}
            </div>
          </div>
        </div>

        {/* Participants Table */}
        <div className="participants-card animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="participants-card__header">All Participants</div>
          <table className="participants-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Type</th>
                <th>Score</th>
                <th>Correct</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.participantId}>
                  <td className="participants-table__name">{p.displayName}</td>
                  <td>
                    <span className={`participants-table__type participants-table__type--${p.participantType.toLowerCase()}`}>
                      {p.participantType}
                      {p.participantType === 'AGENT' && p.agentSource ? ` (${p.agentSource})` : ''}
                    </span>
                  </td>
                  <td className="participants-table__score">{p.score}</td>
                  <td>{p.correctCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="results-actions animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <Link href="/play" className="btn btn--primary btn--lg">Play Again</Link>
          <Link href="/leaderboard" className="btn btn--secondary btn--lg">Leaderboard</Link>
          <Link href="/" className="btn btn--ghost btn--lg">Home</Link>
        </div>
      </div>
    </main>
  );
}
