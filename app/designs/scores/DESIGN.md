---
name: 成绩分析 · 隔离 P01
description: 浅绿考试上下文与连续录分台账的局部实现记录
colors:
  primary: "#087e7e"
  primary-hover: "#076a6a"
  surface: "#ffffff"
  ink: "#15334a"
  muted: "#50667b"
  placeholder: "#687a89"
  input-line: "#c7d7e0"
  line: "#dce6ed"
  hover: "#eaf4f1"
  exam: "#eef6ee"
  exam-meta: "#446250"
  table-head: "#eaf5fd"
  missing: "#fff2dc"
  missing-input: "#fff7e9"
  missing-ink: "#885300"
  marked: "#e6f2e7"
  marked-ink: "#2b633d"
  pending: "#fff5e5"
  pending-ink: "#80521c"
  success: "#edf7ee"
  success-ink: "#275e49"
  danger: "#a33324"
typography:
  body:
    fontFamily: "Microsoft YaHei, sans-serif"
    fontSize: "15px"
    lineHeight: 1.6
  display:
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.35
  mobile-display:
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.35
  section:
    fontSize: "22px"
  exam-title:
    fontSize: "21px"
    fontWeight: 700
  mobile-score:
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.8
  student:
    fontSize: "19px"
    fontWeight: 700
  subsection:
    fontSize: "18px"
  introduction:
    fontSize: "17px"
  mobile-tab:
    fontSize: "16px"
  mobile-body:
    fontSize: "14px"
    lineHeight: 1.6
  metadata:
    fontSize: "13px"
  mobile-metadata:
    fontSize: "12px"
  mobile-badge:
    fontSize: "11px"
rounded:
  control: "5px"
  exam: "7px"
spacing:
  inline: "8px"
  toolbar: "10px"
  compact: "12px"
  form: "14px"
  section: "16px"
  context: "18px"
  row: "20px"
  context-inline: "22px"
  page-top: "24px"
  page-inline: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    padding: "7px 12px"
  score-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    width: "90px"
    height: "35px"
  exam-context:
    backgroundColor: "{colors.exam}"
    rounded: "{rounded.exam}"
    padding: "18px 22px"
  missing-badge:
    backgroundColor: "{colors.missing}"
    textColor: "{colors.missing-ink}"
    rounded: "{rounded.control}"
    padding: "2px 8px"
---

# Design System: 成绩分析 · 隔离 P01

## Overview

**Creative North Star: "浅绿考试笺与白纸录分簿"**

浅绿横带固定当前考试、日期与科目满分，白纸连续台账承担录分，浅蓝表头建立列关系。文具水彩只提供标题情境，青绿用于命令和选中状态。此名称是对 C01 已确认方向的描述性归纳，不是另行批准的品牌命名。

本文件仅登记 app/designs/scores 的局部实现，不替换根 DESIGN.md。页面模式 Operate：先选考试，再录分、看趋势或核对试卷。用户本轮“确认”批准 C01 双端方向；P01 主页面仍待用户审核，弹窗视觉后置，完整 D/R 未批准、正式业务未接入、未部署。brief/function-map 的制作前文字不是当前实现结论；finish-review 最终 PASS 仅表示可交用户主页面审核，F1/F2 已 resolved。

**Key Characteristics:**

- 浅绿考试上下文、紧凑工具条与连续录分表。
- 手机学生行逐科显示满分、分数及缺录状态。
- 三个工作区共享真实壳层，趋势与分析保持独立任务。
- 颜色配合文字，不把空白等同零分。

## Colors

### Primary

青绿 primary 用于主命令、文字操作、选中下划线和图表线点；primary-hover 是主命令悬停色，hover 是普通命令的低强调背景。颜色值以前置 token 为准。

### Secondary

浅绿 exam 表示当前考试上下文，exam-meta 承载其辅助文字；table-head 浅蓝只建立表头。missing 与 missing-input 区分缺录状态签和输入面，marked 表示本次跟进标记。pending 提示未保存或待同步，success 显示已完成反馈，danger 用于错误。各状态配对文字色均已登记，不能只依赖颜色传义。

### Neutral

白色主面、深蓝正文、灰蓝元信息构成阅读主体。input-line 界定输入区域，line 分隔连续行、标签与趋势摘要。

**The Meaning Rule.** 缺录、零分、本次跟进和保存状态各自保留明确文字，不通过颜色扩大统计或业务含义。

原 detector.json 共22项：14条颜色 advisory（含一次重复）、2条圆角、5条字号及1条下划线 warning。此次登记源码 token；标签已明确直角，3px 底边是选中指示，该 warning 为误报。未重跑 detector，不把登记写成检测全通过。

## Typography

**Display Font:** Microsoft YaHei，sans-serif 回退。

**Body Font:** 同上。supplement/supplement.json 实测正文桌面15px/24px、手机14px/22.4px，标题桌面700 34px/45.9px、手机700 26px/35.1px；平台字形证据确认四个标题字使用 MicrosoftYaHei-Bold，未新增字体文件。

### Hierarchy

考试标题桌面21px、手机20px；工作区标签17px/16px，手机姓名19px、成绩20px，元信息12px、状态签11px。桌面副标题17px，手机最终覆盖为12px。趋势摘要值22px、手机19px。小字密度是用户审阅及后续优化项，登记尺寸不代表无障碍验收。共享门户弹窗的计算字体为 PingFang SC、Microsoft YaHei、system-ui 回退栈，不应推断继承局部页面全部字级。

## Layout

桌面页内距24px 28px 28px，标题最低112px、底部18px；考试带内距见 token、底部14px。标签间距22px，工具条间距10px可换行；搜索外框248×36px。台账最小750px，可内部横向滚动；表头内距12px、正文13px 12px，姓名列最低112px，分数框尺寸见 token。每页10名学生；批量动作只在已选学生后出现。

901–1200px页内距22px，考试动作换行，工具条计数单独一行。≤900px页内距16px 16px 88px，标题最终最低60px；考试带最终内距12px 14px，动作移至下方。标签等分，搜索39px高，学生行上下20px，以细线连续分隔；科目单元可换行、最小65px。手机通过学生录分/详情入口编辑，未将桌面输入表硬缩成手机表格。

supplement 实测1536视口主面起点(244,72)、宽1277px，表行高约71.69px；390视口主面起点(0,64)、宽390px，首学生行高约171.38px。已实际查看 round2/1536-normal.png、390-normal.png 和 reviewer-fix/1536-trends.png；手机首屏可见第一名完整学生及第二名部分信息。补充记录360/390无水平溢出，本文作者未重新运行浏览器。手机10条产生约2321px主面高度，分页不等于首屏内容充分或完整滚动已验收。

趋势台账每页10场，图最多36场；SVG最终为自适应1000/260宽高比，后置规则已覆盖早先固定240/180px高度。

## Elevation & Depth

本页没有 box-shadow、过渡或动画 token。靠浅绿上下文、浅蓝表头与功能性细分隔建立层次。共享 Dialog/学生选择器有独立门户及样式，不能将页面无阴影描述扩大为浮层规范或视觉批准。

## Shapes

控件和状态签小圆角5px，考试带7px；台账直边、工作区选中指示为3px底边。插画 stationery-p01.png 为1536×1024源图，桌面显示186×110px、窄桌面宽150px，手机最终82×58px，object-fit:contain、空alt。插画不承担统计或交互含义。

## Components

### Buttons

主命令青绿填充，次命令为文字；最低桌面36px、手机42px，禁用透明度0.5。focus-visible 为2px青绿轮廓、偏移3px；hover 使用已有背景，不新增位移动画。本次跟进在桌面是状态按钮，在手机是状态文字，不能把两者描述成相同交互。

### Chips

缺录和跟进保留中文，手机状态签更紧凑。零分正常显示为0，未录入显示文字和浅暖色面；待补全不是学生能力判断。

### Cards / Containers

仅一个浅绿考试上下文面，录分、分析项与趋势台账用连续行和分隔组织，避免每名学生各包白卡。趋势摘要是连续横条，不是三张统计卡。

### Inputs / Fields

输入白底、细描边、小圆角。桌面分数先暂存 React 草稿，点击“保存录分”才应用并等待保存结果；工具条计数、总分和状态基于已应用数据，输入中不会即时重算。允许空白和0，保存校验0至该科满分。搜索覆盖姓名、学号和本次建议；更多筛选提供小组、科目、区间、跟进与排序。

控制器隔离复用既有 scores operations；pendingRef 区分首次应用和重试，sync 含 try/catch/finally，失败保留待同步、关闭和切换有脏数据保护，冲突提供导出及确认载入最新。只读禁写。未据此宣称真实服务器并发、权限或刷新后草稿持久化完成。

趋势组件是独立复制实现，保留原得分率算法：科目条件只筛含该科考试，每场仍按全部已录科目计算；班级值是有录入学生得分率的平均。有录入学生占比指每人至少一科即计入，不是成绩项完整率。按日期排序后场次等距，不是时间比例轴；缺失点重启路径，实图可见断线。原始平均、旧 student.score 派生行为未借视觉任务改写，不能当跨满分公平比较或长期评价。

试卷分析只生成合成候选，不上传文件、不调用真实 AI；人工核对确认后才加入隔离统计。功能入口和错误恢复存在不等于弹窗视觉批准。

### Navigation

沿用真实 WorkbenchShell 桌面顶栏侧栏、手机顶部底栏。录分/趋势/试卷分析使用 aria-pressed 按钮，筛选用 aria-expanded；未实现或验证的 ARIA tablist 箭头键行为不能写入规范。学生趋势选择复用 StudentLookupDialog，避免全班原生下拉。

## Do's and Don'ts

### Do:

- **Do** 保留浅绿考试上下文、连续录分台账和手机学生行。
- **Do** 同时说明科目满分、缺录与零分以及趋势统计口径。
- **Do** 以源码最终覆盖值及实拍记录尺寸，保留小字和滚动密度审阅项。

### Don't:

- **Don't** 将有录入学生占比写成成绩项完整率，或将等距场次轴写成时间比例轴。
- **Don't** 将合成候选称为真实上传或 AI 识别完成。
- **Don't** 将 finish PASS 写成用户 P01 批准、弹窗批准、完整 D/R 或部署许可。
