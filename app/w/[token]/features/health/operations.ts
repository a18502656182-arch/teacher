import type { CareProfile, ClassroomData, Guardian } from '@/lib/classroom';

export type CareProfileDraft = Pick<CareProfile, 'id' | 'studentId' | 'category' | 'severity' | 'instruction' | 'contraindication' | 'reviewedAt' | 'summary' | 'actionContexts' | 'customCategory'>;
export type CareProfileResult = { data: ClassroomData; profile: CareProfile; error?: never } | { data?: never; profile?: never; error: string };

export function localCareDate(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function studentsInClass(data: ClassroomData, classId: string): Set<string> {
  const roster = data.rosterClasses?.find(item => item.id === classId);
  if (roster) return new Set(roster.students.map(student => student.id));
  const activeClassId = data.activeClassId ?? classId;
  return activeClassId === classId ? new Set(data.students.map(student => student.id)) : new Set();
}

export function saveCareProfile(data: ClassroomData, classId: string, draft: CareProfileDraft, createId: () => string): CareProfileResult {
  const allowedIds = studentsInClass(data, classId);
  if (!allowedIds.has(draft.studentId)) return { error: '所选学生不属于当前班级。' };
  if (draft.id) {
    const existing = (data.careProfiles ?? []).find(item => item.id === draft.id);
    if (!existing || (existing.classId && existing.classId !== classId) || !allowedIds.has(existing.studentId)) return { error: '这条照护登记已不属于当前班级，请关闭后重新打开。' };
  }
  const profile: CareProfile = {
    ...draft,
    id: draft.id || createId(),
    classId,
    summary: draft.summary?.trim(),
    instruction: draft.instruction.trim(),
    contraindication: draft.contraindication?.trim(),
    customCategory: draft.category === '其他' ? draft.customCategory?.trim() : '',
    actionContexts: [...new Set((draft.actionContexts ?? []).map(item => item.trim()).filter(Boolean))].slice(0, 14),
    reviewedAt: draft.reviewedAt?.trim(),
    visibleScope: '班主任',
  };
  return { data: { ...data, careProfiles: [profile, ...(data.careProfiles ?? []).filter(item => item.id !== profile.id)] }, profile };
}

export function removeCareProfile(data: ClassroomData, classId: string, profileId: string): ClassroomData {
  const allowedIds = studentsInClass(data, classId);
  const target = (data.careProfiles ?? []).find(item => item.id === profileId);
  if (!target || (target.classId && target.classId !== classId) || !allowedIds.has(target.studentId)) return data;
  return { ...data, careProfiles: (data.careProfiles ?? []).filter(item => item.id !== profileId) };
}

export function primaryGuardianForStudent(guardians: readonly Guardian[], classId: string, studentId: string): Guardian | undefined {
  return guardians
    .filter(guardian => guardian.studentId === studentId && (!guardian.classId || guardian.classId === classId))
    .toSorted((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)) || (a.emergencyPriority ?? 99) - (b.emergencyPriority ?? 99))[0];
}
