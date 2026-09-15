import {createRoot} from 'react-dom/client';
// @ts-expect-error Vite recovery exports current local components in memory only.
import {ScoresSource,ScoresMobileSource} from '../../app/w/[token]/ClassroomApp';
import {ThemeBoundary} from '../../app/components/workbench/theme/ThemeBoundary';
import {homeworkFixture} from './homework-fixture';
import './students-preview.css';import '../../app/globals.css';import pageStyles from '../../app/w/[token]/ClassroomPages.module.css';
const data=homeworkFixture('normal');data.activeClassId='class-1';data.scoreExams=[{id:'synthetic-score-1',classId:'class-1',title:'9月综合练习',date:'2026-09-15',subjects:['语文','数学','英语'],subjectMaxScores:{语文:100,数学:100,英语:100},scores:Object.fromEntries(data.students.map((s,i)=>[s.id,{语文:80+i%16,数学:i===2?0:82+i%14,...(i===1?{}:{英语:78+i%18})}])),followUpStudentIds:[data.students[2].id]}];const props={data,workspaceToken:'synthetic-only',update:()=>{},save:async()=>false,readOnly:true};
createRoot(document.getElementById('root')!).render(<ThemeBoundary className={pageStyles.root}>{innerWidth>900?<ScoresSource {...props}/>:<ScoresMobileSource {...props} activeClass={data.rosterClasses![0]} open={()=>{}}/>}</ThemeBoundary>);
