# TASK-09 新旧样式隔离实施证据

## 范围与提交

- 开始HEAD：`645c290`。
- 源码提交：`94de104 feat: isolate legacy workbench styles`。
- 正式根布局不再逐份直接导入十个旧CSS源，改为加载由 `scripts/build-legacy-css.mjs` 生成的隔离产物。
- `/w/[token]` 提供 `data-ui-generation="legacy"` 根；新 `ThemeBoundary` 既有 `data-ui-generation="next"` 作为明确停止边界。
- `workbench-repair.css` 中8处 `:root/html/body` 文档级主体已人工迁到legacy根或收敛到实际壳层；没有对整文件做字符串前缀替换。

## 编译与portal边界

- `scripts/legacy-css-scope.mjs` 使用PostCSS读取规则、Lightning CSS解析和序列化选择器；每个旧规则最终命中元素必须位于legacy根，且不在任何next子树内。
- keyframes保持原样，媒体规则和伪元素保留；声明值、顺序和 `!important` 不被改写。若以后重新出现 `html/body/:root` 主体，生成器直接失败并报告源文件与行号。
- 当前旧浮层不使用 `createPortal(document.body)`，仍属于工作区legacy DOM根。新共享浮层使用原生top layer，但DOM祖先不改变，因此仍位于next停止边界；旧 `DialogAccessibility` 也不接管新原生dialog。
- 生成文件不提交Git，`predev`、`prebuild`、`preqa:layout`、`preqa:strict`在标准流程开始前重建；修改旧CSS后开发者需重启dev或运行 `npm run css:legacy`。

## 实际验证

- `node --test tests/legacy-css-scope.test.mjs`：6/6通过。
- `npm run css:legacy:check`：产物与十个源文件一致。
- 定向ESLint与 `git diff --check`：通过。
- `npm test`：生产构建、233/233自动化测试及认证集成通过；仅有既有500KB以上chunk警告。
- `npm run qa:layout`：静态审计通过。
- `npm run qa:strict`：六档视口、19个页面族共115项实际审计通过，证明旧工作台在隔离后仍可用。

## 浏览器计算样式证据

隔离预览 `http://127.0.0.1:4207/?isolation=1` 在1280×800及390×844实测。加载完整旧CSS前后：

- legacy输入从浏览器默认边框/字号切换到校园旧控件规则，证明旧样式实际生效；
- 嵌套next输入的背景、文字色、边框、字号、最小44px高度和内距逐项完全相同；
- 两视口均无横向溢出，控制台无warning/error，页面身份、非空内容和交互开关正常。

独立finish reviewer结论：`ship-with-notes`，无阻断问题。反AI模板检查未发现新增视觉模式：本项只建立级联边界，没有新增卡片、装饰、文案或动效。

## 边界

TASK-09建立的是迁移隔离，不是TASK-30旧CSS删除。未迁移页面继续消费旧源文件的隔离生成版；后续每迁移一个页面仍须逐消费者删旧DOM/规则。真实物理手机、屏幕阅读器和生产部署未在本项执行。
