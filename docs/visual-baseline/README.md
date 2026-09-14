# 视觉基线证据目录

- `references/`：随Git保存的C1-C6高质量WebP副本，用于换机和上下文恢复；原始PNG及哈希见`trackers/visual-baseline.json`。
- `current/`：经实际浏览器检查并接受为证据的当前实现截图。
- `comparisons/`：固定视口、同显示尺寸的参考/实际并排图；只有这里的持久证据可支持门槛提交用户审核。

调试过程截图继续放在被忽略的`.qa-shots/`，不得把错误页、加载页、裁切图或旧截图复制到本目录。每张持久截图必须在保存后重新打开检查，并在JSON账本中登记。

schema 2 中，进入 `ready-for-review` 或 `user-approved` 的页面不能只登记路径。每条当前图和对比图都必须包含 `path`、`kind`（desktop/mobile）、`viewport`、`url`、`capturedAt`、`productCommit` 和 `sha256`；对比图还须登记 `referenceId`。桌面与手机证据必须是不同文件，监工状态独立登记，PASS及用户批准都必须绑定同一产品提交。

固定采集命令示例：

```powershell
npm run qa:visual-capture -- --gate V1
```

该命令使用1536×1024和390×844两个视口，将候选PNG写入`.qa-shots/visual-baseline/V1/`。确认页面、状态和裁切正确后，再压缩为WebP并登记到JSON；采集成功本身不等于视觉通过。
