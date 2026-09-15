import {scoresFixture} from './scores-fixture';
import {saveExamReflection} from '../../app/w/[token]/features/reflections/operations';
export const reflectionStates=['normal','legacy-library','mobile-editor','saved-library','empty-class','no-exams','search-empty','students-105','long-exams','readonly','loading','saving','save-failure','save-throw','conflict-409','dirty-close','exam-picker','score-detail'];
export function reflectionFixture(state:string){let data=scoresFixture(state==='students-105'?'students-105':'normal');data.examReflections=[];data.records=[];
 const ex=data.scoreExams![0];ex.scores[data.students[0].id]={语文:82,数学:78,英语:80};
 for(let i=0;i<8;i++){const result=saveExamReflection(data,'class-1',{id:'reflection-'+i,studentId:data.students[i].id,examId:ex.id,date:'2026-09-15',problem:'审题时漏看了条件，应用题的解题步骤没有写完整。',reason:'先听学生复述思路，再核对出错环节。',action:'每天选一道错题，先圈出条件，再写出解题步骤。周五一起复查。',familyMessage:'每天留十分钟，让孩子讲一道题的思路。',teacherNote:'周五查看订正情况，再调整练习安排。'},i<3?'草稿':'已完成',()=> 'reflection-'+i,()=> 'archive-'+i);if(result.data)data=result.data;}
 if(state==='empty-class'){data.students=[];data.rosterClasses![0].students=[];data.examReflections=[];}if(state==='no-exams'){data.scoreExams=[];data.examReflections=[];}
 if(state==='students-105'){data.students[0].name='学生01合成长姓名用于验证换行';data.rosterClasses![0].students[0].name=data.students[0].name;data.examReflections![0].teacherNote='本段为合成长内容，用于检查文本换行和草稿保留。'.repeat(30);}
 if(['long-exams','exam-picker'].includes(state)){data.scoreExams=Array.from({length:35},(_,i)=>({...structuredClone(ex),id:i===0?ex.id:'exam-'+i,title:'第'+(i+1)+'次综合练习与跨学科项目阶段回顾',date:'2026-'+String(1+i%9).padStart(2,'0')+'-15'}));}
 if(state==='legacy-library'){data.scoreExams!.push({...structuredClone(ex),id:'older-exam',title:'上次综合练习'});data.examReflections!.push({...structuredClone(data.examReflections![0]),id:'legacy-reflection',studentId:data.students[8].id,examId:undefined,reason:'合成历史原因检索证据'});data.examReflections!.push({...structuredClone(data.examReflections![0]),id:'older-reflection',studentId:data.students[9].id,examId:'older-exam'});}
 return data;
}
