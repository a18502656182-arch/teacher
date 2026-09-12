import type { ClassroomData, NotificationDraft, Student } from '@/lib/classroom';

export type NotificationDraftInput = Pick<NotificationDraft, 'title' | 'content' | 'channel' | 'recipientStudentIds'> & { id?: string };
export type NotificationDraftResult =
  | { data: ClassroomData; draft: NotificationDraft; error?: never }
  | { data?: never; draft?: never; error: string };

function studentsForClass(data: ClassroomData, classId: string): Student[] {
  const roster = data.rosterClasses?.find(item => item.id === classId);
  if (roster) return roster.students;
  const activeClassId = data.activeClassId ?? classId;
  return activeClassId === classId ? data.students : [];
}

function belongsToClass(item: NotificationDraft, classId: string): boolean {
  return !item.classId || item.classId === classId;
}

export function localNotificationDate(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function notificationDraftsForClass(data: ClassroomData, classId: string): NotificationDraft[] {
  return (data.notificationDrafts ?? []).filter(item => belongsToClass(item, classId));
}

export function saveNotificationDraft(
  data: ClassroomData,
  classId: string,
  input: NotificationDraftInput,
  createId: () => string,
  date = localNotificationDate(),
  createdAt = Date.now(),
): NotificationDraftResult {
  if (!input.title.trim() || !input.content.trim()) return { error: '请补全通知标题和内容，再保存草稿。' };
  const allowedIds = new Set(studentsForClass(data, classId).map(student => student.id));
  const recipients = [...new Set(input.recipientStudentIds ?? [])];
  if (recipients.some(id => !allowedIds.has(id))) return { error: '通知对象包含不属于当前班级的学生，请重新选择。' };

  const existing = input.id ? (data.notificationDrafts ?? []).find(item => item.id === input.id) : undefined;
  if (input.id && (!existing || !belongsToClass(existing, classId))) {
    return { error: '这条通知草稿已不属于当前班级，请关闭后重新打开。' };
  }
  const draft: NotificationDraft = {
    id: existing?.id ?? createId(),
    classId,
    date: existing?.date ?? date,
    title: input.title.trim(),
    content: input.content.trim(),
    channel: input.channel,
    recipientStudentIds: recipients,
    status: existing?.status ?? '草稿',
    receiptNote: existing?.receiptNote,
    createdAt: existing?.createdAt ?? createdAt,
  };
  const current = data.notificationDrafts ?? [];
  const notificationDrafts = existing
    ? current.map(item => item.id === existing.id ? draft : item)
    : [draft, ...current];
  return { data: { ...data, notificationDrafts }, draft };
}

export function markNotificationCopied(data: ClassroomData, classId: string, draftId: string): ClassroomData {
  const target = (data.notificationDrafts ?? []).find(item => item.id === draftId);
  if (!target || !belongsToClass(target, classId)) return data;
  return { ...data, notificationDrafts: (data.notificationDrafts ?? []).map(item => item.id === draftId ? { ...item, status: '已复制' } : item) };
}

export function saveNotificationReceipt(data: ClassroomData, classId: string, draftId: string, note: string): ClassroomData {
  const target = (data.notificationDrafts ?? []).find(item => item.id === draftId);
  if (!target || !belongsToClass(target, classId)) return data;
  return { ...data, notificationDrafts: (data.notificationDrafts ?? []).map(item => item.id === draftId ? { ...item, status: '已记录回执', receiptNote: note.trim() || '已确认知晓' } : item) };
}

export function removeNotificationDraft(data: ClassroomData, classId: string, draftId: string): ClassroomData {
  const target = (data.notificationDrafts ?? []).find(item => item.id === draftId);
  if (!target || !belongsToClass(target, classId)) return data;
  return { ...data, notificationDrafts: (data.notificationDrafts ?? []).filter(item => item.id !== draftId) };
}
