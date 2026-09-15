---
name: 成长档案 · 隔离 Operative
description: 白纸、粉笔绿身份带与可追溯的事实时间线
colors:
  ink: "#17394a"
  muted: "#526d7b"
  line: "#dbe5e8"
  teal: "#267869"
  paper: "#fff"
  control-border: "#cbdadd"
  focus: "#277caa"
  hover: "#edf5f4"
  filter-ink: "#176556"
  filter-selected: "#e6f2ee"
  student-selected: "#e8f4fb"
  portrait: "#87b29d"
  identity: "#e9f3ec"
  identity-muted: "#496858"
  timeline-line: "#d3e4de"
  teacher-dot: "#4c9785"
  communication-dot: "#458abb"
  points-dot: "#b68b28"
  homework-dot: "#8270a3"
  source-ink: "#3d7466"
  source-background: "#edf5f0"
  text-action: "#236e68"
  message-background: "#edf5ef"
  error-ink: "#9e3829"
  error-background: "#fff1ea"
  warning-ink: "#805515"
  warning-background: "#fff6df"
typography:
  display:
    fontFamily: "Microsoft YaHei, sans-serif"
    fontSize: "34px"
    lineHeight: 1.2
  display-mobile:
    fontFamily: "Microsoft YaHei, sans-serif"
    fontSize: "26px"
    lineHeight: 1.2
  identity-title:
    fontSize: "25px"
  identity-title-mobile:
    fontSize: "23px"
  headline:
    fontSize: "22px"
  title:
    fontSize: "17px"
    lineHeight: 1.6
  title-mobile:
    fontSize: "16px"
    lineHeight: 1.6
  body:
    fontSize: "14px"
    lineHeight: 1.85
  editor:
    fontFamily: "Microsoft YaHei, sans-serif"
    fontSize: "14px"
    lineHeight: 1.8
  control:
    fontSize: "13px"
  label:
    fontSize: "12px"
  label-mobile:
    fontSize: "11px"
rounded:
  control: "5px"
  flat: "0"
  circle: "50%"
spacing:
  compact: "6px"
  control-gap: "8px"
  field-gap: "16px"
  identity-gap: "18px"
  section-gap: "24px"
components:
  button-primary:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "6px 11px"
    typography: "{typography.control}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "6px 11px"
  student-selected:
    backgroundColor: "{colors.student-selected}"
    rounded: "{rounded.flat}"
    padding: "12px 10px"
  identity-band:
    backgroundColor: "{colors.identity}"
    rounded: "{rounded.flat}"
    padding: "20px 24px"
  source-label:
    backgroundColor: "{colors.source-background}"
    textColor: "{colors.source-ink}"
    padding: "3px 6px"
---

# Design System: 成长档案 · 隔离 Operative

## Overview

**Creative North Star: "白纸成长档案（已选 C01 的局部实现）"**

本文件只描述 `app/designs/growth` 的隔离 P01，依据已选 C01、`tools/ui-preview/growth.html` 的方向合同和现有源码提取，不替代根目录 DESIGN.md，也不代表 D/R 获批。白纸承载事实，粉笔绿标识当前学生，teal 标识操作；窄目录与宽时间线是这一页的实际表达，而非全站通用模板。

保留专业、清楚、不替老师给学生下结论的产品约束。用户确认风格后指出成绩、积分、作业指标不能代表常态，因此 P01 身份带已撤下整组指标。旧摘要仍以“已有摘要”入口保留，并警示缺少明确长期统计范围；旧状态筛选、低成绩/积分排序仍有局限说明。统计语义重设计尚未完成，不能把本次文档视为该问题已解决。

**Key Characteristics:**
- 白色平面与细分隔线，不以卡片阴影分区。
- 粉笔绿身份带、克制的 teal 操作与浅蓝选中行。
- 日期、来源、正文和后续观察共同形成成长事实。
- 手机先目录后详情，保留工作台手机底部导航。

证据为 `GrowthDesign.tsx`、`GrowthDesign.module.css`、上述方向合同及 `.qa-shots/growth-design/final/1536-normal.png`、`390-normal.png`、`390-mobile-detail.png`。截图检查只覆盖可见布局；未在本次文档任务重新运行交互、对比度或完整可访问性测试。

## Colors

### Primary

teal 用于添加和保存等主操作，文字操作使用 text-action。filter-ink 与 filter-selected 标识快速筛选选中态。

### Secondary

identity 与 portrait 构成粉笔绿学生身份区域。student-selected 是独立的浅天蓝行选择底色，不代表学生评价。来源节点分别使用 teacher-dot、communication-dot、points-dot、homework-dot，并同时展示文字来源；来源标签当前统一使用 source-background 与 source-ink，未复刻 C01 的每类不同标签底色。

### Neutral

paper 承载整页；ink 为主文本、muted 为日期与辅助信息；line、control-border、timeline-line 分别用于内容分隔、控件边框与时间轴。错误与摘要/冲突警示使用独立的 error 和 warning 色对，不能通过身份绿掩盖状态。

## Typography

沿用已有 `Microsoft YaHei, sans-serif` 系统字体栈，没有引入或下载展示字体。字号为局部 CSS 实际角色值，非推算比例。主标题在桌面/手机切换；事实正文保持 body，编辑器使用 editor。学生名为 15px，目录标题为 16px，页头覆盖人数为 17px/600（手机 14px）。未显式设置字重的标题依赖现有浏览器/继承规则，不在 token 中伪造字重值。

事实正文按三行截断，全文通过“查看全文”可达；长词与内容允许断行。手机日期与来源标签降至 label-mobile，这是当前高密度实现，不能当作全站最小字号标准。

## Layout

桌面内容内边距为 24px 28px 32px，标题区域最小高 160px；目录列 285px，右侧为 `minmax(0,1fr)`，列间距 24px。目录右侧细线加 16px 内边距，列表最大高 555px并可滚动。学生行最小高 68px。时间线日期列 112px，正文左缩进 27px。

901–1150px 的中间档收窄目录至 245px、间距至 16px，日期列 94px，筛选换行。900px 及以下切成独立目录/详情，页面内边距 16px 16px 28px，目录最大高 520px；日期列 78px，正文左缩进 18px；身份带操作横排，时间/类型选择器各占半宽。手机关键按钮、搜索及选择器最小触控高度为 44px。

插图仅位于页头右侧，桌面 245×152px、手机 80×85px，`object-fit:contain`，空 alt 表明其装饰用途。当前 `archive-p01.png` 为 1,971,129 字节，尚未优化；尺寸不是性能验收通过的证据。

## Elevation & Depth

局部 CSS 没有 box-shadow、渐变或动画。层次依靠平面底色、边线、字号和留白。共享 Dialog 的遮罩与壳层不属于本文件提取范围；不能据此宣称整个页面含弹窗都没有阴影。焦点使用 focus 色的 3px 实线、2px 偏移。

## Shapes

按钮、输入、选择器采用 control 圆角（5px）。目录行、身份带和来源标签是平直区域；头像及时间线节点为圆形。此圆角只绑定成长档案隔离模块，不推广到共享组件。时间线为 1px 竖线与 11px 圆点；没有逐条包裹的圆角卡片。

## Components

主操作为 teal 实底，次操作为白底描边；桌面最小高 34px。通用按钮悬停底色为 hover；主按钮因更高选择器优先级保持 teal 底色。禁用按钮透明度 0.5、默认指针；焦点规则见侧车，未新增悬停或动效令牌。

搜索框是图标与输入组成的描边行；输入没有内层边框。展开筛选使用两列布局与语义限制说明。快速筛选以轻底色表现选中；学生目录采用全宽行、底部分隔线和记录数，手机才展示小圆头像。

身份带只显示姓名、学号、小组、可选班干部角色及“添加记录/查看摘要”。事实条目提供日期、来源、标题、正文、后续观察与“查看全文”；时间线和目录均有分页。编辑、未保存关闭、冲突恢复与摘要沿用共享 Dialog；此处只记录其中局部表单视觉。

与 C01 的可见偏差还包括：沿用真实工作台壳层而非候选图的简化导航；头像为汉字圆形而非人物插画；日期使用 ISO 格式；分页为上一页/页数/下一页；手机添加入口位于身份带，未采用候选的底部固定添加条。上述是当前实现事实，不代表每项均有独立用户批准。

## Do's and Don'ts

### Do:
- Do 保留白纸、粉笔绿身份与 teal 操作的局部角色关系。
- Do 让日期、来源文字与具体事实一起出现，并保留全文入口。
- Do 让手机先选择学生，再阅读详情，保持底部导航可达。
- Do 明示旧摘要和旧规则的统计局限，以及保存、冲突、只读状态。

### Don't:
- Don't 把已撤下的成绩、积分、作业指标重新放回身份带充当常态评价。
- Don't 将本页的窄目录和事实时间线升级为全站通用页面模板。
- Don't 把 C01 候选图中的数字、状态、人物插画或简化导航写成当前产品事实。
- Don't 将此文档或素材存在等同于统计语义重设计、性能优化或 D/R 验收完成。
