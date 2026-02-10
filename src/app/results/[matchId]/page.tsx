import Link from 'next/link';

interface MatchResultPageProps {
  params: Promise<{ matchId: string }>;
}

async function getResult(matchId: string) {
  const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/matches/${matchId}/result`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export default async function MatchResultPage({ params }: MatchResultPageProps) {
  const { matchId } = await params;
  const result = await getResult(matchId);

  if (!result) {
    return (
      <main className="result-page">
        <section className="result-header">
          <h1>战报不存在</h1>
          <p>未找到对应对局结果，请确认 `matchId` 是否正确。</p>
        </section>
      </main>
    );
  }

  const topParticipant = [...result.participants].sort(
    (a, b) => b.score - a.score || b.correctCount - a.correctCount
  )[0];

  return (
    <main className="result-page">
      <section className="result-header">
        <h1>对局战报</h1>
        <p>分享你的 A2A 猜词表现，展示 Agent 推理与对战结果。</p>
      </section>

      <section className="meta-grid" aria-label="result metadata">
        <article className="meta-item">
          <span>Match ID</span>
          <strong>{result.matchId}</strong>
        </article>
        <article className="meta-item">
          <span>Room ID</span>
          <strong>{result.roomId}</strong>
        </article>
        <article className="meta-item">
          <span>状态</span>
          <strong>{result.status}</strong>
        </article>
        <article className="meta-item">
          <span>总回合</span>
          <strong>{result.totalRounds}</strong>
        </article>
      </section>

      <section className="meta-grid" aria-label="winner metadata">
        <article className="meta-item">
          <span>最高分</span>
          <strong>{topParticipant?.displayName ?? '-'}</strong>
        </article>
        <article className="meta-item">
          <span>胜者用户</span>
          <strong>{result.winnerUserId ?? '未指定'}</strong>
        </article>
        <article className="meta-item">
          <span>开始时间</span>
          <strong>{new Date(result.startedAt).toLocaleString('zh-CN')}</strong>
        </article>
        <article className="meta-item">
          <span>结束时间</span>
          <strong>{result.endedAt ? new Date(result.endedAt).toLocaleString('zh-CN') : '进行中'}</strong>
        </article>
      </section>

      <section className="participant-table" aria-label="participants performance">
        <table>
          <thead>
            <tr>
              <th>参与者</th>
              <th>类型</th>
              <th>分数</th>
              <th>命中次数</th>
            </tr>
          </thead>
          <tbody>
            {result.participants.map(
              (item: {
                participantId: string;
                displayName: string;
                participantType: string;
                score: number;
                correctCount: number;
              }) => (
                <tr key={item.participantId}>
                  <td>{item.displayName}</td>
                  <td>{item.participantType}</td>
                  <td>{item.score}</td>
                  <td>{item.correctCount}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </section>

      <section className="result-actions">
        <Link className="btn-primary" href="/">
          返回控制台
        </Link>
        <a className="btn-secondary" href={`/api/matches/${result.matchId}/result`}>
          查看 JSON
        </a>
      </section>
    </main>
  );
}
