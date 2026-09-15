import { createEmptyClassroomData, type Student, type HomeworkTask } from '../../lib/classroom';

export const homeworkStates = ['normal','empty-tasks','tasks-30','students-105','long-title-note','search-empty','task-editor','validation','filters','mobile-detail','selected','follow-empty','follow-full','loading','readonly','saving','save-failure','conflict-409','dirty-close','delete-confirm'];
/** Synthetic fixture only; never imported by ClassroomApp. */
export function homeworkFixture(state:string) {
 const data=createEmptyClassroomData();
 const count=state==='students-105'?105:32;
 const statuses:HomeworkTask['statuses'][string][]=['未交','已交','待订正','已复查',...Array<HomeworkTask['statuses'][string]>(19).fill('已交'),'未交','未交','待订正','待订正','待订正','待订正','已复查','已复查','已复查'];
 const students:Student[]=Array.from({length:count},(_,i)=>({id:`hw-student-${i+1}`,name:`学生${String(i+1).padStart(2,'0')}`,studentNo:String(i+1).padStart(2,'0'),gender:i%2?'女':'男',group:Math.floor(i/4)+1,seat:i+1,points:0,score:0,homework:statuses[i%32] === "已复查" ? "已交" : statuses[i%32] as Student["homework"],attendance:'正常',parentPhone:'',note:state==='long-title-note'&&i===0?'合成长备注：阅读时已能找出关键句，下一次练习请继续观察书写顺序与订正过程。'.repeat(8):i===2?'订正后请老师复查。':''}));
 data.students=students;
 data.rosterClasses=[{id:'class-1',name:'三年级2班',grade:'三年级',term:'2026年秋季',students}];
 const tasks:HomeworkTask[]=Array.from({length:state==='empty-tasks'?0:state==='tasks-30'?30:3},(_,i)=>({id:`hw-task-${i+1}`,classId:'class-1',subject:['语文','数学','英语'][i%3],title:state==='long-title-note'&&i===0?'第3课生字练习与阅读记录：先完成课后题，再整理错题并写出订正理由。'.repeat(6):['第3课生字练习','练习册第12页','Unit2单词抄写'][i%3],date:i<2?'2026-09-14':`2026-09-${String(Math.max(1,15-i)).padStart(2,'0')}`,statuses:Object.fromEntries(students.map((s,j)=>[s.id,i%3===2?'已交':i%3===1?(j<12?'未交':'已交'):statuses[j%32]])),followUpStudentIds:state==='follow-full'?['hw-student-1','hw-student-3']:[]}));
 data.homeworkTasks=tasks;return data;
}
