---
name: 考试反思 P02 · 隔离设计稿
description: 保留 C01 学生工作面，新增跨考试记录库与连续阅读详情；仅记录隔离稿已实现设计。
colors:
  primary: "#087e82"
  primary-hover: "#066a6d"
  ink: "#15334a"
  muted: "#4d667d"
  exam-mint: "#eef7f0"
  action-blue: "#edf7fd"
  selected-blue: "#eaf5fc"
  paper: "#ffffff"
  field-border: "#bdcedb"
  divider: "#d6e2ea"
  draft-bg: "#fff0cf"
  draft-ink: "#805311"
  complete-bg: "#e4f3e7"
  complete-ink: "#27633c"
typography:
  display:
    fontFamily: "'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontSize: "21px"
    fontWeight: 700
  body:
    fontSize: "15px"
    lineHeight: 1.6
  field:
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.7
  reading-title:
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.35
  reading-body:
    fontSize: "17px"
    lineHeight: 1.85
  mobile-field:
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  flat: "0px"
  status: "4px"
  control: "5px"
spacing:
  small: "8px"
  control-gap: "10px"
  section: "16px"
  desktop-column: "26px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  field:
    backgroundColor: "{colors.paper}"
    typography: "{typography.field}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  exam-context:
    backgroundColor: "{colors.exam-mint}"
    rounded: "{rounded.control}"
    padding: "16px 20px"
  reading-action:
    backgroundColor: "{colors.action-blue}"
    rounded: "{rounded.status}"
    padding: "22px 20px"
  action-field:
    backgroundColor: "{colors.action-blue}"
    rounded: "{rounded.status}"
    padding: "10px 12px"
---

# Design System: 考试反思 P02

## Overview

**Creative North Star: "把下一步写进复盘本"**

考试与学生先提供具体上下文，老师在连续工作面中把问题、原因和行动写清楚。白色工作台、海军蓝文字、薄荷绿考试区与浅蓝行动区保持清楚的阅读顺序；笔记本插画为记录工作提供温和的主题线索。

当前 P02 保留 C01 学生工作面，已保存反思改为独立跨考试记录库和连续阅读详情。范围只到本页隔离实现与预览，不替代根目录 DESIGN.md，不定义全站新主题。命名与气氛描述据现有实现归纳，并非额外取得用户创意批准。

**Key Characteristics:**
- 学生状态保留桌面队列与填写并排、手机进入独立编辑。
- 保存库采用桌面整幅表格、手机记录列表，阅读与编辑明确分开。
- 薄荷绿标记考试上下文，浅蓝强调下一步行动。
- 保存结果原位反馈，真正失败提供恢复动作。
- 按记录 id 保留跨考试与未关联历史内容，返回保留筛选与页码。

**The Evidence Rule.** 源码和实际行为优先于生成图中的导航、字体、字数和分页示意；技术 PASS 只表示可交审。

依据：ReflectionDesign.tsx、SavedReflectionViews.tsx、ReflectionDesign.module.css、useReflectionDesignController.ts、tools/ui-preview/reflection.html 的设计合同和根目录 PRODUCT.md。用户已确认 C01 三张学生工作面方向图及 C02 四张保存库/详情候选图，并授权制作隔离 P02 网页；P02 实际页面尚未获用户审美批准，未完成完整 D/R，未正式接入或部署。历史 P01 的 finish-review-P01.md 曾给出仅供交用户审阅的 PASS，F1/F2 resolved；该历史结论不自动覆盖 P02。

本文实际查看 docs/page-designs/V4/reflection/screenshots/p02-final/ 下 1536-saved-library.png、1536-saved-detail.png、390-saved-library.png、390-saved-detail.png。独立 reviewer 补充的 proof-audit/390-detail-bottom.png、390-library-bottom.png、390-editor-bottom.png 已证明三种手机底部内容可达，920-library-bottom.png 展示完整窄桌面库；15 项 proof 检查通过，p02-long-labels-final 两张长姓名/考试证据无溢出或异常。这些是父任务转交的复核结果，文档整理者未逐张另行查看；最终 finish verdict 为技术 PASS，F1–F4 resolved，仅可交用户实际审阅。

## Colors

### Primary

深青色 primary 用于完成归档、详情编辑、文字动作、当前标签及焦点；primary-hover 用于主按钮悬停。不以位移表达状态变化。

### Secondary

exam-mint 用于当前考试、手机编辑学生上下文及详情关联考试带。保存库没有当前考试带，详情只显示该条记录关联考试；不在详情顶部添加多余薄荷绿概览卡。action-blue 用于连续填写或阅读中的下一步行动、桌面本次成绩摘要及手机保存库范围说明。selected-blue 用于当前队列行与保存库表头。

### Tertiary

draft-bg / draft-ink 与 complete-bg / complete-ink 配对表示草稿和已完成，并始终保留文字。重点跟进也有文字说明。

### Neutral

paper 承载主工作面，ink 用于标题正文，muted 用于日期、学号和说明；field-border 界定可输入范围，divider 分开列表行与动作区。

**The Context Color Rule.** 色块必须指向考试、选择、行动或状态，不用彩色容器重复包装五个字段。

## Typography

字体继承现有 ThemeBoundary 中文无衬线栈，没有新字体加载。frontmatter 记录桌面主要层级。学生工作面沿用主标题 34px（手机 28px）、学生标题 25px（手机 23px）与输入 14px（手机 16px）。

P02 保存库标题 25px；桌面记录姓名 17px、摘要 15px，手机姓名 20px、摘要 15px。详情标题使用 reading-title，窄桌面 28px、手机 25px；字段标题桌面 25px、手机 21px；阅读正文使用 reading-body，手机 16px / 1.8。阅读段落最大 78ch，保留换行并允许任意长词折行；库中问题与行动各截为最多两行，全文在详情中阅读。

11–14px 辅助文字和固定编辑动作说明的 11px 是实际密度取舍，字号 advisory 不代表所有用户可读性达标。

**The Readable Writing Rule.** 手机输入使用 mobile-field；长内容自然换行并滚动，不能通过删字段或缩小整页维持首屏。

## Layout

共享白色 WorkbenchShell 与手机五项底栏保持。桌面本页内边距 26px 30px 36px，901–1200px 为 22px。C01 学生工作面保留 300px 队列、26px 列距，窄桌面为 240px / 20px；900px 及以下采用专用手机队列与编辑状态。学生分页桌面 10 人、手机 8 人，考试选择器每页 10 场。

P02 保存库占据主区宽度，不并列学生队列或空编辑面板。桌面表格依次为日期、学生与考试、问题及行动摘要、状态、操作；搜索、考试筛选、状态筛选、重置位于同一工具栏。保存库桌面每页 6 条、手机每页 3 条，按真实筛选结果计算页数，记录日期降序。900px 及以下隐藏表头和单独日期列，把考试与日期放在姓名下面，状态右对齐，摘要及动作在后续行；搜索独占一行，两个筛选与重置另排一行。901–1200px 表格使用窄桌面列宽，包含间距与内边距的最小宽度为 616px；920px 含共享侧栏的补充实测显示完整可达，无需 CSS 修复。

详情为独立连续阅读工作面：返回、学生与状态、日期、关联考试、五字段及归档说明。只有下一步行动加浅蓝底；家长话语和班主任跟进桌面并列（间距 40px），手机纵向。编辑另开连续表单，桌面最大宽度 1100px，成功保存后返回详情。

手机详情复制/编辑操作固定在底栏上方（bottom:62px，左右 16px，z-index:30），详情追加 74px 底部空间，本页另有 90px 底部内边距。手机编辑动作条沿用同一底栏位置，编辑器追加 130px 底部空间。补充滚动证据已证明详情、记录库与编辑末字段可达；首屏截图本身不提供此证明。真实软键盘、动态视口、安全区和放大仍未全面验证。

**The Continuous Work Rule.** 桌面学生选择与编辑并列，保存库先阅读再明确编辑；手机一次处理一个记录，返回保留库中筛选与页码。

## Elevation & Depth

主工作面、列表和行动区以底色与细线分区，无浮起卡片阴影。搜索聚焦使用内描边；其它本页控件为外偏移 2px 的 2px 青色 outline，强制色模式搜索补系统 Highlight。弹窗沿用共享 Dialog。复制短提示为固定角落浮层；普通保存成功以原位“已保存”呈现，不插入恢复横条。

**The In-place Feedback Rule.** 正常保存通过按钮忙碌态和原位状态呈现；失败和冲突保留明确错误、重试和恢复入口。

## Shapes

输入、按钮与考试带采用 control 小圆角，状态、表头与行动区使用 status。队列行、记录行与标签下划线保持 flat。边框用于输入、分隔和状态定位，不建立卡套卡结构。

本次引用 .qa-shots/reflection-p02-detector.json 的一次检测，文档阶段不重跑：标签底部 3px 线是 radius:0 的选中下划线，属于已知圆角/粗边框规则警告；局部色板、4/5px 圆角与字号是 token advisories。它们不等于用户批准或无障碍通过。

## Components

- **按钮：** 表单以完成并归档为唯一强主动作，保存草稿为次动作；详情以编辑反思为主动作、复制为次动作。桌面详情按钮至少 42px 高，手机至少 44px；库内文字动作桌面 32px、手机 36px。禁用使用半透明与禁用语义，未宣称所有触控目标达标。
- **输入：** 五项为主要问题、原因分析、下一步行动、写给家长的话、班主任跟进；主要问题必填，后两项选填。日期可编辑。textarea 桌面最小 76px，手机 83px，可纵向调整；复合搜索焦点由外框统一呈现。
- **页内导航：** 学生状态仅针对当前考试，已保存反思覆盖本班全部考试。aria-pressed 按钮表达当前视图，不伪称完整 ARIA tablist。学生状态保留姓名、学号、重点跟进、搜索和状态过滤。
- **记录库：** 按记录 id 枚举并展示学生、考试、记录日期、问题/行动摘要及状态；可搜索学生、考试和五字段内容，筛选全部考试、某场考试或未关联考试。查看反思进入阅读详情；有关联考试的草稿在可编辑状态下提供继续编辑。空库返回学生状态，无匹配结果提供重置筛选。
- **连续详情：** 完整呈现全部五字段，空值显示未填写；不把只读内容装进禁用输入框。返回库保持已有查询、考试、状态与页码；复制保留五字段。未关联记录仍可直接阅读与复制，选择“关联考试并编辑”后必须明确选定考试，保存才确认关联，保留原 id 并排除重复目标。
- **成绩与考试上下文：** 成绩只指本次考试，空值不等于零。考试选择器保留搜索、科目、年月、排序及分页；不复制候选图的假数据与页数。
- **保存与恢复：** save 确认成功后才设置已保存；失败保留本机反思、显示错误并允许重试，冲突保留导出草稿与载入最新确认。切换学生、考试、视图、返回及离开均保留脏编辑守卫。归档到校内沟通记录，不自动发送家长。待同步数据中的本机已完成状态不等于服务器确认。
- **插画：** notebook-p01.png 为沿用生成装饰图，空 alt；库和学生页头可见，阅读与保存库编辑隐藏。桌面 210×116px、窄桌面宽 150px、手机 95×75px；文件 1,686,797 bytes，压缩与真实性能优化尚未完成。

sidecar 保留基础视觉样本，新增 P02 桌面/手机记录和连续阅读样本；独立 HTML/CSS 只用于文档面板，不执行 React 业务。实现中的局部 CSS 变量只在本页作用域，样本使用真实色值作为后备值。

验证记录由父任务提供：26 项混合 DOM/controller 交互、既有 28 项回归与 37 项单元/工作流检查通过；本文不重跑或将其改称全部真实用户操作。P02 独立 finish reviewer 已补齐手机底部、920px 与长标签证据，15 项 proof 检查通过；最终审阅 verdict 为技术 PASS，F1–F4 resolved，用户实际审美仍待审核。历史 P01 的 14 项合成补充检查仅属于当时验证。真实服务器保存、多设备 409、物理键盘、读屏、软键盘、文字缩放、原生下拉跨平台、数值对比度与全站 qa:strict 未获本次验证。

## Do's and Don'ts

### Do:
- **Do** 保留白色共享壳层与手机现有底栏。
- **Do** 保留全部五字段、日期、成绩入口、跨考试历史库和真实失败恢复。
- **Do** 以实际渲染、源码和保存确认区分设计方向与运行事实。
- **Do** 让长内容、分页和末字段可滚动到固定动作栏上方。

### Don't:
- **Don't** 将 C01/C02 候选方向确认或技术 PASS 写成 P02 用户审美批准。
- **Don't** 按当前考试过滤掉全班历史库中的未关联记录。
- **Don't** 用候选图的导航、字体、字数或分页数覆盖现有实现。
- **Don't** 为每次正常保存插入恢复横条，或把归档描述成自动发送家长。
