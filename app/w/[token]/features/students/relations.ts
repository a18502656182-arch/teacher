import type { ClassroomData } from '@/lib/classroom';

export function removeStudentRelations(data: ClassroomData, studentIds: Iterable<string>, classId: string): ClassroomData {
  const ids = new Set(studentIds);
  if (!ids.size) return data;
  const omitStudentKeys = <T,>(source: Record<string, T> | undefined) => Object.fromEntries(Object.entries(source ?? {}).filter(([studentId]) => !ids.has(studentId)));
  return {
    ...data,
    homeworkTasks: data.homeworkTasks?.map((task) => task.classId === classId ? {
      ...task,
      statuses: omitStudentKeys(task.statuses),
      followUpStudentIds: task.followUpStudentIds?.filter((studentId) => !ids.has(studentId)),
    } : task),
    pointEvents: data.pointEvents?.filter((event) => !ids.has(event.studentId)),
    growthEvidence: data.growthEvidence?.filter((item) => !ids.has(item.studentId)),
    cadres: data.cadres?.filter((role) => role.classId && role.classId !== classId ? true : !ids.has(role.studentId)),
    records: data.records.filter((record) => !record.studentId || !ids.has(record.studentId)),
    scoreExams: data.scoreExams?.map((exam) => exam.classId === classId ? {
      ...exam,
      scores: omitStudentKeys(exam.scores),
      levels: omitStudentKeys(exam.levels),
      advice: omitStudentKeys(exam.advice),
      focusSubjects: omitStudentKeys(exam.focusSubjects),
      followUpStudentIds: exam.followUpStudentIds?.filter((studentId) => !ids.has(studentId)),
      knowledgeItems: exam.knowledgeItems?.map((item) => ({ ...item, scores: omitStudentKeys(item.scores) })),
    } : exam),
    examReflections: data.examReflections?.filter((item) => !ids.has(item.studentId)),
    termComments: data.termComments?.filter((item) => !ids.has(item.studentId)),
    dutyJobs: data.dutyJobs?.map((job) => ({ ...job, studentIds: job.studentIds?.filter((studentId) => !ids.has(studentId)) })),
    classDutySettings: data.classDutySettings ? Object.fromEntries(Object.entries(data.classDutySettings).map(([settingsClassId, settings]) => [settingsClassId, settingsClassId === classId ? {
      ...settings,
      jobs: settings.jobs.map((job) => ({ ...job, studentIds: job.studentIds?.filter((studentId) => !ids.has(studentId)) })),
    } : settings])) : undefined,
    dutyRecords: data.dutyRecords?.map((record) => record.classId === classId ? { ...record, studentIds: record.studentIds.filter((studentId) => !ids.has(studentId)) } : record),
    attendanceRecords: data.attendanceRecords?.filter((record) => !ids.has(record.studentId)),
    teacherAgenda: data.teacherAgenda?.map((item) => item.classId === classId ? { ...item, relatedStudentIds: item.relatedStudentIds?.filter((studentId) => !ids.has(studentId)) } : item),
    workLogs: data.workLogs?.map((item) => item.classId === classId ? { ...item, relatedStudentIds: item.relatedStudentIds?.filter((studentId) => !ids.has(studentId)) } : item),
    dictation: data.dictation ? { ...data.dictation, tasks: data.dictation.tasks.flatMap(task => {
      if (task.context.kind !== 'class' || task.context.classId !== classId) return [task];
      const participants = task.participants.filter(person => !ids.has(person.id));
      const results = Object.fromEntries(Object.entries(task.results).filter(([id]) => !ids.has(id)));
      // Only discard a task if this deletion removed its last participant.
      if (task.participants.length > 0 && participants.length === 0) return [];
      if (participants.length === task.participants.length && Object.keys(results).length === Object.keys(task.results).length) return [task];
      return [{ ...task, participants, results }];
    }) } : undefined,
    guardians: data.guardians?.filter((item) => !ids.has(item.studentId)),
    careProfiles: data.careProfiles?.filter((item) => !ids.has(item.studentId)),
    notificationDrafts: data.notificationDrafts?.map((item) => item.classId === classId ? { ...item, recipientStudentIds: item.recipientStudentIds?.filter((studentId) => !ids.has(studentId)) } : item),
  };
}
