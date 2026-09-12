# 双主题契约与组件API

## 固定决策

首版resolve公开主题只能返回campus。玻璃planned，可在独立本地组件检查器中验证token替换；正式网站不得出现未完成切换。以后开放需要全站视觉验收，不以某个按钮能变色作为条件。

主题配置包含：id、status、semanticColors、surfaces、typography、spacing、radii、elevation、motion、artworkByRole、capabilities。语义值用action.primary、text.main、surface.canvas、status.warning等，不在页面定义‘blueCard’或‘purpleButton’。
artwork每项包含src、mobileSrc、width/height、fit、focalPoint、safeTextArea、decorative、fallback。主题仅改变材质与装饰布局，不改主操作顺序、列表字段、数据或统计。
玻璃降级：不支持backdrop-filter时使用近实色表面；文字区域不透底图；减少动态效果时关闭装饰运动。禁用状态仍可辨识，错误不能只靠红色。首版不增加全屏渐变光晕或动效以假装玻璃已完成。

## 公共组件接口责任

|组件|输入/输出|不负责|
|---|---|---|
|Button|intent、busy、disabled、type、onClick、可访问名称|自行请求保存|
|Field|id、label、hint、error、required、children|生成学生数据|
|StatusSegment|options、value、onChange、disabled|改写状态语义|
|StudentPicker|items、query、onQuery、selectedIds、分页与onConfirm|拉全班到原生select|
|SelectionBar|count、scopeLabel、busy、actions、clear|默认为跨页全选|
|DataTable|columns、rows、rowKey、focusedId、selectedIds|把行聚焦当勾选|
|Dialog/Drawer|open、title、onRequestClose、dirty、busy、footer|自行清空草稿|
|SaveFeedback|明确保存状态、retry/recover操作|用超时假装成功|
|Artwork|role、主题、尺寸变体|写入业务标题文字|
|MasterDetail|master、detail、mobileLevel、onBack|维护另一套选择状态|

Field必须有真实label关联；图标按钮有名称；Menu触发不伪装成输入。单选状态使用aria-pressed或radio语义，多选使用checkbox。导航使用aria-current；动作不充当无href链接。

## 弹窗公共流程

1. 打开时记录触发点，创建一份编辑草稿，不立即改正式记录。
2. 焦点进入标题或第一个有效字段；Tab限定最上层浮层，背景inert。
3. 保存中阻止重复提交；关闭请求经过dirty/busy判断，不能直接清空。
4. 校验失败聚焦首个错误并保留输入；网络失败提供同表单重试。
5. 成功后依据业务语义关闭/停留；关闭恢复触发焦点，触发点已不存在时落到页面标题。
6. 嵌套选人关闭回到父编辑器；父浮层仍可操作，最后关闭时移除inert。

examples中的契约代码只演示控制边界，不含完整React组件和真实保存，接入前必须依据当前API做适配与回归。
