# TASK-06 建立主题契约与token

状态：done。前置任务：01。不得用历史通过替代前置门槛。

## 操作
1. 读取00、07、相关pages卡与trackers，核对当前HEAD及用户未提交差异。
2. 本任务具体实施：按04定义语义token和资源manifest，campus公开glass内部；不写业务数据。
3. 对每个涉及页面依次完成view、状态、动作、浮层、手机布局；功能保全账本逐行定位新入口。
4. 预期产物：theme contracts、token样板。拟建文件参照03，命名可微调但职责不可混淆。
5. 退出/删除范围：不得先全局换色。删除共享规则前检查未迁移消费者，禁止重置用户改动。
6. 本项验证：替换token不remount；无模糊fallback。源码调整后运行匹配风险的测试；纯文档项验证引用和状态一致即可。
7. 写入实际证据、问题、下一动作；完成条件不满足标needs-fix。更新项目记忆，验证后提交推送。

## 不允许
跳过前置、整段复制旧布局到新文件、扩大到新增业务、改API/数据库作为UI捷径、把样例代码当真实保存、在正式数据库造测试。

## 完成记录（实施者填写）
- 开始HEAD：`fe028dd`
- 修改文件：`app/components/workbench/theme/*`、`app/components/campus/theme.ts`、`app/components/campus/primitives.tsx`、`app/components/workbench/ui/controls.module.css`、听写批改探针、主题测试与开发设计说明。
- 保全行为/删除旧依赖：校园/玻璃均完整声明语义颜色、表面、字体、间距、圆角、阴影、动态、能力和资源槽；公开解析固定校园。旧`ThemeArtwork`改为slot到语义role的适配，不再维护第二份资源表。玻璃资源为空且缺图直接不渲染，禁止回退校园。
- 命令与实际结果：TypeScript和全量ESLint通过；主题聚焦4/4通过；完整`npm test`生产构建、224/224自动化测试和认证集成通过；115项六档视口`qa:strict`通过。仍有既有500KB以上chunk警告。
- 参考/实渲染证据与视口：本地独立组件检查器输入草稿后切换校园到玻璃，输入保持；canvas/primary/blur变量分别实际改变，玻璃插画节点为0，控制台错误与警告为0。详见`../evidence/theme-contract-20260913.md`。
- 未覆盖状态：玻璃没有资源、未做全站视觉验收且无公开切换入口；工作台共享壳层统一ThemeBoundary仍属TASK-11；真实不支持backdrop-filter设备及物理手机未验证。
- 完成提交：`8a9fb0e`
- 下一步：TASK-07补齐基础控件的全部状态和检查器；再按依赖进入TASK-08。

实际完成证据：`../evidence/theme-contract-20260913.md`。页面重构未完成，未验证项保持未完成。
