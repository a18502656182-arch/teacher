import type { ClassroomData, CommunicationRecord, ExamReflection, PointEvent, Student, TermComment } from '@/lib/classroom';

export type TermCommentDraft = Pick<TermComment, 'studentId' | 'term' | 'style' | 'content'> & { id?: string };

export type TermCommentResult =
  | { data: ClassroomData; comment: TermComment; error?: never }
  | { data?: never; comment?: never; error: string };

export type TermCommentEvidence = {
  records: readonly CommunicationRecord[];
  events: readonly PointEvent[];
  reflections: readonly ExamReflection[];
  teacherInput?: string;
};

const commentStyles: TermComment['style'][] = ['家长可读', '温和鼓励', '客观正式'];

function studentsForClass(data: ClassroomData, classId: string): readonly Student[] {
  const roster = data.rosterClasses?.find(item => item.id === classId);
  if (roster) return roster.students;
  return (data.activeClassId ?? classId) === classId ? data.students : [];
}

function hasClass(data: ClassroomData, classId: string): boolean {
  if (data.rosterClasses?.length) return data.rosterClasses.some(item => item.id === classId);
  return (data.activeClassId ?? classId) === classId;
}

export function termCommentBelongsToClass(data: ClassroomData, classId: string, comment: TermComment): boolean {
  if (comment.classId && comment.classId !== classId) return false;
  return studentsForClass(data, classId).some(student => student.id === comment.studentId);
}

export function termCommentsForClass(data: ClassroomData, classId: string): TermComment[] {
  return (data.termComments ?? []).filter(comment => termCommentBelongsToClass(data, classId, comment));
}

export function saveTermComment(
  data: ClassroomData,
  classId: string,
  draft: TermCommentDraft,
  createId: () => string,
  updatedAt: string,
): TermCommentResult {
  if (!hasClass(data, classId)) return { error: '当前班级已不存在，请刷新后重试。' };
  const students = studentsForClass(data, classId);
  if (!students.some(student => student.id === draft.studentId)) return { error: '所选学生已不在当前班级，请重新选择。' };
  const term = draft.term.trim();
  if (!term) return { error: '学期不能为空。' };
  if (!commentStyles.includes(draft.style)) return { error: '评语语气无效，请重新选择。' };
  const content = draft.content.trim();
  if (!content) return { error: '评语内容不能为空。' };

  const comments = data.termComments ?? [];
  const idTarget = draft.id ? comments.find(comment => comment.id === draft.id) : undefined;
  if (idTarget && !termCommentBelongsToClass(data, classId, idTarget)) {
    return { error: '这条评语已不属于当前班级，请关闭后重新打开。' };
  }
  if (idTarget && idTarget.studentId !== draft.studentId) {
    return { error: '已保存的评语不能改绑到其他学生。' };
  }
  const periodTarget = comments.find(comment => termCommentBelongsToClass(data, classId, comment)
    && comment.studentId === draft.studentId
    && comment.term.trim() === term
    && comment.style === draft.style);
  if (idTarget && periodTarget && idTarget.id !== periodTarget.id) {
    return { error: '该学生在当前学期和语气下已有另一条评语，请先打开原评语。' };
  }
  const existing = idTarget ?? periodTarget;
  const comment: TermComment = {
    id: existing?.id ?? draft.id ?? createId(),
    classId,
    studentId: draft.studentId,
    term,
    style: draft.style,
    content,
    updatedAt,
  };
  const termComments = existing
    ? comments.map(item => item.id === existing.id ? comment : item)
    : [comment, ...comments];
  return { data: { ...data, termComments }, comment };
}

function withStop(value: string): string {
  const text = value.trim();
  if (!text) return '';
  return /[。！？；]$/.test(text) ? text : `${text}。`;
}

function datedPrefix(date: string): string {
  return date.trim() ? `${date.trim()}的` : '';
}

export function appendTermCommentText(current: string, next: string): string {
  const first = withStop(current);
  const second = withStop(next);
  return [first, second].filter(Boolean).join('');
}

export function buildLocalTermCommentDraft(student: Student, style: TermComment['style'], evidence: TermCommentEvidence): string {
  const facts = [
    ...evidence.records.flatMap(record => {
      const content = record.content.trim();
      return content ? [`${datedPrefix(record.date)}${record.type || '校内'}记录：${content}`] : [];
    }),
    ...evidence.events.flatMap(event => {
      const reason = event.reason.trim();
      if (!reason) return [];
      const delta = Number.isFinite(event.delta) ? `（${event.delta > 0 ? '+' : ''}${event.delta}分）` : '';
      return [`${datedPrefix(event.date)}积分记录：${reason}${delta}`];
    }),
    ...evidence.reflections.flatMap(reflection => {
      const details = [
        reflection.problem.trim() ? `问题：${reflection.problem.trim()}` : '',
        reflection.reason.trim() ? `原因：${reflection.reason.trim()}` : '',
        reflection.action.trim() ? `下一步：${reflection.action.trim()}` : '',
        reflection.teacherNote?.trim() ? `教师跟进：${reflection.teacherNote.trim()}` : '',
      ].filter(Boolean).join('；');
      return details ? [`${datedPrefix(reflection.date)}考试反思记录：${details}`] : [];
    }),
    ...(evidence.teacherInput?.trim() ? [`教师补充：${evidence.teacherInput.trim()}`] : []),
  ];
  if (!facts.length) return '';
  const opening = style === '客观正式'
    ? `${student.name}同学本学期已有以下记录。`
    : style === '温和鼓励'
      ? `${student.name}同学，老师根据本学期已有记录整理如下。`
      : `${student.name}同学本学期已有以下校内记录。`;
  return facts.reduce((text, fact) => appendTermCommentText(text, fact), opening);
}
