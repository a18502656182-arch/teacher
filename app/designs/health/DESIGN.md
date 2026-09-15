---
name: 健康与照护 · 隔离 P01
description: 白纸行动清单与浅绿单条详情的局部实现记录
colors:
  primary: "#087e7e"
  primary-hover: "#086968"
  surface: "#ffffff"
  ink: "#15334a"
  muted: "#526779"
  selected: "#e9f5fe"
  detail: "#f1f7f1"
  line: "#dce5e9"
  input-line: "#c6d4dd"
  hover: "#e9f4f2"
  general: "#e7edf2"
  general-ink: "#455767"
  important: "#fff0cf"
  important-ink: "#8a5100"
  urgent: "#ffe7df"
  urgent-ink: "#a33520"
  tag: "#e7efef"
  tag-ink: "#365d65"
  detail-ink: "#405f64"
  danger: "#a33324"
  error: "#9c3127"
  success: "#ecf8ee"
  success-ink: "#126148"
typography:
  body:
    fontFamily: "Microsoft YaHei, sans-serif"
    fontSize: "15px"
    lineHeight: 1.65
  mobile-body:
    fontSize: "14px"
    lineHeight: 1.65
  display:
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.3
  narrow-display:
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.3
  mobile-display:
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.3
  list-title:
    fontSize: "21px"
    fontWeight: 700
  detail-title:
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.4
  action:
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.45
  action-summary:
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.5
  metadata:
    fontSize: "12px"
  severity:
    fontSize: "13px"
    lineHeight: 1.7
rounded:
  control: "5px"
  primary-detail: "7px"
  severity: "10px"
spacing:
  small: "7px"
  related: "8px"
  compact: "10px"
  toolbar: "12px"
  form: "16px"
  row: "18px"
  section: "20px"
  detail: "26px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.primary-detail}"
    padding: "7px 18px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    padding: "4px 10px"
  search:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    width: "260px"
  selected-row:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
    padding: "22px 18px"
  detail:
    backgroundColor: "{colors.detail}"
    textColor: "{colors.ink}"
    rounded: "{rounded.primary-detail}"
    padding: "26px 26px 24px"
---

# Design System: 健康与照护 · 隔离 P01

## Overview

**Creative North Star: "白纸照护行动簿"**

白色连续清单用于扫描学生、优先级与行动，浅绿区域专门阅读当前一条登记。紧凑搜索与筛选服务安排前查阅，装饰插画退居标题旁。手机先呈现行动清单，选择后进入独立详情。

本记录仅描述 app/designs/health 的已建成局部系统，不替换根 DESIGN.md。方向 C01 已确认；P01 仍待用户审核，弹窗视觉专项 pending，未接正式业务或部署。四项完成度复核 HF-01 至 HF-04 均 resolved；这不是 D/R 批准。依据三个源码、brief、record、assets、geometry、finish-review 与 tests/detector.json；旧 brief 中“未制作 P01”已不代表当前事实。未在文档任务重跑浏览器验证。

**Key Characteristics:**

- 白纸连续行动清单，浅绿单条详情。
- 浅蓝表示当前选择，优先级另用文字和色签表达。
- 手机行动优先，详情保留完整摘要与说明。
- 复用真实 WorkbenchShell、原照护 operations 和共享学生搜索选择器。

## Colors

### Primary

青绿主操作用于新增、编辑与焦点；较深青绿用于主按钮悬停。颜色值以前置 token 为准。

### Secondary

浅蓝 selected 只标识当前记录；淡绿 detail 支撑长内容阅读。一般、重要、紧急各自有文字和背景组合；场景标签使用独立的低强调灰绿。成功提示与错误文字分别使用 success 和 error。

**The Selection Rule.** 当前选中不代表优先级、健康评分或完成状态。

### Neutral

白色工作面、深蓝正文、灰蓝辅助文字与浅灰蓝行分隔构成主体。输入边框明确可编辑区域；联系人分隔线是局部浅绿灰（#d1e0d9），占位文字为灰蓝（#5e7080），手机筛选触发器底色为浅青绿（#e7f4f2）。这些是源码局部值，不扩展为全站主题。

## Typography

**Display Font:** Microsoft YaHei，sans-serif 回退。

**Body Font:** 同上。geometry 已记录 Windows 实际使用 Microsoft YaHei；未分发字体文件。

### Hierarchy

标题、正文及主要行动层级见前置 token。桌面标题下说明为17px，概览14px；列表姓名16px，详情小标题16px。手机清单标题19px、姓名15px、行动17px、辅助说明13px、场景元信息11px、优先级12px；详情标题22px，详情段落15px。901–1150px 详情标题21px。长姓名可换行，学号整组保持不拆字。详情摘要独立呈现，即使行动说明为空也不丢失摘要。

## Layout

桌面工作面内边距28px 30px 20px；标题最低150px，底部22px留白及单条分隔线。工具栏上下16px、间距12px，搜索宽260px；筛选高34px。主从列为 minmax(0,1.5fr) 与 minmax(310px,1fr)，列间距0，按内容自然增高。清单行三列160px / 弹性行动 / 20px箭头，间距18px，最低142px，内距22px 18px。

901–1150px：工作面内距22px，标题30px，工具栏允许换行；清单身份与行动上下重排。主从列比例1.2:1，详情最小290px、内距20px。

≤900px：工作面18px 16px 90px，保留真实手机壳层及底栏空间；清单和详情互斥展示，返回动作可达。搜索弹性宽度、高40px；筛选折叠并保留全部优先级/类型/场景，快捷场景不是唯一入口。控件按钮最低44px。清单行内距16px 10px、间距7px，身份横排；详情内距20px 18px。概览没有240px宽度限制。CSS行最低146px声明会被更具体的通用按钮min-height覆盖，因此不将146px当作实测恒定行高。

列表每页最多10条，筛选重置到第一页；当前选择必须属于当前页，否则选中当前页首条。105条证据有11页，末页5条。长详情自然增长，不固定等高或裁掉文本。geometry 包含1536、390及1057/360窄屏证据；不据此宣称逐像素候选复刻。

## Elevation & Depth

局部页面没有 box-shadow 或动画 token。白色清单与浅绿详情靠色面、留白和功能性分隔建立层次。共享 Dialog 的遮罩与外观未提取为本页已批准规范；删除确认双层遮罩仍属后置视觉专项。

## Shapes

搜索、筛选及场景标签用小圆角，主操作与详情略柔和，优先级短标签更圆。清单行保持连续直边与底部分隔，不增加逐行卡片边框。标题插画为白底水彩夹板与绿叶，原PNG为1536×1024、1,928,583 bytes（约1.93MB），尚未优化；桌面显示180×120px，窄桌面宽110px，手机86×68px且透明度0.7。装饰alt为空；不得用插画承载行动文字。

## Components

### Buttons

主操作青绿填充，次操作文本强调；删除使用低强调危险文字并先确认。默认按钮最低34px，手机44px。hover 使用浅绿，主按钮用较深青绿；focus-visible 为2px青绿轮廓、偏移3px。禁用透明度0.5。

### Chips

优先级为一般/重要/紧急文字标签，不可点击修改完成状态。场景标签允许换行，手机快捷场景使用底部2px青绿线和加粗标出当前条件。

### Cards / Containers

连续清单与一个浅绿详情区，不是卡片网格。联系人默认收起，通过“查看联系人信息”明确展开；不在清单暴露电话。

### Inputs / Fields

白底细描边，小圆角；编辑字段最低38px、内距7px，说明文本域最低85px。编辑器复用共享学生搜索选择器，按姓名/学号查找，不用全班原生下拉。主列表搜索实际匹配姓名、类型、摘要、行动、注意事项与场景，当前不包含学号，不混淆两个搜索入口。

自定义场景保留独立原始文本，提交时才按顿号、中英文逗号或换行解析、修剪、去空并最多取8项。dirty 同时比较草稿与原始场景文本基线，导航/关闭和离页受保护。失败保留 pending 保存或删除操作，重试同步不重复新增或重复删除；异常也保留本机改动。409 展示导出草稿和载入最新数据，替换需确认，取消保留本机草稿。此处是隔离控制器行为及证据说明，不代表正式跨设备恢复或权限已验收。

### Navigation

复用真实工作台壳层；页面不创建候选图中的虚构教师名、标语或侧栏装饰。手机快捷场景、返回行动清单与分页承担本页导航，底栏继续由共享壳层管理。

## Do's and Don'ts

### Do:

- **Do** 保留白纸清单、浅绿单条详情与手机独立详情。
- **Do** 区分选中、优先级及真实保存状态。
- **Do** 保留摘要、长文本、10条分页、失败重试与冲突恢复入口。
- **Do** 将实现说明与审核状态留在工程文档，产品文案只说明老师的任务。

### Don't:

- **Don't** 增加健康评分或任务完成开关。
- **Don't** 把共享搜索选择器换成完整学生名单下拉。
- **Don't** 将四项复核 resolved 解释为 P01 用户批准、弹窗外观通过或正式接入。
- **Don't** 将本记录或 detector advisory 的记录视为全站无障碍、性能或业务验收；PNG 尚未优化，全部对比度及键盘焦点巡检未在此任务测量。
