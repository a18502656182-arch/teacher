# Project UI Guardrails

## 持续交接与 Git 记录规则

本文件适用于 `E:\文档\Codex\小红书\班主任工作台网站` 及其子目录中的所有后续 Codex 对话。

### 开始任何任务前（无需用户重复提醒）

按顺序读取：

1. `项目导航.md`
2. `docs/开发导航与状态-20260911.md`
3. `docs/PROJECT_STATUS.md`
4. `docs/CHANGELOG.md` 的最新部分
5. 涉及上线、服务器或部署包时，再读 `docs/DEPLOYMENT_LOG.md`
6. 涉及长期架构、权限、数据模型或产品边界时，再读 `docs/DECISIONS.md`
7. 运行只读的 `git status`、`git log -5 --oneline` 和 `git remote -v`

先检查用户描述是否存在错误前提、逻辑跳跃或信息缺失；区分已经验证的事实、尚未验证的判断和未来计划。不得把历史部署包、报告截图或对话恢复目录当作当前源码。

### 每次实际修改后（无需用户重复提醒）

只要修改代码、配置、数据库脚本、部署方式或用户可见功能，必须在同一任务中：

1. 更新 `docs/CHANGELOG.md`；
2. 更新 `docs/PROJECT_STATUS.md` 的当前进度、下一步和已知风险；
3. 涉及部署包、服务器或线上验证时，更新 `docs/DEPLOYMENT_LOG.md`；
4. 涉及长期且会约束后续实现的选择时，更新 `docs/DECISIONS.md`；
5. 检查 `.gitignore`、`git status` 和待提交差异，确认没有 `.env.local`、数据库、真实班级资料、密钥、部署包、备份、对话日志或临时测试产物；
6. 按改动风险完成测试；验证通过后执行清晰的 Git 提交并推送当前分支；默认推送到 `github`（`https://github.com/a18502656182-arch/teacher.git`），`origin` 仅保留为无可用凭据的历史内部远端；
7. 最终回复必须说明更新了哪些记忆文档、提交号、推送结果、测试结果，以及部署状态是否真的改变。

Git 推送只保存源码和项目记忆，**不等于部署服务器**。除非用户明确要求部署且目标、备份和回滚方式均已确认，否则不得把 Git 推送描述为上线。

### 自动提交与推送的例外

- 用户明确要求“先不提交”“先不推送”时，保留本地改动并说明状态。
- 测试失败、发现私密文件、出现 Git 冲突、远端授权失败或本次改动混有无法安全拆分的用户修改时，不强行推送。
- 不得使用 `git reset --hard`、`git checkout --` 或其他会丢失用户工作区内容的命令。
- 8 月至 9 月上旬的历史功能是在 Git 提交中断期间形成的，只能作为一次“历史补录基线”记录；不得伪造逐步提交或虚构部署成功。

## 界面工作台规则

This project is a homeroom-teacher daily workbench, not a marketing site or a card gallery. Follow these rules before changing any page, modal, form, table, filter area, or student picker.

## Core Principles

- Design as an operational workbench first.
- Prefer tables, toolbars, aligned fields, separators, and clear spacing.
- Do not use cards as the default structure.
- A border must have a clear job: table boundary, modal boundary, repeated item boundary, or a truly independent editing area.
- If a border only exists to make an area "look organized", remove it.
- Do not split one continuous workflow into multiple neighboring white boxes.
- Every button must have a clear action and a clear result.

## Forbidden Patterns

- No meaningless nested frames.
- No cards inside cards.
- No long runs of large white boxes stacked one after another.
- No decorative borders, shadows, rounded backgrounds, or panels just to create visual sections.
- No old useless sidebars, copy buttons, hint panels, or placeholder actions.
- No control whose inner text is squeezed, misaligned, wrapped badly, or visually garbled.

## Control Taxonomy And Button Rules

- Do not style every clickable thing as a generic bordered button. Classify controls before styling: primary command, secondary command, text action, danger action, segmented control, status badge, menu trigger, pagination, or filter toggle.
- Status values such as submitted, missing, fixing, and rechecked are not ordinary action buttons. Use a segmented control with stable dimensions, `white-space: nowrap`, one shared outer border, and one clear selected state.
- Table operation columns must not contain three or more equally strong bordered buttons. Use one primary command at most, then text actions or a menu for secondary/destructive actions.
- A table column containing a segmented control must reserve enough width for all options. Do not rely on the table squeezing the control.
- Do not use input-like white bordered buttons for reset, details, delete, copy, or other low-emphasis actions. Reset/details should usually be text actions; delete should be a subdued danger text action or a menu item.
- The points page uses a student table, a rule list, and a recent-event panel. Do not turn these into floating cards or multi-box gimmicks.
- The rules page uses a table-like grid, a status toggle, and text actions. Copy and delete stay low-emphasis; enable/disable is the only stateful toggle in the row.

## Required Control Checks

- Every button and segmented-control option must satisfy `scrollWidth <= clientWidth + 1`; otherwise text is visually squeezed and the page is not done.
- Strong bordered or filled buttons in a table action cell must be limited to one primary action. If a row needs more actions, downgrade secondary actions to text links or move them into a menu.
- For status segmented controls, verify fixed min-height, fixed min-width, nowrap text, visible active state, hover state, and enough table column width on desktop and mobile responsive-table layouts.
- Copy actions must use the shared clipboard helper with success/failure feedback. Do not call `navigator.clipboard.writeText` directly from page rows, modals, or toolbars.
- Destructive actions that remove saved class data, students, homework, rules, roles, or communication records must use the shared danger-confirm dialog. Do not use native `window.confirm`.
- Avoid new `!important` rules. If specificity is not enough, fix the selector structure instead of adding broad CSS overrides.

## Student Picker Rules

- Every "choose student from class" flow must work for classes with 100+ students.
- Never use a normal HTML select to show the full class roster.
- A modal picker is allowed, but it must not show all students by default on the first screen.
- Student search must prioritize name and student number.
- Groups can be an optional filter only. Groups must never be the primary or only path, because some teachers do not use groups.
- Useful alternatives include recent students, students with existing records, initials, student-number ranges, and virtualized or paginated result lists.
- The selected-student button must have a stable internal layout: left side is one grouped block for name and metadata; right side is one grouped action area. Do not let separate text nodes compete for grid positions.
- Use the shared search/range student picker for seat assignment, seat constraints, fixed duty students, cadre appointment, communication records, reflections, or any other class-roster selection. Small enumerations such as groups, statuses, terms, and rule categories may still use native select controls.

## Page Structure Rules

- A page may have a concise heading and necessary primary action.
- Metrics should usually be a single horizontal strip, not several floating cards.
- Form controls should feel like a toolbar or work area, with aligned baselines.
- Tables are the main information surface. Use stable column widths and horizontal scrolling when needed.
- Modals are for focused choosing or editing. Do not put decorative card structures inside modals.
- Mobile layouts must become single-column or horizontally scrollable. No overlapping fields. No clipped button text.
- Mobile list-heavy pages should constrain secondary lists with internal scrolling or pagination. Do not make the entire page thousands of pixels tall just because a table/list is long.
- Use `100dvh` for viewport-height surfaces and modals. Do not add new `100vh` rules for app shells, sticky sidebars, or dialog max heights.
- Do not use em-dash characters in UI copy. Use a short hyphen for empty placeholders and "至" for date ranges.

## Before Editing

Before changing a page, answer these questions:

- What is the main workflow of this page?
- Which areas truly need borders?
- Can a table, toolbar, separator, or spacing replace a card?
- Does this page involve 100+ records or students?
- Does student selection avoid full-class dropdowns and avoid depending on groups?
- Does every button have a meaningful action?

## Required Verification Before Saying "Done"

After changing a page, verify at least:

- Desktop real preview screenshot.
- Mobile or narrow-screen layout.
- No two-or-more consecutive large white boxes.
- No nested frames or card-in-card structure.
- Fields align cleanly.
- Button text is complete and meaningful.
- Small controls do not have squeezed, misaligned, or garbled internal layout.
- Old structure classes are not still present in the current page DOM.
- Student selection and tables remain usable for large data sets.
- `npm.cmd run build` passes.
- `npm.cmd run qa:strict` passes.
- The design detector reports no actionable findings for edited UI files.

If any check cannot be completed, say exactly which check was not verified. Do not claim the page is done without that disclosure.

