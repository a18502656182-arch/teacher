# 作业 P01 隔离可运行稿

2026-09-15：C01方向已获确认，P01仍待用户单页设计审核。不是正式业务或线上版本。

在项目根目录运行：

```powershell
npx.cmd vite --config tools/ui-preview/homework.vite.config.ts
```

打开 `http://127.0.0.1:4208/homework.html`。手机默认列表；选择任一任务进入处理抽屉。底部“设计预览·合成数据”可切换所有状态；也可用 `?state=状态ID`。

状态：normal、empty-tasks、tasks-30、students-105、long-title-note、search-empty、task-editor、validation、filters、mobile-detail、selected、follow-empty、follow-full、loading、readonly、saving、save-failure、conflict-409、dirty-close、delete-confirm。

validation：打开新增后点“新增作业”触发字段校验。dirty-close：修改字段再取消。采集脚本执行了这两种操作。手机students-105与long-title-note直接打开详情，105人最后页为6/6。

唯一展示实现是 `app/designs/homework/HomeworkDesign.tsx` 和同目录CSS，接收现有controller；以后批准后的正式接入直接复用它。`tools/ui-preview/homework.tsx` 使用真实useHomeworkController和现有操作函数，保存宿主仅更新内存，定时模拟保存/失败/409；刷新恢复合成班级。没有调用正式workspace读写API或本地班级数据库。

字体为系统栈；Windows桌面实测Microsoft YaHei，未分发字体文件。固定合成日期2026-09-15，任务示例日期保留2026-09-14。默认32人，第一任务20已交/3未交/5待订正/4已复查=75%；现有read-model排序使数学任务在语文之前，保留其真实排序规则。

## 已测与未测

- 20状态×桌面1536×1024/手机390×844，共40张主图；1057×900与360×780共8张补充图。
- 30项双端交互通过，5项手机长内容/105人/分页补充通过，原始日志在../logs。
- 类型、生产构建、隔离构建、受控源码lint和34项关联测试通过。默认npm lint受本地QA浏览器扩展缓存10错误干扰；排除缓存的源码检查无错误。
- qa:strict运行时TypeError（querySelectorAll）中止；完整报告和日志保留。不能声明全站严格QA通过，更不能推断原学生缺陷已解决。
- 未测试真实后端保存/权限/409、真实手机软键盘、跨平台字体或全套键盘可访问性。

## 审看差异

与C01相比：沿用真实壳层；文具更小更淡；系统字体更紧凑；手机44px四态及共享Drawer使首屏学生更少，批量条也较高。长标题摘要可展开原文，长备注可滚动和调整高度。参考对照见comparison.html；细节见../P01-FINISH-REVIEW.md。技术复核不代用户D批准。

当前下一步：用户审看作业P01；获单页D后继续听写独立设计。三页D齐前不接V2业务，不部署。
