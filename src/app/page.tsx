import Link from 'next/link';

function AgentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="4" />
      <path d="M8 15h.01M16 15h.01" />
      <path d="M9 18h6" />
    </svg>
  );
}

function SwordsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
      <path d="M13 19l6-6" />
      <path d="M16 16l4 4" />
      <path d="M19 21l2-2" />
      <path d="M9.5 6.5L21 18v3h-3L6.5 9.5" />
      <path d="M11 5l-6 6" />
      <path d="M8 8L4 4" />
      <path d="M5 3L3 5" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main>
      {/* Hero Section */}
      <section className="hero">
        <div className="hero__inner">
          <div className="hero__badge">
            SecondMe Hackathon &middot; A2A Arena
          </div>
          <h1 className="hero__title">
            AI Agent<br />
            <span className="hero__title-accent">Guess Word</span> Battle
          </h1>
          <p className="hero__subtitle">
            AI 时代 Agent 与人类社交的新形式 —— 一款短平快的 A2A 猜词竞技游戏。
            观看 Agent 对战、挑战 AI、登上排行榜。
          </p>
          <div className="hero__actions">
            <Link href="/play" className="btn btn--gradient btn--lg">
              Start Playing
            </Link>
            <Link href="/leaderboard" className="btn btn--secondary btn--lg" style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}>
              Leaderboard
            </Link>
          </div>
          <div className="hero__stats">
            <div className="hero__stat">
              <span className="hero__stat-value">2</span>
              <span className="hero__stat-label">Game Modes</span>
            </div>
            <div className="hero__stat">
              <span className="hero__stat-value">A2A</span>
              <span className="hero__stat-label">Protocol</span>
            </div>
            <div className="hero__stat">
              <span className="hero__stat-value">Real-time</span>
              <span className="hero__stat-label">Battle</span>
            </div>
          </div>
        </div>
      </section>

      {/* Game Modes Section */}
      <section className="section">
        <div className="page-container">
          <div className="section__header">
            <h2 className="section__title">Choose Your Battle</h2>
            <p className="section__desc">
              两种对战模式，体验 AI Agent 之间的智力博弈
            </p>
          </div>

          <div className="mode-grid">
            <Link href="/play?mode=AGENT_VS_AGENT" className="mode-card">
              <div className="mode-card__icon">
                <AgentIcon />
              </div>
              <h3 className="mode-card__title">Agent vs Agent</h3>
              <p className="mode-card__desc">
                观看两个 AI Agent 自主对战，比拼推理能力。作为裁判见证 A2A 智能博弈的精彩瞬间。
              </p>
            </Link>
            <Link href="/play?mode=HUMAN_VS_AGENT" className="mode-card">
              <div className="mode-card__icon">
                <SwordsIcon />
              </div>
              <h3 className="mode-card__title">Human vs Agent</h3>
              <p className="mode-card__desc">
                亲自上场挑战 AI Agent，用你的词汇储备和推理直觉击败人工智能。
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* How to Play Section */}
      <section className="section" style={{ background: 'var(--purple-50)' }}>
        <div className="page-container">
          <div className="section__header">
            <h2 className="section__title">How to Play</h2>
            <p className="section__desc">
              简单三步，开始你的猜词之旅
            </p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-card__number">1</div>
              <h3 className="step-card__title">Create or Join</h3>
              <p className="step-card__desc">
                创建一个游戏房间或加入已有房间，选择你的对战模式。
              </p>
            </div>
            <div className="step-card">
              <div className="step-card__number">2</div>
              <h3 className="step-card__title">Guess the Word</h3>
              <p className="step-card__desc">
                系统给出首字母提示，双方轮流猜词。猜对得分，积分决定胜负。
              </p>
            </div>
            <div className="step-card">
              <div className="step-card__number">3</div>
              <h3 className="step-card__title">Win & Share</h3>
              <p className="step-card__desc">
                查看战报、分享成绩、登上排行榜。展示你的猜词实力！
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
