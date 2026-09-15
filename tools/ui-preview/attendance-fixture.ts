import { createEmptyClassroomData, type AttendanceStatus, type Student } from '../../lib/classroom';
export const attendanceStates=['normal','selected-batch','day-note','month-calendar','history-date','no-day-record','empty-class','search-empty','students-105','long-note','readonly','loading','saving','save-failure','conflict-409','dirty-leave','filters','save-failure-empty'];
export function attendanceFixture(state:string){
 const data=createEmptyClassroomData();
 const students:Student[]=Array.from({length:state==='empty-class'?0:state==='students-105'?105:32},(_,i)=>({id:`att-student-${i+1}`,name:`学生${String(i+1).padStart(2,'0')}`,studentNo:String(i+1).padStart(2,'0'),gender:i%2?'女':'男',group:Math.floor(i/4)+1,seat:i+1,points:0,score:0,homework:'已交',attendance:(i===1?'迟到':i===2?'请假':i===3?'缺勤':'正常') as AttendanceStatus,parentPhone:'',note:i===4?'合成共享备注关键词：晨读观察':''}));
 data.students=students;data.activeClassId='class-1';data.rosterClasses=[{id:'class-1',name:'三年级2班',grade:'三年级',term:'2026年秋季',students}];
 data.attendanceRecords=['no-day-record','save-failure-empty'].includes(state)?[]:students.map((s,i)=>({id:`att-record-${i}`,classId:'class-1',studentId:s.id,date:'2026-09-15',period:'全天',status:s.attendance,note:state==='long-note'&&i===0?'合成长备注：今日到校后已与家长沟通，午间继续观察身体状况。'.repeat(16):i===1?'08:10到校':i===2?'身体不适，家长已联系':'',createdAt:1789434000000}));
 if(!['no-day-record','save-failure-empty'].includes(state))data.attendanceRecords.push(...students.map((s,i)=>({id:`att-history-${i}`,classId:'class-1',studentId:s.id,date:'2026-09-14',period:'全天' as const,status:'正常' as const,note:'合成历史记录',createdAt:1789347600000})),{id:'att-departed',classId:'class-1',studentId:'departed-student',date:'2026-09-14',period:'全天',status:'请假',note:'已离班合成学生历史记录',createdAt:1789347600000},{id:'att-otherclass',classId:'class-other',studentId:'other-student',date:'2026-09-15',period:'全天',status:'缺勤',createdAt:1789434000000});
 return data;
}
