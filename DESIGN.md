---
name: 班主任工作台
description: 校园插画、暖白工作纸与浅蓝任务区组成的日常班务工作台
colors:
  canvas: "#fafcfb"
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
    fontSize: "15px"
    lineHeight: 1.6
  page-title:
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.3
  mobile-page-title:
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.3
  section-title:
    fontSize: "19px"
    fontWeight: 700
  metric:
    fontSize: "22px"
  label:
    fontSize: "14px"
rounded:
  control: "8px"
  tab: "6px"
  illustrated-header: "10px"
  banner: "12px"
spacing:
  small: "8px"
  medium: "12px"
  regular: "16px"
  large: "24px"
  spacious: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
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
    padding: "8px 12px"
  tab-selected:
    backgroundColor: "{colors.soft-blue}"
    textColor: "{colors.primary}"
    rounded: "{rounded.tab}"
  task-banner:
    backgroundColor: "{colors.soft-blue}"
    textColor: "{colors.ink}"
    rounded: "{rounded.banner}"
    padding: "20px 24px"
---

# Design System: 班主任工作台

## Overview

**Creative North Star: "校园文具工作台"**

暖白画布承载日常班务，浅蓝标识任务与当前选择，粉笔绿容纳班级上下文和批改辅助区，暖黄仅作提醒。原创课桌、书本和词卡 WebP 提供校园气氛；表格、表单与操作文字保持清楚、紧凑。

本文于 2026-09-11 按当前校园主题源码更新原设计记录。旧版“深墨青侧栏、Emoji 模块标记、多色模块谱”不再是新增界面的视觉依据；保留其工作台优先、数据密度、明确操作和避免框套框的原则。根 PRODUCT.md 的旧视觉描述只作历史背景。

证据范围为 campus/theme.ts、primitives.tsx、campus.css、legacy-theme.css、听写 dictation.css、WorkbenchPageHeader.module.css 与全局字体声明；渲染参考为桌面学生名单和 390px 手机听写批改两张截图。独立审查的四项反馈已 resolved，disposition 为 ship，仅适用于这两张代表截图；不表示全站视觉覆盖、功能回归、构建或部署已验证。主题注册仍为 campus=development。

**Key Characteristics:**

- 暖白连续工作面与浅蓝任务标题区。
- 粉笔绿辅助信息区、小面积暖黄提醒。
- 原创文具插画与共享线性 SVG 分工明确。
- 表格、工具栏、横向指标条优先，避免重复包框。
- 业务树共享，玻璃主题仅预留配置。

## Colors

前置 token 对应实际校园 CSS 变量；旧 --wb-* 语义变量通过桥接复用它们。

### Primary

- **青蓝主操作**：primary 用于校园主按钮、焦点与当前项；primary-hover 为主按钮悬停。
- **浅蓝工作纸**：soft-blue 用于表头、任务横幅、词项和导航选中背景。

### Secondary

- **粉笔绿**：soft-green 用于班级切换、批改学生辅助名单及确认区域；success-text 提供深色状态文字。

### Tertiary

- **暖黄提醒**：warning-soft 搭配 warning-text。
- **错误红**：error 配合 error-soft、复选框与错误文字，区分错词及失败信息。

### Neutral

- canvas 是连续页面底色，surface 是控件和数据表面。
- ink 承担正文、标题、数字；muted 承担上下文和辅助文字；line 连接表格与必要分隔。

**The Semantic Color Rule.** 颜色同时配合文字、选中标志或下划线表达状态，不用装饰图承担唯一功能含义。

## Typography

全局实际字体栈为 PingFang SC、Microsoft YaHei、Arial、sans-serif，当前未建立独立展示字体。前置 body 记录听写正文；这不是所有遗留页面字号已经统一的声明。

校园 PageHeader 的桌面标题采用 page-title，900px 以下采用 mobile-page-title；既有 WorkbenchPageHeader 普通标题为 24px，插画标题为 28px，并在手机外壳下隐藏以避免重复标题。听写正文在手机变为 16px，章节标题 19px；指标数字 22px，使用 tabular-nums。插画内文字与实际控件排版分开。

## Layout

桌面仍使用分组侧栏与内容区；桥接层设内容内边距 24px，900px 以下为 16px。公共工具栏和动作区可换行，指标条以分隔线连接连续工作面。

听写批改桌面为主任务加 250px 辅助名单，1100px 以下辅助列为 210px、词项改单列；900px 以下隐藏桌面名单并使用手机选人区域。桌面保存条 sticky，手机保存条 fixed、底部距 60px 并保留 safe-area，主保存按钮独占一行。听写表格保留 620px 最小宽度并在局部滚动，不能据此要求整个页面横向滚动。

手机批改隐藏重复页面标题、上下文与 tabs，优先展示当前任务和学生；任务标题为 23px / 1.3，配 132×96px 词卡插画，词数保持不换行。手机布局能力按具体页面验证，不能从共享桥接推断所有模块均适配完成。

## Elevation & Depth

校园公共按钮、侧栏与语义表面阴影为 none；主要依靠浅色面、留白和细分隔。任务横幅是独立语义区，工具栏无需再包一层卡片。焦点通过 3px primary 实线轮廓和 3px offset 表达，不改变几何布局。

**The Continuous Work Surface Rule.** 一个连续操作流程优先共享工作面；只有任务、表格、编辑或辅助信息的真实边界使用独立容器。

玻璃材质尚未实现。theme.ts 只有 glass 的类型、planned 状态与空 artwork 槽；resolveTheme 同步固定返回 campus，没有主题切换入口、偏好存储或玻璃 CSS。不得把资料包的未来渐变、模糊与切换状态保持要求写成现有能力。

## Shapes

公共按钮与听写输入为 control 圆角，tabs 为 tab 圆角；浅蓝任务横幅和既有插画页头分别采用 banner 与 illustrated-header。听写错误词条仍保持原尺寸，通过边线和错误底色改变状态。普通业务分区不因视觉整理添加嵌套圆角框。

## Components

- **Button**：已实现 primary / secondary / text / danger 四个 intent。默认 min-height 40px，手机 44px；支持 hover、focus-visible 与 disabled（opacity .5），loading 需业务端提供，并非独立 API。
- **输入与选择**：听写控件 min-height 42px，标签 14px，白底与 line 边线。尚无新增共享 TextField 组件，不把 CSS 规则表述为统一组件 API。
- **CampusIcon**：共享 24×24 viewBox、1.8 线宽、圆端点和圆连接。语义名称映射到固定 path，旧 Emoji 仅可作为映射输入；输出为 aria-hidden SVG，应配文字标签。
- **ThemeArtwork**：按 dashboard / dictation / roster / homework / empty 槽取本地资源。现有 study-desk.webp 与 word-cards.webp 为独立原创素材；缺资源返回 null。装饰图 alt 为空、aria-hidden，禁用指针事件；不以整页 UI 截图代替资产。
- **PageHeader / WorkbenchPageHeader**：新公共标题与既有标题组件并存；按页面上下文呈现动作和可选文具图；既有插画页头使用 174×112px 图片置于 174×90px marker，标题 28px，手机避免重复标题。不能宣称旧页头已全部迁移。
- **MetricStrip / Pager / EmptyState**：横向可换行指标、明确计数和禁用前后页、事实说明加动作。无需泛化成卡片网格。
- **Tabs 与状态标签**：tabs 的 aria-pressed 选中项用浅蓝、粗体与下划线；听写标签为浅绿深绿文字。两者当前以 CSS 模式存在，不是独立导出的 React 原语。
- **批改词项与保存区**：原生 checkbox 表示错词，错误底色与文字共同提示；保存区与业务保存状态相连，不能把“未勾选”解释为已确认批改。
- **主题边界**：保留同一业务组件树，不复制 ClassroomApp 或路由。玻璃仅配置类型和资源插槽预留，未验收之前不添加公开切换入口。

## Do's and Don'ts

### Do:

- **Do** 复用校园语义变量、共享 SVG 和公共操作组件。
- **Do** 让原创插画服务任务识别，手机批改优先保留有效工作高度。
- **Do** 保持表格、工具栏、指标条和单列移动流程的操作密度。
- **Do** 将截图审查、功能回归、构建与部署分别记录，限定已验证范围。

### Don't:

- **Don't** 把旧深色侧栏和 Emoji 输出继续当作新主题签名。
- **Don't** 把一个连续流程拆成层层套叠的装饰卡片。
- **Don't** 为玻璃主题复制业务页面或提前展示切换器。
- **Don't** 把资料包初值、未实现组件或全站统一性写成已验证事实。

