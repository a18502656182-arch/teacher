# 学生功能与状态映射 · 源码盘点

基线：9a0babd＋开工时未提交学生修改。源码路径均在app/w/[token]/；以下“已核对”表示源码核对，现场运行范围另列，未运行编辑不标通过。

| ID | 当前入口/字段与真实行为 | 候选区域/状态 | 验证层次 |
|---|---|---|---|
| S01 | StudentsView + controller：搜索“姓名、学号、小组或备注”；filterStudents也匹配电话/座位；全部小组筛选 | 名单工具/search-empty | 源码；普通只读已渲染 |
| S02 | 每页20/50人；上一页/下一页；显示当前页人数/筛选总数 | 名单页脚/large | 源码；105人仅历史证据，本轮未重测 |
| S03 | 新增学生/编辑资料/退出编辑；桌面行内学号、姓名、性别、小组；手机打开编辑层 | 工具/editor | 源码；本轮只读禁用可见 |
| S04 | 新增/编辑弹窗：姓名、学号、性别、小组、座位、家长电话、班务备注；取消、保存学生；姓名必填，电话留空或有效11位 | editor/validation | 源码；错误提示当前由页面message承接，弹窗可见性未测 |
| S05 | 删除由removeStudentRelations按ID清理当前班关联，危险确认；后续重排座位/小组为现状 | 行内删除/danger-confirm | 源码，不执行真实删除 |
| S06 | 名单操作→导入名单（手机“追加名单”）；每行姓名/电话/备注，预检人数；追加名单、替换当前名单、取消；替换先危险确认 | import/import-error | 源码；当前只有人数预检，不虚构逐行错误分析能力 |
| S07 | 导出CSV：学号、姓名、性别、小组、座位、家长电话、备注；仅当前班 | 名单操作/export | 源码；完整号码不放主表或候选 |
| S08 | checkbox多选，全选当前筛选/取消当前筛选，清空选择；选择后批量编辑 | selected/batch | 源码；现有QA批量操作路径有旧背景点击问题，待重测 |
| S09 | 批量小组、性别、备注，留空不修改，备注非空覆盖；取消/应用修改 | batch-editor | 源码；当前applyBatch没有清空selectedIds，保留事实不编造 |
| S10 | 查看/点击行选焦点；身份姓名学号组座位、积分/近期成绩/考勤/作业、班务备注；近期听写/作业/考勤/沟通 | detail/normal | 桌面真实图已打开；手机Drawer已打开 |
| S11 | 打开完整档案→StudentProfile；基础资料、住宿、标签、监护人、照护、历史；草稿关闭守卫由profile controller负责 | profile | 源码定位；本轮未执行完整表单 |
| S12 | 桌面保留总数/男/女/电话维护人数及率；手机目前不显示全部统计，新候选拟提供紧凑概况 | 标题下辅助行 | 来源controller.metrics，不引入新数据 |
| S13 | ClassroomApp传updateData；一般本机应用和自动save；workspace负责dirty/revision/草稿/409/重试 | shared-save | 源码已核对；本轮无写入测试；不可把页面成功提示当服务器确认 |
| S14 | readOnly来自isDemo或isReadOnly，写入口禁用，查询详情CSV仍可达 | readonly | /w/demo真实渲染；未运行正式账户 |

## 在途改动问题（不属于本轮修复）

新增statusBadge/mobileIdentity/mobileStatus/rosterSummary/profileAction等类未在CSS定义；手机三列网格装入更多子项，现场状态竖排。read-model的日期格式改动仍用localeCompare混排年月日与钟点；0个错词会命中danger，未参加与缺勤同色需重新定义语义。student.score || '未录入'也把0视为未录入，这是既存表达，需以数据契约核实后独立修复。

## 状态清单

normal、empty、large-105、long-name、search-empty、loading、readonly、saving、save-failure、conflict-409、detail-drawer、profile、editor、validation、import、import-error、batch、danger-confirm、dirty-close。适用性及本轮证据见states.json；无一项据候选图片标为功能通过。
