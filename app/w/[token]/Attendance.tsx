"use client";

import { useEffect, useMemo, useState } from "react";
import { makeId } from "@/lib/classroom";
import type { AttendanceRecord, AttendanceStatus, ClassroomData, Student } from "@/lib/classroom";
import { WorkbenchPageHeader } from "./WorkbenchPageHeader";

const attendanceStatuses: AttendanceStatus[] = ["正常", "迟到", "请假", "缺勤"];
const statusTone: Record<AttendanceStatus, string> = { 正常: "normal", 迟到: "late", 请假: "leave", 缺勤: "absent" };

function dateToday() { return new Date().toISOString().slice(0, 10); }

function monthDays(month: string) {
  const [year, value] = month.split("-").map(Number);
  const days = new Date(year, value, 0).getDate();
  return Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

function getActiveClass(data: ClassroomData) {
  const classes = data.rosterClasses?.length ? data.rosterClasses : [{ id: "class-1", name: "当前班级", grade: "", term: "", students: data.students }];
  const activeClassId = data.activeClassId ?? classes[0].id;
  return { activeClass: classes.find((item) => item.id === activeClassId) ?? classes[0] };
}

function statusFor(student: Student, records: Map<string, AttendanceRecord>) { return records.get(student.id)?.status ?? student.attendance; }

function updateTodayAttendance(current: ClassroomData, classId: string, changes: { studentId: string; status: AttendanceStatus }[], date: string) {
  if (date !== dateToday()) return current;
  const statuses = new Map(changes.map((item) => [item.studentId, item.status]));
  const patchStudents = (students: Student[]) => students.map((student) => statuses.has(student.id) ? { ...student, attendance: statuses.get(student.id)! } : student);
  return { ...current, students: current.activeClassId === classId ? patchStudents(current.students) : current.students, rosterClasses: current.rosterClasses?.map((item) => item.id === classId ? { ...item, students: patchStudents(item.students) } : item) };
}

type AttendanceChange = { studentId: string; status: AttendanceStatus; note?: string };

export function Attendance({ data, update, mobile = false }: { data: ClassroomData; update: (fn: (data: ClassroomData) => ClassroomData) => void; mobile?: boolean }) {
  const { activeClass } = getActiveClass(data);
  const students = activeClass.students?.length ? activeClass.students : data.students;
  const [selectedDate, setSelectedDate] = useState(dateToday);
  const [month, setMonth] = useState(dateToday().slice(0, 7));
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "全部">("全部");
  const [groupFilter, setGroupFilter] = useState("全部");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [batchStatus, setBatchStatus] = useState<AttendanceStatus | "不修改">("不修改");
  const [batchNote, setBatchNote] = useState("");
  const [message, setMessage] = useState("");
  const [listPage, setListPage] = useState(1);
  const dateRecords = useMemo(() => (data.attendanceRecords ?? []).filter((item) => item.classId === activeClass.id && item.date === selectedDate), [activeClass.id, data.attendanceRecords, selectedDate]);
  const recordsByStudent = useMemo(() => new Map(dateRecords.map((item) => [item.studentId, item])), [dateRecords]);
  const groups = useMemo(() => Array.from(new Set(students.map((student) => student.group))).sort((a, b) => a - b), [students]);
  const filteredStudents = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase("zh-CN");
    return students.filter((student) => {
      const status = statusFor(student, recordsByStudent);
      const matchesStatus = statusFilter === "全部" || status === statusFilter;
      const matchesGroup = groupFilter === "全部" || student.group === Number(groupFilter);
      const text = `${student.name}${student.studentNo ?? ""}${student.group}${student.note ?? ""}${status}`.toLocaleLowerCase("zh-CN");
      return matchesStatus && matchesGroup && (!query || text.includes(query));
    });
  }, [groupFilter, keyword, recordsByStudent, statusFilter, students]);
  const counts = attendanceStatuses.reduce((result, status) => ({ ...result, [status]: students.filter((student) => statusFor(student, recordsByStudent) === status).length }), {} as Record<AttendanceStatus, number>);
  const calendar = useMemo(() => monthDays(month).map((date) => { const records = (data.attendanceRecords ?? []).filter((item) => item.classId === activeClass.id && item.date === date); return { date, entered: records.length, exceptions: records.filter((item) => item.status !== "正常").length }; }), [activeClass.id, data.attendanceRecords, month]);
  const listPageSize = mobile ? 20 : 50;
  const listPageCount = Math.max(1, Math.ceil(filteredStudents.length / listPageSize));
  const safeListPage = Math.min(listPage, listPageCount);
  const pageStudents = filteredStudents.slice((safeListPage - 1) * listPageSize, safeListPage * listPageSize);
  const visibleIds = pageStudents.map((student) => student.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  useEffect(() => { setSelectedIds((current) => current.filter((id) => students.some((student) => student.id === id))); }, [students]);
  useEffect(() => { setSelectedIds([]); setBatchStatus("不修改"); setBatchNote(""); }, [selectedDate]);
  useEffect(() => { setListPage(1); }, [keyword, statusFilter, groupFilter, selectedDate, mobile]);

  function saveChanges(changes: AttendanceChange[]) {
    if (!changes.length) return;
    update((current) => {
      const changesById = new Map(changes.map((item) => [item.studentId, item]));
      const retained = (current.attendanceRecords ?? []).filter((item) => !(item.classId === activeClass.id && item.date === selectedDate && changesById.has(item.studentId)));
      const records = changes.map((change) => {
        const existing = (current.attendanceRecords ?? []).find((item) => item.classId === activeClass.id && item.date === selectedDate && item.studentId === change.studentId);
        const note = change.note ?? existing?.note ?? "";
        if (change.status !== "请假") return { id: existing?.id ?? makeId("attendance"), classId: activeClass.id, studentId: change.studentId, date: selectedDate, createdAt: existing?.createdAt ?? Date.now(), period: existing?.period ?? "全天", status: change.status, note } as AttendanceRecord;
        return { id: existing?.id ?? makeId("attendance"), classId: activeClass.id, studentId: change.studentId, date: selectedDate, createdAt: existing?.createdAt ?? Date.now(), period: existing?.period ?? "全天", status: "请假", leaveType: existing?.leaveType ?? "事假", reason: existing?.reason ?? "", submittedBy: existing?.submittedBy ?? "家长", contact: existing?.contact ?? "", approval: existing?.approval ?? "待确认", returnedAt: existing?.returnedAt ?? "", note } as AttendanceRecord;
      });
      return updateTodayAttendance({ ...current, attendanceRecords: [...retained, ...records] }, activeClass.id, changes, selectedDate);
    });
  }

  function setStudentStatus(studentId: string, status: AttendanceStatus) { saveChanges([{ studentId, status, note: noteDrafts[studentId] ?? recordsByStudent.get(studentId)?.note ?? "" }]); setSelectedIds([]); setMessage("考勤状态已保存"); }
  function saveStudentNote(studentId: string) {
    const student = students.find((item) => item.id === studentId);
    if (!student) return;
    saveChanges([{ studentId, status: statusFor(student, recordsByStudent), note: noteDrafts[studentId] ?? "" }]);
    setSelectedIds([]); setMessage("备注已保存");
  }
  function markAllNormal() { saveChanges(students.map((student) => ({ studentId: student.id, status: "正常", note: noteDrafts[student.id] ?? "" }))); setSelectedIds([]); setMessage(`已保存 ${students.length} 名学生为正常到校`); }
  function toggleStudent(id: string) { setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function toggleVisible() { setSelectedIds((current) => allVisibleSelected ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds]))); }
  function applyBatch() {
    if (!selectedIds.length) return;
    const selectedSet = new Set(selectedIds); const note = batchNote.trim();
    const changes = students.filter((student) => selectedSet.has(student.id)).map((student) => ({ studentId: student.id, status: batchStatus === "不修改" ? statusFor(student, recordsByStudent) : batchStatus, note: note || noteDrafts[student.id] || recordsByStudent.get(student.id)?.note || "" }));
    saveChanges(changes); setSelectedIds([]); setBatchStatus("不修改"); setBatchNote(""); setMessage(`已批量保存 ${changes.length} 名学生的考勤记录`);
  }

  return <section className={`attendance-page attendance-ledger ${mobile ? "attendance-page-mobile" : ""}`}>
    {!mobile && <WorkbenchPageHeader icon="🧾" tone="lake" title="考勤与请假" description="当日全班状态集中查看、筛选和批量保存；异常信息直接写在名单中。" actions={<div className="attendance-header-actions"><label>日期<input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setMonth(event.target.value.slice(0, 7)); }} /></label><button type="button" className="attendance-primary" onClick={markAllNormal}>一键全员正常</button></div>} />}
    {mobile && <header className="attendance-mobile-head"><div><span aria-hidden="true">🧾</span><div><h2>考勤与请假</h2><p>当天状态集中登记，可筛选、批量保存。</p></div></div><label>日期<input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setMonth(event.target.value.slice(0, 7)); }} /></label></header>}
    <section className="attendance-summary" aria-label="当天考勤概览"><span className="normal"><small>正常到校</small><b>{counts.正常}</b><em>人</em></span><span className="late"><small>迟到</small><b>{counts.迟到}</b><em>人</em></span><span className="leave"><small>请假</small><b>{counts.请假}</b><em>人</em></span><span className="absent"><small>缺勤</small><b>{counts.缺勤}</b><em>人</em></span></section>
    {mobile && <button type="button" className="attendance-primary attendance-mobile-all-normal" onClick={markAllNormal}>一键全员正常</button>}
    {message && <button type="button" className="attendance-ledger-message" onClick={() => setMessage("")}>{message}<span>×</span></button>}
    <section className="attendance-roster">
      <header><div><h3>当日考勤名单</h3><p>{activeClass.name} · 显示 {filteredStudents.length}/{students.length} 人{listPageCount > 1 ? ` · 当前第 ${safeListPage}/${listPageCount} 页` : ""}</p></div><button type="button" className="attendance-select-visible" disabled={!filteredStudents.length} onClick={toggleVisible}>{allVisibleSelected ? (mobile ? "取消本页选择" : "取消当前筛选") : (mobile ? "全选本页" : "全选当前筛选")}</button></header>
      <div className="attendance-roster-controls"><label className="attendance-search"><span>搜索</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="姓名、学号、分组或备注" /></label><label><span>状态</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AttendanceStatus | "全部")}><option>全部</option>{attendanceStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><label><span>小组</span><select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option>全部</option>{groups.map((group) => <option value={group} key={group}>第{group}组</option>)}</select></label></div>
      {selectedIds.length > 0 && <div className="attendance-batch-bar" aria-label="批量保存考勤"><strong>已选 {selectedIds.length} 人</strong><label><span>改为</span><select value={batchStatus} onChange={(event) => setBatchStatus(event.target.value as AttendanceStatus | "不修改")}><option>不修改</option>{attendanceStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="attendance-batch-note"><span>统一备注</span><input value={batchNote} onChange={(event) => setBatchNote(event.target.value)} placeholder="选填，留空不覆盖原备注" /></label><button type="button" className="attendance-primary" onClick={applyBatch}>应用并保存</button></div>}
      <div className="attendance-list-head" aria-hidden="true"><span>选择</span><span>学生</span><span>考勤状态</span><span>当日备注</span><span>保存</span></div>
      <div className="attendance-student-list">{pageStudents.map((student) => {
        const status = statusFor(student, recordsByStudent); const note = noteDrafts[student.id] ?? recordsByStudent.get(student.id)?.note ?? "";
        return <article key={student.id} className={`attendance-student ${selectedIds.includes(student.id) ? "selected" : ""}`}><label className="attendance-row-select"><input type="checkbox" aria-label={`选择${student.name}`} checked={selectedIds.includes(student.id)} onChange={() => toggleStudent(student.id)} /><span aria-hidden="true" /></label><div className="attendance-student-main"><i aria-hidden="true">{student.name.slice(0, 1)}</i><span><b>{student.name}</b><small>第{student.group}组 · {student.studentNo || "未编学号"}</small></span></div><div className="attendance-status-actions" aria-label={`${student.name}的考勤状态`}>{attendanceStatuses.map((item) => <button type="button" key={item} className={`${statusTone[item]} ${status === item ? "active" : ""}`} onClick={() => setStudentStatus(student.id, item)}>{item}</button>)}</div><label className="attendance-row-note"><span className="sr-only">{student.name}的当日备注</span><input value={note} onChange={(event) => setNoteDrafts((current) => ({ ...current, [student.id]: event.target.value }))} placeholder="补充到校时间、异常原因或跟进事项" /></label><button type="button" className="attendance-save-note" onClick={() => saveStudentNote(student.id)}>保存</button></article>;
      })}{!filteredStudents.length && <p className="attendance-empty">没有符合当前搜索或筛选条件的学生。</p>}{listPageCount > 1 && <nav className="attendance-pagination" aria-label="考勤名单分页"><button type="button" disabled={safeListPage <= 1} onClick={() => setListPage((page) => Math.max(1, page - 1))}>上一页</button><span>第 {safeListPage} / {listPageCount} 页 · 每页 {listPageSize} 人</span><button type="button" disabled={safeListPage >= listPageCount} onClick={() => setListPage((page) => Math.min(listPageCount, page + 1))}>下一页</button></nav>}</div>
    </section>
    <section className="attendance-calendar" aria-label="考勤月历"><header><div><h3>月度记录</h3><p>只显示已保存考勤；无记录不等于全员正常。</p></div><label className="attendance-calendar-period"><span>月份</span><input type="month" aria-label="选择考勤月份" value={month} onChange={(event) => setMonth(event.target.value)} /></label></header><div>{calendar.map((day) => <button type="button" key={day.date} className={selectedDate === day.date ? "selected" : day.exceptions ? "exception" : day.entered ? "entered" : ""} onClick={() => setSelectedDate(day.date)}><b>{day.date.slice(-2)}</b><span>{day.entered ? day.exceptions ? `${day.exceptions} 异常` : "已登记" : "无记录"}</span></button>)}</div></section>
  </section>;
}
