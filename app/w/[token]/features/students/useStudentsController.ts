'use client';

import { useEffect, useMemo, useState } from 'react';
import { makeId, type ClassroomData, type Student } from '@/lib/classroom';
import { applyStudentBatch, type StudentBatchDraft } from './operations';
import { removeStudentRelations } from './relations';
import { activeRosterClass, filterStudents, makeRosterStudent, parseRosterRows, studentRecentActivity, syncRosterStudents } from './read-model';

type Update = (fn: (data: ClassroomData) => ClassroomData) => void;
type Confirm = (message: string, title?: string, confirmLabel?: string) => Promise<boolean>;

export function useStudentsController({ data, update, confirmAction }: { data: ClassroomData; update: Update; confirmAction: Confirm }) {
  const activeClass = activeRosterClass(data);
  const students = activeClass.students;
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('全部小组');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchDraft, setBatchDraft] = useState<StudentBatchDraft>({ group: '', gender: '不修改', note: '' });
  const [studentDraft, setStudentDraft] = useState<Student | null>(null);
  const [message, setMessage] = useState('');

  const filtered = useMemo(() => filterStudents(students, query, groupFilter), [groupFilter, query, students]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const focusedStudent = students.find(student => student.id === focusedId) ?? pageItems[0] ?? students[0];
  const profileStudent = students.find(student => student.id === profileId);
  const activity = focusedStudent ? studentRecentActivity(data, activeClass.id, focusedStudent) : null;
  const filteredIds = filtered.map(student => student.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const groupOptions = [...new Set(students.map(student => student.group))].sort((a, b) => a - b);
  const withPhone = students.filter(student => student.parentPhone?.trim()).length;
  const metrics = {
    total: students.length,
    boys: students.filter(student => student.gender === '男').length,
    girls: students.filter(student => student.gender === '女').length,
    withPhone,
    phoneRate: students.length ? Math.round(withPhone / students.length * 100) : 0,
  };

  useEffect(() => setPage(1), [query, groupFilter, activeClass.id, pageSize]);
  useEffect(() => {
    const ids = new Set(students.map(student => student.id));
    setSelectedIds(current => current.filter(id => ids.has(id)));
    if (focusedId && !ids.has(focusedId)) setFocusedId(students[0]?.id ?? '');
    if (profileId && !ids.has(profileId)) setProfileId('');
  }, [focusedId, profileId, students]);

  function updateStudents(next: Student[] | ((current: Student[]) => Student[]), transform?: (data: ClassroomData, resolved: Student[]) => ClassroomData) {
    update(current => {
      const currentClass = activeRosterClass(current);
      const resolved = typeof next === 'function' ? next(currentClass.students) : next;
      const synced = syncRosterStudents(current, activeClass.id, resolved);
      return transform ? transform(synced, resolved) : synced;
    });
  }

  function setFilterQuery(value: string) { setQuery(value); }
  function setFilterGroup(value: string) { setGroupFilter(value); }
  function toggleSelect(id: string) { setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); }
  function toggleFiltered() {
    setSelectedIds(current => allFilteredSelected ? current.filter(id => !filteredIds.includes(id)) : [...new Set([...current, ...filteredIds])]);
  }
  function clearSelection() { setSelectedIds([]); }
  function applyBatch() {
    if (!selectedIds.length) return setMessage('请先选择学生。');
    updateStudents(current => applyStudentBatch(current, selectedIds, batchDraft));
    setBatchDraft({ group: '', gender: '不修改', note: '' });
    setBatchOpen(false);
    setMessage(`已更新 ${selectedIds.length} 名学生。`);
  }
  function patchStudent(id: string, patch: Partial<Student>) {
    updateStudents(current => current.map(student => student.id === id ? { ...student, ...patch } : student));
  }
  function openNewStudent() {
    const draft = makeRosterStudent('', 0, students.length, makeId('roster'));
    setStudentDraft({ ...draft, id: makeId('student'), studentNo: `${students.length + 1}`.padStart(2, '0') });
  }
  function openEditStudent(id: string) {
    const target = students.find(student => student.id === id);
    if (target) setStudentDraft({ ...target });
  }
  function saveStudent() {
    if (!studentDraft?.name.trim()) return setMessage('请先填写学生姓名。');
    const phone = (studentDraft.parentPhone ?? '').replace(/[\s-]/g, '');
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) return setMessage('家长电话需要填写 11 位手机号，或留空。');
    const saved = {
      ...studentDraft,
      name: studentDraft.name.trim(),
      studentNo: studentDraft.studentNo?.trim() || `${students.length + 1}`.padStart(2, '0'),
      parentPhone: phone,
      group: Math.max(1, Number(studentDraft.group) || 1),
      seat: Math.max(1, Number(studentDraft.seat) || students.length + 1),
    };
    const exists = students.some(student => student.id === saved.id);
    updateStudents(current => exists ? current.map(student => student.id === saved.id ? saved : student) : [...current, saved], (current, resolved) => ({
      ...current,
      homeworkTasks: current.homeworkTasks?.map(task => task.classId === activeClass.id
        ? { ...task, statuses: { ...task.statuses, [saved.id]: task.statuses[saved.id] ?? '已交' } } : task),
    }));
    setStudentDraft(null);
    setFocusedId(saved.id);
    setMessage(exists ? '学生资料已更新。' : '学生已新增。');
  }
  async function removeStudent(id: string) {
    const target = students.find(student => student.id === id);
    if (!target || !await confirmAction(`${target.name} 的作业、积分、成绩、沟通和任职关联会一并清理。`)) return;
    update(current => {
      const cleaned = removeStudentRelations(current, [id], activeClass.id);
      const nextStudents = activeRosterClass(cleaned).students.filter(student => student.id !== id)
        .map((student, index) => ({ ...student, seat: index + 1, group: Math.floor(index / 4) + 1 }));
      return syncRosterStudents(cleaned, activeClass.id, nextStudents);
    });
    setMessage('学生及当前班级关联记录已删除。');
  }
  function importRows() { return parseRosterRows(importText); }
  function appendRoster() {
    const rows = importRows();
    if (!rows.length) return setMessage('请先粘贴学生名单。');
    const stamp = makeId('import');
    updateStudents(current => {
      const added = rows.map((row, index) => makeRosterStudent(row, index, current.length, stamp));
      return [...current, ...added];
    }, (current, resolved) => {
      const added = resolved.slice(-rows.length);
      return { ...current, homeworkTasks: current.homeworkTasks?.map(task => task.classId === activeClass.id
        ? { ...task, statuses: { ...task.statuses, ...Object.fromEntries(added.map(student => [student.id, '已交'])) } } : task) };
    });
    setImportOpen(false); setImportText(''); setMessage(`已追加 ${rows.length} 名学生。`);
  }
  async function replaceRoster() {
    const rows = importRows();
    if (!rows.length) return setMessage('请先粘贴学生名单。');
    if (!await confirmAction(`将替换 ${students.length} 名现有学生，并清理他们在当前班级的关联记录。其他班级不会受影响。`, '替换当前班级名单', '确认替换')) return;
    const replacement = rows.map((row, index) => makeRosterStudent(row, index, 0, makeId('import')));
    update(current => {
      const cleaned = removeStudentRelations(current, students.map(student => student.id), activeClass.id);
      const synced = syncRosterStudents(cleaned, activeClass.id, replacement);
      return { ...synced, homeworkTasks: synced.homeworkTasks?.map(task => task.classId === activeClass.id
        ? { ...task, statuses: Object.fromEntries(replacement.map(student => [student.id, '已交'])) } : task) };
    });
    clearSelection(); setImportOpen(false); setImportText(''); setMessage(`已导入 ${replacement.length} 名学生。`);
  }
  function exportRoster() {
    const header = ['学号', '姓名', '性别', '小组', '座位', '家长电话', '备注'];
    const rows = students.map(student => [student.studentNo ?? '', student.name, student.gender, `第${student.group}组`, `${student.seat}`, student.parentPhone ?? '', student.note ?? '']);
    const csv = [header, ...rows].map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${activeClass.name || '学生名单'}.csv`; link.click(); URL.revokeObjectURL(url);
    setMessage(`已导出 ${students.length} 名学生。`);
  }

  return { activeClass, students, filtered, pageItems, page: safePage, setPage, pageSize, setPageSize, totalPages,
    query, setQuery: setFilterQuery, groupFilter, setGroupFilter: setFilterGroup, groupOptions, selectedIds, allFilteredSelected,
    toggleSelect, toggleFiltered, clearSelection, batchOpen, setBatchOpen, batchDraft, setBatchDraft, applyBatch,
    focusedId, focusedStudent, setFocusedId, profileStudent, setProfileId, activity, editMode, setEditMode, patchStudent,
    importOpen, setImportOpen, importText, setImportText, importRows, appendRoster, replaceRoster, exportRoster,
    studentDraft, setStudentDraft, openNewStudent, openEditStudent, saveStudent, removeStudent, message, setMessage, metrics };
}
