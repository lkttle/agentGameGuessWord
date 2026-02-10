# A2A Guess Word MVP Demo Runbook

## 1) 本地启动

1. 安装依赖：`npm install`
2. 生成 Prisma Client：`npm run prisma:generate`
3. 准备数据库并迁移：`npm run prisma:migrate`
4. 启动项目：`npm run dev`

## 2) 生成演示数据（对应 tasks 6.1）

1. 执行：`npm run seed:demo`
2. 命令会输出 `roomId` 与 `matchId`
3. 导出环境变量并运行联调脚本：
   - `export ROOM_ID=<roomId>`
   - `export MATCH_ID=<matchId>`
   - `npm run smoke:demo`

## 3) 三分钟演示建议（对应 tasks 6.2）

- 登录：访问 `/api/auth/login`
- 开局：创建房间并进入 RUNNING
- 对战：触发 `agent-round` 或 `human-move`
- 结果：展示 `/api/matches/:matchId/result`
- 增长：展示 `/api/leaderboard` 与 `/api/metrics/summary`

## 4) 部署前检查（对应 tasks 6.3）

- `APP_BASE_URL` 指向线上域名
- `SECONDME_OAUTH_REDIRECT_URI` 与 SecondMe 控制台一致
- 生产数据库可访问（`DATABASE_URL`）
- 部署后回归：登录、开局、结算、榜单、战报、指标
