# 听写逐动作核验与独立迁移进度

基线：13d9dfc。这里只核验听写批改切片，不代表 TASK02 全站账本完成。

## 源码与新旧边界

- 原 `app/w/[token]/dictation/Grading.tsx` 的状态、草稿 effect、切人、放弃和保存函数原样提取到 `features/dictation/useGradingController.ts`；原页面仍使用原 JSX，调用共享 hook。
- 新 `features/dictation/GradingView.tsx` 使用同一 hook，响应式 CSS Modules，共享控件和语义 Artwork；目前只在 `tools/ui-preview` 加载。正式 Dictation 路由尚未切到它。
- 父层 Dictation 的 change/commit、版本确认、assertDictation、复习任务生成没有替换。预览 onSave 是明确标注的模拟响应，不能当真实保存/409 验证。
- 新资产 `public/art/campus/dictation-stationery-v2.png` 为本次 imagegen 原创词卡/课本/铅笔静物，1666×944，1886556字节，无真实数据或参考角色。主题 dictation.context 登记为 candidate；上线前仍需资源压缩与容器评审。玻璃无资产、不公开切换。

## 逐动作保全表

|动作|现有规则/入口|新控制器或视图|本轮证据|
|---|---|---|---|
|初始学生|第一位待批改，否则第一位|hook initial state|源码与105人预览|
|姓名/学号搜索|大小写归一包含匹配|rows + query|搜索105成功|
|待批改筛选|无results记录|pendingOnly|源码核对，组合筛选待测|
|名单分页|每页20|新视图安全页码|105人显示6页，尾页点击待测|
|选择学生|dirty/busy阻止|changeStudent|桌面及手机脏状态拦截通过|
|点选错词|材料快照的索引，不改词库|wrong + resultRef清空|8词、200词最后一项通过|
|参与状态|graded/leave/absent；非graded提交空错词|state + save|源码保全；新UI状态切换待测|
|备注|可选300字，修改保留草稿|note|源码保全；字数边界待测|
|明确核对|未确认禁止保存，未批改不计全对|confirmed|初始保存禁用通过|
|失败保存|false/throw停留当前，保留待提交结果|save/resultRef|模拟false失败通过；throw未单测|
|重试成功|确认后清草稿，再到其他待批改者|save|模拟重试到下一位通过|
|只读|不恢复编辑草稿、不允许提交|readOnly + fieldset/button|表单及保存禁用通过|
|放弃|恢复已存结果并移除当前草稿|discard|浏览器清除未保存错词通过|
|本机草稿|token/task/person分键，恢复需重新确认|两个effect|热更新后恢复200词草稿已观察；跨账户隔离未重测|
|离开保护|beforeunload/自定义导航事件|guard effect/back|源码保全；刷新原生提示待测|
|错词复习|父层新建快照任务，保留旧记录|onReview透传|源码接线；探针只标记回调，不生成任务|
|打印|原window.print入口|print样式|入口保留；纸张排版未验收|
|手机名单开关|同一学生状态，不复制控制器|焦点到搜索，关闭回触发器|浏览器开关与搜索通过；真实手机键盘待测|
|家庭批改|家庭context独立，无班级名单|单列+保存批改|新增合成家庭夹具，截图；两个孩子隔离待测|

## 已验证与未验证

TypeScript、ESLint、生产构建、39项既有测试、认证集成、qa:strict已通过。静态设计探测在新视图范围返回[]（不加载旧DESIGN）；不代表C1–C6通过。
桌面1280宽无横向溢出及按钮文字挤压。手机使用390×844独立iframe检查长内容、末项确认和完整保存栏；iframe点击保存的响应未可靠取得，不能声称手机保存全流程通过。200词提交成功、显示1人已处理并进入合成学生02是在桌面主文档验证的。viewport接口调用后DOM仍报告1280宽，未将其当作直接390视口证据。物理手机与软键盘待测。截图保存在被忽略的evidence-local，不能提交公开仓库。

独立复核发现家庭空列、手机名单焦点、错词勾选色级联，已修正。最终页面门槛仍未通过：旧CSS混合隔离、生产接线、打印、409、家庭两个孩子、跨班、长名单全组合、全站弹窗均待后续。

学生名单已开始读Students控制器：搜索涵盖姓名/学号/电话/备注/小组/座位，当前toggleShownSelect覆盖全部筛选结果而非当前页；桌面applyBatchEdit未清selectedIds。这里只记录源码事实，尚未核完手机与父层保存，不据此改变业务。

下一步按TASK02继续Students/MobileStudents和Homework/MobileHomework逐handler核验；完成TASK05保存边界与TASK09旧CSS隔离，再通过共享壳层及标杆门槛切换正式页面。不要把独立预览误接成生产假保存。

## 2026-09-12 全模块补充核验

已继续核对Dictation、TaskEditor、WordLibrary、PersonFilter与navigation：任务/历史/错词/词库/家庭孩子均为同一响应式组件子视图，不是桌面和手机两份业务树。全写操作经change等待commit返回，失败留在原表单；任务重试复用pending ID，词库重试复用newBookId，批改失败停留当前人。

发现编辑未批改复习任务或归档任务时，TaskEditor用新任务对象只覆盖id/createdAt，导致sourceId/archived丢失。新增preserveTaskIdentity并用风险场景回归，现保留id、createdAt、results、sourceId和archived，只应用允许编辑的材料/参与者字段。词库名称增加trim后非空校验，打开新建/编辑时清理旧错误消息。

当前创建任务、词库编辑和孩子编辑是页内表单；PersonFilter是展开层；批改手机名单是局部抽屉；删除词库/任务与孩子归档使用全局确认。只有批改hook注册脏离开守卫，TaskEditor、WordLibrary和孩子表单可以直接取消/切子页而丢草稿，登记为迁移缺口。GradingView仍只在开发预览，生产继续旧Grading JSX。

本次补充后生产构建、70/70自动测试、认证集成、TypeScript、完整ESLint和qa:strict通过；变更目标设计检测为0项。未用这些代码检查替代生产接线或浏览器视觉验收。
