import type { AttendanceRecord, AttendanceStatus, ClassroomData, Student } from '@/lib/classroom';

export type AttendanceChange = { studentId: string; status: AttendanceStatus; note?: string };

export function localDateToday(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function applyAttendanceChanges(
  current: ClassroomData,
  classId: string,
  changes: readonly AttendanceChange[],
  date: string,
  createId: () => string,
  today = localDateToday(),
): ClassroomData {
  const classStudents = current.rosterClasses?.find(item => item.id === classId)?.students ?? current.students;
  const allowedIds = new Set(classStudents.map(student => student.id));
  const validChanges = changes.filter(change => allowedIds.has(change.studentId));
  if (!validChanges.length) return current;
  const changesById = new Map(validChanges.map(change => [change.studentId, change]));
  const retained = (current.attendanceRecords ?? []).filter(item => !(item.classId === classId && item.date === date && changesById.has(item.studentId)));
  const records = validChanges.map(change => {
    const existing = (current.attendanceRecords ?? []).find(item => item.classId === classId && item.date === date && item.studentId === change.studentId);
    const note = change.note ?? existing?.note ?? '';
    if (change.status !== '请假') return {
      id: existing?.id ?? createId(), classId, studentId: change.studentId, date,
      createdAt: existing?.createdAt ?? Date.now(), period: existing?.period ?? '全天', status: change.status, note,
    } as AttendanceRecord;
    return {
      id: existing?.id ?? createId(), classId, studentId: change.studentId, date,
      createdAt: existing?.createdAt ?? Date.now(), period: existing?.period ?? '全天', status: '请假',
      leaveType: existing?.leaveType ?? '事假', reason: existing?.reason ?? '', submittedBy: existing?.submittedBy ?? '家长',
      contact: existing?.contact ?? '', approval: existing?.approval ?? '待确认', returnedAt: existing?.returnedAt ?? '', note,
    } as AttendanceRecord;
  });
  const next = { ...current, attendanceRecords: [...retained, ...records] };
  if (date !== today) return next;
  const statuses = new Map(validChanges.map(change => [change.studentId, change.status]));
  const patchStudents = (students: Student[]) => students.map(student => statuses.has(student.id)
    ? { ...student, attendance: statuses.get(student.id)! }
    : student);
  const activeClassId = current.activeClassId ?? current.rosterClasses?.[0]?.id ?? classId;
  return {
    ...next,
    students: activeClassId === classId ? patchStudents(current.students) : current.students,
    rosterClasses: current.rosterClasses?.map(item => item.id === classId ? { ...item, students: patchStudents(item.students) } : item),
  };
}
