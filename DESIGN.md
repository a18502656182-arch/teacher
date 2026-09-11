---
name: 班主任工作台
description: 彩色、有记忆点，同时适合长期高频工作的班主任管理界面
colors:
  ink-teal: "#173F4B"
  ink-teal-deep: "#102F38"
  sky-blue: "#356DF3"
  coral: "#F0645A"
  jade: "#1FA585"
  marigold: "#E3A52B"
  iris: "#7656D8"
  lake: "#1E9EB5"
  berry: "#D95C92"
  canvas-mist: "#F3F7F6"
  surface: "#FFFFFF"
  text-strong: "#13232E"
  text-muted: "#60717B"
  border-soft: "#D7E2E2"
  success-soft: "#E8F7F1"
  warning-soft: "#FFF4D7"
  danger-soft: "#FDEBE8"
  info-soft: "#EAF0FF"
typography:
  display:
    fontFamily: "PingFang SC, Microsoft YaHei, Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0"
  headline:
    fontFamily: "PingFang SC, Microsoft YaHei, Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0"
  title:
    fontFamily: "PingFang SC, Microsoft YaHei, Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.45
    letterSpacing: "0"
  body:
    fontFamily: "PingFang SC, Microsoft YaHei, Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  label:
    fontFamily: "PingFang SC, Microsoft YaHei, Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0"
rounded:
  control: "8px"
  surface: "10px"
  compact: "6px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.sky-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "40px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.surface}"
    padding: "16px"
  badge:
    rounded: "{rounded.pill}"
    padding: "4px 8px"
    typography: "{typography.label}"
---

# Design System: 班主任工作台

## Overview

**Creative North Star: “彩色班务手册”**

班主任工作台的目标视觉不是传统蓝灰后台，也不是把所有功能做成儿童化彩色玩具。它像一本被认真整理过的班务手册：深墨青框架提供稳定和可信，雾白绿画布让长时间使用不刺眼，彩色标签、图表和 Emoji 让不同班务场景一眼可辨。

系统处于 `Operate` 工作模式，但必须具备宣传记忆点。首页、成绩分析、课程日程和成长档案可以更鲜明，承担产品展示；名单、规则、录入、沟通和敏感详情保持高密度白底，承担日常效率。色彩用于分类、优先级、结果和导航，不用于无意义装饰。

目标是“丰富但不花哨，高级但不冷淡”。任何屏幕离开品牌标识后，仍应能通过深墨青框架、彩色模块语言、白色数据纸张和 Emoji + 中文组合识别为班主任工作台。

**Key Characteristics:**

- 深墨青品牌框架与雾白绿工作画布。
- 晴空蓝、珊瑚橙、青翠绿、金盏黄、鸢尾紫、湖水青和莓果粉构成校园色谱。
- Emoji 是模块识别符，不是正文装饰。
- 白色表格、列表和表单保持高信息密度。
- 色彩集中在关键数字、状态、时间线、图表和模块入口。
- 圆角克制，边框清楚，阴影只服务层级。

## Colors

色板像一套成熟的校园文具：颜色明确、彼此可辨，但大面积背景始终安静。

### Primary

- **深墨青 Ink Teal** (`#173F4B`)：桌面品牌侧栏、重要标题和品牌框架。它负责可信与稳定，不作为所有按钮的通用颜色。
- **晴空蓝 Sky Blue** (`#356DF3`)：全局主操作、键盘焦点和当前选择。一个表面原则上只有一个晴空蓝主操作。

### Secondary

- **珊瑚橙 Coral** (`#F0645A`)：作业异常、待处理提醒和需要注意的教学任务。不能替代危险红。
- **青翠绿 Jade** (`#1FA585`)：成长、完成、健康和积极趋势。
- **金盏黄 Marigold** (`#E3A52B`)：值日、积分、等待确认和时间提醒。
- **鸢尾紫 Iris** (`#7656D8`)：成绩分析、考试反思和阶段性输出。
- **湖水青 Lake** (`#1E9EB5`)：课程、周报和信息类时间线。
- **莓果粉 Berry** (`#D95C92`)：家校沟通、评语和需要温度的人员互动。

### Tertiary

- **墨青深色 Ink Teal Deep** (`#102F38`)：侧栏底部、悬停和品牌框架的深层背景。
- **信息浅蓝 Info Soft** (`#EAF0FF`)：选中背景和信息提示，不承载低对比正文。
- **完成浅绿 Success Soft** (`#E8F7F1`)：完成状态背景。
- **待办浅黄 Warning Soft** (`#FFF4D7`)：待处理状态背景。
- **风险浅红 Danger Soft** (`#FDEBE8`)：危险、逾期或需修复状态背景。

### Neutral

- **雾白绿 Canvas Mist** (`#F3F7F6`)：应用主画布，避免纯灰后台感。
- **纸张白 Surface** (`#FFFFFF`)：表格、列表、表单、详情弹窗和数据卡。
- **主墨色 Text Strong** (`#13232E`)：标题、关键数字和正文主信息。
- **灰青文字 Text Muted** (`#60717B`)：元数据、说明和次级标签。
- **柔和边线 Border Soft** (`#D7E2E2`)：容器、表格分隔和控件边框。

### Named Rules

**20-30 色量规则。** 单屏高饱和色面积控制在约 20% 至 30%；其余由纸张白、雾白绿和文字色构成。

**一色一义规则。** 同一屏幕中，相同颜色不同时表达模块、状态和危险三个不同含义。模块色用于识别，状态色用于结果，危险红只用于不可逆操作和真实错误。

**对比优先规则。** 浅色底板只能配深色文字；彩色数字必须达到可读对比度，禁止“浅蓝字 + 浅蓝渐变”的宣传式失真。

**敏感页面降彩规则。** 家校沟通、健康照护、账户和管理员页面降低装饰色比例，优先体现隐私、准确和可追溯。

### Module Accent Map

| 模块 | Emoji | 主模块色 | 主要使用位置 |
| --- | --- | --- | --- |
| 今日工作台 | 📊 | 晴空蓝 | 当前日期、关键待办、主入口 |
| 学生名单 | 🎒 | 湖水青 | 名单入口、学生选择和分组 |
| 作业追踪 | 📚 | 珊瑚橙 | 作业任务、逾期和待订正 |
| 成绩分析 | 📈 | 鸢尾紫 | 考试、趋势和图表 |
| 积分评价 | ⭐ | 金盏黄 | 记分、规则和积分变化 |
| 积分规则 | 📏 | 金盏黄 | 规则分类和分值 |
| 成长档案 | 🌱 | 青翠绿 | 学生成长、证据和积极变化 |
| 家校沟通 | 💬 | 莓果粉 | 沟通、反馈和跟进 |
| 考试反思 | 📝 | 鸢尾紫 | 复盘状态和反思编辑 |
| 班级周报 | 🗞️ | 湖水青 | 周次、汇总和发布内容 |
| 期末评语 | ✍️ | 莓果粉 | 评语状态和编辑 |
| 课程日程 | 🗓️ | 晴空蓝 | 日期、课程和活动时间线 |
| 座位分组 | 🪑 | 青翠绿 | 座位、分组和调整 |
| 值日岗位 | 🧹 | 金盏黄 | 检查、返工和轮值 |
| 班干部 | 🎖️ | 鸢尾紫 | 岗位、任期和职责 |

## Typography

**Display Font:** 系统中文无衬线字体栈，以 PingFang SC / Microsoft YaHei 为先。

**Body Font:** 与 Display 共用系统中文无衬线字体栈。

**Character:** 清楚、紧凑、具备工作台秩序。视觉个性来自颜色、数字和结构，而不是引入装饰字体。数字使用 `font-variant-numeric: tabular-nums`，让成绩、日期和统计稳定对齐。

### Hierarchy

- **Display**（700，28px，1.25）：桌面首页或分析页的真正主标题；普通页面不使用夸张大字。
- **Headline**（700，22px，1.35）：桌面页面标题和手机核心页标题。
- **Title**（650，16px，1.45）：卡片标题、弹窗标题、列表对象姓名和分区标题。
- **Body**（400，14px，1.6）：表格、列表摘要和表单正文；长文最大行宽约 72ch。
- **Label**（600，12px，1.4，字距 0）：字段标签、状态、表头和元数据。

手机端页面标题为 20px，列表姓名为 15px 至 16px，元数据不得小于 12px。字体大小不随视口宽度连续缩放。

### Named Rules

**容器匹配规则。** 大标题只用于页面层级；紧凑工具栏、卡片和弹窗内使用 16px 至 20px 标题，不把宣传级字号塞进工作控件。

**不靠粗体救层级规则。** 同一列表行最多两个主要字重。层级优先通过位置、颜色、字号和留白建立，避免整页全部粗体。

## Layout

桌面端采用固定品牌侧栏 + 流动工作画布。侧栏目标宽度 228px 至 240px，主内容在 1280px 和 1440px 视口下保持完整工作密度；页面内容左右内边距 24px 至 32px。顶部不再重复显示“模块名 + 页面名 + 同义说明”三层标题，只保留班级/学期上下文、页面标题和必要主操作。

页面按四种构图选择，不允许全站套同一公式：

1. **行动首页**：2×2 关键数据或行动卡 + 今天的时间线/待办。
2. **数据管理**：紧凑工具栏 + 表格/列表 + 详情抽屉。
3. **分析页面**：对象切换 + 关键指标 + 图表 + 可行动明细。
4. **编辑页面**：上下文摘要 + 单列/双列表单 + 固定操作区。

手机端宽度按 390px 基准设计：

- 顶部显示页面标题、当前班级/学期和一个主操作。
- 搜索和最常用筛选紧随标题；低频筛选进入底部弹窗。
- 主体以单列列表、时间线、课表或座位图为主。
- 点击对象打开底部弹窗；弹窗操作区固定在底部且不被底部导航遮挡。
- 固定底部导航保持“首页 / 学生 / 作业 / 成绩 / 更多”。
- 页面必须保留底部安全区，不出现横向滚动条。

间距以 4px 基础网格组织，常用节奏为 8 / 12 / 16 / 24 / 32px。标题上方留白大于标题下方，密集表格使用 12px 至 16px 单元格内边距，手机列表行最小高度稳定，不因状态标签出现而跳动。

## Elevation & Depth

系统使用“边框和色面为主、轻阴影为辅”的混合层级。普通卡片和表格保持平面；只有弹窗、底部弹窗、悬浮操作和宣传焦点卡片获得阴影。深度不通过多层卡片嵌套制造。

### Shadow Vocabulary

- **Ambient Card** (`0 4px 14px rgba(16, 47, 56, 0.07)`)：仅用于首页或分析页的重点数据卡。
- **Floating Sheet** (`0 -10px 30px rgba(16, 47, 56, 0.16)`)：手机底部弹窗。
- **Dialog** (`0 18px 46px rgba(16, 47, 56, 0.18)`)：桌面弹窗和重要抽屉。
- **Focus Ring** (`0 0 0 3px rgba(53, 109, 243, 0.22)`)：键盘和输入焦点，不作为普通阴影。

### Named Rules

**平面默认规则。** 静态业务容器默认无阴影；先通过白底、边线和间距建立分区。阴影只表示悬浮、交互或宣传焦点。

**禁止框套框。** 一个区域如果已经由页面分区或表格边界定义，内部工具栏不再额外套独立卡片边框。

## Shapes

控件统一 8px 圆角，主要表面统一 10px，紧凑标签和图标底板可用 6px，状态标签使用胶囊形。除状态标签外，不使用 20px 以上的大圆角矩形。

边框使用 1px `Border Soft`。选中态可以使用模块色边框、浅模块色背景或 3px 左侧色条，但同一组件只选择一种主信号。学生头像缩写和 Emoji 底板为紧凑圆角方形，不扩大成大头像卡。

时间线、课表和座位图可以使用自身几何语言，但必须保持稳定尺寸：课程时间、座位格、工具按钮和状态列不会因内容变化而推动布局。

## Components

### Buttons

- **Shape:** 8px 圆角，桌面高度 36px 至 40px，手机主要操作 40px 至 44px。
- **Primary:** 晴空蓝或当前模块色实底、白字；同一页面或弹窗原则上只有一个。
- **Hover / Focus:** 悬停轻微加深，不缩放；焦点使用明确 3px focus ring；过渡 150ms 至 180ms。
- **Secondary:** 白底、柔和边线、主墨色文字，不使用浅到看不清的渐变。
- **Text:** 低频编辑、复制等可以使用文本按钮，但必须有稳定点击区域。
- **Danger:** 仅删除、禁用、覆盖等不可逆操作使用红色；必须与主操作分离。
- **Icon Use:** 熟悉的关闭、更多、复制、删除等动作优先使用现有图标或清楚文字；Emoji 不承担命令按钮图标职责。

### Chips

- **Style:** 未选为白底边框，选中为模块浅色底 + 模块深色文字 + 明确边框。
- **State:** 分类、状态和模式切换可使用；选项超过 6 个时使用下拉、弹窗或可换行网格，禁止横向拖动条。
- **Count:** 数量与标签放在同一视觉单元中，字号和基线统一。

### Cards / Containers

- **Corner Style:** 10px，内部重复项不再额外做大卡片。
- **Background:** 普通业务容器用纸张白；关键数据卡可使用模块浅色或非常克制的双色渐变。
- **Shadow Strategy:** 只有宣传焦点卡使用 Ambient Card，其余依靠边线。
- **Border:** 1px Border Soft；彩色左边线只用于语义分组或状态。
- **Internal Padding:** 桌面 16px 至 20px，手机 12px 至 16px。
- **Metric Card:** 由短标签、一个关键数字、单位和一句上下文组成；同屏不超过 4 张，数据必须可行动或可解释。

### Inputs / Fields

- **Style:** 白底、1px 边线、8px 圆角，高度 40px；label 固定在字段上方，placeholder 不替代 label。
- **Focus:** 晴空蓝边框 + Focus Ring，不通过布局变化表示。
- **Error:** 红色边框、文本错误和解决方式共同出现；不能只变红。
- **Disabled:** 降低对比但保持可读，同时说明为什么不可编辑。
- **Form Rhythm:** 相关字段并排，长文本单列；手机端避免把桌面四列表单原样压缩。

### Navigation

- **Desktop:** 深墨青侧栏，品牌标记位于顶部。导航为固定 Emoji + 中文标签；当前项使用对应模块色的半透明背景、清楚文字和左侧/底部状态信号。
- **Mobile:** 浅色固定底部导航，Emoji + 中文标签共同出现；当前项使用浅模块色底板。更多页使用 3×N 工具网格，但每个入口保持一致尺寸和固定映射。
- **Context:** 班级切换不与一级导航争抢视觉；低频班级维护进入清楚的班级设置区。
- **No Duplication:** 顶部不再次显示与页面 H1 相同的模块标题。

### Emoji Module Marker

Emoji 是系统的签名识别组件：

- 导航使用 18px 至 20px Emoji，功能入口可使用 22px 至 26px。
- Emoji 置于模块浅色小底板中，始终配中文标签和可访问文本。
- 同一模块在桌面导航、手机导航、更多菜单和页面标题中保持同一 Emoji。
- 正文、状态和表格单元格不随意散落 Emoji。
- 宣传截图固定操作系统和浏览器，因为 Emoji 在 Windows、Android 与 iOS 上会不同。

### Data Visualizations

- 图表使用模块色谱，不默认使用单一蓝色。
- 分数段、作业状态和时间类别使用稳定颜色映射，图例和数据标签必须可读。
- 图表必须连接明细或下一步行动；不为装饰增加无决策价值的饼图。
- 颜色之外同时使用文本、数值、标签或图形位置表达差异。
- 轴、网格和次级标签使用中性灰青，避免彩色信息被背景噪声淹没。

### Lists and Tables

- 桌面高频管理页优先表格，手机优先紧凑列表行。
- 主信息、次信息、状态和操作位置固定，长文本换行或省略后可进入详情查看。
- 操作列只保留当前最常用动作，其余进入更多菜单或详情。
- 选中态使用整行浅色背景或左侧色线，不能只靠小复选框让用户猜测。
- 列表超过 10 条仍应通过搜索、筛选、分页或分段保持可用。

### Dialogs and Mobile Sheets

- 顶部只显示对象、必要上下文和关闭操作。
- 主体按任务分区，不显示重复页面说明和无关统计。
- 手机端使用底部弹窗，桌面端使用对话框或右侧详情面板。
- 主操作固定在底部；复制、删除、配置和维护放在次级区。
- 关闭、保存失败、未保存离开和冲突状态必须有明确反馈。

### Status Badges

- `完成/正常`：青翠绿系。
- `待处理/待确认`：金盏黄系。
- `逾期/失败/危险`：红色系。
- `信息/当前`：晴空蓝系。
- `草稿/阶段输出`：鸢尾紫系。
- `归档/停用`：灰青中性色。

状态文案、颜色和含义全站一致，不能让“蓝色”同时表示已完成、当前选择和待处理。

### Motion

- 常规状态变化 150ms 至 180ms；弹窗和抽屉 180ms 至 220ms。
- 不使用连续漂浮、弹跳或装饰动画。
- 首页可有一次轻量进入编排，列表和表格不逐行延迟出现。
- 遵守 `prefers-reduced-motion`，关闭非必要位移和过渡。

## Do's and Don'ts

### Do:

- **Do** 用深墨青框架稳定品牌，再用模块色帮助辨认任务。
- **Do** 把颜色集中在导航、关键数字、状态、图表、时间线和小面积强调。
- **Do** 在首页、成绩、课程和成长四个样板页建立不同的视觉主体。
- **Do** 让表格、列表、录入和敏感详情保持白底、清楚边线和高密度。
- **Do** 保持 Emoji、中文标签、模块色三者固定映射。
- **Do** 用真实业务状态和真实演示数据构成宣传画面，而不是添加空泛文案。
- **Do** 在 390px、768px、1280px 和 1440px 下验证换行、密度、触控和底部安全区。
- **Do** 让数字、日期、分数和百分比使用稳定对齐。

### Don't:

- **Don't** 复刻同行产品的藏蓝侧栏、蓝色主按钮和布局比例；吸收的是 Emoji + 彩色识别方法，不是其视觉资产。
- **Don't** 把每页都做成“四张统计卡 + 搜索 + 卡片列表”的模板。
- **Don't** 在浅色渐变上使用低对比浅色文字。
- **Don't** 使用厚重阴影、玻璃拟态、渐变光球、紫蓝渐变大背景或 20px 以上大糖果圆角。
- **Don't** 用 Emoji 代替状态文字、命令图标或敏感信息标签。
- **Don't** 把桌面表格和多列表单直接缩小搬到手机。
- **Don't** 用卡片包住工具栏，再用卡片包住列表，形成框套框。
- **Don't** 在同一页面暴露多个同级主按钮，或让复制、配置、删除抢占主操作。
- **Don't** 为了宣传效果公开学生排名、电话、健康和沟通详情。
- **Don't** 在视觉阶段改变保存、认证、数据隔离、路由或业务状态逻辑。

