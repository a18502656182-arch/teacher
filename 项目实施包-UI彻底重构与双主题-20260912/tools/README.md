# 只读检查工具

所有工具只读，不修改源码/数据库，不安装依赖。

- python tools/verify-package.py：核对交付时文件哈希、图片数量和查看器链接。后续编辑进度文件后哈希不同是预期，不能恢复旧进度来消除差异。
- python tools/check-plan.py：检查任务依赖无前向/循环、23范围覆盖、207场景、done/pass证据和UTF-8。
- python tools/check-source-drift.py：本包放回项目目录后对比当前源码；漂移不代表错误，不自动reset。

封装zip是交付快照。工作目录内的trackers是后续可更新进度；保留原zip用于核对初版，不反向覆盖新进度。
这些通过仅证明资料完整和样例契约，不证明任何网站页面、视觉或业务已重构通过。
