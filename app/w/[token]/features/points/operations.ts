import type { ClassroomData, PointEvent, PointRule, Student } from '@/lib/classroom';

function studentsForClass(data: ClassroomData, classId: string): Student[] {
  const target = data.rosterClasses?.find(item => item.id === classId);
  if (target) return target.students;
  if (!data.rosterClasses?.length || !data.activeClassId || data.activeClassId === classId) return data.students;
  return [];
}

function patchStudentPoints(data: ClassroomData, classId: string, deltas: ReadonlyMap<string, number>): ClassroomData {
  if (!deltas.size) return data;
  const patch = (students: Student[]) => students.map(student => deltas.has(student.id)
    ? { ...student, points: student.points + deltas.get(student.id)! }
    : student);
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? classId;
  return {
    ...data,
    students: activeClassId === classId ? patch(data.students) : data.students,
    rosterClasses: data.rosterClasses?.map(item => item.id === classId ? { ...item, students: patch(item.students) } : item),
  };
}

export function pointEventsForClass(data: ClassroomData, classId: string): PointEvent[] {
  const allowedIds = new Set(studentsForClass(data, classId).map(student => student.id));
  return (data.pointEvents ?? []).filter(event => event.classId ? event.classId === classId : allowedIds.has(event.studentId));
}

export function applyPointEvents(
  data: ClassroomData,
  classId: string,
  studentIds: readonly string[],
  rule: PointRule,
  delta: number,
  note: string,
  operator: string,
  date: string,
  createId: () => string,
): ClassroomData {
  if (!Number.isFinite(delta) || delta === 0) return data;
  const allowedIds = new Set(studentsForClass(data, classId).map(student => student.id));
  const validIds = [...new Set(studentIds)].filter(id => allowedIds.has(id));
  if (!validIds.length) return data;
  const reason = note.trim() ? `${rule.reason || rule.title}｜${note.trim()}` : rule.reason || rule.title;
  const events: PointEvent[] = validIds.map(studentId => ({
    id: createId(), classId, studentId, ruleId: rule.id, scene: rule.scene, reason, delta, date,
    operator: operator.trim() || '班主任',
  }));
  const deltas = new Map(validIds.map(id => [id, delta]));
  const patched = patchStudentPoints(data, classId, deltas);
  return { ...patched, pointEvents: [...events, ...(patched.pointEvents ?? [])] };
}

export function undoPointEvent(data: ClassroomData, classId: string, eventId: string): ClassroomData {
  const event = (data.pointEvents ?? []).find(item => item.id === eventId);
  if (!event || (event.classId && event.classId !== classId)) return data;
  const allowedIds = new Set(studentsForClass(data, classId).map(student => student.id));
  if (!allowedIds.has(event.studentId)) return data;
  const patched = patchStudentPoints(data, classId, new Map([[event.studentId, -event.delta]]));
  return { ...patched, pointEvents: (patched.pointEvents ?? []).filter(item => item.id !== eventId) };
}
