import { createRoot } from 'react-dom/client';
// @ts-expect-error Vite recovery plugin adds these exports in memory only.
import { RecordsSource, RecordsMobileSource } from '../../app/w/[token]/ClassroomApp';
import { ThemeBoundary } from '../../app/components/workbench/theme/ThemeBoundary';
import { homeworkFixture } from './homework-fixture';
import './students-preview.css';
import '../../app/globals.css';
import pageStyles from '../../app/w/[token]/ClassroomPages.module.css';
const data = homeworkFixture('normal');
data.activeClassId = 'class-1';
data.records=[{id:'record-synthetic-1',classId:'class-1',studentId:data.students[0].id,student:'学生01',type:'作业跟进',channel:'微信',date:'2026-09-15',content:'目的：了解作业安排｜家庭情况：｜沟通内容：与家长核对阅读作业的完成安排。',parentFeedback:'家长反馈：晚间可陪同阅读。',followUp:'约定9月17日再交流阅读情况。',status:'待跟进'},{id:'record-synthetic-2',classId:'class-1',studentId:data.students[1].id,student:'学生02',type:'谈心记录',channel:'电话',date:'2026-09-14',content:'目的：了解课堂表达｜家庭情况：｜沟通内容：交流孩子在小组活动中的表达情况。',parentFeedback:'家长愿意继续观察。',followUp:'下周了解孩子的参与感受。',status:'待跟进'},{id:'record-synthetic-3',classId:'class-1',studentId:data.students[2].id,student:'学生03',type:'表扬记录',channel:'面谈',date:'2026-09-12',content:'目的：反馈进步｜家庭情况：｜沟通内容：向家长分享孩子主动帮助同伴的具体表现。',parentFeedback:'已收到家长反馈。',followUp:'保持观察，及时反馈。',status:'已跟进'}];
data.notificationDrafts=[{id:'notice-synthetic-1',classId:'class-1',title:'本周阅读安排',content:'请家长与孩子共同确认本周阅读安排，周五交流阅读感受。',channel:'班级群',recipientStudentIds:[],status:'草稿',date:'2026-09-15',createdAt:1789434000000},{id:'notice-synthetic-2',classId:'class-1',title:'阅读反馈提醒',content:'请交流孩子近期的阅读感受。',channel:'私聊',recipientStudentIds:[data.students[0].id],status:'已记录回执',receiptNote:'家长表示已了解。',date:'2026-09-14',createdAt:1789347600000}];
const props={data,update:()=>{},save:async()=>false,readOnly:true};
createRoot(document.getElementById('root')!).render(<ThemeBoundary className={pageStyles.root}>{innerWidth>900?<RecordsSource {...props}/>:<RecordsMobileSource {...props} workspaceToken="synthetic-only" active="records" activeClass={data.rosterClasses![0]} growthRequest={{studentId:new URLSearchParams(location.search).has('detail')?data.students[0].id:'',sequence:1}} open={()=>{}}/>}</ThemeBoundary>);
