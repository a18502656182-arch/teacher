import type { ClassroomData, DutyJob, Student } from '@/lib/classroom';
import { statistics } from '@/lib/dictation';
import { communicationRecordsForClass } from '../records/operations';
import { teacherAgendaForClass } from '../schedule/operations';

const COMPLETE_HOMEWORK = new Set(['已交', '已复查']);
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export type DashboardScheduleRow = {
  id: string;
  time: string;
  title: string;
  detail: string;
  kind: '课程' | '事项' | '活动' | '重点';
  sortKey: string;
};

export type DashboardAttentionRow = {
  studentId: string;
  name: string;
  date: string;
  source: '考勤' | '家校' | '作业';
  summary: string;
  priority: number;
};

function localDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function activeRoster(data: ClassroomData) {
  return data.rosterClasses?.find(item => item.id === data.activeClassId) ?? data.rosterClasses?.[0];
}

function dayIndexFor(days: readonly string[] | undefined, now: Date, courseColumns: number): number {
  const weekday = WEEKDAYS[now.getDay()];
  const normalized = days?.map(day => day.trim().replace(/^星期/, '周')) ?? [];
  const configured = normalized.indexOf(weekday);
  if (configured >= 0) return configured;
  if (!days?.length && courseColumns === 5 && now.getDay() >= 1 && now.getDay() <= 5) return now.getDay() - 1;
  return -1;
}

function timestamp(value: string): number {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return 0;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
}

function studentForRecord(record: ClassroomData['records'][number], students: readonly Student[]): Student | undefined {
  return record.studentId ? students.find(student => student.id === record.studentId) : students.find(student => student.name === record.student);
}

export function createDashboardReadModel(data: ClassroomData, defaultDutyJobs: readonly DutyJob[], now = new Date()) {
  const activeClass = activeRoster(data);
  const classId = activeClass?.id ?? data.activeClassId ?? '';
  const students = activeClass?.students ?? data.students;
  const studentIds = new Set(students.map(student => student.id));
  const date = localDate(now);
  const tasks = (data.homeworkTasks ?? []).filter(task => !task.classId || task.classId === classId);
  const homeworkRows = tasks.map(task => {
    const pendingStudentIds = Object.entries(task.statuses)
      .filter(([studentId, status]) => studentIds.has(studentId) && !COMPLETE_HOMEWORK.has(status))
      .map(([studentId]) => studentId);
    return { task, pendingStudentIds };
  });
  const outstandingHomework = homeworkRows.reduce((sum, row) => sum + row.pendingStudentIds.length, 0);

  const allAgenda = classId ? teacherAgendaForClass(data, classId) : [];
  const openAgenda = allAgenda.filter(item => item.status !== '已完成' && item.status !== '已取消');
  const overdueAgenda = openAgenda.filter(item => item.date < date);
  const todayAgenda = openAgenda.filter(item => item.date === date);
  const communication = classId ? communicationRecordsForClass(data, classId) : [];
  const pendingCommunication = communication.filter(record => (record.status ?? '待跟进') === '待跟进');

  const scopedSchedule = data.classSchedules?.[classId];
  const scheduleWeeks = scopedSchedule?.weeks?.length ? scopedSchedule.weeks : data.scheduleWeeks ?? [];
  const currentWeek = scheduleWeeks.find(week => week.startDate <= date && week.endDate >= date);
  const config = currentWeek?.config ?? scopedSchedule?.config ?? data.scheduleConfig;
  const courses = currentWeek?.courses ?? scopedSchedule?.courses ?? data.courses ?? [];
  const dayIndex = dayIndexFor(config?.days, now, courses.length);
  const periods = config?.periods ?? [];
  const courseRows: DashboardScheduleRow[] = dayIndex < 0 ? [] : (courses[dayIndex] ?? []).flatMap((course, periodIndex) => {
    const title = course.trim();
    if (!title) return [];
    const period = periods[periodIndex];
    const time = period?.time?.split('-')[0] || period?.label || `第${periodIndex + 1}节`;
    return [{ id: `course-${dayIndex}-${periodIndex}`, time, title, detail: period?.label || `第${periodIndex + 1}节`, kind: '课程' as const, sortKey: period?.time?.split('-')[0] || `${String(periodIndex + 1).padStart(2, '0')}:00` }];
  });
  const events = (currentWeek?.events ?? scopedSchedule?.events ?? data.scheduleEvents ?? []).filter(item => item.date === date);
  const focuses = (currentWeek?.focuses ?? scopedSchedule?.focuses ?? data.dailyFocus ?? []).filter(item => item.date === date && item.status !== '已完成');
  const scheduleRows: DashboardScheduleRow[] = [
    ...courseRows,
    ...todayAgenda.map(item => ({ id: `agenda-${item.id}`, time: item.startTime || '待安排', title: item.title, detail: item.detail || `${item.type} · ${item.status}`, kind: '事项' as const, sortKey: item.startTime || '98:00' })),
    ...events.map(item => ({ id: `event-${item.id}`, time: '全天', title: item.title, detail: item.detail || item.type, kind: '活动' as const, sortKey: '00:00' })),
    ...focuses.map(item => ({ id: `focus-${item.id}`, time: '今日', title: item.focus, detail: item.todo || item.status, kind: '重点' as const, sortKey: '97:00' })),
  ].toSorted((left, right) => left.sortKey.localeCompare(right.sortKey));

  const dictations = (data.dictation?.tasks ?? [])
    .filter(task => !task.archived && task.context.kind === 'class' && task.context.classId === classId && task.date <= date)
    .toSorted((left, right) => right.date.localeCompare(left.date));
  const currentDictation = dictations.find(task => statistics([task]).pending > 0) ?? dictations[0];
  const dictationStats = currentDictation ? statistics([currentDictation]) : null;

  const attention = new Map<string, DashboardAttentionRow>();
  const setAttention = (row: DashboardAttentionRow) => {
    const current = attention.get(row.studentId);
    if (!current || row.priority > current.priority || (row.priority === current.priority && timestamp(row.date) > timestamp(current.date))) attention.set(row.studentId, row);
  };
  const attendanceNeedsFollowUp = (record: NonNullable<ClassroomData['attendanceRecords']>[number]) => record.status !== '正常'
    && record.approval !== '已销假'
    && (record.date === date || (record.date < date && record.approval === '待确认'));
  for (const record of (data.attendanceRecords ?? []).filter(item => (!item.classId || item.classId === classId) && attendanceNeedsFollowUp(item))) {
    const student = students.find(item => item.id === record.studentId);
    if (student) setAttention({ studentId: student.id, name: student.name, date: record.date, source: '考勤', summary: `${record.period} · ${record.status}${record.reason ? ` · ${record.reason}` : ''}`, priority: record.status === '缺勤' ? 4 : 3 });
  }
  for (const record of pendingCommunication) {
    const student = studentForRecord(record, students);
    if (student) setAttention({ studentId: student.id, name: student.name, date: record.date, source: '家校', summary: record.followUp?.trim() || `${record.type}待跟进`, priority: 2 });
  }
  for (const { task, pendingStudentIds } of homeworkRows) {
    for (const studentId of pendingStudentIds) {
      const student = students.find(item => item.id === studentId);
      const status = task.statuses[studentId];
      if (student) setAttention({ studentId, name: student.name, date: task.date, source: '作业', summary: `${task.subject}《${task.title}》· ${status}`, priority: status === '未交' ? 2 : 1 });
    }
  }

  const dutySource = data.classDutySettings?.[classId]?.jobs ?? data.dutyJobs ?? defaultDutyJobs;
  const duties = dutySource.filter(job => job.enabled).slice(0, 4);
  const attentionRows = [...attention.values()].toSorted((left, right) => right.priority - left.priority || timestamp(right.date) - timestamp(left.date) || left.name.localeCompare(right.name, 'zh-CN'));
  const primary = overdueAgenda.length
    ? { id: 'schedule' as const, label: `处理 ${overdueAgenda.length} 项过期事项` }
    : outstandingHomework
      ? { id: 'homework' as const, label: `处理 ${outstandingHomework} 人次作业状态` }
      : currentDictation && dictationStats?.pending
        ? { id: 'dictation' as const, label: `继续批改 ${dictationStats.pending} 人` }
        : { id: 'attendance' as const, label: '登记今日考勤' };

  return {
    activeClass,
    students,
    date,
    outstandingHomework,
    overdueAgenda,
    pendingCommunication,
    scheduleRows,
    hasConfiguredCourses: courses.some(day => day.some(course => course.trim())),
    currentDictation,
    dictationStats,
    duties,
    attentionRows,
    familyChildren: data.dictation?.children.filter(child => !child.archived) ?? [],
    primary,
  };
}
