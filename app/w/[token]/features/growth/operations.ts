import type { ClassroomData, GrowthEvidence } from '@/lib/classroom';

export type GrowthEvidenceDraft = Pick<GrowthEvidence, 'date' | 'type' | 'title' | 'content' | 'followUp'>;
export type GrowthEvidenceResult = { data: ClassroomData; item: GrowthEvidence; error?: never } | { data?: never; item?: never; error: string };

function classStudentIds(data: ClassroomData, classId: string): Set<string> {
  const roster = data.rosterClasses?.find(item => item.id === classId);
  if (roster) return new Set(roster.students.map(student => student.id));
  const activeClassId = data.activeClassId ?? classId;
  return activeClassId === classId ? new Set(data.students.map(student => student.id)) : new Set();
}

export function addGrowthEvidence(
  data: ClassroomData,
  classId: string,
  studentId: string,
  draft: GrowthEvidenceDraft,
  createId: () => string,
  createdAt = Date.now(),
): GrowthEvidenceResult {
  if (!classStudentIds(data, classId).has(studentId)) return { error: '所选学生不属于当前班级。' };
  if (!draft.date || !draft.title.trim() || !draft.content.trim()) return { error: '请填写日期、标题和具体事实。' };
  const item: GrowthEvidence = {
    id: createId(), classId, studentId, date: draft.date, type: draft.type.trim() || '日常',
    title: draft.title.trim(), content: draft.content.trim(), followUp: draft.followUp?.trim() ?? '',
    source: '班主任补充', createdAt,
  };
  return { data: { ...data, growthEvidence: [item, ...(data.growthEvidence ?? [])] }, item };
}

export function growthEvidenceForStudent(data: ClassroomData, classId: string, studentId: string): GrowthEvidence[] {
  const allowed = classStudentIds(data, classId);
  if (!allowed.has(studentId)) return [];
  return (data.growthEvidence ?? []).filter(item => item.source !== '家校沟通' && item.studentId === studentId && (!item.classId || item.classId === classId));
}
