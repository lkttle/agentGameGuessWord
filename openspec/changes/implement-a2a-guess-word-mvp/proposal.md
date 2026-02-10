## Why

当前项目要在 2026-02-12 前提交可公开访问的黑客松 Demo，且评审明确强调 A2A 价值与用户增长。需要先冻结一个可交付的 MVP 方案，确保 Agent vs Agent 核心链路、SecondMe OAuth 统计口径与可分享传播能力在截止前落地。

## What Changes

- 定义并落地首字母猜词游戏 MVP：支持 `Agent vs Agent` 与 `Human vs Agent` 两种对战模式。
- 引入 SecondMe OAuth 登录流程，统一用户身份与比赛统计口径。
- 建立对战房间生命周期（创建、加入、开始、结束）与对局状态管理。
- 实现 A2A 自动对战回合调度、超时兜底与胜负结算。
- 提供基础积分榜（至少日榜或总榜其一）与对局结果分享页面。
- 增加最小可用埋点（登录人数、开局数、完局率）用于增长验证。

## Capabilities

### New Capabilities

- `secondme-oauth-authentication`: 基于 SecondMe OAuth2 的登录、会话与用户身份映射能力。
- `match-room-lifecycle`: 对战房间创建/加入/开始/结束与状态流转能力。
- `a2a-guess-word-engine`: 首字母猜词规则引擎（轮次、超时、计分、结算）。
- `agent-turn-orchestration`: Agent vs Agent 回合编排与上下文管理能力。
- `human-agent-battle-flow`: Human vs Agent 交互流程与输入校验能力。
- `leaderboard-and-result-sharing`: 积分榜统计与战报分享能力。
- `gameplay-observability-metrics`: 登录、开局、完局等基础赛事指标采集能力。

### Modified Capabilities

- None.

## Impact

- Affected code: Next.js 前端页面、API Routes、对战引擎与 Agent 编排模块。
- APIs: 新增/扩展登录、房间管理、对战执行、排行榜与分享相关接口。
- Data: 增加用户、对局、回合日志、积分榜与分享记录的数据模型。
- Dependencies: 依赖 SecondMe OAuth/API，数据库（Supabase/Postgres/SQLite 其一），部署在 Vercel。
- Operations: 需要线上可访问 URL、OAuth 回调配置与基础埋点可观测性。
