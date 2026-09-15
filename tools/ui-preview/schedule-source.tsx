import {createRoot} from 'react-dom/client';
import {ScheduleHub} from '../../app/w/[token]/ScheduleHub';
import {TeacherAgenda} from '../../app/w/[token]/TeacherAgenda';
// @ts-expect-error Current local mobile component exported only by recovery Vite transform.
import {ScheduleMobileSource} from '../../app/w/[token]/ClassroomApp';
import {ThemeBoundary} from '../../app/components/workbench/theme/ThemeBoundary';
import {homeworkFixture} from './homework-fixture';
import {createDefaultScheduleConfig} from '../../app/w/[token]/features/schedule/read-model';
import './students-preview.css';import '../../app/globals.css';import pageStyles from '../../app/w/[token]/ClassroomPages.module.css';
const data=homeworkFixture('normal'),date='2026-09-15';data.activeClassId='class-1';
data.scheduleConfig={...createDefaultScheduleConfig(new Date(2026,8,15)),schoolYear:'2026—2027学年',term:'上学期',termStartMonth:'2026-09',termEndMonth:'2027-01'};
data.courses=Array.from({length:5},(_,d)=>data.scheduleConfig!.periods.map((_,i)=>['语文','数学','英语','体育','科学','音乐','美术',''][((d+i)%8)]));data.scheduleWeeks=[];
data.teacherAgenda=[{id:'synthetic-agenda-1',classId:'class-1',date,startTime:'08:00',endTime:'08:20',type:'备课',title:'整理阅读课材料',detail:'准备圈画依据的示例',status:'待处理',createdAt:1},{id:'synthetic-agenda-2',classId:'class-1',date,startTime:'12:20',endTime:'12:40',type:'辅导',title:'复查数学订正',detail:'听学生复述应用题步骤',relatedStudentIds:[data.students[0].id,data.students[3].id],status:'进行中',createdAt:2}];
data.workLogs=[{id:'synthetic-log-1',classId:'class-1',date,type:'班级事务',title:'整理阅读反馈',detail:'归纳阅读中的共性问题',durationMinutes:15,createdAt:3}];
const props={data,workspaceToken:'synthetic-only',update:()=>{},save:async()=>false,readOnly:true};
const agenda=new URLSearchParams(location.search).get('state')==='agenda';
Object.assign(window,{__scheduleSource:{mode:'read-only synthetic',fixture:data}});
createRoot(document.getElementById('root')!).render(<ThemeBoundary className={pageStyles.root}>{agenda?<TeacherAgenda {...props} mobile={innerWidth<=900}/>:innerWidth>900?<ScheduleHub {...props}/>:<ScheduleMobileSource {...props} active="schedule" growthRequest={{studentId:'',sequence:0}} activeClass={data.rosterClasses![0]} open={()=>{}}/>}</ThemeBoundary>);
