---
name: 班主任工作台新界面基础层
description: 记录 workbench/theme 与 workbench/ui 基础及听写批改隔离探针中的使用，不代表生产迁移验收
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

本文件适用于 app/components/workbench 的新 theme / ui 基础层，并记录听写 GradingView 隔离探针对它的使用，记录日期为 2026-09-12。暖白、浅蓝和粉笔绿延续校园粉彩、水彩文具方向，正文与控件以清楚、稳定和可操作为先。它不替代根 DESIGN.md，也不证明旧页面已迁移。

依据为当前 contracts.ts、definitions.ts、ThemeBoundary.tsx、theme.module.css、ui 组件及 CSS Modules，以及 tools/ui-preview/README.md。已查看 evidence-local 中 campus-controls-desktop.png 与 campus-controls-mobile.png；手机图是独立文档内的 390×844 CSS 视口，不能视为真实手机软键盘测试。主任务报告局部 finish reviewer disposition 为 ship，仅限基础层。

本次增量依据为 theme/Artwork.tsx、theme/definitions.ts、app/w/[token]/features/dictation/GradingView.tsx 与 grading.module.css 的源码。新增批改视图仍是隔离探针，不能继承基础层的 ship 结论，也未通过生产接入门禁；生产保留旧批改视图并使用已抽取的共享控制器。下文的批改布局描述是当前实现记录，不是全站构图规范或渲染验收结论。

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

context 用于选择范围和弹窗底部动作区；assist 是辅助区域语义色。批改探针将 context 用于任务说明、词项与保存区，将 assist 用于学生名单；这些用途尚未推广为完整页面构图规范。

### Tertiary

attention / warning 为提醒语义，success 为完成语义；danger / danger-soft 表达错误和危险动作。这里只登记已定义变量，不宣称各语义已在业务页面完整落地。

### Neutral

canvas 是根画布，work 是控件与弹窗表面。ink / muted 分别承载正文和辅助信息；line 是分隔线，control-line 是更清晰的交互控件边线；disabled 使用专用底色，保留可读文字。

**The Semantic State Rule.** 状态必须同时有文字或程序化状态；错误字段使用 aria-invalid 与关联错误信息，选中状态使用 aria-pressed。

玻璃探针在局部主题中替换画布、上下文、辅助色、文字、主色与边线。其 artworkByRole 为空、状态 planned，不属于公开产品色板。

## Typography

正文采用 body 字体栈与行高；按钮继承字号，字重 500、行高 1.4；输入行高 1.5，字段标签字重 600，帮助和错误信息采用 small。

弹窗标题桌面为 dialog-title，600px 以下为 mobile-dialog-title，并允许长标题换行。主题还定义 --wb-heading（32px，600px 以下 26px），当前 ui 原语没有建立使用它的页面标题组件，不能将其当作已经验证的页面标题体系。

批改探针的页面标题使用 --wb-heading，但在 760px 以下局部覆盖为 24px；任务标题桌面 30px、窄屏 24px，当前学生姓名 22px，词项主文 20px。它们属于该探针的局部字号，尚未成为共享标题原语。

## Layout

本基础层不定义全站顶栏、侧栏或 C1–C6 页面构图。按钮、输入和状态分段最小高度均为 44px；Textarea 最小高 112px，可纵向调整。SelectionBar 与动作组支持换行。StatusSegment 保持选项文字不换行，不自动折行或变成下拉；使用者应限定选项数量并验证容器宽度。

批改探针的班级场景采用主操作区加学生名单；名单桌面宽 300px，1050px 以下为 260px，家庭场景只保留主操作区。760px 以下改为单列，名单按展开状态显示在主操作区前方，不是模态抽屉。词项桌面两列、窄屏一列；保存区使用 sticky，窄屏贴底并留 safe-area，仍需验证真实软键盘遮挡。名单每页最多 20 人，列表局部滚动高度上限 420px；搜索、待批改筛选与分页均有文字入口。

任务说明将文字与装饰图分成独立网格列；插画桌面占 38%、窄屏占 34%，图片框高度分别为 178px 和 150px。文字不叠在图上；裁切使用资产声明的 fit 与 focalPoint。此布局没有按缺失素材自动移除图片区列，玻璃主题空素材时的留白仍需评审。打印 CSS 隐藏导航、名单、保存区、切换学生按钮与插画；这不等于打印成品已验收。

Dialog 桌面宽度 min(620px, calc(100% - 32px))，最大高度 calc(100dvh - 32px)；600px 以下宽度与最大高度各减 24px。frame 为纵向 flex，header/footer 不收缩，body 独立 overflow-y:auto；它不是依赖整页滚动的固定按钮。桌面正文内距 24px、标题和底部为 16px 24px；手机统一 16px，底部增加 safe-area。

隔离预览仅监听 127.0.0.1:4207，不加载 vinext、Workers、认证、数据库或旧 CSS，不代理 API，不是正式路由，不应进入部署包。探针保存为模拟；生产旧视图接入共享控制器的行为验证应单独记录，不能由探针保存成功替代。

## Elevation & Depth

普通按钮无阴影；Dialog 使用 --wb-elevation-dialog（0 16px 56px #17354a30），遮罩为 --wb-backdrop（#17354a66）。校园 --wb-material-blur 为 0px；内部玻璃探针仅在支持 backdrop-filter 时将 work 改为 #fffffff0、blur 改为 12px，其他环境保持实色。该降级是源码行为，不等于已完成设备性能验证。

焦点为 3px primary 轮廓、3px offset。按钮背景过渡使用 --wb-motion-duration（120ms）与 ease-out；prefers-reduced-motion 时为 0ms。

**The Material Boundary Rule.** 材质只由主题变量和局部样式控制；ThemeBoundary 不改变 React key，不持有工作区状态。跨主题保持状态的实际保证仍需在具体业务接入后验证。

## Shapes

control 为按钮、字段、分段外框和批量条统一圆角；surface 用于弹窗。分段仅首尾保留圆角，中间选项共享外框。边框承担控件或内容分隔职责，不以重复嵌套容器替代布局。

## Components

- **ThemeBoundary / useWorkbenchTheme**：Boundary 接收 children、可选 definition（默认 campusTheme），通过 Context 提供定义，并输出 data-ui-generation="next" 与 data-theme。resolvePublicTheme 固定返回 campus。此新目录的 campus 状态仍为 development；不继承旧 campus 目录的 ready 标记。探针切换只存在于开发工具。
- **ThemeDefinition / ArtworkAsset**：主题包含 id、status、artworkByRole、blur/reducedMotion 能力声明。ArtworkRole 为 home.scene、dictation.context、student.detail、homework.context、assessment.context、planning.context、care.context、communication.context、organization.context、family.context、empty.first-use、empty.no-results。资产契约包含 src、可选 mobileSrc、尺寸、fit、focalPoint、safeTextArea、decorative:true 和 candidate/ready 状态。campus 目前仅分配 dictation.context 候选素材（/art/campus/dictation-stationery-v2.png，1666×944，cover，焦点 85% 50%，safeTextArea:left，status:candidate），未升级为 ready；其余角色与 glass 映射仍为空。
- **Artwork**：按 role 从当前 ThemeBoundary 读取素材；缺失时返回 null，不跨主题回退到校园插画。输出空 alt、aria-hidden 的装饰性 img，消费 src、尺寸、fit 与 focalPoint；当前不消费 mobileSrc 或 safeTextArea，也不按 candidate/ready 过滤。safeTextArea 是资产元数据，不会自动保留文字安全区；candidate 能在探针渲染不等于生产授权。
- **GradingView（隔离探针）**：通过共享 useGradingController 获取批改状态，复用 Button、Field、Input、Select、Icon 与 Artwork；页面只请求 dictation.context，不硬编码校园资产路径。班级与家庭复用业务控制器和批改字段，家庭省略名单和上一位/下一位；换主题只改变基础层与素材定义。学生名单、错词复选框、参与状态、备注、确认与保存组成当前实现，业务可靠性、交互和生产混合样式仍须独立审核。
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
- **Do** 按 role 请求装饰素材，核实实际容器裁切后再评定 candidate；渐进迁移时分别审核共享业务、局部视图和正式接入。

### Don't:

- **Don't** 把玻璃探针公开为完成的第二主题，或声称已有生产插画。
- **Don't** 把 busy、dirty、aria 属性的存在当作完整业务控制器。
- **Don't** 将本次基础层 ship 等同于全站 UI、C1–C6 或新旧混合样式验收通过。
- **Don't** 将内嵌手机视口当作真实软键盘、真实网络或设备性能验证。

尚未验证：真实手机软键盘遮挡、新旧 CSS 混合环境、全站 C1–C6 构图与交互。当前有听写候选素材和独立批改视图探针，但没有据此完成新视图生产接入或素材 ready 评定。后续按页面逐步审计和迁移，不将此次源码记录当作生产验收。按本任务范围仅更新此 DESIGN.md，不更新根规范或额外 sidecar。
