# 部署记录

## 2026-09-13：教师工作台UI重构最终受控包

- 状态：本地已生成、完成路径安全检查并解压验证；尚未上传或部署。
- Git业务源码提交：`45f72d7`。TASK-33后续仅修改包外文档与追踪文件，不改变本包运行源码。
- 文件：`classroom-deploy-teacher-workbench-ui-complete-20260913.tar.gz`；9,450,169字节。
- SHA-256：`1D3DC54F61098CE68EC01D48FD6767132A71AAC23463A19E8AF2206F67E3167B`。
- 白名单包含`.openai`、`app`、`build`、`db`、`drizzle`、`lib`、`public`、`worker`、`dist`及运行配置，共446个条目；`dist`来自当前已通过的`npm test`生产构建。
- 未包含项目文档、任务包、测试、脚本、报告、运行数据、数据库、`.env.local`、密钥、`node_modules`、`.next`或历史部署包。
- 归档成员绝对路径与上级跳转检查为0项风险，禁止成员检查为0项；独立临时目录解压成功，并确认`package.json`、`app/layout.tsx`、`app/w/[token]/ClassroomApp.tsx`、`dist/server/index.js`和听写WebP存在。
- 对应源码已通过生产构建、260/260自动化、认证集成、TypeScript、ESLint及115项严格QA。家庭教育不纳入TASK-30至33当前验收；本条不代表生产环境、真实网络或正式数据库验证。

## 2026-09-12：接收服务器源码导出，未执行部署

用户提供classroom-online-source.tar.gz，1,077,263字节，SHA-256 F2019A92C0E1CDB850DE1D790105CBE4DD82973645188244352841F0951E1E92。受检88个运行源码/资源/配置文件与0691aba对应文件一致（忽略换行差异），另有两份无引用旧CSS残留。证据支持服务器目录源码基线，不证明正在运行的构建及线上验收。无服务器写入、正式数据库操作或新部署包。

本文件只记录可核验的部署包、服务器操作和验证结果。“生成部署包”“上传文件”“Git 推送”“服务器完成部署”是四种不同状态，不得混写。

## 2026-09-12：校园插画全站构图重建包

- 状态：本地已生成、解压并校验；尚未上传或部署。
- Git业务源码提交：`0691abab3fe1a7819ea1d014fa801d4f37121d23`。
- 文件：`classroom-deploy-campus-rebuild-20260912.tar.gz`；6,604,961字节。
- SHA-256：`2D2D3B377955FC71C4FAC13125BF6146A086F4D6240D56DFE8C4965A78CDA4BE`。
- 包含受控部署源码、配置和已经验证的`dist`，共213个条目；在系统临时目录完成路径安全检查、解压和`dist/server/index.js`存在性检查。
- 未包含顶层`data`、数据库、`.env`、密钥、`node_modules`、报告、备份、对话恢复资料或项目资料包。
- 对应源码通过TypeScript、ESLint、生产构建、39/39自动化测试、认证集成和严格布局审计；严格审计覆盖19个模块与6种宽度，共115项结果、117张截图、0失败。真实浏览器在隔离数据中验证听写“保存并下一位”。
- 已知风险：生产构建仍有前端chunk超过500KB警告；部分历史页面继续使用兼容选择器。本条不代表服务器部署、线上视觉验收或正式数据库验证。

## 2026-09-11：校园全站样式清理包

- 状态：本地已生成并校验；尚未上传或部署。
- Git业务源码提交：`1fc83591cea14405b0a5a3b28fb8180c7df947c5`。
- 文件：`classroom-deploy-campus-ui-fullscan-20260911.tar.gz`；5,772,847字节。
- SHA-256：`A9903E7DC63EA2F61CF4C90A3689BD2220C8619B5CA9376C102F415DC4BE94E2`。
- 内容从该Git提交的受控部署文件和已验证的`dist`产物组成；解压检查共203个条目，核心源码、构建入口和校园插画存在。
- 未发现数据库、`.env`、密钥、`node_modules`、`.next`、测试报告、对话恢复资料或用户资料包。
- 本地验证继承该提交形成前的TypeScript、ESLint、生产构建、37项测试、认证集成及全站严格渲染结果；本条不代表服务器部署或线上验收。

## 2026-09-11：校园主题与听写包

- 文件：`classroom-deploy-campus-dictation-20260911.tar.gz`；5,564,753字节。
- SHA-256：`F80CDFAFC2EBB074587D9F5B7714AF5DE0A381F1D070381D7A21AB213EF46236`。
- 用户终端记录显示备份、Python解压和npm ci完成，随后明确报告已部署。安装报告24项依赖漏洞，本轮未强制自动修复。
- 浏览器线上可见插画和听写模块，但用户指出旧样式残留，不能认定全站视觉验收通过。
- 本轮全站清理仅在本地与临时数据库验证，未登录服务器、未重启服务、未发布新包；服务器版本与真实HTTPS手机网络验收仍待完成。

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
