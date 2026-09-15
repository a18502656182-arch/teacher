# 健康与照护 P01 独立完成度复核

复核日期：2026-09-15，round2 复核更新。范围：隔离 P01 当前源码、round1/round2 截图及交互/补充证据；不含正式业务接入、部署或用户审美批准。报告只修改本文件。

## Direction contract

依据主线程转达的用户确认，C01 桌面与手机方向已获准制作隔离 P01。已读取 brief、function-map、record、项目 AGENTS 与 craft-floor，并实际打开两张 C01。白纸工作面、左行动清单与右浅绿单条详情、手机独立清单/详情均构成合同；紧凑控件服务日常查阅，不能把照护登记改成一次性待办。实际共享 WorkbenchShell 为准，不复制候选虚构教师名、鼓励标语或侧栏装饰。

首轮复核读取时 record 仍是 concept-review、C01 未确认状态，这是当时主线程待同步的旧账本，不能用它推翻本轮授权，也不能提前记为 P01 已批准。弹窗外观允许专项后审；输入、保存、失败、冲突和草稿恢复仍必须可用。

## Evidence/coverage

独立读取 app/designs/health 的 HealthDesign.tsx、useHealthDesignController.ts、HealthDesign.module.css，以及 tools/ui-preview/health.tsx、health-fixture.ts。实际逐张打开 round1 的 1536-normal、390-normal、390-mobile-detail、390-composer、390-conflict-409、1536-long-record、390-delete-confirm；未启动浏览器或修改产品代码。

round1 capture.json 登记 36 张双端状态截图，所有记录的 squeezed 为 0，scrollWidth 未超过相应视口；failures、consoleErrors 无条目。首轮 interactions 为空，未用静态图替代交互验证。

第二轮重新读取三个源码文件，实际打开 round2 的 390-normal、390-summary-only、1536-normal、1536-long-record、390-mobile-detail，以及 supplement 的 390-conflict-409-recovery、390-students-105-last-page、360-normal-narrow。独立读取 interactions/interactions.json：64 项双端 DOM 检查均为 passed，failures/consoleErrors 为空；包含分隔符逐字输入、两场景保存、摘要详情、第二页和末页选中、删除取消/确认/失败重试、持续409恢复。这里是对主线程生成的测试证据复核，未声称本复核另开浏览器执行测试。

supplement.json 登记 10 张补充图及计算布局：桌面工作面内边距28px/30px/20px、工具栏间距12px、列表列间距18px；手机工作面18px/16px/90px、工具栏间距10px、列表间距7px。布局与观察到的连续工作面一致，记录的各视口均无横向溢出。恢复动作在滚动后 top=694.625、bottom=738.625，位于844px视口与固定页脚上方。全部文本对比度和完整键盘焦点巡检仍未由本复核独立测量，不扩大为全站无障碍通过。

已观察到：正常桌面连续列表与浅绿详情方向一致，搜索筛选紧凑，次要动作保持文本强调；手机详情可独立阅读且有返回清单入口。长记录自然增长，不靠裁掉行动内容维持等高。联系人已改为明确的展开操作。新增/编辑使用搜索选择器；controller 每页最多 10 条，源码有失败重试复用待同步状态及异常捕获。

## Material fixes

1. **HF-01：resolved。** 原每次输入立即 split/join 会吞掉尾部分隔符。现已改为 customContextsText 独立原始字符串，仅 persist 时解析；dirty 同时比较该字符串基线。双端“separator retained while typing”和“two custom contexts saved”通过，修复没有绕开正常逐字输入。
2. **HF-02：resolved。** 详情新增非空 p.summary，390-summary-only 实际图完整显示“仅摘要：外出前确认集合地点”；instruction 为空仍有明确占位。双端 summary remains in detail 通过，正常图与长摘要图未出现裁切。
3. **HF-03：resolved。** selected 改为从当前 rows 匹配 id，否则取当前页首条。双端 page selection matches visible first、last page bounded and selected 通过；105 条末页图显示11/11，上一页可用、下一页禁用、页底可达。
4. **HF-04：resolved。** 手机概览去除240px限制，390-normal 和360-normal-narrow 均完整呈现统计及可见范围文案，未出现孤字行。长姓名学号改为 inline-block/nowrap，1536-long-record 中“· 学号01”整组换行，原拆字问题同时关闭。

## Refinement notes

409 恢复可达性在本次复核范围内 resolved：补充实际图清楚显示错误、保留提示、导出草稿与载入最新数据；双端持续409、导出可达、载入要求明确确认、取消保留、确认恢复均通过。删除失败重试亦保留待同步操作且不会再删另一条。导出下载文件完整内容/跨设备恢复仍属于正式接入后的业务验证，不据模拟测试宣称已覆盖。删除确认的双层遮罩和现有弹窗外观为 unresolved 的后置专项，不作为主页面重开设计的理由，也不计外观通过。

手机主页面标题在共享顶栏与内容区重复，属于未实施的层级微调建议，不要求改变已确认方向。PNG 素材约1.93MB仍可做非阻断优化；主线程报告 lint 的 img 性能提示与 detector 的局部颜色/字号 advisory 应保留在交付记录。页面“仅班主任查看”是展示文案，不是服务器权限验证。

## Verdict

**PASS / 可交用户审核（限隔离主页面呈现与已覆盖功能）。** HF-01 至 HF-04 均 resolved；本次新图和交互证据没有发现剩余阻断项。C01 主方向成立，控件紧凑，摘要、分页和恢复路径的小批修复已闭环。弹窗专项仍 unresolved 且是正式接入前条件；此结论不是用户 D/R 批准，未批准正式接线或部署。生产/隔离构建与类型通过属于主线程报告；所有 build、qa:strict 等最终声明以其日志为准，本独立复核未运行或声称整站通过。
