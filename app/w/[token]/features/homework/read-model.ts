import type {
  ClassroomData,
  HomeworkTask,
  RosterClass,
  Student,
} from "@/lib/classroom";

export const HOMEWORK_STATUSES = ["已交", "未交", "待订正", "已复查"] as const;
export type HomeworkStatus = (typeof HOMEWORK_STATUSES)[number];

export type HomeworkTaskFilters = {
  query: string;
  subject: string;
  month: string;
  status: "全部" | HomeworkStatus;
  group: string;
  studentQuery: string;
  dateFrom: string;
  dateTo: string;
};

export type HomeworkStudentFilters = {
  query: string;
  status: "全部" | HomeworkStatus;
  group: string;
};

export function activeHomeworkClass(data: ClassroomData): RosterClass {
  const classes = data.rosterClasses?.length
    ? data.rosterClasses
    : [
        {
          id: data.activeClassId ?? "class-1",
          name: "当前班级",
          grade: "",
          term: "",
          students: data.students,
        },
      ];
  return classes.find((item) => item.id === data.activeClassId) ?? classes[0];
}

export function homeworkTasksForClass(data: ClassroomData, classId: string) {
  return (data.homeworkTasks ?? []).filter((task) => task.classId === classId);
}

export function homeworkStatus(
  task: HomeworkTask,
  student: Student,
): HomeworkStatus {
  return task.statuses[student.id] ?? student.homework;
}

export function summarizeHomeworkTask(task: HomeworkTask, students: Student[]) {
  const counts = Object.fromEntries(
    HOMEWORK_STATUSES.map((status) => [status, 0]),
  ) as Record<HomeworkStatus, number>;
  for (const student of students) counts[homeworkStatus(task, student)] += 1;
  const done = counts["已交"] + counts["已复查"];
  return {
    counts,
    total: students.length,
    done,
    missing: counts["未交"],
    fixing: counts["待订正"],
    pending: counts["未交"] + counts["待订正"],
    rate: students.length ? Math.round((done / students.length) * 100) : 0,
  };
}

export function filterHomeworkTasks(
  tasks: HomeworkTask[],
  students: Student[],
  filters: HomeworkTaskFilters,
) {
  const from =
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo
      ? filters.dateTo
      : filters.dateFrom;
  const to =
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo
      ? filters.dateFrom
      : filters.dateTo;
  const query = filters.query.trim().toLocaleLowerCase("zh-CN");
  const studentQuery = filters.studentQuery.trim().toLocaleLowerCase("zh-CN");
  return tasks
    .filter((task) => {
      const matchesTask =
        !query ||
        `${task.date}${task.subject}${task.title}`
          .toLocaleLowerCase("zh-CN")
          .includes(query);
      const matchesSubject =
        filters.subject === "全部学科" || task.subject === filters.subject;
      const matchesMonth =
        filters.month === "全部月份" || task.date.startsWith(filters.month);
      const matchesDate =
        (!from || task.date >= from) && (!to || task.date <= to);
      const filtersStudents = Boolean(
        studentQuery ||
        filters.status !== "全部" ||
        filters.group !== "全部小组",
      );
      const matchesStudent =
        !filtersStudents ||
        students.some((student) => {
          const text =
            `${student.name}${student.studentNo ?? ""}${student.note ?? ""}${student.group}${homeworkStatus(task, student)}`.toLocaleLowerCase(
              "zh-CN",
            );
          const matchesStudentQuery =
            !studentQuery || text.includes(studentQuery);
          const matchesStudentStatus =
            filters.status === "全部" ||
            homeworkStatus(task, student) === filters.status;
          const matchesStudentGroup =
            filters.group === "全部小组" ||
            student.group === Number(filters.group);
          return (
            matchesStudentQuery && matchesStudentStatus && matchesStudentGroup
          );
        });
      return (
        matchesTask &&
        matchesSubject &&
        matchesMonth &&
        matchesDate &&
        matchesStudent
      );
    })
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        a.subject.localeCompare(b.subject, "zh-CN"),
    );
}

export function filterHomeworkStudents(
  task: HomeworkTask | undefined,
  students: Student[],
  filters: HomeworkStudentFilters,
) {
  if (!task) return [];
  const query = filters.query.trim().toLocaleLowerCase("zh-CN");
  return students.filter((student) => {
    const status = homeworkStatus(task, student);
    const matchesQuery =
      !query ||
      `${student.name}${student.studentNo ?? ""}${student.note ?? ""}`
        .toLocaleLowerCase("zh-CN")
        .includes(query);
    const matchesStatus =
      filters.status === "全部" || status === filters.status;
    const matchesGroup =
      filters.group === "全部小组" || student.group === Number(filters.group);
    return matchesQuery && matchesStatus && matchesGroup;
  });
}
