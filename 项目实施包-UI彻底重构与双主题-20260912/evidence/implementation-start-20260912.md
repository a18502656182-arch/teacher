# 首批基础层实施记录（2026-09-12）

开始提交：f321d5e9424e0020bdf1e56d52c31b986b503a53，main 跟踪 github/main，开始时工作区干净。无.codegraph。包内16个关键文件相对制作基线漂移0；之后本轮仅改变旧primitives的SVG委托，未改数据层。

已逐张查看C1–C6、G0–G5。18份实施指南、源代码与历史规范用于定位；没有把历史视觉通过转为本轮验收。

## 实际实现

- app/components/workbench/theme：ThemeBoundary、主题契约、语义CSS变量、campus默认及glass内部定义。配置不保存业务状态；插画注册表仍为空，不能写素材完成。
- ui：Button、Field/Input/Select/Textarea、StatusSegment、SelectionBar、Dialog与公共SVG。Dialog为第一版基础组件，尚未接入生产编辑器；TASK08要求的选人、离开守卫和业务集成仍待做。
- 旧CampusIcon消费公共SVG注册表，保留所有旧名称映射和path，未迁移页面结构。
- tools/ui-preview：独立Vite入口，仅127.0.0.1:4207；无API、数据库、旧CSS；模拟保存显式标注。未新增依赖，无正式主题切换入口。
- scripts/inventory-workbench-ui.mjs：只读TypeScript AST交互候选扫描，28文件、1282候选、70浮层候选，原始输出在evidence-local。数字含重复表达式，不是已核实的功能/弹窗总数。

## 实际验证与范围

- TypeScript、ESLint、生产构建及39/39既有测试通过；500KB chunk及大组件Babel提示仍在。
- 浏览器验证主题变更后文本保留、模拟busy禁用、失败保留备注、嵌套子层返回、脏草稿关闭询问。模拟检查不证明真实服务器保存。
- 桌面截图evidence-local/campus-controls-desktop.png；手机截图evidence-local/campus-controls-mobile.png（390×844独立iframe CSS视口，外层整页截图）。手机标题、输入和footer可见。不是物理手机验证。
- detector对新组件和工具扫描结果[]；显式不加载被替代的旧DESIGN。局部finish review disposition ship，无阻断问题；全站未完成。
- qa:strict通过（临时目录classroom-layout-audit/layout-audit.json）；它覆盖旧运行页面回归，不能证明新界面全站迁移。

## 未完成与恢复位置

TASK02仍需逐模块复核候选handler及被调用函数，并展开正式功能/浮层账本；当前扫描不能替代这项人工核验。
TASK06/07为初步实现，完整主题配置/素材契约、其余控件、无blur探针及页面消费仍待补齐。TASK08仅Dialog原型，不代表依赖完成。无C1–C6新页面、无新插画、无业务controller抽取、无新旧CSS隔离、无旧样式退出。

下一步从TASK02继续，按模块逐项形成已核对动作；依赖满足后抽取业务与保存。独立基础层验证可继续，但不能跳过M0把旧页换色宣称完成。
没有新部署包，没有服务器或正式数据库操作。
