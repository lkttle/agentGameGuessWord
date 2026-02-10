import { RoomStatePollingPanel } from '@/components/RoomStatePollingPanel';

export default function HomePage() {
  return (
    <main>
      <h1>A2A 首字母猜词游戏（MVP）</h1>
      <p>已接入 SecondMe OAuth 与房间/对局基础接口。</p>
      <ul>
        <li>
          登录：<code>/api/auth/login</code>
        </li>
        <li>
          会话：<code>/api/auth/session</code>
        </li>
        <li>
          创建房间：<code>POST /api/rooms</code>
        </li>
      </ul>
      <RoomStatePollingPanel />
    </main>
  );
}
