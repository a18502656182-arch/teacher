'use client';
import type { ClassroomData, DutyJob } from '@/lib/classroom';
import { CampusIcon, Button } from './primitives';

type Destination='students'|'homework'|'growth'|'records'|'schedule'|'duty'|'attendance';
export function Dashboard({data,open,defaultDutyJobs}:{data:ClassroomData;open:(id:Destination)=>void;defaultDutyJobs:DutyJob[]}) {
 const activeClass=data.rosterClasses?.find(c=>c.id===data.activeClassId)??data.rosterClasses?.[0];
 const students=activeClass?.students??data.students;
 const today=new Date().toLocaleDateString('sv-SE');
 const tasks=(data.homeworkTasks??[]).filter(t=>!t.classId||t.classId===activeClass?.id);
 const outstanding=tasks.reduce((n,t)=>n+Object.values(t.statuses).filter(s=>s!=='已交'&&s!=='已复查').length,0);
 const attention=students.filter(s=>s.score<80||s.attendance!=='正常'||s.homework!=='已交');
 const records=data.records.filter(r=>r.status==='待跟进').length;
 const agenda=(data.teacherAgenda??[]).filter(a=>(!a.classId||a.classId===activeClass?.id)&&a.date===today&&a.status!=='已完成'&&a.status!=='已取消').toSorted((a,b)=>(a.startTime??'99').localeCompare(b.startTime??'99'));
 const duties=(data.dutyJobs?.length?data.dutyJobs:defaultDutyJobs).filter(j=>j.enabled).slice(0,4);
 return <div className="campus-home-overview">
  <section className="campus-home-work" aria-label="今天的关键事项"><h2><CampusIcon name="attendance"/>今日工作</h2>
   <button onClick={()=>open('homework')}><CampusIcon name="homework"/><span><b>作业跟进</b><small>{outstanding?`${outstanding} 人次待处理`:'当前没有待处理的作业状态'}</small></span><span>查看作业 <CampusIcon name="arrow"/></span></button>
   <button onClick={()=>open('attendance')}><CampusIcon name="attendance"/><span><b>今日考勤</b><small>查看并登记今天的到校情况</small></span><span>登记考勤 <CampusIcon name="arrow"/></span></button>
   <button onClick={()=>open('records')}><CampusIcon name="records"/><span><b>家校沟通</b><small>{records?`${records} 条约定待跟进`:'当前没有待跟进的沟通记录'}</small></span><span>查看记录 <CampusIcon name="arrow"/></span></button>
  </section>
  <section className="campus-home-agenda"><header><h2><CampusIcon name="schedule"/>今日安排</h2><Button intent="text" onClick={()=>open('schedule')}>查看课程与日程</Button></header>
   {agenda.length?<ol>{agenda.slice(0,5).map(item=><li key={item.id}><time>{item.startTime||'待安排'}</time><div><b>{item.title}</b><p>{item.detail||`${item.type} · ${item.status}`}</p></div></li>)}</ol>:<p className="campus-home-quiet">今天暂无待处理的个人安排。可在课程日程中查看课表、安排备课和班级事务。</p>}
  </section>
  <section className="campus-home-duty"><header><h2><CampusIcon name="duty"/>值日岗位</h2><Button intent="text" onClick={()=>open('duty')}>查看轮换安排</Button></header><table><thead><tr><th>岗位</th><th>固定人员</th><th>区域</th></tr></thead><tbody>{duties.map(job=><tr key={job.id}><td>{job.name}</td><td>{job.studentIds?.map(id=>students.find(s=>s.id===id)?.name).filter(Boolean).join('、')||'按轮换安排'}</td><td>{job.area}</td></tr>)}</tbody></table></section>
  <section className="campus-home-attention"><header><h2><CampusIcon name="growth"/>学生近况</h2><Button intent="text" onClick={()=>open('students')}>{students.length} 名学生</Button></header>{attention.length?<ul>{attention.slice(0,5).map(student=><li key={student.id}><b>{student.name}</b><span>{[student.score<80?'关注学习情况':'',student.attendance!=='正常'?student.attendance:'',student.homework!=='已交'?student.homework:''].filter(Boolean).join(' · ')}</span><Button intent="text" onClick={()=>open('growth')}>查看档案</Button></li>)}</ul>:<p className="campus-home-quiet">当前没有需要优先查看的学生，后续记录变化会在这里出现。</p>}</section>
 </div>;
}
