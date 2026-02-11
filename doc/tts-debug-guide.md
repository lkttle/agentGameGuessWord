# TTS 无声音排查指南

本项目已支持可开关的详细语音日志。

## 1. 开启调试

在环境变量里打开：

```env
SECONDME_TTS_DEBUG=1
NEXT_PUBLIC_TTS_DEBUG=1
```

- `SECONDME_TTS_DEBUG=1`：开启服务端 `/api/secondme/tts` 调试日志
- `NEXT_PUBLIC_TTS_DEBUG=1`：开启浏览器端 TTS 播放调试日志

## 2. 看哪些日志

### 服务端日志（Zeabur）

关键前缀：`[tts][api][requestId]`

常见事件：

- `request_received`：收到了前端 TTS 请求
- `participant_resolved`：解析到的 participant 对应 userId（确认是不是 agent 本人）
- `missing_access_token`：目标 user 没有 token（最常见无声原因）
- `refresh_token_start/success/failed`：token 刷新流程
- `generate_tts_start/success`：已成功调用 SecondMe TTS
- `generate_tts_failed`：SecondMe 接口报错（会带 detail）

### 前端日志（浏览器 DevTools Console）

关键前缀：`[tts][client]`

常见事件：

- `new_logs_detected` / `queue_push`：检测到新 agent 回复并入队
- `reveal_next`：开始展示并播放当前 agent
- `request_start` / `request_success`：调用 `/api/secondme/tts`
- `audio_play_start`：拿到 URL 并开始播放
- `audio_play_rejected`：浏览器拦截自动播放（用户未交互、策略限制）
- `audio_onerror`：音频 URL 不可播放或跨域问题
- `reveal_tts_result played=false`：本条最终播放失败

## 3. 常见问题与解决

### A. `missing_access_token`

说明 agent 对应用户没有有效 token。

处理：

1. 让该 agent 所属用户重新登录（拿到 `voice` scope）
2. 确认 participant 绑定了正确的 `userId`

### B. `generate_tts_failed`

说明 SecondMe TTS 接口返回错误。

处理：

1. 检查 app scope 是否包含 `voice`
2. 检查 token 是否过期且 refresh 可用
3. 查看 `detail` 错误信息定位上游原因

### C. `audio_play_rejected`

说明浏览器自动播放策略拦截。

处理：

1. 让用户先点击页面任意交互（输入/发送按钮）
2. 确保页面不是后台标签页
3. 重试播放（系统已内置重试）

### D. `audio_onerror`

说明返回 URL 有效性或可访问性问题。

处理：

1. 在浏览器 Network 查看音频 URL 响应码
2. 检查是否有跨域/防盗链限制
3. 检查 URL 是否过期太快

### E. Network 出现 `net::ERR_BLOCKED_BY_ORB`

说明浏览器拦截了跨域媒体资源（常见于第三方音频直链）。

处理：

1. 保持 `SECONDME_TTS_PROXY_AUDIO=1`（默认开启）
2. 观察后端日志是否出现 `proxy_audio_fetch_success`
3. 前端 `request_success` 后，`url` 应该是 `data:audio/...;base64,...` 开头
4. 若仍失败，检查是否有 `proxy_audio_too_large` 或 `proxy_audio_fetch_failed`

## 4. 关闭调试

排查完成后，把环境变量恢复：

```env
SECONDME_TTS_DEBUG=0
NEXT_PUBLIC_TTS_DEBUG=0
```
