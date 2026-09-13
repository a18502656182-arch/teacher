"use client";

import { StudentLookupDialog } from "@/app/components/campus/StudentLookupDialog";
import { CampusIcon, ThemeArtwork } from "@/app/components/campus/primitives";
import { copyTextToClipboard } from "@/lib/clipboard";
import { makeId } from "@/lib/classroom";
import type { ClassroomData, DutyJob, DutyRecord } from "@/lib/classroom";
import { useState } from "react";
import {
  assignDutyStudent,
  dutyAssignmentFor,
  dutyDateForDay,
  dutyGroupsForClass,
  dutyRecordFor,
  dutyRecordsForClass,
  dutySettingsForClass,
  markDutyRecord,
  patchDutyJob,
  patchDutyRecord,
  rotateDutyWeek,
  sameDutyDay,
  saveDutyJob,
  type DutyMutationResult,
} from "./features/duty/operations";
import { WorkbenchPageHeader } from "./WorkbenchPageHeader";
import styles from "./Duty.module.css";

type DutyView = "today" | "week" | "jobs" | "ledger";
type Notice = { classId: string; text: string; tone: "info" | "error" };
type DayState = { classId: string; value: string };
type JobEditor = { classId: string; draft: DutyJob; baseline: string };
type AssignmentTarget = { classId: string; day: string; jobId: string };
type ConfirmAction = (message: string, title?: string, confirmLabel?: string) => Promise<boolean>;

const defaultDays = ["周一", "周二", "周三", "周四", "周五"];
const viewLabels: Array<{ id: DutyView; label: string; detail: string }> = [
  { id: "today", label: "岗位检查", detail: "逐项确认" },
  { id: "week", label: "本周安排", detail: "教学日轮换" },
  { id: "jobs", label: "岗位设置", detail: "区域与标准" },
  { id: "ledger", label: "检查台账", detail: "记录与备注" },
];

function sourceLabel(source: "auto" | "fixed" | "manual") {
  return source === "manual" ? "临时指定" : source === "fixed" ? "固定负责" : "小组轮换";
}

function shortDay(day: string) {
  return day.replace("星期", "周");
}

export function Duty({ data, update, save, readOnly = false, mobile = false, confirmAction }: {
  data: ClassroomData;
  update: (fn: (data: ClassroomData) => ClassroomData) => void;
  save: () => Promise<boolean>;
  readOnly?: boolean;
  mobile?: boolean;
  confirmAction: ConfirmAction;
}) {
  const classId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "";
  const activeClass = data.rosterClasses?.find(item => item.id === classId);
  const students = activeClass?.students ?? data.students;
  const studentById = new Map(students.map(student => [student.id, student]));
  const days = (data.scheduleConfig?.days ?? defaultDays).map(day => day.trim()).filter(Boolean);
  const currentDay = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date().getDay()];
  const settings = dutySettingsForClass(data, classId);
  const jobs = settings.jobs;
  const enabledJobs = jobs.filter(job => job.enabled !== false);
  const groupInfo = dutyGroupsForClass(data, classId);
  const records = dutyRecordsForClass(data, classId);
  const [view, setView] = useState<DutyView>("today");
  const [dayState, setDayState] = useState<DayState>({ classId, value: days.find(day => sameDutyDay(day, currentDay)) ?? days[0] ?? defaultDays[0] });
  const [noticeState, setNoticeState] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [editorState, setEditorState] = useState<JobEditor | null>(null);
  const [assignState, setAssignState] = useState<AssignmentTarget | null>(null);
  const [fixedPickerOpen, setFixedPickerOpen] = useState(false);
  const [keywordState, setKeywordState] = useState({ classId, value: "" });
  const [statusFilter, setStatusFilter] = useState<"全部" | DutyRecord["status"]>("全部");
  const selectedDay = dayState.classId === classId && days.some(day => sameDutyDay(day, dayState.value)) ? dayState.value : days.find(day => sameDutyDay(day, currentDay)) ?? days[0] ?? defaultDays[0];
  const notice = noticeState?.classId === classId ? noticeState : null;
  const editor = editorState?.classId === classId ? editorState : null;
  const assignTarget = assignState?.classId === classId ? assignState : null;
  const keyword = keywordState.classId === classId ? keywordState.value : "";
  const selectedDate = dutyDateForDay(selectedDay);
  const selectedRecords = enabledJobs.map(job => dutyRecordFor(data, classId, selectedDay, job.id));
  const completedCount = selectedRecords.filter(record => record?.status === "已完成").length;
  const reworkCount = selectedRecords.filter(record => record?.status === "需返工").length;
  const weekDoneCount = days.reduce((sum, day) => sum + enabledJobs.filter(job => dutyRecordFor(data, classId, day, job.id)?.status === "已完成").length, 0);
  const weekTotal = enabledJobs.length * days.length;
  const weekRate = weekTotal ? Math.round(weekDoneCount / weekTotal * 100) : 0;
  const filteredRecords = records.filter(record => {
    const job = jobs.find(item => item.id === record.jobId);
    const names = record.studentIds.map(id => studentById.get(id)?.name ?? "已移除学生").join("、");
    const matchesKeyword = !keyword.trim() || `${record.date}${record.day}${record.status}${record.note}${record.checkedBy}${job?.name ?? ""}${names}`.includes(keyword.trim());
    return matchesKeyword && (statusFilter === "全部" || record.status === statusFilter);
  });
  const assignJob = assignTarget ? jobs.find(job => job.id === assignTarget.jobId) : undefined;
  const assignCurrent = assignTarget && assignJob ? dutyAssignmentFor(data, classId, assignTarget.day, assignJob.id) : undefined;

  function show(text: string, tone: Notice["tone"] = "info") {
    setNoticeState({ classId, text, tone });
  }

  function ensureWritable() {
    if (busy) return false;
    if (!readOnly) return true;
    show("当前为只读模式，值日安排未修改。", "error");
    return false;
  }

  async function apply(result: DutyMutationResult, success: string) {
    if (result.error || !result.data) {
      show(result.error ?? "值日操作未完成，请重试。", "error");
      return false;
    }
    update(() => result.data!);
    setBusy(true);
    show("值日修改已保留在本机，正在同步工作区。");
    const ok = await save();
    setBusy(false);
    if (!ok) {
      show("值日同步失败，本机修改和当前编辑上下文已保留，请重试或等待自动同步。", "error");
      return false;
    }
    show(`${success} 服务器已确认。`);
    return true;
  }

  async function run(operation: () => DutyMutationResult, success: string) {
    if (!ensureWritable()) return false;
    return await apply(operation(), success);
  }

  function openEditor(job?: DutyJob) {
    if (!ensureWritable()) return;
    const draft = job ? { ...job, studentIds: [...(job.studentIds ?? [])] } : { id: "", name: "", area: "", standard: "", studentIds: [], enabled: true };
    setEditorState({ classId, draft, baseline: JSON.stringify(draft) });
    setFixedPickerOpen(false);
  }

  function patchEditor(patch: Partial<DutyJob>) {
    if (!editor) return;
    setEditorState({ classId, draft: { ...editor.draft, ...patch } });
  }

  async function closeEditor() {
    if (!editor || busy) return;
    if (JSON.stringify(editor.draft) !== editor.baseline && !await confirmAction("尚未保存的岗位内容会丢失。", "放弃本次修改？", "放弃修改")) return;
    setEditorState(null);
    setFixedPickerOpen(false);
  }

  async function submitJob() {
    if (!editor || !ensureWritable()) return;
    const created = !editor.draft.id;
    const result = saveDutyJob(data, classId, editor.draft, () => makeId("duty-job"));
    if (await apply(result, created ? "值日岗位已新增。" : "值日岗位已更新。")) {
      setEditorState(null);
      setFixedPickerOpen(false);
    }
  }

  async function rotate() {
    await run(() => rotateDutyWeek(data, classId), "轮换顺序已前进一周；固定岗位和已有检查快照保持不变。");
  }

  async function mark(day: string, job: DutyJob, status: "已完成" | "需返工") {
    await run(() => markDutyRecord(data, classId, day, job.id, status, () => makeId("duty-record")), `${shortDay(day)} ${job.name} 已记录为${status}。`);
  }

  async function assign(studentId?: string) {
    if (!assignTarget || !assignJob) return;
    if (await run(() => assignDutyStudent(data, classId, assignTarget.day, assignJob.id, studentId, () => makeId("duty-record")), studentId ? `已指定 ${studentById.get(studentId)?.name ?? "当前班学生"} 负责 ${assignJob.name}。` : `${assignJob.name} 已恢复自动安排。`)) setAssignState(null);
  }

  async function saveRecordNote(record: DutyRecord, note: string) {
    if (note === record.note) return;
    await run(() => patchDutyRecord(data, classId, record.id, { note }), "检查备注已更新。");
  }

  function assignment(day: string, job: DutyJob) {
    return dutyAssignmentFor(data, classId, day, job.id);
  }

  const dutyText = days.map(day => `${shortDay(day)}（${dutyDateForDay(day)}）：${enabledJobs.map(job => {
    const assigned = assignment(day, job);
    return `${job.name}-${assigned.students.map(student => student.name).join("、") || "待安排"}`;
  }).join("；")}`).join("\n");

  return <div className={`${styles.page} ${mobile ? styles.mobile : ""}`} data-duty-surface="campus-v2">
    {!mobile && <WorkbenchPageHeader icon="duty" tone="jade" title="值日岗位" description="按课程日历生成本周安排，固定学生、临时指定和检查结果都绑定当前班级。" actions={<button type="button" className={styles.headerAction} disabled={readOnly || busy || groupInfo.groups.length < 2} onClick={() => void rotate()}>{busy ? "同步中…" : "轮换下一周"}</button>} />}
    {mobile && <header className={styles.mobileIntro}><span><CampusIcon name="duty" /></span><div><small>{activeClass?.name ?? "当前班级"}</small><h1>本周值日安排</h1><p>{shortDay(selectedDay)} · {selectedDate}</p></div><ThemeArtwork slot="duty" /></header>}

    <section className={styles.metrics} aria-label="值日岗位概览">
      <div><span>教学日</span><b>{days.length}</b><small>跟随课程日程</small></div>
      <div><span>{shortDay(selectedDay)}完成</span><b>{completedCount}/{enabledJobs.length}</b><small>{reworkCount ? `${reworkCount} 项需返工` : "逐项检查确认"}</small></div>
      <div><span>本周完成</span><b>{weekRate}%</b><small>{weekDoneCount}/{weekTotal || 0} 项</small></div>
      <div className={groupInfo.ungrouped.length ? styles.warningMetric : ""}><span>轮换小组</span><b>{groupInfo.groups.length}</b><small>{groupInfo.ungrouped.length ? `${groupInfo.ungrouped.length} 人未分组` : "仅使用非空小组"}</small></div>
    </section>

    {notice && <button type="button" className={`${styles.notice} ${notice.tone === "error" ? styles.error : ""}`} onClick={() => setNoticeState(null)}>{notice.text}<span>关闭</span></button>}
    {readOnly && <p className={styles.readOnlyNote}>只读模式：可以查看和复制安排；轮换、检查、指定学生及岗位编辑已停用。</p>}
    {groupInfo.ungrouped.length > 0 && <p className={styles.groupWarning}><CampusIcon name="warning" />{groupInfo.ungrouped.length} 名学生尚未分组，不会进入自动轮换：{groupInfo.ungrouped.slice(0, 6).map(student => student.name).join("、")}{groupInfo.ungrouped.length > 6 ? "等" : ""}。</p>}

    <nav className={styles.viewTabs} aria-label="值日视图">
      {viewLabels.map(item => <button type="button" key={item.id} aria-pressed={view === item.id} onClick={() => setView(item.id)}><b>{item.label}</b><small>{item.detail}</small></button>)}
    </nav>

    {(view === "today" || view === "week") && <nav className={styles.dayTabs} aria-label="教学日">
      {days.map(day => <button type="button" key={day} aria-pressed={sameDutyDay(day, selectedDay)} onClick={() => setDayState({ classId, value: day })}><b>{shortDay(day)}</b><small>{dutyDateForDay(day).slice(5)}</small></button>)}
    </nav>}

    {view === "today" && <section className={styles.todayBoard}>
      <aside className={styles.scene}>
        <ThemeArtwork slot="duty" />
        <span>今日责任区</span>
        <h2>{shortDay(selectedDay)} · {selectedDate}</h2>
        <p>{enabledJobs.length ? "按岗位逐项检查，确认后会保存当日负责人快照。" : "当前没有启用的值日岗位。"}</p>
        <dl><div><dt>轮换顺序</dt><dd>第 {settings.offset + 1} 轮</dd></div><div><dt>待处理</dt><dd>{Math.max(0, enabledJobs.length - completedCount)} 项</dd></div></dl>
        <button type="button" disabled={!enabledJobs.length} onClick={() => void copyTextToClipboard(dutyText, "已复制本周值日表")}>复制本周安排</button>
      </aside>
      <div className={styles.checklist}>
        <header><div><span>岗位检查</span><h2>{enabledJobs.length ? `${enabledJobs.length} 个责任区` : "暂无启用岗位"}</h2></div><button type="button" disabled={readOnly || busy} onClick={() => openEditor()}>新增岗位</button></header>
        {enabledJobs.map(job => {
          const assigned = assignment(selectedDay, job);
          const status = assigned.record?.status ?? "待检查";
          return <article className={`${styles.jobRow} ${status === "已完成" ? styles.done : status === "需返工" ? styles.rework : ""}`} key={job.id}>
            <span className={styles.jobMark} aria-hidden="true"><CampusIcon name={job.id === "dj-board" ? "book" : job.id === "dj-books" ? "records" : "duty"} /></span>
            <div className={styles.jobCopy}><span>{job.area}</span><h3>{job.name}</h3><p>{job.standard}</p></div>
            <div className={styles.assignee}><small>{sourceLabel(assigned.source)}{assigned.groupNumber ? ` · 第${assigned.groupNumber}组` : ""}</small><b>{assigned.students.map(student => student.name).join("、") || "待安排"}</b><button type="button" disabled={readOnly || busy} onClick={() => setAssignState({ classId, day: selectedDay, jobId: job.id })}>{assigned.source === "manual" ? "更换学生" : "临时指定"}</button></div>
            <div className={styles.statusActions}><span data-status={status}>{status}</span><button type="button" disabled={readOnly || busy || !assigned.students.length} aria-pressed={status === "已完成"} onClick={() => void mark(selectedDay, job, "已完成")}>完成</button><button type="button" disabled={readOnly || busy || !assigned.students.length} aria-pressed={status === "需返工"} onClick={() => void mark(selectedDay, job, "需返工")}>返工</button></div>
          </article>;
        })}
        {!enabledJobs.length && <div className={styles.empty}><ThemeArtwork slot="empty" /><b>没有启用的值日岗位</b><p>在“岗位设置”中启用现有岗位，或新增适合本班的责任区。</p><button type="button" disabled={readOnly} onClick={() => setView("jobs")}>前往岗位设置</button></div>}
      </div>
    </section>}

    {view === "week" && <section className={styles.weekPanel}>
      <header><div><span>本周安排</span><h2>课程教学日值日表</h2><p>每个教学日使用对应的自然周日期；已有检查记录会保留当日负责人。</p></div><div><button type="button" onClick={() => void copyTextToClipboard(dutyText, "已复制本周值日表")}>复制值日表</button><button type="button" className={styles.primaryButton} disabled={readOnly || busy || groupInfo.groups.length < 2} onClick={() => void rotate()}>{busy ? "同步中…" : "轮换下一周"}</button></div></header>
      <div className={styles.weekScroll}><div className={styles.weekTable} role="table" aria-label="本周值日安排" style={{ minWidth: `${Math.max(760, days.length * 154 + 170)}px`, gridTemplateColumns: `170px repeat(${days.length}, minmax(154px, 1fr))` }}>
        <div className={styles.weekCorner} role="columnheader"><b>岗位 / 教学日</b><small>点击单元格指定学生</small></div>
        {days.map(day => <button type="button" role="columnheader" className={sameDutyDay(day, selectedDay) ? styles.selectedDay : ""} key={day} onClick={() => setDayState({ classId, value: day })}><b>{shortDay(day)}</b><small>{dutyDateForDay(day)}</small></button>)}
        {enabledJobs.map(job => <div className={styles.weekRow} role="row" style={{ gridColumn: `1 / span ${days.length + 1}`, gridTemplateColumns: `170px repeat(${days.length}, minmax(154px, 1fr))` }} key={job.id}>
          <div role="rowheader"><b>{job.name}</b><small>{job.area}</small></div>
          {days.map(day => { const assigned = assignment(day, job); return <button type="button" disabled={readOnly} role="cell" key={day} onClick={() => setAssignState({ classId, day, jobId: job.id })}><small>{sourceLabel(assigned.source)}{assigned.groupNumber ? ` · 第${assigned.groupNumber}组` : ""}</small><b>{assigned.students.map(student => student.name).join("、") || "待安排"}</b><span data-status={assigned.record?.status ?? "待检查"}>{assigned.record?.status ?? "待检查"}</span></button>; })}
        </div>)}
      </div></div>
    </section>}

    {view === "jobs" && <section className={styles.jobsPanel}>
      <header><div><span>岗位设置</span><h2>责任区与检查标准</h2><p>岗位和固定学生只属于当前班；停用岗位不会出现在本周检查中。</p></div><button type="button" className={styles.primaryButton} disabled={readOnly} onClick={() => openEditor()}>新增岗位</button></header>
      <div className={styles.jobSettings}>{jobs.map(job => <article key={job.id}>
        <span className={styles.settingIcon}><CampusIcon name="duty" /></span><div><h3>{job.name}</h3><p>{job.area}</p><small>{job.standard}</small></div>
        <dl><div><dt>固定学生</dt><dd>{(job.studentIds ?? []).map(id => studentById.get(id)?.name).filter(Boolean).join("、") || "按小组轮换"}</dd></div><div><dt>状态</dt><dd>{job.enabled === false ? "已停用" : "已启用"}</dd></div></dl>
        <div><button type="button" disabled={readOnly} onClick={() => openEditor(job)}>编辑</button><button type="button" disabled={readOnly} onClick={() => run(() => patchDutyJob(data, classId, job.id, { enabled: job.enabled === false }), job.enabled === false ? "岗位已启用。" : "岗位已停用。")}>{job.enabled === false ? "启用" : "停用"}</button></div>
      </article>)}</div>
    </section>}

    {view === "ledger" && <section className={styles.ledgerPanel}>
      <header><div><span>检查台账</span><h2>按日期追溯值日结果</h2><p>搜索当前班的岗位、学生、检查人或备注；备注离开输入框后写入本机草稿。</p></div><button type="button" disabled={!filteredRecords.length} onClick={() => void copyTextToClipboard(filteredRecords.map(record => `${record.date} ${shortDay(record.day)} ${jobs.find(job => job.id === record.jobId)?.name ?? "已移除岗位"} ${record.status} ${record.studentIds.map(id => studentById.get(id)?.name ?? "已移除学生").join("、")} ${record.note}`).join("\n"), "已复制检查台账")}>复制筛选结果</button></header>
      <div className={styles.ledgerFilters}><label><span>搜索台账</span><input value={keyword} onChange={event => setKeywordState({ classId, value: event.target.value })} placeholder="日期、岗位、学生、检查人或备注" /></label><nav aria-label="检查状态">{(["全部", "待检查", "已完成", "需返工", "已替换"] as const).map(status => <button type="button" aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)} key={status}>{status}</button>)}</nav><span>显示 {Math.min(50, filteredRecords.length)} / {filteredRecords.length} 条</span></div>
      <div className={styles.ledgerList}>{filteredRecords.slice(0, 50).map(record => {
        const job = jobs.find(item => item.id === record.jobId);
        return <article key={record.id}><header><div><time>{record.date}</time><b>{shortDay(record.day)} · {job?.name ?? "已移除岗位"}</b></div><span data-status={record.status}>{record.status}</span></header><p>{record.studentIds.map(id => studentById.get(id)?.name ?? "已移除学生").join("、") || "未记录学生"} · {sourceLabel(record.assignmentSource ?? "manual")} · {record.checkedBy || "未填检查人"}</p><label><span>检查备注</span><textarea key={`${record.id}-${record.note}`} defaultValue={record.note} disabled={readOnly} placeholder="补充需要复查的具体情况" onBlur={event => saveRecordNote(record, event.target.value)} /></label></article>;
      })}{!filteredRecords.length && <div className={styles.empty}><ThemeArtwork slot="empty" /><b>{records.length ? "没有符合条件的记录" : "还没有检查记录"}</b><p>{records.length ? "调整搜索词或状态筛选后再查看。" : "从岗位检查中确认完成或返工后，会在这里形成台账。"}</p></div>}</div>
    </section>}

    {editor && <div className={styles.backdrop} role="presentation" onMouseDown={() => void closeEditor()}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="duty-editor-title" onMouseDown={event => event.stopPropagation()}>
      <header><div><span>{editor.draft.id ? "编辑岗位" : "新增岗位"}</span><h2 id="duty-editor-title">{editor.draft.name || "填写责任区信息"}</h2><p>保存后只更新当前班级，不影响其他班的岗位与固定学生。</p></div><button type="button" disabled={busy} onClick={() => void closeEditor()} aria-label="关闭岗位编辑"><CampusIcon name="close" /></button></header>
      <div className={styles.form}>
        <label><span>岗位名称 <em>必填</em></span><input autoFocus disabled={busy} value={editor.draft.name} onChange={event => patchEditor({ name: event.target.value })} placeholder="例如：植物角" /></label>
        <label><span>启用状态</span><select disabled={busy} value={editor.draft.enabled === false ? "disabled" : "enabled"} onChange={event => patchEditor({ enabled: event.target.value === "enabled" })}><option value="enabled">启用</option><option value="disabled">停用</option></select></label>
        <label className={styles.wide}><span>负责区域 <em>必填</em></span><input disabled={busy} value={editor.draft.area} onChange={event => patchEditor({ area: event.target.value })} placeholder="写清具体区域或物品" /></label>
        <label className={styles.wide}><span>检查标准 <em>必填</em></span><textarea disabled={busy} value={editor.draft.standard} onChange={event => patchEditor({ standard: event.target.value })} placeholder="写成可以现场核对的完成标准" /></label>
        <label className={styles.wide}><span>固定学生</span><button type="button" disabled={busy} className={styles.studentPicker} onClick={() => setFixedPickerOpen(true)}>{(editor.draft.studentIds ?? []).map(id => studentById.get(id)?.name).filter(Boolean).join("、") || "不固定，按小组自动轮换"}<small>点击选择或清除</small></button></label>
      </div>
      <footer><span>未保存的修改不会进入岗位列表。</span><button type="button" disabled={busy} onClick={() => void closeEditor()}>取消</button><button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void submitJob()}>{busy ? "保存中…" : "保存岗位"}</button></footer>
    </section></div>}

    {assignTarget && assignJob && <StudentLookupDialog title="临时指定值日学生" subtitle={`${shortDay(assignTarget.day)} · ${assignJob.name} · ${dutyDateForDay(assignTarget.day)}`} students={students} selectedId={assignCurrent?.students[0]?.id} allowClear clearLabel="恢复自动安排" onPick={student => void assign(student.id)} onClear={() => void assign()} onClose={() => { if (!busy) setAssignState(null); }} />}
    {editor && fixedPickerOpen && <StudentLookupDialog title="选择固定值日学生" subtitle={`${editor.draft.name || "当前岗位"} · 仅限当前班级`} students={students} selectedId={editor.draft.studentIds?.[0]} allowClear clearLabel="恢复小组轮换" onPick={student => { patchEditor({ studentIds: [student.id] }); setFixedPickerOpen(false); }} onClear={() => { patchEditor({ studentIds: [] }); setFixedPickerOpen(false); }} onClose={() => setFixedPickerOpen(false)} />}
  </div>;
}
