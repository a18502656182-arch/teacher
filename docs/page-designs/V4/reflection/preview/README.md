# 反思P01独立可运行设计

启动：npx vite --config tools/ui-preview/reflection.vite.config.ts --host 127.0.0.1
访问：http://127.0.0.1:4220/reflection.html
组件：app/designs/reflection/ReflectionDesign.tsx；controller使用既有reflections/operations，不接正式ClassroomApp。

左下角设计预览可切换normal、mobile-editor、saved-library、legacy-library、empty-class、no-exams、search-empty、students-105、long-exams、readonly、loading、saving、save-failure、save-throw、conflict-409、dirty-close。
exam-picker/long-exams载入长考试库，再点击切换考试；score-detail选择学生后点查看本次成绩。mobile-editor在390px为独立填写界面。
legacy-library选择已保存反思，搜索合成历史原因检索证据，可查看未关联记录并选择没有重复记录的考试关联编辑。
全部为合成内存；保存400ms，false/throw首次失败后可重试，409持续冲突并可导出/载入最新（重置合成fixture）。不操作真实班级，不上传，不外发。

候选不是实际网页；当前P01仍待用户审美，弹窗不因技术复核通过而获准，下一步停等审核。
