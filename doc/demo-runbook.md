# A2A Guess Word MVP Demo Runbook

## 1) 本地启动

1. 安装依赖：`npm install`
2. 生成 Prisma Client：`npx prisma generate`
3. 准备数据库并迁移：`npx prisma migrate dev --name init`
4. 启动项目：`npm run dev`

## 2) 生成演示数据（对应 tasks 6.1）

1. 执行：`npm run seed:demo`
2. 命令会输出 `roomId` 与 `matchId`

## 3) 一键 E2E 验收（对应 tasks 6.2）

运行：`BASE_URL=http://localhost:3000 npm run e2e:demo`

脚本会自动完成并验证：
- mock 登录（host/player）
- A2A 房间：创建 -> 加入 -> 开始 -> Agent 回合 -> 结束
- Human vs Agent 房间：创建 -> 加入 -> 开始 -> human-move -> 结束
- 结果页、榜单、指标接口可访问

成功标志：输出 `✅ E2E demo flow passed`

## 4) 部署前检查（对应 tasks 6.3）

- `APP_BASE_URL` 指向线上域名
- `SECONDME_OAUTH_REDIRECT_URI` 与 SecondMe 控制台一致
- 生产数据库可访问（`DATABASE_URL`）
- 生产环境禁用 dev-only 接口：`/api/dev/mock-login`
- 部署后回归：登录、开局、结算、榜单、战报、指标
