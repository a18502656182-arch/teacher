import type { ClassroomData, CommunicationRecord, Student } from '@/lib/classroom';

export type CommunicationRecordDraft = {
  id?: string;
  studentId: string;
  type: string;
  channel: string;
  date: string;
  purpose: string;
  home: string;
  content: string;
  parentFeedback: string;
  followUp: string;
};

export type CommunicationRecordResult =
  | { data: ClassroomData; record: CommunicationRecord; error?: never }
  | { data?: never; record?: never; error: string };

function studentsForClass(data: ClassroomData, classId: string): Student[] {
  const roster = data.rosterClasses?.find(item => item.id === classId);
  if (roster) return roster.students;
  const activeClassId = data.activeClassId ?? classId;
  return activeClassId === classId ? data.students : [];
}

export function localCommunicationDate(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function recordBelongsToClass(record: CommunicationRecord, classId: string, students: readonly Student[]): boolean {
  if (record.classId) return record.classId === classId;
  if (record.studentId) return students.some(student => student.id === record.studentId);
  return students.some(student => student.name === record.student);
}

export function recordBelongsToStudent(record: CommunicationRecord, student: Student, classId: string): boolean {
  if (record.classId && record.classId !== classId) return false;
  return record.studentId ? record.studentId === student.id : record.student === student.name;
}

export function communicationRecordsForClass(data: ClassroomData, classId: string): CommunicationRecord[] {
  const students = studentsForClass(data, classId);
  return data.records.filter(record => recordBelongsToClass(record, classId, students));
}

export function saveCommunicationRecord(
  data: ClassroomData,
  classId: string,
  draft: CommunicationRecordDraft,
  createId: () => string,
): CommunicationRecordResult {
  const students = studentsForClass(data, classId);
  const student = students.find(item => item.id === draft.studentId);
  if (!student) return { error: '请选择当前班级的沟通对象。' };
  if (!draft.content.trim()) return { error: '请填写沟通内容后再保存。' };

  const existing = draft.id ? data.records.find(item => item.id === draft.id) : undefined;
  if (draft.id && (!existing || !recordBelongsToClass(existing, classId, students))) {
    return { error: '这条沟通记录已不属于当前班级，请关闭后重新打开。' };
  }

  const purpose = draft.purpose.trim();
  const home = draft.home.trim();
  const content = draft.content.trim();
  const record: CommunicationRecord = {
    id: existing?.id ?? createId(),
    classId,
    studentId: student.id,
    student: student.name,
    type: draft.type.trim() || '家校沟通',
    channel: draft.channel.trim() || '微信',
    date: draft.date.trim() || localCommunicationDate(),
    content: `目的：${purpose}｜家庭情况：${home}｜沟通内容：${content}`,
    parentFeedback: draft.parentFeedback.trim(),
    followUp: draft.followUp.trim(),
    status: existing?.status ?? '待跟进',
  };
  const records = existing
    ? data.records.map(item => item.id === existing.id ? record : item)
    : [record, ...data.records];
  return { data: { ...data, records }, record };
}

export function patchCommunicationStatus(
  data: ClassroomData,
  classId: string,
  recordId: string,
  status: CommunicationRecord['status'],
): ClassroomData {
  const students = studentsForClass(data, classId);
  const target = data.records.find(item => item.id === recordId);
  if (!target || !recordBelongsToClass(target, classId, students)) return data;
  return { ...data, records: data.records.map(item => item.id === recordId ? { ...item, status } : item) };
}

export function removeCommunicationRecord(data: ClassroomData, classId: string, recordId: string): ClassroomData {
  const students = studentsForClass(data, classId);
  const target = data.records.find(item => item.id === recordId);
  if (!target || !recordBelongsToClass(target, classId, students)) return data;
  return { ...data, records: data.records.filter(item => item.id !== recordId) };
}
