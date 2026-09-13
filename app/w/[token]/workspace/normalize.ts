import { scheduleTermLabel } from '@/lib/classroom';
import type { ClassScheduleData, ClassroomData, HomeworkTask, RosterClass } from '@/lib/classroom';
import { cloneDutyJobs, defaultDutyJobs, normalizeClassDutySettings } from '../features/duty/operations';
import { pointRulesForData } from '../features/rules/operations';
import { normalizeSeatingConfig } from '../features/seating/operations';

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function normalizeWorkspaceData(data: ClassroomData): ClassroomData {
  const activeTermLabel = data.scheduleConfig ? scheduleTermLabel(data.scheduleConfig) : "";
  const fallbackStudents = data.students.map((student, index) => ({
    studentNo: student.studentNo ?? `${index + 1}`.padStart(2, "0"),
    parentPhone: student.parentPhone ?? "",
    note: student.note ?? "",
    ...student,
    avoidWith: student.avoidWith ?? "",
    seatNeed: student.seatNeed ?? "无",
    seatFixed: student.seatFixed ?? false,
    groupLeader: student.groupLeader ?? false,
  }));
  const rosterClasses: RosterClass[] = data.rosterClasses?.length
    ? data.rosterClasses.map((item, classIndex) => ({
      id: item.id || `class-${classIndex + 1}`,
      name: item.name || `班级${classIndex + 1}`,
      grade: item.grade || "",
      term: item.term || activeTermLabel || "",
      students: item.students.map((student, index) => ({
        studentNo: student.studentNo ?? `${index + 1}`.padStart(2, "0"),
        parentPhone: student.parentPhone ?? "",
        note: student.note ?? "",
        ...student,
        avoidWith: student.avoidWith ?? "",
        seatNeed: student.seatNeed ?? "无",
        seatFixed: student.seatFixed ?? false,
        groupLeader: student.groupLeader ?? false,
      })),
    }))
    : [{ id: "class-1", name: "当前班级", grade: "", term: activeTermLabel, students: fallbackStudents }];
  const activeClassId = data.activeClassId && rosterClasses.some((item) => item.id === data.activeClassId) ? data.activeClassId : rosterClasses[0].id;
  const students = rosterClasses.find((item) => item.id === activeClassId)?.students ?? fallbackStudents;
  const classByStudentId = new Map<string, string>();
  const studentsByName = new Map<string, Array<{ id: string; classId: string }>>();
  rosterClasses.forEach((classroom) => classroom.students.forEach((student) => {
    classByStudentId.set(student.id, classroom.id);
    studentsByName.set(student.name, [...(studentsByName.get(student.name) ?? []), { id: student.id, classId: classroom.id }]);
  }));
  function resolveStudentLink(studentId?: string, studentName?: string, classId?: string) {
    if (studentId && classByStudentId.has(studentId)) return { studentId, classId: classByStudentId.get(studentId)! };
    const candidates = studentName ? studentsByName.get(studentName) ?? [] : [];
    const matched = candidates.find((item) => item.classId === classId) ?? (candidates.length === 1 ? candidates[0] : candidates.find((item) => item.classId === activeClassId));
    return { studentId: matched?.id ?? studentId ?? "", classId: matched?.classId ?? classId ?? activeClassId };
  }
  const columns = Math.max(2, Math.min(10, data.seatingConfig?.columns ?? 6));
  const rows = Math.max(1, Math.min(20, Math.max(data.seatingConfig?.rows ?? 6, Math.ceil(students.length / columns))));
  const existingGroupCount = Math.max(1, ...students.map((student) => student.group || 1));
  const groupCount = Math.max(1, Math.min(12, data.seatingConfig?.groupCount ?? existingGroupCount));
  const aisleAfter = (data.seatingConfig?.aisleAfter ?? Array.from({ length: Math.floor((columns - 1) / 2) }, (_, index) => (index + 1) * 2))
    .filter((column, index, values) => column > 0 && column < columns && values.indexOf(column) === index)
    .sort((a, b) => a - b);
  const legacySchedule: ClassScheduleData = {
    config: data.scheduleConfig,
    courses: data.courses ?? [],
    events: data.scheduleEvents ?? [],
    focuses: data.dailyFocus ?? [],
    weeks: data.scheduleWeeks ?? [],
  };
  const classSchedules = data.classSchedules ?? Object.fromEntries(rosterClasses.map((classroom) => [classroom.id, { ...legacySchedule }]));
  const activeSchedule = classSchedules[activeClassId] ?? legacySchedule;
  const legacySeating = { rows, columns, groupCount, aisleAfter };
  const classSeatingConfigs = data.classSeatingConfigs ?? Object.fromEntries(rosterClasses.map((classroom) => [classroom.id, { ...legacySeating }]));
  const activeSeating = classSeatingConfigs[activeClassId] ?? legacySeating;
  const dutySource = { ...data, rosterClasses, activeClassId, students };
  const classDutySettings = Object.fromEntries(rosterClasses.map(classroom => [classroom.id, normalizeClassDutySettings(dutySource, classroom.id)]));
  const activeDuty = classDutySettings[activeClassId];
  const rosterIdsByClass = new Map(rosterClasses.map(classroom => [classroom.id, new Set(classroom.students.map(student => student.id))]));
  const firstTask: HomeworkTask = {
    id: "h-default",
    classId: activeClassId,
    followUpStudentIds: [],
    date: today(),
    subject: "数学",
    title: "今日作业",
    statuses: Object.fromEntries(students.map((student) => [student.id, student.homework === "已交" ? "已交" : student.homework])),
  };
  return {
    ...data,
    activeClassId,
    rosterClasses,
    students,
    homeworkTasks: data.homeworkTasks === undefined ? [firstTask] : data.homeworkTasks.map((task) => ({ ...task, classId: task.classId ?? rosterClasses[0].id, followUpStudentIds: task.followUpStudentIds ?? [] })),
    pointEvents: (data.pointEvents ?? []).map((event) => ({ ...event, classId: event.classId ?? classByStudentId.get(event.studentId) ?? activeClassId })),
    growthEvidence: (data.growthEvidence ?? []).map((item) => ({ ...item, classId: item.classId ?? classByStudentId.get(item.studentId) ?? activeClassId })),
    pointRules: pointRulesForData(data).map((rule) => ({ ...rule, enabled: rule.enabled !== false })),
    dutyOffset: activeDuty.offset,
    dutyJobs: cloneDutyJobs(activeDuty.jobs),
    classDutySettings,
    dutyRecords: (data.dutyRecords ?? []).map(record => {
      const classId = record.classId ?? rosterClasses[0].id;
      const studentIds = rosterIdsByClass.get(classId) ?? new Set<string>();
      return {
        ...record,
        classId,
        studentIds: (record.studentIds ?? []).filter((id, index, values) => studentIds.has(id) && values.indexOf(id) === index),
        assignmentSource: ["auto", "fixed", "manual"].includes(record.assignmentSource ?? "") ? record.assignmentSource : (record.studentIds?.length ? "manual" : "auto"),
      };
    }),
    attendanceRecords: (data.attendanceRecords ?? []).map((item) => ({
      ...item,
      classId: item.classId ?? classByStudentId.get(item.studentId) ?? activeClassId,
      period: item.period ?? "全天",
      status: ["正常", "迟到", "请假", "缺勤"].includes(item.status) ? item.status : "正常",
      createdAt: item.createdAt ?? Date.now(),
    })),
    teacherAgenda: (data.teacherAgenda ?? []).map((item) => ({
      ...item,
      classId: item.classId ?? activeClassId,
      relatedStudentIds: item.relatedStudentIds ?? [],
      status: ["待处理", "进行中", "已完成", "已取消"].includes(item.status) ? item.status : "待处理",
      createdAt: item.createdAt ?? Date.now(),
    })),
    workLogs: (data.workLogs ?? []).map((item) => ({
      ...item,
      classId: item.classId ?? activeClassId,
      relatedStudentIds: item.relatedStudentIds ?? [],
      createdAt: item.createdAt ?? Date.now(),
    })),
    classroomToolSessions: (data.classroomToolSessions ?? []).map((item) => ({ ...item, classId: item.classId ?? activeClassId, selectedStudentIds: item.selectedStudentIds ?? [], groups: item.groups ?? [], createdAt: item.createdAt ?? Date.now() })),
    notificationDrafts: (data.notificationDrafts ?? []).map((item) => ({ ...item, classId: item.classId ?? activeClassId, date: item.date ?? today(), recipientStudentIds: item.recipientStudentIds ?? [], status: ["草稿", "已复制", "已记录回执"].includes(item.status) ? item.status : "草稿", createdAt: item.createdAt ?? Date.now() })),
    guardians: (data.guardians ?? []).map((item) => ({ ...item, classId: item.classId ?? classByStudentId.get(item.studentId) ?? activeClassId, isPrimary: Boolean(item.isPrimary), emergencyPriority: Math.max(1, Number(item.emergencyPriority) || 2) })),
    careProfiles: (data.careProfiles ?? []).map((item) => ({ ...item, classId: item.classId ?? classByStudentId.get(item.studentId) ?? activeClassId, visibleScope: "班主任" as const, severity: ["一般", "重要", "紧急"].includes(item.severity) ? item.severity : "一般" })),
    records: (data.records ?? []).map((record) => ({ ...record, ...resolveStudentLink(record.studentId, record.student, record.classId), channel: record.channel ?? "面谈", followUp: record.followUp ?? "", status: record.status ?? "待跟进" })),
    cadres: (data.cadres ?? []).map((role) => {
      const classId = role.classId ?? classByStudentId.get(role.studentId) ?? activeClassId;
      const roleClass = rosterClasses.find(item => item.id === classId);
      const classStudents = roleClass?.students ?? (classId === activeClassId ? students : []);
      const assignedStudent = classStudents.find(student => student.id === role.studentId);
      const namedGroup = Number(role.role.match(/第?\s*(\d+)\s*组/)?.[1]);
      const isGroupRole = role.scope === "小组管理" || role.role.includes("组长") || (Number.isInteger(role.groupNumber) && Number(role.groupNumber) > 0) || (Number.isInteger(namedGroup) && namedGroup > 0);
      const groupNumber = isGroupRole ? (Number.isInteger(role.groupNumber) && Number(role.groupNumber) > 0 ? Number(role.groupNumber) : Number.isInteger(namedGroup) && namedGroup > 0 ? namedGroup : assignedStudent && Number.isInteger(assignedStudent.group) && assignedStudent.group > 0 ? assignedStudent.group : undefined) : undefined;
      const rawScore = Number(role.weeklyScore);
      return {
        ...role,
        classId,
        studentId: assignedStudent?.id ?? "",
        scope: isGroupRole ? "小组管理" : role.scope ?? "班级管理",
        groupNumber,
        term: role.term === "本学期" ? roleClass?.term || activeTermLabel || "本学期" : String(role.term ?? ""),
        status: (["在任", "试用", "轮换"] as const).includes(role.status ?? "在任") ? role.status ?? "在任" : "在任",
        weeklyScore: Number.isFinite(rawScore) ? Math.max(1, Math.min(5, Math.round(rawScore))) : 4,
        summary: String(role.summary ?? ""),
      };
    }),
    scoreExams: (data.scoreExams ?? []).map((item) => ({ ...item, classId: item.classId ?? activeClassId })),
    examReflections: (data.examReflections ?? []).map((item) => ({ ...item, classId: item.classId ?? classByStudentId.get(item.studentId) ?? activeClassId })),
    termComments: (data.termComments ?? []).map((item) => ({ ...item, classId: item.classId ?? classByStudentId.get(item.studentId) ?? activeClassId })),
    weeklyPlan: data.weeklyPlan ?? [],
    weeklyReports: (data.weeklyReports ?? []).map((report) => ({ ...report, classId: report.classId ?? activeClassId })),
    courses: activeSchedule.courses,
    scheduleConfig: activeSchedule.config,
    scheduleEvents: activeSchedule.events,
    dailyFocus: activeSchedule.focuses,
    scheduleWeeks: activeSchedule.weeks,
    seatingConfig: activeSeating,
    classSchedules,
    classSeatingConfigs,
    license: data.license ?? { tier: "基础版", canExport: true, expiresAt: "2099-12-31" },
  };
}

export function scopeWorkspaceClassSettings(previous: ClassroomData, updated: ClassroomData): ClassroomData {
  const previousClassId = previous.activeClassId ?? previous.rosterClasses?.[0]?.id ?? "class-1";
  const nextClassId = updated.activeClassId ?? previousClassId;
  const previousSchedule: ClassScheduleData = {
    config: previous.scheduleConfig,
    courses: previous.courses ?? [],
    events: previous.scheduleEvents ?? [],
    focuses: previous.dailyFocus ?? [],
    weeks: previous.scheduleWeeks ?? [],
  };
  const updatedSchedule: ClassScheduleData = {
    config: updated.scheduleConfig,
    courses: updated.courses ?? [],
    events: updated.scheduleEvents ?? [],
    focuses: updated.dailyFocus ?? [],
    weeks: updated.scheduleWeeks ?? [],
  };
  const remainingClassIds = new Set((updated.rosterClasses ?? []).map(classroom => classroom.id));
  const previousClassStillExists = remainingClassIds.has(previousClassId);
  const schedules = { ...(previous.classSchedules ?? {}), ...(updated.classSchedules ?? {}) };
  if (previousClassStillExists) schedules[previousClassId] = nextClassId === previousClassId ? updatedSchedule : previousSchedule;
  const seatings = { ...(previous.classSeatingConfigs ?? {}), ...(updated.classSeatingConfigs ?? {}) };
  if (previousClassStillExists) seatings[previousClassId] = previous.seatingConfig ?? { rows: 6, columns: 6, groupCount: 6, aisleAfter: [2, 4] };
  const previousDuty = { offset: previous.dutyOffset ?? 0, jobs: cloneDutyJobs(previous.dutyJobs?.length ? previous.dutyJobs : defaultDutyJobs) };
  const updatedDuty = { offset: updated.dutyOffset ?? 0, jobs: cloneDutyJobs(updated.dutyJobs?.length ? updated.dutyJobs : defaultDutyJobs) };
  const dutySettings = { ...(previous.classDutySettings ?? {}), ...(updated.classDutySettings ?? {}) };
  if (previousClassStillExists) dutySettings[previousClassId] = nextClassId === previousClassId ? updatedDuty : previousDuty;
  for (const classId of Object.keys(schedules)) if (!remainingClassIds.has(classId)) delete schedules[classId];
  for (const classId of Object.keys(seatings)) if (!remainingClassIds.has(classId)) delete seatings[classId];
  for (const classId of Object.keys(dutySettings)) if (!remainingClassIds.has(classId)) delete dutySettings[classId];
  if (nextClassId === previousClassId) {
    seatings[nextClassId] = updated.seatingConfig ?? seatings[nextClassId];
    dutySettings[nextClassId] = updatedDuty;
    return { ...updated, classSchedules: schedules, classSeatingConfigs: seatings, classDutySettings: dutySettings };
  }
  const targetSchedule = schedules[nextClassId] ?? (previousClassStillExists ? previousSchedule : updatedSchedule);
  const targetStudentCount = updated.rosterClasses?.find((item) => item.id === nextClassId)?.students.length ?? updated.students.length;
  const targetSeating = seatings[nextClassId] ?? normalizeSeatingConfig(undefined, targetStudentCount).config;
  schedules[nextClassId] = targetSchedule;
  if (targetSeating) seatings[nextClassId] = targetSeating;
  const targetDuty = dutySettings[nextClassId] ?? normalizeClassDutySettings({ ...updated, classDutySettings: dutySettings, dutyJobs: previousClassStillExists ? undefined : updatedDuty.jobs, dutyOffset: previousClassStillExists ? 0 : updatedDuty.offset }, nextClassId);
  dutySettings[nextClassId] = targetDuty;
  return {
    ...updated,
    courses: targetSchedule.courses,
    scheduleConfig: targetSchedule.config,
    scheduleEvents: targetSchedule.events,
    dailyFocus: targetSchedule.focuses,
    scheduleWeeks: targetSchedule.weeks,
    seatingConfig: targetSeating,
    classSchedules: schedules,
    classSeatingConfigs: seatings,
    dutyOffset: targetDuty.offset,
    dutyJobs: cloneDutyJobs(targetDuty.jobs),
    classDutySettings: dutySettings,
  };
}
