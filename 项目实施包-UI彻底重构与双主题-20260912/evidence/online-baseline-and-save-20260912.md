# 线上导出核验与保存层提取

## 线上基线

用户提供classroom-online-source.tar.gz，1,077,263字节，SHA-256 F2019A92C0E1CDB850DE1D790105CBE4DD82973645188244352841F0951E1E92。
只读取归档，拒绝绝对路径、父级跳转、软硬链接；未发现该类条目。仅将app/lib/db/public及package/config受检文件解到被忽略的evidence-local/online-source-20260912，不覆盖工作源码、不执行归档脚本。

受检88文件，与Git 0691aba的对应文件在统一CRLF/LF后完全一致；无该基线运行文件缺失。线上目录额外残留app/components/campus/legacy-theme.css和app/w/[token]/WorkbenchPageHeader.module.css，受检源码未引用它们。没有将残留样式重新引入。
与开始HEAD 2891b8f相比，差异为package.json、campus/primitives.tsx、dictation/Grading.tsx、ClassroomApp.tsx，及本地新增workbench基础层/features/原创插画；均对应本地后续开发。继续以线上0691aba为已核实来源、叠加保留本地增量，不reset/rebase覆盖。
此比较证明服务器目录的导出源码，不证明运行进程使用的dist、进程启动时间或线上视觉已经验收。

## 保存操作

updateData/save/commitWorkspace提到workspace/operations.ts，由原ClassroomApp事件包装调用；ref仍由原组件持有，首次载入、备份恢复及离开守卫暂留原处。types.ts共用Workspace/LocalWorkspaceDraft。不是全部workspace controller完成。
加入8项真实操作函数回归，模拟网络/存储，不连接生产：一般草稿、失败重试、409锁、排队revision、只读/demo、听写失败、并发新编辑、容量上限。

补测复现并修正一项原有缺陷：听写提交期间的一般编辑写出旧revision草稿；听写成功后原代码只更新内存，导致草稿无法按新服务器revision恢复。现在成功且仍有一般dirty编辑时，存储accepted.data及新revision；不清dirty。测试先以1!=2失败，再修复通过，未降低断言。
UI冲突提示使用已有saveConflict state，避免渲染阶段读ref。未更改API、正式数据库、页面结构或主题。

归档源码不会参与本地编译：tsconfig/eslint仅排除被忽略的evidence-local目录；不排除正式源码或测试。原静态断言改为读取真实新操作文件，并新增根组件接线断言。

## 未完成

## 样式隔离准备与验证

scripts/legacy-css-scope.mjs使用PostCSS保留原声明/顺序，LightningCSS解析选择器AST；在最终目标元素上限定legacy并排除next子树，保留伪元素位置及动画。html/body/:root目标报告人工拆分，不假装隔离。序列化异常则报错，禁止悄悄丢规则。尚未接入正式CSS构建。

独立浏览器/?isolation=1实测旧controls.css切换：旧输入框圆角0→8px；新输入框始终圆角10px、字体16px、高44px、白底、rgb(23,53,74)文字，采集的计算样式完全相同。截图仅存evidence-local/legacy-scope-20260912.png，不公开提交。此探针不加载旧根变量，不证明全站样式/portal/移动端已隔离。

新增4项AST回归，包括workbench-repair全部声明值/顺序/important保持一致。构建、58/58业务与静态测试、认证集成、TypeScript、完整ESLint通过；qa:strict本轮通过。依赖显式固定已有LightningCSS/PostCSS版本，同时lock修正旧项目名与已移除依赖的历史漂移，未升级业务依赖。

### 仍未覆盖

TASK02完整账本、TASK05首次加载/恢复/离开状态聚合及浏览器综合失败场景、TASK09旧CSS隔离均未完成。新页面仍不切生产。StudentProfile已完整读到联系人/照护/标签/住宿/历史保存，原表单本地应用后关闭，仍待新controller和脏关闭设计；不得因当前保存提取而宣布全部门槛通过。
