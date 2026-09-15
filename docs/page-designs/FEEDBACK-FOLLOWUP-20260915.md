# 操作反馈统一补修
用户2026-09-15指出互动按钮不断插入横条且消失规则不一；允许原位结果或角落短暂浮层。

成绩隔离P02.3已实施：正常同步中不展示pending恢复横条；成功仅原位结果+屏幕阅读器status；其他message右下角2.5秒浮层。失败/冲突/未保存保护保留。1536/390合成12项交互通过，实际截图已查。

其他页尚未迁移（禁止写成全站已修）：StudentsDesign.tsx:101；HomeworkDesign.tsx:335；AttendanceDesign.tsx:31；GrowthDesign.tsx:17；HealthDesign.tsx:17；RecordsDesign.tsx:23。均有message横条，考勤messageError混合错误、成长/沟通复制失败混在message中，迁移须先区分类型，不能统一计时隐藏全部消息。后续每页保持草稿/重试/冲突入口，并对已审页补桌面手机回归。

正式业务组件未修改；反思新稿继承原位反馈规则。当前完成范围为成绩，其他页面统一补修待实施，不因候选继续而关闭此项。
