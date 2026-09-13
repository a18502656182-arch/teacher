# TASK-30 旧UI依赖退出证据

## 结论

工作台正式入口不再加载或生成旧全局CSS，也不再建立`data-ui-generation="legacy"`和`homework-bootstrap-shell`兼容边界。仍有真实消费者的页面规则经过源码消费者筛选后由工作台路由内的`ClassroomPages.module.css`承载，并只挂在业务内容容器，不再污染共享头部、侧栏和ThemeBoundary。

## 删除与替换

- 删除`app/workbench-repair.css`、`app/styles/legacy-scoped.css`及八份`app/components/campus/*.css`旧源。
- 删除旧CSS生成器、作用域测试、预览中间件与LegacyScopeProbe；dev、build和QA不再有生成前置步骤。
- 根布局移除全局旧样式导入；工作台路由移除legacy根；壳层移除兼容class并提供仅内容区使用的`pageClassName`。
- 静态审计改查旧文件确实不存在、兼容边界确实退出、路由模块确实局部接线，而不是继续要求旧产物存在。

## 验证

- `npm run qa:layout`：通过。
- `npm run lint`：通过。
- `npm run build`：通过，且未执行旧CSS生成步骤。
- `npm run qa:strict`：19个教师导航页面 × 6档视口全部通过，共114个运行态组合。
- `node --test tests/rendered-html.test.mjs tests/theme-contract.test.mjs tests/shell-controller.test.mjs`：50/50通过。
- 应用内浏览器实查周报页：内容、桌面壳层与导航正常，控制台无错误。

## 边界

用户本轮明确暂不做家庭教育，因此没有修改家庭教育组件和数据流程，也不把它写入本项验收结论。未操作生产环境、正式数据库、真实弱网或物理手机。共享路由CSS已从约1.4MB生成式全局产物降为约339KB局部模块，但仍应在后续真实组件迁移中继续拆分，而不能把局部化误写成组件边界已经全部完成。
