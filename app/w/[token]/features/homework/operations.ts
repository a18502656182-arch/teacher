import type { ClassroomData, HomeworkTask, Student } from '@/lib/classroom';

export type HomeworkStatus = HomeworkTask['statuses'][string];

function ownedTaskIndex(tasks: readonly HomeworkTask[] | undefined, classId: string, taskId: string): number {
  if (!tasks) return -1;
  const matches = tasks.map((task, index) => ({ task, index }))
    .filter(item => item.task.id === taskId && (!item.task.classId || item.task.classId === classId));
  return matches.length === 1 ? matches[0].index : -1;
}

export function patchHomeworkTask(
  data: ClassroomData, classId: string, taskId: string,
  patch: Pick<HomeworkTask, 'date' | 'subject' | 'title'>,
): ClassroomData {
  const index = ownedTaskIndex(data.homeworkTasks, classId, taskId);
  if (index < 0) return data;
  return { ...data, homeworkTasks: data.homeworkTasks!.map((task, taskIndex) => taskIndex === index ? { ...task, ...patch } : task) };
}

export function removeHomeworkTask(data: ClassroomData, classId: string, taskId: string): ClassroomData {
  const index = ownedTaskIndex(data.homeworkTasks, classId, taskId);
  if (index < 0) return data;
  return { ...data, homeworkTasks: data.homeworkTasks!.filter((_, taskIndex) => taskIndex !== index) };
}

export function addHomeworkFollowStudents(data: ClassroomData, classId: string, taskId: string, studentIds: readonly string[]): ClassroomData {
  const index = ownedTaskIndex(data.homeworkTasks, classId, taskId);
  const allowed = new Set((data.rosterClasses?.find(roster => roster.id === classId)?.students ?? data.students).map(student => student.id));
  const accepted = [...new Set(studentIds.filter(id => allowed.has(id)))];
  if (index < 0 || !accepted.length) return data;
  return { ...data, homeworkTasks: data.homeworkTasks!.map((task, taskIndex) => taskIndex === index
    ? { ...task, followUpStudentIds: [...new Set([...(task.followUpStudentIds ?? []), ...accepted])] } : task) };
}

export function removeHomeworkFollowStudent(data: ClassroomData, classId: string, taskId: string, studentId: string): ClassroomData {
  const index = ownedTaskIndex(data.homeworkTasks, classId, taskId);
  if (index < 0) return data;
  return { ...data, homeworkTasks: data.homeworkTasks!.map((task, taskIndex) => taskIndex === index
    ? { ...task, followUpStudentIds: (task.followUpStudentIds ?? []).filter(id => id !== studentId) } : task) };
}

/** Pure local edit only. The workspace owner still controls persistence and permissions.
 * Caller supplies the active class and its selected student IDs, as in the incumbent views.
 * Task status retains 已复查; the legacy student summary stores it as 已交.
 */
export function applyHomeworkStatuses(
  data: ClassroomData, classId: string, taskId: string,
  studentIds: readonly string[], status: HomeworkStatus,
): ClassroomData {
  const taskIndex = ownedTaskIndex(data.homeworkTasks, classId, taskId);
  const targetTask = taskIndex >= 0 ? data.homeworkTasks?.[taskIndex] : undefined;
  if (data.homeworkTasks && !targetTask) return data;
  const classStudents = data.rosterClasses?.find(roster => roster.id === classId)?.students ?? data.students;
  const allowedIds = new Set(classStudents.map(student => student.id));
  const targetIds = studentIds.filter(id => allowedIds.has(id));
  if (!targetIds.length) return data;
  const ids = new Set(targetIds);
  const summaryStatus: Student['homework'] = status === '已复查' ? '已交' : status;
  const updateStudent = (student: Student): Student => ids.has(student.id)
    ? { ...student, homework: summaryStatus } : student;
  return {
    ...data,
    homeworkTasks: data.homeworkTasks?.map((task, index) => index === taskIndex
      ? { ...task, statuses: { ...task.statuses, ...Object.fromEntries(targetIds.map(id => [id, status])) } }
      : task),
    students: data.students.map(updateStudent),
    rosterClasses: data.rosterClasses?.map(roster => roster.id === classId
      ? { ...roster, students: roster.students.map(updateStudent) } : roster),
  };
}
