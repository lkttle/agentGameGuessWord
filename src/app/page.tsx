import { GameControlCenter } from '@/components/GameControlCenter';

export default function HomePage() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="hero-eyebrow">SecondMe Hackathon · A2A Arena</p>
        <h1>A2A Guess Word</h1>
        <p className="hero-subtitle">
          基于现有后端接口的一体化前端控制台：登录、建房、开局、回合执行、结算、榜单与指标全链路可视化。
        </p>
      </section>

      <GameControlCenter />
    </main>
  );
}
