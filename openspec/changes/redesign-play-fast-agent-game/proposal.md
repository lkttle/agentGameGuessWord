## Why

当前 `play` 流程存在明显的启动摩擦（手动填房间 ID、手动填显示名称）和玩法冗余（观战导向偏重），不符合年轻用户对“秒开局、快反馈”的游戏体验预期。项目处于 A2A 黑客松冲刺阶段，需要将玩法重心切到“登录即战斗 + 多 Agent 高密度对局”，提升开局率、完局率与传播效率。

## What Changes

- 重构 `play` 页入口为“短平快”模式，移除手动输入房间 ID 与显示名称的首屏依赖。
- 使用已登录账户信息作为默认玩家身份展示，省去手动命名流程。
- 弱化并逐步替代“观战”心智：登录用户默认可使用自身 Agent 直接参战。
- 支持玩家与 Agent 对战，同时支持“玩家与自己的 Agent”训练/对练场景。
- 将对局形态从固定 1v1 扩展为可配置的多 Agent 参战模式（例如 1vN、Agent 混战）。
- 调整房间与对战流程文案和交互，将“创建并填写”改为“选择模式并立即开战”。

## Capabilities

### New Capabilities

- `fast-play-entry-flow`: 提供免手动房间号与免手动昵称输入的极速开局入口。
- `account-bound-player-identity`: 以登录账户信息作为玩家默认显示身份并贯穿对局。
- `self-agent-direct-participation`: 登录用户可直接调用自身 Agent 作为参战方，替代观战导向。
- `flexible-battle-mode-selection`: 支持玩家 vs 平台 Agent、玩家 vs 自身 Agent 等模式切换。
- `multi-agent-match-topology`: 支持非 1v1 的多 Agent 对局编排、参战管理与结算基础约束。

### Modified Capabilities

- None.

## Impact

- Affected code: `src/app/play/page.tsx`、`src/app/room/[roomId]/page.tsx`、`src/components/Navbar.tsx`、相关样式与交互逻辑。
- APIs: `src/app/api/rooms/route.ts`、`src/app/api/rooms/[roomId]/join/route.ts`、`src/app/api/rooms/[roomId]/start/route.ts`、`src/app/api/matches/*` 相关接口需支持自动身份注入与多参战方。
- Game orchestration: `src/lib/agent/orchestrator.ts`、`src/lib/game/guess-word-engine.ts`、`src/lib/room/room-state.ts` 需扩展多 Agent 回合与结算语义。
- Data/state: 对房间参与者模型、对局模式字段、Agent 归属关系与状态轮询结构提出新增或调整需求。
- Product/ops: 玩法文案、引导路径与埋点口径需同步更新（重点关注开局耗时、开局率、完局率）。
