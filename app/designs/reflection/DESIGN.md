---
name: 考试反思 P01 · 隔离设计稿
description: 当前考试与学生上下文中的连续反思工作面；仅记录本页已实现设计。
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
  action-field:
    backgroundColor: "{colors.action-blue}"
    rounded: "{rounded.status}"
    padding: "10px 12px"
---

# Design System: 考试反思 P01

## Overview

**Creative North Star: "把下一步写进复盘本"**

考试与学生先提供具体上下文，老师在连续工作面中把问题、原因和行动写清楚。白色工作台、海军蓝文字、薄荷绿考试区与浅蓝行动区保持清楚的阅读顺序；笔记本插画为记录工作提供温和的主题线索。

这是本页 P01 的实施记录，范围只到 `app/designs/reflection` 及隔离预览，不替代根目录 DESIGN.md，不定义全站新主题。命名与气氛描述由文档整理者据现有实现归纳，并非额外取得用户创意批准。

**Key Characteristics:**
- 桌面队列与连续填写并排，手机队列进入独立编辑。
- 薄荷绿标记考试上下文，浅蓝强调下一步行动。
- 保存结果原位反馈，真正失败提供恢复动作。
- 历史库按反思记录保留跨考试与未关联内容。

**The Evidence Rule.** 源码和实际行为优先于生成图中的导航、字体、字数和分页示意；技术 PASS 只表示可交审。

依据：`ReflectionDesign.tsx`、`ReflectionDesign.module.css`、`useReflectionDesignController.ts`、`../../../tools/ui-preview/reflection.html` 的设计合同及根目录 PRODUCT.md。用户“确认”仅确认 `../../../docs/page-designs/V4/reflection/candidates/` 的 C01 三张方向图。`finish-review-P01.md` 已给出仅限隔离稿交用户审阅的 PASS，F1/F2 resolved；P01 审美、完整 D/R、正式接入和部署均未因此获批。本文实际查看 C01 三图及 `screenshots/p01-current/1536-normal.png`、`390-mobile-editor.png`；补充末字段与历史详情证据引用审阅报告中的 `p01-review-fixes`，不声称逐张人工复查全部状态。

## Colors

### Primary

深青色 primary 用于完成归档、文字动作、当前标签及焦点。hover 使用更深青色；状态变化清楚而不依赖位移。

### Secondary

exam-mint 为当前考试和手机学生上下文提供轻量底色；action-blue 为本次成绩摘要与行动字段提供关联。selected-blue 标识当前队列行。三个区域用途不同，不把所有段落都加背景。

### Tertiary

draft-bg / draft-ink 与 complete-bg / complete-ink 配对表示草稿和已完成，并始终保留文字。重点跟进也有文字说明。

### Neutral

paper 承载主工作面，ink 用于标题正文，muted 用于日期、学号和说明；field-border 界定可输入范围，divider 分开列表行与动作区。

**The Context Color Rule.** 色块必须指向考试、选择、行动或状态，不用彩色容器重复包装五个字段。

## Typography

字体继承现有 ThemeBoundary 的中文无衬线栈，没有新字体加载。frontmatter 记录桌面主层级；手机页标题缩至 28px，考试标题 18px，学生标题 23px；桌面学生标题 25px。正文与输入在各自层级保持正常行高，不采用生成图中的手写文本或放大比例。

局部 34 / 21 / 17px 分别用于主标题、队列/考试标题和空态子标题；手机固定动作说明使用 11px，其余次要文字集中在 12–14px。检测器提出的字号 advisory 是本页密度取舍的记录，不能证明其对所有用户足够易读。实际稿比 C01 更紧凑，手机八行分页可能落到首屏以下，仍需用户审美审阅；11px 说明、放大和视力差异保留为可读性限制。

**The Readable Writing Rule.** 手机输入使用 mobile-field；长内容自然换行并滚动，不能通过删字段或缩小整页维持首屏。

## Layout

保留现有白色 WorkbenchShell 和手机五项底栏。桌面主区内边距为 26px 30px 36px，左队列 300px，列距见 desktop-column，右侧占剩余宽度；左侧仅一道分隔线。901–1200px 时队列 240px、列距 20px、页面内边距 22px，两个选填字段改单列。

900px 及以下由单列队列进入专用编辑状态，隐藏页面标题插画与队列，显示返回、学生、考试、日期和当前成绩入口。五字段与日期全部保留；桌面并列的家长话语和班主任跟进在手机纵向排列。手机队列每页 8 行，桌面 10 行；考试库每页 10 场，以真实过滤结果计算页数。

手机编辑动作条固定在现有底栏上方（bottom:62px，左右各 16px，z-index:30）；编辑器补 130px 底部空间，页面另有 90px 底部内边距。补充截图已证明最后字段可滚到动作栏上方；真实软键盘、动态视口和安全区尚未全面验证，不能将桌面模拟视口当作真机保证。

**The Continuous Work Rule.** 桌面选择与编辑并列，手机一次只处理一个学生；五字段、日期、保存和返回构成同一工作流。

## Elevation & Depth

主工作面、列表和行动区以底色与细线分区，无浮起卡片阴影。搜索聚焦使用内描边；其它本页控件为外偏移 2px 的 2px 青色 outline，强制色模式搜索补系统 Highlight。弹窗沿用共享 Dialog，不把本页局部文档改造成全站弹窗规范。复制等短提示为固定角落浮层，普通保存成功不插入新的横条。

**The In-place Feedback Rule.** 正常保存通过按钮忙碌态和原位状态呈现；失败和冲突保留明确错误、重试和恢复入口。

## Shapes

输入、按钮、考试带采用 control 的小圆角；状态与行动区使用 status。队列行、考试列表行和标签下划线保持 flat。边框用于输入、分隔和状态定位，不建立卡套卡结构。

本次只引用已运行一次的检测器结论，不重跑：标签底部 3px 线是 radius:0 的选中下划线，属于圆角/粗边框规则误报；局部色板、4/5px 圆角及非全局字号属于新隔离表面的 advisory。它们有明确的 C01 落地用途，现记录为本页事实，不因此改共享主题，也不把 advisory 写成无障碍通过。

## Components

- **按钮：** 完成并归档是唯一强主动作，保存草稿为次动作，复制反思为文字动作。桌面基础最小高度 36px，手机编辑按钮 43px；禁用使用半透明与禁用语义。部分次要目标较紧凑，未宣布全部触控目标达标。
- **输入：** 五项分别为主要问题、原因分析、下一步行动、写给家长的话、班主任跟进；主要问题有必填标记，后两项明确选填。日期原生输入保持可编辑。textarea 可纵向调整，手机高度至少 83px，桌面至少 76px。复合搜索焦点由外框统一呈现。
- **页内导航与队列：** 学生状态仅针对当前考试；已保存反思是本班全部考试记录。姓名、学号、状态、重点跟进、搜索和筛选共同支持大名单；文本状态与选中行色同时存在。aria-pressed 按钮表达标签选择，不伪称完整 ARIA tablist 实现。
- **历史库：** 按记录 id 枚举，显示考试与日期；未关联记录可以直接查看五字段和复制。明确选定考试后进入编辑，保存才确认关联，保留原 id 并排除重复目标。不能把未关联历史记录过滤成不可达。
- **成绩与考试上下文：** 成绩仅指本次考试，缺失分数不等于零。考试库保留搜索、科目、年月、排序及分页；不复制生成图的假数据或分页数。
- **保存与恢复：** save 成功后才设置“已保存”；失败保留本机反思并提供重试，冲突提供导出草稿和载入最新数据确认。切换学生/考试/视图、返回和离开有脏编辑守卫。归档说明明确“归档到校内沟通记录，不自动发送给家长”。待同步行仍可能显示本机“已完成”，这是报告保留的口径 advisory，不等于服务器已确认。
- **插画：** `notebook-p01.png` 为生成的装饰性笔记本资源，空 alt，标题区 object-fit:contain；桌面显示 210×116px，窄桌面宽 150px，手机队列 95×75px，手机编辑隐藏。文件 1,686,797 bytes（约 1.69 MB），压缩与真实加载性能延期；没有臆造完成性能优化。

sidecar 提供 7 个独立 HTML/CSS 视觉样本，不接入 React 业务；共享字体变量保持可继承，本页局部色值在样本中展开。它们展示已实现视觉，不是新的交互组件库。

验证边界：finish review 引用既有 28 项交互与补充 14 项合成检查，后者关闭历史库、复制兼容路径和末字段证据缺口；本次文档未重跑这些测试。剪贴板兼容回退采用测试替身，不证明系统授权。真实服务器保存、多设备 409、完整键盘/读屏、软键盘、文字缩放、原生下拉跨平台、数值对比度和全站 qa:strict 不在本页文档完成声明内。

## Do's and Don'ts

### Do:
- **Do** 保留白色共享壳层与手机现有底栏。
- **Do** 保留全部五字段、日期、成绩入口、历史库和真实失败恢复。
- **Do** 以实际渲染、源码和保存确认区分设计方向与运行事实。
- **Do** 让长内容和末字段可滚动到固定动作栏上方。

### Don't:
- **Don't** 将 C01 方向确认或 finish PASS 写成 P01 用户审美批准。
- **Don't** 按当前考试过滤掉全班历史库中的未关联记录。
- **Don't** 用生成图的深色导航、字体、字数或分页数覆盖现有实现。
- **Don't** 为每次正常保存插入恢复横条，或把归档描述成自动发送家长。
