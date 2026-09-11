# 班主任工作台 Git 使用说明

Git 用来保存源码、文档和每次修改差异；它不会自动保存服务器数据库、环境密钥、部署包或完整聊天界面。

## 当前仓库

- 本地分支：`main`
- 默认远端：`github` → `https://github.com/a18502656182-arch/teacher.git`
- 分支关系：本地 `main` 跟踪 `github/main`
- 历史远端：`origin` → `git.chatgpt-team.site`，没有可用凭据，不作为默认推送目标
- GitHub 仓库当前为公开仓库，提交内容任何人都能读取
- 2026-07-31 后曾长期没有提交；2026-09-11 开始重新建立持续记录。

## 查看进度

```powershell
git status
git log -10 --oneline --decorate
git show --stat 最新提交号
```

如果 Git 提示目录所有者不安全，可在单条命令中使用：

```powershell
git -c safe.directory="E:/文档/Codex/小红书/班主任工作台网站" status
```

## 每次正常修改的记录顺序

1. 修改代码。
2. 完成相应测试。
3. 更新 `docs/CHANGELOG.md` 和 `docs/PROJECT_STATUS.md`。
4. 如果生成部署包或操作服务器，更新 `docs/DEPLOYMENT_LOG.md`。
5. 检查 `git diff` 和待提交文件，确认没有密钥、数据库、真实学生数据和压缩包。
6. 创建清晰提交并推送当前分支。

本地 `main` 已跟踪 `github/main`，正常情况下直接运行：

```powershell
git push
```

如需明确指定远端，可运行：

```powershell
git push github main
```

后续 Codex 会按 `AGENTS.md` 自动执行这套流程；如测试、敏感文件检查或远端推送失败，会明确报告，不会强行宣称完成。

## Git 推送与上线的区别

- `git push`：把源码和记录备份到代码远端。
- 上传部署包：只把文件送到服务器，还没有运行新版本。
- 解压、构建、重启：使服务器加载新代码。
- 线上验收：用真实电脑和手机确认运行结果。

只有最后一步验证完成后，`DEPLOYMENT_LOG.md` 才能写“已部署并验收”。

## 禁止提交的内容

- `.env.local` 或任何真实密码、密钥、访问令牌；
- `data/classroom.db` 及真实班级/学生数据；
- `*.tar.gz`、`*.zip`、`*.rar` 部署包或备份；
- `reports/`、对话恢复目录和本机临时日志；
- `node_modules`、`dist`、`.next` 等可重建产物。
