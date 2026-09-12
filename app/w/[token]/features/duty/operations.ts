import type { ClassDutyData, ClassroomData, DutyJob, DutyRecord, Student } from '@/lib/classroom';

export const defaultDutyJobs: DutyJob[] = [
  { id: 'dj-floor', name: '地面保洁', area: '教室地面、桌椅间', standard: '无明显纸屑，桌椅摆正，放学前复查一次。', enabled: true },
  { id: 'dj-board', name: '黑板讲台', area: '黑板、粉笔槽、讲台', standard: '课间擦净黑板，粉笔和教具归位。', enabled: true },
  { id: 'dj-corridor', name: '走廊门窗', area: '走廊、门窗、窗台', standard: '走廊无杂物，窗台不堆放个人物品。', enabled: true },
  { id: 'dj-corner', name: '卫生角', area: '扫把、拖把、垃圾桶', standard: '工具摆放整齐，垃圾桶及时清理。', enabled: true },
  { id: 'dj-books', name: '图书角', area: '图书角、阅读柜', standard: '图书按类归位，破损图书单独放置。', enabled: true },
];

const weekdayAliases: Record<string, number> = {
  周日: 0, 星期日: 0, 星期天: 0,
  周一: 1, 星期一: 1,
  周二: 2, 星期二: 2,
  周三: 3, 星期三: 3,
  周四: 4, 星期四: 4,
  周五: 5, 星期五: 5,
  周六: 6, 星期六: 6,
};

export type DutyAssignment = {
  students: Student[];
  source: 'auto' | 'fixed' | 'manual';
  groupNumber?: number;
  date: string;
  record?: DutyRecord;
};

export type DutyMutationResult = { data?: ClassroomData; error?: string };

export function cloneDutyJobs(jobs: readonly DutyJob[] = defaultDutyJobs): DutyJob[] {
  return jobs.map(job => ({ ...job, studentIds: [...(job.studentIds ?? [])], enabled: job.enabled !== false }));
}

export function dutyDayKey(day: string): string {
  const weekday = weekdayAliases[day.trim()];
  return weekday === undefined ? day.trim() : `weekday-${weekday}`;
}

export function sameDutyDay(left: string, right: string): boolean {
  return dutyDayKey(left) === dutyDayKey(right);
}

export function localDutyDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dutyDateForDay(day: string, reference = new Date()): string {
  const target = weekdayAliases[day.trim()];
  if (target === undefined) return localDutyDate(reference);
  const current = reference.getDay();
  const mondayDistance = current === 0 ? -6 : 1 - current;
  const targetDistance = target === 0 ? 6 : target - 1;
  const date = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() + mondayDistance + targetDistance);
  return localDutyDate(date);
}

function firstClassId(data: ClassroomData): string {
  return data.rosterClasses?.[0]?.id ?? data.activeClassId ?? 'class-1';
}

function classExists(data: ClassroomData, classId: string): boolean {
  return data.rosterClasses?.length ? data.rosterClasses.some(item => item.id === classId) : classId === firstClassId(data);
}

export function dutyStudentsForClass(data: ClassroomData, classId: string): Student[] {
  return data.rosterClasses?.find(item => item.id === classId)?.students ?? (classId === firstClassId(data) ? data.students : []);
}

export function normalizeDutyOffset(offset: number | undefined, groupCount: number): number {
  if (!groupCount) return 0;
  const value = Number.isFinite(Number(offset)) ? Math.trunc(Number(offset)) : 0;
  return ((value % groupCount) + groupCount) % groupCount;
}

export function dutyGroupsForClass(data: ClassroomData, classId: string) {
  const students = dutyStudentsForClass(data, classId);
  const numbers = [...new Set(students.map(student => student.group).filter(group => Number.isInteger(group) && group > 0))].sort((left, right) => left - right);
  return {
    groups: numbers.map(number => ({ number, students: students.filter(student => student.group === number) })),
    ungrouped: students.filter(student => !Number.isInteger(student.group) || student.group < 1),
  };
}

export function dutySettingsForClass(data: ClassroomData, classId: string): ClassDutyData {
  const mapped = data.classDutySettings?.[classId];
  const legacyAllowed = !data.classDutySettings || Object.keys(data.classDutySettings).length === 0 || classId === (data.activeClassId ?? firstClassId(data));
  const jobs = mapped?.jobs?.length ? mapped.jobs : legacyAllowed && data.dutyJobs?.length ? data.dutyJobs : defaultDutyJobs;
  const groupCount = dutyGroupsForClass(data, classId).groups.length;
  return { offset: normalizeDutyOffset(mapped?.offset ?? (legacyAllowed ? data.dutyOffset : 0), groupCount), jobs: cloneDutyJobs(jobs) };
}

export function normalizeClassDutySettings(data: ClassroomData, classId: string): ClassDutyData {
  const students = dutyStudentsForClass(data, classId);
  const studentIds = new Set(students.map(student => student.id));
  const settings = dutySettingsForClass(data, classId);
  return {
    offset: normalizeDutyOffset(settings.offset, dutyGroupsForClass(data, classId).groups.length),
    jobs: settings.jobs.map(job => ({
      ...job,
      name: String(job.name ?? '').trim() || '未命名岗位',
      area: String(job.area ?? '').trim(),
      standard: String(job.standard ?? '').trim(),
      studentIds: (job.studentIds ?? []).filter((id, index, values) => studentIds.has(id) && values.indexOf(id) === index),
      enabled: job.enabled !== false,
    })),
  };
}

function syncSettings(data: ClassroomData, classId: string, settings: ClassDutyData): ClassroomData {
  const activeClassId = data.activeClassId ?? firstClassId(data);
  return {
    ...data,
    dutyOffset: activeClassId === classId ? settings.offset : data.dutyOffset,
    dutyJobs: activeClassId === classId ? cloneDutyJobs(settings.jobs) : data.dutyJobs,
    classDutySettings: { ...(data.classDutySettings ?? {}), [classId]: { offset: settings.offset, jobs: cloneDutyJobs(settings.jobs) } },
  };
}

function belongsToClass(data: ClassroomData, record: DutyRecord, classId: string): boolean {
  return (record.classId ?? firstClassId(data)) === classId;
}

export function dutyRecordsForClass(data: ClassroomData, classId: string): DutyRecord[] {
  return (data.dutyRecords ?? []).filter(record => belongsToClass(data, record, classId)).toSorted((left, right) => right.date.localeCompare(left.date) || right.createdAt - left.createdAt);
}

export function dutyRecordFor(data: ClassroomData, classId: string, day: string, jobId: string, reference = new Date()): DutyRecord | undefined {
  const date = dutyDateForDay(day, reference);
  return dutyRecordsForClass(data, classId).find(record => record.date === date && sameDutyDay(record.day, day) && record.jobId === jobId);
}

function activeGroups(data: ClassroomData, classId: string) {
  return dutyGroupsForClass(data, classId).groups.filter(group => group.students.length);
}

export function dutyAssignmentFor(data: ClassroomData, classId: string, day: string, jobId: string, reference = new Date()): DutyAssignment {
  const settings = dutySettingsForClass(data, classId);
  const jobs = settings.jobs.filter(job => job.enabled !== false);
  const job = settings.jobs.find(item => item.id === jobId);
  const students = dutyStudentsForClass(data, classId);
  const studentById = new Map(students.map(student => [student.id, student]));
  const record = dutyRecordFor(data, classId, day, jobId, reference);
  const recorded = (record?.studentIds ?? []).map(id => studentById.get(id)).filter((student): student is Student => Boolean(student));
  if (recorded.length) return { students: recorded, source: record?.assignmentSource ?? 'manual', date: dutyDateForDay(day, reference), record };
  const fixed = (job?.studentIds ?? []).map(id => studentById.get(id)).filter((student): student is Student => Boolean(student));
  if (fixed.length) return { students: fixed, source: 'fixed', date: dutyDateForDay(day, reference), record };
  const groups = activeGroups(data, classId);
  if (!groups.length || !job) return { students: [], source: 'auto', date: dutyDateForDay(day, reference), record };
  const configuredDays = data.scheduleConfig?.days?.map(item => item.trim()).filter(Boolean) ?? ['周一', '周二', '周三', '周四', '周五'];
  const dayIndex = Math.max(0, configuredDays.findIndex(item => sameDutyDay(item, day)));
  const group = groups[(dayIndex + normalizeDutyOffset(settings.offset, groups.length)) % groups.length];
  const jobIndex = Math.max(0, jobs.findIndex(item => item.id === jobId));
  return { students: group.students.length ? [group.students[jobIndex % group.students.length]] : [], source: 'auto', groupNumber: group.number, date: dutyDateForDay(day, reference), record };
}

export function saveDutyJob(data: ClassroomData, classId: string, input: DutyJob, makeId: () => string): DutyMutationResult {
  if (!classExists(data, classId)) return { error: '当前班级已不存在，请刷新后重试。' };
  const name = input.name.trim();
  const area = input.area.trim();
  const standard = input.standard.trim();
  if (!name || !area || !standard) return { error: '请填写岗位名称、负责区域和检查标准。' };
  const studentIds = new Set(dutyStudentsForClass(data, classId).map(student => student.id));
  if ((input.studentIds ?? []).some(id => !studentIds.has(id))) return { error: '固定学生必须来自当前班级。' };
  const settings = dutySettingsForClass(data, classId);
  const id = input.id || makeId();
  const next: DutyJob = { ...input, id, name, area, standard, enabled: input.enabled !== false, studentIds: [...new Set(input.studentIds ?? [])] };
  const jobs = settings.jobs.some(job => job.id === id) ? settings.jobs.map(job => job.id === id ? next : job) : [next, ...settings.jobs];
  return { data: syncSettings(data, classId, { ...settings, jobs }) };
}

export function patchDutyJob(data: ClassroomData, classId: string, jobId: string, patch: Partial<DutyJob>): DutyMutationResult {
  const settings = dutySettingsForClass(data, classId);
  const job = settings.jobs.find(item => item.id === jobId);
  if (!job) return { error: '这个值日岗位已不存在，请刷新后重试。' };
  return saveDutyJob(data, classId, { ...job, ...patch, id: job.id }, () => job.id);
}

export function rotateDutyWeek(data: ClassroomData, classId: string): DutyMutationResult {
  if (!classExists(data, classId)) return { error: '当前班级已不存在，请刷新后重试。' };
  const groups = activeGroups(data, classId);
  if (groups.length < 2) return { error: '至少需要两个有学生的小组才能轮换。' };
  const settings = dutySettingsForClass(data, classId);
  return { data: syncSettings(data, classId, { ...settings, offset: (settings.offset + 1) % groups.length }) };
}

function replaceRecord(data: ClassroomData, classId: string, next: DutyRecord): ClassroomData {
  const records = data.dutyRecords ?? [];
  return { ...data, dutyRecords: [next, ...records.filter(record => record.id !== next.id)] };
}

export function assignDutyStudent(data: ClassroomData, classId: string, day: string, jobId: string, studentId: string | undefined, makeId: () => string, now = new Date()): DutyMutationResult {
  if (!classExists(data, classId)) return { error: '当前班级已不存在，请刷新后重试。' };
  const job = dutySettingsForClass(data, classId).jobs.find(item => item.id === jobId && item.enabled !== false);
  if (!job) return { error: '这个值日岗位已停用或不存在。' };
  const students = dutyStudentsForClass(data, classId);
  if (studentId && !students.some(student => student.id === studentId)) return { error: '只能指定当前班级的学生。' };
  const existing = dutyRecordFor(data, classId, day, jobId, now);
  let assignedIds: string[];
  let source: DutyRecord['assignmentSource'];
  if (studentId) {
    assignedIds = [studentId];
    source = 'manual';
  } else {
    const dataWithoutTarget = existing ? { ...data, dutyRecords: (data.dutyRecords ?? []).filter(record => record.id !== existing.id) } : data;
    const automatic = dutyAssignmentFor(dataWithoutTarget, classId, day, jobId, now);
    assignedIds = automatic.students.map(student => student.id);
    source = automatic.source;
  }
  const next: DutyRecord = {
    id: existing?.id ?? makeId(), classId, date: dutyDateForDay(day, now), day, jobId,
    studentIds: assignedIds, assignmentSource: source,
    status: existing?.status ?? '待检查', note: existing?.note ?? '', checkedBy: existing?.checkedBy ?? '劳动委员', createdAt: existing?.createdAt ?? now.getTime(),
  };
  return { data: replaceRecord(data, classId, next) };
}

export function markDutyRecord(data: ClassroomData, classId: string, day: string, jobId: string, status: Extract<DutyRecord['status'], '已完成' | '需返工'>, makeId: () => string, now = new Date()): DutyMutationResult {
  const settings = dutySettingsForClass(data, classId);
  if (!settings.jobs.some(job => job.id === jobId && job.enabled !== false)) return { error: '这个值日岗位已停用或不存在。' };
  const assignment = dutyAssignmentFor(data, classId, day, jobId, now);
  if (!assignment.students.length) return { error: '当前岗位没有可记录的负责学生，请先完成分组或手动指定。' };
  const existing = assignment.record;
  const next: DutyRecord = {
    id: existing?.id ?? makeId(), classId, date: assignment.date, day, jobId,
    studentIds: assignment.students.map(student => student.id), assignmentSource: assignment.source,
    status, note: existing?.note ?? '', checkedBy: existing?.checkedBy ?? '劳动委员', createdAt: existing?.createdAt ?? now.getTime(),
  };
  return { data: replaceRecord(data, classId, next) };
}

export function patchDutyRecord(data: ClassroomData, classId: string, recordId: string, patch: Pick<Partial<DutyRecord>, 'note' | 'checkedBy'>): DutyMutationResult {
  const record = (data.dutyRecords ?? []).find(item => item.id === recordId);
  if (!record || !belongsToClass(data, record, classId)) return { error: '这条检查记录不属于当前班级。' };
  return { data: { ...data, dutyRecords: (data.dutyRecords ?? []).map(item => item.id === recordId ? { ...item, ...patch } : item) } };
}
