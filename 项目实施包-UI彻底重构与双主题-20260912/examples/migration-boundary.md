# 迁移边界示意

旧页面根：data-ui-generation="legacy"；新页面根：data-ui-generation="next"。
旧规则必须明确限制到legacy；单靠新根名称不构成CSS隔离。处理body、根变量、portal和祖先选择器后验证。
workspace store在这两个视图边界上层且只一个；不得在每个布局内部创建新的保存controller。
主题属性改变位于同一个DOM节点，不更换React key。手机和桌面切换使用同controller，可采用不同视图。
最终legacy页面数为零，删除legacy根和样式；不要把迁移开关作为用户的双站切换入口。
