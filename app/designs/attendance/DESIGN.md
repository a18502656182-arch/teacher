---
name: 考勤与请假 P01 局部设计
description: 暖白日名单、浅蓝月历与四态考勤的隔离可运行稿；非全站规范或验收声明
colors:
  primary: "#14778a"
  primary-hover: "#106575"
  ink: "#17354a"
  muted: "#526a7b"
  canvas: "#fffdf8"
  surface: "#ffffff"
  line: "#cfdee7"
  soft-blue: "#eff7fc"
  normal: "#bfdfcc"
  normal-ink: "#21573e"
  late: "#ffe1a1"
  late-ink: "#704a0b"
  leave: "#cee7fb"
  leave-ink: "#245780"
  absent: "#ffd8d1"
  absent-ink: "#993e33"
typography:
  body:
    fontFamily: "Microsoft YaHei, system-ui, sans-serif"
    fontSize: "14px"
  headline:
    fontSize: "32px"
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  roster-title:
    fontSize: "18px"
  metric:
    fontSize: "25px"
  mobile-input:
    fontSize: "16px"
  mobile-status:
    fontSize: "15px"
rounded:
  control: "6px"
  metrics: "7px"
  surface: "8px"
spacing:
  compact: "8px"
  regular: "16px"
  desktop: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-text:
    textColor: "{colors.primary}"
    padding: "6px 8px"
  field:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "6px 9px"
---

# Design System: 考勤与请假 P01 局部设计

## Overview

**Creative North Star: "日名单与紧凑月历"**

此名称提取自预览入口的 THESIS，不是另行取得的品牌命名批准。暖白工作面承载日名单，浅蓝汇总带和月历辅助定位，四种柔和彩色选中态帮助辨识异常。水彩台历、笔筒与植物作为右侧辅图，名单保持主要视觉重量。

本文件记录 2026-09-15 的隔离 P01 实现事实，只适用于当前目录。主内容直接放入原共享 WorkbenchShell，未改共享壳层；手机月历 Drawer 在局部 ThemeBoundary 内使用。全站 DESIGN.md 仅为上下文，不由本文件覆盖。PRODUCT.md 中手机快速记录、长期名单可达与保存结果可信的约束仍适用。

**Key Characteristics:**

- 日名单为主，桌面月历为辅，手机四态独立占一行。
- 搜索筛选占用紧凑，手机关键操作保持 44px 触控尺寸。
- 状态有文字、颜色和选中语义；本机改动与确认保存分开表达。

实现来源：同目录 `AttendanceDesign.tsx`、`AttendanceDesign.module.css`、`useAttendanceDesignController.ts`，以及 `tools/ui-preview/attendance.html` 的方向注释。功能边界参照 `docs/page-designs/V3/attendance/function-map.md`。`brief.md` 保留早期 C01 未确认的历史描述；当前 `record.json` 已记录桌面与手机 C01 方向批准，但 P01 的 D 与正式 R 仍未批准。

方向来源为 `docs/page-designs/V3/attendance/candidates/attendance-desktop-c01.png` 与 `attendance-mobile-c01.png`。手机 C01 实际为 935×1683 的生成图，不是 390×844 浏览器截图；不承诺像素级复刻，尤其不沿用候选第四行四态错排或工具遗漏。

实际打开核对的渲染证据均来自 `.qa-shots/attendance-design/review-fix/`：`1536-normal.png`、`390-normal.png`、`390-month-calendar.png`。未采用 round2 作为本文件的视觉依据。截图来自合成数据隔离预览，并非正式路由、真实服务器保存或全站回归证据。其他状态存在于捕获目录，但本次文档整理没有逐张视觉复核；测试与最终评审由独立记录负责。

## Colors

### Primary

深青用于保存、文本操作和键盘焦点；悬停时主按钮加深。主色不承担四种考勤状态的区分。

### Secondary

粉笔绿、暖黄、浅蓝、珊瑚色分别用于正常、迟到、请假、缺勤的选中段，搭配各自深色文字。未选中段为白底。计数带中的状态小圆点是辅助提示，手机隐藏圆点但保留状态名称与数字。

### Neutral

暖白用于桌面内容底，手机内容为白底；深蓝墨色用于正文，灰蓝用于学号、小组和辅助提示。淡蓝灰线划分行、字段和日历；浅蓝工作面用于计数带与桌面表头。

**The Four-State Rule.** 四态不得仅靠颜色传达，始终保留中文状态名称与 aria-pressed 选中状态。

## Typography

**Display Font / Body Font:** Microsoft YaHei，回退 system-ui、sans-serif。字体名称来自局部 CSS，并未安装或锁定候选图字体，跨设备字形可能不同。

桌面页面标题使用 frontmatter 的 headline；名单标题为 roster-title，计数为 metric 并启用等宽数字。学生名桌面 15px、手机 16px，学号与小组 12px；手机名单标题收为 14px。手机字段采用 mobile-input，四态采用 mobile-status。未定义全站展示字体或新的字体资源。

## Layout

桌面宽于 1279px 时，内容采用 `minmax(0,1fr) 250px` 两列与 24px 间距、24px 内边距。主区依次为标题、日期、计数、搜索筛选、日名单；右侧通过一条分隔线承载月历及插画。901–1279px 改为一列，月历与插画移动到名单之后。

900px 及以下为手机结构，内容内边距 12px 14px，隐藏重复页标题并复用壳层标题。日期、统计、搜索/筛选、名单工具行依次排列；筛选默认收起，展开后仍包含状态和小组。桌面搜索宽 30%、最大 260px，手机最大 270px；紧凑来自宽度与折叠层级，不能缩小触控目标换取密度。

桌面每行按选择、身份、四态、备注、保存五列对齐；手机身份、四态、备注分三行，所有学生一致。名单桌面每页 50 人、手机每页 20 人；列表内部滚动，最大高度桌面 600px、中宽 550px、手机 640px。分页保证长名单可达，不把截图可见行数解释为完整班额。

## Elevation & Depth

局部页面 CSS 不定义投影，以底色、分隔线与间距建立层级。共享 Drawer 的遮罩与弹层外观属于原共享组件，不提升为本页新增全局投影规范。水彩插画内的绘画阴影属于图片内容。

## Shapes

控件与四态组使用柔和小圆角，名单和桌面月历使用 surface 圆角；边框分别承担输入、连续分段或名单边界作用。手机去除名单外框和月历内框；不把每名学生做成独立浮动卡片。

## Components

### Buttons

批量“应用并保存”为深青主命令，只有选中学生后显示；保存备注、全选本页、全员正常为低强调文本动作。桌面常规操作最小高度 36px，手机四态、保存、分页和主要输入最小高度 44px。局部焦点为 2px 深青 outline，外偏移 3px；禁用透明度为 0.55。该尺寸是源码规则，不等于全部控件与全部设备已验收。

### Inputs / Fields

白底、细线、小圆角；姓名或学号是搜索提示，但控制器同时匹配小组、共享学生备注与状态，不包含当日备注。长当日备注超过 24 字时提供展开全文，编辑区可切换为 textarea。批量统一备注留空表示不覆盖；单行未改备注保存时沿用已有记录，修复限定在本地控制器。

### Status Segments

每行四段顺序固定为正常、迟到、请假、缺勤，共享外框；选中加粗并着色。点击单行状态即触发保存，备注有独立保存动作。不能改成无意义的整页保存流程。

### Calendar

周一为首列；选中日期用浅蓝底和加粗数字，已登记日期显示登记或异常信息，无记录显示为空且明确“无记录不等于正常”。当前日期在 busy 或 unsynced 时显示“待同步”，避免本机乐观更新在 mock ack 前被描述为已保存。手机通过原 Drawer 查看月历，日期按钮最小 44×44px；框架能力与其它视口仍需各自验证。

### Feedback and Batch Editing

成功采用 status，失败采用 alert。失败保留本机输入与选择，日期切换和离开保护由本地控制器实现；只读禁用写入与选择。控制器适配自既有 Attendance.tsx，仍导入原 `features/attendance/operations`，未复制修改核心 operation。此稿的保存、失败、409 与确认消息是隔离预览模拟，文案“服务器确认”不构成真实后端验证。

### Imagery and Navigation

`calendar-p01.png` 是生成的 1536×1024 水彩插画，桌面随辅助列宽缩放、保持比例，alt 为空表示装饰；手机不显示。导航、顶部保存状态和手机底栏直接来自共享 WorkbenchShell，本目录没有新造导航组件。

## Do's and Don'ts

### Do:

- **Do** 保留紧凑搜索筛选与手机 44px 触控要求的双重约束。
- **Do** 所有手机学生行采用一致的身份、四态、备注顺序。
- **Do** 区分无记录、回退状态、本机待同步和确认保存。
- **Do** 保留分页、全选本页、全员正常、只读及失败反馈的实际语义。

### Don't:

- **Don't** 将 C01 方向批准、截图生成或本文件完成写成 P01 D/R 批准。
- **Don't** 将本页字体、尺寸与布局自动推广到全站或改共享壳层。
- **Don't** 将生成候选当作精确浏览器几何、保证像素级一致，或增加现有页面不存在的请假详情编辑交互。
- **Don't** 将合成保存、失败或冲突演示描述为真实 workspace 集成已验证。
