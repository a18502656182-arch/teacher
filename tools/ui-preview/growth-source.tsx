import { createRoot } from 'react-dom/client';
// @ts-expect-error Vite recovery plugin adds these exports in memory only.
import { GrowthSource, GrowthMobileSource } from '../../app/w/[token]/ClassroomApp';
import { ThemeBoundary } from '../../app/components/workbench/theme/ThemeBoundary';
import { homeworkFixture } from './homework-fixture';
import './students-preview.css';
import '../../app/globals.css';
import pageStyles from '../../app/w/[token]/ClassroomPages.module.css';
const data = homeworkFixture('normal');
data.activeClassId = 'class-1';
data.students.forEach((s,i)=>{s.score=82+i%15;s.points=12+i%10;});
data.growthEvidence=[{id:'growth-synthetic-1',classId:'class-1',studentId:data.students[0].id,date:'2026-09-15',type:'进步',title:'主动分享阅读方法',content:'小组阅读时，主动介绍了标记关键词的方法，并帮助同伴完成段落归纳。',followUp:'下周继续观察小组表达。',source:'班主任补充',createdAt:new Date('2026-09-15T08:00:00+08:00').getTime()}];
const props={data,update:()=>{},save:async()=>false,readOnly:true};
createRoot(document.getElementById('root')!).render(<ThemeBoundary className={pageStyles.root}>{innerWidth>900?<GrowthSource {...props}/>:<GrowthMobileSource {...props} workspaceToken="synthetic-only" active="growth" activeClass={data.rosterClasses![0]} growthRequest={{studentId:new URLSearchParams(location.search).has('detail')?data.students[0].id:'',sequence:1}} open={()=>{}}/>}</ThemeBoundary>);
