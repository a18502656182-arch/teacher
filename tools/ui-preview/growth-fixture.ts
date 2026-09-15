import {homeworkFixture} from './homework-fixture';
export const growthStates=['normal','mobile-detail','empty-class','no-facts','search-empty','students-105','long-record','filters','timeline-pages','composer','validation','summary','readonly','loading','saving','save-failure','save-throw','conflict-409','dirty-close'];
export function growthFixture(state:string){
 const d=homeworkFixture(state==='students-105'?'students-105':'normal');d.activeClassId='class-1';d.students.forEach((s,i)=>{s.score=82+i%15;s.points=12+i%10;});
 const student=d.students[0];d.homeworkTasks=d.homeworkTasks?.slice(0,1);d.homeworkTasks![0].date='2026-09-13';d.homeworkTasks![0].statuses[student.id]='已交';
 d.records=[{id:'growth-record-1',classId:'class-1',studentId:student.id,student:student.name,date:'2026-09-14',type:'家校沟通',content:'与家长交流阅读习惯，约定每天记录一次阅读感受。'}];
 d.pointEvents=[{id:'growth-point-1',classId:'class-1',studentId:student.id,scene:'日常',delta:2,date:'2026-09-14',reason:'主动协助同伴整理材料。'}];
 d.growthEvidence=[{id:'growth-fact-1',classId:'class-1',studentId:student.id,date:'2026-09-15',type:'进步',title:'主动分享阅读方法',content:'小组阅读时，主动介绍标记关键词的方法，并帮助同伴完成段落归纳。',followUp:'下周继续观察小组表达。',source:'班主任补充',createdAt:Date.parse('2026-09-15T08:00:00+08:00')}];
 if(state==='long-record'){d.students[0].name='学生01合成长姓名';d.growthEvidence[0].title='小组阅读中的表达与合作：持续观察与具体反馈';d.growthEvidence[0].content='合成长记录：在小组活动中主动分享阅读方法，协助同伴归纳段落，并解释自己的思考过程。'.repeat(10);d.growthEvidence[0].followUp='下周继续观察小组表达，并核对是否能独立完成归纳。'.repeat(5);}
 if(state==='timeline-pages')d.growthEvidence=Array.from({length:23},(_,i)=>({...d.growthEvidence![0],id:'growth-fact-'+i,title:'合成观察记录'+(i+1),date:`2026-09-${String(15-i%14).padStart(2,'0')}`,createdAt:Date.parse('2026-09-15T08:00:00+08:00')-i*86400000}));
 if(state==='no-facts'){d.growthEvidence=[];d.homeworkTasks=[];d.records=[];d.pointEvents=[];}
 if(state==='empty-class'){d.students=[];d.rosterClasses![0].students=[];d.growthEvidence=[];d.homeworkTasks=[];d.records=[];d.pointEvents=[];}
 return d;
}
