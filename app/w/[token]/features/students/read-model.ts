import type { ClassroomData, RosterClass, Student } from '@/lib/classroom';
import { recordBelongsToStudent } from '../records/operations';

export function rosterClassesFor(data: ClassroomData): RosterClass[] {
  return data.rosterClasses?.length
    ? data.rosterClasses
    : [{ id: 'class-1', name: '当前班级', grade: '', term: '', students: data.students }];
}

export function activeRosterClass(data: ClassroomData): RosterClass {
  const classes = rosterClassesFor(data);
  return classes.find(item => item.id === data.activeClassId) ?? classes[0];
}

export function filterStudents(students: readonly Student[], query: string, group: string): Student[] {
  const keyword = query.trim().toLocaleLowerCase('zh-CN');
  return students.filter(student => {
    if (group !== '全部小组' && student.group !== Number(group)) return false;
    if (!keyword) return true;
    return `${student.name}${student.studentNo ?? ''}${student.parentPhone ?? ''}${student.note ?? ''}${student.group}${student.seat}`
      .toLocaleLowerCase('zh-CN').includes(keyword);
  });
}

export function studentRecentActivity(data: ClassroomData, classId: string, student: Student) {
  const homework = (data.homeworkTasks ?? [])
    .filter(task => (!task.classId || task.classId === classId) && task.statuses[student.id])
    .toSorted((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const attendance = (data.attendanceRecords ?? [])
    .filter(record => record.studentId === student.id && (!record.classId || record.classId === classId))
    .toSorted((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const records = data.records.filter(record => recordBelongsToStudent(record, student, classId))
    .toSorted((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const dictation = (data.dictation?.tasks ?? [])
    .filter(task => task.context.kind === 'class' && task.context.classId === classId && task.participants.some(person => person.id === student.id))
    .toSorted((a, b) => b.date.localeCompare(a.date))[0];
  return { homework, attendance, records, dictation };
}

export function parseRosterRows(text: string): string[] {
  return text.split(/\n+/).map(row => row.trim()).filter(Boolean);
}

export function makeRosterStudent(row: string, index: number, baseIndex: number, stamp: string): Student {
  const parts = row.split(/[\s,，、\t]+/).filter(Boolean);
  const absoluteIndex = baseIndex + index;
  return {
    id: `student-${stamp}-${absoluteIndex}`,
    studentNo: `${absoluteIndex + 1}`.padStart(2, '0'),
    name: parts[0] ?? '',
    gender: absoluteIndex % 2 === 0 ? '女' : '男',
    group: Math.floor(absoluteIndex / 4) + 1,
    seat: absoluteIndex + 1,
    points: 0,
    homework: '已交',
    attendance: '正常',
    score: 0,
    parentPhone: parts.find(part => /^1\d{10}$/.test(part)) ?? '',
    note: parts.filter((part, partIndex) => partIndex > 0 && !/^1\d{10}$/.test(part)).join(' '),
    avoidWith: '', seatNeed: '无', seatFixed: false, groupLeader: false,
  };
}

export function syncRosterStudents(data: ClassroomData, classId: string, students: Student[]): ClassroomData {
  const classes = rosterClassesFor(data);
  return {
    ...data,
    activeClassId: classId,
    students,
    rosterClasses: classes.map(item => item.id === classId ? { ...item, students } : item),
  };
}
