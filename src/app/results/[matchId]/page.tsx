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
      <main>
        <h1>战报不存在</h1>
        <p>未找到对应对局结果。</p>
      </main>
    );
  }

  return (
    <main>
      <h1>对局战报</h1>
      <p>Match ID: {result.matchId}</p>
      <p>状态: {result.status}</p>
      <p>总回合: {result.totalRounds}</p>
      <h2>参与者表现</h2>
      <ul>
        {result.participants.map(
          (item: {
            participantId: string;
            displayName: string;
            participantType: string;
            score: number;
            correctCount: number;
          }) => (
            <li key={item.participantId}>
              {item.displayName}（{item.participantType}）- 分数 {item.score}，命中 {item.correctCount}
            </li>
          )
        )}
      </ul>
    </main>
  );
}
