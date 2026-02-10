# A2A Guess Word 后端接口文档（本地优先）

> 版本：MVP（当前仓库实现）
> 
> 目的：交付给前端 Agent，优先在本地完成完整交互联调，再进入线上部署。

---

## 1. 本地优先联调指南（必须先跑通）

### 1.1 启动依赖

1. 启动 PostgreSQL（本地）

```bash
brew services start postgresql@16
```

2. 准备 Prisma 数据库结构

```bash
# Prisma 默认读取 .env，因此请确保 DATABASE_URL 可用
grep '^DATABASE_URL=' .env.local > .env
npx prisma migrate dev --name init
```

3. 启动服务

```bash
npm run dev
```

### 1.2 一键全链路验收（推荐）

```bash
BASE_URL=http://localhost:3000 npm run e2e:demo
```

成功标志：终端输出 `✅ E2E demo flow passed`

该脚本会完整覆盖：
- mock 登录（host/player）
- A2A：创建房间 -> 加入 -> 开始 -> agent 回合 -> 结算
- Human vs Agent：创建房间 -> 加入 -> 开始 -> human move -> 结算
- 验证结果页、榜单、指标接口

---

## 2. 基础约定

- Base URL：`http://localhost:3000`
- API 前缀：`/api`
- 鉴权：`HttpOnly Cookie Session`
  - Session Cookie：`a2a_session`
  - OAuth State Cookie：`a2a_oauth_state`
- 返回格式：JSON（OAuth 回调为重定向）

---

## 3. 枚举定义（前端建议固化）

### 3.1 GameMode
- `AGENT_VS_AGENT`
- `HUMAN_VS_AGENT`

### 3.2 RoomStatus
- `WAITING`
- `RUNNING`
- `FINISHED`

### 3.3 MatchStatus
- `RUNNING`
- `FINISHED`

### 3.4 ParticipantType
- `HUMAN`
- `AGENT`

### 3.5 LeaderboardPeriod
- `DAILY`
- `ALL_TIME`

---

## 4. 鉴权接口

### 4.1 `GET /api/auth/login`
- 说明：跳转 SecondMe OAuth 授权页。
- 鉴权：无。
- 返回：302 重定向。

### 4.2 `GET /api/auth/callback?code=...&state=...`
- 说明：OAuth 回调（换 token、拉用户信息、落用户、写 session）。
- 成功：302 到 `/`
- 失败：302 到 `/?auth_error=...`

### 4.3 `GET /api/auth/session`
- 说明：获取当前登录会话。
- 鉴权：有会话 cookie。
- `200`：

```json
{
  "authenticated": true,
  "user": {
    "id": "cuid",
    "secondmeUserId": "xxx",
    "name": "xxx",
    "email": "xxx",
    "avatarUrl": "xxx",
    "route": "xxx"
  }
}
```

- `401`：

```json
{ "authenticated": false }
```

### 4.4 `POST /api/auth/logout`
- 说明：清除 session。
- `200`：

```json
{ "ok": true }
```

### 4.5 `POST /api/dev/mock-login`（仅开发环境）
- 说明：本地联调免 OAuth 登录。
- 生产环境：404。
- 请求：

```json
{
  "secondmeUserId": "demo-host",
  "name": "Demo Host",
  "email": "host@example.com"
}
```

- `200`：

```json
{
  "ok": true,
  "user": { "id": "...", "secondmeUserId": "..." }
}
```

- `400`：`secondmeUserId is required`

### 4.6 `DELETE /api/dev/mock-login`（仅开发环境）
- 说明：清理 mock session。
- `200`：`{ "ok": true }`

---

## 5. 房间与对局管理接口

### 5.1 `POST /api/rooms`
- 说明：创建房间。
- 鉴权：需要。
- 请求：

```json
{
  "mode": "AGENT_VS_AGENT",
  "displayName": "Agent Alpha"
}
```

- 规则：
  - `AGENT_VS_AGENT` 下，房主 participant 自动设为 `AGENT`
  - `HUMAN_VS_AGENT` 下，房主 participant 自动设为 `HUMAN`

- `200`：

```json
{
  "room": {
    "id": "roomId",
    "mode": "AGENT_VS_AGENT",
    "status": "WAITING",
    "hostUserId": "userId",
    "participants": []
  }
}
```

- 错误：
  - `401 Unauthorized`
  - `400 Invalid mode`

### 5.2 `POST /api/rooms/:roomId/join`
- 说明：加入房间。
- 鉴权：需要。
- 请求：

```json
{
  "participantType": "AGENT",
  "displayName": "Agent Beta"
}
```

- `200`：

```json
{ "participant": { "id": "...", "roomId": "..." } }
```

- 错误：
  - `401 Unauthorized`
  - `404 Room not found`
  - `409 Room is not joinable`

### 5.3 `POST /api/rooms/:roomId/start`
- 说明：开局，房间 `WAITING -> RUNNING`，创建 match。
- 鉴权：需要（且必须 host）。
- `200`：

```json
{
  "room": { "id": "...", "status": "RUNNING" },
  "match": { "id": "matchId", "status": "RUNNING" }
}
```

- 错误：
  - `401 Unauthorized`
  - `403 Only host can start room`
  - `404 Room not found`
  - `400 At least two participants required`
  - `409 Invalid room status transition`

### 5.4 `POST /api/rooms/:roomId/finish`
- 说明：结算，房间 `RUNNING -> FINISHED`，match `FINISHED`，同步榜单与指标。
- 鉴权：需要（且必须 host）。
- 请求：

```json
{
  "winnerUserId": "userId",
  "totalRounds": 1
}
```

- `200`：

```json
{
  "room": { "id": "...", "status": "FINISHED" },
  "match": { "id": "...", "status": "FINISHED", "winnerUserId": "..." }
}
```

- 错误：
  - `401 Unauthorized`
  - `403 Only host can finish room`
  - `404 Room not found`
  - `409 Invalid room status transition`

### 5.5 `GET /api/rooms/:roomId/state`
- 说明：房间轮询接口（含 participants、match、最近 roundLogs）。
- 鉴权：需要。
- `200`：

```json
{
  "room": {
    "id": "...",
    "participants": [],
    "match": {
      "id": "...",
      "roundLogs": []
    }
  }
}
```

- 错误：
  - `401 Unauthorized`
  - `404 Room not found`

---

## 6. 对战回合接口

### 6.1 `POST /api/matches/:matchId/agent-round`
- 说明：执行一轮 A2A（两名 agent 依次出招）。
- 鉴权：需要（且必须 host）。
- 请求：

```json
{
  "targetWord": "apple",
  "roundIndex": 1
}
```

- `200`：

```json
{
  "roundIndex": 1,
  "hint": "a____",
  "turns": [
    {
      "participantId": "p1",
      "guessWord": "agent",
      "usedFallback": true,
      "attempts": 1,
      "isCorrect": false,
      "scoreDelta": 0,
      "normalizedGuess": "agent",
      "normalizedTarget": "apple",
      "timedOut": true
    }
  ]
}
```

- 错误：
  - `401 Unauthorized`
  - `403 Only host can trigger agent round`
  - `404 Match not found`
  - `400 targetWord is required`
  - `400 At least 2 agent participants required`

### 6.2 `POST /api/matches/:matchId/human-move`
- 说明：人类出招，若未猜中可触发一手 agent 反击。
- 鉴权：需要。
- 请求：

```json
{
  "participantId": "humanParticipantId",
  "agentParticipantId": "agentParticipantId",
  "targetWord": "angle",
  "guessWord": "apple",
  "roundIndex": 1
}
```

- `200`：

```json
{
  "roundIndex": 1,
  "human": {
    "participantId": "...",
    "guessWord": "apple",
    "result": {
      "isCorrect": false,
      "scoreDelta": 0,
      "normalizedGuess": "apple",
      "normalizedTarget": "angle",
      "timedOut": false
    }
  },
  "agent": {
    "participantId": "...",
    "guessWord": "agent",
    "usedFallback": true,
    "result": {
      "isCorrect": false,
      "scoreDelta": 0,
      "normalizedGuess": "agent",
      "normalizedTarget": "angle",
      "timedOut": false
    }
  }
}
```

- 错误：
  - `401 Unauthorized`
  - `404 Match not found`
  - `409 Match is not running`
  - `400 guessWord and targetWord are required`
  - `400 Invalid guess format`
  - `403 Invalid human participant or out-of-turn action`

### 6.3 `GET /api/matches/:matchId/result`
- 说明：获取战报数据（分享页接口）。
- 鉴权：当前无需。
- `200`：

```json
{
  "matchId": "...",
  "roomId": "...",
  "status": "FINISHED",
  "winnerUserId": "...",
  "startedAt": "ISO",
  "endedAt": "ISO",
  "totalRounds": 1,
  "participants": [
    {
      "participantId": "...",
      "displayName": "...",
      "participantType": "AGENT",
      "score": 12,
      "correctCount": 1
    }
  ]
}
```

- 错误：`404 Match not found`

---

## 7. 榜单与指标接口

### 7.1 `GET /api/leaderboard?period=daily|all_time&limit=20`
- 说明：获取榜单。
- 鉴权：当前无需。
- 参数：
  - `period=daily` -> 日榜
  - 其他值或不传 -> 总榜
  - `limit` 取值范围 `1~100`，默认 `20`

- `200`：

```json
{
  "period": "ALL_TIME",
  "entries": [
    {
      "id": "...",
      "userId": "...",
      "period": "ALL_TIME",
      "dateKey": "ALL_TIME",
      "score": 24,
      "wins": 2,
      "losses": 0,
      "user": {
        "id": "...",
        "secondmeUserId": "...",
        "name": "...",
        "avatarUrl": "..."
      }
    }
  ]
}
```

### 7.2 `GET /api/metrics/summary?from=ISO&to=ISO`
- 说明：指标汇总（登录数、开局数、完局数、完局率）。
- 鉴权：需要。
- `200`：

```json
{
  "loginCount": 10,
  "startedMatchCount": 8,
  "completedMatchCount": 6,
  "completionRate": 0.75
}
```

- 错误：`401 Unauthorized`

---

## 8. 前端对接注意事项

1. 会话依赖 Cookie：
   - 同域请求自动携带；若跨域需 `credentials: 'include'`（当前服务未做跨域 CORS 配置）。

2. 本地开发建议：
   - 先用 `/api/dev/mock-login` 跑通 UI，再接 OAuth。

3. 房间状态机严格：
   - 只能 `WAITING -> RUNNING -> FINISHED`，违规会 `409`。

4. 回合判定规则：
   - 猜词会 `trim + lowerCase`
   - 正确得分：`10 + max(5 - attemptIndex, 0)`

5. 当前 Agent 行为：
   - 使用 fallback 客户端（占位策略），后续可替换真实模型调用。

---

## 9. 推荐前端最小联调顺序（手动）

1. `POST /api/dev/mock-login`（host）
2. `POST /api/dev/mock-login`（player，另一个会话）
3. `POST /api/rooms`
4. `POST /api/rooms/:roomId/join`
5. `POST /api/rooms/:roomId/start`
6. 对战：
   - A2A：`POST /api/matches/:matchId/agent-round`
   - 人机：`POST /api/matches/:matchId/human-move`
7. `POST /api/rooms/:roomId/finish`
8. 查询：
   - `GET /api/matches/:matchId/result`
   - `GET /api/leaderboard`
   - `GET /api/metrics/summary`

