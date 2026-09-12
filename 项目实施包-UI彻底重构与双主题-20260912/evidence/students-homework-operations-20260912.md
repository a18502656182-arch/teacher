# 学生与作业：操作核验及迁移前置

开始HEAD：ac4d171；工作区原本干净。此次只提取数据操作，不替换DOM/CSS，不代表学生、作业新页面完成。

## 已实际接入

`features/students/operations.ts:applyStudentBatch` 被 Students.applyBatchEdit 与 MobileStudents.applyStudentBatchEdit 共用。
`features/homework/operations.ts:applyHomeworkStatuses` 被 Homework.setStatus/bulkSet 和 MobileHomework.setStudentHomeworkStatus/batchSetHomeworkStatus 共用。
保留原字段规则、父层updateData调用、反馈和选择清理时点。学生批量两端原来均不清选中，此次没有顺带改变；作业两端仍在本地应用后清选中，不能把它说成服务器确认后清空。

## 逐动作源码核验

以下定位以ClassroomApp.tsx符号为准，行号会随提取变化；源码核验不等于浏览器实测。

|模块/动作|桌面|手机|迁移必须保留或明确处理|
|---|---|---|---|
|学生搜索|filter含姓名/学号/电话/备注/小组/座位|query含姓名/学号/电话/小组/座位，不含备注|合并时不能丢桌面搜索字段|
|学生小组筛选|groupFilter|groupFilter|无小组也能搜姓名学号|
|学生分页|page/pageSize默认20|studentPage固定12|新结构要保留筛选返回状态|
|单选详情|focusedStudentId|selectedId浮层|与批量勾选不是同一状态|
|档案|profileStudentId/StudentProfile|profileStudentId/StudentProfile|档案与监护人编辑需继续核查内部handler|
|全选|toggleShownSelect全部筛选结果|toggleFilteredSelect全部筛选结果|不是当前页，文案要准确|
|学生批量编辑|applyBatchEdit|applyStudentBatchEdit|已共用纯操作；空备注不清空旧值；小组非数字/负数归1|
|批量选择清理|仅名册变化裁剪已删除ID|同左|处理后两端均保留选择；后续应按约定明确本地应用/同步成功时机|
|新增学生|saveNewStudent：姓名必填、电话校验|saveStudentDraft：同类校验及分数范围|初始默认值差异不可未经核验统一|
|新增与旧作业|桌面只syncActiveClass|手机还补当前班旧任务的默认已交状态|属于已存在差异，新controller不能只搬一端|
|编辑学生|edit直接更新|draftStudent确认更新|桌面即时本地编辑与手机表单提交不应冒称服务端成功|
|追加名单|appendNames/makeStudent|appendBulkStudents/makeStudentFromRow|解析换行/分隔符，补旧任务默认状态|
|替换名单|replaceNames危险确认并清关联|本轮已读手机追加handler未发现替换入口|需新页面保留桌面能力，不能只采用手机功能子集|
|删除学生|removeStudent危险确认|deleteStudent危险确认|共用removeStudentRelations，剩余座位/组重新排列|
|作业列表归属|必须task.classId等于当前班|允许无classId历史任务|先核normalizeData再决定兼容；不静默收窄|
|作业搜索/时间|关键词/学科/月/日期上下界；反向日期互换|关键词/科目/近7天/近30天/本月|新页面需覆盖能力并集|
|作业历史分页|每页10|visibleTasks全部渲染|100+历史任务需分页但未在此次改动|
|作业创建|confirmAddTask|saveTaskDraft|日期/学科/内容必填；默认全班已交是既有作业规则，不套用听写|
|作业编辑|confirmEditTask/setTask|saveTaskDraft edit分支|本地更新即关闭，不等待服务器|
|作业删除|deleteTaskById|deleteTask|危险确认，连带任务内状态删除|
|作业逐生状态|setStatus/toggle|setStudentHomeworkStatus|已接共享操作；已复查在任务保留，学生汇总映射已交|
|作业批量|bulkSet当前选中且仍在名单者|batchSetHomeworkStatus当前选中ID|共享数据变换；目标裁剪仍由各自controller负责|
|作业全选|toggleCurrentPage当前20人|toggleDetailStudents全部筛选结果|必须标明范围，不能无说明统一|
|作业详情过滤|状态/小组/姓名学号电话备注|同类过滤|桌面分页；手机全列表，长名单布局待迁移|
|加入跟进|addSelectedToFollowList并打开跟进区|addMobileHomeworkFollowUp|去重保留既有名单；没有外部发送|
|移除/复制跟进|removeFromFollowList/copyFollowList|此次手机已读范围未发现对应handler|复制共用copyTextToClipboard及失败反馈|
|学生备注|setStudentNote同步根名单和当前班|手机作业已读详情无备注编辑|新页面保留桌面入口，不能把公共备注变成任务备注|

## 浮层与保存限制

手机源码确认存在学生详情、新增/编辑、追加、批量编辑四类MobileInfoSheet；作业有详情和新增/编辑两类。桌面作业createOpen/editOpen使用旧role=dialog结构，确认后直接本地更新并关闭。此次未宣称脏关闭保护、嵌套焦点或手机键盘验收通过。

继续逐handler核验确认：桌面作业有新增、编辑、删除、待跟进名单三类浮层/确认；手机有任务详情与任务编辑MobileInfoSheet，但源码只有openNewTask会将taskEditorOpen设为new，完全没有设为edit的触发器，因此手机“编辑/删除任务”分支实际不可达。该能力缺口必须在新页面接线时补齐，不能因为分支源码存在就登记为已可用。桌面严格排除无classId旧任务，手机兼容显示无classId任务；迁移前需明确旧数据归属策略。

applyHomeworkStatuses增加目标班名册和任务归属防线：另一班/不存在ID不会写入任务statuses，也不会修改学生汇总；另一班任务ID不会只改学生汇总。保留无homeworkTasks旧数据只更新学生汇总的既有兼容。新增失败后修正并通过的跨班测试。

`updateData`：只读阻止修改；一般编辑更新workspaceRef、normalizeData/scopeClassSettings，写本机草稿并置dirty。demo可本地演示但不持久化。
`save`：沿用in-flight排队、server/local revision、409冲突锁、成功时只清对应版本草稿。
`commitWorkspace`：先save旧编辑，再保存听写next；4.8MiB预检；并发新编辑时仅把next.dictation合回latest.data。因此它虽然命名通用，实质是听写专用提交语义。绝不能直接将其传给学生/作业新页面当通用事务。pendingDictationDraftRef也只存该路径。

以上保存逻辑本次未移动或改变。TASK05仍未完成，不能只改名字宣称保存层已经统一。

## 样式隔离核验

真正CSS入口是app/layout.tsx，不存在app/w/[token]/layout.tsx。根布局导入globals、workbench-repair、campus controls/surfaces/mobile/page-families等多份旧规则。
`controls.css`存在html[data-theme=campus] :is(input/select/textarea)等通用选择器；根DialogAccessibility也是全局挂载。新CSS Modules仍会被这些选择器命中，原生新Dialog接线也需排除旧焦点管理器。
TASK09尚未实施。后续必须按选择器AST/根变量/portal归属分别处理，不能全文件字符串加前缀，不能仅删某个import使旧页面失效。

## 验证范围

新增7项操作回归：两班50人、105人批量等价、家庭引用不变、已复查映射、缺少可选字段、学生空字段/非法小组/非目标字段。没有伪造真实班级资料。测试加入npm test，不依赖浏览器源码替换或删原断言。
本次不改变任何页面结构和样式；没有新增视觉完成结论。完整UI重建仍在进行，TASK02账本只部分展开。下一步继续核查StudentProfile、名单导入/导出和所有相关浮层，然后抽取保存层并建立旧CSS边界，再推进新页面接线。
