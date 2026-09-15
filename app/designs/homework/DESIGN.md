---
name: 班主任工作台 · 作业追踪 P01
description: 暖白任务清单与浅蓝学生四态工作面的局部视觉记录
colors:
  ink: "#17354a"
  muted-ink: "#526a7b"
  context-ink: "#426378"
  paper: "#fffdf8"
  task-paper: "#fffefa"
  surface: "#ffffff"
  context-blue: "#eaf6fc"
  selected-task: "#e7f4fc"
  soft-blue: "#edf7fc"
  mobile-background: "#f0f8fc"
  divider: "#d6e2e8"
  control-divider: "#cbdce6"
  submitted: "#347953"
  missing: "#b94c41"
  missing-metric: "#b23e36"
  correction: "#fbd78e"
  correction-ink: "#714300"
  correction-metric: "#895100"
  rechecked: "#14778a"
  subject-language: "#bc5344"
  subject-math: "#2979ac"
  success-surface: "#edf6ef"
  success-ink: "#245f43"
  warning-surface: "#fff1d4"
  warning-ink: "#70480c"
typography:
  headline:
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.3
  task-title:
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "25px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "16px"
    lineHeight: 1.6
  status-label:
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "13px"
  metadata:
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "12px"
rounded:
  progress: "3px"
  control: "6px"
  selected: "8px"
  mobile-task: "10px"
  workspace: "12px"
spacing:
  compact: "8px"
  field: "10px"
  control: "12px"
  mobile: "14px"
  inset: "16px"
  workspace: "18px"
  page: "24px"
components:
  status-submitted:
    backgroundColor: "{colors.submitted}"
    textColor: "{colors.surface}"
    typography: "{typography.status-label}"
  status-missing:
    backgroundColor: "{colors.missing}"
    textColor: "{colors.surface}"
  status-correction:
    backgroundColor: "{colors.correction}"
    textColor: "{colors.correction-ink}"
  status-rechecked:
    backgroundColor: "{colors.rechecked}"
    textColor: "{colors.surface}"
  task-container:
    backgroundColor: "{colors.task-paper}"
    rounded: "{rounded.workspace}"
    padding: "16px 12px"
---

# Design System: 作业追踪 P01 局部记录

## Overview

**Creative North Star: "先选作业，再处理学生"**

本文件描述隔离 P01 的实际视觉系统，只约束本目录。用户于 2026-09-15 确认 C01 概念方向；P01 仍待用户审看与 D 设计批准，未正式接线。本文不是批准记录，不扩展根目录 DESIGN.md 或首页既有批准。

依据为同目录 HomeworkDesign.tsx、HomeworkDesign.module.css、tools/ui-preview/homework.html 的方向合同、根目录 PRODUCT.md，以及 docs/page-designs/V2/homework 的 brief.md 和 P01-FINISH-REVIEW.md。尺寸及字体采样来自 .qa-shots/homework-design/final/capture.json。产品要求高密度操作、状态文字可读、学生信息跨模块复用；局部视觉以暖白任务清单、浅蓝工作面和语义四色支持这些要求。

**Key Characteristics:**

- 桌面任务清单与连续学生行，手机任务列表进入共享 Drawer。
- 统计与状态共用语义色，选中态仍显示完整文字。
- 本地文具插画只承担作业情境，不侵入导航或代替业务内容。

## Colors

Primary 为青蓝操作与复查色；主按钮仍继承共享 Button 的 intent，不在本页另造按钮系统。Secondary 为已交绿、未交红、订正琥珀，用于状态与统计；琥珀使用深色文字。学科标记分别使用语文砖红、数学蓝、英语绿，必须结合学科文字解读。

Neutral 由暖白页面、偏暖任务面、白色学生面、深蓝正文和灰蓝次要文字组成。浅蓝用于上下文、选中任务和辅助统计，细灰蓝线分隔连续记录。成功提示使用浅绿，筛选提醒与只读提示使用浅琥珀。颜色角色及实际值见 frontmatter，不把所有红色或所有绿色强制合并成一个色值。

检测器所报 28 条 advisory 涉及全局 DESIGN 外的本页色彩、字号/字体和圆角；这些是本页有意声明的局部取值，不意味着已消除所有偏差，也不要求修改全局设计系统。

## Typography

继承共享中文系统字体栈。Windows 浏览器实际采样为 Microsoft YaHei / MicrosoftYaHei-Bold，isCustomFont 为 false；未分发字体文件，不声称匹配候选图字体手感或保证其他平台相同。

页面标题、任务标题、正文与标签按 frontmatter 分层。任务栏标题为 20px，学科文字为 17px，任务摘要为 15px；学生名桌面 14px、手机 16px。统计数为 26px，手机 22px，并使用等宽数字。上下文任务标题在窄桌面减为 21px、手机为 20px；手机公共备注输入为 16px。12px 元数据承担日期、学号与补充说明，四态标签保持 13px、单行完整。

## Layout

大桌面页面内距 24px，任务栏 310px，右侧为 minmax(0,1fr)，两栏间距 18px。1536×1024 采样确认任务栏宽 310px、上下文区高 146px。任务区与学生区使用各自边界，内部用连续行、分隔线和单条统计带组织信息。

901–1350px 时任务栏收至 270px、列距 14px；学生行改为身份、四态、备注分行，筛选改为两列。900px 及以下由页面的 mobile 分支切换为独立任务列表，选择任务后打开既有 Drawer；保留真实 WorkbenchShell 和手机底部导航。新增/编辑表单在 600px 以下改为单列。

桌面任务列表最大高 570px，学生列表最大高 414px，分页位于列表之外；手机任务列表最大高 520px，详情内学生内容随 Drawer 滚动。四态与主要操作保留至少 44px 高度。手机因此比 C01 首屏展示更少学生，选择后的批量条进一步增加滚动成本；不把无横向溢出等同于密度已获用户认可。

## Elevation & Depth

本页 CSS 未新增 box-shadow 或动画。层次主要来自浅蓝上下文、暖白任务面、白色学生面及细分隔线；浮层深度与交互沿用共享 Dialog、Drawer、Menu。局部 task-list 焦点使用青蓝 2px outline、向内偏移 2px；hover 使用浅蓝填充。

插画 stationery-p01.png 为本目录 ImageGen 素材，桌面按 290×146px 裁切并 multiply 混合，窄桌面缩小为 175×116px。手机标题带使用 200×110px 局部；Drawer 使用 155×110px、opacity .38。实际艺术面积更小、手机更淡，不能声称像素复刻 C01 的大幅水彩书本。

## Shapes

外部任务面与学生面使用 workspace 圆角；选中项、学科标记与统计带使用 selected 圆角；四态公共外框与表头使用 control 圆角；手机独立任务项使用 mobile-task 圆角。进度轨道仅作低矮线条。圆角层级见 frontmatter，边界服务于任务选择、独立工作面或控件状态，不添加装饰性嵌套框。

## Components

- **任务项：** 学科标记、学科与日期、两行标题摘要、待处理信息、完成进度。桌面当前项浅蓝高亮并提供 aria-current；手机点击进入详情。保留搜索、科目/月筛选与分页。
- **学生四态：** 共享 StatusSegment 保留四个完整文字选项及 aria-pressed；单一外框、内部细分隔线、选中语义色。批量条仅在选择后出现，不能把状态画成四个同权重独立主按钮。
- **标题与备注：** 超过 64 字的上下文标题呈现摘要及“查看完整作业内容” disclosure，完整数据仍可展开。备注绑定 student.note，明确叫“学生公共备注”；textarea 可滚动并纵向调整，不虚构为某次作业的独立备注。
- **共享操作：** Button、Field、Dialog、Drawer、Menu、DraftClosePrompt 与删除确认保持既有组件及回调。一般状态编辑沿 workspace 自动保存语义，不添加候选里的手动“保存更改”或虚构归档功能；作业编辑表单有自身提交按钮。
- **反馈：** 空任务、无匹配、待跟进、只读和表单错误保留文本与真实入口。独立宿主中的保存/失败/409 为合成数据与内存模拟，不能证明后端持久化、权限或冲突恢复通过。

## Do's and Don'ts

- **Do** 保持真实共享壳层、任务到学生的顺序与四态文字；只在本页局部应用这些视觉取值。
- **Do** 将候选中的错字、错误导航、额外切班箭头与小触控目标作为已知偏差处理，不照图复刻错误。
- **Do** 将长标题展开、公共备注、手机批量后的滚动成本与实际截图一起交用户判断。
- **Don't** 把小而淡的实稿插画描述成与候选一致，不为了更多首屏行压缩 44px 操作目标。
- **Don't** 用技术采样、finish review 或本文件代替 D/R 批准；不依据本地模拟宣称正式保存或部署完成。
