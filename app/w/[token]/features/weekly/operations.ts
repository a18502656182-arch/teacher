import type { ClassroomData, CommunicationRecord, HomeworkTask, PointEvent, Student, WeeklyReport } from '@/lib/classroom';

export type WeeklyReportDraft = {
  id?: string;
  weekStart: string;
  weekEnd: string;
  edition: WeeklyReport['edition'];
  title: string;
  content: string;
  nextFocus: string;
};

export type WeeklyReportResult =
  | { data: ClassroomData; report: WeeklyReport; error?: never }
  | { data?: never; report?: never; error: string };

function hasClass(data: ClassroomData, classId: string): boolean {
  if (data.rosterClasses?.length) return data.rosterClasses.some(item => item.id === classId);
  return (data.activeClassId ?? classId) === classId;
}

function isLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function weeklyReportsForClass(data: ClassroomData, classId: string): WeeklyReport[] {
  return (data.weeklyReports ?? []).filter(report => report.classId === classId);
}

export function saveWeeklyReport(
  data: ClassroomData,
  classId: string,
  draft: WeeklyReportDraft,
  status: NonNullable<WeeklyReport['status']>,
  createId: () => string,
  nowIso = new Date().toISOString(),
): WeeklyReportResult {
  if (!hasClass(data, classId)) return { error: '当前班级已不存在，请刷新后重试。' };
  if (!isLocalDate(draft.weekStart) || !isLocalDate(draft.weekEnd) || draft.weekEnd < draft.weekStart) {
    return { error: '周报日期范围无效，请重新选择周次。' };
  }
  if (!draft.content.trim()) return { error: '周报正文不能为空。' };

  const reports = data.weeklyReports ?? [];
  const idTarget = draft.id ? reports.find(report => report.id === draft.id) : undefined;
  if (idTarget && idTarget.classId !== classId) return { error: '这份周报已不属于当前班级，请关闭后重新打开。' };
  const periodTarget = reports.find(report => report.classId === classId && report.weekStart === draft.weekStart && report.edition === draft.edition);
  if (idTarget && periodTarget && idTarget.id !== periodTarget.id) return { error: '当前周次和版本已有另一份周报，请先打开原周报。' };
  const existing = idTarget ?? periodTarget;
  const report: WeeklyReport = {
    id: existing?.id ?? draft.id ?? createId(),
    classId,
    weekStart: draft.weekStart,
    weekEnd: draft.weekEnd,
    edition: draft.edition,
    title: draft.title.trim() || '班级周报',
    status,
    content: draft.content.trim(),
    nextFocus: draft.nextFocus.trim(),
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    archivedAt: status === '已归档' ? nowIso : undefined,
  };
  const weeklyReports = existing
    ? reports.map(item => item.id === existing.id ? report : item)
    : [report, ...reports];
  return { data: { ...data, weeklyReports }, report };
}

export function isDatedWithin(date: string, start: string, end: string): boolean {
  return isLocalDate(date) && date >= start && date <= end;
}

export function weeklyPointEventsForClass(
  data: ClassroomData,
  classId: string,
  students: readonly Student[],
  weekStart: string,
  weekEnd: string,
): PointEvent[] {
  const studentIds = new Set(students.map(student => student.id));
  return (data.pointEvents ?? []).filter(event => (!event.classId || event.classId === classId) && studentIds.has(event.studentId) && isDatedWithin(event.date, weekStart, weekEnd));
}

export function weeklyActivityRows(
  data: ClassroomData,
  classId: string,
  students: readonly Student[],
  communicationRecords: readonly CommunicationRecord[],
  weekStart: string,
  weekEnd: string,
) {
  const studentsById = new Map(students.map(student => [student.id, student]));
  const growthRows = (data.growthEvidence ?? []).flatMap(item => {
    if ((item.classId && item.classId !== classId) || item.source === '家校沟通' || !isDatedWithin(item.date, weekStart, weekEnd)) return [];
    const student = studentsById.get(item.studentId);
    return student ? [{ id: `growth:${item.id}`, studentId: student.id, student: student.name, type: item.type, content: item.content || item.title, date: item.date, source: '成长档案' as const }] : [];
  });
  const communicationRows = communicationRecords.flatMap(item => {
    if (!isDatedWithin(item.date, weekStart, weekEnd)) return [];
    const student = item.studentId ? studentsById.get(item.studentId) : students.find(candidate => candidate.name === item.student);
    return student ? [{ id: `record:${item.id}`, studentId: student.id, student: student.name, type: item.type, content: item.content, date: item.date, source: '家校沟通' as const }] : [];
  });
  return [...growthRows, ...communicationRows].sort((left, right) => right.date.localeCompare(left.date) || left.student.localeCompare(right.student, 'zh-CN'));
}

export function weeklyPositiveRows(events: readonly PointEvent[], students: readonly Student[]) {
  const byStudent = new Map<string, { student: Student; delta: number; reason: string }>();
  for (const event of events) {
    if (event.delta <= 0) continue;
    const student = students.find(item => item.id === event.studentId);
    if (!student) continue;
    const current = byStudent.get(student.id);
    byStudent.set(student.id, { student, delta: (current?.delta ?? 0) + event.delta, reason: current?.reason || event.reason });
  }
  return [...byStudent.values()].sort((left, right) => right.delta - left.delta || left.student.name.localeCompare(right.student.name, 'zh-CN'));
}

export function weeklyHomeworkMetrics(tasks: readonly HomeworkTask[], students: readonly Student[]) {
  let recorded = 0;
  let submitted = 0;
  let missing = 0;
  let fixing = 0;
  for (const task of tasks) {
    for (const student of students) {
      const status = task.statuses[student.id];
      if (!status) continue;
      recorded += 1;
      if (status === '已交' || status === '已复查') submitted += 1;
      if (status === '未交') missing += 1;
      if (status === '待订正') fixing += 1;
    }
  }
  return {
    expected: tasks.length * students.length,
    recorded,
    submitted,
    missing,
    fixing,
    completionRate: recorded ? Math.round(submitted / recorded * 100) : 0,
  };
}

export function weeklyFollowRows(
  data: ClassroomData,
  classId: string,
  students: readonly Student[],
  tasks: readonly HomeworkTask[],
  weekStart: string,
  weekEnd: string,
) {
  const exams = (data.scoreExams ?? []).filter(exam => (!exam.classId || exam.classId === classId) && isDatedWithin(exam.date, weekStart, weekEnd));
  const attendance = (data.attendanceRecords ?? []).filter(record => (!record.classId || record.classId === classId) && isDatedWithin(record.date, weekStart, weekEnd) && record.status !== '正常');
  return students.map(student => {
    const unresolved = tasks.reduce((count, task) => count + (['未交', '待订正'].includes(task.statuses[student.id] ?? '') ? 1 : 0), 0);
    const scoreRates = exams.flatMap(exam => exam.subjects.flatMap(subject => {
      const value = exam.scores[student.id]?.[subject];
      const maximum = Math.max(1, Number(exam.subjectMaxScores?.[subject]) || 100);
      return typeof value === 'number' && Number.isFinite(value) ? [value / maximum * 100] : [];
    }));
    const scoreRate = scoreRates.length ? Math.round(scoreRates.reduce((sum, value) => sum + value, 0) / scoreRates.length) : null;
    const attendanceCounts = attendance.filter(record => record.studentId === student.id).reduce<Record<string, number>>((counts, record) => ({ ...counts, [record.status]: (counts[record.status] ?? 0) + 1 }), {});
    const attendanceText = Object.entries(attendanceCounts).map(([status, count]) => `${status}${count}次`).join('、');
    const reasons = [
      scoreRate != null && scoreRate < 80 ? { kind: '成绩', text: `本周考试已录得分率 ${scoreRate}%` } : null,
      unresolved ? { kind: '作业', text: `${unresolved} 项作业待处理` } : null,
      attendanceText ? { kind: '考勤', text: attendanceText } : null,
    ].filter((item): item is { kind: string; text: string } => Boolean(item));
    return { student, reasons };
  }).filter(item => item.reasons.length).sort((left, right) => right.reasons.length - left.reasons.length || left.student.name.localeCompare(right.student.name, 'zh-CN'));
}
