"use client";
import { copyTextToClipboard } from "@/lib/clipboard";
import { StudentLookupDialog } from "@/app/components/campus/StudentLookupDialog";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { lazy, Suspense } from 'react';
import { DashboardView } from './features/dashboard/DashboardView';
import { CampusIcon, MetricStrip, ThemeArtwork } from '@/app/components/campus/primitives';
import { WorkbenchShell } from '@/app/components/workbench/shell/WorkbenchShell';
import { workspaceModules, type LearningScene, type WorkspaceModuleId } from '@/app/components/workbench/shell/catalog';
import { useWorkbenchShellController } from '@/app/components/workbench/shell/useWorkbenchShellController';
import { HomeworkView } from './features/homework/HomeworkView';
import { addGrowthEvidence, growthEvidenceForStudent } from './features/growth/operations';
import { growthTimestamp, isInGrowthRange as inGrowthRange, type GrowthTime } from './features/growth/time-range';
import { communicationRecordsForClass, localCommunicationDate, patchCommunicationStatus, recordBelongsToClass, recordBelongsToStudent, removeCommunicationRecord, saveCommunicationRecord } from './features/records/operations';
import { examReflectionsForClass, saveExamReflection } from './features/reflections/operations';
import { appendTermCommentText, buildLocalTermCommentDraft, saveTermComment, termCommentsForClass } from './features/comments/operations';
import { saveClassScheduleWeek, saveScheduleTermConfig } from './features/schedule/operations';
import { createDefaultScheduleConfig as defaultScheduleConfig, currentLocalDate as today, normalizeScheduleCourses as normalizeMobileCourses, scheduleTermMonths, scheduleWeekDates as getScheduleWeekDates, scheduleWeeksInMonth as getScheduleWeeksInMonth } from './features/schedule/read-model';
import { isDatedWithin, saveWeeklyReport, weeklyActivityRows, weeklyFollowRows, weeklyHomeworkMetrics, weeklyPointEventsForClass, weeklyPositiveRows, weeklyReportsForClass } from './features/weekly/operations';
import { applyPointEvents, pointEventsForClass, undoPointEvent as undoPointEventInClass } from './features/points/operations';
import { defaultPointRules } from './features/rules/catalog';
import { deletePointRule, patchPointRule, pointRulesForData, pointRuleUsageCount, replacePointRules, upsertPointRule } from './features/rules/operations';
import { createScoreExam, editScoreExam, patchScoreExam, removeScoreExam, scoreEntry, scoreEntryCount, scoreExamsForClass, setScoreEntries } from './features/scores/operations';
import { defaultScoreRanges, parseScoreSubjects as parseSubjects, scoreRangesFor, scoreRowsFor, scoreSubjectKey, scoreSubjects, scoreValue, subjectMaxScore, type ScoreLevel, type ScoreRange } from './features/scores/read-model';
import { StudentsView } from './features/students/StudentsView';
import { AccountCenter } from './features/account/AccountCenter';
import { addWorkspaceClass, patchWorkspaceClass, removeWorkspaceClass, switchWorkspaceClass } from './features/account/operations';
import { useAccountCenter } from './features/account/useAccountCenter';
import { normalizeWorkspaceData as normalizeData, scopeWorkspaceClassSettings as scopeClassSettings } from './workspace/normalize';
import type { Workspace } from './workspace/types';
import { useWorkspaceController } from './workspace/useWorkspaceController';
import { canLeaveDictation } from './dictation/navigation';
const Dictation = lazy(() => import('./dictation/Dictation'));

import { makeId, scheduleTermLabel, scheduleTermRange } from "@/lib/classroom";
import { parseWorkspaceBackup } from "@/lib/workspaceBackup";
import type { ClassroomData, CommunicationRecord, DailyFocus, ExamReflection, HomeworkTask, PointEvent, PointRule, RosterClass, ScheduleConfig, ScheduleEvent, ScheduleWeek, ScoreExam, Student, TermComment, WeeklyReport } from "@/lib/classroom";
import { Attendance } from "./Attendance";
import { ScheduleHub } from "./ScheduleHub";
import { TeacherAgenda } from "./TeacherAgenda";
import { HealthCare } from "./HealthCare";
import { ScoreTrends } from "./ScoreTrends";
import { ScoreItemAnalysis } from "./ScoreItemAnalysis";
import { ClassroomTools } from "./ClassroomTools";
import { Seating } from "./Seating";
import { Duty } from "./Duty";
import { Cadres } from "./Cadres";
import { defaultDutyJobs } from "./features/duty/operations";
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

const days = ["星期一", "星期二", "星期三", "星期四", "星期五"];
const shortDays = ["周一", "周二", "周三", "周四", "周五"];

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

export default function ClassroomApp({ token }: { token: string }) {
  const [toast, setToast] = useState<ToastEventDetail | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmEventDetail | null>(null);
  const [visitedMobileModules, setVisitedMobileModules] = useState<ModuleId[]>(['dashboard']);
  const [growthRequest, setGrowthRequest] = useState({ studentId: '', sequence: 0 });
  const backupInputRef = useRef<HTMLInputElement>(null);
  const {
    workspace, loading, error, dirty, saving, saveConflict, isDemo, isReadOnly,
    updateData, save, commitWorkspace, loadLatestWorkspace, ensureSavedBeforeLeave,
    getCurrentWorkspace, getBackupData, clearError,
  } = useWorkspaceController({ token, notify, normalizeData, scopeClassSettings });
  const accountCenter = useAccountCenter(isDemo);
  const shell = useWorkbenchShellController(canLeaveDictation);
  const active = shell.active;
  const learningScene = shell.scene;

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

  function openModule(id: ModuleId, options?: { guard?: boolean }) {
    if (!shell.open(id, options)) return;
    setVisitedMobileModules(current => [...new Set([...current, active, id])]);
  }

  function openStudentGrowth(studentId: string) {
    setGrowthRequest(current => ({ studentId, sequence: current.sequence + 1 }));
    openModule('growth');
  }

  function exportWorkspaceBackup() {
    const current = getCurrentWorkspace();
    if (!current) return;
    const backup = {
      format: "classroom-workspace-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      workspace: { className: current.className, grade: current.grade, term: current.term },
      data: getBackupData() ?? current.data,
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
      const currentStudents = getCurrentWorkspace()?.data.students.length ?? 0;
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

  async function logoutCurrentWorkspace() {
    if (!await ensureSavedBeforeLeave()) {
      notify("当前修改尚未同步，已取消退出；请先重试保存或导出完整备份。", "error");
      return false;
    }
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "退出失败，请稍后重试");
      window.location.assign("/");
      return true;
    } catch (logoutError) {
      notify(logoutError instanceof Error ? logoutError.message : "退出失败，请稍后重试", "error");
      return false;
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
    updateData((current) => {
      const result = switchWorkspaceClass(current, id, loadedWorkspace.term);
      if (result.error) notify(result.error, "error");
      return result.data;
    });
  }

  function patchActiveClass(patch: Partial<RosterClass>) {
    updateData((current) => {
      const result = patchWorkspaceClass(current, activeClassId, patch, loadedWorkspace.term);
      if (result.error) notify(result.error, "error");
      return result.data;
    });
  }

  function addGlobalClass() {
    const id = makeId("class");
    updateData((current) => {
      const result = addWorkspaceClass(current, id, loadedWorkspace.term);
      if (result.error) notify(result.error, "error");
      return result.data;
    });
  }

  async function deleteActiveClass() {
    if (classes.length <= 1) return;
    updateData((current) => {
      const result = removeWorkspaceClass(current, activeClassId, loadedWorkspace.term);
      if (result.error) notify(result.error, "error");
      return result.data;
    });
  }

  function resolveConfirm(confirmed: boolean) {
    confirmRequest?.onResolve(confirmed);
    setConfirmRequest(null);
  }

  function switchLearningScene(scene: LearningScene) {
    if (!shell.setScene(scene)) return;
    if (scene === 'family' && active !== 'dictation') openModule('dictation', { guard: false });
  }

  return (
    <>
      <WorkbenchShell
        active={active}
        scene={learningScene}
        classes={classes}
        activeClass={activeClass}
        workspaceGrade={workspace.grade}
        saving={saving}
        dirty={dirty}
        error={error}
        isDemo={isDemo}
        isReadOnly={isReadOnly}
        saveConflict={saveConflict}
        onOpen={openModule}
        onBack={shell.back}
        onSwitchClass={switchGlobalClass}
        onScene={switchLearningScene}
        onAccount={accountCenter.openCenter}
        onRetrySave={() => void save()}
        onClearError={clearError}
        onExportDraft={exportWorkspaceBackup}
        onLoadLatest={() => void loadLatestWorkspace()}
        mobileContent={<MobileWorkspaceContent workspaceToken={token} workspace={workspace} activeClass={activeClass} active={active} visited={visitedMobileModules} openModule={openModule} openStudentGrowth={openStudentGrowth} growthRequest={growthRequest} update={updateData} save={save} isDemo={isDemo} isReadOnly={isReadOnly} openAccount={accountCenter.openCenter} switchLearningScene={switchLearningScene} />}
        desktopContent={<>
          {active === "dictation" && <Suspense fallback={<p role="status">正在加载听写…</p>}><Dictation key={`${workspace.data.activeClassId}:${learningScene}`} data={workspace.data} token={token} readOnly={isDemo || isReadOnly} commit={commitWorkspace} scene={learningScene}/></Suspense>}
          {active === "dashboard" && <DashboardView defaultDutyJobs={defaultDutyJobs} data={workspace.data} open={openModule} openFamily={() => switchLearningScene('family')} openStudentGrowth={openStudentGrowth} />}
          {active === "students" && <StudentsView data={workspace.data} update={updateData} confirmAction={requestDangerConfirm} readOnly={isDemo || isReadOnly} />}
          {active === "attendance" && <Attendance data={workspace.data} update={updateData} save={save} readOnly={isDemo || isReadOnly} />}
          {active === "homework" && <HomeworkView data={workspace.data} update={updateData} confirmAction={requestDangerConfirm} readOnly={isDemo || isReadOnly} />}
          {active === "points" && <Points data={workspace.data} update={updateData} save={save} readOnly={isDemo || isReadOnly} />}
          {active === "rules" && <Rules data={workspace.data} update={updateData} save={save} readOnly={isDemo || isReadOnly} />}
          {active === "growth" && <Growth data={workspace.data} update={updateData} save={save} readOnly={isDemo || isReadOnly} requestedStudentId={growthRequest.studentId} />}
          {active === "health" && <HealthCare data={workspace.data} update={updateData} save={save} readOnly={isDemo || isReadOnly} />}
          {active === "weekly" && <Weekly data={workspace.data} update={updateData} readOnly={isDemo || isReadOnly} />}
          {active === "schedule" && <ScheduleHub data={workspace.data} update={updateData} readOnly={isDemo || isReadOnly} />}
          {active === "tools" && <ClassroomTools data={workspace.data} update={updateData} readOnly={isDemo || isReadOnly} />}
          {active === "seating" && <Seating data={workspace.data} update={updateData} readOnly={isDemo || isReadOnly} />}
          {active === "duty" && <Duty data={workspace.data} update={updateData} readOnly={isDemo || isReadOnly} />}
          {active === "cadres" && <Cadres data={workspace.data} update={updateData} readOnly={isDemo || isReadOnly} confirmAction={requestDangerConfirm} />}
          {active === "records" && <Records data={workspace.data} update={updateData} save={save} readOnly={isDemo || isReadOnly} />}
          {active === "scores" && <Scores workspaceToken={token} data={workspace.data} update={updateData} save={save} readOnly={isDemo || isReadOnly} />}
          {active === "reflection" && <Reflection data={workspace.data} update={updateData} save={save} open={openModule} readOnly={isDemo || isReadOnly} />}
          {active === "comments" && <Comments workspaceToken={token} data={workspace.data} update={updateData} readOnly={isDemo || isReadOnly} />}
        </>}
      />
      {toast && <div className={`workbench-toast ${toast.tone ?? "success"}`} role="status">{toast.message}</div>}
      {confirmRequest && <div className="workbench-confirm-backdrop" role="presentation" onMouseDown={() => resolveConfirm(false)}>
        <section className="workbench-confirm" role="dialog" aria-modal="true" aria-labelledby="workbench-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
          <header><span>危险操作</span><h2 id="workbench-confirm-title">{confirmRequest.title ?? "确认删除"}</h2></header>
          <p>{confirmRequest.message}</p>
          <footer><button onClick={() => resolveConfirm(false)}>取消</button><button className="danger" onClick={() => resolveConfirm(true)}>{confirmRequest.confirmLabel ?? "确认删除"}</button></footer>
        </section>
      </div>}
      <AccountCenter
        open={accountCenter.open}
        account={accountCenter.account}
        loading={accountCenter.loading}
        loadError={accountCenter.error}
        classes={classes}
        activeClass={activeClass}
        saving={saving}
        dirty={dirty}
        saveError={error}
        isDemo={isDemo}
        isReadOnly={isReadOnly}
        onClose={accountCenter.closeCenter}
        onRetryAccount={() => void accountCenter.reload()}
        onSwitchClass={switchGlobalClass}
        onPatchClass={patchActiveClass}
        onAddClass={addGlobalClass}
        onDeleteClass={deleteActiveClass}
        onExport={exportWorkspaceBackup}
        onImport={() => { accountCenter.closeCenter(); backupInputRef.current?.click(); }}
        onLogout={logoutCurrentWorkspace}
      />
      <input ref={backupInputRef} className="visually-hidden" type="file" accept="application/json,.json" aria-label="选择工作台备份文件" onChange={(event) => void importWorkspaceBackup(event.target.files?.[0])} />
    </>
  );
}

function MobileWorkspaceContent({ workspaceToken, workspace, activeClass, active, visited, openModule, openStudentGrowth, growthRequest, update, save, isDemo, isReadOnly, openAccount, switchLearningScene }: { workspaceToken: string; workspace: Workspace; activeClass: RosterClass; active: ModuleId; visited: ModuleId[]; openModule: (id: ModuleId) => void; openStudentGrowth: (studentId: string) => void; growthRequest: { studentId: string; sequence: number }; update: (fn: (d: ClassroomData) => ClassroomData) => void; save: () => Promise<boolean>; isDemo: boolean; isReadOnly: boolean; openAccount: () => void; switchLearningScene: (scene: LearningScene) => void }) {
  const data = workspace.data;
  const visibleModules = new Set([...visited, active]);
  const pane = (id: ModuleId, content: ReactNode) => visibleModules.has(id)
    ? <section key={id} data-mobile-module={id} hidden={active !== id}>{content}</section>
    : null;
  const dedicated = new Set<ModuleId>(['dashboard', 'students', 'attendance', 'homework', 'scores', 'health', 'dictation', 'seating', 'duty', 'cadres']);
  return <>
      {pane('dashboard', <MobileHome data={data} open={openModule} openFamily={() => switchLearningScene('family')} openAccount={openAccount} openStudentGrowth={openStudentGrowth} />)}
      {pane('students', <StudentsView data={data} update={update} confirmAction={requestDangerConfirm} readOnly={isDemo || isReadOnly} mobile />)}
      {pane('attendance', <Attendance data={data} update={update} save={save} readOnly={isDemo || isReadOnly} mobile />)}
      {pane('homework', <HomeworkView data={data} update={update} confirmAction={requestDangerConfirm} mobile readOnly={isDemo || isReadOnly} />)}
      {pane('scores', <MobileScores workspaceToken={workspaceToken} data={data} activeClass={activeClass} update={update} save={save} readOnly={isDemo || isReadOnly} open={openModule} />)}
      {pane('health', <HealthCare data={data} update={update} save={save} readOnly={isDemo || isReadOnly} mobile />)}
      {pane('seating', <Seating data={data} update={update} readOnly={isDemo || isReadOnly} mobile />)}
      {pane('duty', <Duty data={data} update={update} readOnly={isDemo || isReadOnly} mobile />)}
      {pane('cadres', <Cadres data={data} update={update} readOnly={isDemo || isReadOnly} mobile confirmAction={requestDangerConfirm} />)}
      {workspaceModules.filter(item => !dedicated.has(item.id)).map(item => pane(item.id, <MobileSecondaryPage workspaceToken={workspaceToken} active={item.id} data={data} activeClass={activeClass} growthRequest={growthRequest} update={update} save={save} open={openModule} readOnly={isDemo || isReadOnly} />))}
  </>;
}


function MobileHome({ data, open, openFamily, openAccount, openStudentGrowth }: { data: ClassroomData; open: (id: ModuleId) => void; openFamily: () => void; openAccount: () => void; openStudentGrowth: (studentId: string) => void }) {
  return <div className="campus-mobile-home"><DashboardView data={data} open={open} openFamily={openFamily} openStudentGrowth={openStudentGrowth} defaultDutyJobs={defaultDutyJobs}/><button className="mobile-class-manage" type="button" onClick={openAccount}><CampusIcon name="rules"/>账户、班级与备份</button></div>;
}

function EmptyScoreWorkspace({ data, classId, update, save, readOnly, mobile }: { data: ClassroomData; classId: string; update: (fn: (d: ClassroomData) => ClassroomData) => void; save: () => Promise<boolean>; readOnly: boolean; mobile: boolean }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today());
  const [subjects, setSubjects] = useState("语文，数学，英语");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (readOnly || busy) return;
    const parsed = parseSubjects(subjects);
    const result = createScoreExam(data, classId, { title, date, subjects: parsed }, makeId);
    if (!result.exam) { setError(result.error ?? "考试创建失败。"); return; }
    setError("");
    update((current) => createScoreExam(current, classId, { title, date, subjects: parsed }, () => result.exam.id).data ?? current);
    setBusy(true);
    const ok = await save();
    setBusy(false);
    if (!ok) { setError("同步失败，本机新增的考试已保留，请重试保存后再继续录分。"); return; }
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
    <div className={mobile ? "mobile-sheet-actions single" : "score5-actions"}><button type="button" className={mobile ? "primary" : "score5-primary"} disabled={readOnly || busy} onClick={() => void submit()}>{busy ? "保存中…" : readOnly ? "只读模式" : "建立第一场考试"}</button></div>
  </section>;
  return mobile ? <div className="mobile-stack mobile-scores-page">{content}</div> : <><WorkbenchPageHeader icon="📈" tone="iris" title="成绩分析" description="建立第一场考试后，再录入成绩、查看趋势和核对试卷分析。" />{content}</>;
}

function MobileScores(props: { workspaceToken: string; data: ClassroomData; activeClass: RosterClass; update: (fn: (d: ClassroomData) => ClassroomData) => void; save: () => Promise<boolean>; readOnly: boolean; open: (id: ModuleId) => void }) {
  if (!scoreExamsForClass(props.data, props.activeClass.id).length) return <EmptyScoreWorkspace data={props.data} classId={props.activeClass.id} update={props.update} save={props.save} readOnly={props.readOnly} mobile />;
  return <MobileScoresWithExam {...props} />;
}

function MobileScoresWithExam({ workspaceToken, data, activeClass, update, save, readOnly, open }: { workspaceToken: string; data: ClassroomData; activeClass: RosterClass; update: (fn: (d: ClassroomData) => ClassroomData) => void; save: () => Promise<boolean>; readOnly: boolean; open: (id: ModuleId) => void }) {
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
  const [scoreBusy, setScoreBusy] = useState(false);
  const [scoreMessage, setScoreMessage] = useState("");
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
    if (readOnly) return;
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
  async function applyMobileBatchScore() {
    if (readOnly || scoreBusy) return;
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
    setScoreBusy(true);
    const ok = await save();
    setScoreBusy(false);
    if (!ok) { setScoreBatchError("同步失败，本机录分已保留；请重试保存，当前选择不会清空。"); return; }
    setScoreBatchError("");
    setScoreBatchOpen(false);
    setSelectedIds([]);
    notify(`已给 ${selectedIds.length} 名学生录入${activeBatchSubject} ${safeScore}分`, "success");
  }
  async function toggleScoreFollow(studentId: string) {
    if (readOnly || scoreBusy) return;
    const list = exam.followUpStudentIds ?? [];
    updateExam({ ...exam, followUpStudentIds: list.includes(studentId) ? list.filter((id) => id !== studentId) : [...list, studentId] });
    setScoreBusy(true); setScoreMessage("");
    const ok = await save(); setScoreBusy(false);
    setScoreMessage(ok ? "重点状态已同步" : "重点状态同步失败，本机修改已保留。");
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
  async function saveExamDraft() {
    if (readOnly || scoreBusy) return;
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
      setScoreBusy(true);
      const ok = await save();
      setScoreBusy(false);
      if (!ok) { setExamFormError("同步失败，本机修改已保留；编辑窗口保持打开，请重试。"); return; }
      setExamEditorOpen("");
      notify("考试信息已更新", "success");
      return;
    }
    const result = createScoreExam(data, activeClass.id, { title: examDraft.title, date: examDraft.date, subjects: nextSubjects }, makeId);
    if (!result.exam) { setExamFormError(result.error ?? "考试创建失败。"); return; }
    const nextExam = result.exam;
    update((current) => createScoreExam(current, activeClass.id, { title: examDraft.title, date: examDraft.date, subjects: nextSubjects }, () => nextExam.id).data ?? current);
    setScoreBusy(true);
    const ok = await save();
    setScoreBusy(false);
    if (!ok) { setExamFormError("同步失败，本机新增考试已保留；窗口保持打开，请重试。"); return; }
    setExamId(nextExam.id);
    setSubjectFilter("全部");
    setExamEditorOpen("");
    notify("考试已新增", "success");
  }
  async function deleteMobileExam() {
    if (readOnly || scoreBusy || !await requestDangerConfirm(`${exam.title} 的全部成绩、跟进标记和关联反思都会删除。`, "删除考试", "确认删除")) return;
    update((current) => removeScoreExam(current, activeClass.id, exam.id));
    setScoreBusy(true); setExamFormError("");
    const ok = await save(); setScoreBusy(false);
    if (!ok) { setExamFormError("删除同步失败，本机修改已保留；请重试保存。"); return; }
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
    if (readOnly) return;
    updateExam({ ...exam, advice: { ...(exam.advice ?? {}), [studentId]: advice } });
  }
  async function batchScoreFollow(mark: boolean) {
    if (readOnly || scoreBusy) return;
    const list = exam.followUpStudentIds ?? [];
    const nextList = mark ? Array.from(new Set([...list, ...selectedIds])) : list.filter((id) => !selectedIds.includes(id));
    updateExam({ ...exam, followUpStudentIds: nextList });
    setScoreBusy(true); setScoreMessage("");
    const ok = await save(); setScoreBusy(false);
    if (!ok) { setScoreMessage("批量重点状态同步失败，本机修改已保留；当前选择不会清空。"); return; }
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
  async function saveMobileFilterEditor() {
    if (readOnly || scoreBusy) return;
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
    setScoreBusy(true); setScoreMessage("");
    const ok = await save(); setScoreBusy(false);
    if (!ok) { setScoreMessage("满分与区间同步失败，本机修改已保留；编辑窗口保持打开。"); return; }
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
      <div className="mobile-score-hero-actions"><button type="button" onClick={() => setExamPickerOpen(true)}>切换考试</button><button type="button" disabled={readOnly || scoreBusy} onClick={openEditExam}>编辑考试</button><button type="button" className="primary" disabled={readOnly || scoreBusy} onClick={openNewExam}>新增考试</button></div>
    </section>
    <section className="mobile-overview-stats compact" aria-label="成绩分析概览">
      <span><small>录分进度</small><b>{enteredCount}/{scoreCount}</b></span>
      <span><small>已录平均</small><b>{scoreAverageValue ?? "未录入"}</b></span>
      <span><small>重点跟进</small><b>{followCount}</b></span>
    </section>
    <nav className="score5-workspace-tabs mobile-score-workspace-tabs" aria-label="成绩工作视图"><button type="button" className={scoreWorkspaceView === "records" ? "active" : ""} onClick={() => setScoreWorkspaceView("records")}>成绩录入</button><button type="button" className={scoreWorkspaceView === "trends" ? "active" : ""} onClick={() => setScoreWorkspaceView("trends")}>历次趋势</button><button type="button" className={scoreWorkspaceView === "analysis" ? "active" : ""} onClick={() => setScoreWorkspaceView("analysis")}>试卷分析</button></nav>
    {scoreWorkspaceView === "trends" && <ScoreTrends data={data} classId={activeClass.id} />}
    {scoreWorkspaceView === "analysis" && <ScoreItemAnalysis data={data} classId={activeClass.id} workspaceToken={workspaceToken} exam={exam} students={students} update={update} save={save} readOnly={readOnly} />}
    {scoreMessage && <p className="mobile-form-error" role="status">{scoreMessage}</p>}
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
        <div><button type="button" className="primary" disabled={readOnly || scoreBusy} onClick={openMobileScoreBatch}>批量录分</button><select disabled={readOnly || scoreBusy} aria-label="批量重点操作" value="" onChange={(event) => { if (event.target.value === "mark") void batchScoreFollow(true); if (event.target.value === "unmark") void batchScoreFollow(false); }}><option value="">重点操作</option><option value="mark">标记为重点</option><option value="unmark">取消重点</option></select></div>
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
        <button type="button" disabled={readOnly || scoreBusy} className={row.followUp ? "mobile-score-follow active" : "mobile-score-follow"} onClick={() => void toggleScoreFollow(row.student.id)}>{row.followUp ? "已标记" : "标记"}</button>
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
        {subjects.map((subject) => <label key={subject}><span>{subject}</span><input disabled={readOnly} type="number" min={0} max={subjectMaxScore(exam, subject)} value={examScores?.[subject] ?? ""} onChange={(event) => setStudentScore(selected.id, subject, event.target.value)} placeholder="未录入" /></label>)}
        <label className="wide"><span>成绩建议</span><textarea disabled={readOnly} value={exam.advice?.[selected.id] ?? selectedRow.advice} onChange={(event) => setScoreAdvice(selected.id, event.target.value)} /></label>
      </div>
      <div className="mobile-sheet-actions single"><button type="button" disabled={readOnly || scoreBusy} onClick={() => void toggleScoreFollow(selected.id)}>{selectedRow.followUp ? "取消重点跟进" : "标记重点跟进"}</button></div>
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
      <div className="mobile-sheet-actions"><button type="button" disabled={scoreBusy} onClick={() => setScoreBatchOpen(false)}>取消</button><button type="button" className="primary" disabled={readOnly || scoreBusy || !selectedIds.length || scoreBatchValue === ""} onClick={() => void applyMobileBatchScore()}>{scoreBusy ? "保存中…" : "应用到已选"}</button></div>
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
      {examEditorOpen === "edit" && <div className="mobile-sheet-actions single"><button type="button" disabled={readOnly || scoreBusy} onClick={() => void deleteMobileExam()}>删除当前考试</button></div>}
      <div className="mobile-sheet-actions"><button type="button" disabled={scoreBusy} onClick={() => setExamEditorOpen("")}>取消</button><button type="button" className="primary" disabled={readOnly || scoreBusy} onClick={() => void saveExamDraft()}>{scoreBusy ? "保存中…" : examEditorOpen === "new" ? "新增考试" : "保存考试"}</button></div>
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
      <div className="mobile-sheet-actions"><button type="button" disabled={readOnly || scoreBusy} onClick={() => setRangeDrafts((list) => [...list, { id: `custom-${Date.now()}`, label: "自定义", min: 0, max: subjectMaxScore(exam, filterSubjectDraft) }])}>新增区间</button><button type="button" className="primary" disabled={readOnly || scoreBusy} onClick={() => void saveMobileFilterEditor()}>{scoreBusy ? "保存中…" : "保存"}</button></div>
    </MobileInfoSheet>}
  </div>;
}

function MobileSecondaryPage({ workspaceToken, active, data, activeClass, growthRequest, update, save, open, readOnly }: { workspaceToken: string; active: ModuleId; data: ClassroomData; activeClass: RosterClass; growthRequest: { studentId: string; sequence: number }; update: (fn: (d: ClassroomData) => ClassroomData) => void; save: () => Promise<boolean>; open: (id: ModuleId) => void; readOnly: boolean }) {
  const [detail, setDetail] = useState<{ title: string; children: ReactNode } | null>(null);
  const [quickPointOpen, setQuickPointOpen] = useState(false);
  const [pointRuleSheetOpen, setPointRuleSheetOpen] = useState(false);
  const [quickRecordOpen, setQuickRecordOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState("");
  const [recordStudentPickerOpen, setRecordStudentPickerOpen] = useState(false);
  const [ruleEditorOpen, setRuleEditorOpen] = useState(false);
  const availablePointRules = pointRulesForData(data).filter((rule) => rule.enabled !== false);
  const firstPointRule = availablePointRules[0];
  const [pointDraft, setPointDraft] = useState({ studentId: activeClass.students[0]?.id ?? data.students[0]?.id ?? "", ruleId: firstPointRule?.id ?? "", note: "", operator: "班主任", delta: firstPointRule?.delta ?? 0 });
  const [pointStudentKeyword, setPointStudentKeyword] = useState("");
  const [pointGroupFilter, setPointGroupFilter] = useState("全部小组");
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>([]);
  const [pointBusy, setPointBusy] = useState(false);
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
  const [growthBusy, setGrowthBusy] = useState(false);
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
  const [recordKeyword, setRecordKeyword] = useState("");
  const [recordTypeFilter, setRecordTypeFilter] = useState("全部类型");
  const [recordStatusFilter, setRecordStatusFilter] = useState<"全部状态" | CommunicationRecord["status"]>("全部状态");
  const [recordBusy, setRecordBusy] = useState(false);
  const [reflectionEditorOpen, setReflectionEditorOpen] = useState(false);
  const [reflectionDraft, setReflectionDraft] = useState<ExamReflection>({ id: "", studentId: activeClass.students[0]?.id ?? data.students[0]?.id ?? "", examId: scoreExamsForClass(data, activeClass.id)[0]?.id, date: today(), problem: "", reason: "", action: "", familyMessage: "", teacherNote: "", status: "草稿" });
  const [reflectionBusy, setReflectionBusy] = useState(false);
  const [reflectionEditorMessage, setReflectionEditorMessage] = useState("");
  const reflectionDraftBaseline = useRef("");
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
  const [ruleBusy, setRuleBusy] = useState(false);
  const [recordDraft, setRecordDraft] = useState({ studentId: activeClass.students[0]?.id ?? data.students[0]?.id ?? "", student: activeClass.students[0]?.name ?? data.students[0]?.name ?? "", type: "家校沟通", channel: "微信", date: localCommunicationDate(), purpose: "沟通情况补录", home: "", content: "", opinion: "", followUp: "" });
  const [ruleDraft, setRuleDraft] = useState<PointRule>({ id: "", scene: "课堂", title: "", reason: "", delta: 1, owner: "班主任", enabled: true, level: "自定义", detail: "" });
  const students = activeClass.students?.length ? activeClass.students : data.students;
  const growthStudentIdsKey = students.map(student => student.id).join('|');
  useEffect(() => {
    if (active === 'growth' && growthRequest.studentId && growthStudentIdsKey.split('|').includes(growthRequest.studentId)) {
      setGrowthStudentId(growthRequest.studentId);
      setGrowthStudentPage(1);
      setGrowthPage(1);
      setGrowthDetailOpen(true);
    }
  }, [active, growthRequest.sequence, growthRequest.studentId, growthStudentIdsKey]);
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
  async function savePointEvent() {
    const value = Number(pointDraft.delta) || 0;
    if (!selectedPointIds.length || !selectedPointRule || value === 0) {
      notify("请选择学生和积分规则，分值不能为 0", "error");
      return;
    }
    if (readOnly || pointBusy) { notify("当前为只读模式，不能提交积分", "error"); return; }
    const stamp = new Date().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    setPointBusy(true);
    update((current) => applyPointEvents(current, activeClass.id, selectedPointIds, selectedPointRule, value, pointDraft.note, pointDraft.operator, stamp, makeId));
    const ok = await save(); setPointBusy(false);
    if (!ok) { notify("积分同步失败，学生选择和本次说明已保留", "error"); return; }
    setPointDraft((current) => ({ ...current, note: "" }));
    setSelectedPointIds([]);
    setQuickPointOpen(false);
    notify("积分记录已添加", "success");
  }
  async function undoPointEvent(event: PointEvent) {
    if (readOnly || pointBusy) return;
    setPointBusy(true);
    update((current) => undoPointEventInClass(current, activeClass.id, event.id));
    const ok = await save(); setPointBusy(false);
    notify(ok ? "积分记录已撤销" : "撤销同步失败，本机修改已保留", ok ? "success" : "error");
  }
  async function saveRecord() {
    if (readOnly || recordBusy) { notify("当前为只读模式，不能保存沟通记录", "error"); return; }
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
    setRecordBusy(true);
    update((current) => saveCommunicationRecord(current, activeClass.id, draft, makeId).data ?? current);
    const ok = await save();
    setRecordBusy(false);
    if (!ok) { notify("同步失败，沟通内容和对象选择已保留，请重试", "error"); return; }
    setRecordDraft((current) => ({ ...current, date: localCommunicationDate(), home: "", content: "", opinion: "", followUp: "" }));
    setEditingRecordId("");
    setQuickRecordOpen(false);
    notify(editingRecordId ? "沟通记录已更新" : "沟通记录已添加", "success");
  }
  function openRecordEditor(record?: CommunicationRecord) {
    if (readOnly || recordBusy) return;
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
  async function patchRecordStatus(recordId: string, status: CommunicationRecord["status"]) {
    if (readOnly || recordBusy) return;
    setRecordBusy(true);
    update((current) => patchCommunicationStatus(current, activeClass.id, recordId, status));
    const ok = await save(); setRecordBusy(false);
    notify(ok ? "沟通状态已更新" : "状态同步失败，本机修改已保留", ok ? "success" : "error");
  }
  async function deleteRecordMobile(recordId: string) {
    if (readOnly || recordBusy || !await requestDangerConfirm("确认删除这条沟通记录？")) return;
    setRecordBusy(true);
    update((current) => removeCommunicationRecord(current, activeClass.id, recordId));
    const ok = await save(); setRecordBusy(false);
    if (!ok) { notify("删除同步失败，本机修改已保留", "error"); return; }
    setDetail(null);
    notify("沟通记录已删除", "success");
  }
  function openRuleEditor(rule?: PointRule) {
    if (readOnly || ruleBusy) return;
    setDetail(null);
    setRuleDraft(rule ? { ...rule } : { id: "", scene: "课堂", title: "", reason: "", delta: 1, owner: "班主任", enabled: true, level: "自定义", detail: "" });
    setRuleEditorOpen(true);
  }
  async function saveRuleDraft() {
    if (!ruleDraft.title.trim() || !ruleDraft.reason.trim()) {
      notify("请填写规则名称和理由", "error");
      return;
    }
    if (readOnly || ruleBusy) return;
    const nextRule: PointRule = { ...ruleDraft, id: ruleDraft.id || makeId(), title: ruleDraft.title.trim(), reason: ruleDraft.reason.trim(), delta: Number(ruleDraft.delta) || 0, owner: ruleDraft.owner.trim() || "班主任" };
    setRuleBusy(true);
    update((current) => upsertPointRule(current, nextRule));
    const ok = await save(); setRuleBusy(false);
    if (!ok) { notify("规则同步失败，当前编辑内容已保留", "error"); return; }
    setRuleEditorOpen(false);
    notify("积分规则已保存", "success");
  }
  async function toggleRuleEnabled(rule: PointRule) {
    if (readOnly || ruleBusy) return;
    setRuleBusy(true);
    update((current) => patchPointRule(current, rule.id, { enabled: rule.enabled === false }));
    const ok = await save(); setRuleBusy(false);
    notify(ok ? "规则状态已更新" : "状态同步失败，本机修改已保留", ok ? "success" : "error");
  }
  async function copyRuleMobile(rule: PointRule) {
    if (readOnly || ruleBusy) return;
    const copied: PointRule = { ...rule, id: makeId(), title: `${rule.title} 副本`, enabled: true, level: "自定义" };
    setRuleBusy(true);
    update((current) => replacePointRules(current, [copied, ...pointRulesForData(current)]));
    const ok = await save(); setRuleBusy(false);
    notify(ok ? "规则已复制" : "复制同步失败，本机修改已保留", ok ? "success" : "error");
  }
  async function deleteRuleMobile(rule: PointRule) {
    if (readOnly || ruleBusy || !await requestDangerConfirm(`确认删除规则“${rule.title}”？历史积分记录不会删除。`)) return;
    setRuleBusy(true);
    update((current) => deletePointRule(current, rule.id));
    const ok = await save(); setRuleBusy(false);
    if (!ok) { notify("删除同步失败，本机修改已保留", "error"); return; }
    setDetail(null);
    notify("规则已删除", "success");
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
  function openReflectionEditor(item?: ExamReflection) {
    setDetail(null);
    const classExamId = reflectionExamFilter || scoreExamsForClass(data, activeClass.id)[0]?.id;
    const next = item ? { ...item, examId: item.examId || classExamId } : { id: "", studentId: students[0]?.id ?? "", examId: classExamId, date: today(), problem: "", reason: "", action: "", familyMessage: "", teacherNote: "", status: "草稿" as const };
    setReflectionDraft(next);
    reflectionDraftBaseline.current = JSON.stringify(next);
    setReflectionEditorMessage("");
    setReflectionEditorOpen(true);
  }
  async function closeReflectionEditorMobile() {
    if (reflectionBusy) return;
    if (JSON.stringify(reflectionDraft) !== reflectionDraftBaseline.current && !await requestDangerConfirm("当前反思尚未保存，确认关闭并放弃这些修改？", "放弃未保存反思", "放弃修改")) return;
    setReflectionEditorOpen(false);
    setReflectionEditorMessage("");
  }
  async function saveReflectionMobile(status: ExamReflection["status"]) {
    if (readOnly || reflectionBusy) { setReflectionEditorMessage("当前为只读模式，反思内容未修改。"); return; }
    const reflectionId = reflectionDraft.id || makeId();
    const recordId = makeId();
    const input = { ...reflectionDraft, id: reflectionId };
    const preview = saveExamReflection(data, activeClass.id, input, status, () => reflectionId, () => recordId);
    if (preview.error) {
      setReflectionEditorMessage(preview.error);
      return;
    }
    update((current) => saveExamReflection(current, activeClass.id, input, status, () => reflectionId, () => recordId).data ?? current);
    setReflectionDraft(preview.reflection!);
    setReflectionBusy(true); setReflectionEditorMessage("");
    const ok = await save(); setReflectionBusy(false);
    if (!ok) { setReflectionEditorMessage("同步失败，本机反思已保留；编辑窗口不会关闭，请重试保存。"); return; }
    reflectionDraftBaseline.current = JSON.stringify(preview.reflection!);
    setReflectionEditorOpen(false);
    notify(status === "已完成" ? "反思与内部家校沟通留痕已由服务器确认" : "反思草稿已由服务器确认", "success");
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
      <MobileSectionHero title={title} text={`${participants} 名学生已有记录 · 累计加分 ${positiveTotal} · 扣分 ${negativeTotal}`} action={readOnly ? undefined : "选择学生"} onAction={() => setQuickPointOpen(true)} />
      <section className="mobile-point-composer">
        <header>
          <div>
            <h2>本次记分</h2>
            <p>{selectedPointIds.length ? `已选 ${selectedPointIds.length} 人` : "选择学生和规则后提交"}</p>
          </div>
          <strong className={Number(pointDraft.delta) >= 0 ? "positive" : "negative"}>{Number(pointDraft.delta) > 0 ? "+" : ""}{Number(pointDraft.delta) || 0}</strong>
        </header>
        <button type="button" className="mobile-point-step" disabled={readOnly || pointBusy} onClick={() => setQuickPointOpen(true)}>
          <span><small>学生</small><b>{selectedPointIds.length ? selectedStudents.map((student) => student.name).slice(0, 4).join("、") : "选择学生"}</b></span>
          <em>{selectedPointIds.length ? "修改" : "去选择"}</em>
        </button>
        <button type="button" className="mobile-point-step" disabled={readOnly || pointBusy} onClick={() => setPointRuleSheetOpen(true)}>
          <span><small>规则</small><b>{selectedPointRule ? `${selectedPointRule.scene} · ${selectedPointRule.title}` : "暂无可用规则"}</b></span>
          <em>{selectedPointRule ? `${selectedPointRule.delta > 0 ? "+" : ""}${selectedPointRule.delta}` : "—"}</em>
        </button>
        {selectedPointIds.length > 4 && <p className="mobile-point-selected-more">另有 {selectedPointIds.length - 4} 名学生已选中，提交时会一起记分。</p>}
        <div className="mobile-form-grid">
          <label><span>本次分值</span><input type="number" value={pointDraft.delta} onChange={(event) => setPointDraft({ ...pointDraft, delta: Number(event.target.value) || 0 })} /></label>
          <label><span>执行人</span><input value={pointDraft.operator} onChange={(event) => setPointDraft({ ...pointDraft, operator: event.target.value })} placeholder="班主任" /></label>
          <label className="wide"><span>补充说明</span><textarea value={pointDraft.note} onChange={(event) => setPointDraft({ ...pointDraft, note: event.target.value })} placeholder={selectedPointRule ? `默认理由：${selectedPointRule.reason || selectedPointRule.title}` : "请先到积分规则添加并启用规则"} /></label>
        </div>
        <div className="mobile-sheet-actions"><button type="button" disabled={!selectedPointIds.length || pointBusy} onClick={() => setSelectedPointIds([])}>清空选择</button><button type="button" className="primary" disabled={readOnly || pointBusy || !selectedPointIds.length || !selectedPointRule || Number(pointDraft.delta) === 0} onClick={savePointEvent}>{pointBusy ? "提交中…" : selectedPointIds.length ? `提交 ${selectedPointIds.length} 人` : "先选学生"}</button></div>
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
      <MobileSectionHero title={title} text={`${records.length} 条记录 · ${pending} 条待跟进 · 涉及 ${involved} 名学生`} action={readOnly ? undefined : "新增"} onAction={() => openRecordEditor()} />
      <section className="mobile-record-context" aria-label="家校沟通概览"><span><b>{pending}</b> 条待跟进</span><span><b>{resolved}</b> 条已处理</span><small>优先处理有明确回访日期的记录</small></section>
      <NotificationDrafts data={data} update={update} save={save} readOnly={readOnly} mobile />
      <section className="mobile-record-filter-panel">
        <label className="mobile-search"><span>搜索沟通记录</span><input value={recordKeyword} onChange={(event) => setRecordKeyword(event.target.value)} placeholder="学生、内容、反馈、跟进或方式" /></label>
        <div>
          <label><span>状态</span><select value={recordStatusFilter} onChange={(event) => setRecordStatusFilter(event.target.value as CommunicationRecord["status"] | "全部状态")}><option>全部状态</option><option>待跟进</option><option>已跟进</option><option>已归档</option></select></label>
          <label><span>类型</span><select value={recordTypeFilter} onChange={(event) => setRecordTypeFilter(event.target.value)}>{recordTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
      </section>
      <section className="mobile-card-list mobile-record-list"><header><h2>沟通记录</h2><span>{shownRecords.length} 条</span></header>{shownRecords.map((record) => <button type="button" key={record.id} onClick={() => setDetail({ title: `${record.student} · ${record.type}`, children: <><div className="mobile-detail-grid"><span><small>日期</small><b>{record.date}</b></span><span><small>方式</small><b>{record.channel ?? "面谈"}</b></span><span><small>状态</small><b>{record.status ?? "待跟进"}</b></span><span><small>类型</small><b>{record.type}</b></span></div><div className="mobile-sheet-section"><h3>内容</h3><p>{record.content}</p></div><div className="mobile-sheet-section"><h3>后续跟进</h3><p>{record.followUp || "暂无跟进安排"}</p></div><div className="mobile-sheet-section"><h3>家长反馈</h3><p>{record.parentFeedback || "暂无反馈"}</p></div><div className="mobile-form-grid"><label className="wide"><span>状态</span><select disabled={readOnly || recordBusy} value={record.status ?? "待跟进"} onChange={(event) => void patchRecordStatus(record.id, event.target.value as CommunicationRecord["status"])}><option>待跟进</option><option>已跟进</option><option>已归档</option></select></label></div><div className="mobile-sheet-actions"><button type="button" disabled={readOnly || recordBusy} onClick={() => openRecordEditor(record)}>编辑记录</button><button type="button" disabled={recordBusy} onClick={() => copyTextToClipboard(`${record.student}｜${record.type}｜${record.content}｜${record.followUp ?? ""}`, "已复制沟通记录")}>复制记录</button></div><div className="mobile-sheet-actions single"><button type="button" disabled={readOnly || recordBusy} onClick={() => deleteRecordMobile(record.id)}>删除记录</button></div></> })}><b>{record.student} · {record.type}</b><span>{record.date} · {record.status ?? "待跟进"} · {record.channel ?? "面谈"}</span><small>{record.content}</small></button>)}{!shownRecords.length && <article><b>暂无记录</b><span>可以调整状态、类型或关键词筛选。</span></article>}</section>
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
        <div className="mobile-sheet-actions"><button type="button" disabled={recordBusy} onClick={() => { setQuickRecordOpen(false); setEditingRecordId(""); }}>取消</button><button type="button" className="primary" disabled={readOnly || recordBusy} onClick={saveRecord}>{recordBusy ? "保存中…" : "保存记录"}</button></div>
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
    async function saveGrowthEvidence() {
      if (!selectedGrowthStudent || !growthDraft.date || !growthDraft.title.trim() || !growthDraft.content.trim()) {
        setGrowthFormError("请填写日期、标题和具体事实。");
        return;
      }
      if (readOnly || growthBusy) { setGrowthFormError("当前为只读模式，不能保存成长记录。"); return; }
      setGrowthBusy(true);
      update((current) => addGrowthEvidence(current, activeClassId, selectedGrowthStudent.id, growthDraft, makeId).data ?? current);
      const ok = await save(); setGrowthBusy(false);
      if (!ok) { setGrowthFormError("同步失败，当前成长记录内容已保留，请重试。"); return; }
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
          <nav><button type="button" className="primary" disabled={readOnly || growthBusy} onClick={() => { setGrowthDetailOpen(false); setGrowthComposerOpen(true); }}>为{selectedGrowthStudent.name}添加记录</button><button type="button" onClick={() => setDetail({ title: `${selectedGrowthStudent.name} · 成长摘要`, children: <section className="mobile-growth-summary-sheet"><div className="mobile-detail-grid"><span><small>成绩</small><b>{selectedGrowthStudent.score}</b></span><span><small>积分</small><b>{selectedGrowthStudent.points}</b></span><span><small>作业完成</small><b>{homeworkRate}%</b></span><span><small>沟通记录</small><b>{recordsForStudent.length}</b></span></div><div className="mobile-sheet-section"><h3>成长摘要</h3><p>{growthSummary}</p></div><div className="mobile-sheet-section"><h3>优势观察</h3><p>{strengths.join("\n")}</p></div><div className="mobile-sheet-section"><h3>后续跟进</h3><p>{followUps.join("\n")}</p></div><div className="mobile-sheet-actions"><button type="button" onClick={copyGrowthSummary}>{growthCopyState}</button><button type="button" onClick={() => window.print()}>导出素材</button></div></section> })}>查看自动摘要</button></nav>
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
        <div className="mobile-sheet-actions"><button type="button" disabled={growthBusy} onClick={() => setGrowthComposerOpen(false)}>取消</button><button type="button" className="primary" disabled={readOnly || growthBusy} onClick={saveGrowthEvidence}>{growthBusy ? "保存中…" : "保存成长记录"}</button></div>
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
      const next = existing ? { ...existing } : {
        id: "",
        studentId: row.student.id,
        examId: exam.id,
        date: today(),
        problem: row.followUp ? `${exam.title}需要重点跟进，请结合本次成绩和课堂表现复盘。` : "",
        reason: "",
        action: row.advice,
        familyMessage: "",
        teacherNote: "",
        status: "草稿" as const,
      };
      setReflectionDraft(next);
      reflectionDraftBaseline.current = JSON.stringify(next);
      setReflectionEditorMessage("");
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
        return <button type="button" key={item.id} onClick={() => setDetail({ title: `${studentName(item.studentId)} · ${item.status}`, children: <><div className="mobile-detail-grid"><span><small>考试</small><b>{exam?.title ?? "未关联"}</b></span><span><small>日期</small><b>{item.date}</b></span></div><div className="mobile-sheet-section"><h3>主要问题</h3><p>{item.problem || "未填写"}</p></div><div className="mobile-sheet-section"><h3>原因分析</h3><p>{item.reason || "未填写"}</p></div><div className="mobile-sheet-section"><h3>行动</h3><p>{item.action || "未填写"}</p></div><div className="mobile-sheet-section"><h3>家长配合</h3><p>{item.familyMessage || "未填写"}</p></div><div className="mobile-sheet-actions"><button type="button" disabled={readOnly || reflectionBusy} onClick={() => openReflectionEditor(item)}>编辑反思</button><button type="button" onClick={() => copyTextToClipboard(`${item.problem}\n${item.reason}\n${item.action}`, "已复制反思")}>复制反思</button></div></> })}><b>{studentName(item.studentId)} · {item.status}</b><span>{exam?.title ? `${exam.title} · ` : ""}{item.date} · {item.problem || "暂无问题描述"}</span></button>;
      })}{!filteredReflections.length && <article><b>暂无反思</b><span>切换到学生状态，选择学生后填写本次考试反思。</span></article>}{filteredReflections.length > reflectionPageSize && <div className="mobile-list-pager"><button type="button" disabled={safeReflectionSavedPage <= 1} onClick={() => setReflectionSavedPage((page) => page - 1)}>上一页</button><span>{safeReflectionSavedPage} / {reflectionSavedPageCount}</span><button type="button" disabled={safeReflectionSavedPage >= reflectionSavedPageCount} onClick={() => setReflectionSavedPage((page) => page + 1)}>下一页</button></div>}</section></>}
      {detail && <MobileInfoSheet title={detail.title} onClose={() => setDetail(null)}>{detail.children}</MobileInfoSheet>}
      {reflectionEditorOpen && <MobileInfoSheet title={`${reflectionDraft.id ? "编辑反思" : "填写反思"} · ${studentName(reflectionDraft.studentId)}`} onClose={() => void closeReflectionEditorMobile()}>
        <section className="mobile-reflection-editor-context"><span><b>{studentName(reflectionDraft.studentId)}</b><small>{reflectionExams.find((exam) => exam.id === reflectionDraft.examId)?.title ?? "当前考试"}</small></span><em>{reflectionDraft.status}</em></section>
        <div className="mobile-form-grid">
          <label><span>日期</span><input disabled={readOnly || reflectionBusy} value={reflectionDraft.date} onChange={(event) => setReflectionDraft({ ...reflectionDraft, date: event.target.value })} /></label>
          <label><span>状态</span><select disabled={readOnly || reflectionBusy} value={reflectionDraft.status} onChange={(event) => setReflectionDraft({ ...reflectionDraft, status: event.target.value as ExamReflection["status"] })}><option>草稿</option><option>已完成</option></select></label>
          <label className="wide"><span>主要问题</span><textarea disabled={readOnly || reflectionBusy} value={reflectionDraft.problem} onChange={(event) => setReflectionDraft({ ...reflectionDraft, problem: event.target.value })} /></label>
          <label className="wide"><span>原因分析</span><textarea disabled={readOnly || reflectionBusy} value={reflectionDraft.reason} onChange={(event) => setReflectionDraft({ ...reflectionDraft, reason: event.target.value })} /></label>
          <label className="wide"><span>下一步行动</span><textarea disabled={readOnly || reflectionBusy} value={reflectionDraft.action} onChange={(event) => setReflectionDraft({ ...reflectionDraft, action: event.target.value })} /></label>
          <label className="wide"><span>写给家长</span><textarea disabled={readOnly || reflectionBusy} value={reflectionDraft.familyMessage} onChange={(event) => setReflectionDraft({ ...reflectionDraft, familyMessage: event.target.value })} /></label>
          <label className="wide"><span>班主任跟进</span><textarea disabled={readOnly || reflectionBusy} value={reflectionDraft.teacherNote} onChange={(event) => setReflectionDraft({ ...reflectionDraft, teacherNote: event.target.value })} /></label>
        </div>
        {reflectionEditorMessage && <p className="mobile-form-error" role="status">{reflectionEditorMessage}</p>}
        <div className="mobile-sheet-actions"><button type="button" disabled={readOnly || reflectionBusy} onClick={() => void saveReflectionMobile("草稿")}>{reflectionBusy ? "保存中…" : "保存草稿"}</button><button type="button" className="primary" disabled={readOnly || reflectionBusy} onClick={() => void saveReflectionMobile("已完成")}>{reflectionBusy ? "保存中…" : "完成归档"}</button></div>
      </MobileInfoSheet>}
    </div>;
  }

  if (active === "tools") return <div className="mobile-stack"><ClassroomTools data={data} update={update} readOnly={readOnly} /></div>;

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
      <MobileSectionHero title={title} text={`${ruleSource.length} 条规则 · 启用 ${enabled.length} · 停用 ${ruleSource.length - enabled.length}`} action={readOnly ? undefined : "新增"} onAction={() => openRuleEditor()} />
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
        <div className="mobile-sheet-actions"><button type="button" disabled={ruleBusy} onClick={() => setRuleEditorOpen(false)}>取消</button><button type="button" className="primary" disabled={readOnly || ruleBusy} onClick={saveRuleDraft}>{ruleBusy ? "保存中…" : "保存规则"}</button></div>
      </MobileInfoSheet>}
    </div>;
  }

  return null;
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

function Points({ data, update, save, readOnly }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; save: () => Promise<boolean>; readOnly: boolean }) {
  const rules = pointRulesForData(data).filter((item) => item.enabled !== false);
  const [ruleId, setRuleId] = useState(rules[0]?.id ?? "");
  const [keyword, setKeyword] = useState("");
  const [groupFilter, setGroupFilter] = useState("全部小组");
  const [operator, setOperator] = useState("班主任");
  const [note, setNote] = useState("");
  const [customDelta, setCustomDelta] = useState(rules[0]?.delta ?? 1);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

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

  async function applyScore(studentIds: string[]) {
    if (!studentIds.length || !rule || value === 0) return;
    if (readOnly || busy) { setMessage("当前为只读模式，不能提交积分。"); return; }
    const stamp = new Date().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    setBusy(true); setMessage("");
    update((d) => applyPointEvents(d, activeClassId, studentIds, rule, value, note, operator, stamp, makeId));
    const ok = await save(); setBusy(false);
    if (!ok) { setMessage("积分同步失败，学生选择和本次说明已保留，请重试。"); return; }
    setSelected([]);
    setNote("");
    setMessage(`已由服务器确认 ${studentIds.length} 名学生的积分记录`);
  }

  async function undoEvent(event: PointEvent) {
    if (readOnly || busy) return;
    setBusy(true); setMessage("");
    update((d) => undoPointEventInClass(d, activeClassId, event.id));
    const ok = await save(); setBusy(false);
    setMessage(ok ? "撤销已由服务器确认" : "撤销同步失败，本机修改已保留。");
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
            <button className="pointdesk-clear" disabled={!selected.length || busy} onClick={() => setSelected([])}>清空</button>
            <button className="pointdesk-primary" disabled={readOnly || busy || !selected.length || value === 0} onClick={() => void applyScore(selected)}>
              {busy ? "提交中…" : selected.length ? `提交 ${selected.length} 人` : "请选择学生"}
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
                <tr><th><label className="pointdesk-select-all"><input type="checkbox" aria-label="全选当前筛选学生" checked={filteredAllSelected} disabled={readOnly || busy} onChange={toggleFiltered} /><span className="visually-hidden">全选当前筛选学生</span></label></th><th>学生</th><th>考勤</th><th>小组</th><th>当前积分</th><th>作业</th></tr>
              </thead>
              <tbody>
                {filtered.map((student) => <tr className={selected.includes(student.id) ? "selected" : ""} key={student.id} onClick={() => { if (!readOnly && !busy) toggleStudent(student.id); }}>
                  <td><input type="checkbox" aria-label={`选择${student.name}`} checked={selected.includes(student.id)} disabled={readOnly || busy} onChange={() => toggleStudent(student.id)} onClick={(event) => event.stopPropagation()} /></td>
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
        <button className="pointdesk-submit" disabled={readOnly || busy || !selected.length || value === 0} onClick={() => void applyScore(selected)}>
          {busy ? "提交中…" : selected.length ? `给 ${selected.length} 人${actionText}` : "请选择学生"}
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
              <button disabled={readOnly || busy} onClick={() => void undoEvent(event)}>撤销</button>
            </article>;
          })}
          {!classEvents.length && <div className="pointdesk-empty">还没有积分事件，提交后会出现在这里。</div>}
        </div>
      </details>
      {message && <p className="pointdesk-message" role="status">{message}</p>}
    </div>
  </section>;
}


function Rules({ data, update, save, readOnly }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; save: () => Promise<boolean>; readOnly: boolean }) {
  const [category, setCategory] = useState("全部");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"全部状态" | "启用" | "停用">("全部状态");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ scene: "学习", title: "", reason: "", delta: 1, owner: "班主任", level: "自定义" as PointRule["level"] });
  const [editingRule, setEditingRule] = useState<{ id: string; scene: string; title: string; reason: string; delta: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const rules = pointRulesForData(data);
  const categories = ["全部", ...Array.from(new Set(rules.map((item) => item.scene)))];
  const visibleRules = rules.filter((item) => {
    const text = `${item.scene}${item.title}${item.reason}${item.owner}${item.delta}${item.detail ?? ""}`;
    const status = item.enabled === false ? "停用" : "启用";
    return (category === "全部" || item.scene === category) && (statusFilter === "全部状态" || statusFilter === status) && (!keyword.trim() || text.includes(keyword.trim()));
  });
  const activeRules = rules.filter((item) => item.enabled !== false);
  const usageFor = (item: PointRule) => pointRuleUsageCount(data.pointEvents ?? [], item);
  async function editRule(id: string, patch: Partial<PointRule>) {
    if (readOnly || busy) return false;
    setBusy(true); setMessage("");
    update((d) => patchPointRule(d, id, patch));
    const ok = await save(); setBusy(false);
    if (!ok) setMessage("规则同步失败，本机修改已保留。");
    return ok;
  }
  function startEditRule(item: PointRule) {
    setEditingRule({ id: item.id, scene: item.scene, title: item.title, reason: item.reason, delta: item.delta });
  }
  async function saveEditingRule() {
    if (!editingRule || !editingRule.title.trim() || !editingRule.reason.trim()) return;
    const ok = await editRule(editingRule.id, {
      scene: editingRule.scene.trim() || "其他",
      title: editingRule.title.trim(),
      reason: editingRule.reason.trim(),
      delta: Number(editingRule.delta) || 0,
    });
    if (ok) setEditingRule(null);
  }
  async function addRule() {
    if (!draft.title.trim() || !draft.reason.trim()) return;
    if (readOnly || busy) return;
    const newRule: PointRule = { id: makeId(), scene: draft.scene.trim() || "其他", title: draft.title.trim(), reason: draft.reason.trim(), delta: Number(draft.delta) || 0, owner: draft.owner.trim() || "班主任", enabled: true, level: draft.level, detail: "由班主任自定义添加。" };
    setBusy(true); setMessage(""); update((d) => upsertPointRule(d, newRule));
    const ok = await save(); setBusy(false);
    if (!ok) { setMessage("规则同步失败，新增内容已保留，请重试。"); return; }
    setDraft({ scene: "学习", title: "", reason: "", delta: 1, owner: "班主任", level: "自定义" });
    setCategory(newRule.scene);
    setShowForm(false);
  }
  async function copyRule(item: PointRule) {
    if (readOnly || busy) return;
    const copied: PointRule = { ...item, id: makeId(), title: `${item.title} 副本`, enabled: true, level: "自定义" };
    setBusy(true); update((d) => replacePointRules(d, [copied, ...pointRulesForData(d)]));
    const ok = await save(); setBusy(false); setMessage(ok ? "规则副本已由服务器确认" : "复制同步失败，本机修改已保留。");
  }
  async function deleteRule(id: string) {
    const target = rules.find((item) => item.id === id);
    if (!target || readOnly || busy || !await requestDangerConfirm(`规则“${target.title}”会从规则库移除，历史积分记录不会删除。`)) return;
    setBusy(true); update((d) => deletePointRule(d, id)); const ok = await save(); setBusy(false); setMessage(ok ? "规则删除已由服务器确认，历史积分未改变" : "删除同步失败，本机修改已保留。");
  }
  return <section className="rule-pro-page homework-bootstrap-preview">
    <WorkbenchPageHeader icon="📏" tone="marigold" title="班级积分规则库" description="统一维护班级加分、扣分规则，供积分评价页快速调用。" actions={<button className="ruledesk-add workbench-header-primary" disabled={readOnly || busy} onClick={() => setShowForm((value) => !value)}>{showForm ? "收起新增" : "添加规则"}</button>} />
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
        <button className="primary" disabled={readOnly || busy || !draft.title.trim() || !draft.reason.trim()} onClick={() => void addRule()}>{busy ? "保存中…" : "保存规则"}</button>
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
          <button className={item.enabled === false ? "ruledesk-status off" : "ruledesk-status on"} disabled={readOnly || busy} onClick={() => void editRule(item.id, { enabled: item.enabled === false })}>{item.enabled === false ? "停用" : "启用"}</button>
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
              <button className="primary-text" disabled={readOnly || busy || !editingRule.title.trim() || !editingRule.reason.trim()} onClick={() => void saveEditingRule()}>保存</button>
              <button onClick={() => setEditingRule(null)}>取消</button>
            </> : <>
              <button disabled={readOnly || busy} onClick={() => startEditRule(item)}>编辑</button>
              <button disabled={readOnly || busy} onClick={() => void copyRule(item)}>复制</button>
              <button className="danger" disabled={readOnly || busy} onClick={() => deleteRule(item.id)}>删除</button>
            </>}
          </div>
        </article>;
      })}
      {!visibleRules.length && <div className="ruledesk-empty">当前分类没有规则，可以切回全部或添加新规则。</div>}
    </section>
    {message && <p className="ruledesk-message" role="status">{message}</p>}
  </section>;
}

type GrowthKind = "沟通记录" | "积分表现" | "作业记录" | "老师补充";
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

function Growth({ data, update, save, readOnly, requestedStudentId }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; save: () => Promise<boolean>; readOnly: boolean; requestedStudentId?: string }) {
  const [id, setId] = useState(requestedStudentId || data.students[0]?.id || "");
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
  const [busy, setBusy] = useState(false);
  const [copyState, setCopyState] = useState("复制成长摘要");
  const [draft, setDraft] = useState({ date: today(), type: "表扬记录", title: "", content: "", followUp: "" });
  useEffect(() => {
    if (requestedStudentId && data.students.some(student => student.id === requestedStudentId)) setId(requestedStudentId);
  }, [data.students, requestedStudentId]);
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
  const cadre = (data.cadres ?? []).find((role) => role.studentId === student.id && (!role.classId || role.classId === activeClassId));
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
  async function saveEvidence() {
    if (!draft.date || !draft.title.trim() || !draft.content.trim()) { setFormError("请填写日期、简短标题和具体事实。"); return; }
    if (readOnly || busy) { setFormError("当前为只读模式，不能保存成长记录。"); return; }
    setBusy(true); setFormError("");
    update((current) => addGrowthEvidence(current, activeClassId ?? "class-1", student.id, draft, makeId).data ?? current);
    const ok = await save(); setBusy(false);
    if (!ok) { setFormError("同步失败，当前成长记录内容已保留，请重试。"); return; }
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
    <WorkbenchPageHeader icon="🌱" tone="jade" title="学生成长记录" description="选择学生，记录可观察的成长事实与后续跟进。" actions={<div className="growth2-actions"><button className="primary workbench-header-primary" disabled={readOnly || busy} onClick={() => setShowComposer(true)}>为{student.name}添加记录</button><details className="growth2-more-actions"><summary>更多</summary><button onClick={copySummary}>{copyState}</button><button onClick={() => window.print()}>导出素材</button></details></div>} />
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
          <footer><button disabled={busy} onClick={() => setShowComposer(false)}>取消</button><button className="primary" disabled={readOnly || busy} onClick={saveEvidence}>{busy ? "保存中…" : "保存成长记录"}</button></footer>
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

function Records({ data, update, save, readOnly }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; save: () => Promise<boolean>; readOnly: boolean }) {
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
  const [busy, setBusy] = useState(false);
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
    if (readOnly) return;
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
    if (readOnly) return;
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
  async function saveRecord() {
    if (readOnly || busy) { setRecordError("当前为只读模式，不能保存沟通记录。"); return; }
    const draft = { id: editingRecordId ?? undefined, studentId, type, channel, date: recordTime, purpose, home, content, parentFeedback: opinion, followUp };
    const preview = saveCommunicationRecord(data, activeClassId, draft, () => "record-preview");
    if (preview.error) { setRecordError(preview.error); return; }
    setRecordError(""); setBusy(true);
    update((current) => saveCommunicationRecord(current, activeClassId, draft, makeId).data ?? current);
    const ok = await save(); setBusy(false);
    if (ok) setRecordModalOpen(false);
    else setRecordError("同步失败，沟通内容和学生选择已保留，请重试。");
  }
  async function deleteRecord(record: CommunicationRecord) {
    const confirmed = await requestDangerConfirm(`${record.student} 的这条${record.type}记录会从家校沟通台账中移除。`);
    if (!confirmed || readOnly || busy) return;
    setBusy(true);
    update((current) => removeCommunicationRecord(current, activeClassId, record.id));
    const ok = await save(); setBusy(false);
    if (!ok) setRecordError("删除同步失败，本机修改已保留。");
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
    <WorkbenchPageHeader icon="💬" tone="berry" title="沟通记录" description="按学生、类型和状态查找记录，待跟进事项优先处理。" actions={<button type="button" className="record3-primary workbench-header-primary" disabled={readOnly || busy} onClick={openAddRecord}>新增沟通记录</button>} />
    <section className="record3-page">
      <div className="record3-progressline"><span>当前班级</span><b>{classRecords.length} 条沟通记录</b><em>{followCount} 条待跟进</em><em>{resolvedCount} 条已处理</em></div>
      <NotificationDrafts data={data} update={update} save={save} readOnly={readOnly} />

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
          {visibleRecords.length ? visibleRecords.map((r) => <article key={r.id} className="record3-row"><b><i>{r.student.slice(0,1)}</i><span>{r.student}</span></b><time>{r.date}</time><span>{r.type}<small>{r.channel ?? "面谈"}</small></span><p>{r.content}</p><p>{r.parentFeedback && <small>反馈：{r.parentFeedback}</small>}{r.followUp && <small>跟进：{r.followUp}</small>}</p><select disabled={readOnly || busy} value={r.status ?? "待跟进"} onChange={async (e) => { setBusy(true); update((current) => patchCommunicationStatus(current, activeClassId, r.id, e.target.value as CommunicationRecord["status"])); const ok = await save(); setBusy(false); if (!ok) setRecordError("状态同步失败，本机修改已保留。"); }}><option>待跟进</option><option>已跟进</option><option>已归档</option></select><div><button type="button" disabled={readOnly || busy} onClick={() => openEditRecord(r)}>编辑</button><button type="button" disabled={busy} onClick={() => copyTextToClipboard(`${r.student}｜${r.type}｜${r.content}｜${r.followUp ?? ""}`, "已复制沟通记录")}>复制</button><button type="button" disabled={readOnly || busy} onClick={() => deleteRecord(r)}>删除</button></div></article>) : <div className="record3-empty">没有符合条件的沟通记录。</div>}
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
          <footer><button type="button" disabled={busy} onClick={() => setRecordModalOpen(false)}>取消</button><button type="button" className="record3-primary" disabled={readOnly || busy} onClick={saveRecord}>{busy ? "保存中…" : editingRecordId ? "保存修改" : "保存记录"}</button></footer>
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

function Scores(props: { workspaceToken: string; data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; save: () => Promise<boolean>; readOnly: boolean }) {
  const activeClassId = props.data.activeClassId ?? props.data.rosterClasses?.[0]?.id ?? "class-1";
  if (!scoreExamsForClass(props.data, activeClassId).length) return <EmptyScoreWorkspace data={props.data} classId={activeClassId} update={props.update} save={props.save} readOnly={props.readOnly} mobile={false} />;
  return <ScoresWithExam {...props} />;
}

function ScoresWithExam({ workspaceToken, data, update, save, readOnly }: { workspaceToken: string; data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; save: () => Promise<boolean>; readOnly: boolean }) {
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
  const [scoreBusy, setScoreBusy] = useState(false);
  const [scoreMessage, setScoreMessage] = useState("");
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
    if (readOnly) return;
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
  async function applyBatchScore() {
    if (readOnly || scoreBusy) return;
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
    setScoreBusy(true);
    const ok = await save();
    setScoreBusy(false);
    if (!ok) { setBatchScoreError("同步失败，本机录分已保留；请重试保存，当前选择不会清空。"); return; }
    setBatchScoreError("");
    setShowBatchScore(false);
    setSelectedIds([]);
  }
  function setAdvice(studentId: string, advice: string) {
    if (readOnly) return;
    updateExam({ ...exam, advice: { ...(exam.advice ?? {}), [studentId]: advice } });
  }
  async function toggleFollow(studentId: string) {
    if (readOnly || scoreBusy) return;
    const list = exam.followUpStudentIds ?? [];
    updateExam({ ...exam, followUpStudentIds: list.includes(studentId) ? list.filter((id) => id !== studentId) : [...list, studentId] });
    setScoreBusy(true); setScoreMessage("");
    const ok = await save(); setScoreBusy(false);
    setScoreMessage(ok ? "重点状态已同步" : "重点状态同步失败，本机修改已保留。");
  }
  async function batchFollow(mark: boolean) {
    if (readOnly || scoreBusy) return;
    const list = exam.followUpStudentIds ?? [];
    const nextList = mark ? Array.from(new Set([...list, ...selectedIds])) : list.filter((id) => !selectedIds.includes(id));
    updateExam({ ...exam, followUpStudentIds: nextList });
    setScoreBusy(true); setScoreMessage("");
    const ok = await save(); setScoreBusy(false);
    if (!ok) { setScoreMessage("批量重点状态同步失败，本机修改已保留；当前选择不会清空。"); return; }
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
  async function confirmAddExam() {
    if (readOnly || scoreBusy) return;
    const nextSubjects = parseSubjects(subjectDraft);
    if (!nextSubjects.length) return;
    const result = createScoreExam(data, activeClassId, { title: newExamTitle, date: newExamDate, subjects: nextSubjects }, makeId);
    if (!result.exam) { notify(result.error ?? "考试创建失败。", "error"); return; }
    const next = result.exam;
    update((current) => createScoreExam(current, activeClassId, { title: newExamTitle, date: newExamDate, subjects: nextSubjects }, () => next.id).data ?? current);
    setScoreBusy(true); setScoreMessage("");
    const ok = await save(); setScoreBusy(false);
    if (!ok) { setScoreMessage("新增考试同步失败，本机修改已保留；窗口保持打开，请重试。"); return; }
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
    if (readOnly || scoreBusy || !await requestDangerConfirm(`${exam.title} 的全部成绩、跟进标记和关联反思都会删除。`, "删除考试", "确认删除")) return;
    update((current) => removeScoreExam(current, activeClassId, exam.id));
    setScoreBusy(true); setScoreMessage("");
    const ok = await save(); setScoreBusy(false);
    if (!ok) { setScoreMessage("删除同步失败，本机修改已保留；窗口保持打开，请重试。"); return; }
    setExamId(exams.find((item) => item.id !== exam.id)?.id ?? "");
    setShowExamEdit(false);
  }
  async function confirmExamEdit() {
    if (readOnly || scoreBusy) return;
    const nextSubjects = parseSubjects(editSubjects);
    if (!nextSubjects.length) return;
    const preview = editScoreExam(data, activeClassId, exam.id, { title: editTitle, date: editDate, subjects: nextSubjects });
    if (preview.error) { notify(preview.error, "error"); return; }
    update((current) => editScoreExam(current, activeClassId, exam.id, { title: editTitle, date: editDate, subjects: nextSubjects }).data ?? current);
    setScoreBusy(true); setScoreMessage("");
    const ok = await save(); setScoreBusy(false);
    if (!ok) { setScoreMessage("考试信息同步失败，本机修改已保留；窗口保持打开，请重试。"); return; }
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
  async function saveFilterEditor() {
    if (readOnly || scoreBusy) return;
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
    setScoreBusy(true); setScoreMessage("");
    const ok = await save(); setScoreBusy(false);
    if (!ok) { setScoreMessage("满分与区间同步失败，本机修改已保留；编辑窗口保持打开。"); return; }
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
        <div className="score5-actions"><button type="button" onClick={() => setShowExamLibrary(true)}>切换考试</button><button type="button" disabled={readOnly || scoreBusy} onClick={openExamEdit}>编辑考试</button><button type="button" className="score5-primary" disabled={readOnly || scoreBusy} onClick={addExam}>新增考试</button></div>
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
      {scoreWorkspaceView === "analysis" && <ScoreItemAnalysis data={data} classId={activeClassId} workspaceToken={workspaceToken} exam={exam} students={data.students} update={update} save={save} readOnly={readOnly} />}
      {scoreMessage && <p className="score5-batch-error" role="status">{scoreMessage}</p>}

      {scoreWorkspaceView === "records" && <><section className="score5-toolbar">
        <label className="score5-filter-field wide"><span>学生搜索</span><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="姓名、学号或建议" /></label>
        <label className="score5-filter-field"><span>小组</span><select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option>全部小组</option>{groupOptions.map((group) => <option value={group} key={group}>第{group}组</option>)}</select></label>
        <label className="score5-filter-field"><span>显示科目</span><select value={detailSubjectFilter} onChange={(e) => { setDetailSubjectFilter(e.target.value); setScoreRangeFilter("全部"); }}><option>全部</option>{subjects.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="score5-filter-field"><span>分数区间</span><select value={scoreRangeFilter} onChange={(e) => setScoreRangeFilter(e.target.value)}><option>全部</option>{activeRanges.map((item) => <option value={item.id} key={item.id}>{item.label} {item.min}-{item.max}</option>)}</select></label>
        <label className="score5-filter-field"><span>重点标记</span><select value={followFilter} onChange={(e) => setFollowFilter(e.target.value as typeof followFilter)}><option>全部</option><option>已标记</option><option>未标记</option></select></label>
        <label className="score5-filter-field"><span>排序字段</span><select value={sortKey} onChange={(e) => setSortKey(e.target.value)}><option value="priority">待处理优先</option><option value="total">总分</option><option value="average">平均分</option>{subjects.map((item) => <option value={`subject:${item}`} key={item}>{item}</option>)}<option value="studentNo">学号</option><option value="name">姓名</option></select></label>
        <label className="score5-filter-field"><span>排序方式</span><select value={sortDir} disabled={sortKey === "priority"} onChange={(e) => setSortDir(e.target.value as typeof sortDir)}>{sortKey === "priority" ? <option value="asc">未录与重点在前</option> : <><option value="desc">降序</option><option value="asc">升序</option></>}</select></label>
        <button type="button" className="score5-filter-edit" disabled={readOnly || scoreBusy} onClick={openFilterEditor}>编辑筛选项</button>
        <div className={`score5-selection ${selectedIds.length ? "active" : ""}`}><span>当前 {visible.length} 人</span><strong>已选 {selectedIds.length} 人</strong>{selectedIds.length > 0 && <><button type="button" disabled={readOnly || scoreBusy} onClick={openBatchScore}>批量录分</button><button type="button" disabled={readOnly || scoreBusy} onClick={() => void batchFollow(true)}>批量标记重点</button><button type="button" disabled={readOnly || scoreBusy} onClick={() => void batchFollow(false)}>取消重点</button></>}</div>
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
              {tableSubjects.map((subject) => <td key={subject}><input disabled={readOnly} className="score5-score-input" aria-label={`${student.name}${subject}成绩`} type="number" min={0} max={subjectMaxScore(exam, subject)} value={scoreEntry(exam, student.id, subject) ?? ""} onChange={(e) => setScore(student.id, subject, e.target.value)} placeholder="未录" /></td>)}
              <td><strong>{complete ? total : "待补全"}</strong></td>
              <td><strong>{enteredCount ? average : "未录入"}</strong></td>
              <td><button type="button" disabled={readOnly || scoreBusy} className={followUp ? "active" : ""} onClick={() => void toggleFollow(student.id)}>{followUp ? "已标记" : "标记"}</button></td>
              <td><textarea disabled={readOnly} className="score5-advice" rows={2} aria-label={`${student.name}成绩建议`} value={advice} onChange={(e) => setAdvice(student.id, e.target.value)} /></td>
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
        <footer><span>{batchScoreValue === "" ? "填写同一分数后应用到已选学生。" : `将统一录入 ${activeBatchScore} 分。`}</span><button type="button" disabled={scoreBusy} onClick={() => setShowBatchScore(false)}>取消</button><button type="button" className="score5-primary" disabled={readOnly || scoreBusy || !selectedIds.length || batchScoreValue === ""} onClick={() => void applyBatchScore()}>{scoreBusy ? "保存中…" : "应用到已选"}</button></footer>
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
        <footer><button type="button" disabled={scoreBusy} onClick={() => setShowExamSetup(false)}>取消</button><button type="button" className="score5-primary" disabled={readOnly || scoreBusy || !parseSubjects(subjectDraft).length} onClick={() => void confirmAddExam()}>{scoreBusy ? "保存中…" : "确认新增"}</button></footer>
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
        <footer><button type="button" className="danger-small" disabled={readOnly || scoreBusy} onClick={() => void deleteCurrentExam()}>删除考试</button><button type="button" disabled={scoreBusy} onClick={() => setShowExamEdit(false)}>取消</button><button type="button" className="score5-primary" disabled={readOnly || scoreBusy || !parseSubjects(editSubjects).length} onClick={() => void confirmExamEdit()}>{scoreBusy ? "保存中…" : "保存考试"}</button></footer>
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
          <button type="button" className="score5-add-range" disabled={readOnly || scoreBusy} onClick={() => setRangeDrafts((list) => [...list, { id: `custom-${Date.now()}`, label: "自定义", min: 0, max: subjectMaxScore(exam, filterSubjectDraft) }])}>新增区间</button>
        </div>
        <footer><button type="button" disabled={scoreBusy} onClick={() => setShowFilterEditor(false)}>取消</button><button type="button" className="score5-primary" disabled={readOnly || scoreBusy} onClick={() => void saveFilterEditor()}>{scoreBusy ? "保存中…" : "保存筛选项"}</button></footer>
      </section>
    </div>}
  </>;
}

function Reflection({ data, update, save, open, readOnly }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; save: () => Promise<boolean>; open: (id: ModuleId) => void; readOnly: boolean }) {
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "class-1";
  if (!scoreExamsForClass(data, activeClassId).length) return <>
    <WorkbenchPageHeader icon="📝" tone="iris" title="本次考试反思" description="先建立真实考试，再为学生填写考试反思。" />
    <section className="reflection5-page"><section className="reflection5-current workbench-page-context"><div className="reflection5-current-main"><span>考试反思</span><h3>还没有可反思的考试</h3><p>成绩分析中新增考试后，这里会显示对应学生和成绩上下文。</p></div><div className="reflection5-actions"><button type="button" onClick={() => open("scores")}>去成绩分析</button></div></section></section>
  </>;
  return <ReflectionWithExam data={data} update={update} saveWorkspace={save} readOnly={readOnly} />;
}

function ReflectionWithExam({ data, update, saveWorkspace, readOnly }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; saveWorkspace: () => Promise<boolean>; readOnly: boolean }) {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "class-1";
  const initialStudentId = params?.get("studentId") || "";
  const initialExamId = params?.get("examId") || "";
  const [selectedKey, setSelectedKey] = useState(initialExamId && initialStudentId ? `${initialExamId}::${initialStudentId}` : "");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [examPage, setExamPage] = useState(1);
  const [savedState, setSavedState] = useState("");
  const [reflectionBusy, setReflectionBusy] = useState(false);
  const reflectionDraftBaseline = useRef("");
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
    const next = selected.reflection ?? {
      id: makeId(),
      studentId: selected.student.id,
      examId: selected.exam.id,
      date: today(),
      problem: "",
      reason: "",
      action: "",
      familyMessage: "",
      teacherNote: "",
      status: "草稿" as const,
    };
    setDraft(next);
    reflectionDraftBaseline.current = JSON.stringify(next);
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
  async function selectReflection(nextKey: string) {
    if (reflectionBusy || nextKey === selected.key) return;
    if (JSON.stringify(draft) !== reflectionDraftBaseline.current && !await requestDangerConfirm("当前反思尚未保存，确认切换学生并放弃这些修改？", "放弃未保存反思", "放弃修改")) return;
    setSelectedKey(nextKey);
  }
  async function chooseReflectionExam(nextExamId: string) {
    if (reflectionBusy) return;
    if (JSON.stringify(draft) !== reflectionDraftBaseline.current && !await requestDangerConfirm("当前反思尚未保存，确认切换考试并放弃这些修改？", "放弃未保存反思", "放弃修改")) return;
    setExamFilter(nextExamId); setSelectedKey(""); setShowExamLibrary(false);
  }
  async function save(status: ExamReflection["status"]) {
    if (readOnly || reflectionBusy) {
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
    setReflectionBusy(true); setSavedState("");
    const ok = await saveWorkspace(); setReflectionBusy(false);
    if (!ok) { setSavedState("同步失败，本机反思已保留；当前学生和编辑内容不会丢失。"); return; }
    reflectionDraftBaseline.current = JSON.stringify(preview.reflection!);
    setSavedState(status === "已完成" ? "反思与内部家校沟通留痕已由服务器确认" : "反思草稿已由服务器确认");
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
            {pagedRows.map((row) => <button type="button" disabled={reflectionBusy} className={row.key === selected.key ? "active" : ""} key={row.key} onClick={() => void selectReflection(row.key)}>
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
          <div className="reflection5-form"><label><span>主要问题</span><textarea disabled={readOnly || reflectionBusy} value={draft.problem} onChange={(e) => setDraft({ ...draft, problem: e.target.value })} placeholder="老师填写：这次考试最需要和学生复盘的问题。" /></label><label><span>原因分析</span><textarea disabled={readOnly || reflectionBusy} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} placeholder="老师填写：错因、状态、习惯或知识点问题。" /></label><label><span>下一步行动</span><textarea disabled={readOnly || reflectionBusy} value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} placeholder="老师填写：订正、面谈、练习、复测等安排。" /></label><label><span>写给家长的话</span><textarea disabled={readOnly || reflectionBusy} value={draft.familyMessage} onChange={(e) => setDraft({ ...draft, familyMessage: e.target.value })} placeholder="老师填写：需要家长配合的观察和提醒。" /></label><label className="wide"><span>班主任跟进</span><textarea disabled={readOnly || reflectionBusy} value={draft.teacherNote} onChange={(e) => setDraft({ ...draft, teacherNote: e.target.value })} placeholder="老师填写：后续追踪节点、复查方式或备注。" /></label></div>
          <footer><button type="button" disabled={readOnly || reflectionBusy} onClick={() => void save("草稿")}>{reflectionBusy ? "保存中…" : "保存草稿"}</button><button type="button" className="reflection5-primary" disabled={readOnly || reflectionBusy} onClick={() => void save("已完成")}>{reflectionBusy ? "保存中…" : "完成并归档"}</button></footer>
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
              {pagedExams.map((item) => <tr className={item.exam.id === examFilter ? "active" : ""} key={item.exam.id} onClick={() => void chooseReflectionExam(item.exam.id)}><td><b>{item.exam.title}</b></td><td>{item.exam.date}</td><td>{item.subjects.join("，")}</td><td><button type="button" disabled={reflectionBusy}>{item.exam.id === examFilter ? "当前" : "打开"}</button></td></tr>)}
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
