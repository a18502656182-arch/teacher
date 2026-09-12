import type { ClassroomData, ClassroomToolSession, Student } from '@/lib/classroom';

export type ToolCandidateResult = {
  students: Student[];
  excludedStudentIds: string[];
  error?: string;
};

export type ToolDrawResult = {
  pickedIds: string[];
  studentId?: string;
  eligibleCount: number;
  excludedCount: number;
  complete: boolean;
  error?: string;
};

export type ToolSessionResult =
  | { data: ClassroomData; session: ClassroomToolSession; eligibleCount: number; excludedCount: number }
  | { eligibleCount: number; excludedCount: number; error: string };

function isLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function classStudents(data: ClassroomData, classId: string): Student[] | null {
  if (data.rosterClasses?.length) return data.rosterClasses.find(item => item.id === classId)?.students ?? null;
  return (data.activeClassId ?? classId) === classId ? data.students : null;
}

function belongsToClass(classId: string, activeClassId: string | undefined, itemClassId: string | undefined): boolean {
  return itemClassId === classId || (!itemClassId && (activeClassId ?? classId) === classId);
}

function randomIndex(length: number, random: () => number): number {
  const value = Number(random());
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(length - 1, Math.floor(value * length)));
}

export function localToolDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function eligibleClassroomToolStudents(data: ClassroomData, classId: string, date: string): ToolCandidateResult {
  const students = classStudents(data, classId);
  if (!students) return { students: [], excludedStudentIds: [], error: '当前班级已不存在，请刷新后重试。' };
  if (!isLocalDate(date)) return { students: [], excludedStudentIds: [], error: '课堂工具日期无效。' };
  const rosterIds = new Set(students.map(student => student.id));
  const excludedStudentIds = [...new Set((data.attendanceRecords ?? [])
    .filter(item => belongsToClass(classId, data.activeClassId, item.classId) && item.date === date && item.status === '请假' && rosterIds.has(item.studentId))
    .map(item => item.studentId))];
  const excluded = new Set(excludedStudentIds);
  return { students: students.filter(student => !excluded.has(student.id)), excludedStudentIds };
}

export function drawClassroomStudent(
  data: ClassroomData,
  classId: string,
  date: string,
  priorPickedIds: readonly string[],
  random: () => number = Math.random,
): ToolDrawResult {
  const candidates = eligibleClassroomToolStudents(data, classId, date);
  if (candidates.error) return { pickedIds: [], eligibleCount: 0, excludedCount: 0, complete: false, error: candidates.error };
  const allowed = new Set(candidates.students.map(student => student.id));
  const pickedIds = [...new Set(priorPickedIds)].filter(id => allowed.has(id));
  const pool = candidates.students.filter(student => !pickedIds.includes(student.id));
  if (!pool.length) {
    return {
      pickedIds,
      eligibleCount: candidates.students.length,
      excludedCount: candidates.excludedStudentIds.length,
      complete: candidates.students.length > 0 && pickedIds.length === candidates.students.length,
      error: candidates.students.length ? '本轮可参与学生已全部抽取，请重置后开始下一轮。' : '今天没有可参与点名的学生。',
    };
  }
  const studentId = pool[randomIndex(pool.length, random)].id;
  const nextPickedIds = [...pickedIds, studentId];
  return {
    pickedIds: nextPickedIds,
    studentId,
    eligibleCount: candidates.students.length,
    excludedCount: candidates.excludedStudentIds.length,
    complete: nextPickedIds.length === candidates.students.length,
  };
}

export function classroomToolSessionsForClass(data: ClassroomData, classId: string): ClassroomToolSession[] {
  return (data.classroomToolSessions ?? [])
    .filter(session => belongsToClass(classId, data.activeClassId, session.classId) && session.kind === '临时分组' && Boolean(session.groups?.length))
    .sort((left, right) => right.createdAt - left.createdAt);
}

export function createTemporaryGrouping(
  data: ClassroomData,
  classId: string,
  date: string,
  requestedGroupCount: number,
  createId: () => string,
  createdAt: number,
  random: () => number = Math.random,
): ToolSessionResult {
  const candidates = eligibleClassroomToolStudents(data, classId, date);
  const excludedCount = candidates.excludedStudentIds.length;
  if (candidates.error) return { eligibleCount: 0, excludedCount, error: candidates.error };
  if (!Number.isInteger(requestedGroupCount) || requestedGroupCount < 2 || requestedGroupCount > 12) {
    return { eligibleCount: candidates.students.length, excludedCount, error: '分组数必须是 2 至 12 的整数。' };
  }
  if (candidates.students.length < 2) {
    return { eligibleCount: candidates.students.length, excludedCount, error: '至少需要 2 名可参与学生才能临时分组。' };
  }
  const shuffled = [...candidates.students];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = randomIndex(index + 1, random);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  const groupCount = Math.min(requestedGroupCount, shuffled.length);
  const groups = Array.from({ length: groupCount }, () => [] as string[]);
  shuffled.forEach((student, index) => groups[index % groupCount].push(student.id));
  const id = createId();
  if (!id || (data.classroomToolSessions ?? []).some(session => session.id === id)) {
    return { eligibleCount: candidates.students.length, excludedCount, error: '分组记录标识冲突，请重试。' };
  }
  const session: ClassroomToolSession = {
    id,
    classId,
    date,
    kind: '临时分组',
    selectedStudentIds: shuffled.map(student => student.id),
    groups,
    createdAt,
  };
  return {
    data: { ...data, classroomToolSessions: [session, ...(data.classroomToolSessions ?? [])] },
    session,
    eligibleCount: shuffled.length,
    excludedCount,
  };
}

export function formatTemporaryGrouping(data: ClassroomData, classId: string, sessionId: string): { text?: string; error?: string } {
  const session = classroomToolSessionsForClass(data, classId).find(item => item.id === sessionId);
  if (!session) return { error: '这条分组记录已不属于当前班级，请重新打开。' };
  const students = classStudents(data, classId);
  if (!students) return { error: '当前班级已不存在，请刷新后重试。' };
  const names = new Map(students.map(student => [student.id, student.name]));
  return {
    text: (session.groups ?? []).map((group, index) => `第${index + 1}组：${group.map(id => names.get(id) ?? '已移除学生').join('、') || '暂无学生'}`).join('\n'),
  };
}
