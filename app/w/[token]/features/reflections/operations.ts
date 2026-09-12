import type { ClassroomData, CommunicationRecord, ExamReflection, Student } from '@/lib/classroom';

export type ExamReflectionDraft = {
  id?: string;
  studentId: string;
  examId?: string;
  date: string;
  problem: string;
  reason: string;
  action: string;
  familyMessage: string;
  teacherNote: string;
};

export type ExamReflectionResult =
  | { data: ClassroomData; reflection: ExamReflection; record?: CommunicationRecord; error?: never }
  | { data?: never; reflection?: never; record?: never; error: string };

function studentsForClass(data: ClassroomData, classId: string): Student[] {
  const roster = data.rosterClasses?.find(item => item.id === classId);
  if (roster) return roster.students;
  const activeClassId = data.activeClassId ?? classId;
  return activeClassId === classId ? data.students : [];
}

function examsForClass(data: ClassroomData, classId: string) {
  return (data.scoreExams ?? []).filter(item => !item.classId || item.classId === classId);
}

export function localReflectionDate(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function reflectionBelongsToClass(
  reflection: ExamReflection,
  classId: string,
  students: readonly Student[],
  examIds: ReadonlySet<string>,
): boolean {
  if (reflection.classId && reflection.classId !== classId) return false;
  if (!students.some(student => student.id === reflection.studentId)) return false;
  return !reflection.examId || examIds.has(reflection.examId);
}

export function examReflectionsForClass(data: ClassroomData, classId: string): ExamReflection[] {
  const students = studentsForClass(data, classId);
  const examIds = new Set(examsForClass(data, classId).map(exam => exam.id));
  return (data.examReflections ?? []).filter(reflection => reflectionBelongsToClass(reflection, classId, students, examIds));
}

function reflectionRecordContent(examTitle: string, reflection: ExamReflection): string {
  const parts = [
    `考试：${examTitle}`,
    `问题：${reflection.problem}`,
    `原因：${reflection.reason || '未填写'}`,
    `行动：${reflection.action || '未填写'}`,
  ];
  if (reflection.familyMessage) parts.push(`家长沟通建议：${reflection.familyMessage}`);
  return parts.join('｜');
}

export function saveExamReflection(
  data: ClassroomData,
  classId: string,
  draft: ExamReflectionDraft,
  status: ExamReflection['status'],
  createReflectionId: () => string,
  createRecordId: () => string,
): ExamReflectionResult {
  const students = studentsForClass(data, classId);
  const student = students.find(item => item.id === draft.studentId);
  if (!student) return { error: '请选择当前班级的学生。' };

  const exam = examsForClass(data, classId).find(item => item.id === draft.examId);
  if (!exam) return { error: '请选择当前班级的考试。' };
  if (!draft.problem.trim()) return { error: '请填写主要问题后再保存。' };

  const existing = draft.id ? (data.examReflections ?? []).find(item => item.id === draft.id) : undefined;
  const examIds = new Set(examsForClass(data, classId).map(item => item.id));
  if (existing && !reflectionBelongsToClass(existing, classId, students, examIds)) {
    return { error: '这条考试反思已不属于当前班级，请关闭后重新打开。' };
  }
  if (existing && (existing.studentId !== student.id || (existing.examId && existing.examId !== exam.id))) {
    return { error: '已保存反思不能改到其他学生或考试。' };
  }

  const reflection: ExamReflection = {
    id: existing?.id ?? draft.id ?? createReflectionId(),
    classId,
    studentId: student.id,
    examId: exam.id,
    date: draft.date.trim() || localReflectionDate(),
    problem: draft.problem.trim(),
    reason: draft.reason.trim(),
    action: draft.action.trim(),
    familyMessage: draft.familyMessage.trim(),
    teacherNote: draft.teacherNote.trim(),
    status,
  };

  const examReflections = existing
    ? (data.examReflections ?? []).map(item => item.id === existing.id ? reflection : item)
    : [reflection, ...(data.examReflections ?? [])];
  let nextData: ClassroomData = { ...data, examReflections };

  if (status !== '已完成') return { data: nextData, reflection };

  const linkedRecord = data.records.find(item => item.reflectionId === reflection.id);
  if (linkedRecord && ((linkedRecord.classId && linkedRecord.classId !== classId) || (linkedRecord.studentId && linkedRecord.studentId !== student.id))) {
    return { error: '这条反思的归档记录已不属于当前班级，请关闭后重新打开。' };
  }
  const record: CommunicationRecord = {
    ...linkedRecord,
    id: linkedRecord?.id ?? createRecordId(),
    reflectionId: reflection.id,
    classId,
    studentId: student.id,
    student: student.name,
    type: '考试反思',
    channel: '学生复盘',
    content: reflectionRecordContent(exam.title, reflection),
    followUp: reflection.teacherNote,
    status: '已归档',
    date: reflection.date,
  };
  const records = linkedRecord
    ? data.records.map(item => item.id === linkedRecord.id ? record : item)
    : [record, ...data.records];
  const scoreExams = (data.scoreExams ?? []).map(item => item.id === exam.id
    ? { ...item, classId, followUpStudentIds: (item.followUpStudentIds ?? []).filter(studentId => studentId !== student.id) }
    : item);
  nextData = { ...nextData, records, scoreExams };
  return { data: nextData, reflection, record };
}
