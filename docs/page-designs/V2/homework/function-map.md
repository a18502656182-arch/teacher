# 作业功能与状态映射

| ID | 当前真实入口/字段 | 独立设计位置 | 核对 |
|---|---|---|---|
| H01 | TaskFilters：搜索作业（学科、日期或作业内容）、学科、高级筛选、清除筛选、找到项数 | 左任务工具 | 源码+桌面实际 |
| H02 | AdvancedFilters：归档月份、包含学生状态、查某个学生、学生小组、开始/结束日期；重置条件/查看结果，反向日期自动排序 | filters Drawer | 源码 |
| H03 | TaskList任务选择及分页；学科日期标题、待处理人数/完成率 | 左任务/手机第一步 | 源码+桌面实际；手机默认待补 |
| H04 | 新增作业；任务操作→编辑作业/删除作业；日期、学科、作业内容必填，取消/保存，dirty放弃确认 | task-editor/validation | 源码；写入未测 |
| H05 | 当前作业统计：完成率、已交/未交/待订正/已复查人数；只按当前班 | 右任务上下文 | 源码+实际 |
| H06 | 学生搜索姓名/学号/备注、状态、小组、分页 | 学生工具 | 源码+实际 |
| H07 | 四态逐生切换：已交、未交、待订正、已复查；完整备注编辑读写student.note | 连续学生行 | 只读实际，编辑未测 |
| H08 | 多选、全选本页/取消、清空、批量改状态、加入待跟进；仅选中后出现 | selected/batch | 源码；旧QA有运行检查但不冒充本轮完整验证 |
| H09 | 任务操作→待跟进名单；移出、复制名单、关闭；复制有成功失败反馈，不外发 | follow Drawer | 手机空名单实际 |
| H10 | 手机chooseTask打开StudentWorkspace Drawer，关闭恢复筛选 | mobile-detail | 源码；本轮截图已到更深follow层 |
| H11 | 本机update后workspace自动保存、草稿、失败/409；只读禁写，查询和复制保留 | shared-save | 源码，真实保存未测 |

状态：normal、empty-tasks、tasks-30、students-105、long-title/note、search-empty、task-editor、validation、filters、mobile-detail、selected、follow-empty/full、readonly、saving、save-failure、conflict-409、dirty-close、delete-confirm。全部为保全范围，不继承旧视觉pass。
