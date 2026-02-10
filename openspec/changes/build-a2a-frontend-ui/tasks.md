## 1. OpenSpec artifacts

- [x] 1.1 编写 proposal，明确前端控制台与结果页目标
- [x] 1.2 编写 specs（控制台、战报体验、设计系统对齐）
- [x] 1.3 编写 design，确定实现路径与边界

## 2. Frontend control center

- [x] 2.1 新增 `GameControlCenter` 组件并接入会话/房间/回合/结算接口
- [x] 2.2 增加动作前置校验与错误提示，避免无效请求
- [x] 2.3 首页替换为 Hero + 控制台布局

## 3. Result page and style system

- [x] 3.1 重构结果页为结构化战报布局（元信息 + 表格 + 快捷操作）
- [x] 3.2 重写 `globals.css`，引入统一设计 token 与组件样式
- [x] 3.3 增加响应式与可访问性基线（focus/reduced-motion/contrast）

## 4. Verification

- [x] 4.1 执行 typecheck 并修复类型问题
- [x] 4.2 执行 lint 并修复阻断项
- [ ] 4.3 手工走通最小前端联调链路并记录结果
