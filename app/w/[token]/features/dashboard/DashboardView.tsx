'use client';

import type { ClassroomData, DutyJob } from '@/lib/classroom';
import { taskState } from '@/lib/dictation';
import { Button, CampusIcon, ThemeArtwork } from '@/app/components/campus/primitives';
import { createDashboardReadModel } from './read-model';
import styles from './DashboardView.module.css';

type Destination = 'students' | 'homework' | 'dictation' | 'growth' | 'records' | 'schedule' | 'duty' | 'attendance';

type Props = {
  data: ClassroomData;
  defaultDutyJobs: DutyJob[];
  open: (id: Destination) => void;
  openFamily: () => void;
  openStudentGrowth: (studentId: string) => void;
};

export function DashboardView({ data, defaultDutyJobs, open, openFamily, openStudentGrowth }: Props) {
  const model = createDashboardReadModel(data, defaultDutyJobs);
  const now = new Date();
  const monthDay = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(now);
  const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(now);
  const displayDate = `${monthDay} ${weekday}`;
  const todaySummary = model.scheduleRows.length ? `${model.scheduleRows.length} 项今日安排` : model.hasConfiguredCourses ? '今天无课，课程表已保留' : '尚未设置班级课程';

  return <div className={styles.dashboard} aria-labelledby="dashboard-title">
    <header className={styles.heading}>
      <div><h1 id="dashboard-title">{displayDate}</h1><p>{model.activeClass?.name ?? '当前班级'} · 先核对今天真正需要处理的班务</p></div>
      <span>{model.students.length} 名学生</span>
    </header>

    <section className={styles.stage} aria-label="今日班务总览">
      <div className={styles.tasks}>
        <div className={styles.sectionTitle}><span><CampusIcon name="check"/></span><div><h2>今天先做这些</h2><p>数字只统计当前班级和当前名册</p></div></div>
        <button type="button" onClick={() => open('schedule')}><CampusIcon name="schedule"/><span><b>日程跟进</b><small>{model.overdueAgenda.length ? `${model.overdueAgenda.length} 项未完成事项已过日期` : todaySummary}</small></span><CampusIcon name="arrow"/></button>
        <button type="button" onClick={() => open('homework')}><CampusIcon name="homework"/><span><b>作业跟进</b><small>{model.outstandingHomework ? `${model.outstandingHomework} 人次待处理` : '当前名册没有未完成状态'}</small></span><CampusIcon name="arrow"/></button>
        <button type="button" onClick={() => open('records')}><CampusIcon name="records"/><span><b>家校跟进</b><small>{model.pendingCommunication.length ? `${model.pendingCommunication.length} 条约定待跟进` : '暂无待跟进沟通记录'}</small></span><CampusIcon name="arrow"/></button>
        <button type="button" onClick={() => open('dictation')}><CampusIcon name="dictation"/><span><b>听写批改</b><small>{model.currentDictation ? `${model.currentDictation.title} · ${taskState(model.currentDictation)}` : '还没有班级听写任务'}</small></span><CampusIcon name="arrow"/></button>
        <Button intent="primary" onClick={() => open(model.primary.id)}>{model.primary.label}<CampusIcon name="arrow"/></Button>
      </div>
      <div className={styles.scene}>
        <ThemeArtwork slot="dashboard"/>
        <div className={styles.mobileDate}><strong>今天</strong><div><span>{monthDay}</span><span>{weekday}</span></div></div>
        <div className={styles.sceneSummary}><span>班级教学</span><b>{todaySummary}</b><small>{model.pendingCommunication.length ? `${model.pendingCommunication.length} 条家校约定待跟进` : '家校沟通已无待办'}</small></div>
      </div>
    </section>

    <section className={styles.middle}>
      <article className={styles.agenda}>
        <header><div><span><CampusIcon name="schedule"/></span><div><h2>今日课程与班务</h2><p>课程、活动和个人事项按时间合并</p></div></div><Button intent="text" onClick={() => open('schedule')}>完整日程</Button></header>
        {model.scheduleRows.length ? <ol>{model.scheduleRows.map(item => <li key={item.id}><time>{item.time}</time><span><b>{item.title}</b><small>{item.kind} · {item.detail}</small></span></li>)}</ol> : <div className={styles.empty}><CampusIcon name="schedule"/><div><b>{model.hasConfiguredCourses ? '今天没有排课或待办' : '还没有课程安排'}</b><p>{model.hasConfiguredCourses ? '课程表仍保留在“课程日程”，这里只显示当天内容。' : '进入课程日程设置教学日和节次。'}</p></div></div>}
      </article>

      <article className={styles.dictation}>
        <header><div><span><CampusIcon name="dictation"/></span><div><h2>听写与复习</h2><p>未确认的批改不会计入结果</p></div></div><Button intent="text" onClick={() => open('dictation')}>进入听写</Button></header>
        {model.currentDictation ? <div className={styles.dictationBody}><ThemeArtwork slot="dictation"/><div><h3>{model.currentDictation.title}</h3><p>{model.currentDictation.date} · {model.currentDictation.words.length} 个词</p><dl><div><dt>已批改</dt><dd>{model.dictationStats?.graded ?? 0}</dd></div><div><dt>待批改</dt><dd>{model.dictationStats?.pending ?? 0}</dd></div><div><dt>错词次</dt><dd>{model.dictationStats?.wrong ?? 0}</dd></div></dl></div></div> : <div className={styles.empty}><ThemeArtwork slot="dictation"/><div><b>还没有班级听写任务</b><p>可从词库或自定义内容开始。</p></div></div>}
      </article>
    </section>

    <section className={styles.quick} aria-labelledby="dashboard-quick-title">
      <header><span><CampusIcon name="tools"/></span><h2 id="dashboard-quick-title">常用操作</h2></header>
      <div>
        <button type="button" onClick={() => open('students')}><CampusIcon name="students"/><b>学生名单</b><CampusIcon name="arrow"/></button>
        <button type="button" onClick={() => open('dictation')}><CampusIcon name="dictation"/><b>听写与复习</b><CampusIcon name="arrow"/></button>
        <button type="button" onClick={() => open('homework')}><CampusIcon name="homework"/><b>作业追踪</b><CampusIcon name="arrow"/></button>
        <button type="button" onClick={() => open('duty')}><CampusIcon name="duty"/><b>值日安排</b><CampusIcon name="arrow"/></button>
      </div>
    </section>

    <section className={styles.lower}>
      <article className={styles.duty}>
        <header><div><span><CampusIcon name="duty"/></span><div><h2>值日岗位</h2><p>按当前班级岗位查看责任区</p></div></div><Button intent="text" onClick={() => open('duty')}>轮换安排</Button></header>
        {model.duties.length ? <div className={styles.dutyList}>{model.duties.map(job => <button type="button" key={job.id} onClick={() => open('duty')}><b>{job.name}</b><span>{job.studentIds?.map(id => model.students.find(student => student.id === id)?.name).filter(Boolean).join('、') || '按轮换安排'}</span><small>{job.area}</small></button>)}</div> : <div className={styles.empty}><CampusIcon name="duty"/><div><b>尚未设置启用岗位</b><p>进入值日岗位建立分工。</p></div></div>}
      </article>

      <article className={styles.attention}>
        <header><div><span><CampusIcon name="growth"/></span><div><h2>学生事实提醒</h2><p>只显示有日期和来源的待跟进记录</p></div></div><Button intent="text" onClick={() => open('students')}>全部学生</Button></header>
        {model.attentionRows.length ? <ul>{model.attentionRows.slice(0, 4).map(item => <li key={item.studentId}><button type="button" aria-label={`${item.name}，${item.date}，${item.source}，${item.summary}`} onClick={() => openStudentGrowth(item.studentId)}><span>{item.name.slice(-2)}</span><b>{item.name}</b><small><em>{item.date}</em>{item.source} · {item.summary}</small><CampusIcon name="arrow"/></button></li>)}</ul> : <div className={styles.empty}><CampusIcon name="growth"/><div><b>没有带日期的待跟进记录</b><p>学生汇总字段不会在这里被包装成最新事实。</p></div></div>}
      </article>
    </section>

    <aside className={styles.family} aria-label="家庭学习入口"><div><b>家庭学习工具</b><span>{model.familyChildren.length ? `${model.familyChildren.length} 个孩子档案，与班级名册隔离` : '与班级教学数据隔离，可稍后设置'}</span></div><Button intent="text" onClick={openFamily}>进入家庭学习<CampusIcon name="arrow"/></Button></aside>
  </div>;
}
