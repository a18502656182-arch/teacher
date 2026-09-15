"use client";

import { useEffect, useMemo, useState } from "react";
import { makeId } from "@/lib/classroom";
import type { AttendanceRecord, AttendanceStatus, ClassroomData, Student } from "@/lib/classroom";

import { applyAttendanceChanges, localDateToday } from "../../w/[token]/features/attendance/operations";
import type { AttendanceChange } from "../../w/[token]/features/attendance/operations";


export const attendanceStatuses: AttendanceStatus[] = ["正常", "迟到", "请假", "缺勤"];

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

export type AttendanceProps = {
  data: ClassroomData;
  update: (fn: (data: ClassroomData) => ClassroomData) => void;
  save: () => Promise<boolean>;
  readOnly: boolean;
  mobile?: boolean;
  unsynced?: boolean;
};

export function useAttendanceDesignController({ data, update, save, readOnly, mobile = false, unsynced = false }: AttendanceProps) {
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
  const hasUnsavedInput = notesDirty || batchDirty || unsynced;

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

  function changeDate(next: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
    if (hasUnsavedInput || busy) { setMessageError(true); setMessage("请先保存当前日期的备注或批量设置，再切换日期。"); return; }
    setSelectedDate(next); setMonth(next.slice(0, 7));
  }

  async function saveChanges(changes: AttendanceChange[]) {
    if (!changes.length || busy) return false;
    if (readOnly) { setMessageError(true); setMessage("当前为只读模式，不能修改考勤。"); return false; }
    setBusy(true); setMessage(""); setMessageError(false);
    update(current => applyAttendanceChanges(current, activeClass.id, changes, selectedDate, () => makeId("attendance")));
    try { return await save(); } catch { return false; }
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
    const ok = await saveChanges([{ studentId, status: statusFor(student, recordsByStudent), note: noteDrafts[studentId] ?? recordsByStudent.get(studentId)?.note ?? "" }]);
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

  return { activeClass, students, selectedDate, month, setMonth, keyword, setKeyword, statusFilter, setStatusFilter, groupFilter, setGroupFilter, selectedIds, setSelectedIds, noteDrafts, setNoteDrafts, batchStatus, setBatchStatus, batchNote, setBatchNote, message, setMessage, messageError, busy, listPageSize, listPageCount, safeListPage, setListPage, recordsByStudent, groups, filteredStudents, counts, calendar, pageStudents, allVisibleSelected, hasUnsavedInput, changeDate, setStudentStatus, saveStudentNote, markAllNormal, toggleStudent, toggleVisible, applyBatch, readOnly, mobile, unsynced, statusFor };
}
