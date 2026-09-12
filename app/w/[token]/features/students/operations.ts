import type { Student } from '@/lib/classroom';

export type StudentBatchDraft = { group: string; gender: Student['gender'] | '不修改'; note: string };

/** Blank fields mean keep existing values, not clear them. No persistence side effects. */
export function applyStudentBatch(students: Student[], selectedIds: readonly string[], draft: StudentBatchDraft): Student[] {
  const group = draft.group.trim() ? Math.max(1, Number(draft.group) || 1) : null;
  const note = draft.note.trim();
  const ids = new Set(selectedIds);
  return students.map(student => ids.has(student.id) ? {
    ...student,
    ...(group ? { group } : {}),
    ...(draft.gender !== '不修改' ? { gender: draft.gender } : {}),
    ...(note ? { note } : {}),
  } : student);
}
