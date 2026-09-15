# 成长P01隔离设计

启动：`npx vite --config tools/ui-preview/growth.vite.config.ts`

地址：http://127.0.0.1:4212/growth.html 。手机详情：`?state=mobile-detail`；状态菜单列出19种场景。全部数据来自growth-fixture，固定2026-09-15；保存、网络失败和409均为模拟，不访问真实workspace。409持续失败，弹窗内可以导出合成草稿并明确确认载入正常fixture。

验收入口：record.json、states.json、geometry.json、assets.json、review-P01.md、screenshots/P01和P01-supplement。指标语义延期未完成。P01不是集成业务，不部署。
