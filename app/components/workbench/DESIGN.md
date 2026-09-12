---
name: 班主任工作台新界面基础层
description: 仅记录 workbench/theme 与 workbench/ui 的隔离组件基础，不代表全站设计交付
colors:
  canvas: "#fffdf8"
  work: "#ffffff"
  context: "#eaf5fc"
  assist: "#edf6ef"
  attention: "#fff1d4"
  ink: "#17354a"
  muted: "#526a7b"
  primary: "#14778a"
  primary-hover: "#106575"
  on-primary: "#ffffff"
  danger: "#b4233d"
  danger-soft: "#fcecef"
  success: "#245f43"
  warning: "#80500a"
  line: "#cbdce6"
  control-line: "#8aa4b5"
  disabled: "#e9edf0"
typography:
  body:
    fontFamily: "PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  small:
    fontSize: "13px"
  dialog-title:
    fontSize: "22px"
    lineHeight: 1.4
  mobile-dialog-title:
    fontSize: "20px"
rounded:
  control: "10px"
  surface: "18px"
spacing:
  small: "8px"
  control: "12px"
  group: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.work}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-danger:
    backgroundColor: "{colors.work}"
    textColor: "{colors.danger}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  input:
    backgroundColor: "{colors.work}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  selection-bar:
    backgroundColor: "{colors.context}"
    rounded: "{rounded.control}"
    padding: "{spacing.group}"
  dialog:
    backgroundColor: "{colors.work}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
---

# Design System: 新界面局部基础层

## Overview

**Creative North Star: "校园工作纸上的清晰操作"**

本文件仅适用于 app/components/workbench 的新 theme / ui 基础层，记录日期为 2026-09-12。暖白、浅蓝和粉笔绿延续校园方向，正文与控件以清楚、稳定和可操作为先。它不替代根 DESIGN.md，也不证明旧页面已迁移。

依据为当前 contracts.ts、definitions.ts、ThemeBoundary.tsx、theme.module.css、ui 组件及 CSS Modules，以及 tools/ui-preview/README.md。已查看 evidence-local 中 campus-controls-desktop.png 与 campus-controls-mobile.png；手机图是独立文档内的 390×844 CSS 视口，不能视为真实手机软键盘测试。主任务报告局部 finish reviewer disposition 为 ship，仅限基础层。

**Key Characteristics:**

- 16px 正文、最小 44px 按钮与单行控件。
- 语义色与 CSS Modules，主题变量限定在 ThemeBoundary。
- 共享线性 SVG；状态、字段和批量范围有明确文字。
- 原生 modal dialog，正文滚动，标题和动作区保留空间。
- 校园唯一公开主题；玻璃仅内部材质探针。

## Colors

前置颜色对应 theme.module.css 的 --wb-* 变量；仅描述新基础层校园默认值，不能据此推断与旧全局变量混合后的最终表现。

### Primary

primary 用于主命令、选中状态与键盘焦点；primary-hover 用于主按钮悬停，on-primary 为其文字。

### Secondary

context 用于选择范围和弹窗底部动作区；assist 是辅助区域语义色。基础层尚未建立完整页面构图。

### Tertiary

attention / warning 为提醒语义，success 为完成语义；danger / danger-soft 表达错误和危险动作。这里只登记已定义变量，不宣称各语义已在业务页面完整落地。

### Neutral

canvas 是根画布，work 是控件与弹窗表面。ink / muted 分别承载正文和辅助信息；line 是分隔线，control-line 是更清晰的交互控件边线；disabled 使用专用底色，保留可读文字。

**The Semantic State Rule.** 状态必须同时有文字或程序化状态；错误字段使用 aria-invalid 与关联错误信息，选中状态使用 aria-pressed。

玻璃探针在局部主题中替换画布、上下文、辅助色、文字、主色与边线。其 artworkByRole 为空、状态 planned，不属于公开产品色板。

## Typography

正文采用 body 字体栈与行高；按钮继承字号，字重 500、行高 1.4；输入行高 1.5，字段标签字重 600，帮助和错误信息采用 small。

弹窗标题桌面为 dialog-title，600px 以下为 mobile-dialog-title，并允许长标题换行。主题还定义 --wb-heading（32px，600px 以下 26px），当前 ui 原语没有建立使用它的页面标题组件，不能将其当作已经验证的页面标题体系。

## Layout

这是组件层，不定义新页面、顶栏、侧栏或 C1–C6 页面构图。按钮、输入和状态分段最小高度均为 44px；Textarea 最小高 112px，可纵向调整。SelectionBar 与动作组支持换行。StatusSegment 保持选项文字不换行，不自动折行或变成下拉；使用者应限定选项数量并验证容器宽度。

Dialog 桌面宽度 min(620px, calc(100% - 32px))，最大高度 calc(100dvh - 32px)；600px 以下宽度与最大高度各减 24px。frame 为纵向 flex，header/footer 不收缩，body 独立 overflow-y:auto；它不是依赖整页滚动的固定按钮。桌面正文内距 24px、标题和底部为 16px 24px；手机统一 16px，底部增加 safe-area。

隔离预览仅监听 127.0.0.1:4207，不加载 vinext、Workers、认证、数据库或旧 CSS，不代理 API，不是正式路由，不应进入部署包。所有保存为模拟，没有生产保存逻辑改动。

## Elevation & Depth

普通按钮无阴影；Dialog 使用 --wb-elevation-dialog（0 16px 56px #17354a30），遮罩为 --wb-backdrop（#17354a66）。校园 --wb-material-blur 为 0px；内部玻璃探针仅在支持 backdrop-filter 时将 work 改为 #fffffff0、blur 改为 12px，其他环境保持实色。该降级是源码行为，不等于已完成设备性能验证。

焦点为 3px primary 轮廓、3px offset。按钮背景过渡使用 --wb-motion-duration（120ms）与 ease-out；prefers-reduced-motion 时为 0ms。

**The Material Boundary Rule.** 材质只由主题变量和局部样式控制；ThemeBoundary 不改变 React key，不持有工作区状态。跨主题保持状态的实际保证仍需在具体业务接入后验证。

## Shapes

control 为按钮、字段、分段外框和批量条统一圆角；surface 用于弹窗。分段仅首尾保留圆角，中间选项共享外框。边框承担控件或内容分隔职责，不以重复嵌套容器替代布局。

## Components

- **ThemeBoundary / useWorkbenchTheme**：Boundary 接收 children、可选 definition（默认 campusTheme），通过 Context 提供定义，并输出 data-ui-generation="next" 与 data-theme。resolvePublicTheme 固定返回 campus。此新目录的 campus 状态仍为 development；不继承旧 campus 目录的 ready 标记。探针切换只存在于开发工具。
- **ThemeDefinition / ArtworkAsset**：主题包含 id、status、artworkByRole、blur/reducedMotion 能力声明。ArtworkRole 为 home.scene、dictation.context、student.detail、homework.context、assessment.context、planning.context、care.context、communication.context、organization.context、family.context、empty.first-use、empty.no-results。资产契约包含 src、可选 mobileSrc、尺寸、fit、focalPoint、safeTextArea、decorative:true 和 candidate/ready 状态。两个主题映射均为空；没有已分配生产素材，也没有实现这些资产字段的渲染组件。
- **Button**：接受原生 button 属性及 intent（primary / secondary / text / danger）、busy；默认 secondary、type="button"。busy 合并到 disabled 并输出 aria-busy，不自动改变文字或生成进度图标。danger 默认白底有边线，不应照抄旧版无边框危险按钮规则。
- **Field / Input / Textarea / Select**：Field 接收 id、label、hint、error、required、children；Input 等接收原生属性与 hint/error，通过 id 关联描述并设置 aria-invalid。调用者必须将同一 id 和 hint/error 传给包装与控件；Field 不克隆 children 或自动注入属性。required 在 Field 中只显示星号，原生 required 需另传给控件。Select 不应被用于完整百人学生名单。
- **StatusSegment**：泛型字符串 value，接收 label、options、value、onChange、disabled；输出 role="group" 和带 aria-pressed 的原生按钮。它不是 radiogroup，不提供方向键单选组行为。
- **SelectionBar**：接收 count、scopeLabel、busy、actions、onClear；count 为 0 不渲染，显示人数与选择范围。busy 只禁用内置清空按钮；外部 actions 的禁用、保存及跨页选择策略由调用者负责。
- **Dialog**：受控 open、title、children、可选 footer、busy、dirty、onRequestClose。使用 showModal/close，标题通过 aria-labelledby 关联；原生模态负责焦点限制和背景 inert，关闭时尝试恢复触发元素。Escape、遮罩起始点击和关闭按钮统一请求 escape / backdrop / button；busy 阻止这些请求。dirty 仅输出 data-dirty，确认放弃草稿必须由控制器处理，不能宣称组件自动保存或自动确认。
- **Icon**：name 查共享 iconPaths，未知名称回退 book；24×24 viewBox、1.8 线宽、圆端点和圆连接。SVG 为 aria-hidden、focusable=false，操作语义需由按钮或文本提供。

## Do's and Don'ts

### Do:

- **Do** 将新组件放在 ThemeBoundary 中，复用语义变量与 CSS Modules。
- **Do** 明确绑定字段 id、错误描述、选择范围和关闭请求处理。
- **Do** 在具体页面接入后重新检查焦点、长文、窄屏和真实保存状态。
- **Do** 区分局部截图通过、原生组件机制、业务集成与生产部署。

### Don't:

- **Don't** 把玻璃探针公开为完成的第二主题，或声称已有生产插画。
- **Don't** 把 busy、dirty、aria 属性的存在当作完整业务控制器。
- **Don't** 将本次基础层 ship 等同于全站 UI、C1–C6 或新旧混合样式验收通过。
- **Don't** 将内嵌手机视口当作真实软键盘、真实网络或设备性能验证。

尚未验证：真实手机软键盘遮挡、新旧 CSS 混合环境、全站 C1–C6 构图与交互；尚未完成新页面接入和生产素材分配。本次没有新增正式业务页面或修改生产保存逻辑。按本任务范围只生成此 DESIGN.md，不更新根规范或额外 sidecar。
