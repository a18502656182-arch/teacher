# 学生名单 P01 · 隔离可运行设计

最新：用户在P01交付后回复“可以 继续下一步”，已登记学生P01单页设计批准（97d2121）。下文未批准说明保留为交付时历史；V2三页D未齐，R仍未批准，正式接线不开放。

方向批准：用户在C01桌面/手机展示后于2026-09-14回复“方向确认”。只批准候选方向；P01及V2批次D/R均未批准。

## 打开

在项目根运行 `node node_modules/vite/bin/vite.js --config tools/ui-preview/students.vite.config.ts`，打开 `http://127.0.0.1:4207/students.html`。构建隔离稿使用同命令加 `build`（放在vite.js后）。产物在忽略的.qa-shots/students-design/build，不部署。

页面的“设计预览 · 合成数据”面板提供状态切换，也可用 `?state=状态ID`。支持normal、empty、large-105、long-name、search-empty、loading、readonly、saving、save-failure、conflict-409、detail-drawer、profile、editor、validation、import、import-error、batch、danger-confirm、dirty-close。dirty-close入口先打开编辑；输入后关闭即可查看保留/放弃确认。

## 代码与复用

唯一展示组件：app/designs/students/StudentsDesign.tsx及同目录CSS。以后接入直接复用，不能看图重写。受控props为data、update、controller、mobile、readOnly，controller保持现有useStudentsController；保存、冲突、operations由既有业务宿主继续负责。组件只规范近期状态的显示，兼容已提交字符串及在途结构化结果，不复制业务排序或保存。

宿主tools/ui-preview/students.tsx只在内存更新；无工作区API/数据库/真实名册。固定时间2026-09-14T09:00:00+08:00；fixture来自students-fixture.ts，全部学生名为合成标记，无真实电话。保存失败/409/加载通过宿主模拟，不能证明正式服务端能力。共享壳层在Vite中的next/link适配只用于该预览配置。

## 实际差异与审核边界

桌面保留真实244px壳层和场景切换，详情340px；舍弃生成图虚构铃铛、记录跳转和错误勾选。手机插画为74px独立横带，分页在名单内部滚动区之后，正常首屏不一定显示；真实滚动及翻页已测试。以上不是逐像素复现，仍交用户审美判断。

P01是学生单页设计，不意味着V2三页已可交批次D。作业/听写仍需各自候选确认与可运行设计。正式页面仍保留原两项学生QA失败；本稿不改它们。技术辅助复核报告见../P01-REVIEW.md。
