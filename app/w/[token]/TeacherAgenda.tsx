"use client";

import { StudentLookupDialog } from "@/app/components/campus/StudentLookupDialog";
import { useMemo, useState } from "react";
import { makeId } from "@/lib/classroom";
import type { ClassroomData, TeacherAgendaItem, TeacherAgendaType, WorkLog } from "@/lib/classroom";
import { completeAgendaWithLog, localScheduleDate, removeTeacherAgenda, removeWorkLog, saveTeacherAgenda, saveWorkLog, teacherAgendaForClass, workLogsForClass } from "./features/schedule/operations";
import { WorkbenchPageHeader } from "./WorkbenchPageHeader";

const agendaTypes: TeacherAgendaType[] = ["备课", "会议", "教研", "批改", "辅导", "班级事务", "其他"];
const agendaStatuses: TeacherAgendaItem["status"][] = ["待处理", "进行中", "已完成", "已取消"];

function dateToday() {
  return localScheduleDate();
}

function blankAgenda(date: string): TeacherAgendaItem {
  return { id: "", date, startTime: "", endTime: "", type: "班级事务", title: "", detail: "", location: "", relatedStudentIds: [], status: "待处理", createdAt: Date.now() };
}

function blankLog(date: string): WorkLog {
  return { id: "", date, type: "班级事务", title: "", detail: "", durationMinutes: 20, relatedStudentIds: [], createdAt: Date.now() };
}

function timeLabel(item: Pick<TeacherAgendaItem, "startTime" | "endTime">) {
  if (item.startTime && item.endTime) return `${item.startTime}–${item.endTime}`;
  return item.startTime || item.endTime || "未设时间";
}

function requestAgendaConfirm(message: string, title: string, confirmLabel: string) {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent("classroom:confirm", { detail: { message, title, confirmLabel, onResolve: resolve } }));
  });
}

function draftSignature(value: TeacherAgendaItem | WorkLog) {
  return JSON.stringify(value);
}

export function TeacherAgenda({ data, update, save, mobile = false, readOnly = false }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; save: () => Promise<boolean>; mobile?: boolean; readOnly?: boolean }) {
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "";
  const [selectedDate, setSelectedDate] = useState(dateToday);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [editor, setEditor] = useState<"agenda" | "log" | null>(null);
  const [agendaDraft, setAgendaDraft] = useState<TeacherAgendaItem>(() => blankAgenda(dateToday()));
  const [logDraft, setLogDraft] = useState<WorkLog>(() => blankLog(dateToday()));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editorBaseline, setEditorBaseline] = useState("");
  const agendas = useMemo(() => teacherAgendaForClass(data, activeClassId), [activeClassId, data]);
  const logs = useMemo(() => workLogsForClass(data, activeClassId), [activeClassId, data]);
  const dayItems = useMemo(() => agendas.filter((item) => item.date === selectedDate).toSorted((a, b) => `${a.startTime ?? "99:99"}${a.title}`.localeCompare(`${b.startTime ?? "99:99"}${b.title}`, "zh-CN")), [agendas, selectedDate]);
  const dayLogs = useMemo(() => logs.filter((item) => item.date === selectedDate).toSorted((a, b) => b.createdAt - a.createdAt), [logs, selectedDate]);
  const pendingCount = dayItems.filter((item) => item.status === "待处理" || item.status === "进行中").length;
  const completedCount = dayItems.filter((item) => item.status === "已完成").length;
  const students = data.rosterClasses?.find((item) => item.id === activeClassId)?.students ?? data.students ?? [];

  function openAgenda(item?: TeacherAgendaItem) {
    const draft = item ? { ...item, relatedStudentIds: [...(item.relatedStudentIds ?? [])] } : blankAgenda(selectedDate);
    setAgendaDraft(draft);
    setEditorBaseline(draftSignature(draft));
    setError("");
    setMessage("");
    setEditor("agenda");
  }

  function openLog(item?: WorkLog) {
    const draft = item ? { ...item, relatedStudentIds: [...(item.relatedStudentIds ?? [])] } : blankLog(selectedDate);
    setLogDraft(draft);
    setEditorBaseline(draftSignature(draft));
    setError("");
    setMessage("");
    setEditor("log");
  }

  async function saveAgenda() {
    if (readOnly || busy) {
      setError("当前为只读模式，事项未保存。");
      return;
    }
    const nowIso = new Date().toISOString();
    const nextId = agendaDraft.id || makeId("agenda");
    const preview = saveTeacherAgenda(data, activeClassId, agendaDraft, () => nextId, nowIso);
    if (preview.error) {
      setError(preview.error);
      return;
    }
    update((current) => saveTeacherAgenda(current, activeClassId, agendaDraft, () => nextId, nowIso).data ?? current);
    setAgendaDraft(preview.item!);
    setBusy(true); setError(""); setMessage("");
    const ok = await save(); setBusy(false);
    if (!ok) { setError("事项同步失败，本机修改已保留；编辑器不会关闭。"); return; }
    setEditorBaseline(draftSignature(preview.item!));
    setError("");
    setMessage("事项已由服务器确认，可以关闭编辑器。");
  }

  async function saveLog() {
    if (readOnly || busy) {
      setError("当前为只读模式，工作留痕未保存。");
      return;
    }
    const nextId = logDraft.id || makeId("work-log");
    const preview = saveWorkLog(data, activeClassId, logDraft, () => nextId);
    if (preview.error) {
      setError(preview.error);
      return;
    }
    update((current) => saveWorkLog(current, activeClassId, logDraft, () => nextId).data ?? current);
    setLogDraft(preview.item!);
    setBusy(true); setError(""); setMessage("");
    const ok = await save(); setBusy(false);
    if (!ok) { setError("工作留痕同步失败，本机修改已保留；编辑器不会关闭。"); return; }
    setEditorBaseline(draftSignature(preview.item!));
    setError("");
    setMessage("工作留痕已由服务器确认，可以关闭编辑器。");
  }

  async function completeAndLog(item: TeacherAgendaItem) {
    if (readOnly || busy) {
      setMessage("当前为只读模式，事项状态和工作留痕未更改。");
      return;
    }
    const logId = makeId("work-log");
    const nowIso = new Date().toISOString();
    const createdAt = Date.now();
    const preview = completeAgendaWithLog(data, activeClassId, item.id, () => logId, nowIso, createdAt);
    if (preview.error) {
      setMessage(preview.error);
      return;
    }
    update((current) => completeAgendaWithLog(current, activeClassId, item.id, () => logId, nowIso, createdAt).data ?? current);
    setBusy(true); setMessage("");
    const ok = await save(); setBusy(false);
    setMessage(ok ? "事项完成与对应工作留痕已由服务器确认，重复操作不会新增副本。" : "完成同步失败，本机状态与留痕已保留；请重试保存。");
  }

  async function deleteCurrent() {
    if (readOnly || busy) {
      setError("当前为只读模式，记录未删除。");
      return;
    }
    const preview = editor === "agenda" && agendaDraft.id
      ? removeTeacherAgenda(data, activeClassId, agendaDraft.id)
      : editor === "log" && logDraft.id
        ? removeWorkLog(data, activeClassId, logDraft.id)
        : { error: "当前记录不存在。" };
    if (preview.error) {
      setError(preview.error);
      return;
    }
    if (!await requestAgendaConfirm(editor === "agenda" ? "确认删除这条个人日程？" : "确认删除这条工作留痕？", "确认删除", "确认删除")) return;
    if (editor === "agenda") update((current) => removeTeacherAgenda(current, activeClassId, agendaDraft.id).data ?? current);
    if (editor === "log") update((current) => removeWorkLog(current, activeClassId, logDraft.id).data ?? current);
    setBusy(true); setError("");
    const ok = await save(); setBusy(false);
    if (!ok) { setError("删除同步失败，本机修改已保留；编辑器不会关闭。"); return; }
    setEditor(null);
    setMessage("记录删除已由服务器确认。");
  }

  async function closeEditor() {
    if (!editor || busy) return;
    const currentSignature = draftSignature(editor === "agenda" ? agendaDraft : logDraft);
    if (currentSignature !== editorBaseline && !await requestAgendaConfirm("当前编辑内容尚未保存，确认关闭并放弃这些修改？", "放弃未保存修改", "放弃修改")) return;
    setStudentPickerOpen(false);
    setEditor(null);
  }

  const selectedStudentId = editor === "agenda" ? agendaDraft.relatedStudentIds?.[0] ?? "" : logDraft.relatedStudentIds?.[0] ?? "";
  function setSelectedStudent(studentId: string) {
    if (editor === "agenda") setAgendaDraft((current) => ({ ...current, relatedStudentIds: studentId ? [...new Set([...(current.relatedStudentIds ?? []), studentId])] : [] }));
    if (editor === "log") setLogDraft((current) => ({ ...current, relatedStudentIds: studentId ? [...new Set([...(current.relatedStudentIds ?? []), studentId])] : [] }));
  }
  function removeSelectedStudent(studentId: string) {
    if (editor === "agenda") setAgendaDraft((current) => ({ ...current, relatedStudentIds: (current.relatedStudentIds ?? []).filter((id) => id !== studentId) }));
    if (editor === "log") setLogDraft((current) => ({ ...current, relatedStudentIds: (current.relatedStudentIds ?? []).filter((id) => id !== studentId) }));
  }
  const selectedStudents = students.filter((student) => (editor === "agenda" ? agendaDraft.relatedStudentIds : logDraft.relatedStudentIds)?.includes(student.id));
  const selectedStudentNames = selectedStudents.map((student) => student.name);
  const studentSelectionLabel = selectedStudentNames.length ? selectedStudentNames.length === 1 ? selectedStudentNames[0] : `${selectedStudentNames[0]}等 ${selectedStudentNames.length} 人` : "不关联学生";

  const panel = <>
    {message && <p className="agenda-page-message" role="status">{message}</p>}
    <section className="agenda-datebar workbench-page-context" aria-label="选择工作日期">
      <label><span>查看日期</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
      <button type="button" onClick={() => setSelectedDate(dateToday())}>回到今天</button>
      <p><b>{dayItems.length}</b> 项日程 · <b>{pendingCount}</b> 项待处理 · <b>{dayLogs.length}</b> 条留痕</p>
    </section>
    <section className="agenda-summary" aria-label="当天工作概览">
      <article><span>待处理</span><b>{pendingCount}</b><small>优先完成有具体时间的事项</small></article>
      <article><span>已完成</span><b>{completedCount}</b><small>完成后可沉淀为工作留痕</small></article>
      <article><span>关联学生</span><b>{new Set(dayItems.flatMap((item) => item.relatedStudentIds ?? [])).size}</b><small>仅在相关事项中显示，不公开敏感信息</small></article>
    </section>
    <section className="agenda-board">
      <header><div><span>当天安排</span><h2>{selectedDate === dateToday() ? "今天的日程" : `${selectedDate} 的日程`}</h2></div><button className="agenda-primary" type="button" disabled={readOnly || busy} onClick={() => openAgenda()}>新增事项</button></header>
      <div className="agenda-list">
        {dayItems.map((item) => {
          const related = students.filter((student) => (item.relatedStudentIds ?? []).includes(student.id)).map((student) => student.name).join("、");
          const hasLog = logs.some((log) => log.agendaId === item.id);
          return <article className={`agenda-item ${item.status}`} key={item.id}>
            <div className="agenda-item-time"><b>{timeLabel(item)}</b><span>{item.type}</span></div>
            <button className="agenda-item-main" type="button" onClick={() => openAgenda(item)}><b>{item.title}</b><small>{item.detail || "未填写说明"}</small>{related && <em>关联：{related}</em>}</button>
            <div className="agenda-item-actions"><span>{item.status}</span>{item.status !== "已完成" && item.status !== "已取消" && <button type="button" disabled={readOnly || busy} onClick={() => void completeAndLog(item)}>完成并留痕</button>}{item.status === "已完成" && <button type="button" onClick={() => openLog(logs.find((log) => log.agendaId === item.id))}>{hasLog ? "查看留痕" : "补充留痕"}</button>}</div>
          </article>;
        })}
        {!dayItems.length && <div className="agenda-empty"><b>这一天还没有个人安排</b><span>可记录备课、批改、会议、辅导和班级事务；它们只保存在当前工作台。</span><button type="button" disabled={readOnly || busy} onClick={() => openAgenda()}>安排第一项</button></div>}
      </div>
    </section>
    <section className="agenda-log-board">
      <header><div><span>通用工作留痕</span><h2>已完成的工作记录</h2></div><button type="button" disabled={readOnly || busy} onClick={() => openLog()}>手动记录</button></header>
      <div className="agenda-log-list">
        {dayLogs.map((log) => <button type="button" key={log.id} onClick={() => openLog(log)}><i>{log.type.slice(0, 1)}</i><span><b>{log.title}</b><small>{log.detail || "未填写工作说明"}</small></span><em>{log.durationMinutes ? `${log.durationMinutes} 分钟` : log.agendaId ? "由日程完成生成" : "手动记录"}</em></button>)}
        {!dayLogs.length && <div className="agenda-log-empty">完成日程时可一键生成留痕，也可直接补记当天已做的工作。</div>}
      </div>
    </section>
  </>;

  const editorBody = editor && <div className="agenda-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) void closeEditor(); }}><section className="agenda-editor" role="dialog" aria-modal="true" aria-labelledby="agenda-editor-title">
    <header><div><span>{editor === "agenda" ? "个人日程" : "工作留痕"}</span><h2 id="agenda-editor-title">{editor === "agenda" ? agendaDraft.id ? "编辑事项" : "新增事项" : logDraft.id ? "编辑记录" : "补记工作"}</h2></div><button type="button" onClick={() => void closeEditor()} aria-label="关闭">×</button></header>
    {editor === "agenda" ? <div className="agenda-form-grid">
      <label><span>日期</span><input type="date" value={agendaDraft.date} onChange={(event) => setAgendaDraft({ ...agendaDraft, date: event.target.value })} /></label>
      <label><span>类型</span><select value={agendaDraft.type} onChange={(event) => setAgendaDraft({ ...agendaDraft, type: event.target.value as TeacherAgendaType })}>{agendaTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select></label>
      <label><span>开始时间</span><input type="time" value={agendaDraft.startTime ?? ""} onChange={(event) => setAgendaDraft({ ...agendaDraft, startTime: event.target.value })} /></label>
      <label><span>结束时间</span><input type="time" value={agendaDraft.endTime ?? ""} onChange={(event) => setAgendaDraft({ ...agendaDraft, endTime: event.target.value })} /></label>
      <label className="wide"><span>事项标题</span><input autoFocus value={agendaDraft.title} onChange={(event) => setAgendaDraft({ ...agendaDraft, title: event.target.value })} placeholder="例如：复查数学订正" /></label>
      <div className="agenda-student-field"><span>关联学生（可多选）</span><button type="button" className="campus-button" onClick={() => setStudentPickerOpen(true)}>{studentSelectionLabel}</button>{selectedStudents.length > 0 && <div className="agenda-student-chips">{selectedStudents.map((student) => <button type="button" key={student.id} onClick={() => removeSelectedStudent(student.id)} aria-label={`移除关联学生 ${student.name}`}>{student.name}<i aria-hidden="true">×</i></button>)}</div>}</div>
      <label><span>地点/渠道</span><input value={agendaDraft.location ?? ""} onChange={(event) => setAgendaDraft({ ...agendaDraft, location: event.target.value })} placeholder="教室、办公室、电话等" /></label>
      <label className="wide"><span>说明与准备</span><textarea value={agendaDraft.detail ?? ""} onChange={(event) => setAgendaDraft({ ...agendaDraft, detail: event.target.value })} placeholder="记录需要完成什么、需要带什么或后续动作" /></label>
      <div className="agenda-status-options wide" aria-label="事项状态">{agendaStatuses.map((status) => <button type="button" className={agendaDraft.status === status ? "active" : ""} key={status} onClick={() => setAgendaDraft({ ...agendaDraft, status })}>{status}</button>)}</div>
    </div> : <div className="agenda-form-grid">
      <label><span>日期</span><input type="date" value={logDraft.date} onChange={(event) => setLogDraft({ ...logDraft, date: event.target.value })} /></label>
      <label><span>类型</span><select value={logDraft.type} onChange={(event) => setLogDraft({ ...logDraft, type: event.target.value as TeacherAgendaType })}>{agendaTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select></label>
      <label className="wide"><span>工作标题</span><input autoFocus value={logDraft.title} onChange={(event) => setLogDraft({ ...logDraft, title: event.target.value })} placeholder="例如：完成本周班会材料" /></label>
      <div className="agenda-student-field"><span>关联学生（可多选）</span><button type="button" className="campus-button" onClick={() => setStudentPickerOpen(true)}>{studentSelectionLabel}</button>{selectedStudents.length > 0 && <div className="agenda-student-chips">{selectedStudents.map((student) => <button type="button" key={student.id} onClick={() => removeSelectedStudent(student.id)} aria-label={`移除关联学生 ${student.name}`}>{student.name}<i aria-hidden="true">×</i></button>)}</div>}</div>
      <label><span>耗时（分钟）</span><input type="number" min="0" value={logDraft.durationMinutes ?? 0} onChange={(event) => setLogDraft({ ...logDraft, durationMinutes: Number(event.target.value) || 0 })} /></label>
      <label className="wide"><span>工作说明</span><textarea value={logDraft.detail ?? ""} onChange={(event) => setLogDraft({ ...logDraft, detail: event.target.value })} placeholder="记录已完成的工作、结果或后续动作" /></label>
    </div>}
    {message && <p className="agenda-form-message" role="status">{message}</p>}
    {error && <p className="agenda-form-error" role="alert">{error}</p>}
    <footer>{(editor === "agenda" ? agendaDraft.id : logDraft.id) && <button className="agenda-delete" type="button" disabled={readOnly || busy} onClick={() => void deleteCurrent()}>删除</button>}<span /><button type="button" disabled={busy} onClick={() => void closeEditor()}>关闭</button><button className="agenda-primary" type="button" disabled={readOnly || busy} onClick={() => void (editor === "agenda" ? saveAgenda() : saveLog())}>{busy ? "保存中…" : "保存"}</button></footer>
  </section></div>;

  return <div className={`teacher-agenda ${mobile ? "teacher-agenda-mobile" : ""}`}>
    {!mobile && <WorkbenchPageHeader icon="🗂️" tone="lake" title="我的日程与工作留痕" description="安排当天工作，完成后沉淀可追溯记录；可关联班级和学生。" />}
    {panel}
    {editorBody}
    {editor && studentPickerOpen && <StudentLookupDialog title="选择关联学生" students={students} selectedId={selectedStudentId} allowClear clearLabel="不关联学生" onClear={() => setSelectedStudent("")} onPick={(student) => { setSelectedStudent(student.id); setStudentPickerOpen(false); }} onClose={() => setStudentPickerOpen(false)} />}
  </div>;
}
