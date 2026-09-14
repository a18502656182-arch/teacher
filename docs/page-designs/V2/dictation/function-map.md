# 听写功能与状态映射

| ID | 当前入口/真实行为 | 新设计状态 | 核对 |
|---|---|---|---|
| D01 | Dictation任务/词库/错词本/记录与统计；新建听写；任务搜索、学科、日期、重置、分页 | tasks/books/wrong/history | 源码；任务空态桌面手机实际 |
| D02 | TaskEditor名称日期学科、参与者搜索分页、人工材料/词库/TXT/课次/作业关联/历史错词；最多200词，固定材料和参与者快照 | task-editor | 源码职责与旧保全账本；字段完整实测待补 |
| D03 | 任务编辑/归档/删除、复听、下一课；有结果不可改场景材料，失败重试保持ID | task-actions | 源码+历史保全，未运行 |
| D04 | Grading返回任务、打印材料、展开本次材料；日期学科词数/已处理人数 | grading-context | 当前正式源码已读；本轮空态未进入 |
| D05 | 当前学生、队列搜索姓名学号、只看待批改、队列分页；手机换学生Drawer | grading-roster | 源码，dirty禁止直接切换 |
| D06 | 参与状态：实际参与批改/请假/未参加；300字备注；逐词错词checkbox；显式确认已核对 | grading/leave/absent | 源码；未批改不能算全对 |
| D07 | 已标记错词数、放弃修改、保存并下一位；服务器确认才计入结果和换人，失败草稿保留 | saving/failure/dirty-close | useGradingController+commitWorkspace，运行待补 |
| D08 | 已保存且有错词→为当前学生安排错词复习；新任务ID不覆盖历史 | review-action | 源码；无自动复习开关 |
| D09 | WordLibrary词库元数据、内容、TXT导入、增改删；脏离开/失败保留 | library-editor | 旧保全+源码入口，完整运行待补 |
| D10 | 错词本、个人筛选、历史记录与30天统计、分页 | wrong/history | 源码职责；统计不把请假/未参加算错误率 |
| D11 | 只读可浏览打印；创建修改批改禁用；工作区容量提示/完整备份/409仍由既有模块处理 | readonly/conflict | 只读空态实际；写入未测 |

状态：tasks-empty/normal、task-editor、validation、grading-8/12/60/200、long-name、queue-105、leave、absent、ungraded、wrong-selected、confirmed、review-action、library-editor、wrong-empty/full、history-empty/full、loading、readonly、saving、save-failure、conflict-409、dirty-close、delete-confirm。候选文字不是业务契约。
