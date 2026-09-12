"use client";
import { copyTextToClipboard } from "@/lib/clipboard";
import { StudentLookupDialog } from "@/app/components/campus/StudentLookupDialog";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { lazy, Suspense } from 'react';
import { Dashboard } from '@/app/components/campus/Dashboard';
import { CampusIcon, MetricStrip, ThemeArtwork } from '@/app/components/campus/primitives';
import { DesktopHeader, SaveStatus, WorkspaceNav, workspaceModules, type LearningScene, type WorkspaceModuleId } from '@/app/components/campus/WorkspaceChrome';
import { applyHomeworkStatuses } from './features/homework/operations';
import { addGrowthEvidence, growthEvidenceForStudent } from './features/growth/operations';
import { communicationRecordsForClass, localCommunicationDate, patchCommunicationStatus, recordBelongsToClass, recordBelongsToStudent, removeCommunicationRecord, saveCommunicationRecord } from './features/records/operations';
import { examReflectionsForClass, saveExamReflection } from './features/reflections/operations';
import { appendTermCommentText, buildLocalTermCommentDraft, saveTermComment, termCommentsForClass } from './features/comments/operations';
import { saveClassScheduleWeek, saveScheduleTermConfig } from './features/schedule/operations';
import { isDatedWithin, saveWeeklyReport, weeklyActivityRows, weeklyFollowRows, weeklyHomeworkMetrics, weeklyPointEventsForClass, weeklyPositiveRows, weeklyReportsForClass } from './features/weekly/operations';
import { applyPointEvents, pointEventsForClass, undoPointEvent as undoPointEventInClass } from './features/points/operations';
import { defaultPointRules } from './features/rules/catalog';
import { deletePointRule, patchPointRule, pointRulesForData, pointRuleUsageCount, replacePointRules, upsertPointRule } from './features/rules/operations';
import { createScoreExam, editScoreExam, patchScoreExam, removeScoreExam, scoreEntry, scoreEntryCount, scoreExamsForClass, setScoreEntries, studentScoreSummary } from './features/scores/operations';
import { applyStudentBatch } from './features/students/operations';
import { createWorkspaceOperations } from './workspace/operations';
import type { Workspace, LocalWorkspaceDraft } from './workspace/types';
import { canLeaveDictation } from './dictation/navigation';
const Dictation = lazy(() => import('./dictation/Dictation'));

import { makeId, scheduleTermLabel, scheduleTermRange } from "@/lib/classroom";
import { parseWorkspaceBackup } from "@/lib/workspaceBackup";
import type { CadreRole, ClassScheduleData, ClassroomData, CommunicationRecord, DailyFocus, DutyJob, DutyRecord, ExamReflection, HomeworkTask, PointEvent, PointRule, RosterClass, ScheduleConfig, ScheduleEvent, ScheduleWeek, ScoreExam, SeatingConfig, Student, TermComment, WeeklyReport } from "@/lib/classroom";
import { Attendance } from "./Attendance";
import { ScheduleHub } from "./ScheduleHub";
import { TeacherAgenda } from "./TeacherAgenda";
import { removeStudentRelations } from "./features/students/relations";
import { StudentProfile } from "./StudentProfile";
import { HealthCare } from "./HealthCare";
import { ScoreTrends } from "./ScoreTrends";
import { ScoreItemAnalysis } from "./ScoreItemAnalysis";
import { ClassroomTools } from "./ClassroomTools";
import { NotificationDrafts } from "./NotificationDrafts";
import { WorkbenchPageHeader } from "./WorkbenchPageHeader";


type ModuleId = WorkspaceModuleId;
type ToastTone = "success" | "error" | "info";
type ToastEventDetail = { message: string; tone?: ToastTone };
type ConfirmEventDetail = { message: string; title?: string; confirmLabel?: string; onResolve: (confirmed: boolean) => void };

const ruleSets = {
  小学温和版: {
    focus: "少扣多奖，适合低中年级先建立正向习惯。",
    levels: ["小学版", "温和版"],
    rhythm: ["每天只记录关键 3-5 次", "加分理由尽量具体", "扣分后给补救机会"],
  },
  初中严格版: {
    focus: "边界清楚，适合作业、纪律和课堂秩序需要快速立规的班级。",
    levels: ["初中版", "严格版"],
    rhythm: ["严重事件直接记录", "责任人分工明确", "连续扣分转入沟通跟进"],
  },
  班级精细版: {
    focus: "按责任人和场景拆细，适合已经有班干部协作记录的班级。",
    levels: ["小学版", "初中版", "温和版", "严格版", "自定义"],
    rhythm: ["课代表记作业", "劳动委员记卫生", "班长和值日班长看常规"],
  },
};

const homeworkOrder: HomeworkTask["statuses"][string][] = ["已交", "未交", "待订正", "已复查"];
const days = ["星期一", "星期二", "星期三", "星期四", "星期五"];
const shortDays = ["周一", "周二", "周三", "周四", "周五"];
const dutyDayAliases: Record<string, string> = { 星期一: "周一", 星期二: "周二", 星期三: "周三", 星期四: "周四", 星期五: "周五", 星期六: "周六", 星期日: "周日" };
function sameDutyDay(left: string, right: string) { return (dutyDayAliases[left] ?? left) === (dutyDayAliases[right] ?? right); }
const defaultDutyJobs: DutyJob[] = [
  { id: "dj-floor", name: "地面保洁", area: "教室地面、桌椅间", standard: "无明显纸屑，桌椅摆正，放学前复查一次。", enabled: true },
  { id: "dj-board", name: "黑板讲台", area: "黑板、粉笔槽、讲台", standard: "课间擦净黑板，粉笔和教具归位。", enabled: true },
  { id: "dj-corridor", name: "走廊门窗", area: "走廊、门窗、窗台", standard: "走廊无杂物，窗台不堆放个人物品。", enabled: true },
  { id: "dj-corner", name: "卫生角", area: "扫把、拖把、垃圾桶", standard: "工具摆放整齐，垃圾桶及时清理。", enabled: true },
  { id: "dj-books", name: "图书角", area: "图书角、阅读柜", standard: "图书按类归位，破损图书单独放置。", enabled: true },
];

function notify(message: string, tone: ToastTone = "success") {
  if (typeof window === "undefined") return;
  const pendingSaveMessage = tone === "success" && /已保存/.test(message)
    ? message.replace(/已保存/g, "已更新").replace(/。/g, "") + "，正在同步"
    : message;
  const pendingSaveTone = pendingSaveMessage === message ? tone : "info";
  window.dispatchEvent(new CustomEvent<ToastEventDetail>("classroom:toast", { detail: { message: pendingSaveMessage, tone: pendingSaveTone } }));
}


function requestDangerConfirm(message: string, title = "确认删除", confirmLabel = "确认删除") {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent<ConfirmEventDetail>("classroom:confirm", {
      detail: { message, title, confirmLabel, onResolve: resolve },
    }));
  });
}

async function ensureAiConsent(workspaceToken: string) {
  if (workspaceToken === "demo") return true;
  const meResponse = await fetch("/api/auth/me", { cache: "no-store" });
  const me = await meResponse.json().catch(() => ({})) as { user?: { aiConsent?: boolean }; error?: string };
  if (!meResponse.ok) throw new Error(me.error || "请重新进入工作台");
  if (me.user?.aiConsent) return true;
  const confirmed = await requestDangerConfirm(
    "AI 编写会把当前学生姓名和你勾选的校内记录发送给 DeepSeek 生成草稿。请确认已了解数据范围，并在使用前检查生成内容。",
    "AI 数据使用说明",
    "同意并继续",
  );
  if (!confirmed) return false;
  const response = await fetch("/api/auth/ai-consent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled: true }),
  });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || "AI 设置保存失败");
  return true;
}

async function disableAiConsent() {
  const confirmed = await requestDangerConfirm("关闭后，AI 帮写不会再发送学生资料。再次使用时会重新询问。", "关闭 AI 数据授权", "确认关闭");
  if (!confirmed) return false;
  const response = await fetch("/api/auth/ai-consent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled: false }),
  });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || "AI 设置更新失败");
  notify("AI 数据授权已关闭", "success");
  return true;
}

function today() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function currentTimestamp() {
  return Date.now();
}

function defaultScheduleConfig(): ScheduleConfig {
  return {
    schoolYear: "自定义学年/学段",
    term: "自定义学期",
    termStartMonth: today().slice(0, 7),
    termEndMonth: `${today().slice(0, 4)}-12`,
    termNote: "不同地区、不同学校开学时间不同，这里由老师自己填写。",
    days: ["周一", "周二", "周三", "周四", "周五"],
    periods: [
      { label: "早读", time: "08:00-08:20" },
      { label: "第1节", time: "08:30-09:10" },
      { label: "第2节", time: "09:20-10:00" },
      { label: "第3节", time: "10:20-11:00" },
      { label: "第4节", time: "11:10-11:50" },
      { label: "午间", time: "12:00-13:30" },
      { label: "第5节", time: "14:00-14:40" },
      { label: "延时", time: "16:20-17:30" },
    ],
  };
}

function scheduleMonthIndex(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return 0;
  return year * 12 + monthNumber - 1;
}

function scheduleMonthFromIndex(index: number) {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function scheduleTermMonths(config?: ScheduleConfig) {
  const fallback = today().slice(0, 7);
  const start = config?.termStartMonth || fallback;
  const end = config?.termEndMonth || start;
  const startIndex = Math.min(scheduleMonthIndex(start), scheduleMonthIndex(end));
  const endIndex = Math.max(scheduleMonthIndex(start), scheduleMonthIndex(end));
  const length = Math.min(24, Math.max(1, endIndex - startIndex + 1));
  return Array.from({ length }, (_, index) => scheduleMonthFromIndex(startIndex + index));
}

function getScheduleWeekDates(month: string, weekOfMonth: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const safeYear = year || new Date().getFullYear();
  const safeMonth = monthNumber || new Date().getMonth() + 1;
  const start = new Date(safeYear, safeMonth - 1, 1 + (weekOfMonth - 1) * 7);
  const end = new Date(safeYear, safeMonth - 1, Math.min(new Date(safeYear, safeMonth, 0).getDate(), weekOfMonth * 7));
  return { startDate: formatScheduleDate(start), endDate: formatScheduleDate(end), label: `${safeYear}年${safeMonth}月第${weekOfMonth}周` };
}

function getScheduleWeeksInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return 4;
  return Math.ceil(new Date(year, monthNumber, 0).getDate() / 7);
}

function formatScheduleDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeMobileCourses(courses: string[][] | undefined, config: ScheduleConfig) {
  return config.days.map((_, dayIndex) => Array.from({ length: config.periods.length }, (__, periodIndex) => courses?.[dayIndex]?.[periodIndex] ?? ""));
}

function sanitizeSeatingConfig(config: SeatingConfig | undefined, studentCount: number): SeatingConfig {
  const rawColumns = Number(config?.columns);
  const columns = Math.max(2, Math.min(10, Number.isFinite(rawColumns) && rawColumns > 0 ? Math.floor(rawColumns) : 6));
  const rawRows = Number(config?.rows);
  const minRows = Math.max(1, Math.ceil(studentCount / columns));
  const rows = Math.max(minRows, Math.min(12, Number.isFinite(rawRows) && rawRows > 0 ? Math.floor(rawRows) : minRows));
  const rawGroupCount = Number(config?.groupCount);
  const groupCount = Math.max(1, Math.min(12, Number.isFinite(rawGroupCount) && rawGroupCount > 0 ? Math.floor(rawGroupCount) : Math.max(1, Math.ceil(columns / 2))));
  const aisleAfter = (config?.aisleAfter ?? [2, 4]).map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0 && item < columns);
  return { rows, columns, groupCount, aisleAfter: Array.from(new Set(aisleAfter)) };
}

function normalizeData(data: ClassroomData): ClassroomData {
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
  const rows = Math.max(1, Math.min(12, Math.max(data.seatingConfig?.rows ?? 6, Math.ceil(students.length / columns))));
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
    homeworkTasks: data.homeworkTasks?.length ? data.homeworkTasks.map((task) => ({ ...task, classId: task.classId ?? rosterClasses[0].id, followUpStudentIds: task.followUpStudentIds ?? [] })) : [firstTask],
    pointEvents: (data.pointEvents ?? []).map((event) => ({ ...event, classId: event.classId ?? classByStudentId.get(event.studentId) ?? activeClassId })),
    growthEvidence: (data.growthEvidence ?? []).map((item) => ({ ...item, classId: item.classId ?? classByStudentId.get(item.studentId) ?? activeClassId })),
    pointRules: pointRulesForData(data).map((rule) => ({ ...rule, enabled: rule.enabled !== false })),
    dutyJobs: data.dutyJobs?.length ? data.dutyJobs.map((job) => ({ ...job, enabled: job.enabled !== false })) : defaultDutyJobs,
    dutyRecords: data.dutyRecords ?? [],
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
    cadres: data.cadres?.length ? data.cadres.map((role) => ({ ...role, classId: role.classId ?? classByStudentId.get(role.studentId) ?? activeClassId, scope: role.scope ?? "班级管理", term: role.term && role.term !== "本学期" ? role.term : activeTermLabel || "本学期", status: role.status ?? "在任", weeklyScore: role.weeklyScore ?? 4, summary: role.summary ?? "填写本周履职表现。" })) : [
      { id: "c1", classId: activeClassId, role: "班长", studentId: students[0]?.id ?? "", duty: "协助班主任管理班级常规。", scope: "班级常规", term: activeTermLabel || "本学期", status: "在任", weeklyScore: 5, summary: "能主动提醒同学，适合继续培养组织能力。" },
      { id: "c2", classId: activeClassId, role: "学习委员", studentId: students[1]?.id ?? "", duty: "组织早读，记录作业缺交。", scope: "学习管理", term: activeTermLabel || "本学期", status: "在任", weeklyScore: 4, summary: "作业反馈及时，早读组织还可以更大胆。" },
      { id: "c3", classId: activeClassId, role: "劳动委员", studentId: students[2]?.id ?? "", duty: "安排和检查卫生岗位。", scope: "卫生值日", term: activeTermLabel || "本学期", status: "在任", weeklyScore: 5, summary: "检查细致，能把值日问题及时反馈给老师。" },
    ],
    scoreExams: (data.scoreExams ?? []).map((item) => ({ ...item, classId: item.classId ?? activeClassId })),
    examReflections: (data.examReflections ?? []).map((item) => ({ ...item, classId: item.classId ?? classByStudentId.get(item.studentId) ?? activeClassId })),
    termComments: (data.termComments ?? []).map((item) => ({ ...item, classId: item.classId ?? classByStudentId.get(item.studentId) ?? activeClassId })),
    weeklyPlan: data.weeklyPlan ?? days.map((day) => ({ day: day.replace("星期", "周"), focus: "班级常规", event: "记录作业、积分、沟通事项" })),
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

function scopeClassSettings(previous: ClassroomData, updated: ClassroomData): ClassroomData {
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
  const schedules = { ...(previous.classSchedules ?? {}), [previousClassId]: nextClassId === previousClassId ? updatedSchedule : previousSchedule };
  const seatings = { ...(previous.classSeatingConfigs ?? {}), [previousClassId]: previous.seatingConfig ?? { rows: 6, columns: 6, groupCount: 6, aisleAfter: [2, 4] } };
  if (nextClassId === previousClassId) {
    seatings[nextClassId] = updated.seatingConfig ?? seatings[nextClassId];
    return { ...updated, classSchedules: schedules, classSeatingConfigs: seatings };
  }
  const targetSchedule = schedules[nextClassId] ?? previousSchedule;
  const targetSeating = seatings[nextClassId] ?? previous.seatingConfig;
  schedules[nextClassId] = targetSchedule;
  if (targetSeating) seatings[nextClassId] = targetSeating;
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
  };
}


function updateClassStudents(data: ClassroomData, classId: string, updater: (student: Student) => Student): ClassroomData {
  const students = data.students.map(updater);
  return {
    ...data,
    students,
    rosterClasses: data.rosterClasses?.map((classroom) => classroom.id === classId
      ? { ...classroom, students: classroom.students.map(updater) }
      : classroom),
  };
}

export default function ClassroomApp({ token }: { token: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [active, setActive] = useState<ModuleId>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveConflict, setSaveConflict] = useState(false);
  const [toast, setToast] = useState<ToastEventDetail | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmEventDetail | null>(null);
  const [desktopAccount, setDesktopAccount] = useState<{ phone: string; expiresAt: string } | null>(null);
  const [learningScene, setLearningScene] = useState<LearningScene>('class');
  const workspaceRef = useRef<Workspace | null>(null);
  const revisionRef = useRef(0);
  const serverRevisionRef = useRef(1);
  const dirtyRef = useRef(false);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const pendingDictationDraftRef = useRef<ClassroomData | null>(null);
  const saveQueuedRef = useRef(false);
  const saveConflictRef = useRef(false);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const isDemo = token === "demo";
  const isReadOnly = workspace?.accessMode === "readonly";

  useEffect(() => {
    fetch(`/api/workspace/${token}`).then(async (res) => {
      const body = await res.json() as { workspace?: Workspace; error?: string };
      if (res.status === 401) {
        window.location.assign("/?enter=1");
        return;
      }
      if (!res.ok || !body.workspace) throw new Error(body.error || "链接读取失败");
      const serverRevision = Number(body.workspace.revision ?? 1);
      const draftKey = `classroom-workspace-draft:${token}`;
      let recoveredDraft: LocalWorkspaceDraft | null = null;
      try {
        const stored = window.localStorage.getItem(draftKey);
        if (stored) recoveredDraft = JSON.parse(stored) as LocalWorkspaceDraft;
      } catch {
        recoveredDraft = null;
      }
      const recoveredData = recoveredDraft?.revision === serverRevision ? recoveredDraft.data : undefined;
      const canRecover = Boolean(recoveredData);
      const nextWorkspace = { ...body.workspace, revision: serverRevision, data: normalizeData(recoveredData ?? body.workspace.data) };
      serverRevisionRef.current = serverRevision;
      workspaceRef.current = nextWorkspace;
      setWorkspace(nextWorkspace);
      if (canRecover) {
        dirtyRef.current = true;
        revisionRef.current += 1;
        setDirty(true);
        notify("已恢复上次未成功同步的本机草稿", "info");
      } else if (recoveredDraft?.data) {
        notify("检测到较旧的本机草稿，已保留在浏览器中，可从完整备份恢复", "info");
      }
    }).catch((err) => setError(err instanceof Error ? err.message : "链接读取失败")).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);

  useEffect(() => {
    function syncPageFromUrl() {
      const page = new URLSearchParams(window.location.search).get("page");
      if (page && workspaceModules.some((item) => item.id === page)) setActive(page as ModuleId);
    }
    syncPageFromUrl();
    window.addEventListener("popstate", syncPageFromUrl);
    return () => window.removeEventListener("popstate", syncPageFromUrl);
  }, []);

  useEffect(() => {
    function handleToast(event: Event) {
      const detail = (event as CustomEvent<ToastEventDetail>).detail;
      setToast(detail);
      window.setTimeout(() => setToast((current) => current === detail ? null : current), 2400);
    }
    function handleConfirm(event: Event) {
      setConfirmRequest((event as CustomEvent<ConfirmEventDetail>).detail);
    }
    window.addEventListener("classroom:toast", handleToast);
    window.addEventListener("classroom:confirm", handleConfirm);
    return () => {
      window.removeEventListener("classroom:toast", handleToast);
      window.removeEventListener("classroom:confirm", handleConfirm);
    };
  }, []);

  function openModule(id: ModuleId) {
    if (!canLeaveDictation()) return;
    setActive(id);
    const url = new URL(window.location.href);
    url.searchParams.set("page", id);
    window.history.replaceState({}, "", url);
  }

  function workspaceOperations() { return createWorkspaceOperations({
    token, isDemo, isReadOnly, workspaceRef, revisionRef, serverRevisionRef, dirtyRef,
    saveInFlightRef, pendingDictationDraftRef, saveQueuedRef, saveConflictRef,
    setWorkspace, setDirty, setSaving, setError, setSaveConflict, notify, normalizeData, scopeClassSettings,
  }); }
  function updateData(updater: (data: ClassroomData) => ClassroomData) { workspaceOperations().updateData(updater); }
  function save() { return workspaceOperations().save(); }
  function commitWorkspace(updater: (data: ClassroomData) => ClassroomData) { return workspaceOperations().commitWorkspace(updater); }

  async function loadLatestWorkspace() {
    try {
      const response = await fetch(`/api/workspace/${token}`, { cache: "no-store" });
      const body = await response.json() as { workspace?: Workspace; error?: string };
      if (!response.ok || !body.workspace) throw new Error(body.error || "无法读取服务器最新版本");
      const serverRevision = Number(body.workspace.revision ?? 1);
      const latest = { ...body.workspace, revision: serverRevision, data: normalizeData(body.workspace.data) };
      serverRevisionRef.current = serverRevision;
      revisionRef.current = 0;
      saveConflictRef.current = false;
      setSaveConflict(false);
      pendingDictationDraftRef.current = null;
      dirtyRef.current = false;
      workspaceRef.current = latest;
      setWorkspace(latest);
      setDirty(false);
      setError("");
      notify("已载入服务器最新版本，本机冲突草稿仍保留在浏览器中", "success");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "无法读取服务器最新版本");
    }
  }

  useEffect(() => {
    if (!dirty || isDemo || isReadOnly) return;
    const timer = window.setTimeout(() => { void save(); }, 900);
    return () => window.clearTimeout(timer);
    // Autosave intentionally restarts for every local data revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, workspace?.data, isDemo, isReadOnly]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const syncShellAccessibility = () => {
      const mobile = media.matches;
      const mobileShell = document.querySelector<HTMLElement>(".mobile-workbench");
      const desktopShell = document.querySelector<HTMLElement>(".campus-workspace-main");
      for (const [element, hidden] of [[mobileShell, !mobile], [desktopShell, mobile && active !== "dictation"]] as const) {
        if (!element) continue;
        element.setAttribute("aria-hidden", String(hidden));
        element.toggleAttribute("inert", hidden);
      }
    };
    syncShellAccessibility();
    media.addEventListener("change", syncShellAccessibility);
    return () => media.removeEventListener("change", syncShellAccessibility);
  }, [loading, active]);

  async function openDesktopAccount() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const body = await response.json() as { user?: { phone?: string }; workspace?: { expiresAt?: string }; error?: string };
      if (!response.ok) throw new Error(body.error || "账户信息读取失败");
      setDesktopAccount({ phone: body.user?.phone ?? "—", expiresAt: body.workspace?.expiresAt ?? "" });
    } catch (accountError) {
      notify(accountError instanceof Error ? accountError.message : "账户信息读取失败", "error");
    }
  }

  function exportWorkspaceBackup() {
    const current = workspaceRef.current;
    if (!current) return;
    const backup = {
      format: "classroom-workspace-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      workspace: { className: current.className, grade: current.grade, term: current.term },
      data: pendingDictationDraftRef.current ?? current.data,
    };
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `班主任工作台完整备份-${today()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify("完整备份已导出", "success");
  }

  async function importWorkspaceBackup(file?: File) {
    if (!file) return;
    try {
      const { backup, preview } = parseWorkspaceBackup(await file.text(), file.size);
      const currentStudents = workspaceRef.current?.data.students.length ?? 0;
      const confirmed = await requestDangerConfirm(`备份来源：${preview.source}（${preview.exportedAt}）。将恢复 ${preview.classes} 个班级、${preview.students} 名学生、${preview.records} 条沟通记录、${preview.exams} 场考试、${preview.dictationTasks} 次听写、${preview.familyChildren} 个家庭孩子；当前工作台的 ${currentStudents} 名学生及全部数据会被替换。当前内容会先保留在本机草稿中。`, "预检通过：恢复完整备份", "确认替换并同步");
      if (!confirmed) return;
      updateData(() => normalizeData(backup.data));
      notify("备份已载入，正在同步", "info");
    } catch (backupError) {
      notify(backupError instanceof Error ? backupError.message : "备份读取失败", "error");
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  }

  if (loading) return <div className="app-state"><div className="loader"></div><h2>正在打开班主任工作台</h2><p>正在读取班级资料…</p></div>;
  if (error && !workspace) return <div className="app-state error-state"><span>!</span><h2>暂时不能打开这个班级</h2><p>{error}</p><Link href="/">返回首页</Link></div>;
  if (!workspace) return null;
  const loadedWorkspace = workspace;

  const classes = loadedWorkspace.data.rosterClasses?.length ? loadedWorkspace.data.rosterClasses : [{ id: "class-1", name: "当前班级", grade: "", term: loadedWorkspace.term, students: loadedWorkspace.data.students }];
  const activeClassId = workspace.data.activeClassId ?? classes[0].id;
  const activeClass = classes.find((item) => item.id === activeClassId) ?? classes[0];
  function switchGlobalClass(id: string) {
    if (!canLeaveDictation()) return;
    const nextClass = classes.find((item) => item.id === id);
    if (!nextClass || id === activeClassId) return;
    updateData((current) => ({ ...current, activeClassId: id, students: nextClass.students }));
  }

  function patchActiveClass(patch: Partial<RosterClass>) {
    updateData((current) => {
      const currentClasses = current.rosterClasses?.length ? current.rosterClasses : classes;
      const rosterClasses = currentClasses.map((item) => item.id === activeClassId ? { ...item, ...patch } : item);
      const nextClass = rosterClasses.find((item) => item.id === activeClassId) ?? rosterClasses[0];
      return { ...current, rosterClasses, activeClassId: nextClass.id, students: nextClass.students };
    });
  }

  function addGlobalClass() {
    const id = `class-${Date.now()}`;
    const newClass: RosterClass = { id, name: `新班级${classes.length + 1}`, grade: "", term: activeClass?.term ?? loadedWorkspace.term, students: [] };
    updateData((current) => ({ ...current, rosterClasses: [...classes, newClass], activeClassId: id, students: [] }));
  }

  async function deleteActiveClass() {
    if (classes.length <= 1) return;
    const confirmed = await requestDangerConfirm(`${activeClass.name} 的学生名单、作业、考试、周报和相关学生记录会一起移除。`);
    if (!confirmed) return;
    const removedStudentIds = new Set(activeClass.students.map((student) => student.id));
    const removedExamIds = new Set((loadedWorkspace.data.scoreExams ?? []).filter((exam) => exam.classId === activeClassId).map((exam) => exam.id));
    const nextClasses = classes.filter((item) => item.id !== activeClassId);
    const nextActive = nextClasses[0];
    updateData((current) => {
      const cleaned = removeStudentRelations(current, removedStudentIds, activeClassId);
      return {
        ...cleaned,
        activeClassId: nextActive.id,
        rosterClasses: nextClasses,
        students: nextActive.students,
        dictation: cleaned.dictation ? { ...cleaned.dictation, tasks: cleaned.dictation.tasks.filter(t => t.context.kind !== "class" || t.context.classId !== activeClassId) } : undefined,
        homeworkTasks: cleaned.homeworkTasks?.filter((task) => task.classId !== activeClassId),
        scoreExams: cleaned.scoreExams?.filter((exam) => exam.classId !== activeClassId),
        weeklyReports: cleaned.weeklyReports?.filter((report) => report.classId !== activeClassId),
        dutyRecords: cleaned.dutyRecords?.filter((record) => record.classId !== activeClassId),
        classroomToolSessions: cleaned.classroomToolSessions?.filter((item) => item.classId !== activeClassId),
        notificationDrafts: cleaned.notificationDrafts?.filter((item) => item.classId !== activeClassId),
        guardians: cleaned.guardians?.filter((item) => item.classId !== activeClassId),
        careProfiles: cleaned.careProfiles?.filter((item) => item.classId !== activeClassId),
        teacherAgenda: cleaned.teacherAgenda?.filter((item) => item.classId !== activeClassId),
        workLogs: cleaned.workLogs?.filter((item) => item.classId !== activeClassId),
        examReflections: cleaned.examReflections?.filter((item) => !item.examId || !removedExamIds.has(item.examId)),
      };
    });
  }

  function resolveConfirm(confirmed: boolean) {
    confirmRequest?.onResolve(confirmed);
    setConfirmRequest(null);
  }

  function switchLearningScene(scene: LearningScene) {
    if (!canLeaveDictation()) return;
    setLearningScene(scene);
    if (scene === 'family' && active !== 'dictation') openModule('dictation');
  }

  return (
    <div className="app-shell homework-bootstrap-shell campus-workspace-shell" data-module={active} data-theme="campus">
      <MobileWorkbench
        workspaceToken={token}
        workspace={workspace}
        classes={classes}
        activeClass={activeClass}
        active={active}
        saving={saving}
        dirty={dirty}
        error={error}
        openModule={openModule}
        update={updateData}
        switchClass={switchGlobalClass}
        patchClass={patchActiveClass}
        addClass={addGlobalClass}
        deleteClass={deleteActiveClass}
        save={save}
        clearError={() => setError("")}
        isDemo={isDemo}
        isReadOnly={isReadOnly}
        exportBackup={exportWorkspaceBackup}
        importBackup={() => backupInputRef.current?.click()}
        saveConflict={saveConflict}
        exportDraft={exportWorkspaceBackup}
        loadLatest={loadLatestWorkspace}
        learningScene={learningScene}
        switchLearningScene={switchLearningScene}
      />
      <DesktopHeader classes={classes} activeClass={activeClass} scene={learningScene} onSwitchClass={switchGlobalClass} onScene={switchLearningScene} onAccount={openDesktopAccount} saving={saving} dirty={dirty} error={error} isDemo={isDemo} isReadOnly={isReadOnly}/>
      <WorkspaceNav active={active} classes={classes} activeClass={activeClass} isDemo={isDemo} onOpen={openModule} onSwitch={switchGlobalClass} onPatch={patchActiveClass} onAdd={addGlobalClass} onDelete={deleteActiveClass} onAccount={openDesktopAccount} onExport={exportWorkspaceBackup} onImport={() => backupInputRef.current?.click()}/>
      <main className="campus-workspace-main">
        {error && workspace && <div className="inline-alert" role="alert"><span>{error}</span><div>{saveConflict ? <><button type="button" onClick={exportWorkspaceBackup}>导出当前草稿</button><button type="button" onClick={() => void loadLatestWorkspace()}>载入最新版本</button></> : error.includes("请在听写页面重试保存") ? <span>请使用听写表单中的重试操作</span> : <button type="button" disabled={saving} onClick={() => void save()}>{saving ? "正在重试…" : "重试"}</button>}<button type="button" onClick={() => setError("")}>关闭</button></div></div>}
        {(isDemo || isReadOnly) && <div className="edit-mode-banner"><b>{isDemo ? "演示模式" : "只读宽限期"}</b><span>{isDemo ? "数据不会保存，AI 使用静态示例。" : "可以查看和导出，续期后恢复编辑。"}</span></div>}
        <div className="campus-workspace-content" data-family={active === 'dashboard' ? 'dashboard' : ['students','growth','points','health','records'].includes(active) ? 'student' : ['homework','dictation','attendance'].includes(active) ? 'task' : ['scores','reflection','schedule','tools'].includes(active) ? 'teaching' : 'class'}>
          {active === "dictation" && <Suspense fallback={<p role="status">正在加载听写…</p>}><Dictation key={workspace.data.activeClassId} data={workspace.data} token={token} readOnly={isDemo || isReadOnly} commit={commitWorkspace} scene={learningScene} onSceneChange={setLearningScene}/></Suspense>}
          {active === "dashboard" && <Dashboard defaultDutyJobs={defaultDutyJobs} data={workspace.data} open={openModule} openFamily={() => switchLearningScene('family')} />}
          {active === "students" && <Students data={workspace.data} update={updateData} />}
          {active === "attendance" && <Attendance data={workspace.data} update={updateData} />}
          {active === "homework" && <Homework data={workspace.data} update={updateData} />}
          {active === "points" && <Points data={workspace.data} update={updateData} />}
          {active === "rules" && <Rules data={workspace.data} update={updateData} />}
          {active === "growth" && <Growth data={workspace.data} update={updateData} />}
          {active === "health" && <HealthCare data={workspace.data} update={updateData} />}
          {active === "weekly" && <Weekly data={workspace.data} update={updateData} readOnly={isDemo || isReadOnly} />}
          {active === "schedule" && <ScheduleHub data={workspace.data} update={updateData} readOnly={isDemo || isReadOnly} />}
          {active === "tools" && <ClassroomTools data={workspace.data} update={updateData} />}
          {active === "seating" && <Seating data={workspace.data} update={updateData} />}
          {active === "duty" && <Duty data={workspace.data} update={updateData} />}
          {active === "cadres" && <Cadres data={workspace.data} update={updateData} />}
          {active === "records" && <Records data={workspace.data} update={updateData} />}
          {active === "scores" && <Scores workspaceToken={token} data={workspace.data} update={updateData} />}
          {active === "reflection" && <Reflection data={workspace.data} update={updateData} open={openModule} readOnly={isDemo || isReadOnly} />}
          {active === "comments" && <Comments workspaceToken={token} data={workspace.data} update={updateData} readOnly={isDemo || isReadOnly} />}
        </div>
      </main>
      {toast && <div className={`workbench-toast ${toast.tone ?? "success"}`} role="status">{toast.message}</div>}
      {confirmRequest && <div className="workbench-confirm-backdrop" role="presentation" onMouseDown={() => resolveConfirm(false)}>
        <section className="workbench-confirm" role="dialog" aria-modal="true" aria-labelledby="workbench-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
          <header><span>危险操作</span><h2 id="workbench-confirm-title">{confirmRequest.title ?? "确认删除"}</h2></header>
          <p>{confirmRequest.message}</p>
          <footer><button onClick={() => resolveConfirm(false)}>取消</button><button className="danger" onClick={() => resolveConfirm(true)}>{confirmRequest.confirmLabel ?? "确认删除"}</button></footer>
        </section>
      </div>}
      {desktopAccount && <AccountDialog account={desktopAccount} onClose={() => setDesktopAccount(null)} />}
      <input ref={backupInputRef} className="visually-hidden" type="file" accept="application/json,.json" aria-label="选择工作台备份文件" onChange={(event) => void importWorkspaceBackup(event.target.files?.[0])} />
    </div>
  );
}

function MobileWorkbench({ workspaceToken, workspace, classes, activeClass, active, saving, dirty, error, openModule, update, switchClass, patchClass, addClass, deleteClass, save, clearError, isDemo, isReadOnly, exportBackup, importBackup, saveConflict, exportDraft, loadLatest, learningScene, switchLearningScene }: { workspaceToken: string; workspace: Workspace; classes: RosterClass[]; activeClass: RosterClass; active: ModuleId; saving: boolean; dirty: boolean; error: string; openModule: (id: ModuleId) => void; update: (fn: (d: ClassroomData) => ClassroomData) => void; switchClass: (id: string) => void; patchClass: (patch: Partial<RosterClass>) => void; addClass: () => void; deleteClass: () => void; save: () => void; clearError: () => void; isDemo: boolean; isReadOnly: boolean; exportBackup: () => void; importBackup: () => void; saveConflict: boolean; exportDraft: () => void; loadLatest: () => Promise<void>; learningScene: LearningScene; switchLearningScene: (scene: LearningScene) => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [account, setAccount] = useState<{ phone: string; expiresAt: string } | null>(null);
  const data = workspace.data;
  const classStudents = activeClass.students?.length ? activeClass.students : data.students;
  const activeLabel = workspaceModules.find((item) => item.id === active)?.label ?? "工作台";
  const primaryTabs: { id: ModuleId; label: string }[] = [
    { id: "dashboard", label: "首页" },
    { id: "students", label: "学生" },
    { id: "homework", label: "作业" },
    { id: "scores", label: "成绩" },
  ];
  const isPrimary = primaryTabs.some((item) => item.id === active);

  useEffect(() => {
    document.querySelector(".mobile-screen")?.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [active]);

  function openFromMore(id: ModuleId) {
    setMoreOpen(false);
    openModule(id);
    window.setTimeout(() => document.querySelector(".mobile-screen")?.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }

  async function openAccount() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const body = await response.json() as { user?: { phone?: string }; workspace?: { expiresAt?: string }; error?: string };
      if (!response.ok) throw new Error(body.error || "账户信息读取失败");
      setAccount({ phone: body.user?.phone ?? "—", expiresAt: body.workspace?.expiresAt ?? "" });
      setMoreOpen(false);
      setAccountOpen(true);
    } catch (accountError) {
      notify(accountError instanceof Error ? accountError.message : "账户信息读取失败", "error");
    }
  }

  return <section className="mobile-workbench" data-module={active} aria-label="手机版班主任工作台">
    <header className={`mobile-appbar ${active === 'dashboard' ? 'mobile-appbar-home' : ''}`}>
      <div className="mobile-appbar-brand"><span aria-hidden="true"><CampusIcon name={active === 'dashboard' ? 'book' : active}/></span><div><h1>{active === 'dashboard' ? '班主任工作台' : activeLabel}</h1>{active !== 'dictation' && <p>{activeClass.grade || workspace.grade || '当前班级'} · {classStudents.length}人</p>}</div></div>
      <SaveStatus saving={saving} dirty={dirty} error={error} isDemo={isDemo} isReadOnly={isReadOnly}/>
      {active === 'dashboard' && <><label className="mobile-class-select"><span>当前班级</span><select value={activeClass.id} onChange={event => switchClass(event.target.value)}>{classes.map(item => <option key={item.id} value={item.id}>{item.name}（{item.students.length}人）</option>)}</select></label><nav className="mobile-domain-switch" aria-label="工作场景"><button type="button" aria-pressed={learningScene === 'class'} onClick={() => switchLearningScene('class')}>班级教学</button><button type="button" aria-pressed={learningScene === 'family'} onClick={() => switchLearningScene('family')}>家庭学习</button></nav></>}
    </header>
    {(isDemo || isReadOnly) && <div className="mobile-access-note"><b>{isDemo ? "演示模式" : "只读宽限期"}</b><span>{isDemo ? "数据不会保存，AI 使用静态示例" : "可以查看和导出，续期后恢复编辑"}</span></div>}
    {error && <div className="mobile-inline-alert" role="alert"><span>{error}</span><div>{saveConflict ? <><button type="button" onClick={exportDraft}>导出草稿</button><button type="button" onClick={() => void loadLatest()}>载入最新</button></> : <button type="button" disabled={saving} onClick={() => void save()}>{saving ? "重试中…" : "重试"}</button>}<button type="button" onClick={clearError}>关闭</button></div></div>}
    <main className="mobile-screen">
      {active === "dashboard" && <MobileHome data={data} classes={classes} activeClass={activeClass} open={openModule} openFamily={() => switchLearningScene('family')} switchClass={switchClass} patchClass={patchClass} addClass={addClass} deleteClass={deleteClass} />}
      {active === "students" && <MobileStudents data={data} activeClass={activeClass} update={update} />}
      {active === "attendance" && <Attendance data={data} update={update} mobile />}
      {active === "homework" && <MobileHomework data={data} activeClass={activeClass} update={update} open={openModule} />}
      {active === "scores" && <MobileScores workspaceToken={workspaceToken} data={data} activeClass={activeClass} update={update} open={openModule} />}
      {active === "health" && <HealthCare data={data} update={update} mobile />}
      {!isPrimary && active !== "attendance" && active !== "health" && active !== "dictation" && <MobileSecondaryPage workspaceToken={workspaceToken} active={active} data={data} activeClass={activeClass} update={update} open={openModule} readOnly={isDemo || isReadOnly} />}
    </main>
    <nav className="mobile-tabbar" aria-label="手机底部导航">
      {primaryTabs.map((item) => <button type="button" data-module={item.id} key={item.id} className={active === item.id ? "active" : ""} onClick={() => openModule(item.id)}><i aria-hidden="true"><CampusIcon name={item.id}/></i><span>{item.label}</span></button>)}
      <button type="button" data-module="more" className={!isPrimary ? "active" : ""} onClick={() => setMoreOpen(true)}><i aria-hidden="true"><CampusIcon name="more"/></i><span>更多</span></button>
    </nav>
    {moreOpen && <div className="mobile-sheet-backdrop" role="presentation" onMouseDown={() => setMoreOpen(false)}>
      <section className="mobile-bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span>全部工具</span><h2 id="mobile-more-title">选择要处理的事项</h2></div><button type="button" onClick={() => setMoreOpen(false)}>关闭</button></header>
        <MobileMore current={active} open={openFromMore} />
        {!isDemo && <div className="mobile-account-actions"><button type="button" onClick={openAccount}>我的工作台</button><button type="button" onClick={() => { setMoreOpen(false); exportBackup(); }}>导出完整备份</button><button type="button" onClick={() => { setMoreOpen(false); importBackup(); }}>恢复备份</button></div>}
      </section>
    </div>}
    {accountOpen && account && <MobileInfoSheet title="我的工作台" onClose={() => setAccountOpen(false)}><dl className="mobile-account-brief"><div><dt>手机号</dt><dd>{account.phone}</dd></div><div><dt>使用期限</dt><dd>{account.expiresAt ? new Date(account.expiresAt).toLocaleDateString("zh-CN") : "—"}</dd></div></dl></MobileInfoSheet>}
  </section>;
}


function MobileHome({ data, classes, activeClass, open, openFamily, switchClass, patchClass, addClass, deleteClass }: { data: ClassroomData; classes: RosterClass[]; activeClass: RosterClass; open: (id: ModuleId) => void; openFamily: () => void; switchClass: (id: string) => void; patchClass: (patch: Partial<RosterClass>) => void; addClass: () => void; deleteClass: () => void }) {
  const [classSheetOpen, setClassSheetOpen] = useState(false);
  return <div className="campus-mobile-home"><Dashboard data={data} open={open} openFamily={openFamily} defaultDutyJobs={defaultDutyJobs}/><button className="mobile-class-manage" type="button" onClick={() => setClassSheetOpen(true)}><CampusIcon name="rules"/>管理班级资料</button>
    {classSheetOpen && <MobileInfoSheet title="班级管理" onClose={() => setClassSheetOpen(false)}>
      <div className="mobile-form-grid">
        <label className="wide"><span>当前班级</span><select value={activeClass.id} onChange={(event) => switchClass(event.target.value)}>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}（{item.students.length}人）</option>)}</select></label>
        <label><span>班级名称</span><input value={activeClass.name} onChange={(event) => patchClass({ name: event.target.value })} placeholder="例如：三年级2班" /></label>
        <label><span>年级</span><input value={activeClass.grade} onChange={(event) => patchClass({ grade: event.target.value })} placeholder="例如：三年级" /></label>
        <label className="wide"><span>学期</span><input value={activeClass.term} onChange={(event) => patchClass({ term: event.target.value })} placeholder="例如：2026-2027学年第一学期" /></label>
      </div>
      <div className="mobile-sheet-actions"><button type="button" onClick={addClass}>新建班级</button><button type="button" disabled={classes.length <= 1} onClick={deleteClass}>删除当前</button></div>
    </MobileInfoSheet>}
  </div>;
}

function MobileStudents({ data, activeClass, update }: { data: ClassroomData; activeClass: RosterClass; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [editId, setEditId] = useState("");
  const [profileStudentId, setProfileStudentId] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchDraft, setBatchDraft] = useState<{ group: string; gender: Student["gender"] | "不修改"; note: string }>({ group: "", gender: "不修改", note: "" });
  const [groupFilter, setGroupFilter] = useState("全部小组");
  const [studentPage, setStudentPage] = useState(1);
  const students = activeClass.students?.length ? activeClass.students : data.students;
  const editing = editId === "__new__" ? null : students.find((student) => student.id === editId);
  const [draftStudent, setDraftStudent] = useState<Student | null>(null);
  const normalizedQuery = query.trim();
  const groupOptions = Array.from(new Set(students.map((student) => student.group))).sort((a, b) => a - b);
  const filtered = students.filter((student) => {
    if (groupFilter !== "全部小组" && student.group !== Number(groupFilter)) return false;
    if (!normalizedQuery) return true;
    return `${student.name}${student.studentNo ?? ""}${student.group}${student.seat}${student.parentPhone ?? ""}`.includes(normalizedQuery);
  });
  const studentPageSize = 12;
  const studentPageCount = Math.max(1, Math.ceil(filtered.length / studentPageSize));
  const safeStudentPage = Math.min(studentPage, studentPageCount);
  const pagedStudents = filtered.slice((safeStudentPage - 1) * studentPageSize, safeStudentPage * studentPageSize);
  const selected = students.find((student) => student.id === selectedId);
  const filteredIds = filtered.map((student) => student.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedStudentIds.includes(id));
  useEffect(() => {
    const ids = new Set(students.map((student) => student.id));
    setSelectedStudentIds((current) => current.filter((id) => ids.has(id)));
  }, [students]);
  useEffect(() => {
    if (editId === "__new__") {
      const nextIndex = students.length;
      setDraftStudent({
        id: `s${Date.now()}-${nextIndex}`,
        studentNo: `${nextIndex + 1}`.padStart(2, "0"),
        name: "新同学",
        gender: nextIndex % 2 === 0 ? "女" : "男",
        group: Math.floor(nextIndex / 4) + 1,
        seat: nextIndex + 1,
        points: 60,
        homework: "已交",
        attendance: "正常",
        score: 85,
        parentPhone: "",
        note: "",
        avoidWith: "",
        seatNeed: "无",
        seatFixed: false,
        groupLeader: false,
      });
      return;
    }
    setDraftStudent(editing ? { ...editing } : null);
  }, [editId, editing, students.length]);
  function syncStudents(current: ClassroomData, nextStudents: Student[]) {
    const currentClasses = current.rosterClasses?.length ? current.rosterClasses : [{ id: activeClass.id, name: activeClass.name, grade: activeClass.grade, term: activeClass.term, students: current.students }];
    return {
      ...current,
      students: nextStudents,
      rosterClasses: currentClasses.map((item) => item.id === activeClass.id ? { ...item, students: nextStudents } : item),
    };
  }
  function makeStudentFromRow(row: string, index: number, baseIndex: number): Student {
    const parts = row.split(/[\s,，、\t]+/).filter(Boolean);
    const name = parts[0] ?? `学生${baseIndex + index + 1}`;
    return {
      id: `s${Date.now()}-${baseIndex}-${index}`,
      studentNo: `${baseIndex + index + 1}`.padStart(2, "0"),
      name,
      gender: index % 2 === 0 ? "女" : "男",
      group: Math.floor((baseIndex + index) / 4) + 1,
      seat: baseIndex + index + 1,
      points: 60,
      homework: "已交",
      attendance: "正常",
      score: 85,
      parentPhone: parts.find((part) => /^1\d{10}$/.test(part)) ?? "",
      note: parts.filter((part, partIndex) => partIndex > 0 && !/^1\d{10}$/.test(part)).join(" "),
      avoidWith: "",
      seatNeed: "无",
      seatFixed: false,
      groupLeader: false,
    };
  }
  function saveStudentDraft() {
    if (!draftStudent || !draftStudent.name.trim()) {
      notify("请先填写学生姓名", "error");
      return;
    }
    const phone = (draftStudent.parentPhone ?? "").replace(/[\s-]/g, "");
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      notify("家长电话需要填写 11 位手机号，或留空", "error");
      return;
    }
    const nextStudent = { ...draftStudent, name: draftStudent.name.trim(), parentPhone: phone, group: Math.max(1, Number(draftStudent.group) || 1), seat: Math.max(1, Number(draftStudent.seat) || 1), points: Number(draftStudent.points) || 0, score: Math.max(0, Math.min(100, Number(draftStudent.score) || 0)) };
    update((current) => {
      const exists = students.some((student) => student.id === nextStudent.id);
      const nextStudents = exists ? students.map((student) => student.id === nextStudent.id ? nextStudent : student) : [...students, nextStudent];
      return {
        ...syncStudents(current, nextStudents),
        homeworkTasks: current.homeworkTasks?.map((task) => task.classId === activeClass.id ? { ...task, statuses: { ...task.statuses, [nextStudent.id]: task.statuses[nextStudent.id] ?? "已交" } } : task),
      };
    });
    setEditId("");
    notify("学生资料已更新", "success");
  }
  async function deleteStudent(id: string) {
    const target = students.find((student) => student.id === id);
    if (target && !await requestDangerConfirm(`${target.name} 的作业状态、积分记录和班干部岗位会同步清理。`)) return;
    update((current) => syncStudents(
      removeStudentRelations(current, [id], activeClass.id),
      students.filter((student) => student.id !== id).map((student, index) => ({ ...student, seat: index + 1, group: Math.floor(index / 4) + 1 })),
    ));
    setEditId("");
    setSelectedId("");
    notify("学生已删除", "success");
  }
  function appendBulkStudents() {
    const rows = bulkText.split(/\n+/).map((row) => row.trim()).filter(Boolean);
    if (!rows.length) {
      notify("请先粘贴学生名单", "error");
      return;
    }
    update((current) => {
      const added = rows.map((row, index) => makeStudentFromRow(row, index, students.length));
      const nextStudents = [...students, ...added];
      return {
        ...syncStudents(current, nextStudents),
        homeworkTasks: current.homeworkTasks?.map((task) => task.classId === activeClass.id ? { ...task, statuses: { ...task.statuses, ...Object.fromEntries(added.map((student) => [student.id, "已交"])) } } : task),
      };
    });
    setBulkOpen(false);
    notify(`已追加 ${rows.length} 名学生`, "success");
  }
  function toggleStudentSelect(id: string) {
    setSelectedStudentIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function toggleFilteredSelect() {
    if (allFilteredSelected) {
      setSelectedStudentIds((current) => current.filter((id) => !filteredIds.includes(id)));
      return;
    }
    setSelectedStudentIds((current) => Array.from(new Set([...current, ...filteredIds])));
  }
  function applyStudentBatchEdit() {
    if (!selectedStudentIds.length) {
      notify("请先选择学生", "error");
      return;
    }
    update((current) => syncStudents(current, applyStudentBatch(students, selectedStudentIds, batchDraft)));
    setBatchOpen(false);
    setBatchDraft({ group: "", gender: "不修改", note: "" });
    notify(`已批量更新 ${selectedStudentIds.length} 名学生`, "success");
  }

  return <div className="mobile-stack mobile-students-page">
    <div className="mobile-action-row mobile-page-primary-actions">
      <button type="button" className="primary" onClick={() => setEditId("__new__")}>新增学生</button>
      <details className="mobile-inline-more"><summary>更多</summary><button type="button" onClick={() => setBulkOpen(true)}>批量追加名单</button></details>
    </div>
    <div className="mobile-student-filters">
      <label className="mobile-search"><span>查找</span><input value={query} onChange={(event) => { setQuery(event.target.value); setStudentPage(1); }} placeholder="姓名、学号、小组" /></label>
      <label className="mobile-search compact"><span>小组</span><select value={groupFilter} onChange={(event) => { setGroupFilter(event.target.value); setStudentPage(1); }}><option value="全部小组">全部</option>{groupOptions.map((group) => <option value={group} key={group}>第{group}组</option>)}</select></label>
    </div>
    {selectedStudentIds.length > 0 && <section className="mobile-batch-toolbar active">
      <span>已选 {selectedStudentIds.length} 人</span>
      <button type="button" disabled={!filteredIds.length} onClick={toggleFilteredSelect}>{allFilteredSelected ? "取消当前" : "全选当前"}</button>
      <button type="button" disabled={!selectedStudentIds.length} onClick={() => setBatchOpen(true)}>批量编辑</button>
    </section>}
    <div className="mobile-student-list">
      {pagedStudents.map((student) => <div className="mobile-student-row" key={student.id}>
        <label className="mobile-student-check" aria-label={`选择${student.name}`}><input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={() => toggleStudentSelect(student.id)} /></label>
        <button type="button" onClick={() => setSelectedId(student.id)}>
          <i>{student.name.slice(0, 1)}</i>
          <span><b>{student.name}</b><small>学号 {student.studentNo || "未填"} · 第{student.group}组</small></span>
          <em>{student.gender}</em>
        </button>
      </div>)}
      {!filtered.length && <p className="mobile-empty">没有符合条件的学生。</p>}
      {filtered.length > studentPageSize && <div className="mobile-list-pager"><button type="button" disabled={safeStudentPage <= 1} onClick={() => setStudentPage((page) => page - 1)}>上一页</button><span>{safeStudentPage} / {studentPageCount} · 共 {filtered.length} 人</span><button type="button" disabled={safeStudentPage >= studentPageCount} onClick={() => setStudentPage((page) => page + 1)}>下一页</button></div>}
    </div>
    {selected && <MobileInfoSheet title={selected.name} onClose={() => setSelectedId("")}>
      <div className="mobile-detail-grid">
        <span><small>学号</small><b>{selected.studentNo || "-"}</b></span>
        <span><small>性别</small><b>{selected.gender}</b></span>
        <span><small>小组</small><b>{selected.group}</b></span>
      </div>
      <div className="mobile-sheet-section"><h3>家长电话</h3><p>{selected.parentPhone || "未填写"}</p></div>
      <div className="mobile-sheet-section"><h3>备注</h3><p>{selected.note || "暂无备注"}</p></div>
      <div className="mobile-sheet-actions"><button type="button" onClick={() => setEditId(selected.id)}>编辑资料</button><button type="button" onClick={() => { setSelectedId(""); setProfileStudentId(selected.id); }}>档案与照护</button></div><div className="mobile-sheet-actions single"><button type="button" onClick={() => deleteStudent(selected.id)}>删除学生</button></div>
    </MobileInfoSheet>}
    {profileStudentId && students.find((student) => student.id === profileStudentId) && <StudentProfile student={students.find((student) => student.id === profileStudentId)!} data={data} update={update} onClose={() => setProfileStudentId("")} />}
    {draftStudent && <MobileInfoSheet title={editId === "__new__" ? "新增学生" : "编辑学生"} onClose={() => setEditId("")}>
      <div className="mobile-form-grid">
        <label><span>姓名</span><input value={draftStudent.name} onChange={(event) => setDraftStudent({ ...draftStudent, name: event.target.value })} /></label>
        <label><span>学号</span><input value={draftStudent.studentNo ?? ""} onChange={(event) => setDraftStudent({ ...draftStudent, studentNo: event.target.value })} /></label>
        <label><span>性别</span><select value={draftStudent.gender} onChange={(event) => setDraftStudent({ ...draftStudent, gender: event.target.value as Student["gender"] })}><option>女</option><option>男</option></select></label>
        <label><span>家长电话</span><input inputMode="tel" maxLength={13} value={draftStudent.parentPhone ?? ""} onChange={(event) => setDraftStudent({ ...draftStudent, parentPhone: event.target.value })} /><small>可留空；填写时请输入 11 位手机号</small></label>
        <label><span>小组</span><input type="number" value={draftStudent.group} onChange={(event) => setDraftStudent({ ...draftStudent, group: Number(event.target.value) || 1 })} /></label>
        <label><span>座位</span><input type="number" value={draftStudent.seat} onChange={(event) => setDraftStudent({ ...draftStudent, seat: Number(event.target.value) || 1 })} /></label>
        <label className="wide"><span>备注</span><textarea value={draftStudent.note ?? ""} onChange={(event) => setDraftStudent({ ...draftStudent, note: event.target.value })} /></label>
      </div>
      <div className="mobile-sheet-actions"><button type="button" onClick={() => setEditId("")}>取消</button><button type="button" className="primary" onClick={saveStudentDraft}>保存学生</button></div>
    </MobileInfoSheet>}
    {bulkOpen && <MobileInfoSheet title="批量追加学生" onClose={() => setBulkOpen(false)}>
      <div className="mobile-form-grid"><label className="wide"><span>名单</span><textarea value={bulkText} onChange={(event) => setBulkText(event.target.value)} placeholder={"张三 13800000001 备注\n李四 13800000002"} /></label></div>
      <div className="mobile-sheet-actions"><button type="button" onClick={() => setBulkOpen(false)}>取消</button><button type="button" className="primary" onClick={appendBulkStudents}>追加名单</button></div>
    </MobileInfoSheet>}
    {batchOpen && <MobileInfoSheet title={`批量编辑 ${selectedStudentIds.length} 人`} onClose={() => setBatchOpen(false)}>
      <div className="mobile-form-grid">
        <label><span>小组</span><input type="number" value={batchDraft.group} onChange={(event) => setBatchDraft({ ...batchDraft, group: event.target.value })} placeholder="留空不修改" /></label>
        <label><span>性别</span><select value={batchDraft.gender} onChange={(event) => setBatchDraft({ ...batchDraft, gender: event.target.value as Student["gender"] | "不修改" })}><option>不修改</option><option>女</option><option>男</option></select></label>
        <label className="wide"><span>备注</span><textarea value={batchDraft.note} onChange={(event) => setBatchDraft({ ...batchDraft, note: event.target.value })} placeholder="留空不修改，填写后覆盖所选学生备注" /></label>
      </div>
      <div className="mobile-sheet-actions"><button type="button" onClick={() => setBatchOpen(false)}>取消</button><button type="button" className="primary" onClick={applyStudentBatchEdit}>应用修改</button></div>
    </MobileInfoSheet>}
  </div>;
}

function MobileHomework({ data, activeClass, update, open }: { data: ClassroomData; activeClass: RosterClass; update: (fn: (d: ClassroomData) => ClassroomData) => void; open: (id: ModuleId) => void }) {
  const [selectedId, setSelectedId] = useState("");
  const [taskKeyword, setTaskKeyword] = useState("");
  const [taskSubjectFilter, setTaskSubjectFilter] = useState("全部科目");
  const [taskTimeFilter, setTaskTimeFilter] = useState("全部时间");
  const [detailStatus, setDetailStatus] = useState<HomeworkTask["statuses"][string] | "全部" | "">("");
  const [detailKeyword, setDetailKeyword] = useState("");
  const [detailGroupFilter, setDetailGroupFilter] = useState("全部");
  const [detailSelectedIds, setDetailSelectedIds] = useState<string[]>([]);
  const [taskEditorOpen, setTaskEditorOpen] = useState<"new" | "edit" | "">("");
  const [taskFormError, setTaskFormError] = useState("");
  const students = activeClass.students?.length ? activeClass.students : data.students;
  const tasks = data.homeworkTasks?.filter((item) => !item.classId || item.classId === activeClass.id) ?? [];
  const taskSubjects = Array.from(new Set(tasks.map((task) => task.subject).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
  const taskNow = new Date();
  const taskMonthStart = `${taskNow.getFullYear()}-${String(taskNow.getMonth() + 1).padStart(2, "0")}-01`;
  const taskRecentCutoff = (days: number) => {
    const cutoff = new Date(taskNow);
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - days + 1);
    return `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  };
  const visibleTasks = tasks.filter((task) => {
    const keyword = taskKeyword.trim().toLocaleLowerCase("zh-CN");
    const matchesKeyword = !keyword || `${task.subject}${task.title}${task.date}`.toLocaleLowerCase("zh-CN").includes(keyword);
    const matchesSubject = taskSubjectFilter === "全部科目" || task.subject === taskSubjectFilter;
    const matchesTime = taskTimeFilter === "全部时间"
      || (taskTimeFilter === "近7天" && task.date >= taskRecentCutoff(7))
      || (taskTimeFilter === "近30天" && task.date >= taskRecentCutoff(30))
      || (taskTimeFilter === "本月" && task.date >= taskMonthStart);
    return matchesKeyword && matchesSubject && matchesTime;
  }).sort((a, b) => b.date.localeCompare(a.date));
  const selected = tasks.find((task) => task.id === selectedId) ?? tasks[0];
  const [taskDraft, setTaskDraft] = useState({ date: today(), subject: "", title: "" });
  const statuses = selected ? homeworkOrder.map((status) => ({
    status,
    students: students.filter((student) => (selected.statuses[student.id] ?? student.homework) === status),
  })) : [];
  const detailStatusCounts = Object.fromEntries(statuses.map((item) => [item.status, item.students.length])) as Record<HomeworkTask["statuses"][string], number>;
  const detailGroups = Array.from(new Set(students.map((student) => student.group))).sort((a, b) => a - b);
  const detailStudents = selected ? students.filter((student) => {
    const status = selected.statuses[student.id] ?? student.homework;
    const matchStatus = detailStatus === "全部" || !detailStatus || status === detailStatus;
    const matchGroup = detailGroupFilter === "全部" || student.group === Number(detailGroupFilter);
    const text = `${student.name}${student.studentNo ?? ""}${student.parentPhone ?? ""}${student.note ?? ""}`.toLocaleLowerCase("zh-CN");
    return matchStatus && matchGroup && text.includes(detailKeyword.trim().toLocaleLowerCase("zh-CN"));
  }) : [];
  const allDetailSelected = detailStudents.length > 0 && detailStudents.every((student) => detailSelectedIds.includes(student.id));
  useEffect(() => {
    const ids = new Set(students.map((student) => student.id));
    setDetailSelectedIds((current) => current.filter((id) => ids.has(id)));
  }, [students]);
  useEffect(() => {
    setDetailSelectedIds([]);
  }, [selected?.id]);
  function setStudentHomeworkStatus(studentId: string, status: HomeworkTask["statuses"][string]) {
    if (!selected) return;
    update((current) => applyHomeworkStatuses({ ...current, homeworkTasks: current.homeworkTasks ?? [] }, activeClass.id, selected.id, [studentId], status));
  }
  function toggleHomeworkStudent(id: string) {
    setDetailSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function toggleDetailStudents() {
    const ids = detailStudents.map((student) => student.id);
    if (allDetailSelected) {
      setDetailSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      return;
    }
    setDetailSelectedIds((current) => Array.from(new Set([...current, ...ids])));
  }
  function batchSetHomeworkStatus(status: HomeworkTask["statuses"][string]) {
    if (!selected || !detailSelectedIds.length) {
      notify("请先选择学生", "error");
      return;
    }
    update((current) => applyHomeworkStatuses({ ...current, homeworkTasks: current.homeworkTasks ?? [] }, activeClass.id, selected.id, detailSelectedIds, status));
    setDetailSelectedIds([]);
    notify(`已批量更新 ${detailSelectedIds.length} 名学生`, "success");
  }
  function addMobileHomeworkFollowUp() {
    if (!selected || !detailSelectedIds.length) {
      notify("请先选择学生", "error");
      return;
    }
    update((current) => ({
      ...current,
      homeworkTasks: (current.homeworkTasks ?? []).map((task) => task.id === selected.id ? { ...task, followUpStudentIds: Array.from(new Set([...(task.followUpStudentIds ?? []), ...detailSelectedIds])) } : task),
    }));
    notify(`已加入待跟进 ${detailSelectedIds.length} 人`, "success");
  }
  function handleMobileHomeworkBatch(value: string) {
    if (!value) return;
    batchSetHomeworkStatus(value as HomeworkTask["statuses"][string]);
  }
  function openNewTask() {
    setTaskDraft({ date: today(), subject: "语文", title: "新作业" });
    setTaskFormError("");
    setTaskEditorOpen("new");
  }
  function saveTaskDraft() {
    if (!taskDraft.date || !taskDraft.subject.trim() || !taskDraft.title.trim()) {
      setTaskFormError("请填写日期、学科和作业内容。");
      notify("请填写日期、学科和作业内容", "error");
      return;
    }
    setTaskFormError("");
    if (taskEditorOpen === "edit" && selected) {
      update((current) => ({ ...current, homeworkTasks: (current.homeworkTasks ?? []).map((task) => task.id === selected.id ? { ...task, date: taskDraft.date, subject: taskDraft.subject.trim(), title: taskDraft.title.trim() } : task) }));
      setTaskEditorOpen("");
      notify("作业任务已更新", "success");
      return;
    }
    const task: HomeworkTask = {
      id: makeId(),
      classId: activeClass.id,
      date: taskDraft.date,
      subject: taskDraft.subject.trim(),
      title: taskDraft.title.trim(),
      statuses: Object.fromEntries(students.map((student) => [student.id, "已交"])),
      followUpStudentIds: [],
    };
    update((current) => ({ ...current, homeworkTasks: [task, ...(current.homeworkTasks ?? [])] }));
    setSelectedId(task.id);
    setTaskEditorOpen("");
    notify("作业任务已新增", "success");
  }
  async function deleteTask(taskId: string) {
    if (!await requestDangerConfirm("删除后这条作业任务的学生提交状态也会一起移除。")) return;
    update((current) => ({ ...current, homeworkTasks: (current.homeworkTasks ?? []).filter((task) => task.id !== taskId) }));
    setSelectedId("");
    setDetailStatus("");
    notify("作业任务已删除", "success");
  }

  return <div className="mobile-stack mobile-homework-page">
    <section className="mobile-homework-task-tools">
      <label className="mobile-search"><span>搜索作业</span><input value={taskKeyword} onChange={(event) => setTaskKeyword(event.target.value)} placeholder="搜索科目、日期或作业内容" /></label>
      <div>
        <label><span>科目</span><select value={taskSubjectFilter} onChange={(event) => setTaskSubjectFilter(event.target.value)}><option>全部科目</option>{taskSubjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
        <label><span>时间</span><select value={taskTimeFilter} onChange={(event) => setTaskTimeFilter(event.target.value)}>{["全部时间", "近7天", "近30天", "本月"].map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <footer><span>找到 {visibleTasks.length} 条作业</span>{(taskKeyword || taskSubjectFilter !== "全部科目" || taskTimeFilter !== "全部时间") && <button type="button" onClick={() => { setTaskKeyword(""); setTaskSubjectFilter("全部科目"); setTaskTimeFilter("全部时间"); }}>清除筛选</button>}</footer>
    </section>
    <section className="mobile-card-list mobile-homework-task-list">
      <header><div><h2>作业任务</h2><span>{visibleTasks.length} 条 · 最新在前</span></div><button type="button" onClick={openNewTask}>新增</button></header>
      {visibleTasks.map((task) => {
        const pending = students.filter((student) => {
          const status = task.statuses[student.id] ?? student.homework;
          return status === "未交" || status === "待订正";
        }).length;
        return <button type="button" className={pending ? "needs-attention" : "is-stable"} key={task.id} onClick={() => { setSelectedId(task.id); setDetailStatus("全部"); }}><b>{task.subject} · {task.title}</b><span>{task.date} · {pending ? `${pending} 人待处理` : "全部稳定"}</span></button>;
      })}
      {!visibleTasks.length && <article><b>{tasks.length ? "没有匹配的作业" : "暂无作业"}</b><span>{tasks.length ? "调整关键词、科目或时间范围后再查看。" : "点上方新增作业后，默认全班为已交，再逐个改状态。"}</span></article>}
    </section>
    {selected && detailStatus && <MobileInfoSheet title={`${selected.title} · ${detailStatus}`} onClose={() => setDetailStatus("")}>
      <section className="mobile-homework-student-heading"><div><b>学生状态</b><span>当前显示 {detailStudents.length} 人</span></div></section>
      <div className="mobile-homework-detail-tools">
        <div className="mobile-homework-filter-row">
          <label><span>状态</span><select value={detailStatus || "全部"} onChange={(event) => setDetailStatus(event.target.value as HomeworkTask["statuses"][string] | "全部")}><option value="全部">全部状态（{students.length}）</option>{homeworkOrder.map((status) => <option value={status} key={status}>{status}（{detailStatusCounts[status] ?? 0}）</option>)}</select></label>
          <label><span>小组</span><select value={detailGroupFilter} onChange={(event) => setDetailGroupFilter(event.target.value)}><option value="全部">全部小组</option>{detailGroups.map((group) => <option value={group} key={group}>第{group}组</option>)}</select></label>
        </div>
        <div className="mobile-homework-searchline">
          <input value={detailKeyword} onChange={(event) => setDetailKeyword(event.target.value)} placeholder="搜索姓名、学号或备注" />
        </div>
        {detailSelectedIds.length > 0 && <div className="mobile-homework-selection-bar active">
          <span>已选 {detailSelectedIds.length} 人</span>
          <button type="button" disabled={!detailStudents.length} onClick={toggleDetailStudents}>{allDetailSelected ? "取消当前" : "全选当前"}</button>
          <select aria-label="批量修改作业状态" value="" disabled={!detailSelectedIds.length} onChange={(event) => handleMobileHomeworkBatch(event.target.value)}>
            <option value="">批量改状态</option>
            {homeworkOrder.map((status) => <option value={status} key={status}>{status}</option>)}
          </select>
          <button type="button" disabled={!detailSelectedIds.length} onClick={addMobileHomeworkFollowUp}>加跟进</button>
        </div>}
      </div>
      <div className="mobile-student-list in-sheet editable">
        {detailStudents.map((student) => {
          const status = selected.statuses[student.id] ?? student.homework;
          const isPicked = detailSelectedIds.includes(student.id);
          return <article className={`mobile-edit-row mobile-homework-edit-row ${isPicked ? "selected" : ""}`} key={student.id}><div role="button" tabIndex={0} onClick={() => toggleHomeworkStudent(student.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleHomeworkStudent(student.id); } }} aria-pressed={isPicked} aria-label={`${isPicked ? "取消选择" : "选择"}${student.name}`}><span className="mobile-homework-selection-rail" aria-hidden="true"><span className="mobile-homework-selection-mark">{isPicked ? "✓" : ""}</span></span><i>{student.name.slice(0, 1)}</i><span><b>{student.name}</b><small>学号 {student.studentNo || "未填"} · 第{student.group}组</small></span><em>{status}</em></div><nav>{homeworkOrder.map((option) => <button type="button" className={status === option ? "active" : ""} key={option} onClick={() => setStudentHomeworkStatus(student.id, option)}>{option}</button>)}</nav></article>;
        })}
        {!detailStudents.length && <p className="mobile-empty">没有符合条件的学生。</p>}
      </div>
    </MobileInfoSheet>}
    {taskEditorOpen && <MobileInfoSheet title={taskEditorOpen === "new" ? "新增作业" : "编辑作业"} onClose={() => setTaskEditorOpen("")}>
      {taskFormError && <p className="mobile-form-error">{taskFormError}</p>}
      <div className="mobile-form-grid">
        <label><span>日期</span><input value={taskDraft.date} onChange={(event) => setTaskDraft({ ...taskDraft, date: event.target.value })} placeholder="2026-08-07" /></label>
        <label><span>学科</span><input value={taskDraft.subject} onChange={(event) => setTaskDraft({ ...taskDraft, subject: event.target.value })} placeholder="语文" /></label>
        <label className="wide"><span>作业内容</span><textarea value={taskDraft.title} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} placeholder="例如：完成第3课生字词订正" /></label>
      </div>
      <div className="mobile-sheet-actions"><button type="button" onClick={() => setTaskEditorOpen("")}>取消</button><button type="button" className="primary" onClick={saveTaskDraft}>{taskEditorOpen === "new" ? "新增作业" : "保存作业"}</button></div>
      {taskEditorOpen === "edit" && selected && <div className="mobile-sheet-actions single"><button type="button" onClick={() => deleteTask(selected.id)}>删除这条作业</button></div>}
    </MobileInfoSheet>}
  </div>;
}

function EmptyScoreWorkspace({ data, classId, update, mobile }: { data: ClassroomData; classId: string; update: (fn: (d: ClassroomData) => ClassroomData) => void; mobile: boolean }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today());
  const [subjects, setSubjects] = useState("语文，数学，英语");
  const [error, setError] = useState("");
  function submit() {
    const parsed = parseSubjects(subjects);
    const result = createScoreExam(data, classId, { title, date, subjects: parsed }, makeId);
    if (!result.exam) { setError(result.error ?? "考试创建失败。"); return; }
    setError("");
    update((current) => createScoreExam(current, classId, { title, date, subjects: parsed }, () => result.exam.id).data ?? current);
    notify("考试已新增，可以开始录入成绩", "success");
  }
  const content = <section className={mobile ? "mobile-hero-card mobile-score-empty" : "score5-page score5-empty-workspace"}>
    <div><span>成绩分析</span><h2>尚未建立考试</h2><p>先填写考试名称、日期和科目。新考试中的成绩保持空白，录入 0 分时才会记为真实零分。</p></div>
    <div className={mobile ? "mobile-form-grid" : "score5-modal-form"}>
      <label><span>考试名称</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：期中学情检测" /></label>
      <label><span>考试日期</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label className="wide"><span>考试科目</span><input value={subjects} onChange={(event) => setSubjects(event.target.value)} placeholder="语文，数学，英语" /></label>
    </div>
    {error && <p className={mobile ? "mobile-form-error" : "score5-batch-error"} role="alert">{error}</p>}
    <div className={mobile ? "mobile-sheet-actions single" : "score5-actions"}><button type="button" className={mobile ? "primary" : "score5-primary"} onClick={submit}>建立第一场考试</button></div>
  </section>;
  return mobile ? <div className="mobile-stack mobile-scores-page">{content}</div> : <><WorkbenchPageHeader icon="📈" tone="iris" title="成绩分析" description="建立第一场考试后，再录入成绩、查看趋势和核对试卷分析。" />{content}</>;
}

function MobileScores(props: { workspaceToken: string; data: ClassroomData; activeClass: RosterClass; update: (fn: (d: ClassroomData) => ClassroomData) => void; open: (id: ModuleId) => void }) {
  if (!scoreExamsForClass(props.data, props.activeClass.id).length) return <EmptyScoreWorkspace data={props.data} classId={props.activeClass.id} update={props.update} mobile />;
  return <MobileScoresWithExam {...props} />;
}

function MobileScoresWithExam({ workspaceToken, data, activeClass, update, open }: { workspaceToken: string; data: ClassroomData; activeClass: RosterClass; update: (fn: (d: ClassroomData) => ClassroomData) => void; open: (id: ModuleId) => void }) {
  const [selectedId, setSelectedId] = useState("");
  const [examPickerOpen, setExamPickerOpen] = useState(false);
  const [examEditorOpen, setExamEditorOpen] = useState<"new" | "edit" | "">("");
  const [examFormError, setExamFormError] = useState("");
  const [examKeyword, setExamKeyword] = useState("");
  const [examSubjectFilter, setExamSubjectFilter] = useState("全部");
  const [examYearFilter, setExamYearFilter] = useState("全部");
  const [examMonthFilter, setExamMonthFilter] = useState("全部");
  const [examSort, setExamSort] = useState("date-desc");
  const [examLibraryPage, setExamLibraryPage] = useState(1);
  const [scoreRangeFilter, setScoreRangeFilter] = useState("全部");
  const [followFilter, setFollowFilter] = useState<"全部" | "已标记" | "未标记">("全部");
  const [sortKey, setSortKey] = useState("priority");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterEditorOpen, setFilterEditorOpen] = useState(false);
  const [rangeEditorOpen, setRangeEditorOpen] = useState(false);
  const [filterSubjectDraft, setFilterSubjectDraft] = useState("总分");
  const [maxScoreDraft, setMaxScoreDraft] = useState("100");
  const [rangeDrafts, setRangeDrafts] = useState<ScoreRange[]>([]);
  const [scoreBatchOpen, setScoreBatchOpen] = useState(false);
  const [scoreBatchSubject, setScoreBatchSubject] = useState("");
  const [scoreBatchValue, setScoreBatchValue] = useState("");
  const [scoreBatchError, setScoreBatchError] = useState("");
  const [scoreWorkspaceView, setScoreWorkspaceView] = useState<"records" | "trends" | "analysis">("records");
  const [scorePage, setScorePage] = useState(1);
  const students = activeClass.students?.length ? activeClass.students : data.students;
  const classExams = scoreExamsForClass(data, activeClass.id);
  const exams = classExams;
  const [examId, setExamId] = useState(exams[0]?.id ?? "");
  const exam = exams.find((item) => item.id === examId) ?? exams[0];
  const subjects = scoreSubjects(exam);
  const [subjectFilter, setSubjectFilter] = useState("全部");
  const [groupFilter, setGroupFilter] = useState("全部小组");
  const [keyword, setKeyword] = useState("");
  const rows = scoreRowsFor(exam, students, data.examReflections ?? []);
  const shownSubjects = subjectFilter !== "全部" && subjects.includes(subjectFilter) ? [subjectFilter] : subjects;
  const activeRangeSubject = subjectFilter !== "全部" ? subjectFilter : "总分";
  const activeRanges = scoreRangesFor(exam, activeRangeSubject);
  const ranked = rows.filter((row) => {
    const text = `${row.student.name}${row.student.studentNo ?? ""}${row.student.group}${row.advice}${row.weakSubject}`;
    const rangeScore = activeRangeSubject === "总分" ? (row.complete ? row.total : null) : scoreEntry(exam, row.student.id, activeRangeSubject);
    const range = activeRanges.find((item) => item.id === scoreRangeFilter);
    const matchRange = !range || scoreRangeFilter === "全部" || (rangeScore != null && rangeScore >= range.min && rangeScore <= range.max);
    const matchFollow = followFilter === "全部" || (followFilter === "已标记" && row.followUp) || (followFilter === "未标记" && !row.followUp);
    const matchGroup = groupFilter === "全部小组" || row.student.group === Number(groupFilter);
    return matchRange && matchFollow && matchGroup && (!keyword.trim() || text.includes(keyword.trim()));
  }).sort((a, b) => {
    const direction = sortDir === "desc" ? -1 : 1;
    if (sortKey === "priority") {
      const priority = (row: typeof a) => subjects.some((subject) => exam.scores[row.student.id]?.[subject] == null) ? 0 : row.followUp ? 1 : row.average < 60 ? 2 : 3;
      return priority(a) - priority(b) || `${a.student.studentNo ?? ""}`.localeCompare(`${b.student.studentNo ?? ""}`, "zh-Hans-CN", { numeric: true });
    }
    if (sortKey === "studentNo") return `${a.student.studentNo ?? ""}`.localeCompare(`${b.student.studentNo ?? ""}`, "zh-Hans-CN", { numeric: true }) * direction;
    if (sortKey === "name") return a.student.name.localeCompare(b.student.name, "zh-Hans-CN") * direction;
    if (sortKey === "average") return (a.average - b.average) * direction;
    if (sortKey.startsWith("subject:")) return (scoreValue(exam, a.student, sortKey.replace("subject:", "")) - scoreValue(exam, b.student, sortKey.replace("subject:", ""))) * direction;
    return (a.total - b.total) * direction;
  });
  const selected = students.find((student) => student.id === selectedId);
  const examScores = selected && exam ? exam.scores[selected.id] : null;
  const [examDraft, setExamDraft] = useState({ title: "", date: today(), subjects: "语文，数学，英语" });
  const examIdsKey = exams.map((item) => item.id).join("|");
  const firstExamId = exams[0]?.id ?? "";

  useEffect(() => {
    if (!examIdsKey.split("|").includes(examId)) setExamId(firstExamId);
  }, [examId, examIdsKey, firstExamId]);

  function updateExam(nextExam: ScoreExam) {
    update((current) => patchScoreExam(current, activeClass.id, nextExam.id, nextExam));
  }
  function setStudentScore(studentId: string, subject: string, value: string) {
    const numeric = value.trim() === "" ? null : Number(value);
    const preview = setScoreEntries(data, activeClass.id, exam.id, [studentId], subject, numeric);
    if (preview.error) { notify(preview.error, "error"); return; }
    update((current) => setScoreEntries(current, activeClass.id, exam.id, [studentId], subject, numeric).data ?? current);
  }
  function openMobileScoreBatch() {
    const subject = subjectFilter !== "全部" && subjects.includes(subjectFilter) ? subjectFilter : subjects[0] ?? "";
    setScoreBatchSubject(subject);
    setScoreBatchValue("");
    setScoreBatchError("");
    setScoreBatchOpen(true);
  }
  function applyMobileBatchScore() {
    const value = Number(scoreBatchValue);
    if (!selectedIds.length) {
      setScoreBatchError("请先在学生列表中选择同分学生。");
      return;
    }
    if (!activeBatchSubject) {
      setScoreBatchError("请选择要录入的科目。");
      return;
    }
    if (!Number.isFinite(value)) {
      setScoreBatchError("请填写有效分数。");
      return;
    }
    const safeScore = Math.max(0, Math.min(subjectMaxScore(exam, activeBatchSubject), value));
    const preview = setScoreEntries(data, activeClass.id, exam.id, selectedIds, activeBatchSubject, safeScore);
    if (preview.error) { setScoreBatchError(preview.error); return; }
    update((current) => setScoreEntries(current, activeClass.id, exam.id, selectedIds, activeBatchSubject, safeScore).data ?? current);
    setScoreBatchError("");
    setScoreBatchOpen(false);
    setSelectedIds([]);
    notify(`已给 ${selectedIds.length} 名学生录入${activeBatchSubject} ${safeScore}分`, "success");
  }
  function toggleScoreFollow(studentId: string) {
    const list = exam.followUpStudentIds ?? [];
    updateExam({ ...exam, followUpStudentIds: list.includes(studentId) ? list.filter((id) => id !== studentId) : [...list, studentId] });
  }
  function openNewExam() {
    setExamDraft({ title: "", date: today(), subjects: subjects.join("，") || "语文，数学，英语" });
    setExamFormError("");
    setExamEditorOpen("new");
  }
  function openEditExam() {
    setExamDraft({ title: exam.title, date: exam.date, subjects: subjects.join("，") });
    setExamFormError("");
    setExamEditorOpen("edit");
  }
  function saveExamDraft() {
    const nextSubjects = parseSubjects(examDraft.subjects);
    if (!nextSubjects.length) {
      setExamFormError("请填写至少一个考试科目。");
      notify("请填写至少一个考试科目", "error");
      return;
    }
    setExamFormError("");
    if (examEditorOpen === "edit") {
      const preview = editScoreExam(data, activeClass.id, exam.id, { title: examDraft.title, date: examDraft.date, subjects: nextSubjects });
      if (preview.error) { setExamFormError(preview.error); return; }
      update((current) => editScoreExam(current, activeClass.id, exam.id, { title: examDraft.title, date: examDraft.date, subjects: nextSubjects }).data ?? current);
      setExamEditorOpen("");
      notify("考试信息已更新", "success");
      return;
    }
    const result = createScoreExam(data, activeClass.id, { title: examDraft.title, date: examDraft.date, subjects: nextSubjects }, makeId);
    if (!result.exam) { setExamFormError(result.error ?? "考试创建失败。"); return; }
    const nextExam = result.exam;
    update((current) => createScoreExam(current, activeClass.id, { title: examDraft.title, date: examDraft.date, subjects: nextSubjects }, () => nextExam.id).data ?? current);
    setExamId(nextExam.id);
    setSubjectFilter("全部");
    setExamEditorOpen("");
    notify("考试已新增", "success");
  }
  async function deleteMobileExam() {
    if (!await requestDangerConfirm(`${exam.title} 的全部成绩、跟进标记和关联反思都会删除。`, "删除考试", "确认删除")) return;
    update((current) => removeScoreExam(current, activeClass.id, exam.id));
    setExamId(exams.find((item) => item.id !== exam.id)?.id ?? "");
    setExamEditorOpen("");
  }
  function chooseExam(nextExamId: string) {
    setExamId(nextExamId);
    setSelectedId("");
    setSubjectFilter("全部");
    setScoreRangeFilter("全部");
    setSelectedIds([]);
    setExamPickerOpen(false);
  }
  function setScoreAdvice(studentId: string, advice: string) {
    updateExam({ ...exam, advice: { ...(exam.advice ?? {}), [studentId]: advice } });
  }
  function batchScoreFollow(mark: boolean) {
    const list = exam.followUpStudentIds ?? [];
    const nextList = mark ? Array.from(new Set([...list, ...selectedIds])) : list.filter((id) => !selectedIds.includes(id));
    updateExam({ ...exam, followUpStudentIds: nextList });
    setSelectedIds([]);
    notify(mark ? "已批量标记重点" : "已批量取消重点", "success");
  }
  function toggleScoreSelect(studentId: string) {
    setSelectedIds((ids) => ids.includes(studentId) ? ids.filter((id) => id !== studentId) : [...ids, studentId]);
  }
  function toggleVisibleScoreSelect() {
    const visibleIds = ranked.map((row) => row.student.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((ids) => allSelected ? ids.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...ids, ...visibleIds])));
  }
  function loadMobileFilterDraft(subject: string) {
    setFilterSubjectDraft(subject);
    setMaxScoreDraft(`${subjectMaxScore(exam, subject)}`);
    setRangeDrafts(scoreRangesFor(exam, subject).map((item) => ({ ...item })));
  }
  function openMobileFilterEditor() {
    loadMobileFilterDraft(activeRangeSubject);
    setFilterEditorOpen(false);
    setRangeEditorOpen(true);
  }
  function saveMobileFilterEditor() {
    const key = scoreSubjectKey(filterSubjectDraft);
    const cleanRanges = rangeDrafts.map((item, index) => ({
      id: item.id || `range-${index + 1}`,
      label: item.label.trim() || `区间${index + 1}`,
      min: Math.max(0, Number(item.min) || 0),
      max: Math.max(0, Number(item.max) || 0),
    })).filter((item) => item.max >= item.min);
    const savedRanges = cleanRanges.length ? cleanRanges : defaultScoreRanges(Number(maxScoreDraft) || subjectMaxScore(exam, filterSubjectDraft));
    const nextRanges = { ...(exam.scoreRanges ?? {}), [key]: savedRanges };
    const nextMaxScores = { ...(exam.subjectMaxScores ?? {}) };
    if (filterSubjectDraft !== "总分") nextMaxScores[filterSubjectDraft] = Math.max(1, Number(maxScoreDraft) || 100);
    updateExam({ ...exam, subjectMaxScores: nextMaxScores, scoreRanges: nextRanges });
    setScoreRangeFilter("全部");
    setRangeEditorOpen(false);
    notify(`${filterSubjectDraft}分数区间已保存`, "success");
  }
  const selectedRow = selected ? scoreRowsFor(exam, [selected], data.examReflections ?? [])[0] : null;
  const enteredRows = rows.filter((row) => row.enteredCount > 0);
  const scoreAverageValue = enteredRows.length ? Math.round(enteredRows.reduce((sum, row) => sum + row.average, 0) / enteredRows.length) : null;
  const followCount = rows.filter((row) => row.followUp).length;
  const enteredCount = scoreEntryCount(exam, students);
  const scoreCount = students.length * subjects.length;
  const visibleIds = ranked.map((row) => row.student.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const allExamSubjects = Array.from(new Set(exams.flatMap((item) => scoreSubjects(item))));
  const examYearOptions = Array.from(new Set(exams.map((item) => item.date.slice(0, 4)).filter(Boolean))).sort((a, b) => b.localeCompare(a));
  const examMonthOptions = Array.from(new Set(exams.filter((item) => examYearFilter === "全部" || item.date.startsWith(examYearFilter)).map((item) => item.date.slice(0, 7)).filter(Boolean))).sort((a, b) => b.localeCompare(a));
  const visibleExams = exams.filter((item) => {
    const itemSubjects = scoreSubjects(item);
    const text = `${item.title}${item.date}${itemSubjects.join("")}`;
    const matchKeyword = !examKeyword.trim() || text.includes(examKeyword.trim());
    const matchSubject = examSubjectFilter === "全部" || itemSubjects.includes(examSubjectFilter);
    const matchYear = examYearFilter === "全部" || item.date.startsWith(examYearFilter);
    const matchMonth = examMonthFilter === "全部" || item.date.startsWith(examMonthFilter);
    return matchKeyword && matchSubject && matchYear && matchMonth;
  }).sort((a, b) => examSort === "date-asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
  const examLibraryPageSize = 12;
  const examLibraryPageCount = Math.max(1, Math.ceil(visibleExams.length / examLibraryPageSize));
  const safeExamLibraryPage = Math.min(examLibraryPage, examLibraryPageCount);
  const pagedVisibleExams = visibleExams.slice((safeExamLibraryPage - 1) * examLibraryPageSize, safeExamLibraryPage * examLibraryPageSize);
  const activeBatchSubject = subjects.includes(scoreBatchSubject) ? scoreBatchSubject : subjects[0] ?? "";
  const activeBatchMax = activeBatchSubject ? subjectMaxScore(exam, activeBatchSubject) : 0;
  const batchScoreStudents = students.filter((student) => selectedIds.includes(student.id));
  const activeBatchScore = scoreBatchValue === "" ? "" : Math.max(0, Math.min(activeBatchMax, Number(scoreBatchValue) || 0));
  const groupOptions = Array.from(new Set(students.map((student) => student.group))).sort((a, b) => a - b);
  const scorePageSize = 12;
  const scorePageCount = Math.max(1, Math.ceil(ranked.length / scorePageSize));
  const safeScorePage = Math.min(scorePage, scorePageCount);
  const pagedScoreRows = ranked.slice((safeScorePage - 1) * scorePageSize, safeScorePage * scorePageSize);

  return <div className="mobile-stack mobile-scores-page">
    <section className="mobile-hero-card">
      <div><span>当前考试</span><h2>{exam.title}</h2><p>{exam.date} · {subjects.join("，")} · 已录 {enteredCount}/{scoreCount}</p></div>
      <div className="mobile-score-hero-actions"><button type="button" onClick={() => setExamPickerOpen(true)}>切换考试</button><button type="button" onClick={openEditExam}>编辑考试</button><button type="button" className="primary" onClick={openNewExam}>新增考试</button></div>
    </section>
    <section className="mobile-overview-stats compact" aria-label="成绩分析概览">
      <span><small>录分进度</small><b>{enteredCount}/{scoreCount}</b></span>
      <span><small>已录平均</small><b>{scoreAverageValue ?? "未录入"}</b></span>
      <span><small>重点跟进</small><b>{followCount}</b></span>
    </section>
    <nav className="score5-workspace-tabs mobile-score-workspace-tabs" aria-label="成绩工作视图"><button type="button" className={scoreWorkspaceView === "records" ? "active" : ""} onClick={() => setScoreWorkspaceView("records")}>成绩录入</button><button type="button" className={scoreWorkspaceView === "trends" ? "active" : ""} onClick={() => setScoreWorkspaceView("trends")}>历次趋势</button><button type="button" className={scoreWorkspaceView === "analysis" ? "active" : ""} onClick={() => setScoreWorkspaceView("analysis")}>试卷分析</button></nav>
    {scoreWorkspaceView === "trends" && <ScoreTrends data={data} classId={activeClass.id} />}
    {scoreWorkspaceView === "analysis" && <ScoreItemAnalysis data={data} classId={activeClass.id} workspaceToken={workspaceToken} exam={exam} students={students} update={update} />}
    {scoreWorkspaceView === "records" && <><section className="mobile-score-student-toolbar">
      <label className="mobile-search"><span>查找学生</span><input value={keyword} onChange={(event) => { setKeyword(event.target.value); setScorePage(1); }} placeholder="姓名、学号或小组" /></label>
      <div>
        <label><span>小组</span><select value={groupFilter} onChange={(event) => { setGroupFilter(event.target.value); setScorePage(1); }}><option>全部小组</option>{groupOptions.map((group) => <option value={group} key={group}>第{group}组</option>)}</select></label>
        <label><span>科目</span><select value={subjectFilter} onChange={(event) => { setSubjectFilter(event.target.value); setScoreRangeFilter("全部"); setScorePage(1); }}><option>全部</option>{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
      </div>
    </section>
    <section className="mobile-filter-bar mobile-score-more-filter">
      <span>当前 {ranked.length} 人 · 已选 {selectedIds.length} 人{(scoreRangeFilter !== "全部" || followFilter !== "全部") ? " · 已启用更多筛选" : ""}</span>
      <button type="button" onClick={() => setFilterEditorOpen(true)}>更多筛选</button>
    </section>
    {selectedIds.length > 0 && <section className="mobile-score-selection-panel active">
      <header><span>已选 <b>{selectedIds.length}</b> 人</span><button type="button" onClick={toggleVisibleScoreSelect}>{allVisibleSelected ? "取消当前全选" : "全选当前结果"}</button></header>
      <div><button type="button" className="primary" onClick={openMobileScoreBatch}>批量录分</button><select aria-label="批量重点操作" value="" onChange={(event) => { if (event.target.value === "mark") batchScoreFollow(true); if (event.target.value === "unmark") batchScoreFollow(false); }}><option value="">重点操作</option><option value="mark">标记为重点</option><option value="unmark">取消重点</option></select></div>
    </section>}
    <div className="mobile-student-list mobile-score-list">
      {pagedScoreRows.map((row) => <article className="mobile-score-row" key={row.student.id}>
        <label className="mobile-score-select" aria-label={`${selectedIds.includes(row.student.id) ? "取消选择" : "选择"}${row.student.name}`}>
          <input type="checkbox" checked={selectedIds.includes(row.student.id)} onChange={() => toggleScoreSelect(row.student.id)} />
          <span aria-hidden="true" />
        </label>
        <button type="button" className="mobile-score-main" onClick={() => setSelectedId(row.student.id)}>
          <span><b>{row.student.name}</b><small>{row.complete ? `总分 ${row.total}` : `已录 ${row.enteredCount}/${subjects.length}`} · 第{row.student.group}组 · 学号 {row.student.studentNo || "未填"}</small><strong>{shownSubjects.slice(0, 3).map((subject) => <i key={subject}>{subject} {scoreEntry(exam, row.student.id, subject) ?? "未录"}</i>)}</strong></span>
        </button>
        <button type="button" className={row.followUp ? "mobile-score-follow active" : "mobile-score-follow"} onClick={() => toggleScoreFollow(row.student.id)}>{row.followUp ? "已标记" : "标记"}</button>
      </article>)}
      {!ranked.length && <p className="mobile-empty">没有符合条件的学生。</p>}
      {ranked.length > scorePageSize && <div className="mobile-list-pager"><button type="button" disabled={safeScorePage <= 1} onClick={() => setScorePage((page) => page - 1)}>上一页</button><span>{safeScorePage} / {scorePageCount} · 共 {ranked.length} 人</span><button type="button" disabled={safeScorePage >= scorePageCount} onClick={() => setScorePage((page) => page + 1)}>下一页</button></div>}
    </div></>}
    {selected && selectedRow && <MobileInfoSheet title={`${selected.name} · ${exam.title}`} onClose={() => setSelectedId("")}>
      <div className="mobile-detail-grid">
        <span><small>总分</small><b>{selectedRow.complete ? selectedRow.total : "待补全"}</b></span>
        <span><small>已录平均</small><b>{selectedRow.enteredCount ? selectedRow.average : "未录入"}</b></span>
        <span><small>重点跟进</small><b>{selectedRow.followUp ? "是" : "否"}</b></span>
        <span><small>学号</small><b>{selected.studentNo || "未填"}</b></span>
      </div>
      <div className="mobile-form-grid mobile-score-form">
        {subjects.map((subject) => <label key={subject}><span>{subject}</span><input type="number" min={0} max={subjectMaxScore(exam, subject)} value={examScores?.[subject] ?? ""} onChange={(event) => setStudentScore(selected.id, subject, event.target.value)} placeholder="未录入" /></label>)}
        <label className="wide"><span>成绩建议</span><textarea value={exam.advice?.[selected.id] ?? selectedRow.advice} onChange={(event) => setScoreAdvice(selected.id, event.target.value)} /></label>
      </div>
      <div className="mobile-sheet-actions single"><button type="button" onClick={() => toggleScoreFollow(selected.id)}>{selectedRow.followUp ? "取消重点跟进" : "标记重点跟进"}</button></div>
    </MobileInfoSheet>}
    {scoreBatchOpen && <MobileInfoSheet title={`${exam.title} · 批量录分`} onClose={() => setScoreBatchOpen(false)}>
      <div className="mobile-form-grid mobile-score-batch-head">
        <label><span>录入科目</span><select value={activeBatchSubject} onChange={(event) => setScoreBatchSubject(event.target.value)}>{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
        <label><span>统一分数</span><input type="number" min={0} max={activeBatchMax} value={scoreBatchValue} onChange={(event) => { setScoreBatchValue(event.target.value); setScoreBatchError(""); }} placeholder={`0-${activeBatchMax}`} /></label>
      </div>
      {scoreBatchError && <p className="mobile-form-error">{scoreBatchError}</p>}
      <section className="mobile-batch-score-summary"><span>{activeBatchSubject || "未选择科目"} · 满分 {activeBatchMax}</span><b>{selectedIds.length}人</b><small>{scoreBatchValue === "" ? "填写同一分数后应用到已选学生" : `将统一录入 ${activeBatchScore} 分`}</small></section>
      <div className="mobile-score-batch-list">
        {batchScoreStudents.map((student) => <article key={student.id}>
          <span><b>{student.name}</b><small>学号 {student.studentNo || "未填"} · 第{student.group}组</small></span>
          <em>当前 {activeBatchSubject ? exam.scores[student.id]?.[activeBatchSubject] ?? "未录" : "未录"}</em>
        </article>)}
        {!batchScoreStudents.length && <p className="mobile-empty">请先在学生列表中选择同分学生。</p>}
      </div>
      <div className="mobile-sheet-actions"><button type="button" onClick={() => setScoreBatchOpen(false)}>取消</button><button type="button" className="primary" disabled={!selectedIds.length || scoreBatchValue === ""} onClick={applyMobileBatchScore}>应用到已选</button></div>
    </MobileInfoSheet>}
    {examPickerOpen && <MobileInfoSheet title="切换考试" onClose={() => setExamPickerOpen(false)}>
      <div className="mobile-form-grid mobile-exam-filter">
        <label className="wide"><span>关键词</span><input value={examKeyword} onChange={(event) => { setExamKeyword(event.target.value); setExamLibraryPage(1); }} placeholder="考试名称、科目或日期" /></label>
        <label><span>科目</span><select value={examSubjectFilter} onChange={(event) => { setExamSubjectFilter(event.target.value); setExamLibraryPage(1); }}><option>全部</option>{allExamSubjects.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>年份</span><select value={examYearFilter} onChange={(event) => { setExamYearFilter(event.target.value); setExamMonthFilter("全部"); setExamLibraryPage(1); }}><option>全部</option>{examYearOptions.map((item) => <option value={item} key={item}>{item}年</option>)}</select></label>
        <label><span>月份</span><select value={examMonthFilter} onChange={(event) => { setExamMonthFilter(event.target.value); setExamLibraryPage(1); }}><option>全部</option>{examMonthOptions.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        <label><span>排序</span><select value={examSort} onChange={(event) => { setExamSort(event.target.value); setExamLibraryPage(1); }}><option value="date-desc">由新到旧</option><option value="date-asc">由旧到新</option></select></label>
      </div>
      <div className="mobile-card-list in-sheet-list">
        {pagedVisibleExams.map((item) => {
          const itemSubjects = scoreSubjects(item);
          const itemEntered = scoreEntryCount(item, students);
          const itemTotal = students.length * itemSubjects.length;
          return <button type="button" key={item.id} onClick={() => chooseExam(item.id)}><b>{item.title}</b><span>{item.date} · {itemSubjects.join("，")} · 已录 {itemEntered}/{itemTotal}</span></button>;
        })}
        {!visibleExams.length && <article><b>没有符合条件的考试</b><span>可以调整关键词、科目或时间筛选。</span></article>}
      </div>
      {visibleExams.length > examLibraryPageSize && <div className="mobile-list-pager"><button type="button" disabled={safeExamLibraryPage <= 1} onClick={() => setExamLibraryPage((page) => page - 1)}>上一页</button><span>{safeExamLibraryPage} / {examLibraryPageCount} · 共 {visibleExams.length} 场</span><button type="button" disabled={safeExamLibraryPage >= examLibraryPageCount} onClick={() => setExamLibraryPage((page) => page + 1)}>下一页</button></div>}
      <div className="mobile-sheet-actions"><button type="button" onClick={openEditExam}>编辑当前</button><button type="button" className="primary" onClick={openNewExam}>新增考试</button></div>
    </MobileInfoSheet>}
    {examEditorOpen && <MobileInfoSheet title={examEditorOpen === "new" ? "新增考试" : "编辑考试"} onClose={() => setExamEditorOpen("")}>
      {examFormError && <p className="mobile-form-error">{examFormError}</p>}
      <div className="mobile-form-grid">
        <label><span>考试名称</span><input value={examDraft.title} onChange={(event) => setExamDraft({ ...examDraft, title: event.target.value })} placeholder="例如：第一次月考" /></label>
        <label><span>考试日期</span><input value={examDraft.date} onChange={(event) => setExamDraft({ ...examDraft, date: event.target.value })} placeholder="2026-08-07" /></label>
        <label className="wide"><span>考试科目</span><input value={examDraft.subjects} onChange={(event) => setExamDraft({ ...examDraft, subjects: event.target.value })} placeholder="语文，数学，英语" /></label>
      </div>
      {examEditorOpen === "edit" && <div className="mobile-sheet-actions single"><button type="button" onClick={deleteMobileExam}>删除当前考试</button></div>}
      <div className="mobile-sheet-actions"><button type="button" onClick={() => setExamEditorOpen("")}>取消</button><button type="button" className="primary" onClick={saveExamDraft}>{examEditorOpen === "new" ? "新增考试" : "保存考试"}</button></div>
    </MobileInfoSheet>}
    {filterEditorOpen && <MobileInfoSheet title="筛选学生" onClose={() => setFilterEditorOpen(false)}>
      <section className="mobile-score-filter-context"><span>当前查看</span><b>{activeRangeSubject === "总分" ? "全科总分" : `${activeRangeSubject}成绩`}</b><small>科目在主页面切换，这里只筛选学生并调整列表顺序。</small></section>
      <div className="mobile-form-grid mobile-score-filter-form">
        <label><span>{activeRangeSubject}分数范围</span><select value={scoreRangeFilter} onChange={(event) => setScoreRangeFilter(event.target.value)}><option>全部</option>{activeRanges.map((item) => <option value={item.id} key={item.id}>{item.label} {item.min}-{item.max}</option>)}</select></label>
        <label><span>重点状态</span><select value={followFilter} onChange={(event) => setFollowFilter(event.target.value as typeof followFilter)}><option>全部</option><option>已标记</option><option>未标记</option></select></label>
        <label><span>排序依据</span><select value={sortKey} onChange={(event) => setSortKey(event.target.value)}><option value="priority">待处理优先</option><option value="total">总分</option><option value="average">平均分</option>{subjects.map((item) => <option value={`subject:${item}`} key={item}>{item}成绩</option>)}<option value="studentNo">学号</option><option value="name">姓名</option></select></label>
        <label><span>排列顺序</span><select value={sortDir} disabled={sortKey === "priority"} onChange={(event) => setSortDir(event.target.value as typeof sortDir)}>{sortKey === "priority" ? <option value="asc">未录与重点在前</option> : sortKey === "studentNo" || sortKey === "name" ? <><option value="asc">正序</option><option value="desc">倒序</option></> : <><option value="desc">高分优先</option><option value="asc">低分优先</option></>}</select></label>
      </div>
      <div className="mobile-sheet-actions"><button type="button" onClick={() => { setScoreRangeFilter("全部"); setFollowFilter("全部"); setSortKey("total"); setSortDir("desc"); }}>重置</button><button type="button" className="primary" onClick={() => setFilterEditorOpen(false)}>查看结果</button></div>
      <button type="button" className="mobile-score-range-manage" onClick={openMobileFilterEditor}>管理满分与分数区间</button>
    </MobileInfoSheet>}
    {rangeEditorOpen && <MobileInfoSheet title="满分与分数区间" onClose={() => setRangeEditorOpen(false)}>
      <div className="mobile-form-grid">
        <label><span>设置对象</span><select value={filterSubjectDraft} onChange={(event) => loadMobileFilterDraft(event.target.value)}><option>总分</option>{subjects.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>{filterSubjectDraft === "总分" ? "总分满分" : "科目满分"}</span><input value={maxScoreDraft} disabled={filterSubjectDraft === "总分"} onChange={(event) => { setMaxScoreDraft(event.target.value); const nextMax = Number(event.target.value); if (nextMax > 0) setRangeDrafts(defaultScoreRanges(nextMax)); }} /></label>
      </div>
      <div className="mobile-range-editor"><div className="campus-range-labels" aria-hidden="true"><span>区间名称</span><span>最低分</span><span>最高分</span><span>操作</span></div>
        {rangeDrafts.map((item, index) => <div className="mobile-range-row" key={item.id || index}>
          <input aria-label={`第${index + 1}个区间名称`} value={item.label} onChange={(event) => setRangeDrafts((list) => list.map((range, i) => i === index ? { ...range, label: event.target.value } : range))} />
          <input aria-label={`${item.label}最低分`} type="number" value={item.min} onChange={(event) => setRangeDrafts((list) => list.map((range, i) => i === index ? { ...range, min: Number(event.target.value) || 0 } : range))} />
          <input aria-label={`${item.label}最高分`} type="number" value={item.max} onChange={(event) => setRangeDrafts((list) => list.map((range, i) => i === index ? { ...range, max: Number(event.target.value) || 0 } : range))} />
          <button type="button" onClick={() => setRangeDrafts((list) => list.filter((_, i) => i !== index))}>删除</button>
        </div>)}
      </div>
      <div className="mobile-sheet-actions"><button type="button" onClick={() => setRangeDrafts((list) => [...list, { id: `custom-${Date.now()}`, label: "自定义", min: 0, max: subjectMaxScore(exam, filterSubjectDraft) }])}>新增区间</button><button type="button" className="primary" onClick={saveMobileFilterEditor}>保存</button></div>
    </MobileInfoSheet>}
  </div>;
}

function MobileMore({ current, open, compact }: { current: ModuleId; open: (id: ModuleId) => void; compact?: boolean }) {
  const groups: { title: string; items: ModuleId[] }[] = [
    { title: "学生与跟进", items: ["students", "dictation", "attendance", "growth", "health", "records", "comments"] },
    { title: "学习管理", items: ["homework", "scores", "reflection", "points"] },
    { title: "班级事务", items: ["schedule", "tools", "seating", "duty", "cadres"] },
    { title: "输出与规则", items: ["weekly", "rules"] },
  ];
  const tones: Partial<Record<ModuleId, "blue" | "green" | "orange" | "violet" | "cyan" | "red" | "teal" | "amber">> = {
    students: "blue",
    attendance: "teal",
    growth: "green",
    health: "red",
    records: "orange",
    comments: "violet",
    homework: "amber",
    scores: "cyan",
    reflection: "red",
    points: "blue",
    schedule: "teal",
    tools: "violet",
    seating: "orange",
    duty: "green",
    cadres: "violet",
    weekly: "cyan",
    rules: "amber",
  };
  return <div className={compact ? "mobile-more compact" : "mobile-more"}>
    {groups.map((group) => <section key={group.title}>
      <h2>{group.title}</h2>
      <div>
        {group.items.map((id) => {
          const item = workspaceModules.find((navItem) => navItem.id === id)!;
          const tone = tones[id] ?? "blue";
          return <button type="button" className={`mobile-tool-icon ${tone} ${current === id ? "active" : ""}`} key={id} onClick={() => open(id)}><i><CampusIcon name={item.label}/></i><b>{item.label}</b></button>;
        })}
      </div>
    </section>)}
  </div>;
}

function MobileSecondaryPage({ workspaceToken, active, data, activeClass, update, open, readOnly }: { workspaceToken: string; active: ModuleId; data: ClassroomData; activeClass: RosterClass; update: (fn: (d: ClassroomData) => ClassroomData) => void; open: (id: ModuleId) => void; readOnly: boolean }) {
  const mobileDutyDays = data.scheduleConfig?.days?.map((day) => day.trim()).filter(Boolean) ?? days;
  const mobileDutyDaysKey = mobileDutyDays.join("|");
  const currentWeekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date().getDay()];
  const [detail, setDetail] = useState<{ title: string; children: ReactNode } | null>(null);
  const [quickPointOpen, setQuickPointOpen] = useState(false);
  const [pointRuleSheetOpen, setPointRuleSheetOpen] = useState(false);
  const [quickRecordOpen, setQuickRecordOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState("");
  const [recordStudentPickerOpen, setRecordStudentPickerOpen] = useState(false);
  const [ruleEditorOpen, setRuleEditorOpen] = useState(false);
  const [dutyEditorOpen, setDutyEditorOpen] = useState(false);
  const [cadreEditorOpen, setCadreEditorOpen] = useState(false);
  const availablePointRules = pointRulesForData(data).filter((rule) => rule.enabled !== false);
  const firstPointRule = availablePointRules[0];
  const [pointDraft, setPointDraft] = useState({ studentId: activeClass.students[0]?.id ?? data.students[0]?.id ?? "", ruleId: firstPointRule?.id ?? "", note: "", operator: "班主任", delta: firstPointRule?.delta ?? 0 });
  const [pointStudentKeyword, setPointStudentKeyword] = useState("");
  const [pointGroupFilter, setPointGroupFilter] = useState("全部小组");
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>([]);
  const [pointView, setPointView] = useState<"录入" | "排行" | "记录">("录入");
  const [pointSort, setPointSort] = useState<"积分高优先" | "积分低优先" | "姓名" | "小组">("积分高优先");
  const [pointRuleScene, setPointRuleScene] = useState("全部规则");
  const [pointEventFilter, setPointEventFilter] = useState<"全部记录" | "加分" | "扣分">("全部记录");
  const [pointEventKeyword, setPointEventKeyword] = useState("");
  const [growthStudentId, setGrowthStudentId] = useState(activeClass.students[0]?.id ?? data.students[0]?.id ?? "");
  const [growthKeyword, setGrowthKeyword] = useState("");
  const [growthGroupFilter, setGrowthGroupFilter] = useState("全部小组");
  const [growthStatusFilter, setGrowthStatusFilter] = useState<"全部状态" | "需要跟进" | "表现良好" | "整体稳定">("全部状态");
  const [growthCoverageFilter, setGrowthCoverageFilter] = useState<"全部记录" | "有记录" | "暂无记录">("全部记录");
  const [growthStudentSort, setGrowthStudentSort] = useState<"默认排序" | "记录多优先" | "积分低优先" | "成绩低优先">("默认排序");
  const [growthKindFilter, setGrowthKindFilter] = useState<"全部类型" | GrowthKind>("全部类型");
  const [growthRangeFilter, setGrowthRangeFilter] = useState<GrowthTime>("全部时间");
  const [growthPage, setGrowthPage] = useState(1);
  const [growthStudentPage, setGrowthStudentPage] = useState(1);
  const [growthDetailOpen, setGrowthDetailOpen] = useState(false);
  const [growthComposerOpen, setGrowthComposerOpen] = useState(false);
  const [growthFormError, setGrowthFormError] = useState("");
  const [growthCopyState, setGrowthCopyState] = useState("复制摘要");
  const [growthDraft, setGrowthDraft] = useState({ date: today(), type: "表扬记录", title: "", content: "", followUp: "" });
  const [weeklyEditorOpen, setWeeklyEditorOpen] = useState(false);
  const [weeklyDraft, setWeeklyDraft] = useState({ id: "", weekOffset: 0, edition: "家长版" as WeeklyReport["edition"], title: "", content: "", nextFocus: "" });
  const [weeklyEditorMessage, setWeeklyEditorMessage] = useState("");
  const [weeklyView, setWeeklyView] = useState<"本周" | "归档">("本周");
  const [weeklyOffset, setWeeklyOffset] = useState(0);
  const [weeklyArchiveSearch, setWeeklyArchiveSearch] = useState("");
  const [weeklyArchiveEdition, setWeeklyArchiveEdition] = useState<"全部版本" | WeeklyReport["edition"]>("全部版本");
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);
  const [scheduleSurface, setScheduleSurface] = useState<"班级课表" | "我的日程">("班级课表");
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleEvent>({ id: "", date: today(), title: "", type: "班会", detail: "" });
  const [scheduleKeyword, setScheduleKeyword] = useState("");
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState<ScheduleEvent["type"] | "全部">("全部");
  const [scheduleMonth, setScheduleMonth] = useState(() => {
    const config = data.scheduleConfig ?? defaultScheduleConfig();
    const months = scheduleTermMonths(config);
    const currentMonth = today().slice(0, 7);
    return months.includes(currentMonth) ? currentMonth : months.includes(data.scheduleWeeks?.[0]?.month ?? "") ? data.scheduleWeeks![0].month : months[0] ?? currentMonth;
  });
  const [scheduleWeekNo, setScheduleWeekNo] = useState(1);
  const [scheduleDayIndex, setScheduleDayIndex] = useState(Math.max(0, Math.min(4, new Date().getDay() - 1)));
  const [scheduleConfigOpen, setScheduleConfigOpen] = useState(false);
  const [scheduleConfigDraft, setScheduleConfigDraft] = useState<ScheduleConfig>(data.scheduleConfig ?? defaultScheduleConfig());
  const [focusEditorOpen, setFocusEditorOpen] = useState(false);
  const [focusDraft, setFocusDraft] = useState<DailyFocus>({ id: "", date: today(), focus: "", todo: "", status: "待处理" });
  const [courseEditorOpen, setCourseEditorOpen] = useState(false);
  const [courseDraft, setCourseDraft] = useState({ dayIndex: 0, courses: [] as string[] });
  const [scheduleEditorMessage, setScheduleEditorMessage] = useState("");
  const scheduleDraftBaselines = useRef<Record<"event" | "focus" | "course" | "config", string>>({ event: "", focus: "", course: "", config: "" });
  const [seatingEditorOpen, setSeatingEditorOpen] = useState(false);
  const initialSeatingConfig = sanitizeSeatingConfig(data.seatingConfig, activeClass.students?.length || data.students.length);
  const [seatingDraft, setSeatingDraft] = useState({ rows: String(initialSeatingConfig.rows), columns: String(initialSeatingConfig.columns), groupCount: String(initialSeatingConfig.groupCount), aisleAfter: initialSeatingConfig.aisleAfter.join("，") });
  const [seatStudentId, setSeatStudentId] = useState("");
  const [seatPickerSeat, setSeatPickerSeat] = useState<number | null>(null);
  const [seatAvoidPickerId, setSeatAvoidPickerId] = useState("");
  const [seatSelectedId, setSeatSelectedId] = useState("");
  const [seatLastStudents, setSeatLastStudents] = useState<Student[] | null>(null);
  const [seatMessage, setSeatMessage] = useState("");
  const [dutyDay, setDutyDay] = useState(() => mobileDutyDays.find((day) => sameDutyDay(day, currentWeekday)) ?? mobileDutyDays[0] ?? days[0]);
  const [dutyKeyword, setDutyKeyword] = useState("");
  const [dutyView, setDutyView] = useState<"今日" | "周表" | "岗位" | "台账">("今日");
  const [dutyStatusFilter, setDutyStatusFilter] = useState<"全部" | DutyRecord["status"]>("全部");
  const [dutyAssignTarget, setDutyAssignTarget] = useState<{ day: string; jobId: string } | null>(null);
  const [dutyFixedPickerId, setDutyFixedPickerId] = useState("");
  useEffect(() => { if (!mobileDutyDays.some((day) => sameDutyDay(day, dutyDay))) setDutyDay(mobileDutyDays[0] ?? days[0]); }, [dutyDay, mobileDutyDays, mobileDutyDaysKey]);
  const [recordKeyword, setRecordKeyword] = useState("");
  const [recordTypeFilter, setRecordTypeFilter] = useState("全部类型");
  const [recordStatusFilter, setRecordStatusFilter] = useState<"全部状态" | CommunicationRecord["status"]>("全部状态");
  const [reflectionEditorOpen, setReflectionEditorOpen] = useState(false);
  const [reflectionDraft, setReflectionDraft] = useState<ExamReflection>({ id: "", studentId: activeClass.students[0]?.id ?? data.students[0]?.id ?? "", examId: scoreExamsForClass(data, activeClass.id)[0]?.id, date: today(), problem: "", reason: "", action: "", familyMessage: "", teacherNote: "", status: "草稿" });
  const [reflectionKeyword, setReflectionKeyword] = useState("");
  const [reflectionStatusFilter, setReflectionStatusFilter] = useState<"全部" | ExamReflection["status"]>("全部");
  const [reflectionExamFilter, setReflectionExamFilter] = useState(scoreExamsForClass(data, activeClass.id)[0]?.id ?? "");
  const [reflectionMobileView, setReflectionMobileView] = useState<"students" | "saved">("students");
  const [reflectionStudentPage, setReflectionStudentPage] = useState(1);
  const [reflectionSavedPage, setReflectionSavedPage] = useState(1);
  const [commentEditorOpen, setCommentEditorOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState<TermComment>({ id: "", studentId: activeClass.students[0]?.id ?? data.students[0]?.id ?? "", term: scheduleTermLabel(data.scheduleConfig, activeClass.term || "当前学期"), style: "家长可读", content: "", updatedAt: today() });
  const [commentKeyword, setCommentKeyword] = useState("");
  const [commentTermFilter, setCommentTermFilter] = useState(scheduleTermLabel(data.scheduleConfig, activeClass.term || "当前学期"));
  const [commentPage, setCommentPage] = useState(1);
  const [commentView, setCommentView] = useState<"students" | "saved">("students");
  const [commentStudentKeyword, setCommentStudentKeyword] = useState("");
  const [commentGroupFilter, setCommentGroupFilter] = useState("全部小组");
  const [commentPendingPage, setCommentPendingPage] = useState(1);
  const [commentEvidenceOpen, setCommentEvidenceOpen] = useState(false);
  const [commentTeacherInput, setCommentTeacherInput] = useState("");
  const [commentEditorMessage, setCommentEditorMessage] = useState("");
  const [commentAiBusy, setCommentAiBusy] = useState(false);
  const [commentAiError, setCommentAiError] = useState("");
  const [commentSelectedRecordIds, setCommentSelectedRecordIds] = useState<string[]>([]);
  const [commentSelectedReflectionIds, setCommentSelectedReflectionIds] = useState<string[]>([]);
  const [commentSelectedEventIds, setCommentSelectedEventIds] = useState<string[]>([]);
  const [ruleKeyword, setRuleKeyword] = useState("");
  const [ruleCategory, setRuleCategory] = useState("全部");
  const [ruleStatusFilter, setRuleStatusFilter] = useState<"全部状态" | "启用" | "停用">("全部状态");
  const [cadreView, setCadreView] = useState<"全部" | "班委" | "小组长">("全部");
  const [cadreKeyword, setCadreKeyword] = useState("");
  const [cadreScopeFilter, setCadreScopeFilter] = useState("全部");
  const [cadreStudentPickerId, setCadreStudentPickerId] = useState("");
  const [recordDraft, setRecordDraft] = useState({ studentId: activeClass.students[0]?.id ?? data.students[0]?.id ?? "", student: activeClass.students[0]?.name ?? data.students[0]?.name ?? "", type: "家校沟通", channel: "微信", date: localCommunicationDate(), purpose: "沟通情况补录", home: "", content: "", opinion: "", followUp: "" });
  const [ruleDraft, setRuleDraft] = useState<PointRule>({ id: "", scene: "课堂", title: "", reason: "", delta: 1, owner: "班主任", enabled: true, level: "自定义", detail: "" });
  const [dutyDraft, setDutyDraft] = useState<DutyJob>({ id: "", name: "", area: "", standard: "", studentIds: [], enabled: true });
  const [cadreDraft, setCadreDraft] = useState<CadreRole>({ id: "", role: "", studentId: activeClass.students[0]?.id ?? data.students[0]?.id ?? "", duty: "", scope: "班级管理", term: activeClass.term || "本学期", status: "在任", weeklyScore: 4, summary: "" });
  const students = activeClass.students?.length ? activeClass.students : data.students;
  const mobileReflectionExams = scoreExamsForClass(data, activeClass.id);
  const mobileReflectionExamIdsKey = mobileReflectionExams.map((item) => item.id).join("|");
  const firstMobileReflectionExamId = mobileReflectionExams[0]?.id ?? "";
  useEffect(() => {
    if (mobileReflectionExamIdsKey.split("|").includes(reflectionExamFilter)) return;
    setReflectionExamFilter(firstMobileReflectionExamId);
    setReflectionStudentPage(1);
  }, [firstMobileReflectionExamId, mobileReflectionExamIdsKey, reflectionExamFilter]);
  const studentName = (id: string) => students.find((student) => student.id === id)?.name ?? "未选择学生";
  const title = workspaceModules.find((item) => item.id === active)?.label ?? "更多工具";
  const records = communicationRecordsForClass(data, activeClass.id);
  const events = pointEventsForClass(data, activeClass.id);
  const evidence = (data.growthEvidence ?? []).filter((item) => item.source !== "家校沟通" && students.some((student) => student.id === item.studentId));
  const reflections = examReflectionsForClass(data, activeClass.id);
  const comments = termCommentsForClass(data, activeClass.id);
  const dutyJobs = data.dutyJobs ?? [];
  const dutyRecords = (data.dutyRecords ?? []).filter((record) => !record.classId || record.classId === activeClass.id);
  const cadres = data.cadres ?? [];
  const selectedPointRule = availablePointRules.find((rule) => rule.id === pointDraft.ruleId) ?? firstPointRule;
  const pointGroups = Array.from(new Set(students.map((student) => student.group))).sort((a, b) => a - b);
  const filteredPointStudents = students.filter((student) => {
    const text = `${student.name}${student.studentNo ?? ""}第${student.group}组${student.points}`;
    const groupOk = pointGroupFilter === "全部小组" || student.group === Number(pointGroupFilter);
    return groupOk && (!pointStudentKeyword.trim() || text.includes(pointStudentKeyword.trim()));
  }).sort((a, b) => {
    if (pointSort === "积分低优先") return a.points - b.points;
    if (pointSort === "姓名") return a.name.localeCompare(b.name, "zh-CN");
    if (pointSort === "小组") return a.group - b.group || a.seat - b.seat || a.name.localeCompare(b.name, "zh-CN");
    return b.points - a.points;
  });
  const allPointFilteredSelected = filteredPointStudents.length > 0 && filteredPointStudents.every((student) => selectedPointIds.includes(student.id));

  function openStudentSheet(student: Student) {
    setDetail({
      title: student.name,
      children: <>
        <div className="mobile-detail-grid">
          <span><small>积分</small><b>{student.points}</b></span>
          <span><small>小组</small><b>第{student.group}组</b></span>
          <span><small>学号</small><b>{student.studentNo || "未填"}</b></span>
          <span><small>座位</small><b>{student.seat || "未填"}</b></span>
        </div>
        <div className="mobile-sheet-section"><h3>备注</h3><p>{student.note || "暂无备注"}</p></div>
      </>,
    });
  }
  function togglePointStudent(studentId: string) {
    setSelectedPointIds((ids) => ids.includes(studentId) ? ids.filter((id) => id !== studentId) : [...ids, studentId]);
  }
  function toggleFilteredPointStudents() {
    const ids = filteredPointStudents.map((student) => student.id);
    setSelectedPointIds((current) => allPointFilteredSelected ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids])));
  }
  function savePointEvent() {
    const value = Number(pointDraft.delta) || 0;
    if (!selectedPointIds.length || !selectedPointRule || value === 0) {
      notify("请选择学生和积分规则，分值不能为 0", "error");
      return;
    }
    const stamp = new Date().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    update((current) => applyPointEvents(current, activeClass.id, selectedPointIds, selectedPointRule, value, pointDraft.note, pointDraft.operator, stamp, makeId));
    setPointDraft((current) => ({ ...current, note: "" }));
    setSelectedPointIds([]);
    setQuickPointOpen(false);
    notify("积分记录已添加", "success");
  }
  function undoPointEvent(event: PointEvent) {
    update((current) => undoPointEventInClass(current, activeClass.id, event.id));
    notify("积分记录已撤销", "success");
  }
  function saveRecord() {
    const draft = {
      id: editingRecordId || undefined,
      studentId: recordDraft.studentId,
      type: recordDraft.type,
      channel: recordDraft.channel,
      date: recordDraft.date,
      purpose: recordDraft.purpose,
      home: recordDraft.home,
      content: recordDraft.content,
      parentFeedback: recordDraft.opinion,
      followUp: recordDraft.followUp,
    };
    const preview = saveCommunicationRecord(data, activeClass.id, draft, () => "record-preview");
    if (preview.error) { notify(preview.error, "error"); return; }
    update((current) => saveCommunicationRecord(current, activeClass.id, draft, makeId).data ?? current);
    setRecordDraft((current) => ({ ...current, date: localCommunicationDate(), home: "", content: "", opinion: "", followUp: "" }));
    setEditingRecordId("");
    setQuickRecordOpen(false);
    notify(editingRecordId ? "沟通记录已更新" : "沟通记录已添加", "success");
  }
  function openRecordEditor(record?: CommunicationRecord) {
    if (!record) {
      setEditingRecordId("");
      setRecordDraft({ studentId: students[0]?.id ?? "", student: students[0]?.name ?? "", type: "家校沟通", channel: "微信", date: localCommunicationDate(), purpose: "沟通情况补录", home: "", content: "", opinion: "", followUp: "" });
      setQuickRecordOpen(true);
      return;
    }
    setDetail(null);
    setEditingRecordId(record.id);
    const parts = record.content.split("｜");
    const recordStudent = students.find((student) => student.id === record.studentId) ?? students.find((student) => student.name === record.student);
    setRecordDraft({
      studentId: recordStudent?.id ?? "",
      student: recordStudent?.name ?? record.student,
      type: record.type,
      channel: record.channel ?? "微信",
      date: record.date || localCommunicationDate(),
      purpose: parts.find((part) => part.startsWith("目的："))?.replace("目的：", "") || "沟通情况补录",
      home: parts.find((part) => part.startsWith("家庭情况："))?.replace("家庭情况：", "") || "",
      content: parts.find((part) => part.startsWith("沟通内容："))?.replace("沟通内容：", "") || record.content,
      opinion: record.parentFeedback ?? "",
      followUp: record.followUp ?? "",
    });
    setQuickRecordOpen(true);
  }
  function patchRecordStatus(recordId: string, status: CommunicationRecord["status"]) {
    update((current) => patchCommunicationStatus(current, activeClass.id, recordId, status));
    notify("沟通状态已更新", "success");
  }
  async function deleteRecordMobile(recordId: string) {
    if (!await requestDangerConfirm("确认删除这条沟通记录？")) return;
    update((current) => removeCommunicationRecord(current, activeClass.id, recordId));
    setDetail(null);
    notify("沟通记录已删除", "success");
  }
  function openRuleEditor(rule?: PointRule) {
    setDetail(null);
    setRuleDraft(rule ? { ...rule } : { id: "", scene: "课堂", title: "", reason: "", delta: 1, owner: "班主任", enabled: true, level: "自定义", detail: "" });
    setRuleEditorOpen(true);
  }
  function saveRuleDraft() {
    if (!ruleDraft.title.trim() || !ruleDraft.reason.trim()) {
      notify("请填写规则名称和理由", "error");
      return;
    }
    const nextRule: PointRule = { ...ruleDraft, id: ruleDraft.id || makeId(), title: ruleDraft.title.trim(), reason: ruleDraft.reason.trim(), delta: Number(ruleDraft.delta) || 0, owner: ruleDraft.owner.trim() || "班主任" };
    update((current) => upsertPointRule(current, nextRule));
    setRuleEditorOpen(false);
    notify("积分规则已保存", "success");
  }
  function toggleRuleEnabled(rule: PointRule) {
    update((current) => patchPointRule(current, rule.id, { enabled: rule.enabled === false }));
    notify("规则状态已更新", "success");
  }
  function copyRuleMobile(rule: PointRule) {
    const copied: PointRule = { ...rule, id: makeId(), title: `${rule.title} 副本`, enabled: true, level: "自定义" };
    update((current) => replacePointRules(current, [copied, ...pointRulesForData(current)]));
    notify("规则已复制", "success");
  }
  async function deleteRuleMobile(rule: PointRule) {
    if (!await requestDangerConfirm(`确认删除规则“${rule.title}”？历史积分记录不会删除。`)) return;
    update((current) => deletePointRule(current, rule.id));
    setDetail(null);
    notify("规则已删除", "success");
  }
  function openDutyEditor(job?: DutyJob) {
    setDetail(null);
    setDutyDraft(job ? { ...job, studentIds: job.studentIds ?? [] } : { id: "", name: "", area: "", standard: "", studentIds: [], enabled: true });
    setDutyEditorOpen(true);
  }
  function saveDutyDraft() {
    if (!dutyDraft.name.trim() || !dutyDraft.area.trim() || !dutyDraft.standard.trim()) {
      notify("请填写岗位、区域和标准", "error");
      return;
    }
    const nextJob: DutyJob = { ...dutyDraft, id: dutyDraft.id || makeId(), name: dutyDraft.name.trim(), area: dutyDraft.area.trim(), standard: dutyDraft.standard.trim(), studentIds: dutyDraft.studentIds ?? [] };
    update((current) => {
      const jobs = current.dutyJobs ?? [];
      return { ...current, dutyJobs: jobs.some((job) => job.id === nextJob.id) ? jobs.map((job) => job.id === nextJob.id ? nextJob : job) : [nextJob, ...jobs] };
    });
    setDutyEditorOpen(false);
    notify("值日岗位已保存", "success");
  }
  function openCadreEditor(role?: CadreRole) {
    setDetail(null);
    setCadreDraft(role ? { ...role } : { id: "", role: "", studentId: students[0]?.id ?? "", duty: "", scope: "班级管理", term: activeClass.term || "本学期", status: "在任", weeklyScore: 4, summary: "" });
    setCadreEditorOpen(true);
  }
  function saveCadreDraft() {
    if (!cadreDraft.role.trim() || !cadreDraft.studentId || !cadreDraft.duty.trim()) {
      notify("请填写岗位、学生和职责", "error");
      return;
    }
    const nextRole: CadreRole = { ...cadreDraft, id: cadreDraft.id || makeId(), role: cadreDraft.role.trim(), duty: cadreDraft.duty.trim(), weeklyScore: Number(cadreDraft.weeklyScore) || 0 };
    update((current) => {
      const roles = current.cadres ?? [];
      return { ...current, cadres: roles.some((role) => role.id === nextRole.id) ? roles.map((role) => role.id === nextRole.id ? nextRole : role) : [nextRole, ...roles] };
    });
    setCadreEditorOpen(false);
    notify("班干部岗位已保存", "success");
  }
  async function deleteCadreMobile(role: CadreRole) {
    if (!await requestDangerConfirm(`确认删除“${role.role}”？`)) return;
    update((current) => ({ ...current, cadres: (current.cadres ?? []).filter((item) => item.id !== role.id) }));
    setDetail(null);
    notify("班干部岗位已删除", "success");
  }
  function mobileWeekMeta(offset = 0) {
    const monday = new Date();
    const currentDay = monday.getDay() || 7;
    monday.setDate(monday.getDate() - currentDay + 1 + offset * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const short = (date: Date) => `${date.getMonth() + 1}月${date.getDate()}日`;
    const weekNumber = Math.ceil((((monday.getTime() - new Date(monday.getFullYear(), 0, 1).getTime()) / 86400000) + new Date(monday.getFullYear(), 0, 1).getDay() + 1) / 7);
    return { weekStart: iso(monday), weekEnd: iso(sunday), label: `${short(monday)} 至 ${short(sunday)}`, weekNumber };
  }
  function generateWeeklyText(offset: number, edition: WeeklyReport["edition"], title: string, nextFocusText: string) {
    const meta = mobileWeekMeta(offset);
    const weekTasks = (data.homeworkTasks ?? []).filter((task) => (!task.classId || task.classId === activeClass.id) && task.date >= meta.weekStart && task.date <= meta.weekEnd);
    const homeworkMetrics = weeklyHomeworkMetrics(weekTasks, students);
    const averageScore = students.length ? Math.round(students.reduce((sum, student) => sum + student.score, 0) / students.length) : 0;
    const reportPointEvents = weeklyPointEventsForClass(data, activeClass.id, students, meta.weekStart, meta.weekEnd);
    const positiveRows = weeklyPositiveRows(reportPointEvents, students).slice(0, 4);
    const follow = weeklyFollowRows(data, activeClass.id, students, weekTasks, meta.weekStart, meta.weekEnd).slice(0, 8);
    const reportRecords = weeklyActivityRows(data, activeClass.id, students, records, meta.weekStart, meta.weekEnd).slice(0, 5);
    return [
      title || `${activeClass.name} · 第${meta.weekNumber}周班级周报`,
      meta.label,
      "【本周概况】",
      `本周记录 ${weekTasks.length} 项作业，已记录人次完成率 ${homeworkMetrics.completionRate}%；班级当前平均分 ${averageScore} 分，记录 ${reportPointEvents.filter((event) => event.delta > 0).length} 次正向表现。`,
      "【值得表扬】",
      positiveRows.length ? `${positiveRows.map((item) => `${item.student.name}（本周 +${item.delta}，${item.reason}）`).join("、")}。` : "本周暂无带日期的正向积分记录。",
      edition === "家长版" ? "【温馨提醒】" : "【重点跟进】",
      edition === "家长版" ? `已有记录中仍有 ${homeworkMetrics.missing} 人次未交、${homeworkMetrics.fixing} 人次待订正，请家长协助孩子及时完成学习闭环。` : (follow.length ? `${follow.map((item) => item.student.name).join("、")} 需要继续跟进本周已有记录。` : "本周暂无有日期依据的重点跟进学生。"),
      reportRecords.length ? "【家校与成长记录】\n" + reportRecords.map((record) => `${record.student}：${record.content}`).join("\n") : "",
      "【下周行动】",
      nextFocusText.trim() || (data.weeklyPlan ?? []).map((item) => `${item.day}：${item.focus}，${item.event}`).join("\n") || "继续关注作业习惯、课堂参与和自我管理。",
    ].filter(Boolean).join("\n\n");
  }
  function openWeeklyEditorMobile(report?: WeeklyReport) {
    setWeeklyEditorMessage("");
    if (report) {
      const currentMonday = new Date();
      const currentDay = currentMonday.getDay() || 7;
      currentMonday.setDate(currentMonday.getDate() - currentDay + 1);
      currentMonday.setHours(0, 0, 0, 0);
      const offset = Math.round((new Date(`${report.weekStart}T00:00:00`).getTime() - currentMonday.getTime()) / 604800000);
      setWeeklyDraft({ id: report.id, weekOffset: offset, edition: report.edition, title: report.title ?? `${activeClass.name}班级周报`, content: report.content, nextFocus: report.nextFocus });
    } else {
      const meta = mobileWeekMeta(weeklyOffset);
      const titleText = `${activeClass.name} · 第${meta.weekNumber}周班级周报`;
      const nextFocusText = (data.weeklyPlan ?? []).map((item) => `${item.day}：${item.focus}，${item.event}`).join("\n");
      setWeeklyDraft({ id: "", weekOffset: weeklyOffset, edition: "家长版", title: titleText, content: "", nextFocus: nextFocusText });
    }
    setWeeklyEditorOpen(true);
  }
  function saveWeeklyReportMobile(status: NonNullable<WeeklyReport["status"]>) {
    if (readOnly) {
      setWeeklyEditorMessage("当前为只读模式，周报内容未修改");
      return;
    }
    const meta = mobileWeekMeta(weeklyDraft.weekOffset);
    const content = weeklyDraft.content.trim() || generateWeeklyText(weeklyDraft.weekOffset, weeklyDraft.edition, weeklyDraft.title, weeklyDraft.nextFocus);
    const reportId = weeklyDraft.id || makeId();
    const nowIso = new Date().toISOString();
    const input = { id: reportId, weekStart: meta.weekStart, weekEnd: meta.weekEnd, edition: weeklyDraft.edition, title: weeklyDraft.title.trim() || `${activeClass.name} · 第${meta.weekNumber}周班级周报`, content, nextFocus: weeklyDraft.nextFocus };
    const preview = saveWeeklyReport(data, activeClass.id, input, status, () => reportId, nowIso);
    if (preview.error) {
      setWeeklyEditorMessage(preview.error);
      return;
    }
    update((current) => saveWeeklyReport(current, activeClass.id, input, status, () => reportId, nowIso).data ?? current);
    setWeeklyEditorOpen(false);
    setWeeklyDraft({ id: "", weekOffset: 0, edition: "家长版", title: "", content: "", nextFocus: "" });
    notify(status === "已归档" ? "周报已归档，正在同步" : "周报草稿已更新，正在同步", "info");
  }
  function openScheduleEditor(event?: ScheduleEvent) {
    setDetail(null);
    const range = getMobileScheduleContext().weekDates;
    const draft = event ? { ...event } : { id: "", date: range.startDate, title: "", type: "班会" as const, detail: "" };
    setScheduleDraft(draft);
    scheduleDraftBaselines.current.event = JSON.stringify(draft);
    setScheduleEditorMessage("");
    setScheduleEditorOpen(true);
  }
  function getMobileScheduleContext(source: ClassroomData = data) {
    const baseConfig = source.scheduleConfig ?? defaultScheduleConfig();
    const monthOptions = scheduleTermMonths(baseConfig);
    const activeMonth = monthOptions.includes(scheduleMonth) ? scheduleMonth : monthOptions[0] ?? today().slice(0, 7);
    const safeWeek = Math.min(scheduleWeekNo, getScheduleWeeksInMonth(activeMonth));
    const weekDates = getScheduleWeekDates(activeMonth, safeWeek);
    const storedWeek = (source.scheduleWeeks ?? []).find((week) => week.month === activeMonth && week.weekOfMonth === safeWeek);
    const config = storedWeek?.config ?? baseConfig;
    const courses = normalizeMobileCourses(storedWeek?.courses ?? source.courses, config);
    const weekEvents = storedWeek?.events ?? (source.scheduleEvents ?? []).filter((event) => event.date >= weekDates.startDate && event.date <= weekDates.endDate);
    const weekFocuses = storedWeek?.focuses ?? (source.dailyFocus ?? []).filter((item) => item.date >= weekDates.startDate && item.date <= weekDates.endDate);
    return { baseConfig, monthOptions, activeMonth, safeWeek, weekDates, storedWeek, config, courses, weekEvents, weekFocuses };
  }
  function saveMobileScheduleWeek(patch: Partial<Pick<ScheduleWeek, "config" | "courses" | "events" | "focuses">>, source: ClassroomData) {
    const context = getMobileScheduleContext(source);
    const config = patch.config ?? context.config;
    return saveClassScheduleWeek(source, activeClass.id, {
      month: context.activeMonth,
      weekOfMonth: context.safeWeek,
      config,
      courses: normalizeMobileCourses(patch.courses ?? context.courses, config),
      events: patch.events ?? context.weekEvents,
      focuses: patch.focuses ?? context.weekFocuses,
    });
  }
  function saveScheduleEventMobile() {
    if (readOnly) {
      setScheduleEditorMessage("当前为只读模式，日程未保存。");
      return;
    }
    const next: ScheduleEvent = { ...scheduleDraft, id: scheduleDraft.id || makeId(), title: scheduleDraft.title.trim(), detail: scheduleDraft.detail.trim() };
    const context = getMobileScheduleContext(data);
    const events = context.weekEvents.some((item) => item.id === next.id) ? context.weekEvents.map((item) => item.id === next.id ? next : item) : [next, ...context.weekEvents];
    const preview = saveMobileScheduleWeek({ events }, data);
    if (preview.error) {
      setScheduleEditorMessage(preview.error);
      return;
    }
    update((current) => {
      const currentContext = getMobileScheduleContext(current);
      const currentEvents = currentContext.weekEvents.some((item) => item.id === next.id) ? currentContext.weekEvents.map((item) => item.id === next.id ? next : item) : [next, ...currentContext.weekEvents];
      return saveMobileScheduleWeek({ events: currentEvents }, current).data ?? current;
    });
    setScheduleDraft(preview.week!.events.find((item) => item.id === next.id) ?? next);
    scheduleDraftBaselines.current.event = JSON.stringify(preview.week!.events.find((item) => item.id === next.id) ?? next);
    setScheduleEditorMessage("日程已更新，正在同步。确认无误后可关闭。");
  }
  async function deleteScheduleEventMobile(eventId: string) {
    if (readOnly) {
      notify("当前为只读模式，日程未删除", "error");
      return;
    }
    if (!await requestDangerConfirm("确认删除这条日程事件？")) return;
    const context = getMobileScheduleContext(data);
    const preview = saveMobileScheduleWeek({ events: context.weekEvents.filter((event) => event.id !== eventId) }, data);
    if (preview.error) {
      notify(preview.error, "error");
      return;
    }
    update((current) => {
      const currentContext = getMobileScheduleContext(current);
      return saveMobileScheduleWeek({ events: currentContext.weekEvents.filter((event) => event.id !== eventId) }, current).data ?? current;
    });
    setDetail(null);
    notify("日程事件已删除", "success");
  }
  function openFocusEditor(item?: DailyFocus) {
    setDetail(null);
    const range = getMobileScheduleContext().weekDates;
    const draft = item ? { ...item } : { id: "", date: range.startDate, focus: "", todo: "", status: "待处理" as const };
    setFocusDraft(draft);
    scheduleDraftBaselines.current.focus = JSON.stringify(draft);
    setScheduleEditorMessage("");
    setFocusEditorOpen(true);
  }
  function saveFocusMobile() {
    if (readOnly) {
      setScheduleEditorMessage("当前为只读模式，每日重点未保存。");
      return;
    }
    const next: DailyFocus = { ...focusDraft, id: focusDraft.id || makeId(), focus: focusDraft.focus.trim() || "本周重点", todo: focusDraft.todo.trim() };
    const context = getMobileScheduleContext(data);
    const focuses = context.weekFocuses.some((item) => item.id === next.id) ? context.weekFocuses.map((item) => item.id === next.id ? next : item) : [next, ...context.weekFocuses];
    const preview = saveMobileScheduleWeek({ focuses }, data);
    if (preview.error) {
      setScheduleEditorMessage(preview.error);
      return;
    }
    update((current) => {
      const currentContext = getMobileScheduleContext(current);
      const currentFocuses = currentContext.weekFocuses.some((item) => item.id === next.id) ? currentContext.weekFocuses.map((item) => item.id === next.id ? next : item) : [next, ...currentContext.weekFocuses];
      return saveMobileScheduleWeek({ focuses: currentFocuses }, current).data ?? current;
    });
    setFocusDraft(preview.week!.focuses.find((item) => item.id === next.id) ?? next);
    scheduleDraftBaselines.current.focus = JSON.stringify(preview.week!.focuses.find((item) => item.id === next.id) ?? next);
    setScheduleEditorMessage("每日重点已更新，正在同步。确认无误后可关闭。");
  }
  async function deleteFocusMobile(focusId: string) {
    if (readOnly) {
      notify("当前为只读模式，每日重点未删除", "error");
      return;
    }
    if (!await requestDangerConfirm("确认删除这条每日重点？")) return;
    const context = getMobileScheduleContext(data);
    const preview = saveMobileScheduleWeek({ focuses: context.weekFocuses.filter((item) => item.id !== focusId) }, data);
    if (preview.error) {
      notify(preview.error, "error");
      return;
    }
    update((current) => {
      const currentContext = getMobileScheduleContext(current);
      return saveMobileScheduleWeek({ focuses: currentContext.weekFocuses.filter((item) => item.id !== focusId) }, current).data ?? current;
    });
    setDetail(null);
    notify("每日重点已删除", "success");
  }
  function openCourseEditor(dayIndex: number, courses: string[]) {
    const draft = { dayIndex, courses };
    setCourseDraft(draft);
    scheduleDraftBaselines.current.course = JSON.stringify(draft);
    setScheduleEditorMessage("");
    setCourseEditorOpen(true);
  }
  function saveCourseDayMobile() {
    if (readOnly) {
      setScheduleEditorMessage("当前为只读模式，课程未保存。");
      return;
    }
    const context = getMobileScheduleContext(data);
    const courses = context.courses.map((row, index) => index === courseDraft.dayIndex ? courseDraft.courses.map((item) => item.trim()) : row);
    const preview = saveMobileScheduleWeek({ courses }, data);
    if (preview.error) {
      setScheduleEditorMessage(preview.error);
      return;
    }
    update((current) => {
      const currentContext = getMobileScheduleContext(current);
      const currentCourses = currentContext.courses.map((row, index) => index === courseDraft.dayIndex ? courseDraft.courses.map((item) => item.trim()) : row);
      return saveMobileScheduleWeek({ courses: currentCourses }, current).data ?? current;
    });
    const savedDraft = { dayIndex: courseDraft.dayIndex, courses: preview.week!.courses[courseDraft.dayIndex] ?? [] };
    setCourseDraft(savedDraft);
    scheduleDraftBaselines.current.course = JSON.stringify(savedDraft);
    setScheduleEditorMessage("当天课程已更新，正在同步。确认无误后可关闭。");
  }
  function saveScheduleConfigMobile() {
    if (readOnly) {
      setScheduleEditorMessage("当前为只读模式，学期配置未保存。");
      return;
    }
    const preview = saveScheduleTermConfig(data, activeClass.id, scheduleConfigDraft);
    if (preview.error) {
      setScheduleEditorMessage(preview.error);
      return;
    }
    const nextConfig = preview.data!.scheduleConfig ?? scheduleConfigDraft;
    update((current) => saveScheduleTermConfig(current, activeClass.id, scheduleConfigDraft).data ?? current);
    const monthOptions = scheduleTermMonths(nextConfig);
    const nextMonth = monthOptions.includes(scheduleMonth) ? scheduleMonth : monthOptions[0] ?? scheduleMonth;
    setScheduleConfigDraft(nextConfig);
    scheduleDraftBaselines.current.config = JSON.stringify(nextConfig);
    setScheduleMonth(nextMonth);
    setScheduleWeekNo((week) => Math.min(week, getScheduleWeeksInMonth(nextMonth)));
    setScheduleEditorMessage("学期配置已更新，正在同步。确认无误后可关闭。");
  }
  async function closeMobileScheduleEditor(kind: "event" | "focus" | "course" | "config") {
    const draft = kind === "event" ? scheduleDraft : kind === "focus" ? focusDraft : kind === "course" ? courseDraft : scheduleConfigDraft;
    if (JSON.stringify(draft) !== scheduleDraftBaselines.current[kind] && !await requestDangerConfirm("当前内容尚未保存，确认关闭并放弃这些修改？", "放弃未保存修改", "放弃修改")) return;
    if (kind === "event") setScheduleEditorOpen(false);
    if (kind === "focus") setFocusEditorOpen(false);
    if (kind === "course") setCourseEditorOpen(false);
    if (kind === "config") setScheduleConfigOpen(false);
  }
  function openSeatingConfigMobile(config?: SeatingConfig) {
    const safeConfig = sanitizeSeatingConfig(config ?? data.seatingConfig, students.length);
    setSeatingDraft({ rows: String(safeConfig.rows), columns: String(safeConfig.columns), groupCount: String(safeConfig.groupCount), aisleAfter: safeConfig.aisleAfter.join("，") });
    setSeatingEditorOpen(true);
  }
  function syncMobileSeatStudents(current: ClassroomData, nextStudents: Student[]) {
    const currentClasses = current.rosterClasses?.length ? current.rosterClasses : [{ id: activeClass.id, name: activeClass.name, grade: activeClass.grade, term: activeClass.term, students: current.students }];
    return {
      ...current,
      students: nextStudents,
      rosterClasses: currentClasses.map((item) => item.id === activeClass.id ? { ...item, students: nextStudents } : item),
    };
  }
  function saveSeatingConfigMobile() {
    const parsedColumns = Number.parseInt(seatingDraft.columns, 10);
    const parsedRows = Number.parseInt(seatingDraft.rows, 10);
    const parsedGroupCount = Number.parseInt(seatingDraft.groupCount, 10);
    if (!Number.isFinite(parsedColumns) || !Number.isFinite(parsedRows) || !Number.isFinite(parsedGroupCount)) {
      notify("请填写有效的行数、列数和小组数", "error");
      return;
    }
    const columns = Math.max(2, Math.min(10, parsedColumns));
    const minRows = Math.max(1, Math.ceil(students.length / columns));
    const rows = Math.max(minRows, Math.min(12, parsedRows));
    const groupCount = Math.max(1, Math.min(12, parsedGroupCount));
    const aisleAfter = Array.from(new Set(seatingDraft.aisleAfter.split(/[，,、\s]+/).map((item) => Number.parseInt(item, 10)).filter((item) => Number.isFinite(item) && item > 0 && item < columns)));
    update((current) => {
      const seatingConfig = { rows, columns, groupCount, aisleAfter };
      return syncMobileSeatStudents({ ...current, seatingConfig }, current.students.map((student) => ({ ...student, group: seatGroupFor(student.seat, seatingConfig) })));
    });
    setSeatingDraft({ rows: String(rows), columns: String(columns), groupCount: String(groupCount), aisleAfter: aisleAfter.join("，") });
    setSeatingEditorOpen(false);
    notify(rows !== parsedRows ? `座位配置已保存。当前人数至少需要 ${rows} 行` : "座位配置已保存", "success");
  }
  function patchSeatStudent(studentId: string, patch: Partial<Student>) {
    update((current) => syncMobileSeatStudents(current, current.students.map((student) => student.id === studentId ? { ...student, ...patch } : student)));
    notify("座位信息已更新", "success");
  }
  function seatGroupFor(seat: number, config: SeatingConfig) {
    const column = (seat - 1) % config.columns;
    if (config.groupCount <= config.columns) return Math.min(config.groupCount, Math.floor(column * config.groupCount / config.columns) + 1);
    return Math.min(config.groupCount, Math.floor((seat - 1) * config.groupCount / (config.rows * config.columns)) + 1);
  }
  function mobileSeatRemember() {
    setSeatLastStudents(students.map((student) => ({ ...student })));
  }
  function swapMobileSeat(studentId: string, targetSeat: number, config: SeatingConfig) {
    const capacity = config.rows * config.columns;
    if (targetSeat < 1 || targetSeat > capacity) return;
    mobileSeatRemember();
    update((current) => {
      const first = current.students.find((item) => item.id === studentId);
      const second = current.students.find((item) => item.seat === targetSeat);
      if (!first || first.seat === targetSeat) return current;
      const nextStudents = current.students.map((item) => {
        if (item.id === first.id) return { ...item, seat: targetSeat, group: seatGroupFor(targetSeat, config) };
        if (second && item.id === second.id) return { ...item, seat: first.seat, group: seatGroupFor(first.seat, config) };
        return item;
      });
      return syncMobileSeatStudents(current, nextStudents);
    });
    setSeatSelectedId("");
    setSeatMessage("座位已调整");
    notify("座位已调整", "success");
  }
  function assignMobileStudentToSeat(studentId: string, targetSeat: number, config: SeatingConfig) {
    const student = students.find((item) => item.id === studentId);
    if (!student) {
      notify("没有找到这个学生", "error");
      return;
    }
    if (student.seat === targetSeat) {
      setSeatPickerSeat(null);
      setSeatStudentId("");
      setSeatMessage(`${student.name} 已在这个座位`);
      return;
    }
    swapMobileSeat(studentId, targetSeat, config);
    setSeatPickerSeat(null);
    setSeatStudentId("");
  }
  function chooseMobileSeat(seat: number, student: Student | undefined, config: SeatingConfig) {
    if (!seatSelectedId) {
      if (!student) {
        setSeatMessage("请先选择要移动的学生");
        return;
      }
      setSeatSelectedId(student.id);
      setSeatMessage(`已选择 ${student.name}，再点目标座位`);
      return;
    }
    if (seatSelectedId === student?.id) {
      setSeatSelectedId("");
      setSeatMessage("已取消选择");
      return;
    }
    swapMobileSeat(seatSelectedId, seat, config);
  }
  function rotateMobileSeats(config: SeatingConfig) {
    mobileSeatRemember();
    update((current) => {
      const fixedSeats = new Set(current.students.filter((student) => student.seatFixed).map((student) => student.seat));
      const movable = [...current.students].filter((student) => !student.seatFixed).sort((a, b) => a.seat - b.seat);
      const targetSeats = movable.map((student) => student.seat).filter((seat) => !fixedSeats.has(seat));
      const shift = Math.min(config.columns, Math.max(1, targetSeats.length - 1));
      const targetById = new Map(movable.map((student, index) => [student.id, targetSeats[(index - shift + targetSeats.length) % targetSeats.length]]));
      const nextStudents = current.students.map((student) => {
        const seat = targetById.get(student.id) ?? student.seat;
        return { ...student, seat, group: seatGroupFor(seat, config) };
      });
      return syncMobileSeatStudents(current, nextStudents);
    });
    setSeatSelectedId("");
    setSeatMessage("已完成前后排轮换，固定座位未移动");
    notify("已完成前后排轮换", "success");
  }
  function regroupMobileSeats(config: SeatingConfig) {
    mobileSeatRemember();
    update((current) => syncMobileSeatStudents(current, current.students.map((student) => ({ ...student, group: seatGroupFor(student.seat, config) }))));
    setSeatMessage("已按当前座位重新分组");
    notify("已按座位重新分组", "success");
  }
  function undoMobileSeat() {
    if (!seatLastStudents) return;
    update((current) => syncMobileSeatStudents(current, seatLastStudents));
    setSeatLastStudents(null);
    setSeatSelectedId("");
    setSeatMessage("已撤销上一步座位调整");
    notify("已撤销上一步", "success");
  }
  function setMobileGroupLeader(student: Student) {
    update((current) => syncMobileSeatStudents(current, current.students.map((item) => item.group === student.group ? { ...item, groupLeader: item.id === student.id } : item)));
    setSeatMessage(`${student.name} 已设为第${student.group}组组长`);
    notify("组长已更新", "success");
  }
  function mateMobileSeat(seat: number, config: SeatingConfig) {
    const column = (seat - 1) % config.columns;
    if (column % 2 === 0) return column + 1 < config.columns ? seat + 1 : 0;
    return seat - 1;
  }
  function isMobileAisleSeat(seat: number, config: SeatingConfig) {
    const column = (seat - 1) % config.columns + 1;
    return config.aisleAfter.some((after) => column === after || column === after + 1);
  }
  function smartArrangeMobileSeats(config: SeatingConfig) {
    mobileSeatRemember();
    update((current) => {
      const maxSeat = config.rows * config.columns;
      const allSeats = Array.from({ length: maxSeat }, (_, index) => index + 1);
      const fixedSeats = new Set<number>();
      const fixedIds = new Set<string>();
      const placed = new Map<number, Student>();
      for (const student of current.students) {
        if (student.seatFixed && student.seat >= 1 && student.seat <= maxSeat && !fixedSeats.has(student.seat)) {
          fixedSeats.add(student.seat);
          fixedIds.add(student.id);
          placed.set(student.seat, student);
        }
      }
      const candidates = allSeats.filter((seat) => !fixedSeats.has(seat));
      for (let index = candidates.length - 1; index > 0; index -= 1) {
        const pick = Math.floor(Math.random() * (index + 1));
        [candidates[index], candidates[pick]] = [candidates[pick], candidates[index]];
      }
      const movable = current.students.filter((student) => !fixedIds.has(student.id)).sort((a, b) => {
        const aPriority = a.seatNeed && a.seatNeed !== "无" ? 1 : 0;
        const bPriority = b.seatNeed && b.seatNeed !== "无" ? 1 : 0;
        return bPriority - aPriority || (b.height ?? 0) - (a.height ?? 0);
      });
      const assigned = new Map<string, number>();
      for (const student of movable) {
        const valid = candidates.filter((seat) => {
          const mate = placed.get(mateMobileSeat(seat, config));
          return !mate || (student.avoidWith !== mate.id && mate.avoidWith !== student.id);
        });
        const pool = valid.length ? valid : candidates;
        const ranked = pool.map((seat) => {
          const row = Math.floor((seat - 1) / config.columns) + 1;
          const column = (seat - 1) % config.columns;
          let score = Math.random();
          if (student.seatNeed === "前排") score += (config.rows - row + 1) * 20;
          if (student.seatNeed === "后排") score += row * 20;
          if (student.seatNeed === "靠窗") score += column === 0 || column === config.columns - 1 ? 120 : 0;
          if (student.seatNeed === "靠过道") score += isMobileAisleSeat(seat, config) ? 120 : 0;
          if (student.height) score += row * student.height / 20;
          return { seat, score };
        }).sort((a, b) => b.score - a.score);
        const chosen = ranked[0]?.seat;
        if (!chosen) continue;
        assigned.set(student.id, chosen);
        placed.set(chosen, student);
        candidates.splice(candidates.indexOf(chosen), 1);
      }
      const nextStudents = current.students.map((student) => {
        const seat = assigned.get(student.id) ?? student.seat;
        return { ...student, seat, group: seatGroupFor(seat, config) };
      });
      return syncMobileSeatStudents(current, nextStudents);
    });
    setSeatSelectedId("");
    setSeatMessage("智能排座已完成，固定座和特殊需求已优先处理");
    notify("智能排座已完成", "success");
  }
  function saveDutyRecordMobile(job: DutyJob, status: DutyRecord["status"], note = "") {
    const next: DutyRecord = {
      id: makeId(),
      classId: activeClass.id,
      date: today(),
      day: dutyDay,
      jobId: job.id,
      studentIds: job.studentIds?.length ? job.studentIds : students.filter((student) => student.group === (((mobileDutyDays.indexOf(dutyDay) + (data.dutyOffset ?? 0)) % Math.max(1, ...students.map((item) => item.group))) + 1)).slice(0, 1).map((student) => student.id),
      status,
      note,
      checkedBy: "劳动委员",
      createdAt: Date.now(),
    };
    update((current) => ({ ...current, dutyRecords: [next, ...(current.dutyRecords ?? [])] }));
    notify("值日检查已记录", "success");
  }
  function openReflectionEditor(item?: ExamReflection) {
    setDetail(null);
    const classExamId = reflectionExamFilter || scoreExamsForClass(data, activeClass.id)[0]?.id;
    setReflectionDraft(item ? { ...item, examId: item.examId || classExamId } : { id: "", studentId: students[0]?.id ?? "", examId: classExamId, date: today(), problem: "", reason: "", action: "", familyMessage: "", teacherNote: "", status: "草稿" });
    setReflectionEditorOpen(true);
  }
  function saveReflectionMobile(status: ExamReflection["status"]) {
    if (readOnly) {
      notify("当前为只读模式，反思内容未修改", "info");
      return;
    }
    const reflectionId = reflectionDraft.id || makeId();
    const recordId = makeId();
    const input = { ...reflectionDraft, id: reflectionId };
    const preview = saveExamReflection(data, activeClass.id, input, status, () => reflectionId, () => recordId);
    if (preview.error) {
      notify(preview.error, "error");
      return;
    }
    update((current) => saveExamReflection(current, activeClass.id, input, status, () => reflectionId, () => recordId).data ?? current);
    setReflectionDraft(preview.reflection!);
    setReflectionEditorOpen(false);
    notify(status === "已完成" ? "反思与家校沟通留痕已更新，正在同步" : "反思草稿已更新，正在同步", "info");
  }
  function commentRecordsFor(student: Student) {
    return records.filter((record) => recordBelongsToStudent(record, student, activeClass.id));
  }
  function commentEventsFor(student: Student) {
    return events.filter((event) => event.studentId === student.id);
  }
  function commentReflectionsFor(student: Student) {
    return reflections.filter((item) => item.studentId === student.id);
  }
  function resetMobileCommentEvidence(student: Student) {
    setCommentSelectedRecordIds(commentRecordsFor(student).slice(0, 4).map((item) => item.id));
    setCommentSelectedReflectionIds(commentReflectionsFor(student).slice(0, 3).map((item) => item.id));
    setCommentSelectedEventIds(commentEventsFor(student).slice(0, 4).map((item) => item.id));
  }
  function openCommentEditor(item?: TermComment, studentOverride?: Student) {
    setDetail(null);
    const student = studentOverride ?? students.find((entry) => entry.id === item?.studentId) ?? students[0];
    if (!student) return;
    const style: TermComment["style"] = item?.style ?? "家长可读";
    const term = item?.term ?? (commentTermFilter || scheduleTermLabel(data.scheduleConfig, activeClass.term || "当前学期"));
    resetMobileCommentEvidence(student);
    setCommentTeacherInput("");
    setCommentAiError("");
    setCommentEditorMessage("");
    setCommentDraft(item ? { ...item } : { id: "", classId: activeClass.id, studentId: student.id, term, style, content: "", updatedAt: today() });
    setCommentEditorOpen(true);
  }
  async function closeCommentEditorMobile() {
    if (commentAiBusy) {
      setCommentEditorMessage("AI帮写仍在处理中，请等待完成后再关闭。");
      return;
    }
    const original = commentDraft.id
      ? comments.find(item => item.id === commentDraft.id)
      : comments.find(item => item.studentId === commentDraft.studentId && item.term === commentDraft.term && item.style === commentDraft.style);
    const dirty = commentDraft.content !== (original?.content ?? "") || Boolean(commentTeacherInput.trim());
    if (dirty && !await requestDangerConfirm("关闭后会放弃当前未保存的评语内容和老师补充。", "放弃未保存评语", "放弃并关闭")) return;
    setCommentEditorOpen(false);
    setCommentEvidenceOpen(false);
    setCommentEditorMessage("");
  }
  function saveCommentMobile() {
    if (readOnly) {
      setCommentEditorMessage("当前为只读模式，评语内容未修改。");
      return;
    }
    const commentId = commentDraft.id || makeId();
    const input = { ...commentDraft, id: commentId };
    const preview = saveTermComment(data, activeClass.id, input, () => commentId, today());
    if (preview.error) {
      setCommentEditorMessage(preview.error);
      return;
    }
    update((current) => saveTermComment(current, activeClass.id, input, () => commentId, today()).data ?? current);
    setCommentDraft(preview.comment!);
    setCommentTermFilter(preview.comment!.term);
    setCommentEditorMessage("评语已更新到本机草稿，正在同步；同步失败时可在当前编辑页继续处理。");
    notify("评语已更新，正在同步", "info");
  }
  async function generateCommentMobile() {
    const student = students.find((item) => item.id === commentDraft.studentId);
    if (!student) {
      notify("请选择学生", "error");
      return;
    }
    if (readOnly && workspaceToken !== "demo") {
      setCommentAiError("当前为只读模式，AI帮写不可用。");
      return;
    }
    const selectedRecords = commentRecordsFor(student).filter((item) => commentSelectedRecordIds.includes(item.id));
    const selectedEvents = commentEventsFor(student).filter((item) => commentSelectedEventIds.includes(item.id));
    const selectedReflections = commentReflectionsFor(student).filter((item) => commentSelectedReflectionIds.includes(item.id));
    setCommentAiBusy(true);
    setCommentAiError("");
    try {
      if (!await ensureAiConsent(workspaceToken)) return;
      const response = await fetch("/api/ai/comment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceToken,
          studentName: student.name,
          term: commentDraft.term,
          style: commentDraft.style,
          teacherInput: commentTeacherInput,
          context: {
            records: selectedRecords.map((item) => `${item.date}｜${item.type}｜${item.content}${item.parentFeedback ? `；反馈：${item.parentFeedback}` : ""}${item.followUp ? `；跟进：${item.followUp}` : ""}`),
            events: selectedEvents.map((item) => `${item.date}｜${item.reason}（${item.delta > 0 ? "+" : ""}${item.delta}分）`),
            reflections: selectedReflections.map((item) => `问题：${item.problem}；原因：${item.reason}；行动：${item.action}${item.teacherNote ? `；跟进：${item.teacherNote}` : ""}`),
          },
        }),
      });
      const result = await response.json() as { content?: string; error?: string };
      const content = result.content?.trim();
      if (!response.ok || !content) throw new Error(result.error || "AI生成失败");
      setCommentDraft((current) => ({ ...current, content }));
      notify("AI评语已写入内容框，可继续编辑", "success");
    } catch (error) {
      setCommentAiError(error instanceof Error ? error.message : "AI生成失败");
    } finally {
      setCommentAiBusy(false);
    }
  }

  if (active === "points") {
    const ranked = [...students].sort((a, b) => b.points - a.points);
    const positiveEvents = events.filter((event) => event.delta > 0);
    const negativeEvents = events.filter((event) => event.delta < 0);
    const positiveTotal = positiveEvents.reduce((sum, event) => sum + event.delta, 0);
    const negativeTotal = negativeEvents.reduce((sum, event) => sum + Math.abs(event.delta), 0);
    const participants = new Set(events.map((event) => event.studentId)).size;
    const selectedStudents = students.filter((student) => selectedPointIds.includes(student.id));
    const ruleScenes = ["全部规则", ...Array.from(new Set(availablePointRules.map((rule) => rule.scene)))];
    const shownRules = availablePointRules.filter((rule) => pointRuleScene === "全部规则" || rule.scene === pointRuleScene);
    const pointEventQuery = pointEventKeyword.trim();
    const shownEvents = events.filter((event) => {
      const toneOk = pointEventFilter === "全部记录" || (pointEventFilter === "加分" ? event.delta > 0 : event.delta < 0);
      const text = `${studentName(event.studentId)}${event.scene}${event.reason}${event.operator ?? ""}${event.delta}${event.date}`;
      return toneOk && (!pointEventQuery || text.includes(pointEventQuery));
    });
    const groupStats = pointGroups.map((group) => {
      const members = students.filter((student) => student.group === group);
      const total = members.reduce((sum, student) => sum + student.points, 0);
      const average = members.length ? Math.round(total / members.length) : 0;
      const groupEvents = events.filter((event) => members.some((student) => student.id === event.studentId));
      return { group, members, total, average, events: groupEvents.length };
    }).sort((a, b) => b.average - a.average);
    const openPointStudentSheet = (student: Student, rank: number) => {
      const itemEvents = events.filter((event) => event.studentId === student.id);
      setDetail({
        title: student.name,
        children: <>
          <div className="mobile-detail-grid">
            <span><small>当前积分</small><b>{student.points}</b></span>
            <span><small>班级排名</small><b>{rank}</b></span>
            <span><small>小组</small><b>第{student.group}组</b></span>
            <span><small>事件数</small><b>{itemEvents.length}</b></span>
          </div>
          <div className="mobile-sheet-section"><h3>学生信息</h3><p>学号 {student.studentNo || "未填"} · 座位 {student.seat || "未填"} · {student.note || "暂无备注"}</p></div>
          <section className="mobile-card-list in-sheet-list">
            <header><h2>积分记录</h2></header>
            {itemEvents.slice(0, 8).map((event) => <article className="mobile-point-event" key={event.id}>
              <b>{event.delta > 0 ? "+" : ""}{event.delta}分 · {event.scene}</b>
              <span>{event.reason} · {event.date} · {event.operator || "班主任"}</span>
            </article>)}
            {!itemEvents.length && <p className="mobile-empty">暂无积分事件。</p>}
          </section>
        </>,
      });
    };
    return <div className="mobile-stack mobile-points-page">
      <MobileSectionHero title={title} text={`${participants} 名学生已有记录 · 累计加分 ${positiveTotal} · 扣分 ${negativeTotal}`} action="选择学生" onAction={() => setQuickPointOpen(true)} />
      <section className="mobile-point-composer">
        <header>
          <div>
            <h2>本次记分</h2>
            <p>{selectedPointIds.length ? `已选 ${selectedPointIds.length} 人` : "选择学生和规则后提交"}</p>
          </div>
          <strong className={Number(pointDraft.delta) >= 0 ? "positive" : "negative"}>{Number(pointDraft.delta) > 0 ? "+" : ""}{Number(pointDraft.delta) || 0}</strong>
        </header>
        <button type="button" className="mobile-point-step" onClick={() => setQuickPointOpen(true)}>
          <span><small>学生</small><b>{selectedPointIds.length ? selectedStudents.map((student) => student.name).slice(0, 4).join("、") : "选择学生"}</b></span>
          <em>{selectedPointIds.length ? "修改" : "去选择"}</em>
        </button>
        <button type="button" className="mobile-point-step" onClick={() => setPointRuleSheetOpen(true)}>
          <span><small>规则</small><b>{selectedPointRule ? `${selectedPointRule.scene} · ${selectedPointRule.title}` : "暂无可用规则"}</b></span>
          <em>{selectedPointRule ? `${selectedPointRule.delta > 0 ? "+" : ""}${selectedPointRule.delta}` : "—"}</em>
        </button>
        {selectedPointIds.length > 4 && <p className="mobile-point-selected-more">另有 {selectedPointIds.length - 4} 名学生已选中，提交时会一起记分。</p>}
        <div className="mobile-form-grid">
          <label><span>本次分值</span><input type="number" value={pointDraft.delta} onChange={(event) => setPointDraft({ ...pointDraft, delta: Number(event.target.value) || 0 })} /></label>
          <label><span>执行人</span><input value={pointDraft.operator} onChange={(event) => setPointDraft({ ...pointDraft, operator: event.target.value })} placeholder="班主任" /></label>
          <label className="wide"><span>补充说明</span><textarea value={pointDraft.note} onChange={(event) => setPointDraft({ ...pointDraft, note: event.target.value })} placeholder={selectedPointRule ? `默认理由：${selectedPointRule.reason || selectedPointRule.title}` : "请先到积分规则添加并启用规则"} /></label>
        </div>
        <div className="mobile-sheet-actions"><button type="button" disabled={!selectedPointIds.length} onClick={() => setSelectedPointIds([])}>清空选择</button><button type="button" className="primary" disabled={!selectedPointIds.length || !selectedPointRule || Number(pointDraft.delta) === 0} onClick={savePointEvent}>{selectedPointIds.length ? `提交 ${selectedPointIds.length} 人` : "先选学生"}</button></div>
      </section>
      <section className="mobile-card-list mobile-point-rules mobile-point-rules-collapsed">
        <header><h2>常用规则</h2><button type="button" onClick={() => open("rules")}>维护</button></header>
        <label className="mobile-rule-category-select"><span>规则分类</span><select value={pointRuleScene} onChange={(event) => setPointRuleScene(event.target.value)}>{ruleScenes.map((scene) => <option key={scene}>{scene}</option>)}</select></label>
        <div className="mobile-rule-grid">
          {shownRules.map((rule) => <button type="button" className={`${pointDraft.ruleId === rule.id ? "selected " : ""}${rule.delta >= 0 ? "positive" : "negative"}`} key={rule.id} onClick={() => setPointDraft({ ...pointDraft, ruleId: rule.id, delta: rule.delta })}>
            <span><b>{rule.scene} · {rule.title}</b><small>{rule.reason || rule.detail || "按此规则记录积分"}</small></span>
            <strong>{rule.delta > 0 ? "+" : ""}{rule.delta}</strong>
          </button>)}
          {!shownRules.length && <p className="mobile-empty">暂无可用规则。</p>}
        </div>
      </section>
      {detail && <MobileInfoSheet title={detail.title} onClose={() => setDetail(null)}>{detail.children}</MobileInfoSheet>}
      {quickPointOpen && <MobileInfoSheet title="选择记分学生" onClose={() => setQuickPointOpen(false)}>
        <label className="mobile-search in-sheet flat"><span>搜索学生</span><input value={pointStudentKeyword} onChange={(event) => setPointStudentKeyword(event.target.value)} placeholder="姓名、学号、小组或积分" /></label>
        <div className="mobile-point-student-tools">
          <div className="mobile-point-filter-row">
            <label className="mobile-select-field"><span>小组</span><select value={pointGroupFilter} onChange={(event) => setPointGroupFilter(event.target.value)}><option value="全部小组">全部小组</option>{pointGroups.map((group) => <option value={String(group)} key={group}>第{group}组</option>)}</select></label>
            <label className="mobile-select-field"><span>排序</span><select value={pointSort} onChange={(event) => setPointSort(event.target.value as typeof pointSort)}><option>积分高优先</option><option>积分低优先</option><option>姓名</option><option>小组</option></select></label>
          </div>
          <div className="mobile-point-selection-actions">
            <button type="button" onClick={toggleFilteredPointStudents}>{allPointFilteredSelected ? "取消全选" : "全选当前"}</button>
            <button type="button" disabled={!selectedPointIds.length} onClick={() => setSelectedPointIds([])}>清空已选</button>
          </div>
          <p>已选 {selectedPointIds.length} 人</p>
        </div>
        <div className="mobile-student-list mobile-point-select-list">
          {filteredPointStudents.map((student) => <button type="button" className={selectedPointIds.includes(student.id) ? "selected" : ""} key={student.id} onClick={() => togglePointStudent(student.id)}>
            <i>{student.name.slice(0, 1)}</i>
            <span><b>{student.name}</b><small>积分 {student.points} · 第{student.group}组 · 学号 {student.studentNo || "未填"}</small></span>
            <em>{selectedPointIds.includes(student.id) ? "已选" : "选择"}</em>
          </button>)}
          {!filteredPointStudents.length && <p className="mobile-empty">没有匹配的学生。</p>}
        </div>
        <div className="mobile-sheet-actions"><button type="button" onClick={() => setQuickPointOpen(false)}>返回</button><button type="button" className="primary" onClick={() => setQuickPointOpen(false)}>{selectedPointIds.length ? `已选 ${selectedPointIds.length} 人` : "完成选择"}</button></div>
      </MobileInfoSheet>}
      {pointRuleSheetOpen && <MobileInfoSheet title="选择积分规则" onClose={() => setPointRuleSheetOpen(false)}>
        <label className="mobile-rule-category-select"><span>规则分类</span><select value={pointRuleScene} onChange={(event) => setPointRuleScene(event.target.value)}>{ruleScenes.map((scene) => <option key={scene}>{scene}</option>)}</select></label>
        <div className="mobile-rule-list-sheet">
          {shownRules.map((rule) => <button type="button" className={`${pointDraft.ruleId === rule.id ? "selected " : ""}${rule.delta >= 0 ? "positive" : "negative"}`} key={rule.id} onClick={() => {
            setPointDraft({ ...pointDraft, ruleId: rule.id, delta: rule.delta });
            setPointRuleSheetOpen(false);
          }}>
            <span><b>{rule.scene} · {rule.title}</b><small>{rule.reason || rule.detail || "按此规则记录积分"}</small></span>
            <strong>{rule.delta > 0 ? "+" : ""}{rule.delta}</strong>
          </button>)}
          {!shownRules.length && <p className="mobile-empty">暂无可用规则。</p>}
        </div>
        <div className="mobile-sheet-actions"><button type="button" onClick={() => open("rules")}>维护规则</button><button type="button" className="primary" onClick={() => setPointRuleSheetOpen(false)}>完成</button></div>
      </MobileInfoSheet>}
    </div>;
  }

  if (active === "records") {
    const pending = records.filter((record) => record.status === "待跟进").length;
    const resolved = records.filter((record) => record.status === "已跟进" || record.status === "已归档").length;
    const involved = new Set(records.map((record) => record.student)).size;
    const recordTypes = ["全部类型", ...Array.from(new Set(records.map((record) => record.type)))];
    const shownRecords = records.filter((record) => {
      const text = `${record.student}${record.date}${record.type}${record.channel ?? ""}${record.content}${record.parentFeedback ?? ""}${record.followUp ?? ""}${record.status ?? ""}`;
      return (recordTypeFilter === "全部类型" || record.type === recordTypeFilter) && (recordStatusFilter === "全部状态" || record.status === recordStatusFilter) && (!recordKeyword.trim() || text.includes(recordKeyword.trim()));
    });
    return <div className="mobile-stack mobile-records-page">
      <MobileSectionHero title={title} text={`${records.length} 条记录 · ${pending} 条待跟进 · 涉及 ${involved} 名学生`} action="新增" onAction={() => openRecordEditor()} />
      <section className="mobile-record-context" aria-label="家校沟通概览"><span><b>{pending}</b> 条待跟进</span><span><b>{resolved}</b> 条已处理</span><small>优先处理有明确回访日期的记录</small></section>
      <NotificationDrafts data={data} update={update} mobile />
      <section className="mobile-record-filter-panel">
        <label className="mobile-search"><span>搜索沟通记录</span><input value={recordKeyword} onChange={(event) => setRecordKeyword(event.target.value)} placeholder="学生、内容、反馈、跟进或方式" /></label>
        <div>
          <label><span>状态</span><select value={recordStatusFilter} onChange={(event) => setRecordStatusFilter(event.target.value as CommunicationRecord["status"] | "全部状态")}><option>全部状态</option><option>待跟进</option><option>已跟进</option><option>已归档</option></select></label>
          <label><span>类型</span><select value={recordTypeFilter} onChange={(event) => setRecordTypeFilter(event.target.value)}>{recordTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
      </section>
      <section className="mobile-card-list mobile-record-list"><header><h2>沟通记录</h2><span>{shownRecords.length} 条</span></header>{shownRecords.map((record) => <button type="button" key={record.id} onClick={() => setDetail({ title: `${record.student} · ${record.type}`, children: <><div className="mobile-detail-grid"><span><small>日期</small><b>{record.date}</b></span><span><small>方式</small><b>{record.channel ?? "面谈"}</b></span><span><small>状态</small><b>{record.status ?? "待跟进"}</b></span><span><small>类型</small><b>{record.type}</b></span></div><div className="mobile-sheet-section"><h3>内容</h3><p>{record.content}</p></div><div className="mobile-sheet-section"><h3>后续跟进</h3><p>{record.followUp || "暂无跟进安排"}</p></div><div className="mobile-sheet-section"><h3>家长反馈</h3><p>{record.parentFeedback || "暂无反馈"}</p></div><div className="mobile-form-grid"><label className="wide"><span>状态</span><select value={record.status ?? "待跟进"} onChange={(event) => patchRecordStatus(record.id, event.target.value as CommunicationRecord["status"])}><option>待跟进</option><option>已跟进</option><option>已归档</option></select></label></div><div className="mobile-sheet-actions"><button type="button" onClick={() => openRecordEditor(record)}>编辑记录</button><button type="button" onClick={() => copyTextToClipboard(`${record.student}｜${record.type}｜${record.content}｜${record.followUp ?? ""}`, "已复制沟通记录")}>复制记录</button></div><div className="mobile-sheet-actions single"><button type="button" onClick={() => deleteRecordMobile(record.id)}>删除记录</button></div></> })}><b>{record.student} · {record.type}</b><span>{record.date} · {record.status ?? "待跟进"} · {record.channel ?? "面谈"}</span><small>{record.content}</small></button>)}{!shownRecords.length && <article><b>暂无记录</b><span>可以调整状态、类型或关键词筛选。</span></article>}</section>
      {detail && <MobileInfoSheet title={detail.title} onClose={() => setDetail(null)}>{detail.children}</MobileInfoSheet>}
      {quickRecordOpen && <MobileInfoSheet title={editingRecordId ? "编辑沟通记录" : "新增沟通记录"} onClose={() => { setQuickRecordOpen(false); setEditingRecordId(""); }}>
        <div className="mobile-form-grid">
          <label><span>学生</span><button type="button" className="mobile-picker-trigger" onClick={() => setRecordStudentPickerOpen(true)}>{recordDraft.student || "选择学生"}</button></label>
          <label><span>日期</span><input type="date" value={recordDraft.date} onChange={(event) => setRecordDraft({ ...recordDraft, date: event.target.value })} /><small>用于后续按时间筛选和提醒</small></label>
          <label><span>类型</span><select value={recordDraft.type} onChange={(event) => setRecordDraft({ ...recordDraft, type: event.target.value })}>{["家访登记", "家校沟通", "谈心记录", "作业跟进", "纪律表现", "表扬记录", "心理关注", "成长记录"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>渠道</span><select value={recordDraft.channel} onChange={(event) => setRecordDraft({ ...recordDraft, channel: event.target.value })}><option>微信</option><option>电话</option><option>面谈</option><option>班级群</option></select></label>
          <label className="wide"><span>目的</span><input value={recordDraft.purpose} onChange={(event) => setRecordDraft({ ...recordDraft, purpose: event.target.value })} placeholder="沟通情况补录" /></label>
          <label className="wide"><span>家庭情况</span><textarea value={recordDraft.home} onChange={(event) => setRecordDraft({ ...recordDraft, home: event.target.value })} placeholder="例如：家长反馈晚间作业拖拉" /></label>
          <label className="wide"><span>沟通内容</span><textarea value={recordDraft.content} onChange={(event) => setRecordDraft({ ...recordDraft, content: event.target.value })} placeholder="记录沟通过程、学生表现和处理建议" /><small>建议记录事实、双方约定和老师下一步动作</small></label>
          <label className="wide"><span>家长反馈</span><textarea value={recordDraft.opinion} onChange={(event) => setRecordDraft({ ...recordDraft, opinion: event.target.value })} placeholder="可选，记录家长态度或配合事项" /></label>
          <label className="wide"><span>后续跟进</span><textarea value={recordDraft.followUp} onChange={(event) => setRecordDraft({ ...recordDraft, followUp: event.target.value })} placeholder="可选，例如：周五复查订正情况" /></label>
        </div>
        <div className="mobile-sheet-actions"><button type="button" onClick={() => { setQuickRecordOpen(false); setEditingRecordId(""); }}>取消</button><button type="button" className="primary" onClick={saveRecord}>保存记录</button></div>
      </MobileInfoSheet>}
      {recordStudentPickerOpen && <StudentLookupDialog title="选择沟通学生" subtitle="搜索姓名、学号或小组后再选择，不展开全班下拉。" students={students} selectedId={recordDraft.studentId} onPick={(student) => { setRecordDraft({ ...recordDraft, studentId: student.id, student: student.name }); setRecordStudentPickerOpen(false); }} onClose={() => setRecordStudentPickerOpen(false)} />}
    </div>;
  }

  if (active === "growth") {
    const activeClassId = data.activeClassId ?? activeClass.id;
    const termBounds = scheduleTermRange(data.scheduleConfig);
    const tasks = (data.homeworkTasks ?? []).filter((task) => !task.classId || task.classId === activeClassId);
    const studentEvidenceCount = (item: Student) => {
      const manualCount = growthEvidenceForStudent(data, activeClassId, item.id).length;
      const pointCount = (data.pointEvents ?? []).filter((event) => event.studentId === item.id).length;
      const recordCount = data.records.filter((record) => recordBelongsToStudent(record, item, activeClassId)).length;
      const homeworkCount = tasks.filter((task) => task.statuses[item.id]).length;
      return manualCount + pointCount + recordCount + homeworkCount;
    };
    const studentStatusFor = (item: Student) => {
      const itemEvents = (data.pointEvents ?? []).filter((event) => event.studentId === item.id);
      const positiveCount = itemEvents.filter((event) => event.delta > 0).length;
      const negativeCount = itemEvents.filter((event) => event.delta < 0).length;
      if (item.score < 80 || item.homework !== "已交" || item.attendance !== "正常" || negativeCount > positiveCount) return "需要跟进";
      if (item.score >= 90 || item.points >= 18) return "表现良好";
      return "整体稳定";
    };
    const groups = Array.from(new Set(students.map((student) => student.group))).sort((a, b) => a - b);
    const attention = students.filter((student) => studentStatusFor(student) === "需要跟进");
    const noEvidenceCount = students.filter((student) => studentEvidenceCount(student) === 0).length;
    const withEvidenceCount = students.filter((student) => studentEvidenceCount(student) > 0).length;
    const query = growthKeyword.trim().toLocaleLowerCase("zh-CN");
    const shownGrowthStudents = students
      .filter((student) => !query || `${student.name}${student.studentNo ?? ""}${student.group}${student.score}${student.points}`.toLocaleLowerCase("zh-CN").includes(query))
      .filter((student) => growthGroupFilter === "全部小组" || String(student.group) === growthGroupFilter)
      .filter((student) => growthStatusFilter === "全部状态" || studentStatusFor(student) === growthStatusFilter)
      .filter((student) => growthCoverageFilter === "全部记录" || (growthCoverageFilter === "有记录" ? studentEvidenceCount(student) > 0 : studentEvidenceCount(student) === 0))
      .sort((a, b) => {
        if (growthStudentSort === "记录多优先") return studentEvidenceCount(b) - studentEvidenceCount(a);
        if (growthStudentSort === "积分低优先") return a.points - b.points;
        if (growthStudentSort === "成绩低优先") return a.score - b.score;
        return 0;
      });
    const growthStudentPageSize = 10;
    const growthStudentPageCount = Math.max(1, Math.ceil(shownGrowthStudents.length / growthStudentPageSize));
    const safeGrowthStudentPage = Math.min(growthStudentPage, growthStudentPageCount);
    const pagedGrowthStudents = shownGrowthStudents.slice((safeGrowthStudentPage - 1) * growthStudentPageSize, safeGrowthStudentPage * growthStudentPageSize);
    const selectedGrowthStudent = students.find((student) => student.id === growthStudentId) ?? shownGrowthStudents[0] ?? students[0];
    const recordsForStudent = selectedGrowthStudent ? data.records.filter((record) => recordBelongsToStudent(record, selectedGrowthStudent, activeClassId)) : [];
    const eventsForStudent = (data.pointEvents ?? []).filter((event) => event.studentId === selectedGrowthStudent?.id);
    const homeworkForStudent = selectedGrowthStudent ? tasks.map((task) => ({ task, status: task.statuses[selectedGrowthStudent.id] ?? selectedGrowthStudent.homework })) : [];
    const manualForStudent = selectedGrowthStudent ? growthEvidenceForStudent(data, activeClassId, selectedGrowthStudent.id) : [];
    const homeworkDone = homeworkForStudent.filter(({ status }) => status === "已交" || status === "已复查").length;
    const homeworkRate = homeworkForStudent.length ? Math.round(homeworkDone / homeworkForStudent.length * 100) : 0;
    const positiveEvents = eventsForStudent.filter((event) => event.delta > 0);
    const negativeEvents = eventsForStudent.filter((event) => event.delta < 0);
    const selectedStatus = selectedGrowthStudent ? studentStatusFor(selectedGrowthStudent) : "整体稳定";
    const growthTimeline: GrowthTimelineItem[] = selectedGrowthStudent ? [
      ...manualForStudent.map((item) => ({ id: `manual-${item.id}`, kind: "老师补充" as const, label: item.type, title: item.title, content: item.content, followUp: item.followUp, date: item.date, tone: item.type.includes("表扬") || item.type.includes("进步") ? "positive" as const : "neutral" as const, timestamp: growthTimestamp(item.date, item.createdAt) })),
      ...recordsForStudent.map((record) => ({ id: `record-${record.id}`, kind: "沟通记录" as const, label: record.type, title: record.type.includes("表扬") || record.type.includes("成长") ? "积极表现记录" : "沟通与跟进记录", content: record.content, date: record.date, tone: record.type.includes("表扬") || record.type.includes("成长") ? "positive" as const : "neutral" as const, timestamp: growthTimestamp(record.date) })),
      ...eventsForStudent.map((event) => ({ id: `event-${event.id}`, kind: "积分表现" as const, label: event.scene, title: `${event.delta > 0 ? "+" : ""}${event.delta} 积分`, content: event.reason, date: event.date, tone: event.delta > 0 ? "positive" as const : "attention" as const, timestamp: growthTimestamp(event.date) })),
      ...homeworkForStudent.map(({ task, status }) => ({ id: `homework-${task.id}`, kind: "作业记录" as const, label: task.subject, title: task.title, content: `完成状态：${status}`, date: task.date, tone: status === "已交" || status === "已复查" ? "positive" as const : "attention" as const, timestamp: growthTimestamp(task.date) })),
    ].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)) : [];
    const filteredGrowthTimeline = growthTimeline.filter((item) => (growthKindFilter === "全部类型" || item.kind === growthKindFilter) && inGrowthRange(item.timestamp, growthRangeFilter, termBounds.startTime));
    const growthPageSize = 6;
    const growthPageCount = Math.max(1, Math.ceil(filteredGrowthTimeline.length / growthPageSize));
    const safeGrowthPage = Math.min(growthPage, growthPageCount);
    const visibleGrowthTimeline = filteredGrowthTimeline.slice((safeGrowthPage - 1) * growthPageSize, safeGrowthPage * growthPageSize);
    const strengths = selectedGrowthStudent ? [
      selectedGrowthStudent.score >= 90 ? "学习表现稳定优秀" : selectedGrowthStudent.score >= 80 ? "学习基础较稳定" : "已经形成明确的学习帮扶方向",
      selectedGrowthStudent.points >= 18 ? "日常表现有较多正向积累" : selectedGrowthStudent.points >= 14 ? "日常表现稳步积累" : "需要增加具体、及时的正向反馈",
      homeworkRate >= 90 ? "作业完成习惯良好" : homeworkRate >= 70 ? "多数作业能够完成" : "作业提交与订正闭环需要加强",
    ] : [];
    const followUps = selectedGrowthStudent ? [
      selectedGrowthStudent.score < 80 ? "安排一次错题复盘或学习谈话，并记录具体困难。" : "保持当前学习节奏，补充一条可观察的进步事实。",
      selectedGrowthStudent.attendance !== "正常" ? `跟进考勤状态：${selectedGrowthStudent.attendance}。` : "考勤状态正常，继续保持。",
      homeworkForStudent.some(({ status }) => status === "未交" || status === "待订正") ? "完成未交或待订正作业的复查闭环。" : "作业暂无待处理事项。",
      recordsForStudent.length + manualForStudent.length === 0 ? "补充一次谈心、家访、表扬或课堂观察记录。" : "根据最近一条证据安排下次观察或回访。",
    ] : [];
    const growthSummary = selectedGrowthStudent ? `${selectedGrowthStudent.name}：当前${selectedStatus}。成绩${selectedGrowthStudent.score}分，积分${selectedGrowthStudent.points}分，作业完成率${homeworkRate}%，已沉淀${growthTimeline.length}条成长证据。优势：${strengths.join("；")}。下一步：${followUps[0]}` : "";
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthlyEvidence = growthTimeline.filter((item) => item.timestamp && item.timestamp >= monthStart.getTime()).length;
    async function copyGrowthSummary() {
      const copied = await copyTextToClipboard(growthSummary, "已复制成长摘要");
      if (copied) {
        setGrowthCopyState("已复制");
        window.setTimeout(() => setGrowthCopyState("复制摘要"), 1600);
      }
    }
    function selectGrowthStudent(studentId: string) {
      setGrowthStudentId(studentId);
      setGrowthPage(1);
      setGrowthComposerOpen(false);
      setGrowthFormError("");
      setGrowthDetailOpen(true);
    }
    function saveGrowthEvidence() {
      if (!selectedGrowthStudent || !growthDraft.date || !growthDraft.title.trim() || !growthDraft.content.trim()) {
        setGrowthFormError("请填写日期、标题和具体事实。");
        return;
      }
      update((current) => addGrowthEvidence(current, activeClassId, selectedGrowthStudent.id, growthDraft, makeId).data ?? current);
      setGrowthDraft({ date: today(), type: "表扬记录", title: "", content: "", followUp: "" });
      setGrowthFormError("");
      setGrowthKindFilter("全部类型");
      setGrowthRangeFilter("全部时间");
      setGrowthPage(1);
      setGrowthComposerOpen(false);
      notify("成长记录已添加", "success");
    }
    return <div className="mobile-stack mobile-growth-page">
      <MobileSectionHero title={title} text={`${withEvidenceCount}/${students.length} 已有记录 · ${attention.length} 人需跟进`} />
      <section className="mobile-growth-context" aria-label="成长档案概览">
        <span><b>{attention.length}</b> 人需要跟进</span>
        <span><b>{noEvidenceCount}</b> 人尚无记录</span>
        <small>选择学生后可直接添加成长事实</small>
      </section>
      <section className="mobile-growth-searchline">
        <label className="mobile-search"><span>搜索学生</span><input value={growthKeyword} onChange={(event) => { setGrowthKeyword(event.target.value); setGrowthStudentPage(1); }} placeholder="姓名、学号或小组" /></label>
        <label><span>小组</span><select value={growthGroupFilter} onChange={(event) => { setGrowthGroupFilter(event.target.value); setGrowthStudentPage(1); }}><option>全部小组</option>{groups.map((group) => <option value={String(group)} key={group}>第{group}组</option>)}</select></label>
      </section>
      <section className="mobile-form-grid mobile-growth-filter">
        <label><span>状态</span><select value={growthStatusFilter} onChange={(event) => { setGrowthStatusFilter(event.target.value as typeof growthStatusFilter); setGrowthStudentPage(1); }}>{["全部状态", "需要跟进", "表现良好", "整体稳定"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>记录</span><select value={growthCoverageFilter} onChange={(event) => { setGrowthCoverageFilter(event.target.value as typeof growthCoverageFilter); setGrowthStudentPage(1); }}>{["全部记录", "有记录", "暂无记录"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>排序</span><select value={growthStudentSort} onChange={(event) => { setGrowthStudentSort(event.target.value as typeof growthStudentSort); setGrowthStudentPage(1); }}>{["默认排序", "记录多优先", "积分低优先", "成绩低优先"].map((item) => <option key={item}>{item}</option>)}</select></label>
      </section>
      <div className="mobile-filter-reset"><span>当前 {shownGrowthStudents.length} 名学生</span><button type="button" onClick={() => { setGrowthKeyword(""); setGrowthGroupFilter("全部小组"); setGrowthStatusFilter("全部状态"); setGrowthCoverageFilter("全部记录"); setGrowthStudentSort("默认排序"); setGrowthStudentPage(1); }}>重置筛选</button></div>
      <div className="mobile-student-list mobile-growth-students">
        {pagedGrowthStudents.map((student) => {
          const itemStatus = studentStatusFor(student);
          return <button type="button" className={selectedGrowthStudent?.id === student.id ? "selected" : ""} key={student.id} onClick={() => selectGrowthStudent(student.id)}><i>{student.name.slice(0, 1)}</i><span><b>{student.name}</b><small>第{student.group}组 · 学号 {student.studentNo || "未填"} · {studentEvidenceCount(student)} 条证据</small></span><em>{itemStatus}</em></button>;
        })}
        {!shownGrowthStudents.length && <p className="mobile-empty">没有匹配的学生。</p>}
        {shownGrowthStudents.length > growthStudentPageSize && <div className="mobile-list-pager"><button type="button" disabled={safeGrowthStudentPage <= 1} onClick={() => setGrowthStudentPage((page) => page - 1)}>上一页</button><span>{safeGrowthStudentPage} / {growthStudentPageCount} · 共 {shownGrowthStudents.length} 人</span><button type="button" disabled={safeGrowthStudentPage >= growthStudentPageCount} onClick={() => setGrowthStudentPage((page) => page + 1)}>下一页</button></div>}
      </div>
      {growthDetailOpen && selectedGrowthStudent && <MobileInfoSheet title={`${selectedGrowthStudent.name} · 成长档案`} onClose={() => setGrowthDetailOpen(false)}>
        <section className="mobile-growth-focus-head">
          <div><i>{selectedGrowthStudent.name.slice(0, 1)}</i><span><b>{selectedGrowthStudent.name}</b><small>{selectedStatus} · 第{selectedGrowthStudent.group}组 · 学号 {selectedGrowthStudent.studentNo || "未填"}</small></span><em>{growthTimeline.length} 条</em></div>
          <nav><button type="button" className="primary" onClick={() => { setGrowthDetailOpen(false); setGrowthComposerOpen(true); }}>为{selectedGrowthStudent.name}添加记录</button><button type="button" onClick={() => setDetail({ title: `${selectedGrowthStudent.name} · 成长摘要`, children: <section className="mobile-growth-summary-sheet"><div className="mobile-detail-grid"><span><small>成绩</small><b>{selectedGrowthStudent.score}</b></span><span><small>积分</small><b>{selectedGrowthStudent.points}</b></span><span><small>作业完成</small><b>{homeworkRate}%</b></span><span><small>沟通记录</small><b>{recordsForStudent.length}</b></span></div><div className="mobile-sheet-section"><h3>成长摘要</h3><p>{growthSummary}</p></div><div className="mobile-sheet-section"><h3>优势观察</h3><p>{strengths.join("\n")}</p></div><div className="mobile-sheet-section"><h3>后续跟进</h3><p>{followUps.join("\n")}</p></div><div className="mobile-sheet-actions"><button type="button" onClick={copyGrowthSummary}>{growthCopyState}</button><button type="button" onClick={() => window.print()}>导出素材</button></div></section> })}>查看自动摘要</button></nav>
        </section>
        <section className="mobile-growth-record-heading"><div><h3>成长记录</h3><span>优先展示最近记录</span></div><b>{filteredGrowthTimeline.length} 条</b></section>
        <section className="mobile-form-grid mobile-growth-filter mobile-growth-sheet-filter">
          <label><span>时间</span><select value={growthRangeFilter} onChange={(event) => { setGrowthRangeFilter(event.target.value as GrowthTime); setGrowthPage(1); }}>{["全部时间", "近7天", "近30天", "本学期"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>类型</span><select value={growthKindFilter} onChange={(event) => { setGrowthKindFilter(event.target.value as "全部类型" | GrowthKind); setGrowthPage(1); }}>{["全部类型", "沟通记录", "积分表现", "作业记录", "老师补充"].map((item) => <option key={item}>{item}</option>)}</select></label>
        </section>
        <section className="mobile-card-list in-sheet-list mobile-growth-records">{visibleGrowthTimeline.map((item) => <button type="button" key={item.id} onClick={() => setDetail({ title: item.title, children: <><div className="mobile-detail-grid"><span><small>日期</small><b>{item.date}</b></span><span><small>类型</small><b>{item.kind}</b></span></div><div className="mobile-sheet-section"><h3>{item.label}</h3><p>{item.content}</p></div><div className="mobile-sheet-section"><h3>后续措施</h3><p>{item.followUp || "无"}</p></div></> })}><b>{item.date} · {item.title}</b><span>{item.kind} · {item.label} · {item.content}</span></button>)}{!visibleGrowthTimeline.length && <article><b>暂无成长记录</b><span>{growthTimeline.length ? "当前筛选条件下没有记录。" : "点击上方“添加成长记录”建立第一条记录。"}</span></article>}</section>
        {filteredGrowthTimeline.length > growthPageSize && <section className="mobile-batch-bar"><button type="button" disabled={safeGrowthPage <= 1} onClick={() => setGrowthPage((page) => Math.max(1, page - 1))}>上一页</button><span>第 {safeGrowthPage} / {growthPageCount} 页</span><button type="button" disabled={safeGrowthPage >= growthPageCount} onClick={() => setGrowthPage((page) => Math.min(growthPageCount, page + 1))}>下一页</button></section>}
      </MobileInfoSheet>}
      {detail && <MobileInfoSheet title={detail.title} onClose={() => setDetail(null)}>{detail.children}</MobileInfoSheet>}
      {growthComposerOpen && selectedGrowthStudent && <MobileInfoSheet title={`添加成长记录 · ${selectedGrowthStudent.name}`} onClose={() => setGrowthComposerOpen(false)}>
        {growthFormError && <p className="mobile-form-error">{growthFormError}</p>}
        <div className="mobile-form-grid">
          <label><span>日期</span><input type="date" value={growthDraft.date} onChange={(event) => setGrowthDraft({ ...growthDraft, date: event.target.value })} /></label>
          <label><span>类型</span><select value={growthDraft.type} onChange={(event) => setGrowthDraft({ ...growthDraft, type: event.target.value })}>{["学习", "活动", "荣誉", "日常", "进步", "表扬记录"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="wide"><span>标题</span><input value={growthDraft.title} maxLength={40} onChange={(event) => setGrowthDraft({ ...growthDraft, title: event.target.value })} placeholder="如：作文获奖" /></label>
          <label className="wide"><span>内容描述</span><textarea value={growthDraft.content} maxLength={500} onChange={(event) => setGrowthDraft({ ...growthDraft, content: event.target.value })} placeholder="记录具体事实、作品表现或老师观察。" /></label>
          <label className="wide"><span>后续观察点</span><textarea value={growthDraft.followUp} maxLength={300} onChange={(event) => setGrowthDraft({ ...growthDraft, followUp: event.target.value })} placeholder="如：下周继续观察课堂发言。" /></label>
        </div>
        <div className="mobile-sheet-actions"><button type="button" onClick={() => setGrowthComposerOpen(false)}>取消</button><button type="button" className="primary" onClick={saveGrowthEvidence}>保存成长记录</button></div>
      </MobileInfoSheet>}
    </div>;
  }

  if (active === "weekly") {
    const reports = weeklyReportsForClass(data, activeClass.id).sort((a, b) => b.weekStart.localeCompare(a.weekStart) || b.updatedAt.localeCompare(a.updatedAt));
    const weeklyMeta = mobileWeekMeta(weeklyOffset);
    const weekChoices = Array.from({ length: 13 }, (_, index) => {
      const offset = -index;
      const meta = mobileWeekMeta(offset);
      return { offset, label: meta.label };
    });
    const weekTasks = (data.homeworkTasks ?? []).filter((task) => (!task.classId || task.classId === activeClass.id) && task.date >= weeklyMeta.weekStart && task.date <= weeklyMeta.weekEnd);
    const homeworkMetrics = weeklyHomeworkMetrics(weekTasks, students);
    const reportPointEvents = weeklyPointEventsForClass(data, activeClass.id, students, weeklyMeta.weekStart, weeklyMeta.weekEnd);
    const positiveEvents = reportPointEvents.filter((event) => event.delta > 0);
    const positiveRows = weeklyPositiveRows(reportPointEvents, students);
    const stars = positiveRows.slice(0, 4).map((item) => ({ type: "优秀", student: item.student, reason: item.reason, data: `本周 +${item.delta}` }));
    const progressRows = positiveRows.slice(4, 8).map((item) => ({ type: "正向", student: item.student, reason: item.reason, data: `本周 +${item.delta}` }));
    const followRows = weeklyFollowRows(data, activeClass.id, students, weekTasks, weeklyMeta.weekStart, weeklyMeta.weekEnd).slice(0, 6).map((item) => ({ type: "跟进", student: item.student, reason: item.reasons.map((reason) => reason.text).join("；"), data: `${item.reasons.length} 项` }));
    const weeklyFocusRows = [...stars, ...progressRows, ...followRows];
    const groupStats = Array.from(new Set(students.map((student) => student.group))).sort((a, b) => a - b).map((group) => {
      const groupStudents = students.filter((student) => student.group === group);
      const points = groupStudents.reduce((sum, student) => sum + student.points, 0);
      const unresolved = weekTasks.reduce((count, task) => count + groupStudents.filter((student) => ["未交", "待订正"].includes(task.statuses[student.id] ?? "")).length, 0);
      return { group, count: groupStudents.length, average: groupStudents.length ? Math.round(points / groupStudents.length) : 0, unresolved, names: groupStudents.map((student) => student.name).join("、") };
    }).sort((a, b) => b.average - a.average);
    const weeklyGrowthRecords = weeklyActivityRows(data, activeClass.id, students, records, weeklyMeta.weekStart, weeklyMeta.weekEnd).slice(0, 8);
    const visibleReports = reports.filter((report) => {
      const text = `${report.title ?? ""}${report.weekStart}${report.weekEnd}${report.edition}${report.content}${report.nextFocus}`;
      return (weeklyArchiveEdition === "全部版本" || report.edition === weeklyArchiveEdition) && (!weeklyArchiveSearch.trim() || text.includes(weeklyArchiveSearch.trim()));
    });
    const generatedPreview = generateWeeklyText(weeklyDraft.weekOffset, weeklyDraft.edition, weeklyDraft.title, weeklyDraft.nextFocus);
    return <div className="mobile-stack">
      <MobileSectionHero title={title} text={`${weeklyMeta.label} · 关注 ${weeklyFocusRows.length} 人`} action="新建周报" onAction={() => openWeeklyEditorMobile()} />
      <section className="mobile-overview-stats" aria-label="班级周报概览"><span><small>本周作业</small><b>{weekTasks.length}</b></span><span><small>已记录完成率</small><b>{homeworkMetrics.completionRate}%</b></span><span><small>待跟进</small><b>{followRows.length}</b></span></section>
      <nav className="mobile-weekly-view-tabs"><button type="button" className={weeklyView === "本周" ? "active" : ""} onClick={() => setWeeklyView("本周")}><b>本周概览</b><span>表现、跟进与小组</span></button><button type="button" className={weeklyView === "归档" ? "active" : ""} onClick={() => setWeeklyView("归档")}><b>周报库</b><span>{reports.length} 份历史周报</span></button></nav>
      {weeklyView === "本周" && <label className="mobile-weekly-period"><span>当前周</span><select value={weeklyOffset} onChange={(event) => setWeeklyOffset(Number(event.target.value))}>{weekChoices.map((item) => <option value={item.offset} key={item.offset}>{item.label}</option>)}</select></label>}
      {weeklyView === "本周" && <section className="mobile-card-list"><header><h2>本周关注学生</h2><button type="button" onClick={() => setDetail({ title: "跟进名单", children: <div className="mobile-card-list in-sheet-list">{followRows.length ? followRows.map((item) => <article key={item.student.id}><b>{item.student.name}</b><span>{item.reason} · {item.data}</span></article>) : <article><b>暂无跟进</b><span>本周暂未形成跟进名单。</span></article>}</div> })}>查看跟进名单</button></header>{weeklyFocusRows.slice(0, 9).map((item) => <button type="button" key={`${item.type}-${item.student.id}`} onClick={() => setDetail({ title: item.student.name, children: <><div className="mobile-detail-grid"><span><small>类型</small><b>{item.type}</b></span><span><small>本周数据</small><b>{item.data}</b></span><span><small>当前积分</small><b>{item.student.points}</b></span><span><small>当前成绩</small><b>{item.student.score}</b></span></div><div className="mobile-sheet-section"><h3>依据</h3><p>{item.reason}</p></div></> })}><b>{item.type} · {item.student.name}</b><span>{item.reason} · {item.data}</span></button>)}{!weeklyFocusRows.length && <article><b>暂无关注学生</b><span>本周暂未形成有日期依据的正向或跟进名单。</span></article>}</section>}
      {weeklyView === "本周" && <section className="mobile-card-list"><header><h2>小组当前表现</h2><button type="button" onClick={() => setDetail({ title: "小组完整统计", children: <div className="mobile-card-list in-sheet-list">{groupStats.map((group) => <article key={group.group}><b>第{group.group}组 · {group.count}人</b><span>当前人均积分 {group.average} · 作业待办 {group.unresolved} · {group.names}</span></article>)}</div> })}>完整统计</button></header>{groupStats.slice(0, 4).map((group, index) => <button type="button" key={group.group} onClick={() => setDetail({ title: `第${group.group}组`, children: <><div className="mobile-detail-grid"><span><small>当前排名</small><b>{index + 1}</b></span><span><small>人数</small><b>{group.count}</b></span><span><small>当前人均积分</small><b>{group.average}</b></span><span><small>作业待办</small><b>{group.unresolved}</b></span></div><div className="mobile-sheet-section"><h3>成员</h3><p>{group.names}</p></div></> })}><b>第{group.group}组 · 当前人均积分 {group.average}</b><span>{group.count}人 · 作业待办 {group.unresolved}</span></button>)}</section>}
      {weeklyView === "本周" && <section className="mobile-card-list"><header><h2>成长记录</h2><button type="button" onClick={() => open("growth")}>查看记录</button></header>{weeklyGrowthRecords.map((record, index) => <button type="button" key={`${record.student}-${record.date}-${index}`} onClick={() => setDetail({ title: `${record.student} · ${record.type}`, children: <><div className="mobile-sheet-section"><h3>{record.date}</h3><p>{record.content}</p></div></> })}><b>{record.student} · {record.type}</b><span>{record.content}</span></button>)}{!weeklyGrowthRecords.length && <article><b>暂无成长记录</b><span>本周还没有家校沟通或成长档案记录。</span></article>}</section>}
      {weeklyView === "归档" && <>
        <label className="mobile-search"><span>搜索周报</span><input value={weeklyArchiveSearch} onChange={(event) => setWeeklyArchiveSearch(event.target.value)} placeholder="标题、正文、日期或下周重点" /></label>
        <nav className="mobile-chip-tabs">{(["全部版本", "家长版", "教师版"] as const).map((item) => <button type="button" className={weeklyArchiveEdition === item ? "active" : ""} key={item} onClick={() => setWeeklyArchiveEdition(item)}>{item}</button>)}</nav>
        <section className="mobile-card-list"><header><h2>历史周报</h2></header>{visibleReports.slice(0, 12).map((report) => <button type="button" key={report.id} onClick={() => setDetail({ title: report.title ?? `${report.edition} · ${report.weekStart}`, children: <><div className="mobile-detail-grid"><span><small>周次</small><b>{report.weekStart}</b></span><span><small>版本</small><b>{report.edition}</b></span><span><small>状态</small><b>{report.status ?? "已保存"}</b></span><span><small>更新</small><b>{report.updatedAt.slice(0, 10)}</b></span></div><div className="mobile-sheet-section"><h3>周报内容</h3><p>{report.content}</p></div><div className="mobile-sheet-section"><h3>下周重点</h3><p>{report.nextFocus}</p></div><div className="mobile-sheet-actions"><button type="button" onClick={() => copyTextToClipboard(`${report.content}\n\n下周重点：${report.nextFocus}`, "已复制周报")}>复制周报</button><button type="button" className="primary" onClick={() => { setDetail(null); openWeeklyEditorMobile(report); }}>继续编辑</button></div></> })}><b>{report.title ?? `${report.edition} · ${report.weekStart}`}</b><span>{report.edition} · {report.weekStart} 至 {report.weekEnd} · {report.nextFocus}</span></button>)}{!visibleReports.length && <article><b>暂无周报</b><span>当前筛选下没有周报，可以调整关键词或新建。</span></article>}</section>
      </>}
      {detail && <MobileInfoSheet title={detail.title} onClose={() => setDetail(null)}>{detail.children}</MobileInfoSheet>}
      {weeklyEditorOpen && <MobileInfoSheet title={weeklyDraft.id ? "编辑班级周报" : "新建班级周报"} onClose={() => setWeeklyEditorOpen(false)}>
        <div className="mobile-form-grid">
          <label className="wide"><span>周次</span><select value={weeklyDraft.weekOffset} onChange={(event) => {
            const offset = Number(event.target.value);
            const meta = mobileWeekMeta(offset);
            setWeeklyDraft({ ...weeklyDraft, weekOffset: offset, title: weeklyDraft.title || `${activeClass.name} · 第${meta.weekNumber}周班级周报` });
          }}>{weekChoices.map((item) => <option value={item.offset} key={item.offset}>{item.label}</option>)}</select></label>
          <label><span>版本</span><select value={weeklyDraft.edition} onChange={(event) => setWeeklyDraft({ ...weeklyDraft, edition: event.target.value as WeeklyReport["edition"] })}><option>家长版</option><option>教师版</option></select></label>
          <label className="wide"><span>标题</span><input value={weeklyDraft.title} onChange={(event) => setWeeklyDraft({ ...weeklyDraft, title: event.target.value })} placeholder="班级周报标题" /></label>
          <label className="wide"><span>周报内容</span><textarea value={weeklyDraft.content} onChange={(event) => setWeeklyDraft({ ...weeklyDraft, content: event.target.value })} placeholder={generatedPreview} /></label>
          <label className="wide"><span>下周重点</span><textarea value={weeklyDraft.nextFocus} onChange={(event) => setWeeklyDraft({ ...weeklyDraft, nextFocus: event.target.value })} placeholder="例如：复查订正、联系重点学生家长、整理小组积分" /></label>
        </div>
        <div className="mobile-sheet-actions mobile-weekly-utility-actions"><button type="button" onClick={() => setWeeklyDraft({ ...weeklyDraft, content: generatedPreview })}>自动生成正文</button><button type="button" onClick={() => copyTextToClipboard(weeklyDraft.content || generatedPreview, "已复制周报正文")}>复制正文</button></div>
        <div className="mobile-sheet-actions mobile-weekly-submit-actions">{weeklyEditorMessage && <p className="mobile-weekly-editor-message" role="status">{weeklyEditorMessage}</p>}<button type="button" onClick={() => setWeeklyEditorOpen(false)}>取消</button><button type="button" onClick={() => saveWeeklyReportMobile("草稿")}>保存草稿</button><button type="button" className="primary" onClick={() => saveWeeklyReportMobile("已归档")}>完成并归档</button></div>
      </MobileInfoSheet>}
    </div>;
  }

  if (active === "duty") {
    const allDutyJobs = dutyJobs.length ? dutyJobs : defaultDutyJobs;
    const enabledDutyJobs = allDutyJobs.filter((job) => job.enabled !== false);
    const enabledDutyCount = enabledDutyJobs.length;
    const dutyGroups = Math.max(1, ...students.map((student) => student.group || 1));
    const dutyGroupLists = Array.from({ length: dutyGroups }, (_, index) => students.filter((student) => student.group === index + 1));
    const dutyDayIndex = Math.max(0, mobileDutyDays.indexOf(dutyDay));
    const dutyGroupNumber = ((dutyDayIndex + (data.dutyOffset ?? 0)) % dutyGroups) + 1;
    const dutyRecordFor = (day: string, job: DutyJob) => dutyRecords.find((record) => record.date === today() && sameDutyDay(record.day, day) && record.jobId === job.id);
    const assignedDutyStudents = (day: string, job: DutyJob, jobIndex: number) => {
      const manual = (dutyRecordFor(day, job)?.studentIds ?? []).map((id) => students.find((student) => student.id === id)).filter(Boolean) as Student[];
      if (manual.length) return manual;
      const fixed = (job.studentIds ?? []).map((id) => students.find((student) => student.id === id)).filter(Boolean) as Student[];
      if (fixed.length) return fixed;
      const dayIndex = Math.max(0, mobileDutyDays.indexOf(day));
      const group = dutyGroupLists[(dayIndex + (data.dutyOffset ?? 0)) % dutyGroups] ?? [];
      return group.length ? [group[jobIndex % group.length]] : [];
    };
    const dutyText = mobileDutyDays.map((day, dayIndex) => {
      const groupNumber = ((dayIndex + (data.dutyOffset ?? 0)) % dutyGroups) + 1;
      return `${day} 第${groupNumber}组：` + enabledDutyJobs.map((job, jobIndex) => `${job.name}-${assignedDutyStudents(day, job, jobIndex).map((student) => student.name).join("、") || "待安排"}`).join("；");
    }).join("\n");
    const pendingDutyCount = enabledDutyJobs.filter((job) => {
      const record = dutyRecordFor(dutyDay, job);
      return !record || record.status === "待检查" || record.status === "需返工";
    }).length;
    const weekDoneCount = mobileDutyDays.reduce((sum, day) => sum + enabledDutyJobs.filter((job) => dutyRecordFor(day, job)?.status === "已完成").length, 0);
    const weekTotal = Math.max(1, enabledDutyJobs.length * mobileDutyDays.length);
    const weekRate = Math.round(weekDoneCount / weekTotal * 100);
    const filteredDutyRecords = dutyRecords.filter((record) => {
      const job = dutyJobs.find((item) => item.id === record.jobId);
      const names = record.studentIds.map((id) => studentName(id)).join("、");
      const keywordOk = !dutyKeyword.trim() || `${record.date}${record.day}${record.status}${record.note}${job?.name ?? ""}${names}`.includes(dutyKeyword.trim());
      const statusOk = dutyStatusFilter === "全部" || record.status === dutyStatusFilter;
      return keywordOk && statusOk;
    });
    const dutyAssignJob = dutyAssignTarget ? enabledDutyJobs.find((job) => job.id === dutyAssignTarget.jobId) ?? allDutyJobs.find((job) => job.id === dutyAssignTarget.jobId) : undefined;
    const dutyAssignJobIndex = dutyAssignJob ? Math.max(0, enabledDutyJobs.findIndex((job) => job.id === dutyAssignJob.id)) : 0;
    const dutyAssignStudents = dutyAssignTarget && dutyAssignJob ? assignedDutyStudents(dutyAssignTarget.day, dutyAssignJob, dutyAssignJobIndex) : [];
    function markDutyMobile(day: string, job: DutyJob, jobIndex: number, status: DutyRecord["status"]) {
      const assigned = assignedDutyStudents(day, job, jobIndex);
      const existing = dutyRecordFor(day, job);
      const next: DutyRecord = {
        id: existing?.id ?? makeId(),
        classId: activeClass.id,
        date: today(),
        day,
        jobId: job.id,
        studentIds: assigned.map((student) => student.id),
        status,
        note: existing?.note ?? "",
        checkedBy: existing?.checkedBy ?? "劳动委员",
        createdAt: existing?.createdAt ?? currentTimestamp(),
      };
      update((current) => ({ ...current, dutyRecords: [next, ...(current.dutyRecords ?? []).filter((record) => record.id !== next.id)] }));
      notify(`${day} ${job.name} 已记录为${status}`, "success");
    }
    function assignDutyMobile(day: string, job: DutyJob, studentId: string) {
      const existing = dutyRecordFor(day, job);
      if (!studentId) {
        update((current) => ({ ...current, dutyRecords: (current.dutyRecords ?? []).filter((record) => !(record.date === today() && record.day === day && record.jobId === job.id)) }));
        setDutyAssignTarget(null);
        notify("已恢复自动轮换", "success");
        return;
      }
      const next: DutyRecord = {
        id: existing?.id ?? makeId(),
        classId: activeClass.id,
        date: today(),
        day,
        jobId: job.id,
        studentIds: [studentId],
        status: existing?.status ?? "待检查",
        note: existing?.note ?? "",
        checkedBy: existing?.checkedBy ?? "劳动委员",
        createdAt: existing?.createdAt ?? currentTimestamp(),
      };
      update((current) => ({ ...current, dutyRecords: [next, ...(current.dutyRecords ?? []).filter((record) => record.id !== next.id)] }));
      setDutyAssignTarget(null);
      notify("负责学生已指定", "success");
    }
    function patchDutyRecordNote(recordId: string, note: string) {
      update((current) => ({ ...current, dutyRecords: (current.dutyRecords ?? []).map((record) => record.id === recordId ? { ...record, note } : record) }));
    }
    function rotateDutyWeek() {
      update((current) => ({ ...current, dutyOffset: ((current.dutyOffset ?? 0) + 1) % dutyGroups }));
      notify("已轮换一周", "success");
    }
    return <div className="mobile-stack mobile-duty-page">
      <MobileSectionHero title={title} text={`${dutyDay.replace("星期", "周")} · ${pendingDutyCount} 项待检查 · 本周 ${weekRate}%`} />
      <section className="mobile-duty-quick-stats mobile-insight-rail" aria-label="值日岗位概览"><span><small>检查日</small><b>{dutyDay.replace("星期", "周")}</b></span><span><small>今日进度</small><b>{Math.max(0, enabledDutyCount - pendingDutyCount)}/{enabledDutyCount}</b></span><span><small>本周完成</small><b>{weekRate}%</b></span></section>
      <nav className="mobile-segmented duty-tabs" aria-label="值日岗位视图">{(["今日", "周表", "岗位", "台账"] as const).map((view) => <button type="button" className={dutyView === view ? "active" : ""} key={view} onClick={() => setDutyView(view)}><b>{view}</b><span>{view === "今日" ? "检查" : view === "周表" ? "轮换" : view === "岗位" ? "设置" : "记录"}</span></button>)}</nav>
      <nav className="mobile-chip-tabs duty-days">{mobileDutyDays.map((day) => <button type="button" className={dutyDay === day ? "active" : ""} key={day} onClick={() => setDutyDay(day)}>{day}</button>)}</nav>
      {dutyView === "今日" && <section className="mobile-card-list mobile-duty-check"><header><h2>岗位检查</h2></header>{enabledDutyJobs.map((job, jobIndex) => {
        const record = dutyRecordFor(dutyDay, job);
        const assigned = assignedDutyStudents(dutyDay, job, jobIndex);
        const status = record?.status ?? "待检查";
        return <article className={`status-${status}`} key={job.id}><button type="button" onClick={() => setDetail({ title: job.name, children: <><div className="mobile-sheet-section"><h3>区域</h3><p>{job.area}</p></div><div className="mobile-sheet-section"><h3>标准</h3><p>{job.standard}</p></div><div className="mobile-detail-grid"><span><small>负责学生</small><b>{assigned.map((student) => student.name).join("、") || "待安排"}</b></span><span><small>状态</small><b>{status}</b></span></div><div className="mobile-sheet-actions"><button type="button" onClick={() => markDutyMobile(dutyDay, job, jobIndex, "已完成")}>完成</button><button type="button" onClick={() => markDutyMobile(dutyDay, job, jobIndex, "需返工")}>返工</button></div><div className="mobile-sheet-actions"><button type="button" onClick={() => setDutyAssignTarget({ day: dutyDay, jobId: job.id })}>指定学生</button><button type="button" onClick={() => openDutyEditor(job)}>编辑岗位</button></div></> })}><span><b>{job.name}</b><small>{job.area} · {assigned.map((student) => student.name).join("、") || "待安排"}</small></span><em className={`mobile-duty-status status-${status}`}>{status}</em></button><div><button type="button" className={status === "已完成" ? "active done" : ""} onClick={() => markDutyMobile(dutyDay, job, jobIndex, "已完成")}>完成</button><button type="button" className={status === "需返工" ? "active rework" : ""} onClick={() => markDutyMobile(dutyDay, job, jobIndex, "需返工")}>返工</button><button type="button" onClick={() => setDutyAssignTarget({ day: dutyDay, jobId: job.id })}>指定</button></div></article>;
      })}</section>}
      {dutyView === "周表" && <section className="mobile-card-list mobile-duty-week"><header><h2>一周值日表</h2><button type="button" onClick={rotateDutyWeek}>轮换下周</button></header>{mobileDutyDays.map((day, dayIndex) => <article key={day}><b>{day} · 第{((dayIndex + (data.dutyOffset ?? 0)) % dutyGroups) + 1}组</b>{enabledDutyJobs.map((job, jobIndex) => <button type="button" key={job.id} onClick={() => setDutyAssignTarget({ day, jobId: job.id })}><span>{job.name}</span><em>{assignedDutyStudents(day, job, jobIndex).map((student) => student.name).join("、") || "待安排"}</em></button>)}</article>)}<button type="button" className="mobile-text-action" onClick={() => copyTextToClipboard(dutyText, "已复制值日表")}>复制当前值日表</button></section>}
      {dutyView === "岗位" && <section className="mobile-card-list"><header><h2>岗位设置</h2><button type="button" onClick={() => openDutyEditor()}>新增</button></header>{allDutyJobs.map((job) => <button type="button" key={job.id} onClick={() => setDetail({ title: job.name, children: <><div className="mobile-detail-grid"><span><small>状态</small><b>{job.enabled === false ? "停用" : "启用"}</b></span><span><small>固定学生</small><b>{(job.studentIds ?? []).map((id) => studentName(id)).join("、") || "自动轮换"}</b></span></div><div className="mobile-sheet-section"><h3>区域</h3><p>{job.area}</p></div><div className="mobile-sheet-section"><h3>标准</h3><p>{job.standard}</p></div><div className="mobile-sheet-actions"><button type="button" onClick={() => openDutyEditor(job)}>编辑岗位</button><button type="button" onClick={() => { update((current) => ({ ...current, dutyJobs: allDutyJobs.map((item) => item.id === job.id ? { ...item, enabled: item.enabled === false } : item) })); setDetail(null); notify("岗位状态已更新", "success"); }}>{job.enabled === false ? "启用岗位" : "停用岗位"}</button></div></> })}><b>{job.name}</b><span>{job.enabled === false ? "停用" : "启用"} · {job.area} · {(job.studentIds ?? []).map((id) => studentName(id)).join("、") || "自动轮换"}</span></button>)}</section>}
      {dutyView === "台账" && <>
        <label className="mobile-search"><span>搜索台账</span><input value={dutyKeyword} onChange={(event) => setDutyKeyword(event.target.value)} placeholder="日期、岗位、学生、状态或备注" /></label>
        <nav className="mobile-chip-tabs">{(["全部", "待检查", "已完成", "需返工", "已替换"] as const).map((status) => <button type="button" className={dutyStatusFilter === status ? "active" : ""} key={status} onClick={() => setDutyStatusFilter(status)}>{status}</button>)}</nav>
        <section className="mobile-card-list"><header><h2>检查记录</h2><button type="button" onClick={() => copyTextToClipboard(filteredDutyRecords.map((record) => `${record.date} ${record.day} ${allDutyJobs.find((job) => job.id === record.jobId)?.name ?? "值日岗位"} ${record.status} ${record.note}`).join("\n"), "已复制检查台账")}>复制</button></header>{filteredDutyRecords.slice(0, 20).map((record) => <article className="mobile-duty-record" key={record.id}><b>{record.day} · {allDutyJobs.find((job) => job.id === record.jobId)?.name ?? "值日岗位"}</b><span>{record.date} · {record.status} · {(record.studentIds ?? []).map((id) => studentName(id)).join("、") || "未记录学生"}</span><textarea value={record.note} placeholder="补充检查备注" onChange={(event) => patchDutyRecordNote(record.id, event.target.value)} /></article>)}{!filteredDutyRecords.length && <article><b>暂无记录</b><span>可以从岗位检查里记录完成或返工。</span></article>}</section>
      </>}
      {detail && <MobileInfoSheet title={detail.title} onClose={() => setDetail(null)}>{detail.children}</MobileInfoSheet>}
      {dutyEditorOpen && <MobileInfoSheet title={dutyDraft.id ? "编辑值日岗位" : "新增值日岗位"} onClose={() => setDutyEditorOpen(false)}>
        <div className="mobile-form-grid">
          <label><span>岗位名称</span><input value={dutyDraft.name} onChange={(event) => setDutyDraft({ ...dutyDraft, name: event.target.value })} /></label>
          <label><span>启用状态</span><select value={dutyDraft.enabled ? "启用" : "停用"} onChange={(event) => setDutyDraft({ ...dutyDraft, enabled: event.target.value === "启用" })}><option>启用</option><option>停用</option></select></label>
          <label className="wide"><span>负责区域</span><input value={dutyDraft.area} onChange={(event) => setDutyDraft({ ...dutyDraft, area: event.target.value })} /></label>
          <label className="wide"><span>检查标准</span><textarea value={dutyDraft.standard} onChange={(event) => setDutyDraft({ ...dutyDraft, standard: event.target.value })} /></label>
          <label className="wide"><span>固定学生</span><button type="button" className="mobile-picker-trigger" disabled={!dutyDraft.id} onClick={() => setDutyFixedPickerId(dutyDraft.id)}>{(dutyDraft.studentIds ?? []).map((id) => studentName(id)).join("、") || (dutyDraft.id ? "按小组自动轮换" : "新增岗位保存后可固定学生")}</button></label>
        </div>
        <div className="mobile-sheet-actions"><button type="button" onClick={() => setDutyEditorOpen(false)}>取消</button><button type="button" className="primary" onClick={saveDutyDraft}>保存岗位</button></div>
      </MobileInfoSheet>}
      {dutyAssignTarget && dutyAssignJob && <StudentLookupDialog title="选择值日学生" subtitle={`${dutyAssignTarget.day} · ${dutyAssignJob.name} · 当前 ${dutyAssignStudents.map((student) => student.name).join("、") || "自动轮换"}`} students={students} selectedId={dutyAssignStudents[0]?.id} allowClear clearLabel="恢复自动轮换" onPick={(student) => assignDutyMobile(dutyAssignTarget.day, dutyAssignJob, student.id)} onClear={() => assignDutyMobile(dutyAssignTarget.day, dutyAssignJob, "")} onClose={() => setDutyAssignTarget(null)} />}
      {dutyFixedPickerId && <StudentLookupDialog title="选择固定值日学生" subtitle={allDutyJobs.find((job) => job.id === dutyFixedPickerId)?.name ?? "值日岗位"} students={students} selectedId={allDutyJobs.find((job) => job.id === dutyFixedPickerId)?.studentIds?.[0]} allowClear clearLabel="恢复轮换" onPick={(student) => { update((current) => ({ ...current, dutyJobs: allDutyJobs.map((job) => job.id === dutyFixedPickerId ? { ...job, studentIds: [student.id] } : job) })); setDutyDraft((current) => current.id === dutyFixedPickerId ? { ...current, studentIds: [student.id] } : current); setDutyFixedPickerId(""); notify("固定学生已更新", "success"); }} onClear={() => { update((current) => ({ ...current, dutyJobs: allDutyJobs.map((job) => job.id === dutyFixedPickerId ? { ...job, studentIds: [] } : job) })); setDutyDraft((current) => current.id === dutyFixedPickerId ? { ...current, studentIds: [] } : current); setDutyFixedPickerId(""); notify("已恢复自动轮换", "success"); }} onClose={() => setDutyFixedPickerId("")} />}
    </div>;
  }

  if (active === "comments") {
    const scheduleCommentTerm = scheduleTermLabel(data.scheduleConfig, activeClass.term || "当前学期");
    const commentTermOptions = Array.from(new Set([scheduleCommentTerm, activeClass.term, ...comments.map((comment) => comment.term)].map((item) => item?.trim()).filter(Boolean)));
    const activeCommentTerm = commentTermOptions.includes(commentTermFilter) ? commentTermFilter : commentTermOptions[0] ?? scheduleCommentTerm;
    const termComments = comments.filter((comment) => comment.term === activeCommentTerm);
    const filteredComments = termComments.filter((comment) => {
      const text = `${studentName(comment.studentId)}${comment.term}${comment.style}${comment.content}`;
      return !commentKeyword.trim() || text.includes(commentKeyword.trim());
    });
    const uncommented = students.filter((student) => !comments.some((comment) => comment.studentId === student.id && comment.term === activeCommentTerm));
    const commentGroupOptions = ["全部小组", ...Array.from(new Set(students.map((student) => student.group))).sort((a, b) => a - b).map((group) => `第${group}组`)];
    const activeCommentGroupFilter = commentGroupOptions.includes(commentGroupFilter) ? commentGroupFilter : "全部小组";
    const filteredCommentStudents = students.filter((student) => {
      const text = `${student.name}${student.studentNo ?? ""}${student.group}`;
      const matchesKeyword = !commentStudentKeyword.trim() || text.includes(commentStudentKeyword.trim());
      const matchesGroup = activeCommentGroupFilter === "全部小组" || activeCommentGroupFilter === `第${student.group}组`;
      return matchesKeyword && matchesGroup;
    });
    const commentPageSize = 8;
    const totalCommentPages = Math.max(1, Math.ceil(filteredComments.length / commentPageSize));
    const safeCommentPage = Math.min(commentPage, totalCommentPages);
    const pagedComments = filteredComments.slice((safeCommentPage - 1) * commentPageSize, safeCommentPage * commentPageSize);
    const commentPendingPageSize = 10;
    const totalPendingPages = Math.max(1, Math.ceil(filteredCommentStudents.length / commentPendingPageSize));
    const safePendingPage = Math.min(commentPendingPage, totalPendingPages);
    const pagedCommentStudents = filteredCommentStudents.slice((safePendingPage - 1) * commentPendingPageSize, safePendingPage * commentPendingPageSize);
    const selectedCommentStudent = students.find((student) => student.id === commentDraft.studentId) ?? students[0];
    const selectedCommentRecords = selectedCommentStudent ? commentRecordsFor(selectedCommentStudent).filter((item) => commentSelectedRecordIds.includes(item.id)) : [];
    const selectedCommentEvents = selectedCommentStudent ? commentEventsFor(selectedCommentStudent).filter((item) => commentSelectedEventIds.includes(item.id)) : [];
    const selectedCommentReflections = selectedCommentStudent ? commentReflectionsFor(selectedCommentStudent).filter((item) => commentSelectedReflectionIds.includes(item.id)) : [];
    const commentBasisCount = selectedCommentRecords.length + selectedCommentEvents.length + selectedCommentReflections.length;
    const appendCommentText = (text: string) => setCommentDraft((current) => ({ ...current, content: appendTermCommentText(current.content, text) }));
    const changeCommentStyle = async (style: TermComment["style"]) => {
      const student = selectedCommentStudent;
      if (!student) {
        setCommentDraft((current) => ({ ...current, style }));
        return;
      }
      const existing = comments.find((item) => item.studentId === student.id && item.term === commentDraft.term && item.style === style);
      if (existing && existing.id !== commentDraft.id && commentDraft.content !== (comments.find(item => item.id === commentDraft.id)?.content ?? "")
        && !await requestDangerConfirm("切换后会放弃当前未保存的评语内容。", "切换评语语气", "放弃并切换")) return;
      setCommentEditorMessage("");
      setCommentDraft(existing ? { ...existing } : { ...commentDraft, id: "", classId: activeClass.id, style, updatedAt: today() });
    };
    return <div className="mobile-stack mobile-comments-page">
      <MobileSectionHero title={title} text={`${activeCommentTerm} 已保存 ${termComments.length} 条评语，可从学生列表继续填写。`} />
      <section className="mobile-overview-stats compact" aria-label="期末评语概览"><span><small>本学期</small><b>{comments.filter((comment) => comment.term === activeCommentTerm).length}</b></span><span><small>未填写</small><b>{uncommented.length}</b></span><span><small>可用依据</small><b>{records.length + events.length + reflections.length}</b></span></section>
      <section className="mobile-card-list mobile-comment-term-panel">
        <label className="mobile-search compact in-card"><span>学期</span><select value={activeCommentTerm} onChange={(event) => { setCommentTermFilter(event.target.value); setCommentPage(1); setCommentPendingPage(1); }}>{commentTermOptions.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      </section>
      <nav className="mobile-chip-tabs mobile-comment-view-tabs"><button type="button" className={commentView === "students" ? "active" : ""} onClick={() => { setCommentView("students"); setCommentPendingPage(1); }}><b>学生列表</b><span>{filteredCommentStudents.length} 人</span></button><button type="button" className={commentView === "saved" ? "active" : ""} onClick={() => { setCommentView("saved"); setCommentPage(1); }}><b>保存后的评语</b><span>{filteredComments.length} 条</span></button></nav>
      {detail && <MobileInfoSheet title={detail.title} onClose={() => setDetail(null)}>{detail.children}</MobileInfoSheet>}
      {commentView === "students" && <>
        <section className="mobile-comment-filters">
          <label className="mobile-search"><span>搜索学生</span><input value={commentStudentKeyword} onChange={(event) => { setCommentStudentKeyword(event.target.value); setCommentPendingPage(1); }} placeholder="姓名、学号或小组" /></label>
          <label className="mobile-search compact"><span>小组</span><select value={activeCommentGroupFilter} onChange={(event) => { setCommentGroupFilter(event.target.value); setCommentPendingPage(1); }}>{commentGroupOptions.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        </section>
        <section className="mobile-card-list">
          <header><h2>学生列表</h2></header>
          {pagedCommentStudents.map((student) => {
            const savedComment = comments.find((comment) => comment.studentId === student.id && comment.term === activeCommentTerm);
            return <button type="button" key={student.id} onClick={() => openCommentEditor(savedComment, student)}><b>{student.name} · {savedComment ? "已保存" : "未填写"}</b><span>学号 {student.studentNo || "未填"} · 第{student.group}组 · {commentRecordsFor(student).length + commentEventsFor(student).length + commentReflectionsFor(student).length} 条可用依据</span></button>;
          })}
          {!filteredCommentStudents.length && <article><b>没有找到学生</b><span>可以换一个姓名、学号或小组关键词。</span></article>}
          <div className="mobile-list-pager"><button type="button" disabled={safePendingPage <= 1} onClick={() => setCommentPendingPage((page) => Math.max(1, page - 1))}>上一页</button><span>{safePendingPage} / {totalPendingPages} · 共 {filteredCommentStudents.length} 人</span><button type="button" disabled={safePendingPage >= totalPendingPages} onClick={() => setCommentPendingPage((page) => Math.min(totalPendingPages, page + 1))}>下一页</button></div>
        </section>
      </>}
      {commentView === "saved" && <>
        <label className="mobile-search"><span>搜索评语</span><input value={commentKeyword} onChange={(event) => { setCommentKeyword(event.target.value); setCommentPage(1); }} placeholder="学生、学期或内容" /></label>
        <section className="mobile-card-list">
          <header><h2>保存后的评语</h2><button type="button" onClick={() => copyTextToClipboard(filteredComments.map((comment) => `${studentName(comment.studentId)}：${comment.content}`).join("\n\n"), "已复制评语列表")}>复制当前列表</button></header>
          {pagedComments.map((comment) => <button type="button" key={comment.id} onClick={() => openCommentEditor(comment)}><b>{studentName(comment.studentId)} · {comment.style}</b><span>{comment.term} · {comment.content}</span></button>)}
          {!filteredComments.length && <article><b>暂无已保存评语</b><span>可以切换学期、搜索条件或从学生列表进入填写。</span></article>}
          <div className="mobile-list-pager"><button type="button" disabled={safeCommentPage <= 1} onClick={() => setCommentPage((page) => Math.max(1, page - 1))}>上一页</button><span>{safeCommentPage} / {totalCommentPages} · 共 {filteredComments.length} 条</span><button type="button" disabled={safeCommentPage >= totalCommentPages} onClick={() => setCommentPage((page) => Math.min(totalCommentPages, page + 1))}>下一页</button></div>
        </section>
      </>}
      {commentEditorOpen && <MobileInfoSheet title={commentDraft.id ? "编辑评语" : "填写评语"} onClose={() => void closeCommentEditorMobile()}>
        {commentAiError && <p className="mobile-form-error">{commentAiError}</p>}
        {commentEditorMessage && <p className="mobile-form-message" role="status">{commentEditorMessage}</p>}
        {selectedCommentStudent && <section className="mobile-comment-person">
          <b>{selectedCommentStudent.name}</b>
          <span>{commentDraft.term} · 第{selectedCommentStudent.group}组 · 已选 {commentBasisCount} 条依据</span>
        </section>}
        <div className="mobile-form-grid mobile-comment-editor-form">
          <label className="wide"><span>语气</span><select value={commentDraft.style} onChange={(event) => void changeCommentStyle(event.target.value as TermComment["style"])}><option>家长可读</option><option>温和鼓励</option><option>客观正式</option></select></label>
          <label className="wide"><span>老师补充</span><textarea value={commentTeacherInput} onChange={(event) => setCommentTeacherInput(event.target.value)} placeholder="例如：课堂表达更主动，但作业订正还需要提醒；希望语气温和一些。" /></label>
          <label className="wide"><span>评语内容</span><textarea aria-label="评语内容" value={commentDraft.content} onChange={(event) => { setCommentDraft({ ...commentDraft, content: event.target.value }); setCommentEditorMessage(""); }} /></label>
        </div>
        <div className="mobile-comment-basis-strip"><span>AI帮写依据</span><em>沟通 {selectedCommentRecords.length}</em><em>积分 {selectedCommentEvents.length}</em><em>反思 {selectedCommentReflections.length}</em></div>
        <div className="campus-editor-tools"><button type="button" onClick={() => {
          if (!selectedCommentStudent) return;
          const content = buildLocalTermCommentDraft(selectedCommentStudent, commentDraft.style, { records: selectedCommentRecords, events: selectedCommentEvents, reflections: selectedCommentReflections, teacherInput: commentTeacherInput });
          if (!content) {
            setCommentEditorMessage("还没有可整理的依据。请先选择记录或填写老师补充。");
            return;
          }
          setCommentDraft((current) => ({ ...current, content }));
          setCommentEditorMessage("已按当前选中的真实记录生成本地草稿，请检查后保存。");
        }}>本地生成</button><button type="button" disabled={commentAiBusy} onClick={generateCommentMobile}>{commentAiBusy ? "AI帮写中" : "AI帮写"}</button></div>
        {workspaceToken !== "demo" && <div className="campus-editor-tools"><button type="button" onClick={() => void disableAiConsent().catch((error) => setCommentAiError(error instanceof Error ? error.message : "AI 设置更新失败"))}>关闭 AI 数据授权</button></div>}
        <div className="campus-editor-tools"><button type="button" onClick={() => setCommentEvidenceOpen(true)}>选择依据</button><button type="button" onClick={() => copyTextToClipboard(commentDraft.content, "已复制评语")}>复制评语</button></div>
        <div className="mobile-sheet-actions"><button type="button" onClick={() => void closeCommentEditorMobile()}>关闭</button><button type="button" className="primary" onClick={saveCommentMobile}>保存评语</button></div>
      </MobileInfoSheet>}
      {commentEvidenceOpen && selectedCommentStudent && <MobileInfoSheet title={`${selectedCommentStudent.name} · 选择依据`} onClose={() => setCommentEvidenceOpen(false)}>
        <section className="mobile-comment-evidence-list">
          {[...commentRecordsFor(selectedCommentStudent).map((item) => ({ id: item.id, kind: "record" as const, title: item.type, text: `${item.date} · ${item.content}`, append: `平时记录中还可以看到：${item.content}` })), ...commentReflectionsFor(selectedCommentStudent).map((item) => ({ id: item.id, kind: "reflection" as const, title: "考试反思", text: `${item.date} · ${item.problem || "已填写反思"} · ${item.action || "待补充行动"}`, append: `考试反思中记录：${item.problem}${item.action ? `，下一步是${item.action}` : ""}` })), ...commentEventsFor(selectedCommentStudent).map((item) => ({ id: item.id, kind: "event" as const, title: "积分记录", text: `${item.date} · ${item.reason} · ${item.delta > 0 ? "+" : ""}${item.delta}分`, append: `积分记录中体现：${item.reason}` }))].map((item) => {
            const checked = item.kind === "record" ? commentSelectedRecordIds.includes(item.id) : item.kind === "reflection" ? commentSelectedReflectionIds.includes(item.id) : commentSelectedEventIds.includes(item.id);
            const toggle = (next: boolean) => {
              if (item.kind === "record") setCommentSelectedRecordIds((list) => next ? [...list, item.id] : list.filter((idValue) => idValue !== item.id));
              if (item.kind === "reflection") setCommentSelectedReflectionIds((list) => next ? [...list, item.id] : list.filter((idValue) => idValue !== item.id));
              if (item.kind === "event") setCommentSelectedEventIds((list) => next ? [...list, item.id] : list.filter((idValue) => idValue !== item.id));
            };
            return <article key={`${item.kind}-${item.id}`}>
              <label><input type="checkbox" checked={checked} onChange={(event) => toggle(event.target.checked)} /><span><b>{item.title}</b><small>{item.text}</small></span></label>
              <button type="button" onClick={() => appendCommentText(item.append)}>追加</button>
            </article>;
          })}
          {commentRecordsFor(selectedCommentStudent).length + commentReflectionsFor(selectedCommentStudent).length + commentEventsFor(selectedCommentStudent).length === 0 && <p className="mobile-empty">暂无可用依据，可以先到家校沟通、考试反思或积分评价补充记录。</p>}
        </section>
        <div className="mobile-sheet-actions"><button type="button" onClick={() => resetMobileCommentEvidence(selectedCommentStudent)}>恢复默认</button><button type="button" className="primary" onClick={() => setCommentEvidenceOpen(false)}>完成</button></div>
      </MobileInfoSheet>}
    </div>;
  }

  if (active === "reflection") {
    const reflectionExams = mobileReflectionExams;
    if (!reflectionExams.length) return <div className="mobile-stack mobile-reflection-page">
      <MobileSectionHero title={title} text="先建立真实考试，再为学生填写考试反思。" />
      <section className="mobile-card-list"><article><b>还没有可反思的考试</b><span>成绩分析中新增考试后，这里会显示对应学生和成绩上下文。</span><button type="button" onClick={() => open("scores")}>去成绩分析</button></article></section>
    </div>;
    const currentReflectionExam = reflectionExams.find((item) => item.id === reflectionExamFilter) ?? reflectionExams[0];
    const currentReflectionSubjects = currentReflectionExam ? scoreSubjects(currentReflectionExam) : [];
    const currentReflectionRows = currentReflectionExam ? scoreRowsFor(currentReflectionExam, students, reflections).sort((a, b) => {
      if (a.followUp !== b.followUp) return a.followUp ? -1 : 1;
      const aReflection = reflections.find((entry) => entry.examId === currentReflectionExam.id && entry.studentId === a.student.id);
      const bReflection = reflections.find((entry) => entry.examId === currentReflectionExam.id && entry.studentId === b.student.id);
      if (!!aReflection !== !!bReflection) return aReflection ? 1 : -1;
      return a.total - b.total;
    }) : [];
    const currentExamReflections = reflections.filter((item) => item.examId === currentReflectionExam?.id);
    const currentExamFollowCount = currentReflectionRows.filter((row) => row.followUp).length;
    const openLinkedReflection = (exam: ScoreExam, row: ReturnType<typeof scoreRowsFor>[number]) => {
      const existing = reflections.find((item) => item.examId === exam.id && item.studentId === row.student.id);
      setDetail(null);
      setReflectionDraft(existing ? { ...existing } : {
        id: "",
        studentId: row.student.id,
        examId: exam.id,
        date: today(),
        problem: row.followUp ? `${exam.title}需要重点跟进，请结合本次成绩和课堂表现复盘。` : "",
        reason: "",
        action: row.advice,
        familyMessage: "",
        teacherNote: "",
        status: "草稿",
      });
      setReflectionEditorOpen(true);
    };
    const filteredReflections = reflections.filter((item) => {
      const examTitle = reflectionExams.find((exam) => exam.id === item.examId)?.title ?? "";
      const text = `${studentName(item.studentId)}${examTitle}${item.date}${item.status}${item.problem}${item.reason}${item.action}${item.teacherNote}`;
      return (reflectionStatusFilter === "全部" || item.status === reflectionStatusFilter) && (!reflectionKeyword.trim() || text.includes(reflectionKeyword.trim()));
    });
    const reflectionPageSize = 10;
    const reflectionStudentPageCount = Math.max(1, Math.ceil(currentReflectionRows.length / reflectionPageSize));
    const safeReflectionStudentPage = Math.min(reflectionStudentPage, reflectionStudentPageCount);
    const pagedReflectionRows = currentReflectionRows.slice((safeReflectionStudentPage - 1) * reflectionPageSize, safeReflectionStudentPage * reflectionPageSize);
    const reflectionSavedPageCount = Math.max(1, Math.ceil(filteredReflections.length / reflectionPageSize));
    const safeReflectionSavedPage = Math.min(reflectionSavedPage, reflectionSavedPageCount);
    const pagedReflections = filteredReflections.slice((safeReflectionSavedPage - 1) * reflectionPageSize, safeReflectionSavedPage * reflectionPageSize);
    const followTargets = reflectionExams.flatMap((exam) => (exam.followUpStudentIds ?? []).map((studentId) => ({ exam, student: students.find((student) => student.id === studentId) }))).filter((item) => item.student);
    return <div className="mobile-stack mobile-reflection-page">
      <MobileSectionHero title={title} text={`${currentReflectionRows.length} 人待复盘 · 已完成 ${reflections.filter((item) => item.status === "已完成").length}`} />
      <section className="mobile-overview-stats compact" aria-label="考试反思概览"><span><small>已完成</small><b>{reflections.filter((item) => item.status === "已完成").length}</b></span><span><small>草稿</small><b>{reflections.filter((item) => item.status === "草稿").length}</b></span><span><small>重点跟进</small><b>{followTargets.length}</b></span></section>
      <section className="mobile-card-list mobile-reflection-current">
        <label className="mobile-search compact in-card"><span>当前考试</span><select value={currentReflectionExam?.id ?? ""} onChange={(event) => setReflectionExamFilter(event.target.value)}>{reflectionExams.map((exam) => <option value={exam.id} key={exam.id}>{exam.title} · {exam.date}</option>)}</select></label>
        {currentReflectionExam && <div className="mobile-reflection-exam-note"><b>{currentReflectionExam.title}</b><span>{currentReflectionExam.date} · {currentReflectionSubjects.join("，")} · 已写 {currentExamReflections.length}/{students.length} 人 · 重点跟进 {currentExamFollowCount} 人</span></div>}
      </section>
      <nav className="mobile-chip-tabs mobile-reflection-view-tabs"><button type="button" className={reflectionMobileView === "students" ? "active" : ""} onClick={() => { setReflectionMobileView("students"); setReflectionStudentPage(1); }}><b>学生状态</b><span>{currentReflectionRows.length} 人</span></button><button type="button" className={reflectionMobileView === "saved" ? "active" : ""} onClick={() => { setReflectionMobileView("saved"); setReflectionSavedPage(1); }}><b>已保存反思</b><span>{filteredReflections.length} 条</span></button></nav>
      {reflectionMobileView === "students" && <section className="mobile-card-list mobile-reflection-student-panel"><header><h2>学生复盘状态</h2><span>点击学生直接填写</span></header><div className="mobile-reflection-linked-list">{pagedReflectionRows.map((row) => {
        if (!currentReflectionExam) return null;
        const itemReflection = reflections.find((item) => item.examId === currentReflectionExam.id && item.studentId === row.student.id);
        const statusText = itemReflection?.status ?? (row.followUp ? "重点跟进" : "未填写");
        const scoreText = row.complete ? `总分 ${row.total} · 平均 ${row.average}` : row.enteredCount ? `已录 ${row.enteredCount}/${currentReflectionSubjects.length} · 已录平均 ${row.average}` : "成绩未录入";
        return <button type="button" className={row.followUp ? "follow" : ""} key={`${currentReflectionExam.id}-${row.student.id}`} onClick={() => openLinkedReflection(currentReflectionExam, row)}><span><b>{row.student.name} · {statusText}</b><small>{scoreText} · {row.followUp ? "需要重点复盘" : "常规复盘"}</small></span><em>{itemReflection ? "继续编辑" : "填写"}</em></button>;
      })}{!currentReflectionRows.length && <article><b>暂无成绩数据</b><span>请先在成绩分析页面录入本次考试成绩。</span></article>}</div>{currentReflectionRows.length > reflectionPageSize && <div className="mobile-list-pager"><button type="button" disabled={safeReflectionStudentPage <= 1} onClick={() => setReflectionStudentPage((page) => page - 1)}>上一页</button><span>{safeReflectionStudentPage} / {reflectionStudentPageCount}</span><button type="button" disabled={safeReflectionStudentPage >= reflectionStudentPageCount} onClick={() => setReflectionStudentPage((page) => page + 1)}>下一页</button></div>}</section>}
      {reflectionMobileView === "saved" && <><label className="mobile-search"><span>搜索已保存反思</span><input value={reflectionKeyword} onChange={(event) => setReflectionKeyword(event.target.value)} placeholder="学生、问题、原因、行动或备注" /></label>
      <nav className="mobile-chip-tabs">{["全部", "草稿", "已完成"].map((item) => <button type="button" className={reflectionStatusFilter === item ? "active" : ""} key={item} onClick={() => setReflectionStatusFilter(item as typeof reflectionStatusFilter)}>{item}</button>)}</nav>
      <section className="mobile-card-list"><header><h2>已保存反思</h2><span>{filteredReflections.length} 条</span></header>{pagedReflections.map((item) => {
        const exam = reflectionExams.find((entry) => entry.id === item.examId);
        return <button type="button" key={item.id} onClick={() => setDetail({ title: `${studentName(item.studentId)} · ${item.status}`, children: <><div className="mobile-detail-grid"><span><small>考试</small><b>{exam?.title ?? "未关联"}</b></span><span><small>日期</small><b>{item.date}</b></span></div><div className="mobile-sheet-section"><h3>主要问题</h3><p>{item.problem || "未填写"}</p></div><div className="mobile-sheet-section"><h3>原因分析</h3><p>{item.reason || "未填写"}</p></div><div className="mobile-sheet-section"><h3>行动</h3><p>{item.action || "未填写"}</p></div><div className="mobile-sheet-section"><h3>家长配合</h3><p>{item.familyMessage || "未填写"}</p></div><div className="mobile-sheet-actions"><button type="button" onClick={() => openReflectionEditor(item)}>编辑反思</button><button type="button" onClick={() => copyTextToClipboard(`${item.problem}\n${item.reason}\n${item.action}`, "已复制反思")}>复制反思</button></div></> })}><b>{studentName(item.studentId)} · {item.status}</b><span>{exam?.title ? `${exam.title} · ` : ""}{item.date} · {item.problem || "暂无问题描述"}</span></button>;
      })}{!filteredReflections.length && <article><b>暂无反思</b><span>切换到学生状态，选择学生后填写本次考试反思。</span></article>}{filteredReflections.length > reflectionPageSize && <div className="mobile-list-pager"><button type="button" disabled={safeReflectionSavedPage <= 1} onClick={() => setReflectionSavedPage((page) => page - 1)}>上一页</button><span>{safeReflectionSavedPage} / {reflectionSavedPageCount}</span><button type="button" disabled={safeReflectionSavedPage >= reflectionSavedPageCount} onClick={() => setReflectionSavedPage((page) => page + 1)}>下一页</button></div>}</section></>}
      {detail && <MobileInfoSheet title={detail.title} onClose={() => setDetail(null)}>{detail.children}</MobileInfoSheet>}
      {reflectionEditorOpen && <MobileInfoSheet title={`${reflectionDraft.id ? "编辑反思" : "填写反思"} · ${studentName(reflectionDraft.studentId)}`} onClose={() => setReflectionEditorOpen(false)}>
        <section className="mobile-reflection-editor-context"><span><b>{studentName(reflectionDraft.studentId)}</b><small>{reflectionExams.find((exam) => exam.id === reflectionDraft.examId)?.title ?? "当前考试"}</small></span><em>{reflectionDraft.status}</em></section>
        <div className="mobile-form-grid">
          <label><span>日期</span><input value={reflectionDraft.date} onChange={(event) => setReflectionDraft({ ...reflectionDraft, date: event.target.value })} /></label>
          <label><span>状态</span><select value={reflectionDraft.status} onChange={(event) => setReflectionDraft({ ...reflectionDraft, status: event.target.value as ExamReflection["status"] })}><option>草稿</option><option>已完成</option></select></label>
          <label className="wide"><span>主要问题</span><textarea value={reflectionDraft.problem} onChange={(event) => setReflectionDraft({ ...reflectionDraft, problem: event.target.value })} /></label>
          <label className="wide"><span>原因分析</span><textarea value={reflectionDraft.reason} onChange={(event) => setReflectionDraft({ ...reflectionDraft, reason: event.target.value })} /></label>
          <label className="wide"><span>下一步行动</span><textarea value={reflectionDraft.action} onChange={(event) => setReflectionDraft({ ...reflectionDraft, action: event.target.value })} /></label>
          <label className="wide"><span>写给家长</span><textarea value={reflectionDraft.familyMessage} onChange={(event) => setReflectionDraft({ ...reflectionDraft, familyMessage: event.target.value })} /></label>
          <label className="wide"><span>班主任跟进</span><textarea value={reflectionDraft.teacherNote} onChange={(event) => setReflectionDraft({ ...reflectionDraft, teacherNote: event.target.value })} /></label>
        </div>
        <div className="mobile-sheet-actions"><button type="button" onClick={() => saveReflectionMobile("草稿")}>保存草稿</button><button type="button" className="primary" onClick={() => saveReflectionMobile("已完成")}>完成归档</button></div>
      </MobileInfoSheet>}
    </div>;
  }

  if (active === "cadres") {
    const roleKind = (role: CadreRole): "班委" | "小组长" => ((role.scope ?? "") === "小组管理" || role.role.includes("组长") || /^第\d+组/.test(role.role)) ? "小组长" : "班委";
    const committeeRoles = cadres.filter((role) => roleKind(role) === "班委");
    const groupRoles = cadres.filter((role) => roleKind(role) === "小组长");
    const groupNumbers = Array.from(new Set(students.map((student) => student.group))).sort((a, b) => a - b);
    const groupNumberOptions = groupNumbers.length ? groupNumbers : [1];
    const roleGroupNumber = (role: CadreRole) => Number(role.role.match(/第(\d+)组/)?.[1]) || groupNumberOptions[0] || 1;
    const missingGroups = groupNumbers.filter((group) => {
      const candidates = students.filter((student) => student.group === group);
      return !groupRoles.some((role) => role.role.includes(`第${group}组`) || candidates.some((student) => student.id === role.studentId));
    });
    const averageScore = Math.round(cadres.reduce((sum, role) => sum + (role.weeklyScore ?? 0), 0) / Math.max(1, cadres.length));
    const appointmentText = cadres.map((role) => `兹聘任 ${studentName(role.studentId)} 为本班 ${role.role}，负责：${role.duty}`).join("\n");
    function openNewCadre(scope: "班级管理" | "小组管理", group?: number) {
      const safeGroup = group ?? groupNumberOptions[0] ?? 1;
      const candidates = scope === "小组管理" ? students.filter((student) => student.group === safeGroup) : students;
      setDetail(null);
      setCadreDraft({ id: "", role: scope === "小组管理" ? `第${safeGroup}组组长` : "新班委岗位", studentId: candidates[0]?.id ?? students[0]?.id ?? "", duty: scope === "小组管理" ? "负责本组纪律、作业提醒和小组协作。" : "填写岗位职责", scope, term: scheduleTermLabel(data.scheduleConfig, activeClass.term || "本学期"), status: "试用", weeklyScore: 3, summary: "填写本周履职表现。" });
      setCadreEditorOpen(true);
    }
    function cadreCandidatesForDraft() {
      if ((cadreDraft.scope ?? "班级管理") !== "小组管理") return students;
      const group = roleGroupNumber(cadreDraft);
      return students.filter((student) => student.group === group);
    }
    const filteredCadres = cadres.filter((role) => {
      const text = `${role.role}${studentName(role.studentId)}${role.duty}${role.scope ?? ""}${role.status ?? ""}`;
      const viewOk = cadreView === "全部" || roleKind(role) === cadreView;
      const statusOk = cadreScopeFilter === "全部" || (role.status ?? "在任") === cadreScopeFilter;
      return viewOk && statusOk && (!cadreKeyword.trim() || text.includes(cadreKeyword.trim()));
    });
    const groupLeaderCount = groupRoles.length;
    return <div className="mobile-stack mobile-cadres-page">
      <MobileSectionHero title={title} text={`${committeeRoles.length} 个班委 · ${groupLeaderCount} 个小组长 · 履职 ${averageScore}/5`} />
      <section className="mobile-overview-stats compact mobile-insight-rail" aria-label="班干部概览"><span><small>班委岗位</small><b>{committeeRoles.length}</b></span><span><small>小组长</small><b>{groupLeaderCount}</b></span><span><small>平均履职</small><b>{averageScore}</b></span></section>
      <nav className="mobile-segmented cadre-tabs" aria-label="班干部视图">{(["全部", "班委", "小组长"] as const).map((view) => <button type="button" className={cadreView === view ? "active" : ""} key={view} onClick={() => setCadreView(view)}><b>{view}</b><span>{view === "全部" ? cadres.length : view === "班委" ? committeeRoles.length : groupRoles.length} 个</span></button>)}</nav>
      <section className="mobile-action-row mobile-cadre-actions"><button type="button" onClick={() => openNewCadre("班级管理")}>新增班委</button><button type="button" onClick={() => openNewCadre("小组管理", missingGroups[0] ?? groupNumberOptions[0])}>新增小组长</button></section>
      {missingGroups.length > 0 && <section className="mobile-card-list mobile-cadre-gap-alert"><article><b>未设置小组长</b><span>缺少：第{missingGroups.join("组、第")}组</span></article></section>}
      <section className="mobile-cadre-filter-panel"><label className="mobile-search"><span>搜索岗位</span><input value={cadreKeyword} onChange={(event) => setCadreKeyword(event.target.value)} placeholder="岗位、学生或职责" /></label><label><span>任职状态</span><select value={cadreScopeFilter} onChange={(event) => setCadreScopeFilter(event.target.value)}><option value="全部">全部状态</option><option>在任</option><option>试用</option><option>轮换</option></select></label></section>
      <section className="mobile-card-list"><header><h2>岗位列表</h2><button type="button" onClick={() => copyTextToClipboard(appointmentText, "已复制全部聘任书")}>复制聘任书</button></header>{filteredCadres.map((role) => <button type="button" key={role.id} onClick={() => setDetail({ title: role.role, children: <><div className="mobile-detail-grid"><span><small>学生</small><b>{studentName(role.studentId)}</b></span><span><small>评分</small><b>{role.weeklyScore ?? "-"}/5</b></span><span><small>类型</small><b>{roleKind(role)}</b></span><span><small>状态</small><b>{role.status ?? "在任"}</b></span></div><div className="mobile-sheet-section"><h3>任期</h3><p>{role.term || scheduleTermLabel(data.scheduleConfig, activeClass.term || "本学期")}</p></div><div className="mobile-sheet-section"><h3>职责</h3><p>{role.duty}</p></div><div className="mobile-sheet-section"><h3>履职评价</h3><p>{role.summary || "暂无总结"}</p></div><div className="mobile-sheet-actions"><button type="button" onClick={() => openCadreEditor(role)}>编辑岗位</button><button type="button" onClick={() => copyTextToClipboard(`兹聘任 ${studentName(role.studentId)} 为本班 ${role.role}，负责：${role.duty}`, "已复制聘任书")}>复制聘任书</button></div><div className="mobile-sheet-actions single"><button type="button" onClick={() => deleteCadreMobile(role)}>删除岗位</button></div></> })}><b>{role.role} · {studentName(role.studentId)}</b><span>{roleKind(role)} · {role.status ?? "在任"} · 任期 {role.term || scheduleTermLabel(data.scheduleConfig, activeClass.term || "本学期")} · 评分 {role.weeklyScore ?? "-"}/5</span></button>)}{!filteredCadres.length && <article><b>暂无岗位</b><span>可以调整筛选或新增班干部岗位。</span></article>}</section>
      {detail && <MobileInfoSheet title={detail.title} onClose={() => setDetail(null)}>{detail.children}</MobileInfoSheet>}
      {cadreEditorOpen && <MobileInfoSheet title={cadreDraft.id ? "编辑班干部" : "新增班干部"} onClose={() => setCadreEditorOpen(false)}>
        <div className="mobile-form-grid">
          <label><span>岗位</span><input value={cadreDraft.role} onChange={(event) => setCadreDraft({ ...cadreDraft, role: event.target.value })} /></label>
          <label><span>学生</span><button type="button" className="mobile-picker-trigger" onClick={() => setCadreStudentPickerId("draft")}>{studentName(cadreDraft.studentId) || "选择学生"}</button></label>
          <label><span>岗位类型</span><select value={cadreDraft.scope ?? "班级管理"} onChange={(event) => {
            const scope = event.target.value;
            if (scope === "小组管理") {
              const group = roleGroupNumber(cadreDraft);
              const candidates = students.filter((student) => student.group === group);
              setCadreDraft({ ...cadreDraft, scope, role: `第${group}组组长`, studentId: candidates[0]?.id ?? "" });
              return;
            }
            setCadreDraft({ ...cadreDraft, scope, role: (cadreDraft.scope ?? "") === "小组管理" ? "新班委岗位" : cadreDraft.role });
          }}><option>班级管理</option><option>小组管理</option></select></label>
          {(cadreDraft.scope ?? "班级管理") === "小组管理" && <label><span>负责小组</span><select value={roleGroupNumber(cadreDraft)} onChange={(event) => {
            const group = Number(event.target.value);
            const candidates = students.filter((student) => student.group === group);
            setCadreDraft({ ...cadreDraft, role: `第${group}组组长`, studentId: candidates[0]?.id ?? "" });
          }}>{groupNumberOptions.map((group) => <option value={group} key={group}>第{group}组</option>)}</select></label>}
          <label><span>状态</span><select value={cadreDraft.status ?? "在任"} onChange={(event) => setCadreDraft({ ...cadreDraft, status: event.target.value as CadreRole["status"] })}><option>在任</option><option>试用</option><option>轮换</option></select></label>
          <label><span>任期</span><input value={cadreDraft.term ?? ""} onChange={(event) => setCadreDraft({ ...cadreDraft, term: event.target.value })} /></label>
          <label><span>本周评分</span><input type="number" value={cadreDraft.weeklyScore ?? 0} onChange={(event) => setCadreDraft({ ...cadreDraft, weeklyScore: Number(event.target.value) || 0 })} /></label>
          <label className="wide"><span>职责</span><textarea value={cadreDraft.duty} onChange={(event) => setCadreDraft({ ...cadreDraft, duty: event.target.value })} /></label>
          <label className="wide"><span>履职评价</span><textarea value={cadreDraft.summary ?? ""} onChange={(event) => setCadreDraft({ ...cadreDraft, summary: event.target.value })} /></label>
        </div>
        <div className="mobile-sheet-actions"><button type="button" onClick={() => setCadreEditorOpen(false)}>取消</button><button type="button" className="primary" onClick={saveCadreDraft}>保存岗位</button></div>
      </MobileInfoSheet>}
      {cadreStudentPickerId === "draft" && <StudentLookupDialog title="选择任职学生" subtitle={(cadreDraft.scope ?? "班级管理") === "小组管理" ? `${cadreDraft.role} 的候选学生` : "从全班候选人中搜索"} students={cadreCandidatesForDraft()} selectedId={cadreDraft.studentId} onPick={(student) => { setCadreDraft({ ...cadreDraft, studentId: student.id }); setCadreStudentPickerId(""); }} onClose={() => setCadreStudentPickerId("")} />}
    </div>;
  }

  if (active === "tools") return <div className="mobile-stack"><ClassroomTools data={data} update={update} /></div>;

  if (active === "schedule") {
    if (scheduleSurface === "我的日程") return <div className="mobile-stack mobile-schedule-page"><nav className="schedule-hub-switch mobile-schedule-hub-switch" aria-label="课程日程视图"><button type="button" onClick={() => setScheduleSurface("班级课表")}>班级课表</button><button className="active" type="button">我的日程与留痕</button></nav><TeacherAgenda data={data} update={update} mobile readOnly={readOnly} /></div>;
    const scheduleContext = getMobileScheduleContext();
    const monthWeeks = Array.from({ length: getScheduleWeeksInMonth(scheduleContext.activeMonth) }, (_, index) => {
      const week = index + 1;
      const range = getScheduleWeekDates(scheduleContext.activeMonth, week);
      const stored = (data.scheduleWeeks ?? []).some((item) => item.month === scheduleContext.activeMonth && item.weekOfMonth === week);
      return { week, range, stored };
    });
    const safeDayIndex = Math.min(scheduleDayIndex, Math.max(0, scheduleContext.config.days.length - 1));
    const currentDayCourses = scheduleContext.courses[safeDayIndex] ?? [];
    const filledCells = scheduleContext.courses.flat().filter((item) => item.trim()).length;
    const totalSlots = Math.max(1, scheduleContext.config.days.length * scheduleContext.config.periods.length);
    const scheduleEvents = scheduleContext.weekEvents.filter((event) => {
      const text = `${event.date}${event.title}${event.type}${event.detail}`;
      return (scheduleTypeFilter === "全部" || event.type === scheduleTypeFilter) && (!scheduleKeyword.trim() || text.includes(scheduleKeyword.trim()));
    });
    const filteredFocuses = scheduleContext.weekFocuses.filter((item) => {
      const text = `${item.date}${item.focus}${item.todo}${item.status}`;
      return !scheduleKeyword.trim() || text.includes(scheduleKeyword.trim());
    });
    const getSubjectTone = (value: string) => {
      if (/语文|阅读|作文|早读/.test(value)) return "language";
      if (/数学|计算|几何/.test(value)) return "math";
      if (/英语|外语/.test(value)) return "english";
      if (/体育|运动|体能/.test(value)) return "sport";
      if (/信息|科学|物理|化学|生物/.test(value)) return "science";
      if (/音乐|美术|艺术/.test(value)) return "art";
      return value.trim() ? "neutral" : "empty";
    };
    return <div className="mobile-stack mobile-schedule-page">
      <nav className="schedule-hub-switch mobile-schedule-hub-switch" aria-label="课程日程视图"><button className="active" type="button">班级课表</button><button type="button" onClick={() => setScheduleSurface("我的日程")}>我的日程与留痕</button></nav>
      <MobileSectionHero title={title} text={`${scheduleContext.weekDates.label} · ${scheduleContext.weekDates.startDate} 至 ${scheduleContext.weekDates.endDate}`} action="配置" onAction={() => { setScheduleConfigDraft(scheduleContext.config); scheduleDraftBaselines.current.config = JSON.stringify(scheduleContext.config); setScheduleEditorMessage(""); setScheduleConfigOpen(true); }} />
      <section className="mobile-schedule-period-switch" aria-label="切换月份与周次">
        <div className="mobile-schedule-pickers">
          <label className="mobile-select-field"><span>月份</span><select value={scheduleContext.activeMonth} onChange={(event) => { setScheduleMonth(event.target.value); setScheduleWeekNo(1); }}>{scheduleContext.monthOptions.map((month) => <option key={month} value={month}>{month.slice(0, 4)}年{month.slice(5)}月</option>)}</select></label>
          <label className="mobile-select-field"><span>周次</span><select value={scheduleContext.safeWeek} onChange={(event) => setScheduleWeekNo(Number(event.target.value) || 1)}>{monthWeeks.map((item) => <option value={item.week} key={item.week}>第{item.week}周{item.stored ? " · 已存" : ""}</option>)}</select></label>
        </div>
        <p><span>课程 {filledCells}/{totalSlots}</span><span>活动 {scheduleContext.weekEvents.length}</span><span>待办 {scheduleContext.weekFocuses.filter((item) => item.status !== "已完成").length}</span></p>
      </section>
      <section className="mobile-card-list mobile-schedule-table-card">
        <header><h2>本周课表</h2><button type="button" onClick={() => openCourseEditor(safeDayIndex, currentDayCourses)}>编辑当天</button></header>
        <nav className="mobile-schedule-day-tabs" aria-label="选择上课日">{scheduleContext.config.days.map((day, index) => <button type="button" className={safeDayIndex === index ? "active" : ""} key={`${day}-${index}`} onClick={() => setScheduleDayIndex(index)}>{day.replace("星期", "周")}</button>)}</nav>
        <div className="mobile-schedule-periods">
          {scheduleContext.config.periods.map((period, index) => <article key={`${period.label}-${index}`}>
            <i>{index + 1}</i><span><b>{period.label}</b><small>{period.time || "未填时间"}</small></span><em className={`subject-${getSubjectTone(currentDayCourses[index] ?? "")}`}>{currentDayCourses[index]?.trim() || "未安排"}</em>
          </article>)}
        </div>
      </section>
      <section className="mobile-schedule-event-filter">
        <label className="mobile-search"><span>搜索活动与重点</span><input value={scheduleKeyword} onChange={(event) => setScheduleKeyword(event.target.value)} placeholder="日期、标题、类型、重点或说明" /></label>
        <label className="mobile-select-field"><span>活动类型</span><select value={scheduleTypeFilter} onChange={(event) => setScheduleTypeFilter(event.target.value as typeof scheduleTypeFilter)}>{["全部", "班会", "活动", "考试", "放假", "家校", "其他"].map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      </section>
      <section className="mobile-card-list"><header><h2>班级活动</h2><button type="button" onClick={() => openScheduleEditor()}>新增</button></header>{scheduleEvents.slice(0, 12).map((event) => <button type="button" key={event.id} onClick={() => setDetail({ title: event.title, children: <><div className="mobile-detail-grid"><span><small>日期</small><b>{event.date}</b></span><span><small>类型</small><b>{event.type}</b></span></div><div className="mobile-sheet-section"><h3>说明</h3><p>{event.detail || "暂无说明"}</p></div><div className="mobile-sheet-actions"><button type="button" onClick={() => openScheduleEditor(event)}>编辑日程</button><button type="button" onClick={() => deleteScheduleEventMobile(event.id)}>删除日程</button></div></> })}><b>{event.date} · {event.title}</b><span>{event.type} · {event.detail || "暂无说明"}</span></button>)}{!scheduleEvents.length && <article><b>暂无日程事件</b><span>可以调整筛选或新增班会、考试和活动。</span></article>}</section>
      <section className="mobile-card-list"><header><h2>每日重点</h2><button type="button" onClick={() => openFocusEditor()}>新增</button></header>{filteredFocuses.slice(0, 12).map((item) => <button type="button" key={item.id} onClick={() => setDetail({ title: item.focus, children: <><div className="mobile-detail-grid"><span><small>日期</small><b>{item.date}</b></span><span><small>状态</small><b>{item.status}</b></span></div><div className="mobile-sheet-section"><h3>待办事项</h3><p>{item.todo || "暂无事项"}</p></div><div className="mobile-sheet-actions"><button type="button" onClick={() => openFocusEditor(item)}>编辑重点</button><button type="button" onClick={() => deleteFocusMobile(item.id)}>删除重点</button></div></> })}><b>{item.date} · {item.focus}</b><span>{item.status} · {item.todo || "暂无事项"}</span></button>)}{!filteredFocuses.length && <article><b>暂无每日重点</b><span>可以新增晨会、作业闭环、家校沟通等重点事项。</span></article>}</section>
      {detail && <MobileInfoSheet title={detail.title} onClose={() => setDetail(null)}>{detail.children}</MobileInfoSheet>}
      {scheduleEditorOpen && <MobileInfoSheet title={scheduleDraft.id ? "编辑日程" : "新增日程"} onClose={() => void closeMobileScheduleEditor("event")}>
        <div className="mobile-form-grid">
          <label><span>日期</span><input type="date" value={scheduleDraft.date} onChange={(event) => setScheduleDraft({ ...scheduleDraft, date: event.target.value })} /></label>
          <label><span>类型</span><select value={scheduleDraft.type} onChange={(event) => setScheduleDraft({ ...scheduleDraft, type: event.target.value as ScheduleEvent["type"] })}><option>班会</option><option>活动</option><option>考试</option><option>放假</option><option>家校</option><option>其他</option></select></label>
          <label className="wide"><span>标题</span><input value={scheduleDraft.title} onChange={(event) => setScheduleDraft({ ...scheduleDraft, title: event.target.value })} /></label>
          <label className="wide"><span>说明</span><textarea value={scheduleDraft.detail} onChange={(event) => setScheduleDraft({ ...scheduleDraft, detail: event.target.value })} /></label>
        </div>
        {scheduleEditorMessage && <p className="mobile-form-message" role="status">{scheduleEditorMessage}</p>}
        <div className="mobile-sheet-actions"><button type="button" onClick={() => void closeMobileScheduleEditor("event")}>关闭</button><button type="button" className="primary" onClick={saveScheduleEventMobile}>保存日程</button></div>
      </MobileInfoSheet>}
      {focusEditorOpen && <MobileInfoSheet title={focusDraft.id ? "编辑每日重点" : "新增每日重点"} onClose={() => void closeMobileScheduleEditor("focus")}>
        <div className="mobile-form-grid">
          <label><span>日期</span><input type="date" value={focusDraft.date} onChange={(event) => setFocusDraft({ ...focusDraft, date: event.target.value })} /></label>
          <label><span>状态</span><select value={focusDraft.status} onChange={(event) => setFocusDraft({ ...focusDraft, status: event.target.value as DailyFocus["status"] })}><option>待处理</option><option>进行中</option><option>已完成</option></select></label>
          <label className="wide"><span>重点主题</span><input value={focusDraft.focus} onChange={(event) => setFocusDraft({ ...focusDraft, focus: event.target.value })} /></label>
          <label className="wide"><span>具体事项</span><textarea value={focusDraft.todo} onChange={(event) => setFocusDraft({ ...focusDraft, todo: event.target.value })} /></label>
        </div>
        {scheduleEditorMessage && <p className="mobile-form-message" role="status">{scheduleEditorMessage}</p>}
        <div className="mobile-sheet-actions"><button type="button" onClick={() => void closeMobileScheduleEditor("focus")}>关闭</button><button type="button" className="primary" onClick={saveFocusMobile}>保存重点</button></div>
      </MobileInfoSheet>}
      {courseEditorOpen && <MobileInfoSheet title={`${scheduleContext.config.days[courseDraft.dayIndex] ?? "课程"} · 编辑当天课程`} onClose={() => void closeMobileScheduleEditor("course")}>
        <div className="mobile-form-grid">
          {scheduleContext.config.periods.map((period, index) => <label key={`${period.label}-${index}`}><span>{period.label}{period.time ? ` · ${period.time}` : ""}</span><input value={courseDraft.courses[index] ?? ""} onChange={(event) => setCourseDraft((current) => ({ ...current, courses: scheduleContext.config.periods.map((_, itemIndex) => itemIndex === index ? event.target.value : current.courses[itemIndex] ?? "") }))} placeholder="填写课程" /></label>)}
        </div>
        {scheduleEditorMessage && <p className="mobile-form-message" role="status">{scheduleEditorMessage}</p>}
        <div className="mobile-sheet-actions"><button type="button" onClick={() => void closeMobileScheduleEditor("course")}>关闭</button><button type="button" className="primary" onClick={saveCourseDayMobile}>保存课程</button></div>
      </MobileInfoSheet>}
      {scheduleConfigOpen && <MobileInfoSheet title="学期、上课日与节次" onClose={() => void closeMobileScheduleEditor("config")}>
        <div className="mobile-form-grid">
          <label><span>档案名称</span><input value={scheduleConfigDraft.schoolYear} onChange={(event) => setScheduleConfigDraft({ ...scheduleConfigDraft, schoolYear: event.target.value })} /></label>
          <label><span>学期名称</span><input value={scheduleConfigDraft.term} onChange={(event) => setScheduleConfigDraft({ ...scheduleConfigDraft, term: event.target.value })} /></label>
          <label><span>起始月份</span><input type="month" value={scheduleConfigDraft.termStartMonth ?? ""} onChange={(event) => setScheduleConfigDraft({ ...scheduleConfigDraft, termStartMonth: event.target.value })} /></label>
          <label><span>结束月份</span><input type="month" value={scheduleConfigDraft.termEndMonth ?? ""} onChange={(event) => setScheduleConfigDraft({ ...scheduleConfigDraft, termEndMonth: event.target.value })} /></label>
          <label className="wide"><span>说明</span><input value={scheduleConfigDraft.termNote ?? ""} onChange={(event) => setScheduleConfigDraft({ ...scheduleConfigDraft, termNote: event.target.value })} /></label>
        </div>
        <section className="mobile-card-list in-sheet-list"><header><h2>上课日</h2><button type="button" onClick={() => setScheduleConfigDraft((current) => ({ ...current, days: [...current.days, `第${current.days.length + 1}天`] }))}>新增</button></header>{scheduleConfigDraft.days.map((day, index) => <article key={`${day}-${index}`}><label><span>名称</span><input value={day} onChange={(event) => setScheduleConfigDraft((current) => ({ ...current, days: current.days.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} /></label><button type="button" onClick={() => setScheduleConfigDraft((current) => ({ ...current, days: current.days.filter((_, itemIndex) => itemIndex !== index) }))}>删除</button></article>)}</section>
        <section className="mobile-card-list in-sheet-list"><header><h2>节次</h2><button type="button" onClick={() => setScheduleConfigDraft((current) => ({ ...current, periods: [...current.periods, { label: `第${current.periods.length + 1}节`, time: "" }] }))}>新增</button></header>{scheduleConfigDraft.periods.map((period, index) => <article key={`${period.label}-${index}`}><label><span>节次</span><input value={period.label} onChange={(event) => setScheduleConfigDraft((current) => ({ ...current, periods: current.periods.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} /></label><label><span>时间</span><input value={period.time ?? ""} onChange={(event) => setScheduleConfigDraft((current) => ({ ...current, periods: current.periods.map((item, itemIndex) => itemIndex === index ? { ...item, time: event.target.value } : item) }))} /></label><button type="button" onClick={() => setScheduleConfigDraft((current) => ({ ...current, periods: current.periods.filter((_, itemIndex) => itemIndex !== index) }))}>删除</button></article>)}</section>
        {scheduleEditorMessage && <p className="mobile-form-message" role="status">{scheduleEditorMessage}</p>}
        <div className="mobile-sheet-actions"><button type="button" onClick={() => void closeMobileScheduleEditor("config")}>关闭</button><button type="button" className="primary" onClick={saveScheduleConfigMobile}>保存配置</button></div>
      </MobileInfoSheet>}
    </div>;
  }

  if (active === "seating") {
    const config = sanitizeSeatingConfig(data.seatingConfig, students.length);
    const capacity = config.rows * config.columns;
    const studentBySeat = new Map(students.map((student) => [student.seat, student]));
    const seatGroupSummaries = Array.from({ length: config.groupCount }, (_, index) => {
      const number = index + 1;
      return { number, students: students.filter((student) => student.group === number).sort((a, b) => a.seat - b.seat) };
    });
    const seatStudent = students.find((student) => student.id === seatStudentId);
    return <div className="mobile-stack mobile-seating-page">
      <MobileSectionHero title={title} text={`${config.rows}×${config.columns} 座位 · ${students.length}/${capacity} 已入座`} action="配置" onAction={() => openSeatingConfigMobile(config)} />
      <section className="mobile-seat-quick-stats mobile-insight-rail" aria-label="座位分组概览"><span><small>入座</small><b>{students.length}/{capacity}</b></span><span><small>小组</small><b>{config.groupCount}</b></span><span><small>特殊</small><b>{students.filter((student) => student.seatFixed || (student.seatNeed && student.seatNeed !== "无")).length}</b></span></section>
      <section className="mobile-card-list">
        <header><h2>座位图</h2></header>
        <div className="mobile-seat-actions">
          <button type="button" onClick={() => smartArrangeMobileSeats(config)}>智能排座</button>
          <button type="button" onClick={() => rotateMobileSeats(config)}>前后轮换</button>
        </div>
        <details className="mobile-seat-more-actions"><summary>更多排座操作</summary><div><button type="button" onClick={() => regroupMobileSeats(config)}>按座位更新分组</button>{seatLastStudents && <button type="button" onClick={undoMobileSeat}>撤销上次调整</button>}</div></details>
        {seatMessage && <button type="button" className="mobile-seat-hint" onClick={() => setSeatMessage("")}>{seatMessage}</button>}
        <div className="mobile-seat-board-wrap">
          <div className="mobile-seat-board">
            <div className="mobile-seat-front"><span>黑板</span><b>讲台</b><span>门</span></div>
            <div className="mobile-seat-grid" style={{ gridTemplateColumns: `repeat(${config.columns}, minmax(88px, 1fr))` }}>
              {Array.from({ length: capacity }, (_, index) => {
                const seat = index + 1;
                const student = studentBySeat.get(seat);
                const column = (seat - 1) % config.columns + 1;
                const aisleEdge = config.aisleAfter.includes(column);
                const seatStyle = { "--mobile-seat-bg": seatGroupFor(seat, config) % 2 ? "var(--campus-blue)" : "var(--campus-green)" } as CSSProperties;
                return <button type="button" aria-label={`座位${seat} ${student?.name ?? "空座"}`} key={seat} className={`mobile-seat-slot ${student ? "occupied" : "empty"} ${student && seatSelectedId === student.id ? "selected" : ""} ${student?.seatFixed ? "fixed" : ""} ${aisleEdge ? "aisle-edge" : ""}`} style={seatStyle} onClick={() => seatSelectedId ? chooseMobileSeat(seat, student, config) : student ? setSeatStudentId(student.id) : setSeatPickerSeat(seat)}>
                  <small>{seat}</small>
                  {student ? <><i>{student.name.slice(0, 1)}</i><b>{student.name}</b><em>{student.groupLeader ? "组长" : `第${student.group}组`}</em><strong>{student.seatFixed ? "固定" : student.seatNeed && student.seatNeed !== "无" ? student.seatNeed : "可调"}</strong></> : <><i>空</i><b>空座</b><em>可移动</em></>}
                </button>;
              })}
            </div>
            <div className="mobile-seat-back"><span>后门</span><b>教室后方</b><span>卫生角</span></div>
          </div>
        </div>
      </section>
      <section className="mobile-card-list"><header><h2>当前小组</h2></header>{seatGroupSummaries.map((group) => <button type="button" key={group.number} onClick={() => setDetail({ title: `第${group.number}组`, children: <div className="mobile-card-list in-sheet-list">{group.students.map((student) => <article key={student.id}><b>{student.name}{student.groupLeader ? " · 组长" : ""}</b><span>座位 {student.seat} · 学号 {student.studentNo || "未填"} · {student.seatNeed ?? "无"}</span></article>)}{!group.students.length && <article><b>暂无学生</b><span>更新分组后会按座位重新归入小组。</span></article>}</div> })}><b>第{group.number}组 · {group.students.length}人</b><span>{group.students.map((student) => `${student.name}${student.groupLeader ? "（组长）" : ""}`).join("、") || "暂无学生"}</span></button>)}</section>
      {detail && <MobileInfoSheet title={detail.title} onClose={() => setDetail(null)}>{detail.children}</MobileInfoSheet>}
      {seatStudent && <MobileInfoSheet title={`编辑座位 · ${seatStudent.name}`} onClose={() => setSeatStudentId("")}>
        <div className="mobile-form-grid">
          <label><span>座位号</span><input type="number" value={seatStudent.seat} onChange={(event) => patchSeatStudent(seatStudent.id, { seat: Number(event.target.value) || seatStudent.seat })} /></label>
          <label><span>小组</span><input type="number" value={seatStudent.group} onChange={(event) => patchSeatStudent(seatStudent.id, { group: Number(event.target.value) || seatStudent.group })} /></label>
          <label><span>座位需求</span><select value={seatStudent.seatNeed ?? "无"} onChange={(event) => patchSeatStudent(seatStudent.id, { seatNeed: event.target.value as Student["seatNeed"] })}><option>无</option><option>前排</option><option>后排</option><option>靠窗</option><option>靠过道</option></select></label>
          <label><span>固定座位</span><select value={seatStudent.seatFixed ? "固定" : "可调"} onChange={(event) => patchSeatStudent(seatStudent.id, { seatFixed: event.target.value === "固定" })}><option>可调</option><option>固定</option></select></label>
          <label><span>组长</span><select value={seatStudent.groupLeader ? "是" : "否"} onChange={(event) => patchSeatStudent(seatStudent.id, { groupLeader: event.target.value === "是" })}><option>否</option><option>是</option></select></label>
          <label><span>身高</span><input type="number" value={seatStudent.height ?? ""} onChange={(event) => patchSeatStudent(seatStudent.id, { height: Number(event.target.value) || undefined })} /></label>
          <label className="wide"><span>不能同桌</span><button type="button" className="mobile-picker-trigger" onClick={() => setSeatAvoidPickerId(seatStudent.id)}>{students.find((student) => student.id === seatStudent.avoidWith)?.name ?? "无避让对象"}</button></label>
        </div>
        <div className="mobile-sheet-actions"><button type="button" onClick={() => setSeatPickerSeat(seatStudent.seat)}>更换此座学生</button><button type="button" onClick={() => { setSeatSelectedId(seatStudent.id); setSeatStudentId(""); setSeatMessage(`已选择 ${seatStudent.name}，再点目标座位`); }}>选中移动</button></div>
        <div className="mobile-sheet-actions"><button type="button" onClick={() => setMobileGroupLeader(seatStudent)}>设为本组组长</button><button type="button" className="primary" onClick={() => setSeatStudentId("")}>完成</button></div>
      </MobileInfoSheet>}
      {seatPickerSeat && <StudentLookupDialog
        title={`选择座位 ${seatPickerSeat} 的学生`}
        subtitle={studentBySeat.get(seatPickerSeat) ? `当前：${studentBySeat.get(seatPickerSeat)?.name}。选择其他学生后会自动互换座位。` : "当前为空座。选择学生后会移动到这个座位。"}
        students={students}
        selectedId={studentBySeat.get(seatPickerSeat)?.id}
        onPick={(student) => assignMobileStudentToSeat(student.id, seatPickerSeat, config)}
        onClose={() => setSeatPickerSeat(null)}
      />}
      {seatAvoidPickerId && <StudentLookupDialog title="选择不能同桌对象" subtitle={`${studentName(seatAvoidPickerId)} 的避让对象。`} students={students.filter((student) => student.id !== seatAvoidPickerId)} selectedId={students.find((student) => student.id === seatAvoidPickerId)?.avoidWith} allowClear clearLabel="清空避让" onPick={(student) => { patchSeatStudent(seatAvoidPickerId, { avoidWith: student.id }); setSeatAvoidPickerId(""); }} onClear={() => patchSeatStudent(seatAvoidPickerId, { avoidWith: "" })} onClose={() => setSeatAvoidPickerId("")} />}
      {seatingEditorOpen && <MobileInfoSheet title="座位配置" onClose={() => setSeatingEditorOpen(false)}>
        <div className="mobile-form-grid">
          <label><span>行数</span><input type="number" inputMode="numeric" min={1} max={12} value={seatingDraft.rows} onChange={(event) => setSeatingDraft({ ...seatingDraft, rows: event.target.value })} placeholder="例如 6" /></label>
          <label><span>列数</span><input type="number" inputMode="numeric" min={2} max={10} value={seatingDraft.columns} onChange={(event) => setSeatingDraft({ ...seatingDraft, columns: event.target.value })} placeholder="例如 6" /></label>
          <label><span>小组数</span><input type="number" inputMode="numeric" min={1} max={12} value={seatingDraft.groupCount} onChange={(event) => setSeatingDraft({ ...seatingDraft, groupCount: event.target.value })} placeholder="例如 8" /></label>
          <label><span>过道列后</span><input value={seatingDraft.aisleAfter} onChange={(event) => setSeatingDraft({ ...seatingDraft, aisleAfter: event.target.value })} placeholder="2，4" /></label>
        </div>
        <div className="mobile-sheet-actions"><button type="button" onClick={() => setSeatingEditorOpen(false)}>取消</button><button type="button" className="primary" onClick={saveSeatingConfigMobile}>保存配置</button></div>
      </MobileInfoSheet>}
    </div>;
  }

  if (active === "rules") {
    const ruleSource = pointRulesForData(data);
    const enabled = ruleSource.filter((rule) => rule.enabled !== false);
    const ruleCategories = ["全部", ...Array.from(new Set(ruleSource.map((rule) => rule.scene)))];
    const visibleRules = ruleSource.filter((rule) => {
      const text = `${rule.scene}${rule.title}${rule.reason}${rule.owner}${rule.delta}`;
      const status = rule.enabled === false ? "停用" : "启用";
      return (ruleCategory === "全部" || rule.scene === ruleCategory) && (ruleStatusFilter === "全部状态" || ruleStatusFilter === status) && (!ruleKeyword.trim() || text.includes(ruleKeyword.trim()));
    });
    return <div className="mobile-stack mobile-rules-page">
      <MobileSectionHero title={title} text={`${ruleSource.length} 条规则 · 启用 ${enabled.length} · 停用 ${ruleSource.length - enabled.length}`} action="新增" onAction={() => openRuleEditor()} />
      <section className="mobile-overview-stats compact mobile-insight-rail" aria-label="积分规则概览"><span><small>规则</small><b>{ruleSource.length}</b></span><span><small>启用</small><b>{enabled.length}</b></span><span><small>停用</small><b>{ruleSource.length - enabled.length}</b></span></section>
      <label className="mobile-search"><span>搜索规则</span><input value={ruleKeyword} onChange={(event) => setRuleKeyword(event.target.value)} placeholder="分类、规则、理由、执行人或分值" /></label>
      <section className="mobile-filter-pair">
        <label className="mobile-select-field mobile-rule-category-select"><span>规则分类</span><select value={ruleCategory} onChange={(event) => setRuleCategory(event.target.value)}>{ruleCategories.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        <label className="mobile-select-field"><span>状态</span><select value={ruleStatusFilter} onChange={(event) => setRuleStatusFilter(event.target.value as typeof ruleStatusFilter)}><option>全部状态</option><option>启用</option><option>停用</option></select></label>
      </section>
      <section className="mobile-card-list"><header><h2>规则列表</h2><span>{visibleRules.length} 条</span></header>{visibleRules.map((rule) => <button type="button" key={rule.id} onClick={() => setDetail({ title: rule.title, children: <><div className="mobile-detail-grid"><span><small>场景</small><b>{rule.scene}</b></span><span><small>分值</small><b>{rule.delta > 0 ? "+" : ""}{rule.delta}</b></span><span><small>状态</small><b>{rule.enabled !== false ? "启用" : "停用"}</b></span><span><small>使用</small><b>{pointRuleUsageCount(events, rule)}</b></span></div><div className="mobile-sheet-section"><h3>理由</h3><p>{rule.reason}</p></div><div className="mobile-sheet-section"><h3>执行人</h3><p>{rule.owner}</p></div><div className="mobile-sheet-section"><h3>说明</h3><p>{rule.detail || "暂无说明"}</p></div><div className="mobile-sheet-actions"><button type="button" onClick={() => openRuleEditor(rule)}>编辑规则</button><button type="button" onClick={() => toggleRuleEnabled(rule)}>{rule.enabled !== false ? "停用规则" : "启用规则"}</button></div><div className="mobile-sheet-actions"><button type="button" onClick={() => copyRuleMobile(rule)}>复制规则</button><button type="button" onClick={() => deleteRuleMobile(rule)}>删除规则</button></div></> })}><b>{rule.title} · {rule.delta > 0 ? "+" : ""}{rule.delta}分</b><span>{rule.enabled !== false ? "启用" : "停用"} · {rule.scene} · {rule.reason} · {rule.owner}</span></button>)}{!visibleRules.length && <article><b>暂无规则</b><span>可以调整搜索或新增积分规则。</span></article>}</section>
      {detail && <MobileInfoSheet title={detail.title} onClose={() => setDetail(null)}>{detail.children}</MobileInfoSheet>}
      {ruleEditorOpen && <MobileInfoSheet title={ruleDraft.id ? "编辑积分规则" : "新增积分规则"} onClose={() => setRuleEditorOpen(false)}>
        <div className="mobile-form-grid">
          <label><span>场景</span><input value={ruleDraft.scene} onChange={(event) => setRuleDraft({ ...ruleDraft, scene: event.target.value })} /></label>
          <label><span>名称</span><input value={ruleDraft.title} onChange={(event) => setRuleDraft({ ...ruleDraft, title: event.target.value })} /></label>
          <label><span>分值</span><input type="number" value={ruleDraft.delta} onChange={(event) => setRuleDraft({ ...ruleDraft, delta: Number(event.target.value) || 0 })} /></label>
          <label><span>执行人</span><input value={ruleDraft.owner} onChange={(event) => setRuleDraft({ ...ruleDraft, owner: event.target.value })} /></label>
          <label><span>版本</span><select value={ruleDraft.level} onChange={(event) => setRuleDraft({ ...ruleDraft, level: event.target.value as PointRule["level"] })}><option>小学版</option><option>初中版</option><option>温和版</option><option>严格版</option><option>自定义</option></select></label>
          <label><span>启用</span><select value={ruleDraft.enabled ? "启用" : "停用"} onChange={(event) => setRuleDraft({ ...ruleDraft, enabled: event.target.value === "启用" })}><option>启用</option><option>停用</option></select></label>
          <label className="wide"><span>理由</span><textarea value={ruleDraft.reason} onChange={(event) => setRuleDraft({ ...ruleDraft, reason: event.target.value })} /></label>
          <label className="wide"><span>说明</span><textarea value={ruleDraft.detail ?? ""} onChange={(event) => setRuleDraft({ ...ruleDraft, detail: event.target.value })} /></label>
        </div>
        <div className="mobile-sheet-actions"><button type="button" onClick={() => setRuleEditorOpen(false)}>取消</button><button type="button" className="primary" onClick={saveRuleDraft}>保存规则</button></div>
      </MobileInfoSheet>}
    </div>;
  }

  return <MobileMore current={active} open={open} />;
}

function MobileSectionHero({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return <section className="mobile-hero-card mobile-section-summary mobile-context-line" aria-label={`${title}状态`}><div><h2>{title}</h2><p>{text}</p></div>{action && onAction && <button type="button" onClick={onAction}>{action}</button>}</section>;
}


function MobileInfoSheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const titleId = useId();
  return <div className="mobile-sheet-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="mobile-bottom-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><h2 id={titleId}>{title}</h2></div><button type="button" onClick={onClose}>关闭</button></header>
      <div className="mobile-sheet-body">{children}</div>
    </section>
  </div>;
}

function AccountDialog({ account, onClose }: { account: { phone: string; expiresAt: string }; onClose: () => void }) {
  const titleId = useId();
  return <div className="account-dialog-backdrop" role="presentation" onMouseDown={onClose}><section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}><header><div><span>账户</span><h2 id={titleId}>我的工作台</h2></div><button type="button" onClick={onClose}>关闭</button></header><dl><div><dt>手机号</dt><dd>{account.phone}</dd></div><div><dt>使用期限</dt><dd>{account.expiresAt ? new Date(account.expiresAt).toLocaleDateString("zh-CN") : "—"}</dd></div></dl></section></div>;
}


function Students({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [bulk, setBulk] = useState("");
  const [filter, setFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("全部小组");
  const [message, setMessage] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchDraft, setBatchDraft] = useState<{ group: string; gender: Student["gender"] | "不修改"; note: string }>({ group: "", gender: "不修改", note: "" });
  const [profileStudentId, setProfileStudentId] = useState("");
  const [focusedStudentId, setFocusedStudentId] = useState("");
  const [newStudentDraft, setNewStudentDraft] = useState<Student | null>(null);
  const classes = data.rosterClasses?.length ? data.rosterClasses : [{ id: "class-1", name: "当前班级", grade: "", term: "", students: data.students }];
  const activeClassId = data.activeClassId ?? classes[0].id;
  const activeClass = classes.find((item) => item.id === activeClassId) ?? classes[0];
  const classStudents = activeClass.students;
  const keyword = filter.trim().toLocaleLowerCase("zh-CN");
  const groupOptions = Array.from(new Set(classStudents.map((s) => s.group))).sort((a, b) => a - b);
  const shown = classStudents.filter((s) => {
    const groupOk = groupFilter === "全部小组" || s.group === Number(groupFilter);
    const text = `${s.name}${s.studentNo}${s.parentPhone}${s.note}${s.group}${s.seat}`.toLocaleLowerCase("zh-CN");
    return groupOk && (!keyword || text.includes(keyword));
  });
  const withPhone = classStudents.filter((s) => s.parentPhone?.trim()).length;
  const boys = classStudents.filter((s) => s.gender === "男").length;
  const girls = classStudents.filter((s) => s.gender === "女").length;
  const phoneRate = classStudents.length ? Math.round((withPhone / classStudents.length) * 100) : 0;
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = shown.slice((safePage - 1) * pageSize, safePage * pageSize);
  const shownIds = shown.map((student) => student.id);
  const selectedCount = selectedIds.length;
  const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selectedIds.includes(id));
  const focusedStudent = classStudents.find((student) => student.id === focusedStudentId) ?? pageItems[0] ?? classStudents[0];
  const focusedHomework = focusedStudent ? (data.homeworkTasks ?? []).filter((task) => (!task.classId || task.classId === activeClassId) && task.statuses[focusedStudent.id]).toSorted((a, b) => b.date.localeCompare(a.date)).slice(0, 3) : [];
  const focusedAttendance = focusedStudent ? (data.attendanceRecords ?? []).filter((record) => record.studentId === focusedStudent.id && (!record.classId || record.classId === activeClassId)).toSorted((a, b) => b.date.localeCompare(a.date)).slice(0, 3) : [];
  const focusedRecords = focusedStudent ? data.records.filter((record) => recordBelongsToStudent(record, focusedStudent, activeClassId)).toSorted((a, b) => b.date.localeCompare(a.date)).slice(0, 3) : [];
  const focusedDictation = focusedStudent ? (data.dictation?.tasks ?? []).filter((task) => task.context.kind === 'class' && task.context.classId === activeClassId && task.participants.some(person => person.id === focusedStudent.id)).toSorted((a, b) => b.date.localeCompare(a.date))[0] : undefined;

  useEffect(() => setPage(1), [filter, groupFilter, activeClassId, pageSize]);
  useEffect(() => {
    const ids = new Set(classStudents.map((student) => student.id));
    setSelectedIds((current) => current.filter((id) => ids.has(id)));
  }, [classStudents]);
  useEffect(() => {
    if (!classStudents.some((student) => student.id === focusedStudentId)) setFocusedStudentId(classStudents[0]?.id ?? "");
  }, [activeClassId, classStudents, focusedStudentId]);

  function syncActiveClass(current: ClassroomData, nextStudents: Student[], patch?: Partial<RosterClass>): ClassroomData {
    const currentClasses = current.rosterClasses?.length ? current.rosterClasses : classes;
    const rosterClasses = currentClasses.map((item) => item.id === activeClassId ? { ...item, ...patch, students: nextStudents } : item);
    return { ...current, rosterClasses, activeClassId, students: nextStudents };
  }

  function makeStudent(row: string, index: number, baseIndex: number): Student {
    const parts = row.split(/[\s,，、\t]+/).filter(Boolean);
    const name = parts[0] ?? `学生${baseIndex + index + 1}`;
    return {
      id: `s${Date.now()}-${baseIndex}-${index}`,
      studentNo: `${baseIndex + index + 1}`.padStart(2, "0"),
      name,
      gender: index % 2 === 0 ? "女" : "男",
      group: Math.floor((baseIndex + index) / 4) + 1,
      seat: baseIndex + index + 1,
      points: 60,
      homework: "已交",
      attendance: "正常",
      score: 85,
      parentPhone: parts.find((part) => /^1\d{10}$/.test(part)) ?? "",
      note: parts.filter((part, partIndex) => partIndex > 0 && !/^1\d{10}$/.test(part)).join(" "),
    };
  }

  function edit(id: string, patch: Partial<Student>) {
    update((d) => syncActiveClass(d, classStudents.map((s) => s.id === id ? { ...s, ...patch } : s)));
  }
  function toggleStudentSelect(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function toggleShownSelect() {
    if (allShownSelected) {
      setSelectedIds((current) => current.filter((id) => !shownIds.includes(id)));
      return;
    }
    setSelectedIds((current) => Array.from(new Set([...current, ...shownIds])));
  }
  function applyBatchEdit() {
    if (!selectedIds.length) return setMessage("请先勾选要批量编辑的学生。");
    update((d) => syncActiveClass(d, applyStudentBatch(classStudents, selectedIds, batchDraft)));
    setMessage(`已批量更新 ${selectedIds.length} 名学生的小组、性别或备注。`);
    setBatchDraft({ group: "", gender: "不修改", note: "" });
  }
  function rowsFromBulk() {
    const rows = bulk.split(/\n+/).map((row) => row.trim()).filter(Boolean);
    return rows;
  }
  async function replaceNames() {
    const rows = rowsFromBulk();
    if (!rows.length) return setMessage("请先粘贴学生姓名。");
    const confirmed = await requestDangerConfirm(
      `将替换 ${classStudents.length} 名现有学生，并清理他们在当前班级的成绩、作业、积分、沟通、成长、评语和任职记录。其他班级不会受影响。`,
      "替换当前班级名单",
      "确认替换",
    );
    if (!confirmed) return;
    const students = rows.map((row, index) => makeStudent(row, index, 0));
    update((d) => {
      const cleaned = removeStudentRelations(d, classStudents.map((student) => student.id), activeClassId);
      const synced = syncActiveClass(cleaned, students);
      return {
        ...synced,
        homeworkTasks: synced.homeworkTasks?.map((task) => task.classId === activeClassId ? { ...task, statuses: Object.fromEntries(students.map((student) => [student.id, "已交"])) } : task),
      };
    });
    setMessage(`已导入 ${students.length} 名学生，并重新生成学号、座位和小组。`);
  }
  function appendNames() {
    const rows = rowsFromBulk();
    if (!rows.length) return setMessage("请先粘贴学生姓名。");
    update((d) => {
      const added = rows.map((row, index) => makeStudent(row, index, classStudents.length));
      const nextStudents = [...classStudents, ...added];
      return {
        ...syncActiveClass(d, nextStudents),
        homeworkTasks: d.homeworkTasks?.map((task) => task.classId === activeClassId ? { ...task, statuses: { ...task.statuses, ...Object.fromEntries(added.map((student) => [student.id, "已交"])) } } : task),
      };
    });
    setMessage(`已追加 ${rows.length} 名学生。`);
  }
  function addStudent() {
    const draft = makeStudent("", 0, classStudents.length);
    setNewStudentDraft({ ...draft, name: "", studentNo: `${classStudents.length + 1}`.padStart(2, "0"), note: "", parentPhone: "" });
  }
  function saveNewStudent() {
    if (!newStudentDraft || !newStudentDraft.name.trim()) {
      setMessage("请先填写学生姓名。");
      return;
    }
    const phone = (newStudentDraft.parentPhone ?? "").replace(/[\s-]/g, "");
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      setMessage("家长电话需要填写11位手机号，或留空。");
      return;
    }
    const nextStudent = { ...newStudentDraft, name: newStudentDraft.name.trim(), parentPhone: phone, studentNo: newStudentDraft.studentNo?.trim() || `${classStudents.length + 1}`.padStart(2, "0"), group: Math.max(1, Number(newStudentDraft.group) || 1), seat: Math.max(1, Number(newStudentDraft.seat) || classStudents.length + 1) };
    update((d) => syncActiveClass(d, [...classStudents, nextStudent]));
    setNewStudentDraft(null);
    setMessage("学生已新增。");
  }
  async function removeStudent(id: string) {
    const target = classStudents.find((student) => student.id === id);
    if (target && !await requestDangerConfirm(`${target.name} 的作业状态、积分记录和班干部岗位会同步清理。`)) return;
    update((d) => syncActiveClass(
      removeStudentRelations(d, [id], activeClassId),
      classStudents.filter((s) => s.id !== id).map((s, index) => ({ ...s, seat: index + 1, group: Math.floor(index / 4) + 1 })),
    ));
    setMessage("已删除学生，并重新整理座位和小组。");
  }
  function exportRoster() {
    const header = ["学号", "姓名", "性别", "小组", "座位", "家长电话", "备注"];
    const rows = classStudents.map((student) => [
      student.studentNo ?? "",
      student.name,
      student.gender,
      `第${student.group}组`,
      `${student.seat}`,
      student.parentPhone ?? "",
      student.note ?? "",
    ]);
    const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeClass.name || "学生名单"}-${today()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage(`已导出 ${activeClass.name} 的学生名单。`);
  }
  return <section className="roster-page roster-pro-page campus-student-page">
    <WorkbenchPageHeader
      icon="students"
      tone="lake"
      title={`${activeClass.name}学生名单`}
      description={`${activeClass.grade || "当前年级"} · ${activeClass.term || "当前学期"} · 维护姓名、学号、小组、性别和家长电话。`}
      actions={<div className="roster-page-actions">
        <details className="roster-more-actions"><summary>更多</summary><button className="roster-secondary-action" onClick={exportRoster}>导出名单</button></details>
        <button className="roster-primary-action workbench-header-primary" onClick={addStudent}>新增学生</button>
      </div>}
    />
    <div className="campus-student-summary"><MetricStrip items={[{label:"总人数",value:classStudents.length,detail:"当前班级"},{label:"男生",value:boys,detail:"名单统计"},{label:"女生",value:girls,detail:"名单统计"},{label:"电话完整度",value:`${phoneRate}%`,detail:`${withPhone}人已填写`}]}/></div>
    <section className="campus-student-workspace">
      <div className="campus-student-master"><section className="roster-tools-panel">
      <div className="roster-command-bar">
        <label className="roster-search-field"><span>搜索</span><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="姓名、学号、电话或备注" /></label>
        <label className="roster-group-filter"><span>小组</span><select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}><option>全部小组</option>{groupOptions.map((group) => <option key={group} value={group}>第{group}组</option>)}</select></label>
        <label className="roster-page-size"><span>每页</span><select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}><option value={10}>10 人</option><option value={20}>20 人</option><option value={50}>50 人</option></select></label>
        <button className={`roster-edit-toggle ${editMode ? "active" : ""}`} aria-pressed={editMode} onClick={() => setEditMode((value) => !value)}>{editMode ? "退出编辑" : "编辑资料"}</button>
      </div>
      {selectedCount > 0 && <div className="roster-batch-editor active">
        <div><span>批量编辑</span><strong>已选 {selectedCount} 人</strong></div>
        <button className="roster-secondary-action" disabled={!shownIds.length} onClick={toggleShownSelect}>{allShownSelected ? "取消当前筛选" : "全选当前筛选"}</button>
        <label><span>小组</span><input type="number" value={batchDraft.group} onChange={(e) => setBatchDraft({ ...batchDraft, group: e.target.value })} placeholder="不修改" /></label>
        <label><span>性别</span><select value={batchDraft.gender} onChange={(e) => setBatchDraft({ ...batchDraft, gender: e.target.value as Student["gender"] | "不修改" })}><option>不修改</option><option>女</option><option>男</option></select></label>
        <label className="batch-note"><span>备注</span><input value={batchDraft.note} onChange={(e) => setBatchDraft({ ...batchDraft, note: e.target.value })} placeholder="留空不修改，填写后覆盖备注" /></label>
        <button className="roster-primary-action" disabled={!selectedCount} onClick={applyBatchEdit}>应用</button>
      </div>}
      </section>
      <details className="roster-import-drawer">
      <summary><span>批量导入名单</span><b>展开</b></summary>
      <div className="roster-import-body">
        <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"张三 13800000001 备注\n李四 13800000002"} />
        <div className="roster-import-actions"><button className="roster-danger-text" onClick={replaceNames}>替换当前名单</button><button className="roster-secondary-action" onClick={appendNames}>追加学生</button></div>
      </div>
      </details>
      {message && <div className="inline-alert roster-message" onClick={() => setMessage("")}>{message}<span>×</span></div>}
      <section className="roster-directory">
      <header className="roster-directory-head">
        <div><span>当前名单</span></div>
        <small>显示 {pageItems.length} / {shown.length} 人</small>
      </header>
      <div className="roster-table-scroll">
        <table className="roster-data-table">
          <colgroup><col className="col-select" /><col className="col-no" /><col className="col-name" /><col className="col-gender" /><col className="col-group" /><col className="col-phone" /><col className="col-note" /><col className="col-action" /></colgroup>
          <thead><tr><th><input aria-label="选择当前筛选学生" type="checkbox" checked={allShownSelected} onChange={toggleShownSelect} /></th><th>学号</th><th>姓名</th><th>性别</th><th>小组</th><th>家长电话</th><th>备注</th><th>操作</th></tr></thead>
          <tbody>
            {pageItems.map((s) => <tr key={s.id} className={focusedStudent?.id === s.id ? 'is-focused' : ''} onClick={() => setFocusedStudentId(s.id)}>
              <td className="roster-select-cell"><input aria-label={`选择${s.name}`} type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleStudentSelect(s.id)} /></td>
              <td>{editMode ? <input aria-label={`${s.name}学号`} value={s.studentNo ?? ""} onChange={(e) => edit(s.id, { studentNo: e.target.value })} /> : <span className="roster-student-no">{s.studentNo || "-"}</span>}</td>
              <td><strong className="roster-student-name">{editMode ? <input aria-label={`${s.name}姓名`} value={s.name} onChange={(e) => edit(s.id, { name: e.target.value })} /> : s.name}</strong></td>
              <td>{editMode ? <select aria-label={`${s.name}性别`} value={s.gender} onChange={(e) => edit(s.id, { gender: e.target.value as Student["gender"] })}><option>女</option><option>男</option></select> : s.gender}</td>
              <td>{editMode ? <input aria-label={`${s.name}小组`} type="number" value={s.group} onChange={(e) => edit(s.id, { group: Number(e.target.value) || 1 })} /> : `第${s.group}组`}</td>
              <td>{editMode ? <input aria-label={`${s.name}家长电话`} value={s.parentPhone ?? ""} onChange={(e) => edit(s.id, { parentPhone: e.target.value })} /> : <span className="roster-muted-value">{s.parentPhone || "未填写"}</span>}</td>
              <td>{editMode ? <input aria-label={`${s.name}备注`} value={s.note ?? ""} onChange={(e) => edit(s.id, { note: e.target.value })} /> : <span className="roster-muted-value">{s.note || "-"}</span>}</td>
              <td><button className="roster-secondary-action" onClick={(event) => { event.stopPropagation(); setFocusedStudentId(s.id); }}>查看</button><button className="roster-delete-action" disabled={!editMode} onClick={(event) => { event.stopPropagation(); void removeStudent(s.id); }}>删除</button></td>
            </tr>)}
            {!pageItems.length && <tr><td className="roster-empty-row" colSpan={8}><b>当前没有学生</b><span>先展开批量导入，或切换到其他班级。</span></td></tr>}
          </tbody>
        </table>
      </div>
      <footer className="roster-pagination">
      <button disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button>
      <span>第 {safePage} / {totalPages} 页，显示 {pageItems.length} / {shown.length} 人</span>
      <button disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</button>
      </footer>
      </section></div>
      <aside className="campus-student-detail" aria-live="polite">{focusedStudent ? <>
        <div className="campus-student-detail-hero"><ThemeArtwork slot="roster"/><span>{focusedStudent.name.slice(-2)}</span></div>
        <header><div><h2>{focusedStudent.name}</h2><p>学号 {focusedStudent.studentNo || '未填'} · 第{focusedStudent.group}组 · {focusedStudent.seat}号座位</p></div><button type="button" onClick={() => setProfileStudentId(focusedStudent.id)}>完整档案</button></header>
        <dl className="campus-student-facts"><div><dt>积分</dt><dd>{focusedStudent.points}</dd></div><div><dt>近期成绩</dt><dd>{focusedStudent.score}</dd></div><div><dt>考勤</dt><dd>{focusedStudent.attendance}</dd></div><div><dt>作业</dt><dd>{focusedStudent.homework}</dd></div></dl>
        <section><h3>最近动态</h3><ol>
          {focusedDictation && <li><span><CampusIcon name="dictation"/></span><div><b>{focusedDictation.date} · {focusedDictation.title}</b><p>{!focusedDictation.results[focusedStudent.id] ? '待批改' : focusedDictation.results[focusedStudent.id][0] === 'graded' ? `${focusedDictation.results[focusedStudent.id][1].length} 个错词` : focusedDictation.results[focusedStudent.id][0] === 'leave' ? '请假，不计入错误率' : '未参加，不计入错误率'}</p></div></li>}
          {focusedHomework.map(task => <li key={task.id}><span><CampusIcon name="homework"/></span><div><b>{task.date} · {task.title}</b><p>{task.statuses[focusedStudent.id]}</p></div></li>)}
          {focusedAttendance.map(record => <li key={record.id}><span><CampusIcon name="attendance"/></span><div><b>{record.date} · {record.status}</b><p>{record.reason || record.note || record.period}</p></div></li>)}
          {focusedRecords.map(record => <li key={record.id}><span><CampusIcon name="records"/></span><div><b>{record.date} · {record.type}</b><p>{record.status || '已记录'}</p></div></li>)}
          {!focusedDictation && !focusedHomework.length && !focusedAttendance.length && !focusedRecords.length && <li className="is-empty"><span><CampusIcon name="growth"/></span><div><b>暂无近期记录</b><p>新的作业、听写、考勤与沟通会出现在这里。</p></div></li>}
        </ol></section>
        {focusedStudent.note && <section className="campus-student-note"><h3>班务备注</h3><p>{focusedStudent.note}</p></section>}
      </> : <div className="campus-student-detail-empty"><ThemeArtwork slot="roster"/><p>从名单中选择一名学生查看近期动态。</p></div>}</aside>
    </section>
    {profileStudentId && classStudents.find((student) => student.id === profileStudentId) && <StudentProfile student={classStudents.find((student) => student.id === profileStudentId)!} data={data} update={update} onClose={() => setProfileStudentId("")} />}
    {newStudentDraft && <div className="roster-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setNewStudentDraft(null); }}><section className="roster-editor-modal" role="dialog" aria-modal="true" aria-labelledby="roster-new-student-title"><header><div><h2 id="roster-new-student-title">新增学生</h2><p>保存后才会加入当前班级名单。</p></div><button type="button" aria-label="关闭" onClick={() => setNewStudentDraft(null)}>×</button></header><div className="roster-editor-fields"><label><span>姓名</span><input autoFocus value={newStudentDraft.name} onChange={(event) => setNewStudentDraft({ ...newStudentDraft, name: event.target.value })} placeholder="请输入学生姓名" /></label><label><span>学号</span><input value={newStudentDraft.studentNo ?? ""} onChange={(event) => setNewStudentDraft({ ...newStudentDraft, studentNo: event.target.value })} placeholder="例如：51" /></label><label><span>性别</span><select value={newStudentDraft.gender} onChange={(event) => setNewStudentDraft({ ...newStudentDraft, gender: event.target.value as Student["gender"] })}><option>女</option><option>男</option></select></label><label><span>小组</span><input type="number" min={1} value={newStudentDraft.group} onChange={(event) => setNewStudentDraft({ ...newStudentDraft, group: Number(event.target.value) || 1 })} /></label><label><span>座位</span><input type="number" min={1} value={newStudentDraft.seat} onChange={(event) => setNewStudentDraft({ ...newStudentDraft, seat: Number(event.target.value) || 1 })} /></label><label><span>家长电话 <i>选填</i></span><input inputMode="tel" maxLength={13} value={newStudentDraft.parentPhone ?? ""} onChange={(event) => setNewStudentDraft({ ...newStudentDraft, parentPhone: event.target.value })} placeholder="11位手机号" /></label><label className="wide"><span>备注 <i>选填</i></span><textarea value={newStudentDraft.note ?? ""} onChange={(event) => setNewStudentDraft({ ...newStudentDraft, note: event.target.value })} placeholder="可填写需要长期记住的班务信息" /></label></div><footer><button type="button" onClick={() => setNewStudentDraft(null)}>取消</button><button type="button" className="roster-primary-action" onClick={saveNewStudent}>保存学生</button></footer></section></div>}
  </section>;
}

function Homework({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "class-1";
  const activeClass = data.rosterClasses?.find((item) => item.id === activeClassId);
  const tasks = (data.homeworkTasks ?? []).filter((item) => item.classId === activeClassId);
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id ?? "");
  const [detailOpen, setDetailOpen] = useState(Boolean(tasks.length));
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [createError, setCreateError] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editError, setEditError] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [copyMessage, setCopyMessage] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("全部月份");
  const [listPage, setListPage] = useState(1);
  const [studentPage, setStudentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"全部" | HomeworkTask["statuses"][string]>("全部");
  const [groupFilter, setGroupFilter] = useState("全部");
  const [studentKeyword, setStudentKeyword] = useState("");
  const [detailStatusFilter, setDetailStatusFilter] = useState<"全部" | HomeworkTask["statuses"][string]>("全部");
  const [detailGroupFilter, setDetailGroupFilter] = useState("全部");
  const [detailStudentKeyword, setDetailStudentKeyword] = useState("");
  const [taskKeyword, setTaskKeyword] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("全部");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const pageSize = 10;
  const studentPageSize = 20;
  const statusOptions: HomeworkTask["statuses"][string][] = ["已交", "未交", "待订正", "已复查"];
  const groups = Array.from(new Set(data.students.map((s) => s.group))).sort((a, b) => a - b);
  const subjects = Array.from(new Set(tasks.map((item) => item.subject).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
  const monthCounts = tasks.reduce((result, item) => {
    const month = item.date.slice(0, 7);
    result[month] = (result[month] ?? 0) + 1;
    return result;
  }, {} as Record<string, number>);
  const archiveMonths = Object.keys(monthCounts).sort((a, b) => b.localeCompare(a));
  const normalizedFrom = dateFrom && dateTo && dateFrom > dateTo ? dateTo : dateFrom;
  const normalizedTo = dateFrom && dateTo && dateFrom > dateTo ? dateFrom : dateTo;
  const filteredTasks = tasks.filter((item) => {
    const taskText = `${item.date}${item.subject}${item.title}`.toLocaleLowerCase("zh-CN");
    const matchTask = taskText.includes(taskKeyword.trim().toLocaleLowerCase("zh-CN"));
    const matchSubject = subjectFilter === "全部" || item.subject === subjectFilter;
    const matchMonth = selectedMonth === "全部月份" || item.date.startsWith(selectedMonth);
    const matchFrom = !normalizedFrom || item.date >= normalizedFrom;
    const matchTo = !normalizedTo || item.date <= normalizedTo;
    const matchStudent = !studentKeyword.trim() || data.students.some((student) => {
      const status = item.statuses[student.id] ?? student.homework;
      const text = `${student.name}${student.studentNo}${student.parentPhone}${student.note}${student.group}${status}`.toLocaleLowerCase("zh-CN");
      return text.includes(studentKeyword.trim().toLocaleLowerCase("zh-CN"));
    });
    const matchStatus = statusFilter === "全部" || data.students.some((student) => (item.statuses[student.id] ?? student.homework) === statusFilter);
    const matchGroup = groupFilter === "全部" || data.students.some((student) => student.group === Number(groupFilter));
    return matchTask && matchSubject && matchMonth && matchFrom && matchTo && matchStudent && matchStatus && matchGroup;
  }).sort((a, b) => b.date.localeCompare(a.date) || a.subject.localeCompare(b.subject, "zh-CN"));
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const safePage = Math.min(listPage, totalPages);
  const pagedTasks = filteredTasks.slice((safePage - 1) * pageSize, safePage * pageSize);
  const task = tasks.find((item) => item.id === selectedTaskId);
  const taskId = task?.id ?? "";
  const followStudents = task ? (task.followUpStudentIds ?? [])
    .map((id) => data.students.find((student) => student.id === id))
    .filter((student): student is Student => Boolean(student)) : [];
  const followMissingCount = followStudents.filter((student) => (task?.statuses[student.id] ?? student.homework) === "未交").length;
  const followFixingCount = followStudents.filter((student) => (task?.statuses[student.id] ?? student.homework) === "待订正").length;
  const followDoneCount = followStudents.length - followMissingCount - followFixingCount;
  const visibleStudents = data.students.filter((student) => {
    const status = task?.statuses[student.id] ?? student.homework;
    const matchStatus = detailStatusFilter === "全部" || status === detailStatusFilter;
    const matchGroup = detailGroupFilter === "全部" || student.group === Number(detailGroupFilter);
    const text = `${student.name}${student.studentNo}${student.parentPhone}${student.note}`.toLocaleLowerCase("zh-CN");
    return matchStatus && matchGroup && text.includes(detailStudentKeyword.trim().toLocaleLowerCase("zh-CN"));
  });
  const studentTotalPages = Math.max(1, Math.ceil(visibleStudents.length / studentPageSize));
  const safeStudentPage = Math.min(studentPage, studentTotalPages);
  const pagedStudents = visibleStudents.slice((safeStudentPage - 1) * studentPageSize, safeStudentPage * studentPageSize);
  const counts = statusOptions.reduce((acc, status) => ({ ...acc, [status]: data.students.filter((student) => (task?.statuses[student.id] ?? student.homework) === status).length }), {} as Record<HomeworkTask["statuses"][string], number>);
  const completionRate = data.students.length ? Math.round(((counts["已交"] + counts["已复查"]) / data.students.length) * 100) : 0;
  const todayTasks = tasks.filter((item) => item.date === today()).sort((a, b) => taskSummary(b).missing - taskSummary(a).missing);
  const unresolvedTasks = tasks.filter((item) => {
    const summary = taskSummary(item);
    return summary.missing + summary.fixing > 0;
  }).length;
  const totalTaskChecks = Math.max(1, tasks.length * data.students.length);
  const finishedTaskChecks = tasks.reduce((count, item) => count + taskSummary(item).done, 0);
  const overallRate = Math.round(finishedTaskChecks / totalTaskChecks * 100);
  const excellentRate = tasks.length ? Math.round(tasks.filter((item) => taskSummary(item).rate >= 90).length / tasks.length * 100) : 0;

  useEffect(() => {
    if (selectedTaskId && tasks.length && !tasks.some((item) => item.id === selectedTaskId)) {
      setSelectedTaskId("");
      setDetailOpen(false);
    }
  }, [selectedTaskId, tasks]);

  useEffect(() => setListPage(1), [taskKeyword, subjectFilter, selectedMonth, dateFrom, dateTo, studentKeyword, statusFilter, groupFilter, activeClassId]);
  useEffect(() => setStudentPage(1), [detailStudentKeyword, detailStatusFilter, detailGroupFilter, selectedTaskId]);

  function setTask(patch: Partial<HomeworkTask>) {
    if (!taskId) return;
    update((d) => ({ ...d, homeworkTasks: d.homeworkTasks?.map((item) => item.id === taskId ? { ...item, ...patch } : item) ?? [] }));
  }
  function openCreateTask() {
    setDraftDate(today());
    setDraftSubject("");
    setDraftTitle("");
    setCreateError("");
    setCreateOpen(true);
  }
  function confirmAddTask() {
    if (!draftDate || !draftSubject.trim() || !draftTitle.trim()) {
      setCreateError("请填写日期、学科和作业内容后再确认。");
      return;
    }
    const newTask: HomeworkTask = {
      id: makeId(),
      classId: activeClassId,
      followUpStudentIds: [],
      date: draftDate,
      subject: draftSubject.trim(),
      title: draftTitle.trim(),
      statuses: Object.fromEntries(data.students.map((s) => [s.id, "已交"])),
    };
    update((d) => ({ ...d, homeworkTasks: [newTask, ...(d.homeworkTasks ?? [])] }));
    setCreateOpen(false);
  }
  async function deleteTaskById(id: string) {
    const target = tasks.find((item) => item.id === id);
    if (!target || !await requestDangerConfirm(`${target.subject} · ${target.title} 删除后无法恢复。`)) return;
    update((d) => ({ ...d, homeworkTasks: (d.homeworkTasks ?? []).filter((item) => item.id !== id) }));
    if (selectedTaskId === id) {
      setSelectedTaskId("");
      setDetailOpen(false);
    }
  }
  function openTask(id: string) {
    setSelectedTaskId(id);
    setDetailOpen(true);
    setFollowOpen(false);
    setSelectedStudentIds([]);
    setCopyMessage("");
    setDetailStudentKeyword("");
    setDetailStatusFilter("全部");
    setDetailGroupFilter("全部");
  }
  function openEditTask() {
    if (!task) return;
    setEditDate(task.date);
    setEditSubject(task.subject);
    setEditTitle(task.title);
    setEditError("");
    setEditOpen(true);
  }
  function confirmEditTask() {
    if (!editDate || !editSubject.trim() || !editTitle.trim()) {
      setEditError("请完整填写日期、学科和作业内容。");
      return;
    }
    setTask({ date: editDate, subject: editSubject.trim(), title: editTitle.trim() });
    setEditOpen(false);
  }
  function setStatus(student: Student, next: HomeworkTask["statuses"][string]) {
    if (!taskId) return;
    update((d) => applyHomeworkStatuses(d, activeClassId, taskId, [student.id], next));
  }
  function toggle(student: Student) {
    if (!task) return;
    const current = task.statuses[student.id] ?? student.homework;
    const next = homeworkOrder[(homeworkOrder.indexOf(current) + 1) % homeworkOrder.length];
    setStatus(student, next);
  }
  function toggleStudentSelection(id: string) {
    setSelectedStudentIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function toggleCurrentPage() {
    const pageIds = pagedStudents.map((student) => student.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedStudentIds.includes(id));
    setSelectedStudentIds((current) => allSelected ? current.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...current, ...pageIds])));
  }
  function addSelectedToFollowList() {
    if (!task || !selectedStudentIds.length) return;
    setTask({ followUpStudentIds: Array.from(new Set([...(task.followUpStudentIds ?? []), ...selectedStudentIds])) });
    setCopyMessage("");
    setFollowOpen(true);
  }
  function removeFromFollowList(studentId: string) {
    if (!task) return;
    setTask({ followUpStudentIds: (task.followUpStudentIds ?? []).filter((id) => id !== studentId) });
    setCopyMessage("");
  }
  function bulkSet(next: HomeworkTask["statuses"][string]) {
    if (!taskId) return;
    const target = data.students.filter((student) => selectedStudentIds.includes(student.id));
    if (!target.length) return;
    update((d) => applyHomeworkStatuses(d, activeClassId, taskId, target.map((student) => student.id), next));
    setSelectedStudentIds([]);
  }
  function setStudentNote(studentId: string, note: string) {
    update((d) => ({
      ...d,
      students: d.students.map((student) => student.id === studentId ? { ...student, note } : student),
      rosterClasses: d.rosterClasses?.map((item) => item.id === activeClassId ? { ...item, students: item.students.map((student) => student.id === studentId ? { ...student, note } : student) } : item),
    }));
  }
  async function copyFollowList() {
    if (!followStudents.length) {
      setCopyMessage("待跟进名单为空，请先勾选学生加入名单");
      return;
    }
    const list = `${task?.date ?? ""} ${task?.subject ?? ""} · ${task?.title ?? ""}\n` + followStudents
      .map((student, index) => `${index + 1}. ${student.name}（第${student.group}组：${task?.statuses[student.id] ?? student.homework}）`)
      .join("\n");
    const copied = await copyTextToClipboard(list, `已复制 ${followStudents.length} 名待跟进学生`);
    setCopyMessage(copied ? `已复制 ${followStudents.length} 名待跟进学生` : "浏览器未允许复制，请检查复制权限后重试");
  }
  function resetTaskFilters() {
    setTaskKeyword("");
    setSubjectFilter("全部");
    setSelectedMonth("全部月份");
    setDateFrom("");
    setDateTo("");
    setStudentKeyword("");
    setStatusFilter("全部");
    setGroupFilter("全部");
  }
  function taskSummary(item: HomeworkTask) {
    const total = data.students.length || 1;
    const done = data.students.filter((student) => {
      const status = item.statuses[student.id] ?? student.homework;
      return status === "已交" || status === "已复查";
    }).length;
    const missing = data.students.filter((student) => (item.statuses[student.id] ?? student.homework) === "未交").length;
    const fixing = data.students.filter((student) => (item.statuses[student.id] ?? student.homework) === "待订正").length;
    return { done, missing, fixing, rate: Math.round(done / total * 100) };
  }

  if (detailOpen && task) return <section className="homework-page homework-bootstrap-preview homework-detail-preview">
    {createOpen && <div className="homework-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}><section className="homework-create-modal" role="dialog" aria-modal="true" aria-labelledby="create-homework-title-detail"><header><div><h3 id="create-homework-title-detail">新增作业</h3><p>确认后加入当前班级台账。</p></div><button aria-label="关闭" onClick={() => setCreateOpen(false)}>×</button></header><div className="homework-create-fields"><label>日期<input type="date" value={draftDate} onChange={(e) => { setDraftDate(e.target.value); setCreateError(""); }} /></label><label>学科<input value={draftSubject} onChange={(e) => { setDraftSubject(e.target.value); setCreateError(""); }} placeholder="请输入学科" autoFocus /></label><label className="wide">作业内容<textarea value={draftTitle} onChange={(e) => { setDraftTitle(e.target.value); setCreateError(""); }} placeholder="请输入具体作业内容" rows={4} /></label></div>{createError && <p className="homework-create-error">{createError}</p>}<footer><button className="cancel" onClick={() => setCreateOpen(false)}>取消</button><button className="confirm" onClick={confirmAddTask}>确认新增</button></footer></section></div>}
    <WorkbenchPageHeader
      icon="homework"
      tone="coral"
      title="作业追踪"
      description={`${activeClass?.name ?? "当前班级"} · 先选择作业，再集中处理学生提交、订正和复查状态。`}
      actions={<button className="primary-small workbench-header-primary" onClick={openCreateTask}>新增作业</button>}
    />
    {editOpen && <div className="homework-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditOpen(false); }}>
      <section className="homework-create-modal" role="dialog" aria-modal="true" aria-labelledby="edit-homework-title">
        <header><div><span>编辑作业</span><h3 id="edit-homework-title">修改作业信息</h3><p>较长的作业内容可以在下面完整编写。</p></div><button aria-label="关闭" onClick={() => setEditOpen(false)}>×</button></header>
        <div className="homework-create-fields">
          <label>日期<input type="date" value={editDate} onChange={(e) => { setEditDate(e.target.value); setEditError(""); }} /></label>
          <label>学科<input value={editSubject} onChange={(e) => { setEditSubject(e.target.value); setEditError(""); }} placeholder="请输入学科" /></label>
          <label className="wide">作业内容<textarea value={editTitle} onChange={(e) => { setEditTitle(e.target.value); setEditError(""); }} placeholder="请输入具体作业内容，可换行编写" rows={8} autoFocus /></label>
        </div>
        {editError && <p className="homework-create-error">{editError}</p>}
        <footer><button className="cancel" onClick={() => setEditOpen(false)}>取消</button><button className="confirm" onClick={confirmEditTask}>确认保存</button></footer>
      </section>
    </div>}
    {followOpen && <div className="homework-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFollowOpen(false); }}>
      <section className="homework-follow-modal" role="dialog" aria-modal="true" aria-labelledby="follow-list-title">
        <header><div><h3 id="follow-list-title">待跟进名单</h3><p><b>{task.subject} · {task.title}</b><span>{task.date}</span></p></div><button className="follow-close" aria-label="关闭待跟进名单" onClick={() => setFollowOpen(false)}>×</button></header>
        <dl className="homework-follow-stats" aria-label="待跟进名单统计"><div className="total"><dt>待跟进</dt><dd>{followStudents.length}<small> 人</small></dd></div><div className="missing"><dt>未交</dt><dd>{followMissingCount}</dd></div><div className="fixing"><dt>待订正</dt><dd>{followFixingCount}</dd></div><div className="complete"><dt>已交 / 复查</dt><dd>{followDoneCount}</dd></div></dl>
        <div className="homework-follow-list" aria-live="polite">
          {followStudents.map((student, index) => {
            const status = task.statuses[student.id] ?? student.homework;
            return <article key={student.id}><span className="follow-rank">{index + 1}</span><i className="follow-avatar">{student.name.slice(0, 1)}</i><div className="follow-student"><b>{student.name}</b><small>第{student.group}组{student.note ? ` · ${student.note}` : ""}</small></div><em className={`homework-pill ${status}`}>{status}</em><button className="remove" aria-label={`将${student.name}移出待跟进名单`} onClick={() => removeFromFollowList(student.id)}>移出</button></article>;
          })}
          {!followStudents.length && <div className="empty-result"><b>暂无待跟进学生</b><span>在学生列表中选中学生，再使用“加入待跟进名单”。</span></div>}
        </div>
        {copyMessage && <p className={`homework-copy-message ${copyMessage.startsWith("已复制") ? "success" : ""}`}>{copyMessage}</p>}
        <footer><button className="cancel" onClick={() => setFollowOpen(false)}>关闭</button><button className="confirm" disabled={!followStudents.length} onClick={copyFollowList}>复制名单</button></footer>
      </section>
    </div>}
    <section className="campus-homework-workspace"><aside className="campus-homework-master">
      <header><div><h2>作业任务</h2><p>{filteredTasks.length} 项 · {unresolvedTasks} 项待处理</p></div><button type="button" onClick={resetTaskFilters}>重置</button></header>
      <label className="campus-homework-search"><span>搜索任务</span><input value={taskKeyword} onChange={(event) => setTaskKeyword(event.target.value)} placeholder="学科或作业内容"/></label>
      <div className="campus-homework-master-filters"><label>学科<select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}><option value="全部">全部</option>{subjects.map(subject => <option key={subject}>{subject}</option>)}</select></label><label>月份<select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}><option>全部月份</option>{archiveMonths.map(month => <option key={month}>{month}</option>)}</select></label></div>
      <div className="campus-homework-task-list">{pagedTasks.map(item => { const summary = taskSummary(item); return <button type="button" className={item.id === task.id ? 'is-current' : ''} key={item.id} onClick={() => openTask(item.id)}><span><em>{item.subject}</em><time>{item.date}</time></span><b>{item.title}</b><small><i style={{width:`${summary.rate}%`}}/>{summary.rate}% 完成 · 未交 {summary.missing} · 待订正 {summary.fixing}</small></button>; })}{!pagedTasks.length && <p>没有匹配的作业任务。</p>}</div>
      <footer><button disabled={safePage <= 1} onClick={() => setListPage(page => Math.max(1, page - 1))}>上一页</button><span>{safePage} / {totalPages}</span><button disabled={safePage >= totalPages} onClick={() => setListPage(page => Math.min(totalPages, page + 1))}>下一页</button></footer>
    </aside><section className="taskdesk-detail campus-homework-detail">
      <header className="campus-homework-detail-heading"><div><span>{task.subject}</span><h2>{task.title}</h2><p>{task.date} · {data.students.length} 名学生</p></div><ThemeArtwork slot="homework"/><button type="button" onClick={openEditTask}>编辑作业</button></header>
      <section className="taskdesk-detail-info">
        <div><span>日期</span><b>{task.date}</b></div>
        <div><span>学科</span><b>{task.subject}</b></div>
        <div className="content"><span>作业内容</span><p>{task.title}</p></div>
        <button onClick={openEditTask}>编辑作业信息</button>
      </section>
      <section className="taskdesk-metrics taskdesk-detail-metrics">
        <div><span>完成率</span><b>{completionRate}%</b></div>
        <div><span>已交</span><b>{counts["已交"]}</b></div>
        <div><span>未交</span><b>{counts["未交"]}</b></div>
        <div><span>待订正</span><b>{counts["待订正"]}</b></div>
        <div><span>已复查</span><b>{counts["已复查"]}</b></div>
      </section>
      <section className="taskdesk-filters taskdesk-detail-filters">
        <label className="taskdesk-filter-search"><span>学生搜索</span><div className="resource-search compact-search"><span>⌕</span><input value={detailStudentKeyword} onChange={(e) => setDetailStudentKeyword(e.target.value)} placeholder="姓名、学号或备注" /></div></label>
        <label><span>状态</span><select value={detailStatusFilter} onChange={(e) => setDetailStatusFilter(e.target.value as typeof detailStatusFilter)}><option>全部</option>{statusOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>小组</span><select value={detailGroupFilter} onChange={(e) => setDetailGroupFilter(e.target.value)}><option>全部</option>{groups.map((group) => <option value={group} key={group}>第{group}组</option>)}</select></label>
      </section>
      <section className="taskdesk-bulk">
        <span>已选择 <b>{selectedStudentIds.length}</b> 人</span>
        <button onClick={toggleCurrentPage}>{pagedStudents.length > 0 && pagedStudents.every((student) => selectedStudentIds.includes(student.id)) ? "取消本页全选" : "全选本页"}</button>
        {selectedStudentIds.length > 0 && <>
          <button onClick={() => bulkSet("已交")}>选中设为已交</button>
          <button onClick={() => bulkSet("未交")}>选中设为未交</button>
          <button onClick={() => bulkSet("待订正")}>选中设为待订正</button>
          <button onClick={() => bulkSet("已复查")}>选中设为已复查</button>
          <button className="follow-add" onClick={addSelectedToFollowList}>选中加入待跟进名单</button>
        </>}
        <button onClick={() => { setCopyMessage(""); setFollowOpen(true); }}>查看待跟进名单（{followStudents.length}）</button>
      </section>
      <section className="homework-student-table-card">
        <div className="homework-table-wrap">
          <table className="homework-student-table">
            <thead><tr><th><label className="student-select-head"><input type="checkbox" aria-label="全选本页学生" checked={pagedStudents.length > 0 && pagedStudents.every((student) => selectedStudentIds.includes(student.id))} onChange={toggleCurrentPage} />学生</label></th><th>小组</th><th>当前状态</th><th>快速处理</th><th>备注</th></tr></thead>
            <tbody>{pagedStudents.map((student) => {
              const status = task.statuses[student.id] ?? student.homework;
              return <tr className={selectedStudentIds.includes(student.id) ? "selected" : ""} key={student.id}>
                <td><label className="homework-student-cell"><input type="checkbox" aria-label={`选择${student.name}`} checked={selectedStudentIds.includes(student.id)} onChange={() => toggleStudentSelection(student.id)} /><i>{student.name.slice(0,1)}</i><span><b>{student.name}</b><small>学号 {student.studentNo || "未填"}</small></span></label></td>
                <td>第{student.group}组</td>
                <td><em className={`taskdesk-pill ${status}`}>{status}</em></td>
                <td><div className="homework-status-segment">{statusOptions.map((next) => <button className={next === status ? "active" : ""} key={next} onClick={() => setStatus(student, next)}>{next}</button>)}</div></td>
                <td><input className="taskdesk-note" value={student.note ?? ""} onChange={(e) => setStudentNote(student.id, e.target.value)} placeholder="点击填写备注" /></td>
              </tr>;
            })}</tbody>
          </table>
          {!pagedStudents.length && <div className="empty-result"><b>没有匹配的学生</b><span>调整搜索、状态或小组条件后再试。</span></div>}
        </div>
      </section>
      <div className="taskdesk-pagination">
        <button disabled={safeStudentPage <= 1} onClick={() => setStudentPage((page) => Math.max(1, page - 1))}>上一页</button>
        <span>学生第 {safeStudentPage} / {studentTotalPages} 页，共 {visibleStudents.length} 人</span>
        <button disabled={safeStudentPage >= studentTotalPages} onClick={() => setStudentPage((page) => Math.min(studentTotalPages, page + 1))}>下一页</button>
      </div>
    </section></section>
  </section>;

  return <section className="homework-page homework-bootstrap-preview">
    {createOpen && <div className="homework-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
      <section className="homework-create-modal" role="dialog" aria-modal="true" aria-labelledby="create-homework-title">
        <header><div><h3 id="create-homework-title">新增作业</h3><p>不预填任何内容，确认后才会加入台账。</p></div><button aria-label="关闭" onClick={() => setCreateOpen(false)}>×</button></header>
        <div className="homework-create-fields">
          <label>日期<input type="date" value={draftDate} onChange={(e) => { setDraftDate(e.target.value); setCreateError(""); }} /></label>
          <label>学科<input value={draftSubject} onChange={(e) => { setDraftSubject(e.target.value); setCreateError(""); }} placeholder="请输入学科" autoFocus /></label>
          <label className="wide">作业内容<textarea value={draftTitle} onChange={(e) => { setDraftTitle(e.target.value); setCreateError(""); }} placeholder="请输入具体作业内容" rows={4} /></label>
        </div>
        {createError && <p className="homework-create-error">{createError}</p>}
        <footer><button className="cancel" onClick={() => setCreateOpen(false)}>取消</button><button className="confirm" onClick={confirmAddTask}>确认新增</button></footer>
      </section>
    </div>}
    <WorkbenchPageHeader
      icon="📚"
      tone="coral"
      title="作业追踪"
      description={`${activeClass?.name ?? "当前班级"} · 按日期、学科和状态查找，进入单项作业后批量处理学生状态。`}
      actions={<button className="primary-small workbench-header-primary" onClick={openCreateTask}>新增作业</button>}
    />
    <section className="campus-statistics" aria-label="作业概览">
      <div><span>总任务</span><b>{tasks.length}</b><small>当前班级全部作业</small></div>
      <div><span>待处理</span><b>{unresolvedTasks}</b><small>存在未交或待订正</small></div>
      <div><span>完成率</span><b>{overallRate}%</b><small>已交和已复查占比</small></div>
    </section>
    {todayTasks.length > 0 && <section className="homework-today-strip">
      <header><b>今日作业</b><span>{todayTasks.length ? `${todayTasks.length} 项` : "暂无记录"}</span></header>
      <div className="homework-today-list">{todayTasks.slice(0, 4).map((item) => {
        const summary = taskSummary(item);
        return <button key={item.id} onClick={() => openTask(item.id)}><span>{item.subject}</span><b>{item.title}</b><small>{summary.missing ? `未交 ${summary.missing}` : "无未交"} · 待订正 {summary.fixing} · 完成率 {summary.rate}%</small></button>;
      })}</div>
    </section>}
    <section className="homework-ledger-panel">
      <header className="homework-ledger-head"><div><b>历史作业台账</b><span>按月归档、按条件查找，每页固定 10 项</span></div><button className="homework-reset-link" onClick={resetTaskFilters}>重置</button></header>
      <div className="homework-toolbar">
        <label className="homework-search"><span>搜索</span><input value={taskKeyword} onChange={(e) => setTaskKeyword(e.target.value)} placeholder="学科、页码、练习名称" /></label>
        <label><span>月份</span><select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}><option>全部月份</option>{archiveMonths.map((month) => <option key={month} value={month}>{month.replace("-", "年")}月（{monthCounts[month]}项）</option>)}</select></label>
        <label><span>学科</span><select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}><option value="全部">全部学科</option>{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
        <label><span>状态</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}><option>全部</option>{statusOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button className="homework-filter-toggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>{advancedOpen ? "收起筛选" : "更多筛选"}</button>
      </div>
      {advancedOpen && <div className="homework-advanced-panel">
        <label>开始日期<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
        <label>结束日期<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
        <label>查某个学生<input value={studentKeyword} onChange={(e) => setStudentKeyword(e.target.value)} placeholder="姓名或学号" /></label>
        <label>学生小组<select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}><option>全部</option>{groups.map((group) => <option value={group} key={group}>第{group}组</option>)}</select></label>
      </div>}
      {dateFrom && dateTo && dateFrom > dateTo && <p className="homework-hint">日期顺序已自动调整为 {normalizedFrom} 至 {normalizedTo}。</p>}
      <div className="homework-result-line"><b>{selectedMonth === "全部月份" ? "全部归档" : `${selectedMonth.replace("-", "年")}月`}</b><span>找到 {filteredTasks.length} 项 · 当前第 {safePage} / {totalPages} 页</span></div>
      {filteredTasks.length === 0 && <div className="empty-result"><b>没有找到符合条件的作业</b><span>建议先清空条件，或新增一项作业。</span></div>}
      <div className="homework-table-wrap">
        <table className="homework-ledger-table">
          <thead><tr><th>日期</th><th>学科</th><th>作业内容</th><th>完成率</th><th>未交</th><th>待订正</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>{pagedTasks.map((item) => {
            const summary = taskSummary(item);
            const overdue = item.date < today() && summary.missing > 0;
            const done = summary.rate === 100;
            const badgeClass = overdue ? "overdue" : done ? "done" : summary.fixing ? "grading" : "pending";
            const badgeText = overdue ? "已逾期" : done ? "已完成" : summary.fixing ? "待批改" : "进行中";
            return <tr key={item.id}>
              <td>{item.date}</td>
              <td><span className="taskdesk-subject">{item.subject}</span></td>
              <td><b>{item.title}</b><small>已交/复查 {summary.done}/{data.students.length || 0}</small></td>
              <td><div className="homework-rate"><span style={{ width: `${summary.rate}%` }} /><b>{summary.rate}%</b></div></td>
              <td>{summary.missing}</td>
              <td>{summary.fixing}</td>
              <td><span className={`status-badge ${badgeClass}`}>{badgeText}</span></td>
              <td><div className="homework-row-actions"><button className="primary" onClick={() => openTask(item.id)}>处理</button><button className="danger-link" onClick={() => deleteTaskById(item.id)}>删除</button></div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div className="taskdesk-pagination">
        <button disabled={safePage <= 1} onClick={() => setListPage(1)}>首页</button>
        <button disabled={safePage <= 1} onClick={() => setListPage((page) => Math.max(1, page - 1))}>上一页</button>
        <span>第 {safePage} / {totalPages} 页，每页 10 项</span>
        <button disabled={safePage >= totalPages} onClick={() => setListPage((page) => Math.min(totalPages, page + 1))}>下一页</button>
        <button disabled={safePage >= totalPages} onClick={() => setListPage(totalPages)}>末页</button>
      </div>
    </section>
  </section>;
}

function Points({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const rules = pointRulesForData(data).filter((item) => item.enabled !== false);
  const [ruleId, setRuleId] = useState(rules[0]?.id ?? "");
  const [keyword, setKeyword] = useState("");
  const [groupFilter, setGroupFilter] = useState("全部小组");
  const [operator, setOperator] = useState("班主任");
  const [note, setNote] = useState("");
  const [customDelta, setCustomDelta] = useState(rules[0]?.delta ?? 1);
  const [selected, setSelected] = useState<string[]>([]);

  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "class-1";
  const students = data.students;
  const rule = rules.find((item) => item.id === ruleId) ?? rules[0];
  const value = Number(customDelta) || 0;
  const absDelta = Math.max(1, Math.abs(value));
  const actionText = (value >= 0 ? "加" : "扣") + absDelta;
  const groups = Array.from(new Set(students.map((student) => student.group))).sort((a, b) => a - b);
  const filtered = students.filter((student) => {
    const text = `${student.name}${student.studentNo ?? ""}第${student.group}组${student.homework}${student.attendance}${student.points}`;
    const groupOk = groupFilter === "全部小组" || student.group === Number(groupFilter);
    return groupOk && (!keyword.trim() || text.includes(keyword.trim()));
  });
  const filteredStudentIds = filtered.map((student) => student.id);
  const filteredAllSelected = filteredStudentIds.length > 0 && filteredStudentIds.every((id) => selected.includes(id));
  const selectedStudents = students.filter((student) => selected.includes(student.id));
  const selectedNames = selectedStudents.map((student) => student.name);
  const classEvents = pointEventsForClass(data, activeClassId);
  const positiveTotal = classEvents.filter((event) => event.delta > 0).reduce((sum, event) => sum + event.delta, 0);
  const negativeTotal = classEvents.filter((event) => event.delta < 0).reduce((sum, event) => sum + Math.abs(event.delta), 0);
  const participants = new Set(classEvents.map((event) => event.studentId)).size;
  const recentEvents = classEvents.slice(0, 12);

  useEffect(() => {
    setCustomDelta(rule?.delta ?? 1);
  }, [rule?.id, rule?.delta]);

  function toggleStudent(id: string) {
    setSelected((list) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  function toggleFiltered() {
    setSelected((list) => {
      if (filteredAllSelected) return list.filter((id) => !filteredStudentIds.includes(id));
      return Array.from(new Set([...list, ...filteredStudentIds]));
    });
  }

  function applyScore(studentIds: string[]) {
    if (!studentIds.length || !rule || value === 0) return;
    const stamp = new Date().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    update((d) => applyPointEvents(d, activeClassId, studentIds, rule, value, note, operator, stamp, makeId));
    setSelected([]);
    setNote("");
  }

  function undoEvent(event: PointEvent) {
    update((d) => undoPointEventInClass(d, activeClassId, event.id));
  }

  return <section className="point-pro-page homework-bootstrap-preview">
    <WorkbenchPageHeader icon="⭐" tone="marigold" title="班级记分" description="选择学生和规则后统一提交，误操作可在历史记录中撤销。" />
    <section className="campus-statistics">
      <div><span>累计加分</span><b>{positiveTotal}</b><small>当前班全部记录</small></div>
      <div><span>累计扣分</span><b>{negativeTotal}</b><small>当前班全部记录</small></div>
      <div><span>参与人数</span><b>{participants}</b><small>已有积分记录</small></div>
    </section>
    <div className="pointdesk-workspace">
      <div className="pointdesk-students">
        <header className="pointdesk-section-head">
          <div>
            <b>选择学生</b>
            <span>当前筛选 {filtered.length} 人，已选 {selected.length} 人</span>
          </div>
          <div className="pointdesk-head-actions">
            <button className="pointdesk-clear" disabled={!selected.length} onClick={() => setSelected([])}>清空</button>
            <button className="pointdesk-primary" disabled={!selected.length || value === 0} onClick={() => applyScore(selected)}>
              {selected.length ? `提交 ${selected.length} 人` : "请选择学生"}
            </button>
          </div>
        </header>
        <div className="pointdesk-toolbar">
          <label className="pointdesk-search">
            <span>搜索</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="姓名、学号、积分、作业状态" />
          </label>
          <label className="pointdesk-group-select"><span>小组</span><select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option>全部小组</option>{groups.map((group) => <option value={String(group)} key={group}>第{group}组</option>)}</select></label>
        </div>
        <div className="pointdesk-table">
          <div className="pointdesk-table-scroll">
            <table className="pointdesk-student-table">
              <thead>
                <tr><th><label className="pointdesk-select-all"><input type="checkbox" aria-label="全选当前筛选学生" checked={filteredAllSelected} onChange={toggleFiltered} /><span className="visually-hidden">全选当前筛选学生</span></label></th><th>学生</th><th>考勤</th><th>小组</th><th>当前积分</th><th>作业</th></tr>
              </thead>
              <tbody>
                {filtered.map((student) => <tr className={selected.includes(student.id) ? "selected" : ""} key={student.id} onClick={() => toggleStudent(student.id)}>
                  <td><input type="checkbox" aria-label={`选择${student.name}`} checked={selected.includes(student.id)} onChange={() => toggleStudent(student.id)} onClick={(event) => event.stopPropagation()} /></td>
                  <td><span className="pointdesk-student"><i>{student.name.slice(0, 1)}</i><span><b>{student.name}</b><small>学号 {student.studentNo || "未填"}</small></span></span></td>
                  <td><span className={`pointdesk-attendance ${student.attendance === "正常" ? "normal" : student.attendance === "迟到" ? "late" : "leave"}`}>{student.attendance}</span></td>
                  <td><span className="pointdesk-muted">第{student.group}组</span></td>
                  <td><strong>{student.points}</strong></td>
                  <td><span className="pointdesk-muted">{student.homework}</span></td>
                </tr>)}
                {!filtered.length && <tr><td colSpan={6}><div className="pointdesk-empty">没有匹配的学生，换个关键词或小组试试。</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <aside className="pointdesk-panel">
        <header className="pointdesk-section-head compact">
          <div>
            <b>录入规则</b>
            <span>{rule ? `${rule.scene} · ${rule.title}` : "暂无可用规则"}</span>
          </div>
          <strong className={value >= 0 ? "positive" : "negative"}>{value > 0 ? "+" : ""}{value}</strong>
        </header>
        <div className="pointdesk-rule-list">
          {rules.slice(0, 8).map((item) => <button className={`${item.id === rule?.id ? "selected " : ""}${item.delta >= 0 ? "positive" : "negative"}`} key={item.id} onClick={() => setRuleId(item.id)}>
            <span>{item.scene} · {item.title}</span>
            <b>{item.delta > 0 ? "+" : ""}{item.delta}</b>
          </button>)}
        </div>
        <label className="pointdesk-score-control">
          <span>自定义分数</span>
          <input type="range" min={-10} max={10} value={customDelta} onChange={(event) => setCustomDelta(Number(event.target.value))} />
        </label>
        <label className="pointdesk-field">
          <span>备注</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：主动帮同学讲题" rows={3} />
        </label>
        <label className="pointdesk-field">
          <span>操作人</span>
          <input value={operator} onChange={(event) => setOperator(event.target.value)} placeholder="例如：班主任" />
        </label>
        <div className="pointdesk-selected-box">
          <b>已选学生</b>
          <p>{selectedNames.slice(0, 18).join("、") || "还未选择学生"}{selectedNames.length > 18 ? ` 等 ${selectedNames.length} 人` : ""}</p>
        </div>
        <button className="pointdesk-submit" disabled={!selected.length || value === 0} onClick={() => applyScore(selected)}>
          {selected.length ? `给 ${selected.length} 人${actionText}` : "请选择学生"}
        </button>
      </aside>
      <details className="pointdesk-events pointdesk-history">
        <summary><span><b>历史记录</b><small>{classEvents.length} 条，可撤销误操作</small></span><em>展开</em></summary>
        <div className="pointdesk-event-list">
          {recentEvents.map((event) => {
            const student = students.find((item) => item.id === event.studentId);
            return <article className={event.delta > 0 ? "pointdesk-event positive" : "pointdesk-event negative"} key={event.id}>
              <b>{event.delta > 0 ? "+" : ""}{event.delta}</b>
              <span>{student?.name ?? "其他班学生"}</span>
              <em>{event.scene} · {event.reason}</em>
              <small>{event.date}</small>
              <button onClick={() => undoEvent(event)}>撤销</button>
            </article>;
          })}
          {!classEvents.length && <div className="pointdesk-empty">还没有积分事件，提交后会出现在这里。</div>}
        </div>
      </details>
    </div>
  </section>;
}


function Rules({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [category, setCategory] = useState("全部");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"全部状态" | "启用" | "停用">("全部状态");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ scene: "学习", title: "", reason: "", delta: 1, owner: "班主任", level: "自定义" as PointRule["level"] });
  const [editingRule, setEditingRule] = useState<{ id: string; scene: string; title: string; reason: string; delta: number } | null>(null);
  const rules = pointRulesForData(data);
  const categories = ["全部", ...Array.from(new Set(rules.map((item) => item.scene)))];
  const visibleRules = rules.filter((item) => {
    const text = `${item.scene}${item.title}${item.reason}${item.owner}${item.delta}${item.detail ?? ""}`;
    const status = item.enabled === false ? "停用" : "启用";
    return (category === "全部" || item.scene === category) && (statusFilter === "全部状态" || statusFilter === status) && (!keyword.trim() || text.includes(keyword.trim()));
  });
  const activeRules = rules.filter((item) => item.enabled !== false);
  const usageFor = (item: PointRule) => pointRuleUsageCount(data.pointEvents ?? [], item);
  function editRule(id: string, patch: Partial<PointRule>) {
    update((d) => patchPointRule(d, id, patch));
  }
  function startEditRule(item: PointRule) {
    setEditingRule({ id: item.id, scene: item.scene, title: item.title, reason: item.reason, delta: item.delta });
  }
  function saveEditingRule() {
    if (!editingRule || !editingRule.title.trim() || !editingRule.reason.trim()) return;
    editRule(editingRule.id, {
      scene: editingRule.scene.trim() || "其他",
      title: editingRule.title.trim(),
      reason: editingRule.reason.trim(),
      delta: Number(editingRule.delta) || 0,
    });
    setEditingRule(null);
  }
  function addRule() {
    if (!draft.title.trim() || !draft.reason.trim()) return;
    const newRule: PointRule = { id: makeId(), scene: draft.scene.trim() || "其他", title: draft.title.trim(), reason: draft.reason.trim(), delta: Number(draft.delta) || 0, owner: draft.owner.trim() || "班主任", enabled: true, level: draft.level, detail: "由班主任自定义添加。" };
    update((d) => upsertPointRule(d, newRule));
    setDraft({ scene: "学习", title: "", reason: "", delta: 1, owner: "班主任", level: "自定义" });
    setCategory(newRule.scene);
    setShowForm(false);
  }
  function copyRule(item: PointRule) {
    const copied: PointRule = { ...item, id: makeId(), title: `${item.title} 副本`, enabled: true, level: "自定义" };
    update((d) => replacePointRules(d, [copied, ...pointRulesForData(d)]));
  }
  async function deleteRule(id: string) {
    const target = rules.find((item) => item.id === id);
    if (!target || !await requestDangerConfirm(`规则“${target.title}”会从规则库移除，历史积分记录不会删除。`)) return;
    update((d) => deletePointRule(d, id));
  }
  return <section className="rule-pro-page homework-bootstrap-preview">
    <WorkbenchPageHeader icon="📏" tone="marigold" title="班级积分规则库" description="统一维护班级加分、扣分规则，供积分评价页快速调用。" actions={<button className="ruledesk-add workbench-header-primary" onClick={() => setShowForm((value) => !value)}>{showForm ? "收起新增" : "添加规则"}</button>} />
    <div className="ruledesk-statusline"><b>{rules.length} 条规则</b><span>启用 {activeRules.length}</span><span>停用 {rules.length - activeRules.length}</span><span>历史记分 {data.pointEvents?.length ?? 0} 条</span></div>
    <section className="ruledesk-toolbar">
      <div>
        <b>筛选规则</b>
        <span>当前显示 {visibleRules.length} 条</span>
      </div>
      <label><span>关键词</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="规则、分类、理由或执行人" /></label>
      <label><span>分类</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label><span>状态</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option>全部状态</option><option>启用</option><option>停用</option></select></label>
    </section>
    {showForm && <section className="ruledesk-form">
      <header>
        <b>新增积分规则</b>
        <span>填写后会加入规则库，并可在积分评价页直接选择。</span>
      </header>
      <label><span>分类</span><input value={draft.scene} onChange={(event) => setDraft({ ...draft, scene: event.target.value })} /></label>
      <label><span>分值</span><input type="number" value={draft.delta} onChange={(event) => setDraft({ ...draft, delta: Number(event.target.value) })} /></label>
      <label className="wide"><span>规则名称</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="如：主动讲题" /></label>
      <label className="wide"><span>评价口径</span><input value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} placeholder="写清楚什么时候可以使用这条规则" /></label>
      <footer>
        <button onClick={() => setShowForm(false)}>取消</button>
        <button className="primary" disabled={!draft.title.trim() || !draft.reason.trim()} onClick={addRule}>保存规则</button>
      </footer>
    </section>}
    <section className="ruledesk-table">
      <div className="ruledesk-head">
        <span>状态</span>
        <span>分类</span>
        <span>分值</span>
        <span>规则名称</span>
        <span>评价口径</span>
        <span>使用</span>
        <span>操作</span>
      </div>
      {visibleRules.map((item) => {
        const isEditing = editingRule?.id === item.id;
        const rowDelta = isEditing ? editingRule.delta : item.delta;
        return <article className={`${item.enabled === false ? "ruledesk-row disabled" : "ruledesk-row"}${isEditing ? " editing" : ""}`} key={item.id}>
          <button className={item.enabled === false ? "ruledesk-status off" : "ruledesk-status on"} onClick={() => editRule(item.id, { enabled: item.enabled === false })}>{item.enabled === false ? "停用" : "启用"}</button>
          {isEditing ? <>
            <input value={editingRule.scene} onChange={(event) => setEditingRule({ ...editingRule, scene: event.target.value })} />
            <input className={rowDelta >= 0 ? "ruledesk-delta positive" : "ruledesk-delta negative"} type="number" value={editingRule.delta} onChange={(event) => setEditingRule({ ...editingRule, delta: Number(event.target.value) || 0 })} />
            <input className="ruledesk-title" value={editingRule.title} onChange={(event) => setEditingRule({ ...editingRule, title: event.target.value })} />
            <input value={editingRule.reason} onChange={(event) => setEditingRule({ ...editingRule, reason: event.target.value })} />
          </> : <>
            <span className="ruledesk-category">{item.scene}</span>
            <span className={item.delta >= 0 ? "ruledesk-delta positive" : "ruledesk-delta negative"}>{item.delta > 0 ? "+" : ""}{item.delta}</span>
            <strong className="ruledesk-title">{item.title}</strong>
            <span className="ruledesk-reason">{item.reason}</span>
          </>}
          <span className="ruledesk-usage">{usageFor(item)} 次</span>
          <div className="ruledesk-actions">
            {isEditing ? <>
              <button className="primary-text" disabled={!editingRule.title.trim() || !editingRule.reason.trim()} onClick={saveEditingRule}>保存</button>
              <button onClick={() => setEditingRule(null)}>取消</button>
            </> : <>
              <button onClick={() => startEditRule(item)}>编辑</button>
              <button onClick={() => copyRule(item)}>复制</button>
              <button className="danger" onClick={() => deleteRule(item.id)}>删除</button>
            </>}
          </div>
        </article>;
      })}
      {!visibleRules.length && <div className="ruledesk-empty">当前分类没有规则，可以切回全部或添加新规则。</div>}
    </section>
  </section>;
}

type GrowthKind = "沟通记录" | "积分表现" | "作业记录" | "老师补充";
type GrowthTime = "全部时间" | "近7天" | "近30天" | "本学期";
type GrowthTimelineItem = {
  id: string;
  kind: GrowthKind;
  label: string;
  title: string;
  content: string;
  followUp?: string;
  date: string;
  tone: "positive" | "attention" | "neutral";
  timestamp: number | null;
};

function growthTimestamp(value: string, createdAt?: number) {
  if (createdAt) return createdAt;
  const iso = value.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();
  const now = new Date();
  if (value.includes("今天") || value.includes("刚刚")) return now.getTime();
  if (value.includes("昨天")) return now.getTime() - 86400000;
  const weekDay = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"].findIndex((day) => value.includes(day));
  if (weekDay >= 0) {
    const current = now.getDay() === 0 ? 7 : now.getDay();
    return now.getTime() - (current - weekDay - 1) * 86400000;
  }
  return null;
}

function inGrowthRange(timestamp: number | null, range: GrowthTime, termStartTime?: number) {
  if (range === "全部时间") return true;
  if (!timestamp) return false;
  const now = new Date();
  if (range === "近7天") return timestamp >= now.getTime() - 7 * 86400000;
  if (range === "近30天") return timestamp >= now.getTime() - 30 * 86400000;
  if (termStartTime) return timestamp >= termStartTime;
  const month = now.getMonth() + 1;
  const start = month >= 8 ? new Date(now.getFullYear(), 7, 1) : month >= 2 ? new Date(now.getFullYear(), 1, 1) : new Date(now.getFullYear() - 1, 7, 1);
  return timestamp >= start.getTime();
}

function Growth({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [id, setId] = useState(data.students[0]?.id ?? "");
  const [keyword, setKeyword] = useState("");
  const [groupFilter, setGroupFilter] = useState("全部小组");
  const [studentStatusFilter, setStudentStatusFilter] = useState<"全部状态" | "需要跟进" | "表现良好" | "整体稳定">("全部状态");
  const [coverageFilter, setCoverageFilter] = useState<"全部记录" | "有记录" | "暂无记录">("全部记录");
  const [studentSort, setStudentSort] = useState<"默认排序" | "记录多优先" | "积分低优先" | "成绩低优先">("默认排序");
  const [kind, setKind] = useState<"全部类型" | GrowthKind>("全部类型");
  const [range, setRange] = useState<GrowthTime>("全部时间");
  const [page, setPage] = useState(1);
  const [showComposer, setShowComposer] = useState(false);
  const [formError, setFormError] = useState("");
  const [copyState, setCopyState] = useState("复制成长摘要");
  const [draft, setDraft] = useState({ date: today(), type: "表扬记录", title: "", content: "", followUp: "" });
  const student = data.students.find((item) => item.id === id) ?? data.students[0];
  if (!student) return <div className="growth2-empty first"><b>先建立学生名单</b><span>成长档案会复用学生名单；导入名单后即可自动归集记录。</span></div>;

  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id;
  const termBounds = scheduleTermRange(data.scheduleConfig);
  const records = data.records.filter((record) => recordBelongsToStudent(record, student, activeClassId ?? "class-1"));
  const events = (data.pointEvents ?? []).filter((event) => event.studentId === student.id);
  const tasks = (data.homeworkTasks ?? []).filter((task) => !task.classId || task.classId === activeClassId);
  const homework = tasks.map((task) => ({ task, status: task.statuses[student.id] ?? student.homework }));
  const manual = growthEvidenceForStudent(data, activeClassId ?? "class-1", student.id);
  const homeworkDone = homework.filter(({ status }) => status === "已交" || status === "已复查").length;
  const homeworkRate = homework.length ? Math.round(homeworkDone / homework.length * 100) : 0;
  const positiveEvents = events.filter((event) => event.delta > 0);
  const negativeEvents = events.filter((event) => event.delta < 0);
  const cadre = (data.cadres ?? []).find((role) => role.studentId === student.id);
  const status = student.score < 80 || student.homework !== "已交" || student.attendance !== "正常" || negativeEvents.length > positiveEvents.length
    ? "需要跟进"
    : student.score >= 90 || student.points >= 18 ? "表现良好" : "整体稳定";
  const statusTone = status === "需要跟进" ? "attention" : status === "表现良好" ? "positive" : "steady";
  const studentEvidenceCount = (item: Student) => {
    const hasManual = growthEvidenceForStudent(data, activeClassId ?? "class-1", item.id).length;
    const hasPoints = (data.pointEvents ?? []).filter((event) => event.studentId === item.id).length;
    const hasRecords = data.records.filter((record) => recordBelongsToStudent(record, item, activeClassId ?? "class-1")).length;
    const homeworkCount = tasks.filter((task) => task.statuses[item.id]).length;
    return hasManual + hasPoints + hasRecords + homeworkCount;
  };
  const studentStatusFor = (item: Student) => {
    const itemEvents = (data.pointEvents ?? []).filter((event) => event.studentId === item.id);
    const itemPositive = itemEvents.filter((event) => event.delta > 0).length;
    const itemNegative = itemEvents.filter((event) => event.delta < 0).length;
    if (item.score < 80 || item.homework !== "已交" || item.attendance !== "正常" || itemNegative > itemPositive) return "需要跟进";
    if (item.score >= 90 || item.points >= 18) return "表现良好";
    return "整体稳定";
  };
  const groupOptions = Array.from(new Set(data.students.map((item) => item.group))).sort((a, b) => a - b);
  const attentionCount = data.students.filter((item) => studentStatusFor(item) === "需要跟进").length;
  const noEvidenceCount = data.students.filter((item) => studentEvidenceCount(item) === 0).length;
  const keywordText = keyword.trim().toLocaleLowerCase("zh-CN");
  const shownStudents = data.students
    .filter((item) => !keywordText || `${item.name}${item.studentNo ?? ""}${item.group}${item.score}${item.points}`.toLocaleLowerCase("zh-CN").includes(keywordText))
    .filter((item) => groupFilter === "全部小组" || String(item.group) === groupFilter)
    .filter((item) => studentStatusFilter === "全部状态" || studentStatusFor(item) === studentStatusFilter)
    .filter((item) => coverageFilter === "全部记录" || (coverageFilter === "有记录" ? studentEvidenceCount(item) > 0 : studentEvidenceCount(item) === 0))
    .sort((a, b) => {
      if (studentSort === "记录多优先") return studentEvidenceCount(b) - studentEvidenceCount(a);
      if (studentSort === "积分低优先") return a.points - b.points;
      if (studentSort === "成绩低优先") return a.score - b.score;
      return 0;
    });

  const evidence: GrowthTimelineItem[] = [
    ...manual.map((item) => ({ id: `manual-${item.id}`, kind: "老师补充" as const, label: item.type, title: item.title, content: item.content, followUp: item.followUp, date: item.date, tone: item.type.includes("表扬") || item.type.includes("进步") ? "positive" as const : "neutral" as const, timestamp: growthTimestamp(item.date, item.createdAt) })),
    ...records.map((record) => ({ id: `record-${record.id}`, kind: "沟通记录" as const, label: record.type, title: record.type.includes("表扬") || record.type.includes("成长") ? "积极表现记录" : "沟通与跟进记录", content: record.content, date: record.date, tone: record.type.includes("表扬") || record.type.includes("成长") ? "positive" as const : "neutral" as const, timestamp: growthTimestamp(record.date) })),
    ...events.map((event) => ({ id: `event-${event.id}`, kind: "积分表现" as const, label: event.scene, title: `${event.delta > 0 ? "+" : ""}${event.delta} 积分`, content: event.reason, date: event.date, tone: event.delta > 0 ? "positive" as const : "attention" as const, timestamp: growthTimestamp(event.date) })),
    ...homework.map(({ task, status: taskStatus }) => ({ id: `homework-${task.id}`, kind: "作业记录" as const, label: task.subject, title: task.title, content: `完成状态：${taskStatus}`, date: task.date, tone: taskStatus === "已交" || taskStatus === "已复查" ? "positive" as const : "attention" as const, timestamp: growthTimestamp(task.date) })),
  ].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  const filteredEvidence = evidence.filter((item) => (kind === "全部类型" || item.kind === kind) && inGrowthRange(item.timestamp, range, termBounds.startTime));
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredEvidence.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleEvidence = filteredEvidence.slice((safePage - 1) * pageSize, safePage * pageSize);
  const strengths = [
    student.score >= 90 ? "学习表现稳定优秀" : student.score >= 80 ? "学习基础较稳定" : "已经形成明确的学习帮扶方向",
    student.points >= 18 ? "日常表现有较多正向积累" : student.points >= 14 ? "日常表现稳步积累" : "需要增加具体、及时的正向反馈",
    homeworkRate >= 90 ? "作业完成习惯良好" : homeworkRate >= 70 ? "多数作业能够完成" : "作业提交与订正闭环需要加强",
  ];
  const followUps = [
    student.score < 80 ? "安排一次错题复盘或学习谈话，并记录具体困难。" : "保持当前学习节奏，补充一条可观察的进步事实。",
    student.attendance !== "正常" ? `跟进考勤状态：${student.attendance}。` : "考勤状态正常，继续保持。",
    homework.some(({ status: taskStatus }) => taskStatus === "未交" || taskStatus === "待订正") ? "完成未交或待订正作业的复查闭环。" : "作业暂无待处理事项。",
    records.length + manual.length === 0 ? "补充一次谈心、家访、表扬或课堂观察记录。" : "根据最近一条证据安排下次观察或回访。",
  ];
  const summary = `${student.name}：当前${status}。成绩${student.score}分，积分${student.points}分，作业完成率${homeworkRate}%，已沉淀${evidence.length}条成长证据。优势：${strengths.join("；")}。下一步：${followUps[0]}`;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlyEvidence = evidence.filter((item) => item.timestamp && item.timestamp >= monthStart.getTime()).length;
  const studentsWithEvidence = data.students.filter((item) => studentEvidenceCount(item) > 0).length;

  function selectStudent(studentId: string) {
    setId(studentId); setPage(1); setShowComposer(false); setFormError("");
  }
  function saveEvidence() {
    if (!draft.date || !draft.title.trim() || !draft.content.trim()) { setFormError("请填写日期、简短标题和具体事实。"); return; }
    update((current) => addGrowthEvidence(current, activeClassId ?? "class-1", student.id, draft, makeId).data ?? current);
    setDraft({ date: today(), type: "表扬记录", title: "", content: "", followUp: "" });
    setFormError(""); setKind("全部类型"); setRange("全部时间"); setPage(1); setShowComposer(false);
  }
  async function copySummary() {
    const copied = await copyTextToClipboard(summary, "已复制成长摘要");
    if (copied) {
      setCopyState("已复制");
      window.setTimeout(() => setCopyState("复制成长摘要"), 1600);
    }
  }

  return <div className="growth2-page homework-bootstrap-preview">
    <WorkbenchPageHeader icon="🌱" tone="jade" title="学生成长记录" description="选择学生，记录可观察的成长事实与后续跟进。" actions={<div className="growth2-actions"><button className="primary workbench-header-primary" onClick={() => setShowComposer(true)}>为{student.name}添加记录</button><details className="growth2-more-actions"><summary>更多</summary><button onClick={copySummary}>{copyState}</button><button onClick={() => window.print()}>导出素材</button></details></div>} />
    <section className="campus-statistics" aria-label="成长档案统计">
      <div><span>当前学生记录</span><b>{evidence.length}</b><small>自动汇入与手动补充</small></div>
      <div><span>全班覆盖</span><b>{studentsWithEvidence}</b><small>{data.students.length} 名学生</small></div>
      <div><span>需要跟进</span><b>{attentionCount}</b><small>按成绩、作业、考勤判断</small></div>
    </section>
    <section className="growth2-toolbar" aria-label="成长档案筛选">
      <label className="growth2-search"><span>搜索学生</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="姓名、学号、分组、成绩或积分" /></label>
      <label><span>状态</span><select value={studentStatusFilter} onChange={(event) => setStudentStatusFilter(event.target.value as typeof studentStatusFilter)}>{["全部状态", "需要跟进", "表现良好", "整体稳定"].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>记录</span><select value={coverageFilter} onChange={(event) => setCoverageFilter(event.target.value as typeof coverageFilter)}>{["全部记录", "有记录", "暂无记录"].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>排序</span><select value={studentSort} onChange={(event) => setStudentSort(event.target.value as typeof studentSort)}>{["默认排序", "记录多优先", "积分低优先", "成绩低优先"].map((item) => <option key={item}>{item}</option>)}</select></label>
      <div className="growth2-toolbar-actions">
        <button onClick={() => { setStudentStatusFilter("需要跟进"); setCoverageFilter("全部记录"); }}>需跟进 {attentionCount}</button>
        <button onClick={() => { setCoverageFilter("暂无记录"); setStudentStatusFilter("全部状态"); }}>暂无记录 {noEvidenceCount}</button>
        <button onClick={() => { setKeyword(""); setGroupFilter("全部小组"); setStudentStatusFilter("全部状态"); setCoverageFilter("全部记录"); setStudentSort("默认排序"); }}>重置</button>
      </div>
    </section>
    <section className="growth2-layout">
      <aside className="growth2-panel growth2-student-panel">
        <header className="growth2-panel-head">
          <div><b>学生名单</b><span>{shownStudents.length}/{data.students.length}</span></div>
          <p>点击表格行切换当前学生</p>
        </header>
        <div className="growth2-groupbar" aria-label="按小组筛选">
          <button className={groupFilter === "全部小组" ? "active" : ""} onClick={() => setGroupFilter("全部小组")}>全部</button>
          {groupOptions.map((group) => <button className={groupFilter === String(group) ? "active" : ""} key={group} onClick={() => setGroupFilter(String(group))}>第{group}组</button>)}
        </div>
        <div className="growth2-table-wrap growth2-student-table-wrap">
          <table className="growth2-table">
            <thead><tr><th>姓名</th><th>状态</th><th>证据</th></tr></thead>
            <tbody>{shownStudents.map((item) => {
              const itemStatus = studentStatusFor(item);
              const itemEvidenceCount = studentEvidenceCount(item);
              return <tr className={item.id === student.id ? "selected" : ""} key={item.id} onClick={() => selectStudent(item.id)}>
                <td><button className="growth2-link-cell" onClick={(event) => { event.stopPropagation(); selectStudent(item.id); }}><b>{item.name}</b><small>第{item.group}组 · 学号 {item.studentNo || "未填"}</small></button></td>
                <td><span className={`growth2-badge ${itemStatus === "需要跟进" ? "warning" : itemStatus === "表现良好" ? "success" : "secondary"}`}>{itemStatus}</span></td>
                <td><span className="growth2-count">{itemEvidenceCount}</span></td>
              </tr>;
            })}</tbody>
          </table>
          {!shownStudents.length && <div className="growth2-empty">没有匹配的学生，换个筛选条件试试。</div>}
        </div>
      </aside>
      <main className="growth2-main">
        <section className="growth2-overview">
          <header className="growth2-profile-head">
            <div className="growth2-profile-main">
              <div className="growth2-avatar">{student.name.slice(0, 1)}</div>
              <div className="growth2-profile-copy">
                <span>当前学生</span>
                <h3>{student.name}</h3>
                <p>第{student.group}组 · 学号 {student.studentNo || "未填"} · {cadre ? cadre.role : "暂无班干部职务"}</p>
              </div>
              <span className={`growth2-badge large ${statusTone === "attention" ? "warning" : statusTone === "positive" ? "success" : "primary"}`}>{status}</span>
            </div>
            <div className="growth2-stat-row">
              <span><b>{student.score}</b><small>成绩</small></span>
              <span><b>{student.points}</b><small>积分</small></span>
              <span><b>{homeworkRate}%</b><small>作业完成</small></span>
              <span><b>{records.length}</b><small>沟通记录</small></span>
            </div>
          </header>
          <div className="growth2-insights">
            <section className="growth2-insight-main"><header><b>成长摘要</b><button onClick={copySummary}>{copyState}</button></header><p>{summary}</p></section>
            <section><header><b>优势观察</b></header><ul>{strengths.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section><header><b>后续跟进</b></header><ul>{followUps.map((item) => <li key={item}>{item}</li>)}</ul></section>
          </div>
        </section>
        {showComposer && <div className="growth2-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowComposer(false); }}><section className="growth2-composer" role="dialog" aria-modal="true" aria-labelledby="growth-composer-title">
          <header><b id="growth-composer-title">添加成长记录 · {student.name}</b><span>记录具体事实，不写空泛评价。</span></header>
          <label><span>日期</span><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
          <label><span>类型</span><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>{["学习", "活动", "荣誉", "日常", "进步", "表扬记录"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="wide"><span>标题</span><input value={draft.title} maxLength={40} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="如：作文获奖" /></label>
          <label className="wide"><span>内容描述</span><textarea value={draft.content} maxLength={500} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="记录具体事实、作品表现或老师观察。" /></label>
          <label className="wide"><span>后续观察点</span><textarea value={draft.followUp} maxLength={300} onChange={(event) => setDraft({ ...draft, followUp: event.target.value })} placeholder="如：下周继续观察课堂发言。" rows={3} /></label>
          {formError && <p className="growth2-error">{formError}</p>}
          <footer><button onClick={() => setShowComposer(false)}>取消</button><button className="primary" onClick={saveEvidence}>保存成长记录</button></footer>
        </section></div>}
        <section className="growth2-panel growth2-record-panel">
          <header className="growth2-panel-head">
            <div><b>成长记录表</b><span>{filteredEvidence.length} 条记录</span></div>
          </header>
          <div className="growth2-record-toolbar">
            <label><span>时间</span><select value={range} onChange={(event) => { setRange(event.target.value as GrowthTime); setPage(1); }}>{["全部时间", "近7天", "近30天", "本学期"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>类型</span><select value={kind} onChange={(event) => { setKind(event.target.value as "全部类型" | GrowthKind); setPage(1); }}>{["全部类型", "沟通记录", "积分表现", "作业记录", "老师补充"].map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          <div className="growth2-table-wrap">
            <table className="growth2-table growth2-record-table">
              <thead><tr><th className="sortable">日期</th><th>类型</th><th>标题</th><th>内容</th><th>后续措施</th></tr></thead>
              <tbody>{visibleEvidence.map((item) => <tr className={item.tone} key={item.id}>
                <td><time>{item.date}</time></td>
                <td><span className={`growth2-badge ${item.tone === "attention" ? "warning" : item.tone === "positive" ? "success" : "secondary"}`}>{item.kind}</span><small>{item.label}</small></td>
                <td><b>{item.title}</b></td>
                <td><p>{item.content}</p></td>
                <td>{item.followUp ? <span>{item.followUp}</span> : <em>无</em>}</td>
              </tr>)}</tbody>
            </table>
            {!visibleEvidence.length && <div className="growth2-empty">{evidence.length ? "当前筛选条件下没有记录。" : "还没有成长记录，先添加第一条。"}</div>}
          </div>
          {filteredEvidence.length > pageSize && <div className="growth2-pagination"><button disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>上一页</button><span>第 {safePage} / {pageCount} 页</span><button disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>下一页</button></div>}
        </section>
      </main>
    </section>
  </div>;
}

function Weekly({ data, update, readOnly }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; readOnly: boolean }) {
  type WeeklyView = "overview" | "editor" | "archive";
  type DetailPanel = "stars" | "progress" | "follow" | "groups" | "records" | null;
  const classes = data.rosterClasses?.length ? data.rosterClasses : [{ id: data.activeClassId ?? "class-1", name: "当前班级", grade: "", term: "", students: data.students }];
  const currentClassId = data.activeClassId && classes.some((item) => item.id === data.activeClassId) ? data.activeClassId : classes[0].id;
  const [view, setView] = useState<WeeklyView>("overview");
  const [weekOffset, setWeekOffset] = useState(0);
  const [edition, setEdition] = useState<"家长版" | "教师版">("家长版");
  const [detailPanel, setDetailPanel] = useState<DetailPanel>(null);
  const [followFilter, setFollowFilter] = useState<"全部" | "作业" | "成绩" | "考勤">("全部");
  const [copied, setCopied] = useState(false);
  const [savedState, setSavedState] = useState("");
  const [customDraft, setCustomDraft] = useState("");
  const [draftTouched, setDraftTouched] = useState(false);
  const [reportTitle, setReportTitle] = useState("班级周报");
  const [nextFocus, setNextFocus] = useState("");
  const [archiveClass, setArchiveClass] = useState("全部班级");
  const [archiveEdition, setArchiveEdition] = useState("全部版本");
  const [archiveSearch, setArchiveSearch] = useState("");
  const [archivePage, setArchivePage] = useState(1);
  const [previewReportId, setPreviewReportId] = useState<string | null>(null);

  const currentMonday = new Date();
  const currentDay = currentMonday.getDay() || 7;
  currentMonday.setDate(currentMonday.getDate() - currentDay + 1);
  currentMonday.setHours(0, 0, 0, 0);
  const monday = new Date(currentMonday);
  monday.setDate(monday.getDate() + weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const iso = (date: Date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  const shortDate = (date: Date) => (date.getMonth() + 1) + "月" + date.getDate() + "日";
  const weekStart = iso(monday);
  const weekEnd = iso(sunday);
  const weekNumber = Math.ceil((((monday.getTime() - new Date(monday.getFullYear(), 0, 1).getTime()) / 86400000) + new Date(monday.getFullYear(), 0, 1).getDay() + 1) / 7);
  const weekChoices = Array.from({ length: 13 }, (_, index) => {
    const offset = -index;
    const optionMonday = new Date(currentMonday);
    optionMonday.setDate(optionMonday.getDate() + offset * 7);
    const optionSunday = new Date(optionMonday);
    optionSunday.setDate(optionSunday.getDate() + 6);
    const label = shortDate(optionMonday) + " 至 " + shortDate(optionSunday);
    return { offset, label };
  });
  const selectedClass = classes.find((item) => item.id === currentClassId) ?? classes[0];
  const students = selectedClass.students;
  const className = selectedClass.name;
  const weekTasks = (data.homeworkTasks ?? []).filter((task) => task.classId === currentClassId && task.date >= weekStart && task.date <= weekEnd);
  const homeworkMetrics = weeklyHomeworkMetrics(weekTasks, students);
  const averageScore = students.length ? Math.round(students.reduce((sum, student) => sum + student.score, 0) / students.length) : 0;
  const reportPointEvents = weeklyPointEventsForClass(data, currentClassId, students, weekStart, weekEnd);
  const positiveEvents = reportPointEvents.filter((event) => event.delta > 0);
  const positiveRows = weeklyPositiveRows(reportPointEvents, students);
  const stars = positiveRows.slice(0, 4).map((item) => item.student);
  const progress = positiveRows.slice(4, 12).map((item) => ({ student: item.student, delta: item.delta, evidence: item.reason }));
  const follow = weeklyFollowRows(data, currentClassId, students, weekTasks, weekStart, weekEnd);
  const weeklyScoreExamCount = scoreExamsForClass(data, currentClassId).filter((exam) => isDatedWithin(exam.date, weekStart, weekEnd)).length;
  const weeklyAttendanceCount = (data.attendanceRecords ?? []).filter((record) => (!record.classId || record.classId === currentClassId) && isDatedWithin(record.date, weekStart, weekEnd)).length;
  const filteredFollow = follow.filter((item) => followFilter === "全部" || item.reasons.some((reason) => reason.kind === followFilter));
  const groupStats = [...new Set(students.map((student) => student.group))].sort((a, b) => a - b).map((group) => {
    const groupStudents = students.filter((student) => student.group === group);
    const points = groupStudents.reduce((sum, student) => sum + student.points, 0);
    const unresolved = weekTasks.reduce((count, task) => count + groupStudents.filter((student) => {
      const status = task.statuses[student.id] ?? "";
      return status === "未交" || status === "待订正";
    }).length, 0);
    return { group, students: groupStudents.length, points, average: groupStudents.length ? Math.round(points / groupStudents.length) : 0, unresolved };
  }).sort((a, b) => b.average - a.average);
  const classRecords = data.records.filter((record) => recordBelongsToClass(record, currentClassId, students));
  const reportRecords = weeklyActivityRows(data, currentClassId, students, classRecords, weekStart, weekEnd);
  const defaultPlan = (data.weeklyPlan ?? []).map((item) => item.day + "：" + item.focus + " · " + item.event).join("\n");
  const allReports = [...(data.weeklyReports ?? [])].sort((a, b) => b.weekStart.localeCompare(a.weekStart) || b.updatedAt.localeCompare(a.updatedAt));
  const currentSavedReport = allReports.find((report) => report.classId === currentClassId && report.weekStart === weekStart && report.edition === edition);
  const defaultTitle = className + " · 第" + weekNumber + "周班级周报";

  useEffect(() => {
    const saved = (data.weeklyReports ?? []).find((report) => report.classId === currentClassId && report.weekStart === weekStart && report.edition === edition);
    setReportTitle(saved?.title ?? defaultTitle);
    setNextFocus(saved?.nextFocus ?? defaultPlan);
    setCustomDraft("");
    setDraftTouched(false);
    setSavedState("");
  }, [currentClassId, weekStart, edition, data.weeklyReports, defaultPlan, defaultTitle]);

  const generatedText = [
    reportTitle || defaultTitle,
    shortDate(monday) + " 至 " + shortDate(sunday),
    "【本周概况】",
    "本周记录 " + weekTasks.length + " 项作业，已记录人次完成率 " + homeworkMetrics.completionRate + "%；班级当前平均分 " + averageScore + " 分，记录 " + positiveEvents.length + " 次正向表现。",
    "【值得表扬】",
    positiveRows.length ? positiveRows.slice(0, 4).map((item) => item.student.name + "（本周 +" + item.delta + "，" + item.reason + "）").join("、") + "。" : "本周暂无带日期的正向积分记录。",
    "【其他正向记录】",
    progress.length ? progress.slice(0, 4).map((item) => item.student.name + "（" + item.evidence + "）").join("、") + "。" : "本周没有更多带日期的正向积分记录。",
    edition === "家长版" ? "【温馨提醒】\n已有记录中仍有 " + homeworkMetrics.missing + " 人次未交、" + homeworkMetrics.fixing + " 人次待订正，请家长协助孩子及时完成学习闭环。" : "【重点跟进】\n" + (follow.length ? follow.map((item) => item.student.name + "（" + item.reasons.map((reason) => reason.text).join("、") + "）").join("；") + "。" : "本周暂无有日期依据的重点跟进学生。"),
    reportRecords.length ? "【家校与成长记录】\n" + reportRecords.slice(0, 5).map((record) => record.student + "：" + record.content).join("\n") : "",
    "【下周行动】",
    nextFocus.trim() || "继续关注作业习惯、课堂参与和自我管理。",
  ].join("\n\n");
  const draftContent = draftTouched ? customDraft : currentSavedReport?.content ?? generatedText;
  const filteredReports = allReports.filter((report) => {
    const targetClass = classes.find((item) => item.id === report.classId);
    const keyword = archiveSearch.trim().toLowerCase();
    return (archiveClass === "全部班级" || report.classId === archiveClass)
      && (archiveEdition === "全部版本" || report.edition === archiveEdition)
      && (!keyword || (report.title ?? "").toLowerCase().includes(keyword) || (targetClass?.name ?? "").toLowerCase().includes(keyword) || report.content.toLowerCase().includes(keyword));
  });
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(filteredReports.length / pageSize));
  const safeArchivePage = Math.min(archivePage, pageCount);
  const pageReports = filteredReports.slice((safeArchivePage - 1) * pageSize, safeArchivePage * pageSize);
  const previewReport = allReports.find((report) => report.id === previewReportId);
  const previewClass = previewReport ? classes.find((item) => item.id === previewReport.classId) : undefined;

  function shiftWeek(delta: number) {
    setWeekOffset((current) => current + delta);
  }

  async function copyText(text: string) {
    const copied = await copyTextToClipboard(text, "已复制周报正文");
    if (copied) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  function saveReport(status: "草稿" | "已归档") {
    if (readOnly) {
      setSavedState("当前为只读模式，周报内容未修改");
      return;
    }
    const nowText = new Date().toISOString();
    const reportId = currentSavedReport?.id ?? makeId();
    const input = { id: reportId, weekStart, weekEnd, edition, title: reportTitle.trim() || defaultTitle, content: draftContent, nextFocus };
    const preview = saveWeeklyReport(data, currentClassId, input, status, () => reportId, nowText);
    if (preview.error) {
      setSavedState(preview.error);
      return;
    }
    update((current) => saveWeeklyReport(current, currentClassId, input, status, () => reportId, nowText).data ?? current);
    setDraftTouched(false);
    setSavedState(status === "已归档" ? "已归档，正在同步" : "草稿已更新，正在同步");
    if (status === "已归档") {
      setArchivePage(1);
      setView("archive");
    }
  }

  function switchToClass(id: string) {
    const nextClass = classes.find((item) => item.id === id);
    if (!nextClass || id === currentClassId) return;
    update((current) => ({ ...current, activeClassId: id, students: nextClass.students }));
  }

  function openSavedReport(report: NonNullable<ClassroomData["weeklyReports"]>[number]) {
    const offset = Math.round((new Date(report.weekStart + "T00:00:00").getTime() - currentMonday.getTime()) / 604800000);
    switchToClass(report.classId);
    setWeekOffset(offset);
    setEdition(report.edition);
    setView("editor");
    setPreviewReportId(null);
  }

  const detailTitles: Record<Exclude<DetailPanel, null>, string> = {
    stars: "优秀学生排行榜",
    progress: "本周其他正向记录",
    follow: "需要跟进的学生",
    groups: "小组表现明细",
    records: "本周成长记录",
  };

  return <div className="weekreport-page homework-bootstrap-preview">
    <WorkbenchPageHeader icon="🗞️" tone="lake" title="周报工作台" description="按周汇总作业、积分、成长记录和跟进名单，生成可编辑、可归档的班级周报。" actions={<button className="weekreport-primary workbench-header-primary" onClick={() => { setWeekOffset(0); setView("editor"); }}>新建本周周报</button>} />

    <section className="weekreport-toolbar workbench-page-context">
      <nav className="weekreport-tabs" aria-label="周报页面">
        <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>概览</button>
        <button className={view === "editor" ? "active" : ""} onClick={() => setView("editor")}>编辑周报</button>
        <button className={view === "archive" ? "active" : ""} onClick={() => setView("archive")}>周报库</button>
      </nav>
      <div className="weekreport-fields">
        <div className="weekreport-current"><span>当前班级</span><b>{className}</b><small>班级管理在左侧统一处理</small></div>
        <label><span>周次</span><select value={weekOffset} onChange={(event) => setWeekOffset(Number(event.target.value))}>{weekChoices.map((item) => <option key={item.offset} value={item.offset}>{item.label}</option>)}</select></label>
        <div className="weekreport-toolbar-actions"><button onClick={() => shiftWeek(-1)}>上一周</button><button disabled={weekOffset >= 0} onClick={() => shiftWeek(1)}>下一周</button></div>
      </div>
    </section>

    {view === "overview" && <section className="weekreport-workspace">
      <section className="campus-statistics"><div><span>本周作业</span><b>{weekTasks.length}</b><small>{homeworkMetrics.recorded ? `${homeworkMetrics.submitted}/${homeworkMetrics.recorded} 已记录人次完成` : "暂无逐生状态记录"}</small></div><div><span>已记录完成率</span><b>{homeworkMetrics.completionRate}%</b><small>{homeworkMetrics.missing} 未交 · {homeworkMetrics.fixing} 待订正{homeworkMetrics.recorded < homeworkMetrics.expected ? ` · ${homeworkMetrics.expected - homeworkMetrics.recorded} 未记录` : ""}</small></div><div><span>待跟进学生</span><b>{follow.length}</b><small>{positiveEvents.length} 条正向表现</small></div></section>

      <section className="weekreport-status">
        <div>
          <span>第 {weekNumber} 周</span>
          <h2>{className}</h2>
          <p>{shortDate(monday)} 至 {shortDate(sunday)} · {currentSavedReport ? `${currentSavedReport.status ?? "草稿"} · 更新于 ${new Date(currentSavedReport.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "尚未保存，系统已根据现有数据生成素材"}</p>
        </div>
        <button className="weekreport-primary" onClick={() => setView("editor")}>{currentSavedReport ? "继续编辑" : "开始写周报"}</button>
      </section>

      <section className="weekreport-section">
        <header className="weekreport-section-head"><div><b>本周关注学生</b><span>优秀、进步和待跟进名单集中展示</span></div><button onClick={() => setDetailPanel("follow")}>查看跟进名单</button></header>
        <div className="weekreport-table-wrap">
          <table className="weekreport-table">
            <thead><tr><th>类型</th><th>学生</th><th>依据</th><th>本周数据</th><th>操作</th></tr></thead>
            <tbody>
              {stars.slice(0, 4).map((student, index) => <tr key={`star-${student.id}`}>
                <td><span className="weekreport-badge success">优秀</span></td>
                <td><b>{student.name}</b><small>排名 {index + 1}</small></td>
                <td>{positiveRows.find((item) => item.student.id === student.id)?.reason}</td>
                <td><strong>+{positiveRows.find((item) => item.student.id === student.id)?.delta}</strong> 分</td>
                <td><button className="weekreport-link" onClick={() => setDetailPanel("stars")}>明细</button></td>
              </tr>)}
              {progress.slice(0, 3).map((item) => <tr key={`progress-${item.student.id}`}>
                <td><span className="weekreport-badge primary">正向</span></td>
                <td><b>{item.student.name}</b><small>带日期积分记录</small></td>
                <td>{item.evidence}</td>
                <td><strong>+{item.delta}</strong> 分</td>
                <td><button className="weekreport-link" onClick={() => setDetailPanel("progress")}>明细</button></td>
              </tr>)}
              {follow.slice(0, 3).map((item) => <tr key={`follow-${item.student.id}`}>
                <td><span className="weekreport-badge warning">跟进</span></td>
                <td><b>{item.student.name}</b><small>{item.reasons.length} 项提醒</small></td>
                <td>{item.reasons.map((reason) => reason.text).join("；")}</td>
                <td><strong>{item.reasons.length}</strong> 项</td>
                <td><button className="weekreport-link" onClick={() => setDetailPanel("follow")}>名单</button></td>
              </tr>)}
            </tbody>
          </table>
          {!stars.length && !progress.length && !follow.length && <div className="weekreport-empty">当前周次暂无可汇总数据。</div>}
        </div>
      </section>

      <section className="weekreport-grid">
        <section className="weekreport-section">
          <header className="weekreport-section-head"><div><b>小组当前表现</b><span>按当前人均积分排序</span></div><button onClick={() => setDetailPanel("groups")}>完整统计</button></header>
          <div className="weekreport-table-wrap compact">
            <table className="weekreport-table">
              <thead><tr><th>当前排名</th><th>小组</th><th>人数</th><th>当前人均积分</th><th>作业待办</th></tr></thead>
              <tbody>{groupStats.slice(0, 5).map((item, index) => <tr key={item.group}><td>{index + 1}</td><td>第{item.group}组</td><td>{item.students}</td><td><strong>{item.average}</strong></td><td><span className={`weekreport-badge ${item.unresolved ? "warning" : "secondary"}`}>{item.unresolved ? `${item.unresolved} 人次` : "已清零"}</span></td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="weekreport-section">
          <header className="weekreport-section-head"><div><b>成长记录</b><span>来自家校沟通和成长档案</span></div><button onClick={() => setDetailPanel("records")}>查看记录</button></header>
          <div className="weekreport-table-wrap compact">
            <table className="weekreport-table">
              <thead><tr><th>学生</th><th>类型</th><th>内容</th></tr></thead>
              <tbody>{reportRecords.slice(0, 4).map((record) => <tr key={record.id}><td><b>{record.student}</b><small>{record.date}</small></td><td><span className="weekreport-badge secondary">{record.type}</span></td><td>{record.content}</td></tr>)}</tbody>
            </table>
            {!reportRecords.length && <div className="weekreport-empty">本周暂无成长记录。</div>}
          </div>
        </section>
      </section>
    </section>}

    {view === "editor" && <section className="weekreport-editor">
      <aside className="weekreport-editor-side">
        <section>
          <span>当前编辑</span>
          <h3>{className}</h3>
          <p>{shortDate(monday)} 至 {shortDate(sunday)}</p>
          <em className={currentSavedReport?.status === "已归档" ? "done" : ""}>{currentSavedReport?.status ?? "未保存"}</em>
        </section>
        <section>
          <span>周报版本</span>
          <div className="weekreport-edition">{(["家长版", "教师版"] as const).map((item) => <button className={edition === item ? "active" : ""} key={item} onClick={() => setEdition(item)}><b>{item}</b><small>{item === "家长版" ? "适合班级群，不公开名单" : "保留详细跟进信息"}</small></button>)}</div>
        </section>
        <section className="weekreport-source"><span>自动汇总来源</span><p>作业记录 <b>{weekTasks.length} 项</b></p><p>积分记录 <b>{reportPointEvents.length} 条</b></p><p>成长记录 <b>{reportRecords.length} 条</b></p><p>成绩与考勤 <b>{weeklyScoreExamCount} 场 / {weeklyAttendanceCount} 条</b></p></section>
        <button onClick={() => { setCustomDraft(generatedText); setDraftTouched(true); setSavedState(""); }}>按当前数据重新生成</button>
      </aside>
      <main className="weekreport-editor-main">
        <section className="weekreport-title-row">
          <label><span>周报标题</span><input value={reportTitle} onChange={(event) => { setReportTitle(event.target.value); setSavedState(""); }} /></label>
          <div><span>{draftContent.length} 字</span><span>{edition}</span></div>
        </section>
        <section className="weekreport-writing">
          <header><div><b>周报正文</b><span>自动生成只是起点，老师可以自由增删</span></div></header>
          <textarea aria-label="周报正文" value={draftContent} onChange={(event) => { setCustomDraft(event.target.value); setDraftTouched(true); setSavedState(""); }} />
        </section>
        <section className="weekreport-writing action">
          <header><div><b>下周行动</b><span>写清时间、对象、动作和复查节点</span></div><button onClick={() => setNextFocus("周一｜检查作业订正，重点关注未完成学生\n周三｜与重点学生进行一次简短谈话并记录\n周五｜复盘小组表现，确定下周表扬与跟进名单")}>插入模板</button></header>
          <textarea aria-label="下周行动计划" value={nextFocus} onChange={(event) => { setNextFocus(event.target.value); setSavedState(""); }} placeholder={"周一｜检查上周订正完成情况\n周三｜联系重点学生家长并记录沟通结果\n周五｜复盘小组积分与本周行动"} />
        </section>
        <footer className="weekreport-editor-footer">
          <div>{savedState ? <b>{savedState}</b> : <span>{draftTouched ? "有未保存修改" : currentSavedReport ? "内容已保存" : "尚未保存"}</span>}</div>
          <div><button onClick={() => copyText(draftContent)}>{copied ? "已复制" : "复制正文"}</button><button onClick={() => setView("overview")}>离开编辑</button><button onClick={() => saveReport("草稿")}>保存草稿</button><button className="primary" onClick={() => saveReport("已归档")}>完成并归档</button></div>
        </footer>
      </main>
    </section>}

    {view === "archive" && <section className="weekreport-archive">
      <header className="weekreport-library-head">
        <div><span>长期周报库</span><h2>{allReports.length} 份周报</h2><p>按班级、版本和关键词查找，随时回看、复制或继续编辑。</p></div>
        <button className="weekreport-primary" onClick={() => setView("editor")}>新建周报</button>
      </header>
      <section className="weekreport-library-filters">
        <label><span>搜索</span><input value={archiveSearch} onChange={(event) => { setArchiveSearch(event.target.value); setArchivePage(1); }} placeholder="搜索标题、班级或正文内容" /></label>
        <label><span>班级</span><select value={archiveClass} onChange={(event) => { setArchiveClass(event.target.value); setArchivePage(1); }}><option>全部班级</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>版本</span><select value={archiveEdition} onChange={(event) => { setArchiveEdition(event.target.value); setArchivePage(1); }}><option>全部版本</option><option>家长版</option><option>教师版</option></select></label>
      </section>
      {pageReports.length ? <div className="weekreport-table-wrap">
        <table className="weekreport-table weekreport-archive-table">
          <thead><tr><th>状态</th><th>标题</th><th>班级</th><th>周期</th><th>版本</th><th>更新</th><th>操作</th></tr></thead>
          <tbody>{pageReports.map((report) => {
            const targetClass = classes.find((item) => item.id === report.classId);
            return <tr key={report.id}>
              <td><span className={`weekreport-badge ${report.status === "已归档" ? "success" : "secondary"}`}>{report.status ?? "草稿"}</span></td>
              <td><b>{report.title ?? (targetClass?.name ?? "班级") + "班级周报"}</b><small>{report.content.replace(/\s+/g, " ").slice(0, 72)}{report.content.length > 72 ? "..." : ""}</small></td>
              <td>{targetClass?.name ?? "未知班级"}</td>
              <td>{report.weekStart} 至 {report.weekEnd}</td>
              <td>{report.edition}</td>
              <td>{new Date(report.updatedAt).toLocaleDateString("zh-CN")}</td>
              <td><div className="weekreport-row-actions"><button onClick={() => copyText(report.content)}>复制</button><button onClick={() => setPreviewReportId(report.id)}>预览</button><button onClick={() => openSavedReport(report)}>编辑</button></div></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <section className="weekreport-empty library"><b>还没有符合条件的周报</b><span>先完成第一份周报，以后每周都会在这里沉淀。</span><button onClick={() => setView("editor")}>开始写第一份周报</button></section>}
      {filteredReports.length > pageSize && <nav className="weekreport-pagination" aria-label="周报分页"><button disabled={safeArchivePage <= 1} onClick={() => setArchivePage((page) => Math.max(1, page - 1))}>上一页</button><span>第 {safeArchivePage} / {pageCount} 页</span><button disabled={safeArchivePage >= pageCount} onClick={() => setArchivePage((page) => Math.min(pageCount, page + 1))}>下一页</button></nav>}
    </section>}

    {detailPanel && <div className="weekreport-backdrop" onMouseDown={() => setDetailPanel(null)}><section className="weekreport-modal" role="dialog" aria-modal="true" aria-label={detailTitles[detailPanel]} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span>{detailPanel === "records" ? "来源：成长档案与家校沟通" : `${className} · ${shortDate(monday)} 至 ${shortDate(sunday)}`}</span><h2>{detailTitles[detailPanel]}</h2></div><button aria-label="关闭" onClick={() => setDetailPanel(null)}>×</button></header>
      <div className="weekreport-modal-body">
        {detailPanel === "stars" && <div className="weekreport-detail-list">{stars.map((student, index) => { const row = positiveRows.find((item) => item.student.id === student.id); return <div key={student.id}><i>{index + 1}</i><span><b>{student.name}</b><small>{row?.reason}</small></span><strong>+{row?.delta}</strong></div>; })}</div>}
        {detailPanel === "progress" && <div className="weekreport-detail-list">{progress.length ? progress.map((item) => <div key={item.student.id}><i>进</i><span><b>{item.student.name}</b><small>{item.evidence}</small></span><strong>+{item.delta}</strong></div>) : <p>本周还没有足够的进步记录。</p>}</div>}
        {detailPanel === "follow" && <><div className="weekreport-modal-filters">{(["全部", "作业", "成绩", "考勤"] as const).map((item) => <button className={followFilter === item ? "active" : ""} key={item} onClick={() => setFollowFilter(item)}>{item}</button>)}</div><div className="weekreport-detail-list">{filteredFollow.length ? filteredFollow.map((item) => <div key={item.student.id}><i>{item.student.name.slice(0, 1)}</i><span><b>{item.student.name}</b><small>{item.reasons.map((reason) => reason.text).join("；")}</small></span><strong>{item.reasons.length} 项</strong></div>) : <p>当前条件下没有需要跟进的学生。</p>}</div></>}
        {detailPanel === "groups" && <div className="weekreport-detail-table"><div><b>当前排名</b><b>小组</b><b>人数</b><b>当前总积分</b><b>当前人均积分</b><b>作业待办</b></div>{groupStats.map((item, index) => <div key={item.group}><span>{index + 1}</span><strong>第{item.group}组</strong><span>{item.students}</span><span>{item.points}</span><b>{item.average}</b><em>{item.unresolved ? `${item.unresolved} 人次` : "已清零"}</em></div>)}</div>}
        {detailPanel === "records" && <div className="weekreport-record-detail">{reportRecords.length ? reportRecords.map((record) => <article key={record.id}><i>{record.student.slice(0, 1)}</i><div><h3>{record.student}<span>{record.type}</span></h3><p>{record.content}</p><time>{record.date}</time></div></article>) : <p>本周暂无成长记录。</p>}</div>}
      </div>
    </section></div>}

    {previewReport && <div className="weekreport-backdrop" onMouseDown={() => setPreviewReportId(null)}><section className="weekreport-modal weekreport-preview-modal" role="dialog" aria-modal="true" aria-label="周报预览" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span>{previewClass?.name} · {previewReport.edition}</span><h2>{previewReport.title ?? "班级周报"}</h2></div><button aria-label="关闭" onClick={() => setPreviewReportId(null)}>×</button></header>
      <div className="weekreport-preview-content"><pre>{previewReport.content}</pre><section><span>下周行动</span><p>{previewReport.nextFocus || "未填写"}</p></section></div>
      <footer><button onClick={() => copyText(previewReport.content)}>复制正文</button><button className="primary" onClick={() => openSavedReport(previewReport)}>打开编辑</button></footer>
    </section></div>}
  </div>;
}

function Seating({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [layoutMode, setLayoutMode] = useState<"秧田式" | "小组式" | "U型">("秧田式");
  const [lastStudents, setLastStudents] = useState<Student[] | null>(null);
  const [needsOpen, setNeedsOpen] = useState(false);
  const [editingSeat, setEditingSeat] = useState<number | null>(null);
  const [avoidPickerStudentId, setAvoidPickerStudentId] = useState<string | null>(null);
  const config: SeatingConfig = data.seatingConfig ?? { rows: 6, columns: 6, groupCount: Math.max(1, ...data.students.map((student) => student.group || 1)), aisleAfter: [2, 4] };
  const capacity = config.rows * config.columns;
  const sortedStudents = [...data.students].sort((a, b) => a.seat - b.seat);
  const studentBySeat = new Map(sortedStudents.map((student) => [student.seat, student]));
  const needs = ["无", "前排", "后排", "靠窗", "靠过道"] as const;

  function groupForSeat(seat: number, nextConfig = config) {
    const column = (seat - 1) % nextConfig.columns;
    if (nextConfig.groupCount <= nextConfig.columns) return Math.min(nextConfig.groupCount, Math.floor(column * nextConfig.groupCount / nextConfig.columns) + 1);
    return Math.min(nextConfig.groupCount, Math.floor((seat - 1) * nextConfig.groupCount / (nextConfig.rows * nextConfig.columns)) + 1);
  }

  function syncStudents(current: ClassroomData, students: Student[]): ClassroomData {
    const activeClassId = current.activeClassId ?? current.rosterClasses?.[0]?.id;
    return {
      ...current,
      students,
      rosterClasses: current.rosterClasses?.map((item) => item.id === activeClassId ? { ...item, students } : item),
    };
  }

  function remember() {
    setLastStudents(data.students.map((student) => ({ ...student })));
  }

  function updateConfig(patch: Partial<SeatingConfig>) {
    update((current) => {
      const currentConfig = current.seatingConfig ?? config;
      const columns = Math.max(2, Math.min(10, patch.columns ?? currentConfig.columns));
      const rows = Math.max(Math.ceil(current.students.length / columns), Math.max(1, Math.min(12, patch.rows ?? currentConfig.rows)));
      const groupCount = Math.max(1, Math.min(12, patch.groupCount ?? currentConfig.groupCount));
      const aisleAfter = (patch.aisleAfter ?? currentConfig.aisleAfter).filter((column) => column > 0 && column < columns);
      const seatingConfig = { rows, columns, groupCount, aisleAfter };
      const students = current.students.map((student) => ({ ...student, group: groupForSeat(student.seat, seatingConfig) }));
      return syncStudents({ ...current, seatingConfig }, students);
    });
    setMessage("教室布局已更新，现有座位保持不变。超出容量时会自动补足排数。");
  }

  function swapStudentTo(studentId: string, targetSeat: number) {
    if (targetSeat < 1 || targetSeat > capacity) return;
    remember();
    update((current) => {
      const first = current.students.find((item) => item.id === studentId);
      const second = current.students.find((item) => item.seat === targetSeat);
      if (!first || first.seat === targetSeat) return current;
      const students = current.students.map((item) => {
        if (item.id === first.id) return { ...item, seat: targetSeat, group: groupForSeat(targetSeat) };
        if (second && item.id === second.id) return { ...item, seat: first.seat, group: groupForSeat(first.seat) };
        return item;
      });
      return syncStudents(current, students);
    });
    setSelected(null);
    setMessage("座位已调整，可继续换座或使用“撤销上一步”。");
  }

  function assignStudentToSeat(studentId: string, targetSeat: number) {
    const student = data.students.find((item) => item.id === studentId);
    if (!student) return;
    if (student.seat === targetSeat) {
      setEditingSeat(null);
      setMessage(`${student.name} 已在这个座位。`);
      return;
    }
    swapStudentTo(studentId, targetSeat);
    setEditingSeat(null);
  }

  function chooseSeat(seat: number, student?: Student) {
    if (!selected) {
      if (!student) return setMessage("这是一个空座位，请先选择要移动的学生。");
      setSelected(student.id);
      setMessage(`已选择 ${student.name}，再点学生或空座位即可调整。`);
      return;
    }
    if (selected === student?.id) {
      setSelected(null);
      setMessage("已取消选择。");
      return;
    }
    swapStudentTo(selected, seat);
  }

  function isAisleSeat(seat: number, nextConfig = config) {
    const column = (seat - 1) % nextConfig.columns + 1;
    return nextConfig.aisleAfter.some((after) => column === after || column === after + 1);
  }

  function mateSeat(seat: number, nextConfig = config) {
    const column = (seat - 1) % nextConfig.columns;
    if (column % 2 === 0) return column + 1 < nextConfig.columns ? seat + 1 : 0;
    return seat - 1;
  }

  function smartArrange() {
    remember();
    update((current) => {
      const nextConfig = current.seatingConfig ?? config;
      const maxSeat = nextConfig.rows * nextConfig.columns;
      const allSeats = Array.from({ length: maxSeat }, (_, index) => index + 1);
      const fixedSeats = new Set<number>();
      const fixedIds = new Set<string>();
      const placed = new Map<number, Student>();
      for (const student of current.students) {
        if (student.seatFixed && student.seat >= 1 && student.seat <= maxSeat && !fixedSeats.has(student.seat)) {
          fixedSeats.add(student.seat);
          fixedIds.add(student.id);
          placed.set(student.seat, student);
        }
      }
      const candidates = allSeats.filter((seat) => !fixedSeats.has(seat));
      for (let index = candidates.length - 1; index > 0; index -= 1) {
        const pick = Math.floor(Math.random() * (index + 1));
        [candidates[index], candidates[pick]] = [candidates[pick], candidates[index]];
      }
      const movable = current.students.filter((student) => !fixedIds.has(student.id)).sort((a, b) => {
        const aPriority = a.seatNeed && a.seatNeed !== "无" ? 1 : 0;
        const bPriority = b.seatNeed && b.seatNeed !== "无" ? 1 : 0;
        return bPriority - aPriority || (b.height ?? 0) - (a.height ?? 0);
      });
      const assigned = new Map<string, number>();
      for (const student of movable) {
        const valid = candidates.filter((seat) => {
          const mate = placed.get(mateSeat(seat, nextConfig));
          return !mate || (student.avoidWith !== mate.id && mate.avoidWith !== student.id);
        });
        const pool = valid.length ? valid : candidates;
        const ranked = pool.map((seat) => {
          const row = Math.floor((seat - 1) / nextConfig.columns) + 1;
          const column = (seat - 1) % nextConfig.columns;
          let score = Math.random();
          if (student.seatNeed === "前排") score += (nextConfig.rows - row + 1) * 20;
          if (student.seatNeed === "后排") score += row * 20;
          if (student.seatNeed === "靠窗") score += column === 0 || column === nextConfig.columns - 1 ? 120 : 0;
          if (student.seatNeed === "靠过道") score += isAisleSeat(seat, nextConfig) ? 120 : 0;
          if (student.height) score += row * student.height / 20;
          return { seat, score };
        }).sort((a, b) => b.score - a.score);
        const chosen = ranked[0]?.seat;
        if (!chosen) continue;
        assigned.set(student.id, chosen);
        placed.set(chosen, student);
        candidates.splice(candidates.indexOf(chosen), 1);
      }
      const students = current.students.map((student) => {
        const seat = assigned.get(student.id) ?? student.seat;
        return { ...student, seat, group: groupForSeat(seat, nextConfig) };
      });
      return syncStudents(current, students);
    });
    setSelected(null);
    setMessage("智能排座已完成：固定座保留，并优先处理特殊座位和不能同桌要求。");
  }

  function rotateRows() {
    remember();
    update((current) => {
      const fixedSeats = new Set(current.students.filter((student) => student.seatFixed).map((student) => student.seat));
      const movable = [...current.students].filter((student) => !student.seatFixed).sort((a, b) => a.seat - b.seat);
      const targetSeats = movable.map((student) => student.seat).filter((seat) => !fixedSeats.has(seat));
      const shift = Math.min(config.columns, Math.max(1, targetSeats.length - 1));
      const targetById = new Map(movable.map((student, index) => [student.id, targetSeats[(index - shift + targetSeats.length) % targetSeats.length]]));
      const students = current.students.map((student) => {
        const seat = targetById.get(student.id) ?? student.seat;
        return { ...student, seat, group: groupForSeat(seat) };
      });
      return syncStudents(current, students);
    });
    setSelected(null);
    setMessage("已完成一轮前后排轮换，固定座位未移动。");
  }

  function undo() {
    if (!lastStudents) return;
    update((current) => syncStudents(current, lastStudents));
    setLastStudents(null);
    setSelected(null);
    setMessage("已撤销上一步座位调整。");
  }

  function editStudent(id: string, patch: Partial<Student>) {
    update((current) => syncStudents(current, current.students.map((student) => student.id === id ? { ...student, ...patch } : student)));
  }

  function setLeader(student: Student) {
    update((current) => syncStudents(current, current.students.map((item) => item.group === student.group ? { ...item, groupLeader: item.id === student.id } : item)));
    setMessage(`${student.name} 已设为第${student.group}组组长。`);
  }

  function regroupBySeat() {
    remember();
    update((current) => syncStudents(current, current.students.map((student) => ({ ...student, group: groupForSeat(student.seat) }))));
    setMessage("已按当前座位列重新分组，每组人数会随座位自动变化。");
  }

  const groups = Array.from({ length: config.groupCount }, (_, index) => {
    const number = index + 1;
    return { number, students: sortedStudents.filter((student) => student.group === number) };
  });
  const specialCount = data.students.filter((student) => student.seatFixed || (student.seatNeed && student.seatNeed !== "无") || student.avoidWith).length;
  const assignedCount = sortedStudents.filter((student) => student.seat >= 1 && student.seat <= capacity).length;
  const unassignedCount = Math.max(0, data.students.length - assignedCount);
  const editingSeatStudent = editingSeat ? studentBySeat.get(editingSeat) : undefined;

  return <div className="seating-page">
    <WorkbenchPageHeader icon="🪑" tone="jade" title="座位分组" description="维护教室排布、换座记录、特殊座位条件和小组组长，座位结果同步到值日与积分统计。" actions={<div className="seat2-actions"><button onClick={rotateRows}>前后排轮换</button><button className="primary workbench-header-primary" onClick={smartArrange}>智能排座</button></div>} />
    <section className="campus-statistics"><div><span>座位使用</span><b>{assignedCount}/{capacity}</b><small>{config.rows}排 x {config.columns}列</small></div><div><span>未分配</span><b>{unassignedCount}</b><small>超过容量时需增排</small></div><div><span>排座条件</span><b>{specialCount}</b><small>固定座 / 需求 / 避让</small></div></section>
    <section className="seat2-control-panel">
      <div className="seat2-control-main">
        <div className="seat2-segmented" aria-label="座位模式">{(["秧田式", "小组式", "U型"] as const).map((mode) => <button className={layoutMode === mode ? "active" : ""} key={mode} onClick={() => setLayoutMode(mode)}>{mode}</button>)}</div>
        <div className="seat2-toolbar-actions">
          <button onClick={regroupBySeat}>按座位分组</button>
          <button disabled={!lastStudents} onClick={undo}>撤销上一步</button>
          <button onClick={() => window.print()}>打印座位表</button>
        </div>
      </div>
      <div className="seat2-control-grid">
        <div className="seat2-fields">
          <label><span>教室排数</span><input type="number" min={1} max={12} value={config.rows} onChange={(event) => updateConfig({ rows: Number(event.target.value) || 1 })} /></label>
          <label><span>每排列数</span><input type="number" min={2} max={10} value={config.columns} onChange={(event) => updateConfig({ columns: Number(event.target.value) || 2 })} /></label>
          <label><span>小组数量</span><input type="number" min={1} max={12} value={config.groupCount} onChange={(event) => updateConfig({ groupCount: Number(event.target.value) || 1 })} /></label>
        </div>
        <div className="seat2-aisles"><b>过道位置</b>{Array.from({ length: config.columns - 1 }, (_, index) => index + 1).map((column) => <label key={column}><input type="checkbox" checked={config.aisleAfter.includes(column)} onChange={() => updateConfig({ aisleAfter: config.aisleAfter.includes(column) ? config.aisleAfter.filter((item) => item !== column) : [...config.aisleAfter, column] })} />第{column}列后</label>)}</div>
      </div>
    </section>
    {message && <div className="inline-alert seat2-message" onClick={() => setMessage("")}>{message}<span>×</span></div>}
    <div className="seat2-hint"><b>{selected ? `已选择 ${data.students.find((student) => student.id === selected)?.name ?? "学生"}` : "手动调整座位"}</b><span>{selected ? "再点另一名学生或空座位即可移动；电脑端也可以直接拖动。" : "先点一名学生，再点目标座位；双击座位可直接打开学生选择器。"}</span></div>
    {editingSeat && <StudentLookupDialog
      title={`选择座位 ${editingSeat} 的学生`}
      subtitle={editingSeatStudent ? `当前：${editingSeatStudent.name}。选择其他学生后自动互换座位。` : "当前为空座。选择学生后会移动到这里。"}
      students={sortedStudents}
      selectedId={editingSeatStudent?.id}
      onPick={(student) => assignStudentToSeat(student.id, editingSeat)}
      onClose={() => setEditingSeat(null)}
    />}
    <section className={`seat2-workspace seat2-mode-${layoutMode}`}>
      <div className="seat2-board">
        <div className="seat2-front"><span>黑板</span><b>讲台</b><span>门</span></div>
        <div className={`seat2-grid rows-${config.rows}`} style={{ gridTemplateColumns: `repeat(${config.columns}, minmax(82px, 1fr))` }}>
          {Array.from({ length: capacity }, (_, index) => index + 1).map((seat) => {
            const student = studentBySeat.get(seat);
            const column = (seat - 1) % config.columns + 1;
            const row = Math.floor((seat - 1) / config.columns) + 1;
            const aisleEdge = config.aisleAfter.includes(column);
            const uFront = layoutMode === "U型" && row === 1;
            const uSide = layoutMode === "U型" && (column === 1 || column === config.columns);
            const uCenter = layoutMode === "U型" && row > 1 && column > 1 && column < config.columns;
            const seatStyle = { "--seat-group-bg": `hsl(${(groupForSeat(seat) * 46 + 184) % 360} 64% 94%)` } as CSSProperties;
            return <button
              className={`seat2-slot ${student ? "occupied" : "empty"} ${student && selected === student.id ? "selected" : ""} ${student?.seatFixed ? "fixed" : ""} ${aisleEdge ? "aisle-edge" : ""} ${uFront ? "u-front" : ""} ${uSide ? "u-side" : ""} ${uCenter ? "u-center" : ""}`}
              style={seatStyle}
              aria-label={`${student?.name ?? "空座"} 座位${seat}`}
              draggable={Boolean(student)}
              onDragStart={() => { if (student) setDragged(student.id); }}
              onDragEnd={() => setDragged(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); if (dragged) swapStudentTo(dragged, seat); setDragged(null); }}
              onClick={() => chooseSeat(seat, student)}
              onDoubleClick={(event) => { event.preventDefault(); setSelected(null); setEditingSeat(seat); }}
              key={seat}
            >
              <small className="seat2-number">{seat}</small>
              {student ? <><i className="seat2-avatar">{student.name.slice(0, 1)}</i><span className="seat2-name">{student.name}{student.groupLeader ? <em className="seat2-badge">组长</em> : null}</span><em>第{student.group}组 · {student.studentNo || "未填学号"}</em><strong>{student.seatFixed ? "固定座" : student.seatNeed && student.seatNeed !== "无" ? student.seatNeed : student.avoidWith ? "需避让" : "可调整"}</strong></> : <><span>空座</span><em>可移动学生到这里</em></>}
            </button>;
          })}
        </div>
        <div className="seat2-back"><span>后门</span><b>教室后方</b><span>卫生角</span></div>
      </div>
      <aside className="seat2-groups">
        <header><div><span>分组管理</span><h3>当前小组</h3></div></header>
        {groups.map((group) => <article key={group.number}><div><b>第{group.number}组</b><span>{group.students.length}人</span></div><p>{group.students.map((student) => <button className={student.groupLeader ? "leader" : ""} aria-label={`将${student.name}设为第${student.group}组组长`} onClick={() => setLeader(student)} title="点击设为组长" key={student.id}>{student.name}{student.groupLeader ? " · 组长" : ""}</button>)}</p></article>)}
        <small>点击组员姓名可设为本组组长。小组信息会供值日轮换和积分统计复用。</small>
      </aside>
    </section>
    <section className="seat2-mobile">
      <header><b>手机调整座位</b><span>先点学生，再点目标学生或空座</span></header>
      {Array.from({ length: capacity }, (_, index) => index + 1).map((seat) => { const student = studentBySeat.get(seat); return <button aria-label={`${student?.name ?? "空座"} 座位${seat}`} className={`${selected === student?.id ? "selected" : ""} ${student ? "" : "empty"}`} onClick={() => chooseSeat(seat, student)} key={seat}><i>{student?.name.slice(0, 1) ?? "空"}</i><span><b>{student?.name ?? "空座位"}</b><small>座{seat} · {student ? `第${student.group}组` : "可移动到此处"}</small></span><em>{student?.seatFixed ? "固定座" : student?.seatNeed && student.seatNeed !== "无" ? student.seatNeed : "调整"}</em></button>; })}
    </section>
    <section className="seat2-needs">
      <header><div><span>排座条件</span><h3>特殊座位与不能同桌</h3><p>智能排座会优先满足这些条件；固定座在自动排座和前后轮换时保持不动。</p></div><button onClick={() => setNeedsOpen((open) => !open)}>{needsOpen ? "收起设置" : `展开设置（${specialCount}项）`}</button></header>
      {needsOpen && <div className="seat2-needs-table"><div className="seat2-needs-head"><span>学生</span><span>身高(cm)</span><span>座位需求</span><span>不能同桌</span><span>固定座</span><span>小组</span></div>{sortedStudents.map((student) => {
        const avoidStudent = data.students.find((item) => item.id === student.avoidWith);
        return <div className="seat2-needs-row" key={student.id}><b>{student.name}<small>当前座{student.seat}</small></b><input aria-label={`${student.name}身高`} type="number" min={80} max={220} value={student.height ?? ""} placeholder="选填" onChange={(event) => editStudent(student.id, { height: event.target.value ? Number(event.target.value) : undefined })} /><select aria-label={`${student.name}座位需求`} value={student.seatNeed ?? "无"} onChange={(event) => editStudent(student.id, { seatNeed: event.target.value as Student["seatNeed"] })}>{needs.map((need) => <option key={need}>{need}</option>)}</select><button className="student-picker-trigger compact" onClick={() => setAvoidPickerStudentId(student.id)}><span>{avoidStudent ? avoidStudent.name : "无"}</span><em>{avoidStudent ? "更换" : "选择"}</em></button><label className="fixed-check"><input aria-label={`${student.name}固定座`} type="checkbox" checked={Boolean(student.seatFixed)} onChange={(event) => editStudent(student.id, { seatFixed: event.target.checked })} />{student.seatFixed ? "已固定" : "不固定"}</label><select aria-label={`${student.name}小组`} value={student.group} onChange={(event) => editStudent(student.id, { group: Number(event.target.value) })}>{groups.map((group) => <option value={group.number} key={group.number}>第{group.number}组</option>)}</select></div>;
      })}</div>}
    </section>
    {avoidPickerStudentId && <StudentLookupDialog
      title="选择不能同桌的学生"
      subtitle={`${data.students.find((student) => student.id === avoidPickerStudentId)?.name ?? "当前学生"} 的避让对象。`}
      students={data.students.filter((student) => student.id !== avoidPickerStudentId)}
      selectedId={data.students.find((student) => student.id === avoidPickerStudentId)?.avoidWith}
      allowClear
      clearLabel="设为无"
      onPick={(student) => { editStudent(avoidPickerStudentId, { avoidWith: student.id }); setAvoidPickerStudentId(null); }}
      onClear={() => editStudent(avoidPickerStudentId, { avoidWith: "" })}
      onClose={() => setAvoidPickerStudentId(null)}
    />}
  </div>;
}

function Duty({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const dutyDays = data.scheduleConfig?.days?.map((day) => day.trim()).filter(Boolean) ?? days;
  const currentWeekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date().getDay()];
  const [selectedDay, setSelectedDay] = useState(() => dutyDays.find((day) => sameDutyDay(day, currentWeekday)) ?? dutyDays[0] ?? days[0]);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [newJobDraft, setNewJobDraft] = useState<DutyJob | null>(null);
  const [keyword, setKeyword] = useState("");
  const [message, setMessage] = useState("");
  const [assignTarget, setAssignTarget] = useState<{ day: string; jobId: string } | null>(null);
  const [assignKeyword, setAssignKeyword] = useState("");
  const [assignGroup, setAssignGroup] = useState("all");
  const [fixedJobPickerId, setFixedJobPickerId] = useState<string | null>(null);
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "class-1";
  const allJobs = data.dutyJobs?.length ? data.dutyJobs : defaultDutyJobs;
  const jobs = allJobs.filter((job) => job.enabled !== false);
  const maxGroup = Math.max(1, ...data.students.map((s) => s.group || 1));
  const groups = Array.from({ length: maxGroup }, (_, group) => data.students.filter((s) => s.group === group + 1));
  const records = (data.dutyRecords ?? []).filter((record) => !record.classId || record.classId === activeClassId);
  const selectedDayIndex = dutyDays.indexOf(selectedDay) >= 0 ? dutyDays.indexOf(selectedDay) : 0;
  const todayRecords = records.filter((record) => record.date === today());
  const pendingCount = jobs.filter((job) => {
    const record = todayRecords.find((item) => item.day === selectedDay && item.jobId === job.id);
    return !record || record.status === "待检查" || record.status === "需返工";
  }).length;
  const weekDoneCount = dutyDays.reduce((sum, day) => sum + jobs.filter((job) => records.some((record) => record.date === today() && sameDutyDay(record.day, day) && record.jobId === job.id && record.status === "已完成")).length, 0);

  useEffect(() => { if (!dutyDays.some((day) => sameDutyDay(day, selectedDay))) setSelectedDay(dutyDays[0] ?? days[0]); }, [dutyDays, selectedDay]);

  function dutyRecordFor(day: string, job: DutyJob) {
    return records.find((record) => record.date === today() && sameDutyDay(record.day, day) && record.jobId === job.id);
  }

  function assignedStudents(dayIndex: number, job: DutyJob, jobIndex: number) {
    const day = dutyDays[dayIndex] ?? selectedDay;
    const manual = (dutyRecordFor(day, job)?.studentIds ?? []).map((id) => data.students.find((student) => student.id === id)).filter(Boolean) as Student[];
    if (manual.length) return manual;
    const fixed = (job.studentIds ?? []).map((id) => data.students.find((student) => student.id === id)).filter(Boolean) as Student[];
    if (fixed.length) return fixed;
    const group = groups[(dayIndex + data.dutyOffset) % groups.length] ?? [];
    return group.length ? [group[jobIndex % group.length]] : [];
  }

  function editJob(id: string, patch: Partial<DutyJob>) {
    update((current) => ({ ...current, dutyJobs: allJobs.map((job) => job.id === id ? { ...job, ...patch } : job) }));
  }

  function addJob() {
    setEditingJobId(null);
    setNewJobDraft({ id: makeId("duty-job"), name: "", area: "", standard: "", enabled: true });
  }

  function saveNewJob() {
    if (!newJobDraft) return;
    const next = { ...newJobDraft, name: newJobDraft.name.trim(), area: newJobDraft.area.trim(), standard: newJobDraft.standard.trim() };
    if (!next.name || !next.area || !next.standard) {
      setMessage("请填写岗位名称、负责区域和检查标准。");
      return;
    }
    update((current) => ({ ...current, dutyJobs: [...(current.dutyJobs?.length ? current.dutyJobs : allJobs), next] }));
    setNewJobDraft(null);
    setMessage("值日岗位已新增。");
  }

  function assignDutyStudent(day: string, job: DutyJob, studentId: string) {
    const existing = dutyRecordFor(day, job);
    if (!studentId) {
      update((current) => ({ ...current, dutyRecords: (current.dutyRecords ?? []).filter((record) => !(record.date === today() && record.day === day && record.jobId === job.id)) }));
      setMessage(`${day} ${job.name} 已恢复自动轮换`);
      setAssignTarget(null);
      return;
    }
    const student = data.students.find((item) => item.id === studentId);
    const next: DutyRecord = {
      id: existing?.id ?? makeId(),
      classId: activeClassId,
      date: today(),
      day,
      jobId: job.id,
      studentIds: [studentId],
      status: existing?.status ?? "待检查",
      note: existing?.note ?? "",
      checkedBy: existing?.checkedBy ?? "劳动委员",
      createdAt: existing?.createdAt ?? currentTimestamp(),
    };
    update((current) => ({ ...current, dutyRecords: [next, ...(current.dutyRecords ?? []).filter((record) => record.id !== next.id)] }));
    setMessage(`${day} ${job.name} 已指定给 ${student?.name ?? "该学生"}`);
    setAssignTarget(null);
  }

  function openDutyAssigner(day: string, job: DutyJob) {
    const dayIndex = dutyDays.indexOf(day) >= 0 ? dutyDays.indexOf(day) : 0;
    const groupNumber = ((dayIndex + data.dutyOffset) % groups.length) + 1;
    setAssignTarget({ day, jobId: job.id });
    setAssignGroup(String(groupNumber));
    setAssignKeyword("");
  }

  function mark(day: string, job: DutyJob, jobIndex: number, status: DutyRecord["status"]) {
    const students = assignedStudents(dutyDays.indexOf(day), job, jobIndex);
    const existing = records.find((record) => record.date === today() && sameDutyDay(record.day, day) && record.jobId === job.id);
    const next: DutyRecord = {
      id: existing?.id ?? makeId(),
      classId: activeClassId,
      date: today(),
      day,
      jobId: job.id,
      studentIds: students.map((student) => student.id),
      status,
      note: existing?.note ?? "",
      checkedBy: existing?.checkedBy ?? "劳动委员",
      createdAt: existing?.createdAt ?? currentTimestamp(),
    };
    update((current) => ({ ...current, dutyRecords: [next, ...(current.dutyRecords ?? []).filter((record) => record.id !== next.id)] }));
    setMessage(`${day} ${job.name} 已记录为${status}`);
  }

  const dutyText = dutyDays.map((day, dayIndex) => {
    const groupIndex = (dayIndex + data.dutyOffset) % groups.length;
    return `${day} 第${groupIndex + 1}组：` + jobs.map((job, jobIndex) => `${job.name}-${assignedStudents(dayIndex, job, jobIndex).map((student) => student.name).join("、") || "待安排"}`).join("；");
  }).join("\n");

  const filteredRecords = records.filter((record) => {
    const job = allJobs.find((item) => item.id === record.jobId);
    const names = record.studentIds.map((id) => data.students.find((student) => student.id === id)?.name).filter(Boolean).join("、");
    const text = `${record.date}${record.day}${job?.name}${names}${record.status}${record.note}`;
    return !keyword.trim() || text.includes(keyword.trim());
  }).slice(0, 20);
  const selectedGroupNumber = ((selectedDayIndex + data.dutyOffset) % groups.length) + 1;
  const selectedGroup = groups[selectedGroupNumber - 1] ?? [];
  const dayDoneCount = Math.max(0, jobs.length - pendingCount);
  const weekTotal = Math.max(1, jobs.length * dutyDays.length);
  const weekRate = Math.round(weekDoneCount / weekTotal * 100);
  const assignJob = assignTarget ? jobs.find((job) => job.id === assignTarget.jobId) ?? allJobs.find((job) => job.id === assignTarget.jobId) : undefined;
  const assignDayIndex = assignTarget && dutyDays.indexOf(assignTarget.day) >= 0 ? dutyDays.indexOf(assignTarget.day) : 0;
  const assignJobIndex = assignJob ? Math.max(0, jobs.findIndex((job) => job.id === assignJob.id)) : 0;
  const assignRecord = assignTarget && assignJob ? dutyRecordFor(assignTarget.day, assignJob) : undefined;
  const assignManual = Boolean(assignRecord?.studentIds?.length);
  const assignCurrentStudents = assignTarget && assignJob ? assignedStudents(assignDayIndex, assignJob, assignJobIndex) : [];
  const assignGroupNumber = assignTarget ? ((assignDayIndex + data.dutyOffset) % groups.length) + 1 : 1;
  const assignCandidates = data.students.filter((student) => {
    const matchGroup = assignGroup === "all" || String(student.group) === assignGroup;
    const q = assignKeyword.trim();
    const matchKeyword = !q || `${student.name}${student.studentNo ?? ""}${student.group}`.includes(q);
    return matchGroup && matchKeyword;
  });

  return <div className="duty3-page">
    <WorkbenchPageHeader icon="🧹" tone="marigold" title="值日岗位" description="按小组自动轮换，也可以给单个岗位固定学生；检查结果会沉淀到台账，后续可用于周报和沟通。" actions={<div className="duty3-actions"><button className="primary workbench-header-primary" onClick={() => update((d) => ({ ...d, dutyOffset: (d.dutyOffset + 1) % maxGroup }))}>轮换一周</button></div>} />
    {message && <button className="inline-alert duty3-message" onClick={() => setMessage("")}>{message}<span>点击关闭</span></button>}
    {assignTarget && assignJob && <div className="duty3-assign-backdrop" role="presentation" onClick={() => setAssignTarget(null)}>
      <section className="duty3-assign-modal" role="dialog" aria-modal="true" aria-label="选择值日学生" onClick={(event) => event.stopPropagation()}>
        <header><div><span>{assignTarget.day} · {assignJob.name}</span><h3>选择负责同学</h3><p>当前：{assignCurrentStudents.map((student) => student.name).join("、") || "自动轮换待安排"}{assignManual ? " · 手动指定" : " · 默认轮换"}</p></div><button aria-label="关闭" onClick={() => setAssignTarget(null)}>×</button></header>
        <div className="duty3-assign-tools"><input autoFocus value={assignKeyword} onChange={(event) => setAssignKeyword(event.target.value)} placeholder="搜索姓名、学号或小组" /><select value={assignGroup} onChange={(event) => setAssignGroup(event.target.value)}><option value="all">全部小组</option>{groups.map((group, index) => <option value={index + 1} key={index}>第{index + 1}组（{group.length}人）</option>)}</select></div>
        <div className="duty3-assign-recommend"><button onClick={() => setAssignGroup(String(assignGroupNumber))}>只看当天轮值组</button><button onClick={() => assignDutyStudent(assignTarget.day, assignJob, "")}>恢复自动轮换</button></div>
        <div className="duty3-assign-list">{assignCandidates.length ? assignCandidates.map((student) => <button className={assignRecord?.studentIds?.includes(student.id) ? "active" : ""} onClick={() => assignDutyStudent(assignTarget.day, assignJob, student.id)} key={student.id}><i>{student.name.slice(0, 1)}</i><span><b>{student.name}</b><small>第{student.group}组 · 学号 {student.studentNo || "未填"}</small></span></button>) : <p>没有找到符合条件的学生。</p>}</div>
      </section>
    </div>}

    <section className="campus-statistics"><div><span>当前检查日</span><b>{selectedDay}</b><small>第{selectedGroupNumber}组轮值</small></div><div><span>今日进度</span><b>{dayDoneCount}/{jobs.length}</b><small>{pendingCount ? `还有 ${pendingCount} 项待处理` : "已全部处理"}</small></div><div><span>本周完成率</span><b>{weekRate}%</b><small>完成 {weekDoneCount}/{weekTotal}</small></div></section>

    <section className="duty3-layout">
      <main className="duty3-main">
        <section className="duty3-today">
          <header className="duty3-section-head">
            <div><span>今日检查</span><h3>{selectedDay} · 第{selectedGroupNumber}组</h3><p>{selectedGroup.map((student) => student.name).join("、") || "当前小组暂无学生"}</p></div>
            <button onClick={() => window.print()}>打印公示</button>
          </header>
          <div className="duty3-day-switch">{dutyDays.map((day) => <button className={selectedDay === day ? "active" : ""} onClick={() => setSelectedDay(day)} key={day}><b>{day}</b><span>第{((dutyDays.indexOf(day) + data.dutyOffset) % groups.length) + 1}组</span></button>)}</div>
          <div className="duty3-task-list">
          {jobs.map((job, jobIndex) => {
            const students = assignedStudents(selectedDayIndex, job, jobIndex);
            const record = dutyRecordFor(selectedDay, job);
            const manualAssigned = Boolean(record?.studentIds?.length);
            return <article className="duty3-task" key={job.id}>
              <div className="duty3-task-title">
                <i>{job.name.slice(0, 1)}</i>
                <div><b>{job.name}</b><small>{job.area}</small></div>
                <em className={`duty3-status ${record?.status ?? "待检查"}`}>{record?.status ?? "待检查"}</em>
              </div>
              <p>{job.standard}</p>
              <div className="duty3-assignees">{students.length ? students.map((student) => <span key={student.id}>{student.name}</span>) : <span>待安排</span>}</div>
              <button className="duty3-assign-trigger" onClick={() => openDutyAssigner(selectedDay, job)}><span>{manualAssigned ? "手动指定" : "默认轮换"}</span><b>{students.map((student) => student.name).join("、") || "选择同学"}</b></button>
              <footer><button onClick={() => mark(selectedDay, job, jobIndex, "已完成")}>完成</button><button onClick={() => mark(selectedDay, job, jobIndex, "需返工")}>返工</button></footer>
            </article>;
          })}
          </div>
        </section>

        <section className="duty3-week">
          <header className="duty3-section-head"><div><span>一周值日表</span><h3>按小组轮换</h3></div><button onClick={() => copyTextToClipboard(dutyText, "已复制值日表")}>复制</button></header>
          <div className="duty3-table">
            <div className="duty3-table-head" style={{ gridTemplateColumns: `150px repeat(${dutyDays.length}, minmax(132px, 1fr))` }}><span>岗位</span>{dutyDays.map((day) => <span key={day}>{day}</span>)}</div>
            {jobs.map((job, jobIndex) => <div className="duty3-table-row" style={{ gridTemplateColumns: `150px repeat(${dutyDays.length}, minmax(132px, 1fr))` }} key={job.id}><b>{job.name}</b>{dutyDays.map((day, dayIndex) => { const students = assignedStudents(dayIndex, job, jobIndex); const record = dutyRecordFor(day, job); const manualAssigned = Boolean(record?.studentIds?.length); return <div key={day}><small>第{((dayIndex + data.dutyOffset) % groups.length) + 1}组{manualAssigned ? " · 手动" : ""}</small>{students.map((student) => <span key={student.id}>{student.name}</span>)}{!students.length && <span>待安排</span>}<button className="duty3-cell-picker" onClick={() => openDutyAssigner(day, job)}>{manualAssigned ? "改负责人" : "选择"}</button></div>; })}</div>)}
          </div>
        </section>
      </main>

      <aside className="duty3-side">
        <section className="duty3-jobs">
          <header className="duty3-section-head"><div><span>岗位设置</span><h3>启用岗位</h3></div><button onClick={addJob}>新增</button></header>
          <div className="duty3-job-list">{newJobDraft && <article className="duty3-job-new"><header><b>新增岗位</b><span>填写后保存才会加入值日安排</span></header><div className="duty3-job-editor"><label><span>岗位名</span><input autoFocus value={newJobDraft.name} onChange={(event) => setNewJobDraft({ ...newJobDraft, name: event.target.value })} placeholder="例如：讲台整理" /></label><label><span>负责区域</span><input value={newJobDraft.area} onChange={(event) => setNewJobDraft({ ...newJobDraft, area: event.target.value })} placeholder="例如：讲台、粉笔槽" /></label><label><span>检查标准</span><textarea value={newJobDraft.standard} onChange={(event) => setNewJobDraft({ ...newJobDraft, standard: event.target.value })} placeholder="写清楚完成标准和复查时间" /></label></div><footer><button type="button" onClick={() => setNewJobDraft(null)}>取消</button><button type="button" className="primary-small" onClick={saveNewJob}>保存岗位</button></footer></article>}{allJobs.map((job) => <article className={job.enabled === false ? "disabled" : ""} key={job.id}>
            <header><button className={job.enabled === false ? "" : "enabled"} onClick={() => editJob(job.id, { enabled: job.enabled === false })}>{job.enabled === false ? "停用" : "启用"}</button><b>{job.name}</b><button onClick={() => setEditingJobId(editingJobId === job.id ? null : job.id)}>{editingJobId === job.id ? "收起" : "编辑"}</button></header>
            <p>{job.area}</p>
            {editingJobId === job.id && <div className="duty3-job-editor">
              <label><span>岗位名</span><input value={job.name} onChange={(e) => editJob(job.id, { name: e.target.value })} /></label>
              <label><span>负责区域</span><input value={job.area} onChange={(e) => editJob(job.id, { area: e.target.value })} /></label>
              <label><span>检查标准</span><textarea value={job.standard} onChange={(e) => editJob(job.id, { standard: e.target.value })} /></label>
              <label><span>固定学生</span><button className="student-picker-trigger" onClick={() => setFixedJobPickerId(job.id)}><span>{data.students.find((student) => student.id === job.studentIds?.[0])?.name ?? "按小组自动轮换"}</span><em>{job.studentIds?.[0] ? "更换" : "选择"}</em></button></label>
            </div>}
          </article>)}</div>
        </section>

        <section className="duty3-records">
          <header className="duty3-section-head"><div><span>检查台账</span><h3>最近记录</h3></div><button onClick={() => copyTextToClipboard(filteredRecords.map((record) => `${record.date} ${record.day} ${record.status} ${record.note}`).join("\n"), "已复制检查台账")}>复制</button></header>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索岗位、学生、备注" />
          <div>{filteredRecords.length ? filteredRecords.map((record) => { const job = allJobs.find((item) => item.id === record.jobId); const names = record.studentIds.map((id) => data.students.find((student) => student.id === id)?.name).filter(Boolean).join("、"); return <article key={record.id}><b>{record.day} · {job?.name ?? "值日岗位"}</b><span>{record.date} · {record.status} · {names || "未记录学生"}</span><textarea value={record.note} placeholder="补充检查备注" onChange={(e) => update((current) => ({ ...current, dutyRecords: (current.dutyRecords ?? []).map((item) => item.id === record.id ? { ...item, note: e.target.value } : item) }))} /></article>; }) : <p>还没有符合条件的值日记录。</p>}</div>
        </section>
      </aside>
    </section>
    {fixedJobPickerId && <StudentLookupDialog
      title="选择固定值日学生"
      subtitle={allJobs.find((job) => job.id === fixedJobPickerId)?.name ?? "值日岗位"}
      students={data.students}
      selectedId={allJobs.find((job) => job.id === fixedJobPickerId)?.studentIds?.[0]}
      allowClear
      clearLabel="恢复轮换"
      onPick={(student) => { editJob(fixedJobPickerId, { studentIds: [student.id] }); setFixedJobPickerId(null); }}
      onClear={() => editJob(fixedJobPickerId, { studentIds: [] })}
      onClose={() => setFixedJobPickerId(null)}
    />}
  </div>;
}

function Cadres({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [tab, setTab] = useState<"全部" | "班委" | "小组长">("全部");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [draftRole, setDraftRole] = useState<CadreRole | null>(null);
  const [roleStudentPickerId, setRoleStudentPickerId] = useState<string | null>(null);
  const activeTermLabel = scheduleTermLabel(data.scheduleConfig, "本学期");
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "class-1";
  const roles = data.cadres ?? [];
  const roleKind = (role: CadreRole): "班委" | "小组长" => ((role.scope ?? "") === "小组管理" || role.role.includes("组长") || /^第\d+组/.test(role.role)) ? "小组长" : "班委";
  const committeeRoles = roles.filter((role) => roleKind(role) === "班委");
  const groupRoles = roles.filter((role) => roleKind(role) === "小组长");
  const groupNumbers = Array.from(new Set(data.students.map((student) => student.group))).sort((a, b) => a - b);
  const groupNumberOptions = groupNumbers.length ? groupNumbers : [1];
  const activeRoles = tab === "班委" ? committeeRoles : tab === "小组长" ? groupRoles : roles;
  const editingRole = editingRoleId === "__new__" ? draftRole : roles.find((role) => role.id === editingRoleId) ?? null;
  const missingGroups = groupNumbers.filter((group) => {
    const candidates = data.students.filter((student) => student.group === group);
    return !groupRoles.some((item) => item.role.includes(`第${group}组`) || candidates.some((student) => student.id === item.studentId));
  });
  function edit(id: string, patch: Partial<CadreRole>) {
    if (id === "__new__" || id === draftRole?.id) {
      setDraftRole((current) => current ? { ...current, ...patch } : current);
      return;
    }
    update((d) => ({ ...d, cadres: (d.cadres ?? []).map((c) => c.id === id ? { ...c, ...patch } : c) }));
  }

  function addRole(scope: "班级管理" | "小组管理", group?: number) {
    const safeGroup = group ?? groupNumberOptions[0] ?? 1;
    const candidates = scope === "小组管理" ? data.students.filter((student) => student.group === safeGroup) : data.students;
    const firstStudent = candidates[0] ?? data.students[0];
    const roleName = scope === "小组管理" ? `第${safeGroup}组组长` : "新班委岗位";
    const id = makeId();
    setDraftRole({ id, classId: activeClassId, role: roleName, studentId: firstStudent?.id ?? "", duty: "", scope, term: activeTermLabel, status: "试用", weeklyScore: 3, summary: "" });
    setEditingRoleId("__new__");
  }

  function closeRoleEditor() {
    setEditingRoleId(null);
    setDraftRole(null);
  }

  function saveDraftRole() {
    if (!draftRole) return;
    const next = { ...draftRole, role: draftRole.role.trim(), duty: draftRole.duty.trim(), term: draftRole.term?.trim() || activeTermLabel, summary: draftRole.summary?.trim() };
    if (!next.role || !next.duty) {
      notify("请填写岗位名称和岗位职责", "error");
      return;
    }
    update((current) => ({ ...current, cadres: [...(current.cadres ?? []), next] }));
    setDraftRole(null);
    setEditingRoleId(null);
    notify("班干部岗位已新增", "success");
  }

  async function removeRole(id: string) {
    if (id === "__new__") {
      closeRoleEditor();
      return;
    }
    const target = roles.find((item) => item.id === id);
    if (target && !await requestDangerConfirm(`岗位“${target.role}”会从班干部台账中移除。`)) return;
    update((d) => ({ ...d, cadres: (d.cadres ?? []).filter((item) => item.id !== id) }));
    if (editingRoleId === id) closeRoleEditor();
    if (roleStudentPickerId === id) setRoleStudentPickerId(null);
  }

  function candidatesForRole(role: CadreRole) {
    if (roleKind(role) !== "小组长") return data.students;
    const group = roleGroupNumber(role);
    return Number.isFinite(group) ? data.students.filter((student) => student.group === group) : data.students;
  }

  function roleGroupNumber(role: CadreRole) {
    const group = Number(role.role.match(/第(\d+)组/)?.[1]);
    return Number.isFinite(group) ? group : groupNumberOptions[0] ?? 1;
  }

  function changeRoleGroup(role: CadreRole, group: number) {
    const candidates = data.students.filter((student) => student.group === group);
    edit(role.id, { role: `第${group}组组长`, studentId: candidates[0]?.id ?? "" });
  }

  function renderRoleRow(role: CadreRole) {
    const student = data.students.find((item) => item.id === role.studentId);
    return <article className="cadre3-row" key={role.id}>
      <div className="cadre3-role-cell">
        <i>{(role.scope ?? "班级管理") === "小组管理" ? "组" : "班"}</i>
        <div><b>{role.role}</b><span>{role.duty}</span></div>
      </div>
      <span>{student?.name || "待任命"}</span>
      <span>{roleKind(role)}</span>
      <span>{role.term || activeTermLabel}</span>
      <em>{role.status ?? "在任"}</em>
      <strong>{role.weeklyScore ?? 3}/5</strong>
      <div className="cadre3-row-actions"><button onClick={() => setEditingRoleId(role.id)}>编辑</button><button onClick={() => copyTextToClipboard(`兹聘任 ${student?.name || "某同学"} 为本班 ${role.role}，负责：${role.duty}`, "已复制聘任书")}>复制</button></div>
    </article>;
  }

  return <div className="cadre3-page">
    <WorkbenchPageHeader icon="🎖️" tone="iris" title="班干部岗位" description="先在列表里看清岗位和任期，点击编辑再处理职责、评价和聘任书，避免把所有长内容挤在主页面。" actions={<div className="cadre3-actions"><button className="primary workbench-header-primary" onClick={() => addRole("班级管理")}>新增班委岗位</button><button onClick={() => addRole("小组管理", missingGroups[0] ?? groupNumberOptions[0])}>新增小组长</button></div>} />
    <section className="campus-statistics"><div><span>班委岗位</span><b>{committeeRoles.length}</b><small>班级管理</small></div><div><span>小组长</span><b>{groupRoles.length}</b><small>{missingGroups.length ? `${missingGroups.length} 组未设置` : "已覆盖小组"}</small></div><div><span>平均履职</span><b>{Math.round(roles.reduce((sum, role) => sum + (role.weeklyScore ?? 0), 0) / Math.max(1, roles.length))}</b><small>满分 5 分</small></div></section>

    <main className="cadre3-ledger">
      <header className="cadre3-ledger-head">
          <div><span>岗位列表</span><h3>{tab === "全部" ? "全部岗位" : tab}</h3><p>主列表只保留关键字段；职责和评价在编辑窗口中维护。</p></div>
          <nav>{(["全部", "班委", "小组长"] as const).map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</nav>
      </header>
      <section className="cadre3-table">
        <div className="cadre3-table-head"><span>岗位</span><span>学生</span><span>类型</span><span>任期</span><span>状态</span><span>评分</span><span>操作</span></div>
        {activeRoles.length ? activeRoles.map((role) => renderRoleRow(role)) : <div className="cadre3-empty"><b>还没有对应岗位</b><p>点击上方新增岗位，选择学生并填写职责后会自动形成任期记录。</p><button onClick={() => addRole(tab === "小组长" ? "小组管理" : "班级管理", groupNumbers[0])}>新增岗位</button></div>}
      </section>
    </main>
    {editingRole && <div className="cadre3-modal-backdrop" onClick={closeRoleEditor}>
      <section className="cadre3-modal" role="dialog" aria-modal="true" aria-label="班干部岗位" onClick={(event) => event.stopPropagation()}>
        <header><div><span>{editingRoleId === "__new__" ? "新增岗位" : "编辑岗位"}</span><h3>{editingRole.role || "填写岗位名称"}</h3><p>{editingRoleId === "__new__" ? "填写完成后点击保存，未保存不会加入班干部台账。" : "这里维护详细职责、履职评价和聘任书内容。"}</p></div><button type="button" onClick={closeRoleEditor}>关闭</button></header>
        <div className="cadre3-form">
          <label><span>岗位名称</span><input value={editingRole.role} onChange={(e) => edit(editingRole.id, { role: e.target.value })} /></label>
          <label><span>岗位类型</span><select value={editingRole.scope ?? "班级管理"} onChange={(e) => {
            const scope = e.target.value as CadreRole["scope"];
            if (scope === "小组管理") {
              const group = roleGroupNumber(editingRole);
              const candidates = data.students.filter((student) => student.group === group);
              edit(editingRole.id, { scope, role: `第${group}组组长`, studentId: candidates[0]?.id ?? "" });
              return;
            }
            edit(editingRole.id, { scope, role: roleKind(editingRole) === "小组长" ? "新班委岗位" : editingRole.role });
          }}><option value="班级管理">班委</option><option value="小组管理">小组长</option></select></label>
          {roleKind(editingRole) === "小组长" && <label><span>负责小组</span><select value={roleGroupNumber(editingRole)} onChange={(e) => changeRoleGroup(editingRole, Number(e.target.value))}>{groupNumberOptions.map((group) => <option value={group} key={group}>第{group}组</option>)}</select></label>}
          <label><span>任职学生</span><button className="student-picker-trigger" onClick={() => setRoleStudentPickerId(editingRole.id)}><span>{data.students.find((student) => student.id === editingRole.studentId)?.name ?? "待选择"}</span><em>选择</em></button></label>
          <label><span>任期</span><input value={editingRole.term ?? activeTermLabel} onChange={(e) => edit(editingRole.id, { term: e.target.value })} /></label>
          <label><span>状态</span><select value={editingRole.status ?? "在任"} onChange={(e) => edit(editingRole.id, { status: e.target.value as CadreRole["status"] })}><option>在任</option><option>试用</option><option>轮换</option></select></label>
          <label><span>履职评分</span><input type="range" min={1} max={5} value={editingRole.weeklyScore ?? 3} onChange={(e) => edit(editingRole.id, { weeklyScore: Number(e.target.value) })} /></label>
          <label className="wide"><span>岗位职责</span><textarea value={editingRole.duty} onChange={(e) => edit(editingRole.id, { duty: e.target.value })} /></label>
          <label className="wide"><span>履职评价 / 任期记录</span><textarea value={editingRole.summary ?? ""} onChange={(e) => edit(editingRole.id, { summary: e.target.value })} /></label>
        </div>
        <footer><button type="button" onClick={() => copyTextToClipboard(`兹聘任 ${data.students.find((student) => student.id === editingRole.studentId)?.name || "某同学"} 为本班 ${editingRole.role}，负责：${editingRole.duty}`, "已复制聘任书")}>复制聘任书</button>{editingRoleId !== "__new__" && <button type="button" className="text-danger" onClick={() => removeRole(editingRole.id)}>删除岗位</button>}<button type="button" className="primary-small" onClick={editingRoleId === "__new__" ? saveDraftRole : closeRoleEditor}>{editingRoleId === "__new__" ? "保存岗位" : "完成"}</button></footer>
      </section>
    </div>}
    {roleStudentPickerId && (() => {
      const role = roleStudentPickerId === "__new__" || roleStudentPickerId === draftRole?.id ? draftRole : roles.find((item) => item.id === roleStudentPickerId);
      if (!role) return null;
      return <StudentLookupDialog
        title="选择任职学生"
        subtitle={roleKind(role) === "小组长" ? `第${roleGroupNumber(role)}组全部成员，可搜索姓名或学号。` : `${role.role} 可从全班候选人中搜索。`}
        students={candidatesForRole(role)}
        selectedId={role.studentId}
        onPick={(student) => { edit(roleStudentPickerId, { studentId: student.id }); setRoleStudentPickerId(null); }}
        onClose={() => setRoleStudentPickerId(null)}
      />;
    })()}
  </div>;
}

function Records({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [studentId, setStudentId] = useState("");
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [studentPickerKeyword, setStudentPickerKeyword] = useState("");
  const [studentPickerRange, setStudentPickerRange] = useState("常用");
  const [type, setType] = useState("家访登记");
  const [channel, setChannel] = useState("微信");
  const [purpose, setPurpose] = useState("");
  const [home, setHome] = useState("");
  const [content, setContent] = useState("");
  const [opinion, setOpinion] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [recordTime, setRecordTime] = useState(localCommunicationDate());
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [filter, setFilter] = useState("全部类型");
  const [recordStatus, setRecordStatus] = useState("全部状态");
  const [keyword, setKeyword] = useState("");
  const [recordError, setRecordError] = useState("");
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "class-1";
  const classRecords = communicationRecordsForClass(data, activeClassId);
  const selectedStudent = data.students.find((item) => item.id === studentId);
  useEffect(() => {
    if (studentId && !data.students.some((item) => item.id === studentId)) {
      setStudentId("");
    }
  }, [data.activeClassId, data.students, studentId]);
  const sortedStudents = [...data.students].sort((a, b) => {
    const aNo = Number.parseInt(String(a.studentNo ?? "").replace(/\D/g, ""), 10);
    const bNo = Number.parseInt(String(b.studentNo ?? "").replace(/\D/g, ""), 10);
    if (Number.isFinite(aNo) && Number.isFinite(bNo) && aNo !== bNo) return aNo - bNo;
    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });
  const pickerRangeSize = 20;
  const pickerRanges = Array.from({ length: Math.ceil(sortedStudents.length / pickerRangeSize) }, (_, index) => {
    const start = index * pickerRangeSize;
    const end = Math.min(sortedStudents.length, start + pickerRangeSize);
    return { key: `range-${index}`, label: `${start + 1}-${end}`, start, end };
  });
  const recentStudentIds = Array.from(new Set([studentId, ...classRecords.map((record) => record.studentId ?? data.students.find((item) => item.name === record.student)?.id ?? "")])).filter(Boolean).slice(0, 8);
  const recentStudents = recentStudentIds.map((id) => data.students.find((item) => item.id === id)).filter((item): item is Student => Boolean(item));
  const searchText = studentPickerKeyword.trim();
  const activeRange = pickerRanges.find((item) => item.key === studentPickerRange);
  const pickerStudents = searchText
    ? sortedStudents.filter((item) => `${item.name}${item.studentNo ?? ""}`.includes(searchText))
    : activeRange
      ? sortedStudents.slice(activeRange.start, activeRange.end)
      : recentStudents;
  const pickerTitle = searchText ? `全班搜索结果 ${pickerStudents.length} 人` : activeRange ? `名单序号 ${activeRange.label}` : "常用学生";
  function pickStudent(nextStudent: Student) {
    setStudentId(nextStudent.id);
    setStudentPickerOpen(false);
  }
  function readRecordField(text: string, label: string) {
    return text.split("｜").find((part) => part.startsWith(`${label}：`))?.slice(label.length + 1).trim() ?? "";
  }
  function openAddRecord() {
    setEditingRecordId(null);
    setStudentId("");
    setType("家访登记");
    setChannel("微信");
    setPurpose("");
    setHome("");
    setContent("");
    setOpinion("");
    setFollowUp("");
    setRecordTime(localCommunicationDate());
    setRecordError("");
    setRecordModalOpen(true);
  }
  function openEditRecord(record: CommunicationRecord) {
    const recordStudent = data.students.find((item) => item.id === record.studentId) ?? data.students.find((item) => item.name === record.student);
    setEditingRecordId(record.id);
    setStudentId(recordStudent?.id ?? "");
    setType(record.type);
    setChannel(record.channel ?? "面谈");
    setRecordTime(record.date || localCommunicationDate());
    setPurpose(readRecordField(record.content, "目的") || "沟通情况补录");
    setHome(readRecordField(record.content, "家庭情况") || readRecordField(record.content, "家庭与在校情况"));
    setContent(readRecordField(record.content, "沟通内容") || record.content);
    setOpinion(record.parentFeedback ?? "");
    setFollowUp(record.followUp ?? "");
    setRecordError("");
    setRecordModalOpen(true);
  }
  function saveRecord() {
    const draft = { id: editingRecordId ?? undefined, studentId, type, channel, date: recordTime, purpose, home, content, parentFeedback: opinion, followUp };
    const preview = saveCommunicationRecord(data, activeClassId, draft, () => "record-preview");
    if (preview.error) { setRecordError(preview.error); return; }
    setRecordError("");
    update((current) => saveCommunicationRecord(current, activeClassId, draft, makeId).data ?? current);
    setRecordModalOpen(false);
  }
  async function deleteRecord(record: CommunicationRecord) {
    const confirmed = await requestDangerConfirm(`${record.student} 的这条${record.type}记录会从家校沟通台账中移除。`);
    if (!confirmed) return;
    update((current) => removeCommunicationRecord(current, activeClassId, record.id));
  }
  const types = ["全部类型", ...Array.from(new Set(classRecords.map((record) => record.type)))];
  const visibleRecords = classRecords.filter((record) => {
    const text = `${record.student}${record.type}${record.channel}${record.content}${record.parentFeedback}${record.followUp}`;
    return (filter === "全部类型" || record.type === filter) && (recordStatus === "全部状态" || record.status === recordStatus) && (!keyword.trim() || text.includes(keyword.trim()));
  });
  const followCount = classRecords.filter((record) => record.status === "待跟进").length;
  const resolvedCount = classRecords.filter((record) => record.status === "已跟进" || record.status === "已归档").length;
  const involvedCount = new Set(classRecords.map((record) => record.studentId ?? record.student)).size;
  return <>
    <WorkbenchPageHeader icon="💬" tone="berry" title="沟通记录" description="按学生、类型和状态查找记录，待跟进事项优先处理。" actions={<button type="button" className="record3-primary workbench-header-primary" onClick={openAddRecord}>新增沟通记录</button>} />
    <section className="record3-page">
      <div className="record3-progressline"><span>当前班级</span><b>{classRecords.length} 条沟通记录</b><em>{followCount} 条待跟进</em><em>{resolvedCount} 条已处理</em></div>
      <NotificationDrafts data={data} update={update} />

      <section className="record3-ledger">
        <header>
          <div><span>历史记录</span><h3>{visibleRecords.length} 条</h3></div>
        </header>
        <div className="record3-ledger-toolbar">
          <nav className="record3-status-tabs">{(["全部状态", "待跟进", "已跟进", "已归档"] as const).map((item) => <button type="button" className={recordStatus === item ? "active" : ""} key={item} onClick={() => setRecordStatus(item)}>{item}<span>{item === "全部状态" ? classRecords.length : classRecords.filter((record) => record.status === item).length}</span></button>)}</nav>
          <div className="record3-filters"><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜学生、内容、反馈、跟进" /><select value={filter} onChange={(e) => setFilter(e.target.value)}>{types.map((item) => <option key={item}>{item}</option>)}</select></div>
        </div>
        <div className="record3-table">
          <div className="record3-head"><span>学生</span><span>沟通时间</span><span>类型/方式</span><span>沟通摘要</span><span>反馈与跟进</span><span>状态</span><span>操作</span></div>
          {visibleRecords.length ? visibleRecords.map((r) => <article key={r.id} className="record3-row"><b><i>{r.student.slice(0,1)}</i><span>{r.student}</span></b><time>{r.date}</time><span>{r.type}<small>{r.channel ?? "面谈"}</small></span><p>{r.content}</p><p>{r.parentFeedback && <small>反馈：{r.parentFeedback}</small>}{r.followUp && <small>跟进：{r.followUp}</small>}</p><select value={r.status ?? "待跟进"} onChange={(e) => update((current) => patchCommunicationStatus(current, activeClassId, r.id, e.target.value as CommunicationRecord["status"]))}><option>待跟进</option><option>已跟进</option><option>已归档</option></select><div><button type="button" onClick={() => openEditRecord(r)}>编辑</button><button type="button" onClick={() => copyTextToClipboard(`${r.student}｜${r.type}｜${r.content}｜${r.followUp ?? ""}`, "已复制沟通记录")}>复制</button><button type="button" onClick={() => deleteRecord(r)}>删除</button></div></article>) : <div className="record3-empty">没有符合条件的沟通记录。</div>}
        </div>
      </section>
      {recordModalOpen && <div className="record3-modal-backdrop" onClick={() => setRecordModalOpen(false)}>
        <section className="record3-edit-modal" role="dialog" aria-modal="true" aria-labelledby="record-editor-title" onClick={(event) => event.stopPropagation()}>
           <header><div><span>{editingRecordId ? "编辑记录" : "新增记录"}</span><h3 id="record-editor-title">{selectedStudent?.name || "请选择学生"} · {type}</h3></div><button type="button" onClick={() => setRecordModalOpen(false)}>关闭</button></header>
          <div className="record3-fields">
            <label className="record3-student-picker"><span>学生</span><button type="button" onClick={() => setStudentPickerOpen(true)}><span className="record3-student-main">{selectedStudent ? <><b>{selectedStudent.name}</b><small>{selectedStudent.studentNo ? `学号 ${selectedStudent.studentNo}` : "未填学号"}</small></> : <><b>选择学生</b><small>搜索姓名或学号</small></>}</span><em>选择学生</em></button></label>
            <label><span>时间维度</span><input value={recordTime} onChange={(e) => setRecordTime(e.target.value)} placeholder="如 2026-08-06、8月家访、第3周周五" /></label>
            <label><span>类型</span><select value={type} onChange={(e) => setType(e.target.value)}>{["家访登记", "谈心记录", "作业跟进", "纪律表现", "表扬记录", "心理关注"].map((t) => <option key={t}>{t}</option>)}</select></label>
            <label><span>方式</span><select value={channel} onChange={(e) => setChannel(e.target.value)}>{["微信", "电话", "面谈", "家访", "班级群"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="full"><span>沟通目的</span><input value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label>
            <label className="wide"><span>家庭与在校情况</span><textarea value={home} onChange={(e) => setHome(e.target.value)} /></label>
            <label className="wide"><span>沟通内容</span><textarea value={content} onChange={(e) => setContent(e.target.value)} /></label>
            <label className="wide"><span>家长反馈</span><textarea value={opinion} onChange={(e) => setOpinion(e.target.value)} /></label>
            <label className="wide"><span>下一步跟进</span><textarea value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></label>
          </div>
          {recordError && <p className="record3-form-error" role="alert">{recordError}</p>}
          <footer><button type="button" onClick={() => setRecordModalOpen(false)}>取消</button><button type="button" className="record3-primary" onClick={saveRecord}>{editingRecordId ? "保存修改" : "保存记录"}</button></footer>
        </section>
      </div>}
      {studentPickerOpen && <div className="record3-picker-backdrop" onClick={() => setStudentPickerOpen(false)}>
        <section className="record3-picker-modal" role="dialog" aria-modal="true" aria-labelledby="record-student-picker-title" onClick={(event) => event.stopPropagation()}>
          <header><div><span>全班学生</span><h3 id="record-student-picker-title">选择沟通对象</h3></div><button type="button" onClick={() => setStudentPickerOpen(false)}>关闭</button></header>
          <div className="record3-picker-tools"><input value={studentPickerKeyword} onChange={(event) => setStudentPickerKeyword(event.target.value)} placeholder="输入姓名或学号搜索全班" /><nav><button type="button" className={studentPickerRange === "常用" && !searchText ? "active" : ""} onClick={() => { setStudentPickerRange("常用"); setStudentPickerKeyword(""); }}>常用</button>{pickerRanges.map((range) => <button type="button" className={studentPickerRange === range.key && !searchText ? "active" : ""} key={range.key} onClick={() => { setStudentPickerRange(range.key); setStudentPickerKeyword(""); }}>{range.label}</button>)}</nav></div>
          <div className="record3-picker-caption"><b>{pickerTitle}</b><span>{searchText ? "正在按姓名和学号搜索全班名单" : activeRange ? "按名单顺序分段浏览，不一次性铺满全班" : "默认只显示当前学生和已有沟通记录"}</span></div>
          <div className="record3-picker-list">
            {pickerStudents.length ? pickerStudents.map((item) => <button type="button" className={item.id === studentId ? "selected" : ""} key={item.id} onClick={() => pickStudent(item)}><i>{item.name.slice(0,1)}</i><span><b>{item.name}</b><small>{item.studentNo || "未填学号"} · {data.records.filter((record) => recordBelongsToStudent(record, item, activeClassId)).length}条记录</small></span></button>) : <p>{searchText ? "没有匹配的学生。" : "输入姓名或学号搜索全班学生，或选择上方名单序号段浏览。"}</p>}
          </div>
        </section>
      </div>}
    </section>
  </>;
}

type ScoreLevel = "优秀" | "临界" | "帮扶";
function scoreSubjects(exam: ScoreExam) {
  return exam.subjects.length ? exam.subjects : ["总分"];
}

function scoreValue(exam: ScoreExam, student: Student, subject: string) {
  return scoreEntry(exam, student.id, subject) ?? 0;
}

function scoreTotal(exam: ScoreExam, student: Student) {
  return studentScoreSummary(exam, student.id).total ?? 0;
}

function scoreAverage(exam: ScoreExam, student: Student) {
  return studentScoreSummary(exam, student.id).average ?? 0;
}

function scoreWeakSubject(exam: ScoreExam, student: Student) {
  return studentScoreSummary(exam, student.id).weakSubject ?? "待录入";
}

function autoScoreLevel(average: number): ScoreLevel {
  if (average < 80) return "帮扶";
  if (average < 90) return "临界";
  return "优秀";
}

function defaultScoreAdvice(level: ScoreLevel, _weakSubject: string) {
  if (level === "帮扶") return "安排一次错题复盘和学生面谈，先明确本周最小改进目标。";
  if (level === "临界") return "做一次阶段复盘，结合课堂表现和订正情况制定跟进动作。";
  return "保持当前节奏，整理有效学习方法，可结合学生实际做经验分享。";
}

function parseSubjects(text: string) {
  return Array.from(new Set(text.split(/[，,、\s]+/).map((item) => item.trim()).filter(Boolean)));
}

type ScoreRange = { id: string; label: string; min: number; max: number };

function scoreSubjectKey(subject: string) {
  return subject === "总分" ? "__total" : subject;
}

function subjectMaxScore(exam: ScoreExam, subject: string): number {
  if (subject === "总分") return scoreSubjects(exam).reduce((sum, item) => sum + subjectMaxScore(exam, item), 0);
  return exam.subjectMaxScores?.[subject] ?? 100;
}

function defaultScoreRanges(maxScore: number): ScoreRange[] {
  const safeMax = Math.max(1, Math.round(maxScore || 100));
  const excellentMin = Math.ceil(safeMax * 0.9);
  const goodMin = Math.ceil(safeMax * 0.8);
  const passMin = Math.ceil(safeMax * 0.6);
  return [
    { id: "excellent", label: "优秀", min: excellentMin, max: safeMax },
    { id: "good", label: "良好", min: goodMin, max: excellentMin - 1 },
    { id: "pass", label: "及格", min: passMin, max: goodMin - 1 },
    { id: "fail", label: "不及格", min: 0, max: passMin - 1 },
  ];
}

function scoreRangesFor(exam: ScoreExam, subject: string) {
  const key = scoreSubjectKey(subject);
  return exam.scoreRanges?.[key]?.length ? exam.scoreRanges[key] : defaultScoreRanges(subjectMaxScore(exam, subject));
}

function scoreRowsFor(exam: ScoreExam, students: Student[], reflections: ExamReflection[]) {
  return students.map((student) => {
    const summary = studentScoreSummary(exam, student.id);
    const total = summary.total ?? 0;
    const average = summary.average ?? 0;
    const weakSubject = exam.focusSubjects?.[student.id] ?? scoreWeakSubject(exam, student);
    const level = (exam.levels?.[student.id] as ScoreLevel | undefined) ?? autoScoreLevel(average);
    const advice = exam.advice?.[student.id] ?? (summary.enteredCount ? defaultScoreAdvice(level, weakSubject) : "成绩尚未录入，暂不生成跟进结论。");
    const hasReflection = reflections.some((item) => item.studentId === student.id && item.examId === exam.id);
    const followUp = Boolean(exam.followUpStudentIds?.includes(student.id));
    return { student, total, average, weakSubject, level, advice, hasReflection, followUp, enteredCount: summary.enteredCount, complete: summary.complete };
  });
}

function Scores(props: { workspaceToken: string; data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const activeClassId = props.data.activeClassId ?? props.data.rosterClasses?.[0]?.id ?? "class-1";
  if (!scoreExamsForClass(props.data, activeClassId).length) return <EmptyScoreWorkspace data={props.data} classId={activeClassId} update={props.update} mobile={false} />;
  return <ScoresWithExam {...props} />;
}

function ScoresWithExam({ workspaceToken, data, update }: { workspaceToken: string; data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "class-1";
  const classExams = scoreExamsForClass(data, activeClassId);
  const exams = classExams;
  const [examId, setExamId] = useState(exams[0]?.id ?? "");
  const exam = exams.find((item) => item.id === examId) ?? exams[0];
  const subjects = scoreSubjects(exam);
  const allSubjects = Array.from(new Set(exams.flatMap((item) => scoreSubjects(item))));
  const [keyword, setKeyword] = useState("");
  const [detailSubjectFilter, setDetailSubjectFilter] = useState("全部");
  const [groupFilter, setGroupFilter] = useState("全部小组");
  const [scoreRangeFilter, setScoreRangeFilter] = useState("全部");
  const [followFilter, setFollowFilter] = useState<"全部" | "已标记" | "未标记">("全部");
  const [sortKey, setSortKey] = useState("priority");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [examKeyword, setExamKeyword] = useState("");
  const [examSubjectFilter, setExamSubjectFilter] = useState("全部");
  const [examYearFilter, setExamYearFilter] = useState("全部");
  const [examMonthFilter, setExamMonthFilter] = useState("全部");
  const [examLibrarySort, setExamLibrarySort] = useState("date-desc");
  const [examPage, setExamPage] = useState(1);
  const [showExamLibrary, setShowExamLibrary] = useState(false);
  const [showExamSetup, setShowExamSetup] = useState(false);
  const [showExamEdit, setShowExamEdit] = useState(false);
  const [showFilterEditor, setShowFilterEditor] = useState(false);
  const [showBatchScore, setShowBatchScore] = useState(false);
  const [scoreWorkspaceView, setScoreWorkspaceView] = useState<"records" | "trends" | "analysis">("records");
  const [newExamTitle, setNewExamTitle] = useState("");
  const [newExamDate, setNewExamDate] = useState(today());
  const [subjectDraft, setSubjectDraft] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState(today());
  const [editSubjects, setEditSubjects] = useState("");
  const [filterSubjectDraft, setFilterSubjectDraft] = useState("总分");
  const [maxScoreDraft, setMaxScoreDraft] = useState("100");
  const [rangeDrafts, setRangeDrafts] = useState<ScoreRange[]>([]);
  const [batchSubject, setBatchSubject] = useState("");
  const [batchScoreValue, setBatchScoreValue] = useState("");
  const [batchScoreError, setBatchScoreError] = useState("");
  const tableSubjects = detailSubjectFilter !== "全部" && subjects.includes(detailSubjectFilter) ? [detailSubjectFilter] : subjects;
  const activeRangeSubject = detailSubjectFilter !== "全部" ? detailSubjectFilter : "总分";
  const activeRanges = scoreRangesFor(exam, activeRangeSubject);
  const rows = scoreRowsFor(exam, data.students, data.examReflections ?? []);
  const visible = rows.filter((row) => {
    const text = `${row.student.name}${row.student.studentNo ?? ""}${row.advice}`;
    const rangeScore = activeRangeSubject === "总分" ? (row.complete ? row.total : null) : scoreEntry(exam, row.student.id, activeRangeSubject);
    const range = activeRanges.find((item) => item.id === scoreRangeFilter);
    const matchRange = !range || scoreRangeFilter === "全部" || (rangeScore != null && rangeScore >= range.min && rangeScore <= range.max);
    const matchFollow = followFilter === "全部" || (followFilter === "已标记" && row.followUp) || (followFilter === "未标记" && !row.followUp);
    const matchGroup = groupFilter === "全部小组" || row.student.group === Number(groupFilter);
    return matchRange && matchFollow && matchGroup && (!keyword.trim() || text.includes(keyword.trim()));
  }).sort((a, b) => {
    const direction = sortDir === "desc" ? -1 : 1;
    if (sortKey === "priority") {
      const priority = (row: typeof a) => subjects.some((subject) => exam.scores[row.student.id]?.[subject] == null) ? 0 : row.followUp ? 1 : row.average < 60 ? 2 : 3;
      return priority(a) - priority(b) || `${a.student.studentNo ?? ""}`.localeCompare(`${b.student.studentNo ?? ""}`, "zh-Hans-CN", { numeric: true });
    }
    if (sortKey === "studentNo") return `${a.student.studentNo ?? ""}`.localeCompare(`${b.student.studentNo ?? ""}`, "zh-Hans-CN", { numeric: true }) * direction;
    if (sortKey === "name") return a.student.name.localeCompare(b.student.name, "zh-Hans-CN") * direction;
    if (sortKey === "average") return (a.average - b.average) * direction;
    if (sortKey.startsWith("subject:")) {
      const subject = sortKey.replace("subject:", "");
      return (scoreValue(exam, a.student, subject) - scoreValue(exam, b.student, subject)) * direction;
    }
    return (a.total - b.total) * direction;
  });
  const selectedVisibleIds = visible.map((row) => row.student.id).filter((id) => selectedIds.includes(id));
  const allVisibleSelected = visible.length > 0 && selectedVisibleIds.length === visible.length;
  const enteredRows = rows.filter((item) => item.enteredCount > 0);
  const average = enteredRows.length ? Math.round(enteredRows.reduce((sum, item) => sum + item.average, 0) / enteredRows.length) : null;
  const followCount = rows.filter((item) => item.followUp).length;
  const examSummaries = exams.map((item) => {
    const itemRows = scoreRowsFor(item, data.students, data.examReflections ?? []);
    const itemSubjects = scoreSubjects(item);
    const scoreCount = data.students.length * itemSubjects.length;
    const enteredCount = scoreEntryCount(item, data.students);
    const complete = scoreCount > 0 && enteredCount >= scoreCount;
    return {
      exam: item,
      average: itemRows.some((row) => row.enteredCount) ? Math.round(itemRows.filter((row) => row.enteredCount).reduce((sum, row) => sum + row.average, 0) / itemRows.filter((row) => row.enteredCount).length) : null,
      subjects: itemSubjects,
      follow: itemRows.filter((row) => row.followUp).length,
      enteredCount,
      scoreCount,
      complete,
    };
  });
  const activeExamSummary = examSummaries.find((item) => item.exam.id === exam.id) ?? examSummaries[0];
  const scoreDistribution = [
    { label: "90分及以上", count: rows.filter((item) => item.complete && item.average >= 90).length, color: "jade" },
    { label: "80–89分", count: rows.filter((item) => item.complete && item.average >= 80 && item.average < 90).length, color: "blue" },
    { label: "60–79分", count: rows.filter((item) => item.complete && item.average >= 60 && item.average < 80).length, color: "marigold" },
    { label: "60分以下", count: rows.filter((item) => item.complete && item.average < 60).length, color: "coral" },
  ];
  const distributionMax = Math.max(1, ...scoreDistribution.map((item) => item.count));
  const subjectAverages = subjects.map((subject) => {
    const values = data.students.map((student) => scoreEntry(exam, student.id, subject)).filter((value): value is number => value != null);
    return { subject, average: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null };
  });
  const examYearOptions = Array.from(new Set(exams.map((item) => item.date.slice(0, 4)).filter(Boolean))).sort((a, b) => b.localeCompare(a));
  const examMonthOptions = Array.from(new Set(exams.filter((item) => examYearFilter === "全部" || item.date.startsWith(examYearFilter)).map((item) => item.date.slice(0, 7)).filter(Boolean))).sort((a, b) => b.localeCompare(a));
  const visibleExams = examSummaries.filter((item) => {
    const text = `${item.exam.title}${item.exam.date}${item.subjects.join("")}`;
    const matchSubject = examSubjectFilter === "全部" || item.subjects.includes(examSubjectFilter);
    const matchYear = examYearFilter === "全部" || item.exam.date.startsWith(examYearFilter);
    const matchMonth = examMonthFilter === "全部" || item.exam.date.startsWith(examMonthFilter);
    return matchSubject && matchYear && matchMonth && (!examKeyword.trim() || text.includes(examKeyword.trim()));
  }).sort((a, b) => {
    if (examLibrarySort === "date-asc") return a.exam.date.localeCompare(b.exam.date);
    return b.exam.date.localeCompare(a.exam.date);
  });
  const examPageSize = 12;
  const totalExamPages = Math.max(1, Math.ceil(visibleExams.length / examPageSize));
  const safeExamPage = Math.min(examPage, totalExamPages);
  const pagedExams = visibleExams.slice((safeExamPage - 1) * examPageSize, safeExamPage * examPageSize);
  const activeBatchSubject = subjects.includes(batchSubject) ? batchSubject : subjects[0] ?? "";
  const activeBatchMax = activeBatchSubject ? subjectMaxScore(exam, activeBatchSubject) : 0;
  const batchRows = data.students.filter((student) => selectedIds.includes(student.id));
  const activeBatchScore = batchScoreValue === "" ? "" : Math.max(0, Math.min(activeBatchMax, Number(batchScoreValue) || 0));
  const groupOptions = Array.from(new Set(data.students.map((student) => student.group))).sort((a, b) => a - b);
  const examIdsKey = exams.map((item) => item.id).join("|");
  const firstExamId = exams[0]?.id ?? "";

  useEffect(() => {
    if (!examIdsKey.split("|").includes(examId)) setExamId(firstExamId);
  }, [examId, examIdsKey, firstExamId]);
  useEffect(() => { setSelectedIds([]); }, [exam.id]);
  useEffect(() => { setExamPage(1); }, [examKeyword, examSubjectFilter, examYearFilter, examMonthFilter, examLibrarySort]);
  useEffect(() => {
    if (examMonthFilter !== "全部" && examYearFilter !== "全部" && !examMonthFilter.startsWith(examYearFilter)) setExamMonthFilter("全部");
  }, [examYearFilter, examMonthFilter]);

  function updateExam(nextExam: ScoreExam) {
    update((current) => patchScoreExam(current, activeClassId, nextExam.id, nextExam));
  }
  function setScore(studentId: string, subject: string, value: string) {
    const numeric = value.trim() === "" ? null : Number(value);
    const preview = setScoreEntries(data, activeClassId, exam.id, [studentId], subject, numeric);
    if (preview.error) { notify(preview.error, "error"); return; }
    update((current) => setScoreEntries(current, activeClassId, exam.id, [studentId], subject, numeric).data ?? current);
  }
  function openBatchScore() {
    const subject = detailSubjectFilter !== "全部" && subjects.includes(detailSubjectFilter) ? detailSubjectFilter : subjects[0] ?? "";
    setBatchSubject(subject);
    setBatchScoreValue("");
    setBatchScoreError("");
    setShowBatchScore(true);
  }
  function applyBatchScore() {
    const value = Number(batchScoreValue);
    if (!selectedIds.length) {
      setBatchScoreError("请先在学生列表中选择同分学生。");
      return;
    }
    if (!activeBatchSubject) {
      setBatchScoreError("请选择要录入的科目。");
      return;
    }
    if (!Number.isFinite(value)) {
      setBatchScoreError("请填写有效分数。");
      return;
    }
    const safeScore = Math.max(0, Math.min(subjectMaxScore(exam, activeBatchSubject), value));
    const preview = setScoreEntries(data, activeClassId, exam.id, selectedIds, activeBatchSubject, safeScore);
    if (preview.error) { setBatchScoreError(preview.error); return; }
    update((current) => setScoreEntries(current, activeClassId, exam.id, selectedIds, activeBatchSubject, safeScore).data ?? current);
    setBatchScoreError("");
    setShowBatchScore(false);
    setSelectedIds([]);
  }
  function setAdvice(studentId: string, advice: string) {
    updateExam({ ...exam, advice: { ...(exam.advice ?? {}), [studentId]: advice } });
  }
  function toggleFollow(studentId: string) {
    const list = exam.followUpStudentIds ?? [];
    updateExam({ ...exam, followUpStudentIds: list.includes(studentId) ? list.filter((id) => id !== studentId) : [...list, studentId] });
  }
  function batchFollow(mark: boolean) {
    const list = exam.followUpStudentIds ?? [];
    const nextList = mark ? Array.from(new Set([...list, ...selectedIds])) : list.filter((id) => !selectedIds.includes(id));
    updateExam({ ...exam, followUpStudentIds: nextList });
    setSelectedIds([]);
  }
  function toggleSelect(studentId: string) {
    setSelectedIds((ids) => ids.includes(studentId) ? ids.filter((id) => id !== studentId) : [...ids, studentId]);
  }
  function toggleSelectVisible() {
    const visibleIds = visible.map((row) => row.student.id);
    setSelectedIds((ids) => allVisibleSelected ? ids.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...ids, ...visibleIds])));
  }
  function addExam() {
    setNewExamTitle("");
    setNewExamDate(today());
    setSubjectDraft("");
    setShowExamSetup(true);
  }
  function confirmAddExam() {
    const nextSubjects = parseSubjects(subjectDraft);
    if (!nextSubjects.length) return;
    const result = createScoreExam(data, activeClassId, { title: newExamTitle, date: newExamDate, subjects: nextSubjects }, makeId);
    if (!result.exam) { notify(result.error ?? "考试创建失败。", "error"); return; }
    const next = result.exam;
    update((current) => createScoreExam(current, activeClassId, { title: newExamTitle, date: newExamDate, subjects: nextSubjects }, () => next.id).data ?? current);
    setExamId(next.id);
    setDetailSubjectFilter("全部");
    setScoreRangeFilter("全部");
    setShowExamSetup(false);
  }
  function openExamEdit() {
    setEditTitle(exam.title);
    setEditDate(exam.date);
    setEditSubjects(subjects.join("，"));
    setShowExamEdit(true);
  }
  async function deleteCurrentExam() {
    if (!await requestDangerConfirm(`${exam.title} 的全部成绩、跟进标记和关联反思都会删除。`, "删除考试", "确认删除")) return;
    update((current) => removeScoreExam(current, activeClassId, exam.id));
    setExamId(exams.find((item) => item.id !== exam.id)?.id ?? "");
    setShowExamEdit(false);
  }
  function confirmExamEdit() {
    const nextSubjects = parseSubjects(editSubjects);
    if (!nextSubjects.length) return;
    const preview = editScoreExam(data, activeClassId, exam.id, { title: editTitle, date: editDate, subjects: nextSubjects });
    if (preview.error) { notify(preview.error, "error"); return; }
    update((current) => editScoreExam(current, activeClassId, exam.id, { title: editTitle, date: editDate, subjects: nextSubjects }).data ?? current);
    if (detailSubjectFilter !== "全部" && !nextSubjects.includes(detailSubjectFilter)) setDetailSubjectFilter("全部");
    setShowExamEdit(false);
  }
  function loadFilterDraft(subject: string) {
    setFilterSubjectDraft(subject);
    setMaxScoreDraft(`${subjectMaxScore(exam, subject)}`);
    setRangeDrafts(scoreRangesFor(exam, subject).map((item) => ({ ...item })));
  }
  function openFilterEditor() {
    loadFilterDraft(activeRangeSubject);
    setShowFilterEditor(true);
  }
  function saveFilterEditor() {
    const key = scoreSubjectKey(filterSubjectDraft);
    const cleanRanges = rangeDrafts.map((item, index) => ({
      id: item.id || `range-${index + 1}`,
      label: item.label.trim() || `区间${index + 1}`,
      min: Math.max(0, Number(item.min) || 0),
      max: Math.max(0, Number(item.max) || 0),
    })).filter((item) => item.max >= item.min);
    const savedRanges = cleanRanges.length ? cleanRanges : defaultScoreRanges(Number(maxScoreDraft) || subjectMaxScore(exam, filterSubjectDraft));
    const nextRanges = { ...(exam.scoreRanges ?? {}), [key]: savedRanges };
    const nextMaxScores = { ...(exam.subjectMaxScores ?? {}) };
    if (filterSubjectDraft !== "总分") nextMaxScores[filterSubjectDraft] = Math.max(1, Number(maxScoreDraft) || 100);
    updateExam({ ...exam, subjectMaxScores: nextMaxScores, scoreRanges: nextRanges });
    setDetailSubjectFilter(filterSubjectDraft === "总分" ? "全部" : filterSubjectDraft);
    setScoreRangeFilter(savedRanges[0]?.id ?? "全部");
    setShowFilterEditor(false);
  }
  function chooseExam(nextExamId: string) {
    setExamId(nextExamId);
    setDetailSubjectFilter("全部");
    setScoreRangeFilter("全部");
    setSelectedIds([]);
    setShowExamLibrary(false);
  }

  return <>
    <WorkbenchPageHeader icon="📈" tone="iris" title="成绩分析" description="录入本次考试，快速找到未录、异常和需要后续跟进的学生。" />
    <section className="score5-page">
      <section className="score5-current workbench-page-context">
        <div className="score5-current-main"><i aria-hidden="true"><CampusIcon name="scores" /></i><span>当前考试</span><h3>{exam.title}</h3><p>{exam.date} · {subjects.join("，")}</p></div>
        <div className="score5-actions"><button type="button" onClick={() => setShowExamLibrary(true)}>切换考试</button><button type="button" onClick={openExamEdit}>编辑考试</button><button type="button" className="score5-primary" onClick={addExam}>新增考试</button></div>
      </section>

      <nav className="score5-workspace-tabs" aria-label="成绩工作视图"><button type="button" className={scoreWorkspaceView === "records" ? "active" : ""} onClick={() => setScoreWorkspaceView("records")}>成绩录入</button><button type="button" className={scoreWorkspaceView === "trends" ? "active" : ""} onClick={() => setScoreWorkspaceView("trends")}>历次趋势</button><button type="button" className={scoreWorkspaceView === "analysis" ? "active" : ""} onClick={() => setScoreWorkspaceView("analysis")}>试卷与知识点</button></nav>

      <section className="campus-statistics">
        <div className="tone-iris"><span>已录平均</span><b>{average ?? "未录入"}</b><small>{subjects.join(" / ")} 已录成绩</small></div>
        <div className="tone-lake"><span>录分进度</span><b>{activeExamSummary?.enteredCount ?? 0}/{activeExamSummary?.scoreCount ?? 0}</b><small>{data.students.length} 名学生</small></div>
        <div className="tone-coral"><span>重点跟进</span><b>{followCount}</b><small>可从列表批量处理</small></div>
      </section>

      {scoreWorkspaceView === "records" && <section className="score5-insights" aria-label="本次考试概览">
        <div className="score5-distribution">
          <header><h3>分数段分布</h3><span>仅统计已录全科目的学生</span></header>
          <div>{scoreDistribution.map((item) => <article className={`tone-${item.color}`} key={item.label}><span><b>{item.label}</b><em>{item.count}人</em></span><i><strong style={{ width: `${Math.max(6, item.count / distributionMax * 100)}%` }} /></i></article>)}</div>
        </div>
        <div className="score5-subject-averages">
          <header><h3>各科平均</h3><span>空白成绩不进入分母</span></header>
          <div>{subjectAverages.map((item, index) => <article className={`tone-${["iris", "jade", "marigold", "lake", "coral"][index % 5]}`} key={item.subject}><span>{item.subject}</span><b>{item.average ?? "未录"}</b></article>)}</div>
        </div>
      </section>}

      {scoreWorkspaceView === "trends" && <ScoreTrends data={data} classId={activeClassId} />}
      {scoreWorkspaceView === "analysis" && <ScoreItemAnalysis data={data} classId={activeClassId} workspaceToken={workspaceToken} exam={exam} students={data.students} update={update} />}

      {scoreWorkspaceView === "records" && <><section className="score5-toolbar">
        <label className="score5-filter-field wide"><span>学生搜索</span><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="姓名、学号或建议" /></label>
        <label className="score5-filter-field"><span>小组</span><select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option>全部小组</option>{groupOptions.map((group) => <option value={group} key={group}>第{group}组</option>)}</select></label>
        <label className="score5-filter-field"><span>显示科目</span><select value={detailSubjectFilter} onChange={(e) => { setDetailSubjectFilter(e.target.value); setScoreRangeFilter("全部"); }}><option>全部</option>{subjects.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="score5-filter-field"><span>分数区间</span><select value={scoreRangeFilter} onChange={(e) => setScoreRangeFilter(e.target.value)}><option>全部</option>{activeRanges.map((item) => <option value={item.id} key={item.id}>{item.label} {item.min}-{item.max}</option>)}</select></label>
        <label className="score5-filter-field"><span>重点标记</span><select value={followFilter} onChange={(e) => setFollowFilter(e.target.value as typeof followFilter)}><option>全部</option><option>已标记</option><option>未标记</option></select></label>
        <label className="score5-filter-field"><span>排序字段</span><select value={sortKey} onChange={(e) => setSortKey(e.target.value)}><option value="priority">待处理优先</option><option value="total">总分</option><option value="average">平均分</option>{subjects.map((item) => <option value={`subject:${item}`} key={item}>{item}</option>)}<option value="studentNo">学号</option><option value="name">姓名</option></select></label>
        <label className="score5-filter-field"><span>排序方式</span><select value={sortDir} disabled={sortKey === "priority"} onChange={(e) => setSortDir(e.target.value as typeof sortDir)}>{sortKey === "priority" ? <option value="asc">未录与重点在前</option> : <><option value="desc">降序</option><option value="asc">升序</option></>}</select></label>
        <button type="button" className="score5-filter-edit" onClick={openFilterEditor}>编辑筛选项</button>
        <div className={`score5-selection ${selectedIds.length ? "active" : ""}`}><span>当前 {visible.length} 人</span><strong>已选 {selectedIds.length} 人</strong>{selectedIds.length > 0 && <><button type="button" onClick={openBatchScore}>批量录分</button><button type="button" onClick={() => batchFollow(true)}>批量标记重点</button><button type="button" onClick={() => batchFollow(false)}>取消重点</button></>}</div>
      </section>

      <section className="score5-table-wrap">
        <table className="score5-table">
          <colgroup>
            <col className="score5-col-check" />
            <col className="score5-col-student" />
            {tableSubjects.map((subject) => <col className="score5-col-score" key={subject} />)}
            <col className="score5-col-total" />
            <col className="score5-col-total" />
            <col className="score5-col-follow" />
            <col className="score5-col-advice" />
          </colgroup>
          <thead><tr><th><label className="score5-select-head"><input type="checkbox" aria-label="全选当前筛选学生" checked={allVisibleSelected} onChange={toggleSelectVisible} /><span>全选</span></label></th><th>学生</th>{tableSubjects.map((subject) => <th key={subject}>{subject}</th>)}<th>总分</th><th>平均</th><th>重点</th><th>建议</th></tr></thead>
          <tbody>
            {visible.map(({ student, total, average, advice, followUp, enteredCount, complete }) => <tr key={student.id}>
              <td><label className="score5-check"><input type="checkbox" aria-label={`${selectedIds.includes(student.id) ? "取消选择" : "选择"}${student.name}`} checked={selectedIds.includes(student.id)} onChange={() => toggleSelect(student.id)} /></label></td>
              <td><span className="score5-student-cell">{student.name}<small>学号 {student.studentNo || "未填"}</small></span></td>
              {tableSubjects.map((subject) => <td key={subject}><input className="score5-score-input" aria-label={`${student.name}${subject}成绩`} type="number" min={0} max={subjectMaxScore(exam, subject)} value={scoreEntry(exam, student.id, subject) ?? ""} onChange={(e) => setScore(student.id, subject, e.target.value)} placeholder="未录" /></td>)}
              <td><strong>{complete ? total : "待补全"}</strong></td>
              <td><strong>{enteredCount ? average : "未录入"}</strong></td>
              <td><button type="button" className={followUp ? "active" : ""} onClick={() => toggleFollow(student.id)}>{followUp ? "已标记" : "标记"}</button></td>
              <td><textarea className="score5-advice" rows={2} aria-label={`${student.name}成绩建议`} value={advice} onChange={(e) => setAdvice(student.id, e.target.value)} /></td>
            </tr>)}
            {!visible.length && <tr><td className="score5-empty" colSpan={tableSubjects.length + 6}>没有符合条件的学生。</td></tr>}
          </tbody>
        </table>
      </section></>}
    </section>

    {showBatchScore && <div className="score5-modal-backdrop" onClick={() => setShowBatchScore(false)}>
      <section className="score5-modal score5-batch-modal" role="dialog" aria-modal="true" aria-label="批量录分" onClick={(event) => event.stopPropagation()}>
        <header><div><span>批量录分</span><h3>{exam.title}</h3></div><button type="button" onClick={() => setShowBatchScore(false)}>关闭</button></header>
        <div className="score5-batch-body">
          <div className="score5-batch-tools">
            <label><span>录入科目</span><select value={activeBatchSubject} onChange={(e) => setBatchSubject(e.target.value)}>{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
            <label><span>统一分数</span><input type="number" min={0} max={activeBatchMax} value={batchScoreValue} onChange={(e) => { setBatchScoreValue(e.target.value); setBatchScoreError(""); }} placeholder={`0-${activeBatchMax}`} /></label>
            <div><span>已选学生</span><b>{selectedIds.length}人</b><small>{activeBatchSubject || "未选择科目"} · 满分 {activeBatchMax}</small></div>
          </div>
          {batchScoreError && <p className="score5-batch-error">{batchScoreError}</p>}
          <div className="score5-batch-list">
            <div className="score5-batch-head"><b>学生</b><b>学号 / 小组</b><b>当前分数</b></div>
            {batchRows.map((student) => <article className="score5-batch-row" key={student.id}>
              <span><b>{student.name}</b></span>
              <span>学号 {student.studentNo || "未填"} · 第{student.group}组</span>
              <em>{activeBatchSubject ? exam.scores[student.id]?.[activeBatchSubject] ?? "未录" : "未录"}</em>
            </article>)}
            {!batchRows.length && <p className="score5-empty">请先在学生列表中选择同分学生。</p>}
          </div>
        </div>
        <footer><span>{batchScoreValue === "" ? "填写同一分数后应用到已选学生。" : `将统一录入 ${activeBatchScore} 分。`}</span><button type="button" onClick={() => setShowBatchScore(false)}>取消</button><button type="button" className="score5-primary" disabled={!selectedIds.length || batchScoreValue === ""} onClick={applyBatchScore}>应用到已选</button></footer>
      </section>
    </div>}

    {showExamLibrary && <div className="score5-modal-backdrop" onClick={() => setShowExamLibrary(false)}>
      <section className="score5-modal score5-library-modal" role="dialog" aria-modal="true" aria-label="切换考试" onClick={(event) => event.stopPropagation()}>
        <header><div><span>考试库</span><h3>切换考试</h3></div><button type="button" onClick={() => setShowExamLibrary(false)}>关闭</button></header>
        <div className="score5-library-tools">
          <label className="wide"><span>关键词</span><input value={examKeyword} onChange={(e) => setExamKeyword(e.target.value)} placeholder="考试名称、科目或日期" /></label>
          <label><span>科目</span><select value={examSubjectFilter} onChange={(e) => setExamSubjectFilter(e.target.value)}><option value="全部">全部科目</option>{allSubjects.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
          <label><span>年份</span><select value={examYearFilter} onChange={(e) => setExamYearFilter(e.target.value)}><option value="全部">全部年份</option>{examYearOptions.map((item) => <option value={item} key={item}>{item}年</option>)}</select></label>
          <label><span>月份</span><select value={examMonthFilter} onChange={(e) => setExamMonthFilter(e.target.value)}><option value="全部">全部月份</option>{examMonthOptions.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
          <label><span>时间排序</span><select value={examLibrarySort} onChange={(e) => setExamLibrarySort(e.target.value)}><option value="date-desc">由新到旧</option><option value="date-asc">由旧到新</option></select></label>
        </div>
        <div className="score5-library-list">
          <table className="score5-library-table">
            <colgroup><col className="exam-name" /><col className="exam-date" /><col className="exam-subjects" /><col className="exam-status" /><col className="exam-action" /></colgroup>
            <thead><tr><th>考试名称</th><th>日期</th><th>科目</th><th>录分</th><th>操作</th></tr></thead>
            <tbody>
              {pagedExams.map((item) => <tr className={item.exam.id === exam.id ? "active" : ""} key={item.exam.id} onClick={() => chooseExam(item.exam.id)}><td><b>{item.exam.title}</b></td><td>{item.exam.date}</td><td>{item.subjects.join("，")}</td><td>{item.complete ? "已录完" : `${item.enteredCount}/${item.scoreCount}`}</td><td><button type="button">{item.exam.id === exam.id ? "当前" : "打开"}</button></td></tr>)}
              {!pagedExams.length && <tr><td colSpan={5}>没有符合条件的考试。</td></tr>}
            </tbody>
          </table>
        </div>
        <footer><button type="button" disabled={safeExamPage <= 1} onClick={() => setExamPage((page) => Math.max(1, page - 1))}>上一页</button><span>{safeExamPage} / {totalExamPages}</span><button type="button" disabled={safeExamPage >= totalExamPages} onClick={() => setExamPage((page) => Math.min(totalExamPages, page + 1))}>下一页</button></footer>
      </section>
    </div>}

    {showExamSetup && <div className="score5-modal-backdrop" onClick={() => setShowExamSetup(false)}>
      <section className="score5-modal" role="dialog" aria-modal="true" aria-label="新增考试" onClick={(event) => event.stopPropagation()}>
        <header><div><h3>新增考试</h3></div><button type="button" onClick={() => setShowExamSetup(false)}>关闭</button></header>
        <div className="score5-modal-form">
          <label><span>考试名称</span><input value={newExamTitle} onChange={(e) => setNewExamTitle(e.target.value)} /></label>
          <label><span>考试日期</span><input value={newExamDate} onChange={(e) => setNewExamDate(e.target.value)} placeholder="2026-08-03" /></label>
          <label className="wide"><span>考试科目</span><input value={subjectDraft} onChange={(e) => setSubjectDraft(e.target.value)} placeholder="例如：语文，数学，英语，或只填物理" /></label>
        </div>
        <footer><button type="button" onClick={() => setShowExamSetup(false)}>取消</button><button type="button" className="score5-primary" disabled={!parseSubjects(subjectDraft).length} onClick={confirmAddExam}>确认新增</button></footer>
      </section>
    </div>}

    {showExamEdit && <div className="score5-modal-backdrop" onClick={() => setShowExamEdit(false)}>
      <section className="score5-modal" role="dialog" aria-modal="true" aria-label="编辑考试" onClick={(event) => event.stopPropagation()}>
        <header><div><span>编辑考试</span><h3>{exam.title}</h3></div><button type="button" onClick={() => setShowExamEdit(false)}>关闭</button></header>
        <div className="score5-modal-form">
          <label><span>考试名称</span><input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></label>
          <label><span>考试日期</span><input value={editDate} onChange={(e) => setEditDate(e.target.value)} /></label>
          <label className="wide"><span>考试科目</span><input value={editSubjects} onChange={(e) => setEditSubjects(e.target.value)} placeholder="语文，数学，英语" /></label>
        </div>
        <footer><button type="button" className="danger-small" onClick={deleteCurrentExam}>删除考试</button><button type="button" onClick={() => setShowExamEdit(false)}>取消</button><button type="button" className="score5-primary" disabled={!parseSubjects(editSubjects).length} onClick={confirmExamEdit}>保存考试</button></footer>
      </section>
    </div>}

    {showFilterEditor && <div className="score5-modal-backdrop" onClick={() => setShowFilterEditor(false)}>
      <section className="score5-modal score5-filter-modal" role="dialog" aria-modal="true" aria-label="满分与分数区间" onClick={(event) => event.stopPropagation()}>
        <header><div><span>筛选项设置</span><h3>满分与分数区间</h3></div><button type="button" onClick={() => setShowFilterEditor(false)}>关闭</button></header>
        <div className="score5-filter-modal-body">
          <div className="score5-filter-controls">
            <label><span>设置对象</span><select value={filterSubjectDraft} onChange={(e) => loadFilterDraft(e.target.value)}><option>总分</option>{subjects.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>{filterSubjectDraft === "总分" ? "总分满分" : "科目满分"}</span><input value={maxScoreDraft} disabled={filterSubjectDraft === "总分"} onChange={(e) => { setMaxScoreDraft(e.target.value); const nextMax = Number(e.target.value); if (nextMax > 0) setRangeDrafts(defaultScoreRanges(nextMax)); }} /></label>
          </div>
          <div className="score5-range-editor">
            <div className="score5-range-head"><b>区间名称</b><b>最低分</b><b>最高分</b><b>操作</b></div>
            {rangeDrafts.map((item, index) => <div className="score5-range-row" key={item.id || index}>
              <input aria-label={`第${index + 1}个区间名称`} value={item.label} onChange={(e) => setRangeDrafts((list) => list.map((range, i) => i === index ? { ...range, label: e.target.value } : range))} />
              <input aria-label={`${item.label}最低分`} type="number" value={item.min} onChange={(e) => setRangeDrafts((list) => list.map((range, i) => i === index ? { ...range, min: Number(e.target.value) || 0 } : range))} />
              <input aria-label={`${item.label}最高分`} type="number" value={item.max} onChange={(e) => setRangeDrafts((list) => list.map((range, i) => i === index ? { ...range, max: Number(e.target.value) || 0 } : range))} />
              <button type="button" onClick={() => setRangeDrafts((list) => list.filter((_, i) => i !== index))}>删除</button>
            </div>)}
          </div>
          <button type="button" className="score5-add-range" onClick={() => setRangeDrafts((list) => [...list, { id: `custom-${Date.now()}`, label: "自定义", min: 0, max: subjectMaxScore(exam, filterSubjectDraft) }])}>新增区间</button>
        </div>
        <footer><button type="button" onClick={() => setShowFilterEditor(false)}>取消</button><button type="button" className="score5-primary" onClick={saveFilterEditor}>保存筛选项</button></footer>
      </section>
    </div>}
  </>;
}

function Reflection({ data, update, open, readOnly }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; open: (id: ModuleId) => void; readOnly: boolean }) {
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "class-1";
  if (!scoreExamsForClass(data, activeClassId).length) return <>
    <WorkbenchPageHeader icon="📝" tone="iris" title="本次考试反思" description="先建立真实考试，再为学生填写考试反思。" />
    <section className="reflection5-page"><section className="reflection5-current workbench-page-context"><div className="reflection5-current-main"><span>考试反思</span><h3>还没有可反思的考试</h3><p>成绩分析中新增考试后，这里会显示对应学生和成绩上下文。</p></div><div className="reflection5-actions"><button type="button" onClick={() => open("scores")}>去成绩分析</button></div></section></section>
  </>;
  return <ReflectionWithExam data={data} update={update} readOnly={readOnly} />;
}

function ReflectionWithExam({ data, update, readOnly }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; readOnly: boolean }) {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "class-1";
  const initialStudentId = params?.get("studentId") || "";
  const initialExamId = params?.get("examId") || "";
  const [selectedKey, setSelectedKey] = useState(initialExamId && initialStudentId ? `${initialExamId}::${initialStudentId}` : "");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [examPage, setExamPage] = useState(1);
  const [savedState, setSavedState] = useState("");
  const [showExamLibrary, setShowExamLibrary] = useState(false);
  const [examKeyword, setExamKeyword] = useState("");
  const [examSubjectFilter, setExamSubjectFilter] = useState("全部");
  const [examYearFilter, setExamYearFilter] = useState("全部");
  const [examMonthFilter, setExamMonthFilter] = useState("全部");
  const [examLibrarySort, setExamLibrarySort] = useState("date-desc");
  const exams = scoreExamsForClass(data, activeClassId);
  const [examFilter, setExamFilter] = useState(() => exams.some((item) => item.id === initialExamId) ? initialExamId : exams[0]?.id ?? "");
  const reflections = examReflectionsForClass(data, activeClassId);
  const libraryRows = exams.flatMap((item) => {
    const subjects = scoreSubjects(item);
    return scoreRowsFor(item, data.students, reflections).map((row) => {
      const reflection = reflections.find((entry) => entry.examId === item.id && entry.studentId === row.student.id);
      const status = reflection?.status ?? (row.followUp ? "重点跟进" : "未填写");
      return { key: `${item.id}::${row.student.id}`, exam: item, subjects, reflection, status, ...row };
    });
  });
  const allSubjects = Array.from(new Set(exams.flatMap((item) => scoreSubjects(item))));
  const activeExam = exams.find((item) => item.id === examFilter) ?? exams[0];
  const examSummaries = exams.map((item) => {
    const rows = scoreRowsFor(item, data.students, reflections);
    const subjects = scoreSubjects(item);
    return {
      exam: item,
      subjects,
      average: rows.some((row) => row.enteredCount) ? Math.round(rows.filter((row) => row.enteredCount).reduce((sum, row) => sum + row.average, 0) / rows.filter((row) => row.enteredCount).length) : null,
      reflected: reflections.filter((entry) => entry.examId === item.id).length,
    };
  });
  const examYearOptions = Array.from(new Set(exams.map((item) => item.date.slice(0, 4)).filter(Boolean))).sort((a, b) => b.localeCompare(a));
  const examMonthOptions = Array.from(new Set(exams.filter((item) => examYearFilter === "全部" || item.date.startsWith(examYearFilter)).map((item) => item.date.slice(0, 7)).filter(Boolean))).sort((a, b) => b.localeCompare(a));
  const visibleExams = examSummaries.filter((item) => {
    const text = `${item.exam.title}${item.exam.date}${item.subjects.join("")}`;
    const matchSubject = examSubjectFilter === "全部" || item.subjects.includes(examSubjectFilter);
    const matchYear = examYearFilter === "全部" || item.exam.date.startsWith(examYearFilter);
    const matchMonth = examMonthFilter === "全部" || item.exam.date.startsWith(examMonthFilter);
    return matchSubject && matchYear && matchMonth && (!examKeyword.trim() || text.includes(examKeyword.trim()));
  }).sort((a, b) => examLibrarySort === "date-asc" ? a.exam.date.localeCompare(b.exam.date) : b.exam.date.localeCompare(a.exam.date));
  const examPageSize = 10;
  const totalExamPages = Math.max(1, Math.ceil(visibleExams.length / examPageSize));
  const safeExamPage = Math.min(examPage, totalExamPages);
  const pagedExams = visibleExams.slice((safeExamPage - 1) * examPageSize, safeExamPage * examPageSize);
  const filteredRows = libraryRows.filter((row) => {
    const text = `${row.student.name}${row.student.studentNo ?? ""}${row.reflection?.problem ?? ""}${row.reflection?.action ?? ""}${row.reflection?.teacherNote ?? ""}`;
    const matchExam = !examFilter || row.exam.id === examFilter;
    return matchExam && (!keyword.trim() || text.includes(keyword.trim()));
  }).sort((a, b) => `${a.student.studentNo ?? ""}`.localeCompare(`${b.student.studentNo ?? ""}`, "zh-Hans-CN", { numeric: true }));
  const selected = filteredRows.find((row) => row.key === selectedKey) ?? filteredRows[0] ?? libraryRows[0];
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const completedCount = reflections.filter((item) => item.status === "已完成").length;
  const draftCount = reflections.filter((item) => item.status === "草稿").length;
  const followCount = libraryRows.filter((row) => row.followUp).length;
  const [draft, setDraft] = useState<ExamReflection>({
    id: makeId(),
    studentId: selected?.student.id ?? "",
    examId: selected?.exam.id,
    date: today(),
    problem: "",
    reason: "",
    action: "",
    familyMessage: "",
    teacherNote: "",
    status: "草稿",
  });
  useEffect(() => {
    if (!selected) return;
    setDraft(selected.reflection ?? {
      id: makeId(),
      studentId: selected.student.id,
      examId: selected.exam.id,
      date: today(),
      problem: "",
      reason: "",
      action: "",
      familyMessage: "",
      teacherNote: "",
      status: "草稿",
    });
    setSavedState("");
    // The selected row is reconstructed each render; its stable keys define editor identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.key, selected?.reflection?.id]);
  const examIdsKey = exams.map((item) => item.id).join("|");
  const firstExamId = exams[0]?.id ?? "";
  useEffect(() => {
    if (examIdsKey.split("|").includes(examFilter)) return;
    setExamFilter(firstExamId);
    setSelectedKey("");
  }, [examFilter, examIdsKey, firstExamId]);
  useEffect(() => setPage(1), [examFilter, keyword]);
  useEffect(() => setExamPage(1), [examKeyword, examSubjectFilter, examYearFilter, examMonthFilter, examLibrarySort]);
  useEffect(() => {
    if (examMonthFilter !== "全部" && examYearFilter !== "全部" && !examMonthFilter.startsWith(examYearFilter)) setExamMonthFilter("全部");
  }, [examYearFilter, examMonthFilter]);
  if (!selected) return null;
  function save(status: ExamReflection["status"]) {
    if (readOnly) {
      setSavedState("当前为只读模式，反思内容未修改");
      return;
    }
    const reflectionId = (selected.reflection?.id ?? draft.id) || makeId();
    const recordId = makeId();
    const input = { ...draft, id: reflectionId, studentId: selected.student.id, examId: selected.exam.id };
    const preview = saveExamReflection(data, activeClassId, input, status, () => reflectionId, () => recordId);
    if (preview.error) {
      setSavedState(preview.error);
      return;
    }
    update((current) => saveExamReflection(current, activeClassId, input, status, () => reflectionId, () => recordId).data ?? current);
    setDraft(preview.reflection!);
    setSavedState(status === "已完成" ? "反思与家校沟通留痕已更新，正在同步" : "草稿已更新，正在同步");
  }
  const totalMaxScore = subjectMaxScore(selected.exam, "总分");
  const statusClass = (status: string) => status === "已完成" ? "done" : status === "草稿" ? "draft" : status === "重点跟进" ? "follow" : "empty";
  return <>
    <WorkbenchPageHeader icon="📝" tone="iris" title="本次考试反思" description="按当前考试查看学生复盘状态，点击学生后填写反思并归档。" />
    {savedState && <button className="reflection5-alert" onClick={() => setSavedState("")}>{savedState}<span>点击关闭</span></button>}
    <section className="reflection5-page">
      <section className="reflection5-current workbench-page-context">
        <div className="reflection5-current-main"><span>当前考试</span><h3>{activeExam.title}</h3><p>{activeExam.date} · {scoreSubjects(activeExam).join("，")}</p></div>
        <div className="reflection5-actions"><button type="button" onClick={() => setShowExamLibrary(true)}>切换考试</button></div>
      </section>

      <section className="campus-statistics"><div><span>已完成</span><b>{completedCount}</b><small>{exams.length} 次考试</small></div><div><span>草稿</span><b>{draftCount}</b><small>继续完成后可归档</small></div><div><span>重点跟进</span><b>{followCount}</b><small>来自成绩分析</small></div></section>

      <section className="reflection5-work">
        <aside className="reflection5-picker">
          <header>
            <div><span>学生复盘状态</span><h3>{filteredRows.length} 条结果</h3></div>
            <small>{safePage} / {totalPages}</small>
          </header>
          <label className="reflection5-search"><span>查询学生</span><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="学生姓名、学号或已填写的反思内容" /></label>
          <div className="reflection5-picker-head"><span>学生</span><span>状态</span></div>
          <div className="reflection5-picker-list">
            {pagedRows.map((row) => <button type="button" className={row.key === selected.key ? "active" : ""} key={row.key} onClick={() => setSelectedKey(row.key)}>
              <span><b>{row.student.name}</b><small>学号 {row.student.studentNo || "未填"}</small></span>
              <em className={`reflection5-status ${statusClass(row.status)}`}>{row.status}</em>
            </button>)}
            {!pagedRows.length && <p className="reflection5-empty">没有符合条件的反思对象。</p>}
          </div>
          <footer><button type="button" disabled={safePage <= 1} onClick={() => setPage((next) => Math.max(1, next - 1))}>上一页</button><span>{safePage} / {totalPages}</span><button type="button" disabled={safePage >= totalPages} onClick={() => setPage((next) => Math.min(totalPages, next + 1))}>下一页</button></footer>
        </aside>
        <div className="reflection5-editor">
          <header>
            <div><span>反思填写</span><h3>{selected.student.name}</h3><p>{selected.exam.title} · {selected.exam.date} · {selected.followUp ? "成绩页重点跟进" : "常规复盘对象"}</p></div>
          </header>
          <div className="reflection5-scoreline">
            <span><small>总分</small><b>{selected.complete ? `${selected.total}/${totalMaxScore}` : `已录 ${selected.enteredCount}/${selected.subjects.length}`}</b></span>
            <span><small>{selected.complete ? "平均" : "已录平均"}</small><b>{selected.enteredCount ? selected.average : "未录入"}</b></span>
            <span><small>跟进状态</small><b>{selected.followUp ? "重点跟进" : "常规复盘"}</b></span>
          </div>
          <div className="reflection5-form"><label><span>主要问题</span><textarea value={draft.problem} onChange={(e) => setDraft({ ...draft, problem: e.target.value })} placeholder="老师填写：这次考试最需要和学生复盘的问题。" /></label><label><span>原因分析</span><textarea value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} placeholder="老师填写：错因、状态、习惯或知识点问题。" /></label><label><span>下一步行动</span><textarea value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} placeholder="老师填写：订正、面谈、练习、复测等安排。" /></label><label><span>写给家长的话</span><textarea value={draft.familyMessage} onChange={(e) => setDraft({ ...draft, familyMessage: e.target.value })} placeholder="老师填写：需要家长配合的观察和提醒。" /></label><label className="wide"><span>班主任跟进</span><textarea value={draft.teacherNote} onChange={(e) => setDraft({ ...draft, teacherNote: e.target.value })} placeholder="老师填写：后续追踪节点、复查方式或备注。" /></label></div>
          <footer><button type="button" onClick={() => save("草稿")}>保存草稿</button><button type="button" className="reflection5-primary" onClick={() => save("已完成")}>完成并归档</button></footer>
        </div>
      </section>
    </section>
    {showExamLibrary && <div className="score5-modal-backdrop" onClick={() => setShowExamLibrary(false)}>
      <section className="score5-modal score5-library-modal reflection5-exam-modal" role="dialog" aria-modal="true" aria-label="选择考试" onClick={(event) => event.stopPropagation()}>
        <header><div><span>考试库</span><h3>切换考试</h3></div><button type="button" onClick={() => setShowExamLibrary(false)}>关闭</button></header>
        <div className="score5-library-tools">
          <label className="wide"><span>关键词</span><input value={examKeyword} onChange={(e) => setExamKeyword(e.target.value)} placeholder="考试名称、科目或日期" /></label>
          <label><span>科目</span><select value={examSubjectFilter} onChange={(e) => setExamSubjectFilter(e.target.value)}><option value="全部">全部科目</option>{allSubjects.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>年份</span><select value={examYearFilter} onChange={(e) => setExamYearFilter(e.target.value)}><option value="全部">全部年份</option>{examYearOptions.map((item) => <option key={item}>{item}年</option>)}</select></label>
          <label><span>月份</span><select value={examMonthFilter} onChange={(e) => setExamMonthFilter(e.target.value)}><option value="全部">全部月份</option>{examMonthOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>时间排序</span><select value={examLibrarySort} onChange={(e) => setExamLibrarySort(e.target.value)}><option value="date-desc">由新到旧</option><option value="date-asc">由旧到新</option></select></label>
        </div>
        <div className="score5-library-list">
          <table className="score5-library-table reflection5-library-table">
            <colgroup><col className="exam-name" /><col className="exam-date" /><col className="exam-subjects" /><col className="exam-action" /></colgroup>
            <thead><tr><th>考试名称</th><th>日期</th><th>科目</th><th>操作</th></tr></thead>
            <tbody>
              {pagedExams.map((item) => <tr className={item.exam.id === examFilter ? "active" : ""} key={item.exam.id} onClick={() => { setExamFilter(item.exam.id); setSelectedKey(""); setShowExamLibrary(false); }}><td><b>{item.exam.title}</b></td><td>{item.exam.date}</td><td>{item.subjects.join("，")}</td><td><button type="button">{item.exam.id === examFilter ? "当前" : "打开"}</button></td></tr>)}
              {!pagedExams.length && <tr><td colSpan={4}>没有符合条件的考试。</td></tr>}
            </tbody>
          </table>
        </div>
        <footer><button type="button" disabled={safeExamPage <= 1} onClick={() => setExamPage((next) => Math.max(1, next - 1))}>上一页</button><span>{safeExamPage} / {totalExamPages}</span><button type="button" disabled={safeExamPage >= totalExamPages} onClick={() => setExamPage((next) => Math.min(totalExamPages, next + 1))}>下一页</button></footer>
      </section>
    </div>}
  </>;
}

function Comments({ workspaceToken, data, update, readOnly }: { workspaceToken: string; data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; readOnly: boolean }) {
  const [id, setId] = useState(data.students[0]?.id ?? "");
  const [style, setStyle] = useState<TermComment["style"]>("家长可读");
  const currentTermLabel = scheduleTermLabel(data.scheduleConfig, "当前学期");
  const termBounds = scheduleTermRange(data.scheduleConfig);
  const [term, setTerm] = useState(currentTermLabel);
  const [savedState, setSavedState] = useState("");
  const [studentKeyword, setStudentKeyword] = useState("");
  const [studentPage, setStudentPage] = useState(1);
  const [teacherInput, setTeacherInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [selectedReflectionIds, setSelectedReflectionIds] = useState<string[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "class-1";
  const students = data.rosterClasses?.find(item => item.id === activeClassId)?.students ?? data.students;
  const student = students.find(item => item.id === id) ?? students[0];
  const classRecords = data.records.filter((record) => recordBelongsToClass(record, activeClassId, students));
  useEffect(() => {
    if (!students.some((item) => item.id === id)) setId(students[0]?.id ?? "");
  }, [data.activeClassId, students, id]);
  useEffect(() => { setTerm(currentTermLabel); }, [currentTermLabel]);
  const evidence = student ? classRecords.filter((record) => recordBelongsToStudent(record, student, activeClassId)) : [];
  const classEvents = pointEventsForClass(data, activeClassId);
  const events = classEvents.filter(event => event.studentId === student?.id);
  const reflections = examReflectionsForClass(data, activeClassId).filter((item) => item.studentId === student?.id);
  const classReflections = examReflectionsForClass(data, activeClassId);
  const comments = termCommentsForClass(data, activeClassId);
  const saved = comments.find((item) => item.studentId === student?.id && item.term === term && item.style === style);
  const savedComments = comments.length;
  const termOptions = Array.from(new Set([currentTermLabel, ...comments.map((item) => item.term)].map((item) => item?.trim()).filter(Boolean)));
  const termSavedComments = comments.filter((item) => item.term === term).length;
  const termMissingCount = students.filter((item) => !comments.some((commentItem) => commentItem.studentId === item.id && commentItem.term === term)).length;
  const evidenceCountFor = (studentId: string) => {
    const currentStudent = students.find((item) => item.id === studentId);
    if (!currentStudent) return 0;
    return classRecords.filter((record) => recordBelongsToStudent(record, currentStudent, activeClassId)).length
      + classEvents.filter((event) => event.studentId === studentId).length
      + classReflections.filter((item) => item.studentId === studentId).length;
  };
  const studentMatches = students.filter((item) => {
      const text = `${item.name}${item.studentNo ?? ""}${item.group}`;
    return studentKeyword.trim() ? text.includes(studentKeyword.trim()) : true;
  });
  const studentPageSize = 10;
  const totalStudentPages = Math.max(1, Math.ceil(studentMatches.length / studentPageSize));
  const safeStudentPage = Math.min(studentPage, totalStudentPages);
  const pagedStudents = studentMatches.slice((safeStudentPage - 1) * studentPageSize, safeStudentPage * studentPageSize);
  const defaultRecordIds = evidence.slice(0, 4).map((item) => item.id).join("|");
  const defaultReflectionIds = reflections.slice(0, 3).map((item) => item.id).join("|");
  const defaultEventIds = events.slice(0, 4).map((item) => item.id).join("|");
  useEffect(() => setStudentPage(1), [studentKeyword, data.activeClassId]);
  useEffect(() => {
    setSelectedRecordIds(defaultRecordIds ? defaultRecordIds.split("|") : []);
    setSelectedReflectionIds(defaultReflectionIds ? defaultReflectionIds.split("|") : []);
    setSelectedEventIds(defaultEventIds ? defaultEventIds.split("|") : []);
  }, [student?.id, defaultRecordIds, defaultReflectionIds, defaultEventIds]);
  const selectedRecords = evidence.filter((item) => selectedRecordIds.includes(item.id));
  const selectedReflections = reflections.filter((item) => selectedReflectionIds.includes(item.id));
  const selectedEvents = events.filter((item) => selectedEventIds.includes(item.id));
  const aiBasisCount = selectedRecords.length + selectedReflections.length + selectedEvents.length;
  const comment = useMemo(() => student ? buildLocalTermCommentDraft(student, style, { records: selectedRecords, events: selectedEvents, reflections: selectedReflections, teacherInput }) : "", [student, style, selectedRecords, selectedEvents, selectedReflections, teacherInput]);
  const [draft, setDraft] = useState(saved?.content ?? "");
  useEffect(() => { setDraft(saved?.content ?? ""); setSavedState(""); setAiError(""); }, [student?.id, term, style, saved?.id, saved?.content]);
  if (!student) return null;
  const draftDirty = draft !== (saved?.content ?? "") || Boolean(teacherInput.trim());
  async function changeCommentContext(action: () => void) {
    if (aiBusy) {
      setSavedState("AI帮写仍在处理中，请等待完成后再切换。");
      return;
    }
    if (draftDirty && !await requestDangerConfirm("切换后会放弃当前未保存的评语内容和老师补充。", "放弃未保存评语", "放弃并切换")) return;
    setTeacherInput("");
    action();
  }
  async function applyLocalDraft() {
    if (!comment) {
      setSavedState("还没有可整理的依据。请先选择记录或填写老师补充。");
      return;
    }
    if (draft !== (saved?.content ?? "") && draft !== comment
      && !await requestDangerConfirm("套用本地草稿会替换当前未保存的评语内容。", "替换当前草稿", "替换草稿")) return;
    setDraft(comment);
    setSavedState("已按当前选中的真实记录生成本地草稿，请检查后保存。");
  }
  function save() {
    if (readOnly) {
      setSavedState("当前为只读模式，评语内容未修改。");
      return;
    }
    const commentId = saved?.id ?? makeId();
    const input = { id: commentId, studentId: student.id, term, style, content: draft };
    const preview = saveTermComment(data, activeClassId, input, () => commentId, today());
    if (preview.error) {
      setAiError(preview.error);
      return;
    }
    update((current) => saveTermComment(current, activeClassId, input, () => commentId, today()).data ?? current);
    setSavedState("评语已更新，正在同步");
  }
  async function generateAiComment() {
    if (readOnly && workspaceToken !== "demo") {
      setAiError("当前为只读模式，AI帮写不可用。");
      return;
    }
    setAiBusy(true);
    setAiError("");
    setSavedState("");
    try {
      if (!await ensureAiConsent(workspaceToken)) return;
      const response = await fetch("/api/ai/comment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceToken,
          studentName: student.name,
          term,
          style,
          teacherInput,
          context: {
            records: selectedRecords.map((item) => `${item.date}｜${item.type}｜${item.content}${item.parentFeedback ? `；反馈：${item.parentFeedback}` : ""}${item.followUp ? `；跟进：${item.followUp}` : ""}`),
            events: selectedEvents.map((item) => `${item.date}｜${item.reason}（${item.delta > 0 ? "+" : ""}${item.delta}分）`),
            reflections: selectedReflections.map((item) => `问题：${item.problem}；原因：${item.reason}；行动：${item.action}${item.teacherNote ? `；跟进：${item.teacherNote}` : ""}`),
          },
        }),
      });
      const result = await response.json() as { content?: string; error?: string };
      if (!response.ok || !result.content) throw new Error(result.error || "AI生成失败");
      setDraft(result.content);
      setSavedState("AI草稿已生成，可继续编辑后保存");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI生成失败");
    } finally {
      setAiBusy(false);
    }
  }
  return <>
    <WorkbenchPageHeader icon="✍️" tone="berry" title="期末评语" description="按学期维护学生评语，结合已有记录生成可编辑草稿。" />
    {savedState && <button className="comment5-alert" onClick={() => setSavedState("")}>{savedState}<span>点击关闭</span></button>}
    <section className="comment5-page">
      <section className="comment5-current workbench-page-context">
        <div><span>当前学生</span><h3>{student.name}</h3><p>{term} · {style} · 学号 {student.studentNo || "未填"}</p></div>
        <label className="comment5-term-switch"><span>学期筛选</span><select value={term} onChange={(event) => { const next = event.target.value; void changeCommentContext(() => setTerm(next)); }}>{termOptions.map((item) => <option value={item} key={item}>{item}</option>)}</select><small>课程日程：{termBounds.startMonth} 至 {termBounds.endMonth}</small></label>
        <div className="comment5-actions"><button type="button" onClick={() => void applyLocalDraft()}>套用本地草稿</button><button type="button" onClick={() => copyTextToClipboard(draft, "已复制评语")}>复制评语</button><button type="button" className="comment5-primary" onClick={save}>保存评语</button></div>
      </section>
      <div className="comment5-progressline"><span>当前学期</span><b>已保存 {termSavedComments} 条</b><em>历史 {savedComments} 条</em><em>待填写 {termMissingCount} 人</em><em>已选依据 {aiBasisCount} 条</em></div>
      <section className="comment5-work">
        <aside className="comment5-students">
          <header><div><span>学生名单</span><h3>{studentMatches.length} / {students.length}</h3></div><small>{safeStudentPage} / {totalStudentPages}</small></header>
          <label className="comment5-search"><span>查询学生</span><input value={studentKeyword} onChange={(event) => setStudentKeyword(event.target.value)} placeholder="姓名、学号或小组" /></label>
          <div className="comment5-student-head"><span>学生</span><span>状态</span></div>
          <div className="comment5-student-list">
            {pagedStudents.map((item) => {
              const isSaved = comments.some((commentItem) => commentItem.studentId === item.id && commentItem.term === term);
              return <button type="button" className={item.id === id ? "selected" : ""} key={item.id} onClick={() => void changeCommentContext(() => { setId(item.id); setStudentKeyword(""); })}><i>{item.name.slice(0, 1)}</i><span><b>{item.name}</b><small>学号 {item.studentNo || "未填"} · {evidenceCountFor(item.id)} 条证据</small></span><em className={isSaved ? "saved" : "empty"}>{isSaved ? "已保存" : "未填写"}</em></button>;
            })}
            {!studentMatches.length && <p>没有匹配的学生。</p>}
          </div>
          <footer><button type="button" disabled={safeStudentPage <= 1} onClick={() => setStudentPage((next) => Math.max(1, next - 1))}>上一页</button><span>{safeStudentPage} / {totalStudentPages}</span><button type="button" disabled={safeStudentPage >= totalStudentPages} onClick={() => setStudentPage((next) => Math.min(totalStudentPages, next + 1))}>下一页</button></footer>
        </aside>
        <section className="comment5-editor">
          <div className="comment5-toolbar"><label><span>语气</span><select value={style} onChange={(event) => { const next = event.target.value as TermComment["style"]; void changeCommentContext(() => setStyle(next)); }}><option>家长可读</option><option>温和鼓励</option><option>客观正式</option></select></label></div>
          <section className="comment5-draft">
            <header><div><span>可编辑评语草稿</span><h3>{student.name}</h3></div><small>{draft.length} 字</small></header>
            <textarea aria-label="评语内容" value={draft} onChange={(event) => { setDraft(event.target.value); setSavedState(""); }} />
          </section>
          <section className="comment5-input">
            <label><span>老师补充</span><textarea value={teacherInput} onChange={(event) => setTeacherInput(event.target.value)} placeholder="例如：本学期课堂表达更主动，但作业订正还需要提醒；希望语气温和一些。" /></label>
            <button type="button" className="comment5-primary" disabled={aiBusy} onClick={generateAiComment}>{aiBusy ? "AI帮写中..." : "AI帮写"}</button>
            {workspaceToken !== "demo" && <button type="button" onClick={() => void disableAiConsent().catch((error) => setAiError(error instanceof Error ? error.message : "AI 设置更新失败"))}>关闭 AI 授权</button>}
          </section>
          {aiError && <button className="comment5-alert error" onClick={() => setAiError("")}>{aiError}<span>点击关闭</span></button>}
          <div className="comment5-evidence-strip"><span>评语依据</span><em>已选 {aiBasisCount} 条</em><em>仅整理已勾选记录</em></div>
          <section className="comment5-evidence">
            <header><span>依据选择</span><small>勾选后进入 AI 帮写，也可点击追加到草稿</small></header>
            <div>
              {evidence.map((item) => <article className="comment5-basis-row" key={item.id}><label><input type="checkbox" checked={selectedRecordIds.includes(item.id)} onChange={(event) => setSelectedRecordIds((list) => event.target.checked ? [...list, item.id] : list.filter((idValue) => idValue !== item.id))} /><b>{item.type}</b><span>{item.date} · {item.content}</span></label><button type="button" onClick={() => setDraft((current) => appendTermCommentText(current, `平时记录：${item.content}`))}>追加</button></article>)}
              {reflections.map((item) => <article className="comment5-basis-row" key={item.id}><label><input type="checkbox" checked={selectedReflectionIds.includes(item.id)} onChange={(event) => setSelectedReflectionIds((list) => event.target.checked ? [...list, item.id] : list.filter((idValue) => idValue !== item.id))} /><b>考试反思</b><span>{item.date} · {item.problem || "已填写反思"} · {item.action || "待补充行动"}</span></label><button type="button" onClick={() => setDraft((current) => appendTermCommentText(current, `考试反思记录：${item.problem}${item.action ? `；下一步：${item.action}` : ""}`))}>追加</button></article>)}
              {events.map((item) => <article className="comment5-basis-row" key={item.id}><label><input type="checkbox" checked={selectedEventIds.includes(item.id)} onChange={(event) => setSelectedEventIds((list) => event.target.checked ? [...list, item.id] : list.filter((idValue) => idValue !== item.id))} /><b>积分记录</b><span>{item.date} · {item.reason} · {item.delta > 0 ? "+" : ""}{item.delta}分</span></label><button type="button" onClick={() => setDraft((current) => appendTermCommentText(current, `积分记录：${item.reason}（${item.delta > 0 ? "+" : ""}${item.delta}分）`))}>追加</button></article>)}
              {!evidence.length && !reflections.length && !events.length && <p>暂无记录，可先到家校沟通、考试反思或积分评价补充依据。</p>}
            </div>
          </section>
        </section>
      </section>
    </section>
  </>;
}
