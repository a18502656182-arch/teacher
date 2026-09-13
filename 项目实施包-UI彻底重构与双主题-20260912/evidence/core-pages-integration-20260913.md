# TASK-17 首页、学生、作业核心页联调

日期：2026-09-13  
开始 HEAD：`af5b33e`

## 结论

TASK-12至TASK-14已经完成三张代表页的视图与控制器迁移，本任务没有重做页面。当前源码重新逐动作定位后，首页、学生、作业均已接入`ClassroomApp`的同一workspace数据和保存状态；旧`Dashboard`、`Students/MobileStudents`、`Homework/MobileHomework` DOM已退出，对应浮层使用共享Dialog、Drawer、Menu、SelectionBar和危险确认。

## 浏览器真实入口

在`http://localhost:3006/w/demo`只读演示数据中完成以下真实点击，不写数据库：

- 首页“日程跟进”→`?page=schedule`；“作业跟进”→`?page=homework`；“家校跟进”→`?page=records`；“听写批改”→`?page=dictation`。
- “全部学生”→`?page=students`；家庭入口进入独立家庭学习场景，页面明确不读取班级名册。
- 手机390×844：首页进入作业；学生名单行打开单学生Drawer并返回；作业任务打开“作业处理”Drawer。
- 演示模式的新增学生按钮禁用；名单操作菜单仍可查看导出入口，不显示伪保存成功。

## 写入、草稿与跨班

- 学生新增/编辑/追加/替换/批量和作业新增/编辑/删除/四态/跟进均通过页面controller调用workspace`updateData`；本地修改先写本机草稿并置dirty，服务器确认后才清理。
- 网络失败保留dirty与本机草稿，重试沿用服务器revision；409锁住后续保存并保留冲突草稿。只读和演示模式不调用写入。
- 联调发现作业编辑、删除、加入/移除跟进过去只按`task.id`匹配；当两班历史数据出现同ID时可能越班修改。现已提取`patchHomeworkTask`、`removeHomeworkTask`、`addHomeworkFollowStudents`、`removeHomeworkFollowStudent`，统一要求当前班唯一目标；同班重复ID拒绝歧义写入。
- 作业四态更新同样改为唯一目标索引；另一班学生ID和跟进对象继续被过滤。

## 验证

- 浏览器：桌面核心入口、学生菜单，390×844学生/作业Drawer和只读状态通过。
- `node --test tests/rendered-html.test.mjs tests/workbench-operations.test.mjs tests/workspace-operations.test.mjs`：58/58通过。
- `node --test tests/workbench-operations.test.mjs`：10/10通过，含跨班同ID和同班重复ID。
- `npm run lint`、`npm run qa:strict`通过；`npm test`生产构建、256/256自动化及认证集成通过。

未覆盖：正式账号的真实网络断线交互只能在隔离可写工作区或专门失败注入中验证；只读演示浏览器不会被当成写入成功证据。生产环境未操作。
