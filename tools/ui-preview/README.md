# 隔离的新界面组件验证

在项目根目录运行 `node node_modules/vite/bin/vite.js --config tools/ui-preview/vite.config.ts`，只监听 `127.0.0.1:4207`。

本入口使用已有 Vite/React 依赖，不加载 vinext、Workers、认证、数据库或旧 CSS，不代理 API，也不作为正式路由。页面内所有保存均明确标记为模拟；主题切换只存在于此开发工具。后续页面基准可以复用新组件，业务验收必须另用隔离数据库。

禁止打入部署包。不得把这里的控件检查视作 C1–C6 页面视觉通过，或视作新旧样式混合环境已通过。玻璃当前仅为材质探针，无生产插画。

听写新视图：/?grading=1；390×844内嵌视口：/grading-viewport.html。105人、200词及家庭夹具共用真实批改hook，但保存响应为模拟，不连接正式API。生产入口仍未切换。
