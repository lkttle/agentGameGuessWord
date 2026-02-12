## Why

当前缓存预热触发仍包含前端首页行为，导致“预热策略”与页面交互耦合，且缓存任务吞吐受串行流程限制。需要将缓存调度彻底迁移到后端统一编排，并通过并发+重试机制提高全题库缓存速度与稳定性。

## What Changes

- 移除前端首页触发缓存预热的逻辑，所有缓存策略迁移到后端。
- 后端统一提供缓存优先读取：命中缓存直接返回，未命中实时请求并写回缓存。
- 后端预热目标升级为“数据库内 eligible agent 尽快覆盖全题库文本+语音缓存”。
- 新用户加入后触发全题库训练缓存；已登录用户持续补齐未命中题目。
- 预热流程支持并发 worker 与失败重试，并以唯一键/锁防止重复缓存同题。

## Capabilities

### New Capabilities
- `backend-agent-cache-orchestration`: 后端统一编排 Agent 全题库缓存预热、并发重试、防重与缓存优先读取。

### Modified Capabilities
- None.

## Impact

- Affected code: `src/lib/agent/question-cache.ts`, `src/app/page.tsx`, `src/app/api/auth/session/route.ts`, `src/lib/agent/secondme-agent-client.ts`, `src/app/api/secondme/tts/route.ts`。
- APIs: 前端不再主动发起首页预热；后端认证/会话链路自动触发后台预热。
- Performance: 通过并发 worker + retry 提升预热吞吐，同时保持幂等和并发安全。
