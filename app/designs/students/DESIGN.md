---
name: 学生名单 P01 隔离设计
description: 名单与粉笔绿学生详情，基于已确认的 C01 方向提取当前实现。
colors:
  ink: "#103858"
  muted: "#486784"
  primary: "#087e8b"
  primary-hover: "#066771"
  paper: "#fff"
  line: "#d3e3eb"
  control-line: "#a8c5d8"
  table-header: "#e7f3fc"
  detail-paper: "#e7f3e8"
  detail-muted: "#3c665b"
  success-bg: "#dcefe1"
  success-ink: "#176137"
  warning-bg: "#ffedc8"
  warning-ink: "#865107"
  info-bg: "#dceffc"
  info-ink: "#126495"
  danger-bg: "#fce6e7"
  danger-ink: "#9b293d"
typography:
  headline:
    fontSize: "38px"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: ".01em"
  student-title:
    fontSize: "28px"
    lineHeight: 1.3
  table-body:
    fontSize: "16px"
  status:
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.45
rounded:
  surface: "8px"
  status: "7px"
spacing:
  tools-gap: "10px"
  desktop-inset: "26px"
  mobile-inset: "16px"
---

# Design System: 学生名单 P01

## Overview

本文件只约束本目录的隔离学生名单设计，不替代根级设计系统。视觉方向为 C01 的深蓝文字、青蓝操作、薄蓝表头、连续粉笔绿详情和水彩文具；服务于班主任找学生、查看有时间与来源的近期事实、编辑或进入完整档案的任务。

状态：C01 桌面与手机方向已确认；P01 是待批次 D 审核的可运行稿，不代表 D/R 批准，也未接入正式路由或部署。`docs/page-designs/V2/students/brief.md` 中“等待 C01 确认”是较早阶段的记录。当前源码为本目录 `StudentsDesign.tsx`、`StudentsDesign.module.css`；预览合同在 `tools/ui-preview/students.html`。本次正常态画面证据为 `.qa-shots/students-design/inspection2/1536-normal.png` 与 `390-normal.png`（相对项目根目录）。

## Colors

白色名单工作面与粉笔绿详情形成连续分区，避免以独立统计卡挤占名单首屏。深蓝承担正文，青蓝承担主要操作；表头和当前查看行使用同一浅蓝背景。多选复选框与当前查看行是不同状态。

状态色必须伴随文字：绿表示已交等完成事实，黄表示待处理，蓝表示请假等信息，红表示未交等异常。默认状态徽章为 `#eaf0f5` 底、`#48627b` 字；不能把颜色作为学生永久评价。前言 token 是本地实际值的摘录，完整声明仍以 CSS 为准。

## Typography

字体族继承既有共享壳层和 ThemeBoundary，本目录不加载或重定义字体。桌面标题 38px/750，901–1250px 为 32px；班级副标题 18px。表格正文 16px，姓名 650；表头 14px/500，状态来源 12px。详情姓名 28px，记录标题 20px；记录条正文 14px，日期来源 11px。手机班名 17px/500、姓名 16px、状态 13px、补充事实 11px；长姓名允许换行。

## Layout

桌面沿用真实壳层，预览含 244px 侧栏和 72px 顶栏。页面为 `minmax(0,1fr) 340px` 两列；标题和名单在左，详情跨两行，主区左右内边距 26px。详情内部 sticky top 72px，独立纵向滚动；插画高 210px，详情内边距 22px。901–1250px 时详情宽 290px、插画高 190px，标题折行，搜索占一整行。

桌面表格最小宽 600px，表内滚动、粘性表头；行高至少 65px。表容器最大高 `calc(100dvh - 460px)`、最小高 210px；中间断点最大高减为 `calc(100dvh - 500px)`。分页放在表容器之外。

手机由调用方传入 `mobile` 切换为单列，不是单纯缩小桌面。左右内边距 16px，搜索独占一行，其余筛选/编辑/菜单三列。名单行至少 77px，独立的选择区宽 36px，查看按钮内按身份、106px 状态和箭头排列。名单最大高 `calc(100dvh - 430px)`、最小高 230px，分页位于名单后。小于等于 600px 的表单改一列。保留共享手机底部导航。

当前手机有独立 74px 浅绿插画带，图片宽 160px；这是 P01 的实际重排，与 C01 构图存在差异，尚不能写成用户批准的移动端规则。390px 正常态截图中分页不在首屏；主执行者已通过真实滚动、翻到学生21、搜索学生08及批量入口测试确认分页可达；这不是用户审美批准。

## Elevation & Depth

本地页面不新增阴影或动画。层次依靠连续底色、1px 分隔线及白色记录条，弹窗、抽屉、菜单、焦点与交互状态沿用共享组件。表格 hover 为 `#f2f8fc`，当前查看行为浅蓝；不能用 hover 代替可访问操作。

## Shapes

表格、手机名单、记录条和紧凑详情为 8px 圆角，状态徽章为 7px。详情首字头像为 62px 圆形，图标不承担唯一语义。列表行保持平直分隔，不逐行堆叠卡片外框。文具资产 `stationery-c01.png` 由 `new URL('./stationery-c01.png', import.meta.url)` 引用，`object-fit: contain`，空 alt 且对辅助技术隐藏；它不是截图切片，不承载可操作文字。

## Components

- 名单：搜索姓名/学号/小组/备注，小组筛选，桌面 20/50 人分页；查看和多选分开。桌面编辑模式支持行内资料与编辑/删除；手机编辑模式点击学生进入编辑弹窗。
- 操作：新增学生为页头主操作；名单菜单提供导入/追加与导出 CSV。导入弹窗显示预检人数，提供追加或替换；替换和删除仍由既有控制器处理。选中后才显示 SelectionBar，批量编辑小组、性别、备注。
- 学生详情：桌面常驻右栏，手机进入 Drawer 后可返回名单或打开既有完整档案。显示身份、积分/成绩/考勤/作业、近期记录与班务备注；电话只出现在单学生编辑流程，不放进公开名单。记录条不设置不存在的跳转箭头。
- 事实呈现：`displaySummary` 兼容控制器已提交的字符串返回值与工作区中尚未提交的 `{status,date,source}` 返回值，仅做显示归一化；近期记录选择逻辑仍由控制器决定。未知字符串回退到无记录，不创造记录事实。
- 保存与弹层：继续使用共享 Button、Field、Menu、SelectionBar、Dialog、Drawer 与 StudentProfile。新增/编辑及导入退出带放弃编辑确认；只读属性传入组件及完整档案。保存、冲突、失败属于真实工作台契约，不得由演示状态代替其验证。

## Do's and Don'ts

- Do 将这份文档视为局部实现记录；正常态截图和审查未发现已确认阻断项，不等于全状态、触控、键盘或生产保存验收完成。
- Do 后续集成复用同一 `StudentsDesign`，由既有业务控制器传入 data、update、controller、mobile、readOnly，保持路由、数据与保存契约。
- Do 将固定时间与合成 fixture 限制在 `tools/ui-preview`；预览中的已保存、人数和近期事实不是生产证据。
- Don't 将手机插画带差异、分页可达性或 P01 完成度静默记为用户批准；批次 D 前不接入业务，三页 R 后才进入 V3。
- Don't 修改共享壳层、主题、素材目录或其他人的未提交源码来配合隔离稿；不另造正式页面副本，不以此文档授权集成或部署。
