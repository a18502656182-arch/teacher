# 部署记录

本文件只记录可核验的部署包、服务器操作和验证结果。“生成部署包”“上传文件”“Git 推送”“服务器完成部署”是四种不同状态，不得混写。

## 2026-09-09：期中百人审计修复包

- 状态：本地已生成并校验；服务器是否部署待确认。
- 文件：`classroom-deploy-midterm-audit-fixes-20260909.tar.gz`
- 大小：5,335,946 字节
- SHA-256：`F6D448BFDB59C9C02CC540AC7EC217688BF983A2F4941259ACDDFA20CCE1B016`
- 内容：`app`、`db`、`dist`、`drizzle`、`lib`、`worker` 及构建配置。
- 排除：`data`、`.env.local`、`node_modules`、报告、恢复资料。
- 本地验证：TypeScript、ESLint、构建、29 项测试、认证集成、静态和严格布局审计通过；解压及核心文件存在性通过。
- 历史目标目录：`/www/classroom`。
- 历史进程名：`classroom-web`。
- 注意：实际部署前必须再次核对服务器目录与进程，不以本记录代替线上检查。

## 2026-09-05：HTTP ID 兼容包

- 状态：本地已生成；现有记录未形成完整的服务器部署验收条目。
- 文件：`classroom-deploy-http-id-compat-20260905.tar.gz`
- 大小：5,322,590 字节
- SHA-256：`B650340EE46B4B7BD76AF1393EA608035B63C340F01DA759113E87E644E93133`
- 目的：避免 HTTP、旧 WebView 或受限浏览器缺少 `crypto.randomUUID()` 时，新增考勤等记录导致整个工作台白屏。

## 历史标准部署流程（执行前必须核对）

本地上传示例：

```powershell
scp "部署包绝对路径" root@服务器地址:/www/
```

服务器备份示例：

```bash
tar -czf /www/classroom-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /www classroom
```

解压、构建和重启示例：

```bash
tar -xzf /www/部署包名.tar.gz -C /www/classroom
cd /www/classroom
npm run build
pm2 restart classroom-web
pm2 status classroom-web
```

完成后必须补充：实际时间、执行人/任务、包哈希、备份文件、目标目录、构建结果、进程状态、电脑/手机验证地址和回滚方式。

## 新部署条目模板

```md
## YYYY-MM-DD：部署名称

- 环境：测试 / 生产
- 状态：计划 / 已上传 / 已部署 / 已回滚
- Git 提交：
- 部署包、大小、SHA-256：
- 备份文件：
- 目标目录与进程：
- 数据库/环境变量变更：
- 执行命令摘要：
- 电脑端验证：
- 手机端验证：
- 已知风险与回滚：
```
