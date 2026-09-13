# TASK-10 首批校园插画母样与变体实施证据

- 开始 HEAD：`bbd047e`
- 源码提交：`5fd3fc5`
- 范围：`home.scene`、`dictation.context`、`student.detail`、`homework.context` 的校园主题候选资源、手机变体、语义映射与裁切探针。

## 来源与生成约束

资源使用 OpenAI image generation 独立生成。C1–C4 只作为暖白纸色、浅蓝、粉笔绿、自然晨光、水彩笔触、主体偏右和左侧文字安全区的参考，没有复制参考图中的人物、动物、口号或界面。原始生成 PNG 保存在本机忽略目录 `evidence-local/generated/task10/`，产品只提交压缩后的 WebP。

提示方向如下：

1. 母样：晨光教室工作桌、黑板、空白名册/卡片、课本、铅笔、绿植；主体居中偏右，左侧留空；无人、动物、UI、标志、文字或水印。
2. 听写：沿用母样媒介和色彩，空白词卡、黄蓝铅笔与双色橡皮；主体偏右、左侧留空，不生成单词。
3. 学生档案：空白班级名册、索引卡、蓝色笔筒、深绿黑板和绿植；编辑轮移除了带刻度尺规和疑似文字。
4. 作业：空白练习本、叠放笔记本、珊瑚色铅笔、无刻度直尺、夹子和笔筒；不生成批语或分数。
5. 母样修订：移除尺规数字、刻度和任何疑似可读标记，保留空白纸页、网格及无语义线条。

## 生产候选

| 角色 | 桌面 | 手机 | 字节 |
| --- | --- | --- | --- |
| home.scene | `home-scene-v3.webp` 1200×800 | `home-scene-mobile-v3.webp` 900×560 | 144932 / 91830 |
| dictation.context | `dictation-context-v2.webp` 1200×800 | `dictation-context-mobile-v2.webp` 900×560 | 105988 / 62522 |
| student.detail | `student-detail-v2.webp` 1200×800 | `student-detail-mobile-v2.webp` 900×560 | 132626 / 78852 |
| homework.context | `homework-context-v2.webp` 1200×800 | `homework-context-mobile-v2.webp` 900×560 | 136916 / 83986 |

四组文件均为不透明 WebP。它们是带暖纸背景的全幅情境横幅，不是独立抠图，因此“透明边缘”不适用；边缘通过自然暖白融合。后续独立摆件资源才要求 alpha。业务标题、说明和状态始终由 HTML 提供，图片仅作装饰。

## 实际裁切与验证

- 独立检查器 `/?artwork=1`：1280×720 下每个横幅约 974×258，加载 1200×800 桌面资源；无横向溢出，控制台 error/warn 为 0。
- 390×844：每个横幅约 341×208，`picture` 实际切换到 900×560 手机资源；文案保留在左侧安全区，主体未挡住标题，无横向溢出，控制台 error/warn 为 0。
- `node --test tests/theme-contract.test.mjs`：5/5。
- TypeScript 与相关 ESLint：通过。
- `npm test`：生产构建、234/234 自动化测试、认证集成通过；仅保留既有大 chunk 警告。
- `npm run qa:strict`：115 项六档视口布局审计通过。
- 独立finish reviewer：`ship-with-notes`，无阻断项；确认八个WebP规格、无可读假文字、全幅不透明策略、响应式资源切换和glass无回退均合理。非阻断建议是后续可把手机900×560编码尺寸也加入自动契约断言；本轮已有Sharp元数据与浏览器固有尺寸双重证据。

## 边界与下一步

这些资源在主题 manifest 中标记为 `candidate`，不代表相应真实业务页已经完成迁移。glass 资源仍为空且没有公开切换入口；旧素材只保留为历史候选，没有批量替换其他角色。TASK-11 接下来建立共享壳层，TASK-12 才把首页完整迁到真实数据和状态。
