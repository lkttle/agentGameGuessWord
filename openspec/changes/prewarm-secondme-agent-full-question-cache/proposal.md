## Why

当前对局在 `room` 中大量依赖实时调用 SecondMe Chat/TTS，导致开局后首轮和换题阶段明显卡顿，且 Agent 语音播放稳定性受实时链路波动影响。需要把“Agent 对题库的答复与语音”前置缓存，尽量把耗时从对局时段搬到首页和登录时段，提升实时交互流畅度。

## What Changes

- 新增 Agent-题目缓存能力：对每个已登录 SecondMe Agent 与题库题目建立唯一缓存，保存文本答复与语音结果。
- 新增首页触发的全量预热流程：用户进入首页后，后台优先为“已登录且可用 token 的 SecondMe 账号”批量补齐缓存。
- 新增新用户登录后即时预热：OAuth 回调成功后立即触发该用户的题库缓存任务。
- 对局 Agent 回合改为“缓存优先、实时兜底”：命中缓存直接返回，未命中再调用 SecondMe SDK 并回写缓存。
- 优化题目抽取随机性：在现有随机基础上加入“近期去重抑制”，降低短时间内重复题概率。

## Capabilities

### New Capabilities
- `secondme-agent-full-question-cache`: 为 SecondMe Agent 建立题库级文本+语音缓存，并支持首页/登录触发预热与对局缓存优先读取。

### Modified Capabilities
- `pinyin-question-generation-api`: 题目生成增加近期重复抑制策略，在可选范围内尽量避免连续重复题。

## Impact

- Affected code: `src/lib/agent/*`、`src/app/api/auth/callback/route.ts`、`src/app/page.tsx`、`src/app/api/questions/generate/route.ts`、`src/lib/game/pinyin-question-bank.ts`、`src/app/api/matches/*`。
- APIs: 新增预热触发 API；Agent 回合链路增加缓存读取与回写逻辑。
- Data model: 新增 Agent-题目缓存表（文本、语音、状态、去重键）。
- Performance: 将高耗时 SecondMe Chat/TTS 计算前移到后台预热，减少房间实时等待。
