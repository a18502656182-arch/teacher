# 考勤 P01 隔离可运行稿

启动：`npx vite --config tools/ui-preview/attendance.vite.config.ts`，入口 `http://127.0.0.1:4210/attendance.html`。运行时仍须核验端口；这不是正式 /w/[token]。

真实可复用实现：app/designs/attendance/AttendanceDesign.tsx 与其模块CSS、calendar-p01.png；局部控制器 useAttendanceDesignController.ts 从现有 Attendance.tsx 的职责提取，调用原 attendance/operations.ts，没有修改正式入口或共享样式。宿主仅在 tools/ui-preview/attendance.tsx；合成数据和固定日期在 attendance-fixture.ts 与宿主中。所有保存、失败、409均为内存模拟，刷新恢复。

状态入口在URL追加 `?state=状态名`，或页面“设计预览 · 合成数据”选择：normal、selected-batch、day-note、month-calendar、history-date、no-day-record、empty-class、search-empty、students-105、long-note、readonly、loading、saving、save-failure、conflict-409、dirty-leave、filters、save-failure-empty。月历、筛选及长备注的展开仍需点击对应工具；截图脚本自动执行该点击。saving模拟等待60秒；失败/409首次操作失败，重试成功。失败零记录场景用来核验月历不会提前标已保存。

桌面50/手机20分页，名单内部滚动且有页脚。手机今天操作移到月历内“回到今天”；全选本页/一键全员正常不删除。长备注“展开全文”可编辑完整原文。

后续正式接入必须直接复用本组件和资源，并将现有 data/update/save/readOnly/mobile 注入；unsynced必须接真实工作区未同步/错误状态，不能省略后虚报月历已登记。本次未改正式workspace的保存/草稿/冲突流程。局部控制器修正了无新输入点击备注保存不能清空旧备注、save抛错转失败提示、空日期输入不切换等边界；正式页保持原状，集成时需复核。

复现：scripts/attendance-design-capture.mjs、attendance-design-interactions.mjs、attendance-design-supplement.mjs。证据入口record.json；geometry从真实浏览器读取，非图上估算。Windows实际字体Microsoft YaHei，不打包系统字体，不保证其他系统完全相同。

独立复核“可交用户审核”，不代表D/R通过。当前等用户审核P01；听写仍暂缓，不能接正式业务或部署。
