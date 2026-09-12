import type { ClassroomData, HomeworkTask, Student } from '@/lib/classroom';

export type HomeworkStatus = HomeworkTask['statuses'][string];

/** Pure local edit only. The workspace owner still controls persistence and permissions.
 * Caller supplies the active class and its selected student IDs, as in the incumbent views.
 * Task status retains 已复查; the legacy student summary stores it as 已交.
 */
export function applyHomeworkStatuses(
  data: ClassroomData, classId: string, taskId: string,
  studentIds: readonly string[], status: HomeworkStatus,
): ClassroomData {
  const targetTask = data.homeworkTasks?.find(task => task.id === taskId && (!task.classId || task.classId === classId));
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
    homeworkTasks: data.homeworkTasks?.map(task => task.id === taskId && (!task.classId || task.classId === classId)
      ? { ...task, statuses: { ...task.statuses, ...Object.fromEntries(targetIds.map(id => [id, status])) } }
      : task),
    students: data.students.map(updateStudent),
    rosterClasses: data.rosterClasses?.map(roster => roster.id === classId
      ? { ...roster, students: roster.students.map(updateStudent) } : roster),
  };
}
