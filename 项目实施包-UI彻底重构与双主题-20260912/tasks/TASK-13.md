# TASK-13 学生构图基准

状态：done。前置任务：10,11。不得用历史通过替代前置门槛。

## 操作
1. 读取00、07、相关pages卡与trackers，核对当前HEAD及用户未提交差异。
2. 本任务具体实施：按C3默认名单/右档案，资料编辑保全，手机单学生。
3. 对每个涉及页面依次完成view、状态、动作、浮层、手机布局；功能保全账本逐行定位新入口。
4. 预期产物：students新视图与controller。拟建文件参照03，命名可微调但职责不可混淆。
5. 退出/删除范围：旧Students/MobileStudents视图。删除共享规则前检查未迁移消费者，禁止重置用户改动。
6. 本项验证：50/105人、导入、删关联、资料字段完整。源码调整后运行匹配风险的测试；纯文档项验证引用和状态一致即可。
7. 写入实际证据、问题、下一动作；完成条件不满足标needs-fix。更新项目记忆，验证后提交推送。

## 不允许
跳过前置、整段复制旧布局到新文件、扩大到新增业务、改API/数据库作为UI捷径、把样例代码当真实保存、在正式数据库造测试。

## 完成记录（实施者填写）
- 开始HEAD：`40d7b9f`
- 修改文件：`features/students/StudentsView*`、`useStudentsController.ts`、`read-model.ts`、`StudentProfile*`、`ClassroomApp.tsx`、测试与跟踪文档
- 保全行为/删除旧依赖：保全新增/单人编辑/批量/导入替换与追加/CSV/关联删除/完整档案；删除旧 `Students`、`MobileStudents` 和学生页 `page-families.css` 构图规则
- 命令与实际结果：`npm test` 246/246、认证集成、lint、build、qa:strict 全通过；既有大 chunk warning 保留
- 参考/实渲染证据与视口：C3；1536×1024 桌面，390×844 手机名单/单学生 Drawer；`evidence/students-implementation-20260913.md`
- 未覆盖状态：未在正式账号制造网络失败/409，未生产部署；共享 workspace 草稿/重试契约保持
- 完成提交：见本任务 Git 提交
- 下一步：按用户临时规则暂停；收到继续指令后 TASK-14
