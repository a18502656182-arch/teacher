'use client';

import { useEffect, useMemo, useState } from 'react';
import { copyTextToClipboard } from '@/lib/clipboard';
import { makeId, type ClassroomData, type HomeworkTask } from '@/lib/classroom';
import { currentLocalDate } from '../schedule/read-model';
import { addHomeworkFollowStudents, applyHomeworkStatuses, patchHomeworkTask, removeHomeworkFollowStudent, removeHomeworkTask } from './operations';
import {
  HOMEWORK_STATUSES, activeHomeworkClass, filterHomeworkStudents, filterHomeworkTasks,
  homeworkStatus, homeworkTasksForClass, summarizeHomeworkTask, type HomeworkStatus,
  type HomeworkStudentFilters, type HomeworkTaskFilters,
} from './read-model';

type Update = (fn: (data: ClassroomData) => ClassroomData) => void;
type Confirm = (message: string, title?: string, confirmLabel?: string) => Promise<boolean>;
type TaskDraft = { date: string; subject: string; title: string };
const emptyFilters: HomeworkTaskFilters = { query: '', subject: '全部学科', month: '全部月份', status: '全部', group: '全部小组', studentQuery: '', dateFrom: '', dateTo: '' };
const emptyStudentFilters: HomeworkStudentFilters = { query: '', status: '全部', group: '全部小组' };

export function useHomeworkController({ data, update, confirmAction, readOnly = false }: { data: ClassroomData; update: Update; confirmAction: Confirm; readOnly?: boolean }) {
  const activeClass = activeHomeworkClass(data);
  const students = activeClass.students;
  const tasks = homeworkTasksForClass(data, activeClass.id);
  const [taskFilters, setTaskFilters] = useState<HomeworkTaskFilters>({ ...emptyFilters });
  const [studentFilters, setStudentFilters] = useState<HomeworkStudentFilters>({ ...emptyStudentFilters });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [taskPage, setTaskPage] = useState(1);
  const [studentPage, setStudentPage] = useState(1);
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id ?? '');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [editorMode, setEditorMode] = useState<'new' | 'edit' | null>(null);
  const [draft, setDraft] = useState<TaskDraft>({ date: currentLocalDate(), subject: '', title: '' });
  const [initialDraft, setInitialDraft] = useState<TaskDraft | null>(null);
  const [editorError, setEditorError] = useState('');
  const [discardOpen, setDiscardOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const [message, setMessage] = useState('');

  const filteredTasks = useMemo(() => filterHomeworkTasks(tasks, students, taskFilters), [students, taskFilters, tasks]);
  const taskTotalPages = Math.max(1, Math.ceil(filteredTasks.length / 10));
  const safeTaskPage = Math.min(taskPage, taskTotalPages);
  const taskPageItems = filteredTasks.slice((safeTaskPage - 1) * 10, safeTaskPage * 10);
  const selectedTask = tasks.find(task => task.id === selectedTaskId) ?? taskPageItems[0] ?? tasks[0];
  const filteredStudents = useMemo(() => filterHomeworkStudents(selectedTask, students, studentFilters), [selectedTask, studentFilters, students]);
  const studentTotalPages = Math.max(1, Math.ceil(filteredStudents.length / 20));
  const safeStudentPage = Math.min(studentPage, studentTotalPages);
  const studentPageItems = filteredStudents.slice((safeStudentPage - 1) * 20, safeStudentPage * 20);
  const taskSummary = selectedTask ? summarizeHomeworkTask(selectedTask, students) : null;
  const selectedSummary = selectedTask ? selectedStudentIds.filter(id => students.some(student => student.id === id)) : [];
  const pageIds = studentPageItems.map(student => student.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedSummary.includes(id));
  const followStudents = selectedTask ? (selectedTask.followUpStudentIds ?? []).map(id => students.find(student => student.id === id)).filter(Boolean) as typeof students : [];
  const subjects = [...new Set(tasks.map(task => task.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const months = [...new Set(tasks.map(task => task.date.slice(0, 7)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const groups = [...new Set(students.map(student => student.group))].sort((a, b) => a - b);
  const overallDone = tasks.reduce((sum, task) => sum + summarizeHomeworkTask(task, students).done, 0);
  const overallTotal = tasks.length * students.length;
  const metrics = {
    total: tasks.length,
    pending: tasks.filter(task => summarizeHomeworkTask(task, students).pending > 0).length,
    rate: overallTotal ? Math.round(overallDone / overallTotal * 100) : 0,
  };
  const editorDirty = Boolean(initialDraft && JSON.stringify(draft) !== JSON.stringify(initialDraft));

  useEffect(() => setTaskPage(1), [taskFilters, activeClass.id]);
  useEffect(() => setStudentPage(1), [studentFilters, selectedTask?.id]);
  useEffect(() => {
    if (selectedTask && selectedTask.id !== selectedTaskId) setSelectedTaskId(selectedTask.id);
    const validIds = new Set(students.map(student => student.id));
    setSelectedStudentIds(current => current.filter(id => validIds.has(id)));
  }, [selectedTask, selectedTaskId, students]);

  function patchTaskFilters(patch: Partial<typeof taskFilters>) { setTaskFilters(current => ({ ...current, ...patch })); }
  function patchStudentFilters(patch: Partial<typeof studentFilters>) { setStudentFilters(current => ({ ...current, ...patch })); }
  function resetTaskFilters() { setTaskFilters({ ...emptyFilters }); }
  function chooseTask(id: string, openMobile = false) {
    setSelectedTaskId(id); setSelectedStudentIds([]); setStudentFilters({ ...emptyStudentFilters }); setMessage('');
    if (openMobile) setMobileDetailOpen(true);
  }
  function openNewTask() {
    const next = { date: currentLocalDate(), subject: '', title: '' };
    setDraft(next); setInitialDraft(next); setEditorError(''); setEditorMode('new');
  }
  function openEditTask() {
    if (!selectedTask) return;
    const next = { date: selectedTask.date, subject: selectedTask.subject, title: selectedTask.title };
    setDraft(next); setInitialDraft(next); setEditorError(''); setEditorMode('edit');
  }
  function closeEditor(force = false) {
    if (!force && editorDirty) { setDiscardOpen(true); return; }
    setEditorMode(null); setEditorError(''); setDiscardOpen(false); setInitialDraft(null);
  }
  function saveTask() {
    if (readOnly) return;
    if (!draft.date || !draft.subject.trim() || !draft.title.trim()) { setEditorError('请填写日期、学科和作业内容。'); return; }
    if (editorMode === 'edit' && selectedTask) {
      update(current => patchHomeworkTask(current, activeClass.id, selectedTask.id, { date: draft.date, subject: draft.subject.trim(), title: draft.title.trim() }));
      setMessage('作业信息已更新，正在同步。');
    } else {
      const task: HomeworkTask = { id: makeId('homework'), classId: activeClass.id, date: draft.date, subject: draft.subject.trim(), title: draft.title.trim(), statuses: Object.fromEntries(students.map(student => [student.id, '已交'])), followUpStudentIds: [] };
      update(current => ({ ...current, homeworkTasks: [task, ...(current.homeworkTasks ?? [])] }));
      setSelectedTaskId(task.id); setMessage('作业已新增，正在同步。');
    }
    closeEditor(true);
  }
  async function deleteTask() {
    if (!selectedTask || readOnly || !await confirmAction(`${selectedTask.subject} · ${selectedTask.title} 删除后，逐生状态和待跟进名单也会移除。`, '删除作业', '确认删除')) return;
    update(current => removeHomeworkTask(current, activeClass.id, selectedTask.id));
    setMobileDetailOpen(false); setSelectedTaskId(''); setSelectedStudentIds([]); setMessage('作业已删除，正在同步。');
  }
  function setStudentStatus(studentId: string, status: HomeworkStatus) {
    if (!selectedTask || readOnly) return;
    update(current => applyHomeworkStatuses(current, activeClass.id, selectedTask.id, [studentId], status));
  }
  function toggleStudent(id: string) { setSelectedStudentIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); }
  function togglePage() { setSelectedStudentIds(current => allPageSelected ? current.filter(id => !pageIds.includes(id)) : [...new Set([...current, ...pageIds])]); }
  function bulkSet(status: HomeworkStatus) {
    if (!selectedTask || !selectedSummary.length || readOnly) return;
    const count = selectedSummary.length;
    update(current => applyHomeworkStatuses(current, activeClass.id, selectedTask.id, selectedSummary, status));
    setSelectedStudentIds([]); setMessage(`已更新 ${count} 名学生，正在同步。`);
  }
  function setStudentNote(studentId: string, note: string) {
    if (readOnly) return;
    update(current => ({ ...current,
      students: current.students.map(student => student.id === studentId ? { ...student, note } : student),
      rosterClasses: current.rosterClasses?.map(item => item.id === activeClass.id ? { ...item, students: item.students.map(student => student.id === studentId ? { ...student, note } : student) } : item),
    }));
  }
  function addSelectedToFollow() {
    if (!selectedTask || !selectedSummary.length || readOnly) return;
    const count = selectedSummary.length;
    update(current => addHomeworkFollowStudents(current, activeClass.id, selectedTask.id, selectedSummary));
    setSelectedStudentIds([]); setFollowOpen(true); setMessage(`已加入 ${count} 名学生，正在同步。`);
  }
  function removeFollow(studentId: string) {
    if (!selectedTask || readOnly) return;
    update(current => removeHomeworkFollowStudent(current, activeClass.id, selectedTask.id, studentId));
  }
  async function copyFollowList() {
    if (!selectedTask || !followStudents.length) return setMessage('待跟进名单为空，请先选择学生加入。');
    const text = `${selectedTask.date} ${selectedTask.subject} · ${selectedTask.title}\n${followStudents.map((student, index) => `${index + 1}. ${student.name}（第${student.group}组：${homeworkStatus(selectedTask, student)}）${student.note ? `；备注：${student.note}` : ''}`).join('\n')}`;
    const copied = await copyTextToClipboard(text, `已复制 ${followStudents.length} 名待跟进学生`);
    setMessage(copied ? `已复制 ${followStudents.length} 名待跟进学生。` : '浏览器未允许复制，请检查权限后重试。');
  }

  return { activeClass, students, tasks, filteredTasks, taskPageItems, taskPage: safeTaskPage, taskTotalPages, setTaskPage,
    selectedTask, chooseTask, mobileDetailOpen, setMobileDetailOpen, taskFilters, patchTaskFilters, resetTaskFilters, advancedOpen, setAdvancedOpen,
    subjects, months, groups, metrics, studentFilters, patchStudentFilters, filteredStudents, studentPageItems, studentPage: safeStudentPage,
    studentTotalPages, setStudentPage, selectedStudentIds: selectedSummary, allPageSelected, toggleStudent, togglePage, clearSelection: () => setSelectedStudentIds([]),
    taskSummary, statusOptions: HOMEWORK_STATUSES, setStudentStatus, bulkSet, setStudentNote, editorMode, openNewTask, openEditTask, closeEditor,
    draft, setDraft, editorError, editorDirty, saveTask, discardOpen, setDiscardOpen, deleteTask, followStudents, followOpen, setFollowOpen,
    addSelectedToFollow, removeFollow, copyFollowList, message, setMessage, readOnly };
}
