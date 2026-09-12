import type { ClassroomData, RosterClass } from '@/lib/classroom';

export type AccountOperationResult = { data: ClassroomData; error?: string };

export function workspaceClasses(data: ClassroomData, fallbackTerm = ''): RosterClass[] {
  if (data.rosterClasses?.length) return data.rosterClasses;
  return [{ id: data.activeClassId || 'class-1', name: '当前班级', grade: '', term: fallbackTerm, students: data.students }];
}

export function switchWorkspaceClass(data: ClassroomData, classId: string, fallbackTerm = ''): AccountOperationResult {
  const classes = workspaceClasses(data, fallbackTerm);
  const target = classes.find((item) => item.id === classId);
  if (!target) return { data, error: '所选班级已不存在。' };
  if (target.id === data.activeClassId && data.students === target.students) return { data };
  return { data: { ...data, rosterClasses: classes, activeClassId: target.id, students: target.students } };
}

export function patchWorkspaceClass(data: ClassroomData, classId: string, patch: Pick<Partial<RosterClass>, 'name' | 'grade' | 'term'>, fallbackTerm = ''): AccountOperationResult {
  const classes = workspaceClasses(data, fallbackTerm);
  const target = classes.find((item) => item.id === classId);
  if (!target) return { data, error: '当前班级已不存在。' };
  const safePatch = {
    ...(patch.name === undefined ? {} : { name: String(patch.name).slice(0, 40) }),
    ...(patch.grade === undefined ? {} : { grade: String(patch.grade).slice(0, 24) }),
    ...(patch.term === undefined ? {} : { term: String(patch.term).slice(0, 60) }),
  };
  const rosterClasses = classes.map((item) => item.id === classId ? { ...item, ...safePatch } : item);
  const nextTarget = rosterClasses.find((item) => item.id === classId)!;
  return {
    data: {
      ...data,
      rosterClasses,
      students: data.activeClassId === classId || !data.activeClassId ? nextTarget.students : data.students,
    },
  };
}

export function addWorkspaceClass(data: ClassroomData, id: string, fallbackTerm = ''): AccountOperationResult {
  const classes = workspaceClasses(data, fallbackTerm);
  if (!id || classes.some((item) => item.id === id)) return { data, error: '无法生成新的班级标识，请重试。' };
  const activeClass = classes.find((item) => item.id === data.activeClassId) ?? classes[0];
  const newClass: RosterClass = {
    id,
    name: `新班级${classes.length + 1}`,
    grade: '',
    term: activeClass?.term ?? fallbackTerm,
    students: [],
  };
  return { data: { ...data, rosterClasses: [...classes, newClass], activeClassId: id, students: [] } };
}

function omitClass<T>(source: Record<string, T> | undefined, classId: string) {
  if (!source) return undefined;
  return Object.fromEntries(Object.entries(source).filter(([key]) => key !== classId));
}

export function removeWorkspaceClass(data: ClassroomData, classId: string, fallbackTerm = ''): AccountOperationResult {
  const classes = workspaceClasses(data, fallbackTerm);
  if (classes.length <= 1) return { data, error: '至少需要保留一个班级。' };
  const removed = classes.find((item) => item.id === classId);
  if (!removed) return { data, error: '当前班级已不存在。' };
  const remaining = classes.filter((item) => item.id !== classId);
  const nextActive = remaining[0];
  const removedStudentIds = new Set(removed.students.map((student) => student.id));
  const remainingStudentIds = new Set(remaining.flatMap((item) => item.students.map((student) => student.id)));
  const belongsByStudent = (rowClassId: string | undefined, studentId: string | undefined) => {
    if (rowClassId) return rowClassId === classId;
    return Boolean(studentId && removedStudentIds.has(studentId) && !remainingStudentIds.has(studentId));
  };
  const legacyClassOwned = data.activeClassId === classId;
  const removedExamIds = new Set((data.scoreExams ?? []).filter((item) => item.classId ? item.classId === classId : legacyClassOwned).map((item) => item.id));

  return {
    data: {
      ...data,
      activeClassId: nextActive.id,
      rosterClasses: remaining,
      students: nextActive.students,
      dictation: data.dictation ? {
        ...data.dictation,
        tasks: data.dictation.tasks.filter((task) => task.context.kind !== 'class' || task.context.classId !== classId),
      } : undefined,
      homeworkTasks: data.homeworkTasks?.filter((item) => item.classId ? item.classId !== classId : !legacyClassOwned),
      pointEvents: data.pointEvents?.filter((item) => !belongsByStudent(item.classId, item.studentId)),
      growthEvidence: data.growthEvidence?.filter((item) => !belongsByStudent(item.classId, item.studentId)),
      cadres: data.cadres?.filter((item) => !belongsByStudent(item.classId, item.studentId)),
      records: data.records.filter((item) => !belongsByStudent(item.classId, item.studentId)),
      scoreExams: data.scoreExams?.filter((item) => item.classId ? item.classId !== classId : !legacyClassOwned),
      examReflections: data.examReflections?.filter((item) => !removedExamIds.has(item.examId ?? '') && !belongsByStudent(item.classId, item.studentId)),
      termComments: data.termComments?.filter((item) => !belongsByStudent(item.classId, item.studentId)),
      weeklyReports: data.weeklyReports?.filter((item) => item.classId !== classId),
      dutyRecords: data.dutyRecords?.filter((item) => item.classId ? item.classId !== classId : !legacyClassOwned),
      attendanceRecords: data.attendanceRecords?.filter((item) => !belongsByStudent(item.classId, item.studentId)),
      teacherAgenda: data.teacherAgenda?.filter((item) => item.classId ? item.classId !== classId : !legacyClassOwned),
      workLogs: data.workLogs?.filter((item) => item.classId ? item.classId !== classId : !legacyClassOwned),
      classroomToolSessions: data.classroomToolSessions?.filter((item) => item.classId ? item.classId !== classId : !legacyClassOwned),
      notificationDrafts: data.notificationDrafts?.filter((item) => item.classId ? item.classId !== classId : !legacyClassOwned),
      guardians: data.guardians?.filter((item) => !belongsByStudent(item.classId, item.studentId)),
      careProfiles: data.careProfiles?.filter((item) => !belongsByStudent(item.classId, item.studentId)),
      classSchedules: omitClass(data.classSchedules, classId),
      classSeatingConfigs: omitClass(data.classSeatingConfigs, classId),
      classDutySettings: omitClass(data.classDutySettings, classId),
    },
  };
}
