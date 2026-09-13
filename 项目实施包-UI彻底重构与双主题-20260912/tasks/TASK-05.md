# TASK-05 抽取保存与草稿操作

状态：done。前置任务：03,04。不得用历史通过替代前置门槛。

## 操作
1. 读取00、07、相关pages卡与trackers，核对当前HEAD及用户未提交差异。
2. 本任务具体实施：保留save和commitWorkspace两语义、ref、队列、revision；封装权限/离开守卫。
3. 对每个涉及页面依次完成view、状态、动作、浮层、手机布局；功能保全账本逐行定位新入口。
4. 预期产物：共享workspace controller。拟建文件参照03，命名可微调但职责不可混淆。
5. 退出/删除范围：原操作逻辑在接线验证后删除。删除共享规则前检查未迁移消费者，禁止重置用户改动。
6. 本项验证：一般编辑/听写失败/409/提交期间新编辑/只读。源码调整后运行匹配风险的测试；纯文档项验证引用和状态一致即可。
7. 写入实际证据、问题、下一动作；完成条件不满足标needs-fix。更新项目记忆，验证后提交推送。

## 不允许
跳过前置、整段复制旧布局到新文件、扩大到新增业务、改API/数据库作为UI捷径、把样例代码当真实保存、在正式数据库造测试。

## 完成记录（实施者填写）
- 开始HEAD：`c944929`
- 修改文件：`workspace/useWorkspaceController.ts`、`workspace/operations.ts`、`ClassroomApp.tsx`、`tests/workspace-operations.test.mjs`、`tests/rendered-html.test.mjs`。
- 保全行为/删除旧依赖：工作区加载、同revision草稿恢复、900ms自动保存、dirty与beforeunload、排队保存、乐观revision、409锁定、载入最新版本、备份取待提交听写、一般保存与听写确认提交两种语义均进入共享controller；主组件删除相应状态、ref、effect和操作闭包。未计入正式结果的听写草稿阻止退出；演示模式的一般写入口修正为真正只读。
- 命令与实际结果：`npx tsc --noEmit --pretty false --incremental false`通过；全量ESLint通过；聚焦46/46通过；完整`npm test`的生产构建、220/220自动化测试和认证集成通过。仍有既有500KB以上chunk警告。
- 参考/实渲染证据与视口：隔离桌面浏览器实际完成E7到期正式账号只读、E8断网保留/恢复重试、E9双标签真实409；另验证`/w/demo`点击考勤状态不再改变数据。控制器没有DOM/CSS改动，本项不冒充视觉验收。详见`../evidence/workspace-controller-20260913.md`。
- 未覆盖状态：页面自己的“已保存”提示仍有先于服务器确认的旧实现，需在对应页面迁移时逐项改为操作确认语义；物理手机、弱网、HTTPS和线上环境未验证。
- 完成提交：`7617c9f`
- 下一步：完成TASK-06主题契约，再完成TASK-07基础控件；随后按依赖进入浮层、隔离和标杆页面。
