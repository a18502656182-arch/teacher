---
name: 家校沟通 · 隔离 P01
description: 连续沟通记录与粉笔绿通知工作区的局部实现记录
colors:
  primary: "#087e7e"
  primary-hover: "#076a6a"
  active-line: "#078888"
  surface: "#ffffff"
  ink: "#15334a"
  muted: "#50667b"
  placeholder: "#627485"
  input-line: "#c7d7e0"
  line: "#dce6ed"
  hover: "#e9f4f2"
  group: "#eaf5fd"
  notification: "#f0f7f1"
  notification-ink: "#406359"
  notification-meta: "#466558"
  notification-line: "#d4e3da"
  draft: "#e5eff7"
  draft-ink: "#3c5870"
  pending: "#fff0d5"
  pending-ink: "#8a4e00"
  completed: "#e4f2e6"
  completed-ink: "#275e49"
  archived: "#e9edf1"
  archived-ink: "#495965"
  next-step: "#fff5e5"
  next-step-ink: "#87551d"
  success: "#edf7ee"
  danger: "#a33324"
typography:
  body:
    fontFamily: "Microsoft YaHei, sans-serif"
    fontSize: "15px"
    lineHeight: 1.65
  display:
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.3
  narrow-display:
    fontSize: "30px"
    lineHeight: 1.3
  mobile-display:
    fontSize: "26px"
    lineHeight: 1.3
  introduction:
    fontSize: "17px"
  panel-title:
    fontSize: "20px"
    fontWeight: 700
  group-title:
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.6
  record-title:
    fontSize: "18px"
    fontWeight: 700
  mobile-tab:
    fontSize: "16px"
  feedback:
    fontSize: "14px"
  metadata:
    fontSize: "13px"
  badge:
    fontSize: "12px"
    lineHeight: 1.8
rounded:
  field: "5px"
  command: "6px"
  panel: "7px"
spacing:
  inline: "8px"
  compact: "10px"
  toolbar: "12px"
  form-grid: "14px"
  form: "15px"
  row-inline: "16px"
  compact-section: "18px"
  panel: "20px"
  column: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.command}"
    padding: "7px 15px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    padding: "5px 9px"
  search:
    rounded: "{rounded.field}"
    width: "275px"
    padding: "0 10px"
  status-selected:
    backgroundColor: "{colors.group}"
    textColor: "{colors.ink}"
    padding: "6px 14px"
  notification:
    backgroundColor: "{colors.notification}"
    rounded: "{rounded.panel}"
    padding: "20px 20px 12px"
---

# Design System: 家校沟通 · 隔离 P01

## Overview

**Creative North Star: "白纸沟通簿与粉笔绿通知台"**

白纸连续行保留沟通事实、反馈和下一步的阅读顺序，浅蓝分组帮助扫描状态，粉笔绿工作区集中整理通知与手工回执。信封水彩只在标题旁提供轻量识别，文字和命令承担实际任务。此名称是对已确认 C01 方向的描述性归纳，不是用户另行批准的品牌命名。

本文件仅记录 app/designs/records 的局部实现，不替换根 DESIGN.md。surface brief 将本页定义为 Operate：班主任先查跟进约定，再回看事实；桌面沟通与通知并列，手机分标签。用户已确认桌面和手机 C01；本轮 P01 主页面待审核，弹窗视觉明确后置，正式业务未接入，未部署。旧 brief/function-map 中“尚未制作/尚未修复”是制作前盘点，不能覆盖当前源码事实。独立 finish-review 的“可交用户审核”不是用户 P01 批准，也不是整批 D/R 放行。

**Key Characteristics:**

- 白纸连续记录行与浅蓝状态分组。
- 单一粉笔绿通知工作面内用分隔线组织条目。
- 青绿命令、暖黄下一步、文字状态共同传达任务。
- 手机沟通/通知分标签，复用真实工作台壳层。

## Colors

### Primary

青绿 primary 用于新增、复制、文本操作及可见焦点；primary-hover 用于主命令悬停，active-line 专用于筛选和标签选中下划线。普通按钮悬停用低强调 hover 色面。颜色值以前置 token 为准。

### Secondary

浅蓝 group 标识状态分组标题和选中筛选；粉笔绿 notification 是独立通知工作面。pending、completed、archived、draft 各有背景与文字配对，状态始终保留中文。暖黄 next-step 只承载已有跟进文本，不能据此生成到期或逾期判断。success 配 completed-ink 显示结果，danger 同时用于错误和危险操作。

**The Meaning Rule.** 已复制只表示剪贴板成功，不表示通知已发送；颜色不得扩大业务含义。

### Neutral

白色工作面、深蓝正文和灰蓝辅助文字构成主体。input-line 界定可输入区域，line 分隔记录及导航，notification-line 只分隔浅绿工作面内部条目。placeholder、notification-ink 和 notification-meta 记录不同背景下已有的局部辅助文字颜色。

本次按已确认 C01 方向登记实际 palette、字级和圆角，不重新选色。既有 detector.json 共22项：16条颜色、2条圆角、3条字号 advisory，以及1条下划线误报；sidecar 保留原始检测解释，不宣称检测已重新通过。

## Typography

**Display Font:** Microsoft YaHei，sans-serif 回退。

**Body Font:** 同上。geometry.json 的浏览器计算样式记录正文为15px / 24.75px Microsoft YaHei，宽屏标题700 34px / 44.2px；文档任务未另做实际字形回退解析，没有新增字体文件。

### Hierarchy

桌面标题、正文与常用层级见前置 token。概览14px、记录日期14px/600、反馈14px、渠道元信息与下一步13px；姓名18px/700，通知标题19px/700，通知日期和状态12px。编辑表单14px，详情段落行高1.75、小标题16px。

901–1200px标题30px、通知区标题18px、日期12px。≤900px标题26px、副标题15px、概览12px；工作区标签16px，状态筛选13px及计数12px；组标题18px、姓名18px、事实15px、反馈14px、日期/渠道13px、详情操作12px。手机元信息和详情小字是待优化项，不能把当前尺寸登记解释为无障碍通过。

## Layout

桌面页内距26px 28px 24px，标题最低140px、底部20px、元素间距24px。主列 minmax(0,1.9fr)，通知列 minmax(320px,1fr)，列距24px，按内容自然增高。搜索宽275px、输入高35px，筛选同高；工具栏可换行，间距12px。记录行112px日期列与弹性正文列、间距20px、内距19px 16px；每组标题后跟连续行，不逐条另加外框。通知区内距见 token；条目上下20px，底部分隔。

901–1200px：页内距22px，列比1.5:1、通知最小280px、列距18px；记录日期移至正文上方，搜索240px，通知内距17px。≤900px：页内距18px 16px 90px，标题最低110px；两工作区互斥展示，搜索弹性占宽且输入高40px，筛选可展开；新增记录在计数行。记录日期并入元信息，行内距16px 0；通知区16px 14px。移动按钮最低44px；共享壳层保留手机顶部及底栏。

记录每页10条，通知每页4条；搜索、类型、状态变化重置记录页。计数是全班当前集合的状态计数，组头“本页”计数只统计当前页。事实、反馈、下一步摘要最多2行，通知正文3行、对象与回执2行；完整详情保留原文，不因摘要裁切丢失数据。

实看 round1/1536-normal.png 和390-normal.png：宽屏连续清单与右侧通知关系成立，手机首屏可见第一条完整记录及第二条部分内容。截图不是完整滚动证据；本任务未复跑浏览器、对比度或键盘测试。

## Elevation & Depth

本页 CSS 无 box-shadow、过渡或动画 token。靠纸面、浅蓝组头、浅绿通知面和功能性分隔建立层次。真实共享 Dialog、ThemeBoundary 与 StudentPicker 的门户样式不等于继承本页全部 CSS；浮层视觉未批准，不能把主页面 focus/字号自动当作其已验证规范。

## Shapes

输入5px、主按钮与状态签6px、通知区7px圆角。连续记录保持直边和底部分隔。手机标签活动态是3px青绿下划线，没有圆角卡片；detector 的 border-accent-on-rounded 属此处误报，不能为消除告警删掉选中状态。

信封插画 letter-p01.png 为1536×1024、2,084,642 bytes（约2.08MB），装饰 alt 为空。桌面显示190×118px，窄桌面宽120px；手机106×78px，定位在标题右上。显示尺寸远小于原图，压缩及适当分辨率仍待优化。

## Components

### Buttons

主命令青绿填充，小圆角；次要命令为文本，删除用低强调危险色。默认按钮最低36px、手机44px，禁用透明度0.5。focus-visible 为2px青绿轮廓、偏移3px。通知单条最多一个强主命令“复制通知”，回执为次命令，编辑/删除由“更多”展开。侧栏“新建草稿”和主标题“新增沟通记录”不是同一操作。

### Chips

状态签为12px文字、2px 9px内距、行高1.8；不可点击改状态。详情中使用状态选择字段修改。缺省沟通状态统一作为待跟进计算、筛选、展示；标签不能替代文字。

### Cards / Containers

一个浅绿通知工作面内排列连续条目，白纸沟通清单用浅蓝组头及细线分组。候选中的多重边框已按 brief 校准；不把每条通知重做为白卡。

### Inputs / Fields

搜索只匹配当前源码明确包含的姓名、日期、类型、渠道、内容、反馈、跟进和状态，不宣称支持学号；共享学生选择器则按姓名/学号选择，沟通单选、通知多选，通知空选表示全班家长。字段细描边、白底、小圆角，编辑字段最低39px、内距7px，文本域最低95px。时间保留自由文本，类型/渠道为带 datalist 的可输入字段，保留历史值。

隔离控制器复用 records/notifications operations 与 copyTextToClipboard，未改正式业务实现。编辑沟通合并旧对象以保留 reflectionId 等字段；pending 重试只同步已有改动，busy 在 finally 释放；dirty、导航事件和 beforeunload 保护未保存内容。只读禁写并允许复制，409 提供导出草稿及经确认载入最新入口。删除使用共享 Dialog 承载确认，未调用原生 confirm；不据此宣称共享危险对话框视觉专项完成。

失败提示带 role=alert，但位于长 fieldset 之后；手机失败首屏可能只见 footer 重试，错误原因需滚动才能看见，这是 RF-03 待优化项。pending 只在 React 状态中，刷新后持久恢复取决于宿主，不作保证。复核引用50项隔离交互通过；真实保存、权限、冲突和持久化仍为接入门槛。

### Navigation

沿用真实 WorkbenchShell 顶部、侧栏和手机底栏，不生成虚构教师名或装饰标语。本页手机工作区使用 aria-pressed 按钮，不能描述成已实现键盘箭头切换的 ARIA tablist。状态筛选同样用 aria-pressed；搜索有标签，筛选和更多使用 aria-expanded。

## Do's and Don'ts

### Do:

- **Do** 保留连续记录、浅蓝组头和单一粉笔绿通知工作面。
- **Do** 保留手机分标签、完整详情、分页与可见新增入口。
- **Do** 明确复制不外发，回执由老师手工记录。
- **Do** 将小字、素材体积和长表单失败说明位置保留为后续优化事项。

### Don't:

- **Don't** 把跟进文本推导成自动到期提醒或逾期统计。
- **Don't** 用全班原生下拉替换共享学生搜索选择器。
- **Don't** 将主页面可交审核写成 P01 用户批准、弹窗批准、整批 D/R 或正式接入。
- **Don't** 将 token 登记或局部实拍解释为全站性能、无障碍、生产持久化验收。
