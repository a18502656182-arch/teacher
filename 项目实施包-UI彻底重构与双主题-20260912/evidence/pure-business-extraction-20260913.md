# TASK-04 纯业务计算抽取证据

范围：工作区规范化、班级配置投影、日程日期与课程表派生、成绩读取模型、成长时间范围。开始HEAD：`8765907`；实现提交：`c944929`。

## 实际核对与移动

- `ClassroomApp.tsx` 中的 `normalizeData` 和 `scopeClassSettings` 移至 `workspace/normalize.ts`。根字段与按班映射的课程、座位和值日投影继续使用稳定班级ID；同名学生优先按显式班级解析。
- 日程默认配置、本机日期、学期月份、月周范围和课程二维数组投影移至 `features/schedule/read-model.ts`。保存校验仍由原 `features/schedule/operations.ts` 负责，没有把读取派生与写操作混在一起。
- 成绩科目、真实分值、满分、区间、等级和逐生行模型移至 `features/scores/read-model.ts`。写操作仍由原操作层负责；未录、部分录入和真实零分的区别不变。
- 成长记录的绝对/相对时间解析及7天、30天、学期范围移至 `features/growth/time-range.ts`。
- 学生删除关系清理继续使用既有 `features/students/relations.ts`，记录、成绩、日程等班级归属继续由各自操作层处理。本任务没有再建立一套重复关联算法。
- 主组件删除对应重复函数并改为导入。提交后主组件由5574行降为5191行；它仍然过大，后续页面/controller迁移继续拆分，不能据此宣称大组件问题已解决。

## 核验发现与修正

- 显式 `homeworkTasks: []` 原先会被规范化成一条“今日作业”，正式空工作区因此不是真空状态。现在只有旧数据完全缺失该字段时才生成兼容任务，显式空数组保持空。
- 缺失 `weeklyPlan` 原先会生成五条示例周计划。当前缺失或显式空值均保持空，不把演示内容写进正式工作区。
- 工作区规范化不修改输入对象，零分、零积分和空数组不会被真值回退覆盖。

## 自动验证

- 聚焦回归：`node --test tests/workspace-normalize.test.mjs tests/business-read-models.test.mjs`，10/10通过。
- TypeScript：`npx tsc --noEmit --pretty false --incremental false`，通过。
- ESLint：`npm run lint`，通过。
- 完整验证：`npm test`，生产构建、217/217自动化测试及认证集成通过；保留既有500KB以上chunk警告。
- 计划检查：任务依赖、23个功能/浮层范围、207条验收行、证据门槛和UTF-8检查通过。

本任务没有改变DOM、CSS或可见交互，因此没有生成新的浏览器截图，也不把构建结果当作视觉验收。没有连接生产数据库、启动生产服务、生成部署包或操作线上环境。

## 下一步

进入TASK-05，抽取一般工作区保存、本机草稿、失败重试、排队保存与409冲突控制器。听写专用并发合并不能被误当作通用保存语义；完成后用E7、E8、E9实际驱动控制器回归。
