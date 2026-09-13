# 座位、值日与班干部实施证据（2026-09-13）

范围：TASK-27，F/O-17、18、19。开始 HEAD：`2fcce07`。

## 本轮完成

- 座位配置、换座、智能排座、轮换、分组、组长与学生条件写入等待 workspace 确认；失败保留本机安排、选人上下文和撤销快照，成功才清理瞬时选择。
- 值日轮换、检查、临时指定、岗位、启停和台账备注等待确认；岗位编辑增加脏草稿关闭确认，失败保留编辑器，成功才关闭。
- 班干部新增/编辑/删除等待确认；新增或编辑失败保留完整岗位表单，保存期间禁用表单与关闭动作。
- 三页继续复用既有当前班隔离、105 人座位唯一、固定值日/教学日、岗位候选范围和取消新增不写半成品等操作层契约。

## 验证

- `node --test tests/rendered-html.test.mjs tests/seating-operations.test.mjs tests/duty-operations.test.mjs tests/cadre-operations.test.mjs`：74/74 通过。
- `node scripts/layout-audit.mjs`，页面 `seating,duty,cadres`：每页 360、390、768、1024、1280、1440 六档通过；报告 `.qa-shots/task27-management/layout-audit.json`。
- 应用内浏览器：1280×720 与 390×844 实查三页，只读写入口禁用，座位宽画布局部滚动、值日五教学日及班干部列表正常。
- 全量 ESLint、生产构建、自动化和认证集成结果见项目状态。

## 未覆盖与后续边界

- 未使用正式数据或生产环境；物理手机软键盘、真实弱网未验收。
- 真实双标签 409 仍由统一 workspace 冲突恢复承接，本任务没有另造页面级冲突协议。
- 已退出的 `seat2-*`、`duty3-*`、`cadre3-*` 等死规则集中删除归 TASK-30。
