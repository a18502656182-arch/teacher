'use client';

import type { ClassroomData, DutyJob } from '@/lib/classroom';
import { statistics, taskState, today as dictationToday } from '@/lib/dictation';
import { Button, CampusIcon, ThemeArtwork } from './primitives';

type Destination = 'students' | 'homework' | 'dictation' | 'growth' | 'records' | 'schedule' | 'duty' | 'attendance';

export function Dashboard({ data, open, openFamily, defaultDutyJobs }: { data: ClassroomData; open: (id: Destination) => void; openFamily: () => void; defaultDutyJobs: DutyJob[] }) {
  const activeClass = data.rosterClasses?.find(classroom => classroom.id === data.activeClassId) ?? data.rosterClasses?.[0];
  const students = activeClass?.students ?? data.students;
  const date = dictationToday();
  const displayDate = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
  const tasks = (data.homeworkTasks ?? []).filter(task => !task.classId || task.classId === activeClass?.id);
  const outstanding = tasks.reduce((count, task) => count + Object.values(task.statuses).filter(status => status !== '已交' && status !== '已复查').length, 0);
  const records = data.records.filter(record => record.status === '待跟进').length;
  const agenda = (data.teacherAgenda ?? []).filter(item => (!item.classId || item.classId === activeClass?.id) && item.date === date && item.status !== '已完成' && item.status !== '已取消').toSorted((a, b) => (a.startTime ?? '99').localeCompare(b.startTime ?? '99'));
  const duties = (data.dutyJobs?.length ? data.dutyJobs : defaultDutyJobs).filter(job => job.enabled).slice(0, 4);
  const dictations = (data.dictation?.tasks ?? []).filter(task => !task.archived && task.context.kind === 'class' && task.context.classId === activeClass?.id && task.date <= date).toSorted((a, b) => b.date.localeCompare(a.date));
  const currentDictation = dictations.find(task => statistics([task]).pending > 0) ?? dictations[0];
  const dictationStats = currentDictation ? statistics([currentDictation]) : null;
  const attention = students.filter(student => student.score < 80 || student.attendance !== '正常' || student.homework !== '已交');
  const familyChildren = data.dictation?.children.filter(child => !child.archived) ?? [];
  const primary = outstanding > 0 ? { id: 'homework' as const, label: `处理 ${outstanding} 人次作业状态` } : currentDictation && dictationStats?.pending ? { id: 'dictation' as const, label: `继续批改 ${dictationStats.pending} 人` } : { id: 'attendance' as const, label: '登记今日考勤' };

  return <div className="campus-dashboard">
    <header className="campus-dashboard-heading"><div><h1>{displayDate}</h1><p>{activeClass?.name ?? '当前班级'} · 今天先处理最需要确认的班务</p></div><span>{students.length} 名学生</span></header>
    <section className="campus-dashboard-stage" aria-label="今日班务总览">
      <div className="campus-dashboard-tasks"><div className="campus-dashboard-task-title"><span><CampusIcon name="check"/></span><div><h2>今天先做这些</h2><p>完成一项，再进入下一项</p></div></div>
        <button type="button" onClick={() => open('homework')}><CampusIcon name="homework"/><span><b>作业跟进</b><small>{outstanding ? `${outstanding} 人次待处理` : '当前没有未完成状态'}</small></span><CampusIcon name="arrow"/></button>
        <button type="button" onClick={() => open('attendance')}><CampusIcon name="attendance"/><span><b>今日考勤</b><small>登记到校、请假与备注</small></span><CampusIcon name="arrow"/></button>
        <button type="button" onClick={() => open('dictation')}><CampusIcon name="dictation"/><span><b>听写批改</b><small>{currentDictation ? `${currentDictation.title} · ${taskState(currentDictation)}` : '建立今天的听写任务'}</small></span><CampusIcon name="arrow"/></button>
        <Button intent="primary" onClick={() => open(primary.id)}>{primary.label}<CampusIcon name="arrow"/></Button>
      </div>
      <div className="campus-dashboard-scene"><ThemeArtwork slot="dashboard"/><div><span>班级教学</span><b>{agenda.length ? `${agenda.length} 项日程待处理` : '今天暂无个人安排'}</b><small>{records ? `${records} 条沟通约定需要跟进` : '暂无待跟进沟通记录'}</small></div></div>
    </section>
    <section className="campus-dashboard-middle">
      <article className="campus-dashboard-agenda"><header><div><span><CampusIcon name="schedule"/></span><div><h2>今日安排</h2><p>课程与班务按时间推进</p></div></div><Button intent="text" onClick={() => open('schedule')}>完整日程</Button></header>{agenda.length ? <ol>{agenda.slice(0, 5).map(item => <li key={item.id}><time>{item.startTime || '待安排'}</time><span><b>{item.title}</b><small>{item.detail || `${item.type} · ${item.status}`}</small></span></li>)}</ol> : <div className="campus-dashboard-empty"><CampusIcon name="schedule"/><p>今天暂无待处理的个人安排。</p></div>}</article>
      <article className="campus-dashboard-dictation"><header><div><span><CampusIcon name="dictation"/></span><div><h2>听写与复习</h2><p>未确认的批改不会计入成绩</p></div></div><Button intent="text" onClick={() => open('dictation')}>进入听写</Button></header>{currentDictation ? <div className="campus-dashboard-dictation-body"><ThemeArtwork slot="dictation"/><div><h3>{currentDictation.title}</h3><p>{currentDictation.date} · {currentDictation.words.length} 个词</p><dl><div><dt>已批改</dt><dd>{dictationStats?.graded ?? 0}</dd></div><div><dt>待批改</dt><dd>{dictationStats?.pending ?? 0}</dd></div><div><dt>错词次</dt><dd>{dictationStats?.wrong ?? 0}</dd></div></dl></div></div> : <div className="campus-dashboard-empty"><ThemeArtwork slot="dictation"/><p>还没有听写任务，可从词库或自定义内容开始。</p></div>}</article>
    </section>
    <section className="campus-dashboard-lower">
      <article className="campus-dashboard-duty"><header><div><span><CampusIcon name="duty"/></span><div><h2>值日岗位</h2><p>按岗位查看今天的责任区</p></div></div><Button intent="text" onClick={() => open('duty')}>轮换安排</Button></header><div>{duties.map(job => <button type="button" key={job.id} onClick={() => open('duty')}><b>{job.name}</b><span>{job.studentIds?.map(id => students.find(student => student.id === id)?.name).filter(Boolean).join('、') || '按轮换安排'}</span><small>{job.area}</small></button>)}</div></article>
      <article className="campus-dashboard-attention"><header><div><span><CampusIcon name="growth"/></span><div><h2>学生近况</h2><p>仅显示需要优先查看的变化</p></div></div><Button intent="text" onClick={() => open('students')}>全部学生</Button></header>{attention.length ? <ul>{attention.slice(0, 4).map(student => <li key={student.id}><button type="button" onClick={() => open('growth')}><span>{student.name.slice(-2)}</span><b>{student.name}</b><small>{[student.score < 80 ? '学习情况' : '', student.attendance !== '正常' ? student.attendance : '', student.homework !== '已交' ? student.homework : ''].filter(Boolean).join(' · ')}</small><CampusIcon name="arrow"/></button></li>)}</ul> : <div className="campus-dashboard-empty"><CampusIcon name="growth"/><p>当前没有需要优先查看的学生。</p></div>}</article>
    </section>
    <section className="campus-dashboard-family"><ThemeArtwork slot="dictation"/><div><span>家庭学习</span><h2>{familyChildren.length ? `${familyChildren.length} 个孩子档案` : '建立家庭孩子档案'}</h2><p>每日听写、自定义内容和个人错词复习与班级名册隔离。</p></div><Button onClick={openFamily}>进入家庭学习<CampusIcon name="arrow"/></Button></section>
  </div>;
}
