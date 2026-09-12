import type { ClassroomData, DailyFocus, ScheduleConfig, ScheduleEvent, ScheduleWeek, TeacherAgendaItem, WorkLog } from '@/lib/classroom';

export type ScheduleWeekDraft = {
  month: string;
  weekOfMonth: number;
  config: ScheduleConfig;
  courses: string[][];
  events: ScheduleEvent[];
  focuses: DailyFocus[];
};

export type ScheduleResult =
  | { data: ClassroomData; week?: ScheduleWeek; error?: never }
  | { data?: never; week?: never; error: string };

export type AgendaResult<T extends TeacherAgendaItem | WorkLog> =
  | { data: ClassroomData; item: T; error?: never }
  | { data?: never; item?: never; error: string };

const eventTypes: ScheduleEvent['type'][] = ['班会', '活动', '考试', '放假', '家校', '其他'];
const focusStatuses: DailyFocus['status'][] = ['待处理', '进行中', '已完成'];
const agendaTypes: TeacherAgendaItem['type'][] = ['备课', '会议', '教研', '批改', '辅导', '班级事务', '其他'];
const agendaStatuses: TeacherAgendaItem['status'][] = ['待处理', '进行中', '已完成', '已取消'];

function hasClass(data: ClassroomData, classId: string): boolean {
  if (data.rosterClasses?.length) return data.rosterClasses.some(item => item.id === classId);
  return (data.activeClassId ?? classId) === classId;
}

function studentsForClass(data: ClassroomData, classId: string) {
  const roster = data.rosterClasses?.find(item => item.id === classId);
  if (roster) return roster.students;
  return (data.activeClassId ?? classId) === classId ? data.students : [];
}

function isLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function localScheduleDate(now = new Date()): string {
  return formatDate(now);
}

export function scheduleWeeksInMonth(month: string): number {
  if (!isMonth(month)) return 0;
  const [year, monthNumber] = month.split('-').map(Number);
  return Math.ceil(new Date(year, monthNumber, 0).getDate() / 7);
}

export function scheduleWeekRange(month: string, weekOfMonth: number) {
  const count = scheduleWeeksInMonth(month);
  if (!count || !Number.isInteger(weekOfMonth) || weekOfMonth < 1 || weekOfMonth > count) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(year, monthNumber - 1, 1 + (weekOfMonth - 1) * 7);
  const end = new Date(year, monthNumber - 1, Math.min(new Date(year, monthNumber, 0).getDate(), weekOfMonth * 7));
  return { startDate: formatDate(start), endDate: formatDate(end), label: `${year}年${monthNumber}月第${weekOfMonth}周` };
}

function normalizeConfig(config: ScheduleConfig): { config?: ScheduleConfig; error?: string } {
  const days = config.days.map(item => item.trim()).filter(Boolean);
  const periods = config.periods.map(item => ({ label: item.label.trim(), time: item.time?.trim() })).filter(item => item.label);
  if (!days.length || !periods.length) return { error: '至少保留一个上课日和一个节次。' };
  if (days.length > 7) return { error: '上课日最多设置 7 天。' };
  if (periods.length > 16) return { error: '每天最多设置 16 个节次。' };
  if (new Set(days).size !== days.length) return { error: '上课日名称不能重复。' };
  const start = config.termStartMonth?.trim() ?? '';
  const end = config.termEndMonth?.trim() ?? '';
  if ((start && !isMonth(start)) || (end && !isMonth(end)) || (start && end && start > end)) return { error: '学期月份范围无效，请检查起止月份。' };
  return { config: {
    ...config,
    schoolYear: config.schoolYear.trim() || '自定义学年/学段',
    term: config.term.trim() || '自定义学期',
    termStartMonth: start,
    termEndMonth: end,
    termNote: config.termNote?.trim() ?? '',
    days,
    periods,
  } };
}

function normalizeCourses(courses: readonly string[][], config: ScheduleConfig): string[][] {
  return config.days.map((_, dayIndex) => Array.from({ length: config.periods.length }, (__, periodIndex) => courses[dayIndex]?.[periodIndex]?.trim() ?? ''));
}

function normalizeEvents(events: readonly ScheduleEvent[], start: string, end: string): { events?: ScheduleEvent[]; error?: string } {
  const ids = new Set<string>();
  const normalized: ScheduleEvent[] = [];
  for (const event of events) {
    if (!event.id || ids.has(event.id)) return { error: '日程事件存在重复标识，请重新打开本周日程。' };
    if (!isLocalDate(event.date) || event.date < start || event.date > end) return { error: '日程事件日期必须位于当前周内。' };
    if (!event.title.trim()) return { error: '日程事件标题不能为空。' };
    if (!eventTypes.includes(event.type)) return { error: '日程事件类型无效。' };
    ids.add(event.id);
    normalized.push({ ...event, title: event.title.trim(), detail: event.detail.trim() });
  }
  return { events: normalized };
}

function normalizeFocuses(focuses: readonly DailyFocus[], start: string, end: string): { focuses?: DailyFocus[]; error?: string } {
  const ids = new Set<string>();
  const normalized: DailyFocus[] = [];
  for (const focus of focuses) {
    if (!focus.id || ids.has(focus.id)) return { error: '每日重点存在重复标识，请重新打开本周日程。' };
    if (!isLocalDate(focus.date) || focus.date < start || focus.date > end) return { error: '每日重点日期必须位于当前周内。' };
    if (!focus.focus.trim() && !focus.todo.trim()) return { error: '重点主题和具体事项不能同时为空。' };
    if (!focusStatuses.includes(focus.status)) return { error: '每日重点状态无效。' };
    ids.add(focus.id);
    normalized.push({ ...focus, focus: focus.focus.trim() || '本周重点', todo: focus.todo.trim() });
  }
  return { focuses: normalized };
}

function mergeDatedRows<T extends { id: string; date: string }>(legacy: readonly T[], start: string, end: string, rows: readonly T[]): T[] {
  const rowIds = new Set(rows.map(item => item.id));
  const outside = legacy.filter(item => !rowIds.has(item.id) && (item.date < start || item.date > end));
  return [...rows, ...outside];
}

export function saveClassScheduleWeek(data: ClassroomData, classId: string, draft: ScheduleWeekDraft): ScheduleResult {
  if (!hasClass(data, classId)) return { error: '当前班级已不存在，请刷新后重试。' };
  const range = scheduleWeekRange(draft.month, draft.weekOfMonth);
  if (!range) return { error: '月份或周次无效，请重新选择。' };
  const configResult = normalizeConfig(draft.config);
  if (configResult.error) return { error: configResult.error };
  const config = configResult.config!;
  const eventResult = normalizeEvents(draft.events, range.startDate, range.endDate);
  if (eventResult.error) return { error: eventResult.error };
  const focusResult = normalizeFocuses(draft.focuses, range.startDate, range.endDate);
  if (focusResult.error) return { error: focusResult.error };
  const weeks = data.scheduleWeeks ?? [];
  const target = weeks.find(item => item.month === draft.month && item.weekOfMonth === draft.weekOfMonth);
  const otherWeeks = weeks.filter(item => item !== target);
  const otherEventIds = new Set(otherWeeks.flatMap(item => item.events.map(event => event.id)));
  const otherFocusIds = new Set(otherWeeks.flatMap(item => item.focuses.map(focus => focus.id)));
  if (eventResult.events!.some(event => otherEventIds.has(event.id))) return { error: '这条日程事件已属于其他周，请重新打开后编辑。' };
  if (focusResult.focuses!.some(focus => otherFocusIds.has(focus.id))) return { error: '这条每日重点已属于其他周，请重新打开后编辑。' };
  const week: ScheduleWeek = {
    id: target?.id ?? `sw-${draft.month}-w${draft.weekOfMonth}`,
    month: draft.month,
    weekOfMonth: draft.weekOfMonth,
    ...range,
    config,
    courses: normalizeCourses(draft.courses, config),
    events: eventResult.events!,
    focuses: focusResult.focuses!,
  };
  const scheduleWeeks = [week, ...otherWeeks].sort((left, right) => left.startDate.localeCompare(right.startDate));
  const flattenedEvents = scheduleWeeks.flatMap(item => item.events);
  const flattenedFocuses = scheduleWeeks.flatMap(item => item.focuses);
  const termLabel = [config.schoolYear, config.term].filter(Boolean).join(' · ');
  return { data: {
    ...data,
    scheduleConfig: config,
    courses: week.courses,
    scheduleWeeks,
    scheduleEvents: mergeDatedRows(data.scheduleEvents ?? [], range.startDate, range.endDate, flattenedEvents),
    dailyFocus: mergeDatedRows(data.dailyFocus ?? [], range.startDate, range.endDate, flattenedFocuses),
    rosterClasses: data.rosterClasses?.map(item => item.id === classId ? { ...item, term: termLabel || item.term } : item),
  }, week };
}

export function saveScheduleTermConfig(data: ClassroomData, classId: string, input: ScheduleConfig): ScheduleResult {
  if (!hasClass(data, classId)) return { error: '当前班级已不存在，请刷新后重试。' };
  const result = normalizeConfig(input);
  if (result.error) return { error: result.error };
  const config = result.config!;
  const termLabel = [config.schoolYear, config.term].filter(Boolean).join(' · ');
  return { data: { ...data, scheduleConfig: config, rosterClasses: data.rosterClasses?.map(item => item.id === classId ? { ...item, term: termLabel || item.term } : item) } };
}

export function teacherAgendaForClass(data: ClassroomData, classId: string): TeacherAgendaItem[] {
  return (data.teacherAgenda ?? []).filter(item => item.classId === classId || (!item.classId && (data.activeClassId ?? classId) === classId));
}

export function workLogsForClass(data: ClassroomData, classId: string): WorkLog[] {
  return (data.workLogs ?? []).filter(item => item.classId === classId || (!item.classId && (data.activeClassId ?? classId) === classId));
}

function validRelatedStudents(data: ClassroomData, classId: string, ids: readonly string[]): boolean {
  const allowed = new Set(studentsForClass(data, classId).map(student => student.id));
  return ids.every(id => allowed.has(id));
}

export function saveTeacherAgenda(data: ClassroomData, classId: string, draft: TeacherAgendaItem, createId: () => string, nowIso: string): AgendaResult<TeacherAgendaItem> {
  if (!hasClass(data, classId)) return { error: '当前班级已不存在，请刷新后重试。' };
  if (!isLocalDate(draft.date)) return { error: '事项日期无效。' };
  if (!draft.title.trim()) return { error: '请填写事项标题。' };
  if (!agendaTypes.includes(draft.type) || !agendaStatuses.includes(draft.status)) return { error: '事项类型或状态无效。' };
  if (draft.startTime && !/^\d{2}:\d{2}$/.test(draft.startTime)) return { error: '开始时间无效。' };
  if (draft.endTime && !/^\d{2}:\d{2}$/.test(draft.endTime)) return { error: '结束时间无效。' };
  if (draft.startTime && draft.endTime && draft.endTime < draft.startTime) return { error: '结束时间不能早于开始时间。' };
  const relatedStudentIds = [...new Set(draft.relatedStudentIds ?? [])];
  if (!validRelatedStudents(data, classId, relatedStudentIds)) return { error: '关联学生必须属于当前班级。' };
  const items = data.teacherAgenda ?? [];
  const target = draft.id ? items.find(item => item.id === draft.id) : undefined;
  if (target && !teacherAgendaForClass(data, classId).some(item => item.id === target.id)) return { error: '这条事项已不属于当前班级，请重新打开。' };
  const item: TeacherAgendaItem = {
    ...draft,
    id: target?.id ?? (draft.id || createId()),
    classId,
    title: draft.title.trim(),
    detail: draft.detail?.trim() ?? '',
    location: draft.location?.trim() ?? '',
    relatedStudentIds,
    completedAt: draft.status === '已完成' ? target?.completedAt ?? draft.completedAt ?? nowIso : undefined,
    createdAt: target?.createdAt ?? draft.createdAt ?? Date.now(),
  };
  return { data: { ...data, teacherAgenda: target ? items.map(entry => entry.id === target.id ? item : entry) : [item, ...items] }, item };
}

export function saveWorkLog(data: ClassroomData, classId: string, draft: WorkLog, createId: () => string): AgendaResult<WorkLog> {
  if (!hasClass(data, classId)) return { error: '当前班级已不存在，请刷新后重试。' };
  if (!isLocalDate(draft.date)) return { error: '工作日期无效。' };
  if (!draft.title.trim()) return { error: '请填写工作标题。' };
  if (!agendaTypes.includes(draft.type)) return { error: '工作类型无效。' };
  const durationMinutes = Number(draft.durationMinutes ?? 0);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) return { error: '耗时不能小于 0。' };
  const relatedStudentIds = [...new Set(draft.relatedStudentIds ?? [])];
  if (!validRelatedStudents(data, classId, relatedStudentIds)) return { error: '关联学生必须属于当前班级。' };
  if (draft.agendaId && !teacherAgendaForClass(data, classId).some(item => item.id === draft.agendaId)) return { error: '关联日程已不属于当前班级。' };
  const items = data.workLogs ?? [];
  const target = draft.id ? items.find(item => item.id === draft.id) : undefined;
  if (target && !workLogsForClass(data, classId).some(item => item.id === target.id)) return { error: '这条工作留痕已不属于当前班级，请重新打开。' };
  const item: WorkLog = {
    ...draft,
    id: target?.id ?? (draft.id || createId()),
    classId,
    title: draft.title.trim(),
    detail: draft.detail?.trim() ?? '',
    durationMinutes,
    relatedStudentIds,
    createdAt: target?.createdAt ?? draft.createdAt ?? Date.now(),
  };
  return { data: { ...data, workLogs: target ? items.map(entry => entry.id === target.id ? item : entry) : [item, ...items] }, item };
}

export function completeAgendaWithLog(data: ClassroomData, classId: string, agendaId: string, createId: () => string, nowIso: string, createdAt: number): AgendaResult<WorkLog> {
  const agenda = teacherAgendaForClass(data, classId).find(item => item.id === agendaId);
  if (!agenda) return { error: '这条事项已不属于当前班级，请刷新后重试。' };
  if (agenda.status === '已取消') return { error: '已取消事项不能直接完成，请先重新编辑状态。' };
  const existing = workLogsForClass(data, classId).find(log => log.agendaId === agenda.id);
  const item: WorkLog = existing ?? {
    id: createId(), classId, agendaId: agenda.id, date: agenda.date, type: agenda.type, title: agenda.title,
    detail: agenda.detail?.trim() ?? '', relatedStudentIds: [...(agenda.relatedStudentIds ?? [])], createdAt,
  };
  return { data: {
    ...data,
    teacherAgenda: (data.teacherAgenda ?? []).map(entry => entry.id === agenda.id ? { ...entry, status: '已完成', completedAt: entry.completedAt ?? nowIso } : entry),
    workLogs: existing ? data.workLogs : [item, ...(data.workLogs ?? [])],
  }, item };
}

export function removeTeacherAgenda(data: ClassroomData, classId: string, id: string): ScheduleResult {
  const item = (data.teacherAgenda ?? []).find(entry => entry.id === id);
  if (!item || !teacherAgendaForClass(data, classId).some(entry => entry.id === id)) return { error: '这条事项已不属于当前班级，请重新打开。' };
  return { data: { ...data, teacherAgenda: (data.teacherAgenda ?? []).filter(entry => entry.id !== id) } };
}

export function removeWorkLog(data: ClassroomData, classId: string, id: string): ScheduleResult {
  const item = (data.workLogs ?? []).find(entry => entry.id === id);
  if (!item || !workLogsForClass(data, classId).some(entry => entry.id === id)) return { error: '这条工作留痕已不属于当前班级，请重新打开。' };
  return { data: { ...data, workLogs: (data.workLogs ?? []).filter(entry => entry.id !== id) } };
}
