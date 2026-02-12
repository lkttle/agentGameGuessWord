## Why

当前房间对战存在前后端职责混杂：前端本地控制题目与轮次，`human-move` 仍保留“玩家后自动串行多个 Agent”旧逻辑，导致回合轮转、题目一致性和超时行为容易出现语义冲突。为保证 4 人（及多人）轮转玩法稳定可预期，需要统一为“固定席位 + 单次单人回合 + 题目轮内一致”的执行模型。

## What Changes

- 重构房间回合编排逻辑，确保按席位固定顺序轮转（A→B→C→D→A）。
- 玩家与 Agent 的每次请求仅处理“当前轮到的单个参与者”，移除旧的跨参与者批处理逻辑。
- 将超时视为正式回合结果写入日志，保证回合推进与 UI 展示一致。
- 增加同一题目轮内的问题键（`questionKey`）一致性校验，拒绝过期或冲突作答。
- 在“整轮无人答对”时先揭晓答案，再切换新题；中途有人答对则立即换新题并轮到下一席位。
- 固定头像卡位顺序为 seat 顺序，避免因分数排序导致玩家栏跳动。

## Capabilities

### New Capabilities
- `room-turn-question-synchronization`: 规范房间固定席位轮转、20 秒超时推进、题目轮一致性校验、整轮揭晓与换题规则。

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `src/app/room/[roomId]/page.tsx`
  - `src/app/api/matches/[matchId]/human-move/route.ts`
  - `src/app/api/matches/[matchId]/agent-round/route.ts`
  - `src/lib/game/guess-word-engine.ts`
- APIs: `human-move` 与 `agent-round` 入参/执行语义将统一为“单参与者单回合”，移除冲突旧分支。
- Runtime semantics: 回合推进由“日志驱动 + 固定席位”统一，降低题目与作答错位风险。
