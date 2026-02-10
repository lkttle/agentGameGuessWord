## Why

当前项目后端接口和对战链路已可用，但前端仍是最小占位页面，无法直接支撑演示阶段的“登录-开局-对战-结算-榜单-指标”完整操作。为确保在 2026-02-12 提交前形成可演示、可联调、可分享的用户界面，需要新增一个源码对齐的前端控制台与结果展示页。

## What Changes

- 新增 MVP 前端控制台页面，覆盖会话、房间、回合、结算、榜单、指标接口的可视化操作。
- 基于现有 API 实现端到端交互流：mock 登录/OAuth 跳转、创建/加入/开始/结束房间、执行 Agent/Human 回合。
- 重构结果页为可分享战报视图，展示参与者表现、关键元数据和回跳操作。
- 引入统一视觉样式（颜色、字体、卡片、按钮、响应式规则），并满足基本可访问性约束。

## Capabilities

### New Capabilities
- `frontend-game-control-center`: 提供一站式前端控制台，聚合核心 API 的可执行交互。
- `frontend-match-result-experience`: 提供可分享的战报体验，强化展示性与传播性。
- `frontend-design-system-alignment`: 将前端页面统一到约定设计系统与可用性规范。

### Modified Capabilities
- `leaderboard-and-result-sharing`: 补充前端结果页在分享和可视化层面的展示要求。

## Impact

- Affected code: `src/app/page.tsx`, `src/app/results/[matchId]/page.tsx`, `src/app/globals.css`, `src/components/*`
- APIs: 复用现有 `/api/auth/*`, `/api/rooms/*`, `/api/matches/*`, `/api/leaderboard`, `/api/metrics/summary`
- Dependencies: 无新增运行时依赖；使用现有 Next.js + React + TypeScript 栈
- Systems: 影响本地 demo 流程与线上演示体验，但不更改数据库模型和后端业务规则
