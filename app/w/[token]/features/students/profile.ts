import type { CareProfile, ClassroomData, Guardian, Student } from '@/lib/classroom';

export type StudentProfileDraft = {
  residence: NonNullable<Student['residence']>;
  tags: string;
  guardians: Guardian[];
  care: CareProfile[];
};

export type StudentProfileResult = { data: ClassroomData; error?: never } | { data?: never; error: string };

/** Validate and apply one student's private profile without touching another class or family dictation data. */
export function applyStudentProfile(
  current: ClassroomData,
  studentId: string,
  classId: string,
  draft: StudentProfileDraft,
): StudentProfileResult {
  const classStudents = current.rosterClasses?.find(item => item.id === classId)?.students
    ?? ((current.activeClassId ?? classId) === classId ? current.students : []);
  if (!classStudents.some(student => student.id === studentId)) return { error: '所选学生不属于当前班级。' };
  const guardians = draft.guardians
    .filter(item => item.name.trim())
    .map((item, index) => ({
      ...item,
      classId,
      studentId,
      name: item.name.trim(),
      phone: item.phone?.replace(/[\s-]/g, '') ?? '',
      isPrimary: Boolean(item.isPrimary),
      emergencyPriority: Math.max(1, Number(item.emergencyPriority) || index + 1),
    }));
  if (guardians.some(item => item.phone && !/^1[3-9]\d{9}$/.test(item.phone))) {
    return { error: '监护人电话需为 11 位手机号，或留空。' };
  }
  const care = draft.care.map(item => ({
    ...item,
    classId,
    studentId,
    instruction: item.instruction.trim(),
    contraindication: item.contraindication?.trim() ?? '',
    visibleScope: '班主任' as const,
  }));
  const tags = draft.tags.split(/[、，,]/).map(item => item.trim()).filter(Boolean).slice(0, 8);
  const patch = (student: Student) => student.id === studentId ? { ...student, residence: draft.residence, tags } : student;
  return { data: {
    ...current,
    students: current.students.map(patch),
    rosterClasses: current.rosterClasses?.map(classroom => classroom.id === classId
      ? { ...classroom, students: classroom.students.map(patch) }
      : classroom),
    guardians: [...(current.guardians ?? []).filter(item => item.studentId !== studentId || Boolean(item.classId && item.classId !== classId)), ...guardians],
    careProfiles: [...(current.careProfiles ?? []).filter(item => item.studentId !== studentId || Boolean(item.classId && item.classId !== classId)), ...care],
  } };
}
