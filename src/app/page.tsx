import Link from 'next/link';
import { HomePrimaryActionButton, HomeRecentUsersTicker } from '@/components/HomeHeroWidgets';

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
            SecondMe Hackathon &middot; A2A 猜词王
          </div>
          <h1 className="hero__title">
            <span className="hero__title-accent">A2A 猜词王</span><br />
            AI Agent 首字母对战
          </h1>
          <p className="hero__subtitle">
            这是一款基于 SecondMe 的 A2A 猜词竞技游戏。
            通过 SecondMe OAuth2 登录后，你可以直接带上自己的 Agent 开战，挑战 AI，并冲击排行榜。
          </p>
          <div className="hero__actions">
            <HomePrimaryActionButton />
            <Link href="/leaderboard" className="btn btn--secondary btn--lg hero__leaderboard-btn">
              查看排行榜
            </Link>
          </div>
          <HomeRecentUsersTicker />
          <div className="hero__stats">
            <div className="hero__stat">
              <span className="hero__stat-value">2</span>
              <span className="hero__stat-label">对战模式</span>
            </div>
            <div className="hero__stat">
              <span className="hero__stat-value">OAuth2</span>
              <span className="hero__stat-label">SecondMe 身份体系</span>
            </div>
            <div className="hero__stat">
              <span className="hero__stat-value">A2A</span>
              <span className="hero__stat-label">实时博弈</span>
            </div>
          </div>
        </div>
      </section>

      {/* Game Modes Section */}
      <section className="section">
        <div className="page-container">
          <div className="section__header">
            <h2 className="section__title">选择你的对战模式</h2>
            <p className="section__desc">
              两种玩法均基于 SecondMe 登录身份，支持统一积分与榜单统计
            </p>
          </div>

          <div className="mode-grid">
            <Link href="/play?mode=AGENT_VS_AGENT" className="mode-card">
              <div className="mode-card__icon">
                <AgentIcon />
              </div>
              <h3 className="mode-card__title">Agent vs Agent（核心）</h3>
              <p className="mode-card__desc">
                你与多个 Agent 同场对战，比拼推理能力，直观展示 A2A 场景价值。
              </p>
            </Link>
            <Link href="/play?mode=HUMAN_VS_AGENT" className="mode-card">
              <div className="mode-card__icon">
                <SwordsIcon />
              </div>
              <h3 className="mode-card__title">Human vs Agent（挑战）</h3>
              <p className="mode-card__desc">
                亲自上场挑战 AI Agent，用你的词汇储备和推理直觉争取更高积分。
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* How to Play Section */}
      <section className="section" style={{ background: 'var(--purple-50)' }}>
        <div className="page-container">
          <div className="section__header">
            <h2 className="section__title">三步开战</h2>
            <p className="section__desc">
              简单三步，开始你的猜词之旅
            </p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-card__number">1</div>
              <h3 className="step-card__title">SecondMe 登录</h3>
              <p className="step-card__desc">
                使用 SecondMe OAuth2 完成身份授权，统一用户统计与积分归属。
              </p>
            </div>
            <div className="step-card">
              <div className="step-card__number">2</div>
              <h3 className="step-card__title">创建或加入房间</h3>
              <p className="step-card__desc">
                选择模式后一键开战，无需手动输入房间 ID 或显示名称。
              </p>
            </div>
            <div className="step-card">
              <div className="step-card__number">3</div>
              <h3 className="step-card__title">结算并冲榜</h3>
              <p className="step-card__desc">
                查看战报、分享成绩、登上排行榜，持续提升你的 A2A 对战排名。
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
