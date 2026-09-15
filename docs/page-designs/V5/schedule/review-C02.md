# 课程日程 C02 候选审核入口

C01三个主工作面已获用户“确认”。本轮补齐八类独立详情/编辑的桌面及手机共16张图，尚未获用户批准。以下链接均为当前有效候选。

| 界面 | 桌面 | 手机 |
| --- | --- | --- |
| 编辑本周课表 | [桌面](candidates/timetable-editor-desktop-c02.png) | [手机](candidates/timetable-editor-mobile-c02.png) |
| 学期设置 | [桌面](candidates/term-settings-desktop-c02.png) | [手机](candidates/term-settings-mobile-c02.png) |
| 编辑班级安排 | [桌面](candidates/event-editor-desktop-c02.png) | [手机](candidates/event-editor-mobile-c02.png) |
| 编辑重点事项 | [桌面](candidates/focus-editor-desktop-c02.png) | [手机](candidates/focus-editor-mobile-c02.png) |
| 日程详情 | [桌面](candidates/agenda-detail-desktop-c02.png) | [手机](candidates/agenda-detail-mobile-c02.png) |
| 编辑日程 | [桌面](candidates/agenda-editor-desktop-c02.png) | [手机](candidates/agenda-editor-mobile-c02.png) |
| 工作留痕详情 | [桌面](candidates/work-log-detail-desktop-c02.png) | [手机](candidates/work-log-detail-mobile-c02.png) |
| 编辑工作留痕 | [桌面](candidates/work-log-editor-desktop-c02.png) | [手机](candidates/work-log-editor-mobile-c02.png) |

## 已检查与后续必须落实的细节

- 课表编辑：手机已重画为一节一个课程；桌面已补教学日名称、节次名称及时间输入，移除错误自然周日期。实现中每个教学日/节次仅一个删除入口，去掉时间字段旁重复垃圾桶；手机同屏设置只保留一个展开触发，补回低强调清空课程入口。
- 学期设置：生成下拉外观不改变现有学年/学期自由文本；不采用生成的200字限制，使用实际校验。
- 日程详情：桌面只读行假箭头已移除，手机动作已改完整“完成并留痕”。
- 工作留痕详情：两端已重画为无输入框的连续阅读页；来源只有一个真实关联日程链接，保留完整事实。
- 编辑表单：地点/渠道保持自由文本，不采纳生成的下拉箭头；关联学生为可选，移除手机留痕中错误必填星号。字数上限按现有源码，不采用生成图凭空给出的200/500。
- 控件尺寸、间距与字段基线在可运行稿冻结。手机重点事项采用分隔线区分记录，去掉多余外框；删除动作低强调。
- 7教学日、16节次、长文本、空态、保存失败、冲突、只读等仍需按state-contract.md逐项实现和实测；图片覆盖不代表交互验收。

图像用于确认工作面构图，字体与控件最终以隔离可运行实现为准。没有正式业务修改或部署。
