# TASK-07 基础控件实施证据

日期：2026-09-13。开始HEAD：`b1eb7d2`。代码提交：`2a55a85`。

## 实施范围

- Button在busy时保持按钮原文、显示共享进度图标并阻止重复触发；disabled与busy均有原生不可用语义。
- Field/Input/Textarea/Select继续建立标签、提示、错误和`aria-invalid`关系；StatusSegment继续以文字和`aria-pressed`表达状态。
- SelectionBar补充批量区域、选择数量播报和busy语义，手机动作转为可触达的纵向满宽排列。
- 新增Menu/MenuItem，支持ArrowUp/ArrowDown/Home/End、Escape焦点恢复、Tab和外部点击关闭，跳过disabled项。
- 新增LoadingState与EmptyState。加载只说明正在读取，空态只显示调用者提供的真实说明和动作；玻璃缺少插画时不借用校园资源。
- 所有新增样式位于`controls.module.css`，只读取`--wb-*`主题变量；没有接入或复制旧全局控件CSS。

## 实际验证

- `npx tsc --noEmit --pretty false --incremental false`：通过。
- `npm run lint`：通过。
- 聚焦控件/主题/入口测试：44/44通过。
- `npm run build`：通过；仍有已记录的500KB以上chunk警告。
- `npm test`：生产构建、229/229自动化测试和认证集成通过。
- `npm run qa:strict`：115项六档视口严格布局审计通过。

本地浏览器独立检查器只使用合成文字，不访问数据库或API：

- 桌面：长按钮文字完整；busy按钮不可重复触发；菜单打开后首个可用项获得焦点，ArrowDown进入下一项，Escape关闭并把焦点返回触发器；选择动作后出现真实本地反馈。
- 主题状态：输入“保留中的草稿”后切换内部玻璃材质探针，输入值保持；玻璃插画节点为0，没有跨主题回退。
- 手机：在独立390×844 CSS视口中，长按钮宽343px并换成两行；菜单宽351px、左右均在375px内容视口内；文档横向溢出为0。

## 边界与暂停点

这是基础控件样板，不是业务页视觉成品，也不能证明C1-C6构图、共享壳层或旧CSS隔离完成。真实物理手机键盘、屏幕阅读器和业务浮层要在TASK-08及页面迁移中继续验证。按用户要求，TASK-07完成后作为第一次低成本浏览暂停点；TASK-11共享壳层和TASK-12首页作为后续视觉方向门槛。

未操作生产服务器、正式数据库或生成部署包。
