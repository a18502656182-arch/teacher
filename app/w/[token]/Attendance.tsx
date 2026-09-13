"use client";

import { useEffect, useMemo, useState } from "react";
import { makeId } from "@/lib/classroom";
import type { AttendanceRecord, AttendanceStatus, ClassroomData, Student } from "@/lib/classroom";
import { WorkbenchPageHeader } from "./WorkbenchPageHeader";
import { applyAttendanceChanges, localDateToday } from "./features/attendance/operations";
import type { AttendanceChange } from "./features/attendance/operations";
import styles from "./features/attendance/Attendance.module.css";

const attendanceStatuses: AttendanceStatus[] = ["正常", "迟到", "请假", "缺勤"];

function monthDays(month: string) {
  const [year, value] = month.split("-").map(Number);
  const days = new Date(year, value, 0).getDate();
  return Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

function getActiveClass(data: ClassroomData) {
  const classes = data.rosterClasses?.length ? data.rosterClasses : [{ id: "class-1", name: "当前班级", grade: "", term: "", students: data.students }];
  const activeClassId = data.activeClassId ?? classes[0].id;
  return { activeClass: classes.find(item => item.id === activeClassId) ?? classes[0] };
}

function statusFor(student: Student, records: Map<string, AttendanceRecord>) {
  return records.get(student.id)?.status ?? student.attendance;
}

type AttendanceProps = {
  data: ClassroomData;
  update: (fn: (data: ClassroomData) => ClassroomData) => void;
  save: () => Promise<boolean>;
  readOnly: boolean;
  mobile?: boolean;
};

export function Attendance({ data, update, save, readOnly, mobile = false }: AttendanceProps) {
  const { activeClass } = getActiveClass(data);
  const students = activeClass.students?.length ? activeClass.students : data.students;
  const [selectedDate, setSelectedDate] = useState(localDateToday);
  const [month, setMonth] = useState(localDateToday().slice(0, 7));
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "全部">("全部");
  const [groupFilter, setGroupFilter] = useState("全部");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [batchStatus, setBatchStatus] = useState<AttendanceStatus | "不修改">("不修改");
  const [batchNote, setBatchNote] = useState("");
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listPage, setListPage] = useState(1);
  const dateRecords = useMemo(() => (data.attendanceRecords ?? []).filter(item => item.classId === activeClass.id && item.date === selectedDate), [activeClass.id, data.attendanceRecords, selectedDate]);
  const recordsByStudent = useMemo(() => new Map(dateRecords.map(item => [item.studentId, item])), [dateRecords]);
  const groups = useMemo(() => Array.from(new Set(students.map(student => student.group))).sort((a, b) => a - b), [students]);
  const filteredStudents = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase("zh-CN");
    return students.filter(student => {
      const status = statusFor(student, recordsByStudent);
      const matchesStatus = statusFilter === "全部" || status === statusFilter;
      const matchesGroup = groupFilter === "全部" || student.group === Number(groupFilter);
      const text = `${student.name}${student.studentNo ?? ""}${student.group}${student.note ?? ""}${status}`.toLocaleLowerCase("zh-CN");
      return matchesStatus && matchesGroup && (!query || text.includes(query));
    });
  }, [groupFilter, keyword, recordsByStudent, statusFilter, students]);
  const counts = attendanceStatuses.reduce((result, status) => ({ ...result, [status]: students.filter(student => statusFor(student, recordsByStudent) === status).length }), {} as Record<AttendanceStatus, number>);
  const calendar = useMemo(() => monthDays(month).map(date => {
    const records = (data.attendanceRecords ?? []).filter(item => item.classId === activeClass.id && item.date === date);
    return { date, entered: records.length, exceptions: records.filter(item => item.status !== "正常").length };
  }), [activeClass.id, data.attendanceRecords, month]);
  const listPageSize = mobile ? 20 : 50;
  const listPageCount = Math.max(1, Math.ceil(filteredStudents.length / listPageSize));
  const safeListPage = Math.min(listPage, listPageCount);
  const pageStudents = filteredStudents.slice((safeListPage - 1) * listPageSize, safeListPage * listPageSize);
  const visibleIds = pageStudents.map(student => student.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const notesDirty = Object.entries(noteDrafts).some(([id, value]) => value !== (recordsByStudent.get(id)?.note ?? ""));
  const batchDirty = selectedIds.length > 0 && (batchStatus !== "不修改" || Boolean(batchNote.trim()));
  const hasUnsavedInput = notesDirty || batchDirty;

  useEffect(() => { setSelectedIds(current => current.filter(id => students.some(student => student.id === id))); }, [students]);
  useEffect(() => { setSelectedIds([]); setBatchStatus("不修改"); setBatchNote(""); setNoteDrafts({}); }, [selectedDate]);
  useEffect(() => { setListPage(1); }, [keyword, statusFilter, groupFilter, selectedDate, mobile]);
  useEffect(() => {
    if (!hasUnsavedInput && !busy) return;
    const guard = (event: Event) => { event.preventDefault(); setMessageError(true); setMessage("还有未保存的考勤备注或批量设置，请先保存再离开。"); };
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("classroom:before-navigate", guard);
    window.addEventListener("beforeunload", unload);
    return () => { window.removeEventListener("classroom:before-navigate", guard); window.removeEventListener("beforeunload", unload); };
  }, [busy, hasUnsavedInput]);

  function changeDate(next: string) {
    if (hasUnsavedInput || busy) { setMessageError(true); setMessage("请先保存当前日期的备注或批量设置，再切换日期。"); return; }
    setSelectedDate(next); setMonth(next.slice(0, 7));
  }

  async function saveChanges(changes: AttendanceChange[]) {
    if (!changes.length || busy) return false;
    if (readOnly) { setMessageError(true); setMessage("当前为只读模式，不能修改考勤。"); return false; }
    setBusy(true); setMessage(""); setMessageError(false);
    update(current => applyAttendanceChanges(current, activeClass.id, changes, selectedDate, () => makeId("attendance")));
    try { return await save(); }
    finally { setBusy(false); }
  }

  async function setStudentStatus(studentId: string, status: AttendanceStatus) {
    const ok = await saveChanges([{ studentId, status, note: noteDrafts[studentId] ?? recordsByStudent.get(studentId)?.note ?? "" }]);
    if (ok) { setSelectedIds([]); setNoteDrafts(current => { const next = { ...current }; delete next[studentId]; return next; }); setMessageError(false); setMessage("考勤状态已由服务器确认保存"); }
    else { setMessageError(true); setMessage("同步失败，本机改动和当前选择已保留，请重试。"); }
  }

  async function saveStudentNote(studentId: string) {
    const student = students.find(item => item.id === studentId);
    if (!student) return;
    const ok = await saveChanges([{ studentId, status: statusFor(student, recordsByStudent), note: noteDrafts[studentId] ?? "" }]);
    if (ok) { setSelectedIds([]); setNoteDrafts(current => { const next = { ...current }; delete next[studentId]; return next; }); setMessageError(false); setMessage("备注已由服务器确认保存"); }
    else { setMessageError(true); setMessage("备注同步失败，输入内容与当前选择已保留，请重试。"); }
  }

  async function markAllNormal() {
    const ok = await saveChanges(students.map(student => ({ studentId: student.id, status: "正常", note: noteDrafts[student.id] })));
    if (ok) { setSelectedIds([]); setNoteDrafts({}); setMessageError(false); setMessage(`已由服务器确认 ${students.length} 名学生为正常到校`); }
    else { setMessageError(true); setMessage("全员状态同步失败，本机改动和当前选择已保留，请重试。"); }
  }

  function toggleStudent(id: string) { setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); }
  function toggleVisible() { setSelectedIds(current => allVisibleSelected ? current.filter(id => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds]))); }

  async function applyBatch() {
    if (!selectedIds.length) return;
    const selectedSet = new Set(selectedIds); const note = batchNote.trim();
    const changes = students.filter(student => selectedSet.has(student.id)).map(student => ({ studentId: student.id, status: batchStatus === "不修改" ? statusFor(student, recordsByStudent) : batchStatus, note: note || noteDrafts[student.id] || recordsByStudent.get(student.id)?.note || "" }));
    const ok = await saveChanges(changes);
    if (ok) { setSelectedIds([]); setBatchStatus("不修改"); setBatchNote(""); setNoteDrafts(current => Object.fromEntries(Object.entries(current).filter(([id]) => !selectedSet.has(id)))); setMessageError(false); setMessage(`已由服务器确认 ${changes.length} 名学生的考勤记录`); }
    else { setMessageError(true); setMessage("批量同步失败，所选学生和批量内容已保留，请重试。"); }
  }

  return <section className={styles.page} data-ui-generation="next" data-attendance="page" data-read-only={readOnly || undefined} data-mobile={mobile || undefined}>
    {!mobile && (
      <WorkbenchPageHeader icon="🧾" tone="lake" title="考勤与请假" description="当日全班状态集中查看、筛选和批量保存；异常信息直接写在名单中。" actions={<div className={styles.headerActions}><label>日期<input type="date" value={selectedDate} disabled={busy} onChange={event => changeDate(event.target.value)}/></label><button type="button" className={styles.primary} onClick={() => void markAllNormal()} disabled={busy || readOnly}>一键全员正常</button></div>}/>
    )}
    {mobile && <header className={styles.mobileHead}><p>选择日期，登记当天考勤。</p><label>日期<input type="date" value={selectedDate} disabled={busy} onChange={event => changeDate(event.target.value)}/></label></header>}
    <section className={styles.statistics} aria-label="当天考勤概览">{attendanceStatuses.map(status => <span data-status={status} key={status}><small>{status === "正常" ? "正常到校" : status}</small><b>{counts[status]}</b></span>)}</section>
    {mobile && <button type="button" className={`${styles.primary} ${styles.mobileAllNormal}`} onClick={() => void markAllNormal()} disabled={busy || readOnly}>一键全员正常</button>}
    {message && <button type="button" className={styles.message} data-error={messageError || undefined} onClick={() => setMessage("")}>{message}<span aria-hidden="true">×</span></button>}
    <section className={styles.roster} data-attendance="roster">
      <header className={styles.rosterHeader}><div><h3>当日考勤名单</h3><p>{activeClass.name} · 显示 {filteredStudents.length}/{students.length} 人{listPageCount > 1 ? ` · 当前第 ${safeListPage}/${listPageCount} 页` : ""}</p></div><button type="button" className={styles.selectVisible} disabled={!filteredStudents.length || busy || readOnly} onClick={toggleVisible}>{allVisibleSelected ? (mobile ? "取消本页选择" : "取消当前筛选") : (mobile ? "全选本页" : "全选当前筛选")}</button></header>
      <div className={styles.controls} data-attendance="roster-controls"><label className={styles.search}><span>搜索</span><input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="姓名、学号、分组或备注"/></label><label><span>状态</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as AttendanceStatus | "全部")}><option>全部</option>{attendanceStatuses.map(status => <option key={status}>{status}</option>)}</select></label><label><span>小组</span><select value={groupFilter} onChange={event => setGroupFilter(event.target.value)}><option>全部</option>{groups.map(group => <option value={group} key={group}>第{group}组</option>)}</select></label></div>
      {selectedIds.length > 0 && <div className={styles.batchBar} data-attendance="batch-bar" aria-label="批量保存考勤"><strong>已选 {selectedIds.length} 人</strong><label><span>改为</span><select disabled={busy} value={batchStatus} onChange={event => setBatchStatus(event.target.value as AttendanceStatus | "不修改")}><option>不修改</option>{attendanceStatuses.map(status => <option key={status}>{status}</option>)}</select></label><label className={styles.batchNote}><span>统一备注</span><input disabled={busy} value={batchNote} onChange={event => setBatchNote(event.target.value)} placeholder="选填，留空不覆盖原备注"/></label><button type="button" className={styles.primary} onClick={() => void applyBatch()} disabled={busy || readOnly}>{busy ? "保存中…" : "应用并保存"}</button></div>}
      <div className={styles.listHead} aria-hidden="true"><span>选择</span><span>学生</span><span>考勤状态</span><span>当日备注</span><span>保存</span></div>
      <div className={styles.studentList}>{pageStudents.map(student => {
        const status = statusFor(student, recordsByStudent); const note = noteDrafts[student.id] ?? recordsByStudent.get(student.id)?.note ?? "";
        return <article key={student.id} className={styles.student} data-selected={selectedIds.includes(student.id) || undefined}><label className={styles.rowSelect} data-attendance="row-select"><input type="checkbox" aria-label={`选择${student.name}`} checked={selectedIds.includes(student.id)} disabled={busy || readOnly} onChange={() => toggleStudent(student.id)}/></label><div className={styles.studentMain}><i aria-hidden="true">{student.name.slice(0, 1)}</i><span><b>{student.name}</b><small>第{student.group}组 · {student.studentNo || "未编学号"}</small></span></div><div className={styles.statusActions} data-attendance="status-actions" aria-label={`${student.name}的考勤状态`}>{attendanceStatuses.map(item => <button type="button" key={item} data-status={item} aria-pressed={status === item} disabled={busy || readOnly} onClick={() => void setStudentStatus(student.id, item)}>{item}</button>)}</div><label className={styles.rowNote}><span className="sr-only">{student.name}的当日备注</span><input value={note} disabled={busy || readOnly} onChange={event => setNoteDrafts(current => ({ ...current, [student.id]: event.target.value }))} placeholder="补充到校时间、异常原因或跟进事项"/></label><button type="button" className={styles.saveNote} disabled={busy || readOnly} onClick={() => void saveStudentNote(student.id)}>保存</button></article>;
      })}{!filteredStudents.length && <p className={styles.empty}>没有符合当前搜索或筛选条件的学生。</p>}{listPageCount > 1 && <nav className={styles.pagination} aria-label="考勤名单分页"><button type="button" disabled={safeListPage <= 1 || busy} onClick={() => setListPage(page => Math.max(1, page - 1))}>上一页</button><span>第 {safeListPage} / {listPageCount} 页 · 每页 {listPageSize} 人</span><button type="button" disabled={safeListPage >= listPageCount || busy} onClick={() => setListPage(page => Math.min(listPageCount, page + 1))}>下一页</button></nav>}</div>
    </section>
    <section className={styles.calendar} aria-label="考勤月历"><header><div><h3>月度记录</h3><p>只显示已保存考勤；无记录不等于全员正常。</p></div><label className={styles.calendarPeriod}><span>月份</span><input type="month" aria-label="选择考勤月份" value={month} disabled={busy} onChange={event => setMonth(event.target.value)}/></label></header><div>{calendar.map(day => <button type="button" key={day.date} data-state={selectedDate === day.date ? "selected" : day.exceptions ? "exception" : day.entered ? "entered" : undefined} disabled={busy} onClick={() => changeDate(day.date)}><b>{day.date.slice(-2)}</b><span>{day.entered ? day.exceptions ? `${day.exceptions} 异常` : "已登记" : "无记录"}</span></button>)}</div></section>
  </section>;
}
