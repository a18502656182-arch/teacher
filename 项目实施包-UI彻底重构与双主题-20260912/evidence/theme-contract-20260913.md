# TASK-06 双主题契约与token证据（2026-09-13）

## 实施范围

- 开始HEAD：`fe028dd`；代码完成提交：`8a9fb0e`。
- `ThemeDefinition` 现在完整包含 `id`、`status`、`semanticColors`、`surfaces`、`typography`、`spacing`、`radii`、`elevation`、`motion`、`artworkByRole` 与 `capabilities`。
- `themeCssVariables` 把定义转换为共享 `--wb-*` 变量。玻璃主题同时声明实色后备面和支持blur时的增强面；CSS用能力属性和 `@supports` 选择，不在页面写第二套颜色。
- 公开解析仍固定返回campus。glass保持planned，只能在127.0.0.1独立检查器中切换，没有产品入口。
- 校园17个语义插画角色记录本地路径、真实固有尺寸、fit、焦点、文字安全区、装饰属性、无回退和候选状态。glass资源表为空；`Artwork` 缺图返回null，不借用校园素材。
- 原校园slot资源表删除，保留slot到语义role的迁移适配。因此已迁移页面和旧调用者读取同一资源manifest，后续可逐页移除适配名。

## 自动验证

- `npx tsc --noEmit --pretty false --incremental false`：通过。
- `npm run lint`：通过且无警告。
- 主题契约聚焦测试4/4通过：公开主题、完整字段、共享CSS变量覆盖、本地资源存在、legacy slot全映射、无React key和无跨主题素材回退。
- `npm test`：生产构建、224/224自动化测试和认证集成通过；仍有既有500KB以上chunk警告。
- `npm run qa:strict`：115项六档视口检查通过，0失败。报告位于系统临时目录，未加入Git。

## 本地浏览器探针

独立Vite检查器只监听 `127.0.0.1:4207`，不访问API或数据库。任务名称输入“切换时必须保留的草稿”后切换内部材质：

- campus：`data-theme=campus`、`status=development`、canvas `#fffdf8`、primary `#14778a`、blur `0px`。
- glass：`data-theme=glass`、`status=planned`、canvas `#f1f4ff`、primary `#315deb`、blur `12px`。
- 切换后输入内容完整保留，证明ThemeBoundary变更没有通过key重挂载该表单。
- glass下语义插画节点为0，未显示校园候选图；控制台错误和警告为0。

## 仍需后续处理

- 此任务完成架构与局部探针，不代表玻璃视觉已实现。glass没有插画、没有全站材质细化、没有公开开关。
- 工作台整体的ThemeBoundary由TASK-11共享壳层完成；当前旧页面通过默认公开校园定义和兼容slot读取资源。
- 不支持backdrop-filter时的实色降级由源码和测试确认，尚未在真实旧WebView上验证。物理手机、真实软键盘和线上环境未验收。
