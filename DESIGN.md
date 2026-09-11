---
name: 班主任工作台
description: 暖白工作纸、浅蓝任务区与原创校园插画组成的日常班务工作台
colors:
  canvas: "#fffdf8"
  surface: "#fff"
  ink: "#17354a"
  muted: "#526a7b"
  primary: "#14778a"
  primary-hover: "#106575"
  soft-blue: "#eaf5fc"
  soft-green: "#edf6ef"
  line: "#cbdce6"
  error: "#b4233d"
  error-soft: "#fcecef"
  warning-soft: "#fff1d4"
  warning-text: "#80500a"
  success-text: "#245f43"
typography:
  body:
    fontFamily: "PingFang SC, Microsoft YaHei, Arial, sans-serif"
    fontSize: "14px"
    lineHeight: 1.55
  page-title:
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.3
  dashboard-title:
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.3
  mobile-dashboard-title:
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.3
  mobile-app-title:
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.35
  dialog-title:
    fontSize: "23px"
    fontWeight: 700
    lineHeight: 1.35
  section-title:
    fontSize: "20px"
    fontWeight: 700
  mobile-section-title:
    fontSize: "19px"
    fontWeight: 700
  metric:
    fontSize: "25px"
    lineHeight: 1.25
  compact-metric:
    fontSize: "22px"
  navigation:
    fontSize: "15px"
  mobile-input:
    fontSize: "16px"
    fontWeight: 400
  secondary-label:
    fontSize: "13px"
  compact-label:
    fontSize: "12px"
rounded:
  tab: "6px"
  control: "8px"
  navigation: "9px"
  task-surface: "12px"
  dashboard-intro: "14px"
  dialog: "16px"
spacing:
  small: "8px"
  medium: "12px"
  regular: "16px"
  section: "20px"
  large: "24px"
  desktop-gutter: "28px"
  spacious: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    padding: "8px 14px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.error}"
    padding: "8px 14px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  tab-selected:
    backgroundColor: "{colors.soft-blue}"
    textColor: "{colors.primary}"
    rounded: "{rounded.tab}"
  task-banner:
    backgroundColor: "{colors.soft-blue}"
    textColor: "{colors.ink}"
    rounded: "{rounded.task-surface}"
    padding: "20px 24px"
  illustrated-page-header:
    backgroundColor: "{colors.soft-blue}"
    textColor: "{colors.ink}"
    rounded: "{rounded.task-surface}"
    padding: "18px 24px"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
  dialog-header:
    backgroundColor: "{colors.soft-blue}"
    typography: "{typography.dialog-title}"
    padding: "20px 24px"
---

# Design System: 班主任工作台

## Overview

**Creative North Star: "校园文具工作台"**

这是 Operate 型班务工作台。暖白工作纸承载表格、列表和录入，浅蓝划出任务与当前选择，粉笔绿用于辅助区域，暖黄用于今日待办与提醒。原创教室晨光、课本黑板和词卡插画提供校园识别；操作文字、学生信息和保存状态保持清楚、紧凑。

本文于 2026-09-11 按已授权的校园全站清理刷新既有设计记录。19 个模块继续使用同一业务数据与页面树；旧深色侧栏、Emoji 模块输出和多色装饰条不再是新增界面的依据。PRODUCT.md 保留的旧视觉描述和 18 模块计数不替代当前源码，本文也不修改产品能力定义。

证据来自 campus 下的 theme、公共原语、Dashboard、ClassSwitcher、StudentLookupDialog、DialogAccessibility、PageHeader.module.css，以及 campus / legacy-theme / shell / controls / surfaces / dashboard / mobile / account 分文件 CSS 和全局字体。已查看本轮桌面首页、考勤、值日、周报及手机首页、学生名单、学生选择截图。独立 review 原五项已记录为 resolved；这只说明所审问题的复审结果。完整状态、交互、构建与回归结论由主任务分别记录，本文不声明全站全部通过，也不证明服务器已更新。

**Key Characteristics:**

- 暖白连续工作面、浅蓝任务标题、粉笔绿辅助区和暖黄待办。
- 教室场景与文具局部插画，配文字的共享线性 SVG。
- 连续指标条、表格与分隔列表，按任务边界分区。
- 浅蓝弹窗头、可见底部动作、明确搜索与分页。
- 校园为当前主题；玻璃仅保留配置类型与资源插槽。

## Colors

前置颜色对应 campus.css 的校园变量，是新增界面的主体系；既有 --wb-* 变量通过桥接继续供业务样式使用。旧 CSS 中的字面颜色、fallback 或单页值不自动成为设计 token。

### Primary

- **青蓝主操作**：primary 用于确认、主要命令、焦点和当前项，primary-hover 用于公共主按钮悬停。
- **浅蓝工作纸**：soft-blue 用于页头、表头、弹窗标题、今日安排与导航选中背景。

### Secondary

- **粉笔绿辅助纸**：soft-green 用于学生近况、辅助名单、岗位侧区与确认状态，success-text 提供深绿文字。

### Tertiary

- **暖黄便笺**：warning-soft 用于今日工作、值日页头与提醒，warning-text 用于相应状态文字。它不只表示错误或危险。
- **批注红**：error 与 error-soft 用于错误、失败及需明确区分的异常状态。

### Neutral

- canvas 是暖白页面底色，surface 是控件、桌面侧栏和数据表面。
- ink 承担标题、正文与数字，muted 承担次要上下文，line 承担表格与必要分隔。

**The Semantic Color Rule.** 状态同时提供文字或选中标志，颜色和插画不能独立承担含义。首页有明确任务含义的浅色分区，不应泛化成每页同款彩色卡片模板。

## Typography

**Body Font:** PingFang SC、Microsoft YaHei、Arial、sans-serif。无独立展示字体、Aptos 或 Emoji 字体契约。全局正文按 body，手机输入按 mobile-input；旧记录把听写的 15px 当成全局正文，现已纠正。听写仍保留局部正文尺度，不代表所有旧页面已经统一。

标题使用中文无衬线粗体。共享工作页头使用 page-title，首页主标题使用 dashboard-title，手机分别使用 mobile-app-title 与 mobile-dashboard-title。弹窗使用 dialog-title，首页分区标题在手机缩为 mobile-section-title。次要说明控制为短句；页头说明最大行宽为 65ch。

连续统计主数字使用 metric，手机与公共简版指标用 compact-metric；数值用 tabular-nums 对齐。前置层级只记录复用角色，不把全部遗留字号纳入认可清单。

## Layout

桌面是分组侧栏与主工作区，主区内边距为 24px 28px 40px。900px 以下隐藏桌面侧栏，主区改为 16px，保留手机底部导航和顶部班级上下文。手机按现场任务单列重排，长列表分页或局部滚动；宽座位图允许局部滚动，不能带动整页横向溢出。

首页引导区桌面为文字加教室插画，插画高 240px；手机插画列宽 120px，动作纵向排列。下方业务概览桌面两列（1.1:1、间距 28px），手机单列（间距 16px）。首页浅色区域是任务分组；操作行和数据行依靠分隔线连接，不嵌套独立卡片。

共享插画页头桌面为文字、动作、160×100px 文具图；901 至 1180px 把动作移到文字下方并缩小插画。900px 以下由手机顶部标题承担定位，桌面页头隐藏。

指标是一条可换行的连续带：模块统计内距 16px 0，底部分隔，桌面每项最小宽 130px、手机 110px；手机考勤四项重新排成四列。不得用每个数字一个浮动面板替代。

弹窗桌面最大高度 calc(100dvh - 40px)，手机为 calc(100dvh - 16px)。标题与内容分区，直接 footer 固定在容器底部滚动边界，手机补 safe-area 内距；这里记录共享样式，不推断所有旧弹窗 DOM 均已迁移。多行输入最小高桌面 100px、手机 120px，不能套单行输入高度。

**仍保留的布局样式负债：** globals.css、workbench-repair.css、页面局部 CSS 和少量内联样式仍承担历史网格、宽度、字号与控件尺寸。legacy-theme 是兼容桥，分文件校园 CSS 按 layout.tsx 顺序覆盖。前置 token 是复用主体系，不是对这些历史几百个数值的整体认可；后续修改应在任务范围内收敛来源并按实际层叠核验，避免追加大范围覆盖。

## Elevation & Depth

普通工作面、公共按钮和侧栏不使用装饰阴影，靠色面、留白与细分隔表达关系。弹窗属于覆盖层，保留结构阴影 `0 16px 48px rgba(23,53,74,.18)`；不能继续把“全站无阴影”写成事实。焦点为 3px primary 实线轮廓与 3px offset，清楚可见且不改变布局。

**The Continuous Work Surface Rule.** 一个连续流程共享工作面；只有真正独立的任务、表格、编辑或辅助区域使用容器。现有公共控件未建立统一动效 token，不从遗留 transition 清单推导新动效规范。

玻璃没有实现：theme.ts 中 glass 为 planned、artwork 为空，resolveTheme 同步固定返回 campus。无公开切换入口、偏好存储或玻璃材质 CSS；校园仍登记为 development。不能把未来模糊、渐变或切换效果写成当前能力。

## Shapes

控件采用 control 圆角，标签页使用 tab，侧栏项使用 navigation。任务区、公共插画页头和辅助区使用 task-surface，首页引导区使用 dashboard-intro。弹窗使用 dialog，手机只保留顶部两角。前置层级来自当前复用样式，不代表遗留圆角全部清零。

状态分段共享一个外边框，内部使用直角和分隔，文字保持不换行；表格与连续列表不为每行添加圆角框。错误词项仅改变状态色和边线，保持原尺寸。

## Components

- **Button**：公共原语支持 primary / secondary / text / danger 四个 intent；桌面最小高 40px、手机 44px，默认内距见前置 token。具有 hover、focus-visible 和 disabled；公共按钮禁用透明度 .5，校园全局控件适配为 .55，最终取决于层叠。loading 由业务传入状态控制，不是独立 API。
- **输入与状态分段**：白底、line 边线、control 圆角，错误字段使用 aria-invalid 和 error 边线。公共样式不等于已有共享 TextField React 组件。状态选择使用稳定尺寸的分段，选中状态必须有文字或强调。值日星期和台账状态保持按钮形式。
- **Dashboard**：从传入数据呈现今日工作、今日安排、值日岗位和学生近况，链接到既有模块。浅色任务区内部使用行动列表、时间列表与表格。数字和“近况”的业务判定不由视觉规范认可，不能把阈值提示包装成客观学生评价。
- **ClassSwitcher**：班级选择可用原生 select，名称与人数同列展示；班级设置用 details 展开，承载班名、年级、学期和增删动作。它是小规模班级枚举，不是全班学生下拉模板。
- **StudentLookupDialog**：默认只显示按学号排序的前 12 名，可用 20 人范围段与每页 12 人浏览；搜索跨全班匹配，姓名与学号是主要入口。选中项有“当前”文字，支持可选清空动作和结果计数。可用于百人班选择，不依赖小组，也不首屏铺满全班。范围段基于排序位置，不能描述为学生号连续性保证。
- **DialogAccessibility**：根布局挂载的兼容适配器，为所匹配弹窗管理激活顺序、Tab 焦点循环、Esc 关闭、背景 inert、滚动锁及关闭后的恢复。它复用已有保存/取消处理；嵌套弹窗优先级按激活顺序。需由实际弹窗提供正确标题关联、关闭动作和结构，不能把适配器存在当作全站无障碍验收证据。
- **弹窗外观**：浅蓝标题、白色内容、底部 sticky 动作；关闭按钮提供可理解标签，单个编辑流程保持一个明确主操作。手机搜索框可见，内容区可滚，底部操作含安全区。
- **CampusIcon / ThemeArtwork**：线性 SVG 使用 24×24 viewBox、1.8 线宽及圆端点；装饰 SVG 隐藏于辅助技术并配真实文字。theme 的 dashboard 槽使用 classroom-morning.webp，dictation / empty 使用 word-cards.webp，roster / homework 使用 study-desk.webp。图片为本地原创资产，缺图返回 null，不能以整页 UI 截图代替素材。
- **PageHeader / MetricStrip / Pager / EmptyState**：工作页头样式已放入校园 PageHeader.module.css，既有 WorkbenchPageHeader 保留业务接口；公共 PageHeader 仍并存。指标、分页与空状态按事实和动作组成；空状态使用小幅词卡，不添加填充性数据。
- **账户与管理员界面**：account.css 复用校园背景、浅蓝表头、粉笔绿分区头、暖黄兑换码工具区与青蓝操作；账户页没有独立插画，不改变权限或账户业务逻辑。管理员手机适配采用 680px 局部断点。主任务已实际打开管理员主界面与手机号弹窗；这不等于权限回归已完成。
- **手机列表与操作**：学生行是连续列表，姓名、学号、小组清楚分层，选中/批量与普通详情动作分开；底部导航保留。听写手机保存区沿用业务模块专用底部定位，不能与通用弹窗 footer 混为同一组件。

## Do's and Don'ts

### Do:

- **Do** 使用校园语义颜色、共享 SVG 和原创校园插画。
- **Do** 以表格、工具栏、指标条和分隔列表组织任务，保留高密度操作。
- **Do** 让搜索、焦点、错误、保存、冲突及只读状态保持可见。
- **Do** 区分源码提取、截图复审、完整状态回归与部署事实。
- **Do** 在改动范围内收敛遗留样式，核对最终层叠和手机可用高度。

### Don't:

- **Don't** 恢复旧深色侧栏、Emoji 模块输出或纯装饰色条。
- **Don't** 把连续流程拆成框套框，或将首页任务区复制成每页同款卡片网格。
- **Don't** 为百人班使用完整名单原生下拉，或让小组成为唯一入口。
- **Don't** 为玻璃主题复制业务页面或提前添加切换器。
- **Don't** 为消除 detector 的 advisory 把全部历史 CSS 值收入规范，也不要据局部截图宣称所有模块状态全部通过。

