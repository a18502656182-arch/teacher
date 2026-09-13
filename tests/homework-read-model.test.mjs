import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const temp = await mkdtemp(path.join(tmpdir(), "homework-read-model-"));
after(() => rm(temp, { recursive: true, force: true }));
const source = await readFile(
  new URL("../app/w/[token]/features/homework/read-model.ts", import.meta.url),
  "utf8",
);
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ESNext,
  },
}).outputText;
await writeFile(path.join(temp, "homework.mjs"), output);
const model = await import(pathToFileURL(path.join(temp, "homework.mjs")));

const student = (index, patch = {}) => ({
  id: `s-${index}`,
  studentNo: `${index + 1}`.padStart(3, "0"),
  name: `学生${index}`,
  gender: index % 2 ? "男" : "女",
  group: (index % 6) + 1,
  seat: index + 1,
  points: 0,
  homework: "已交",
  attendance: "正常",
  score: 0,
  ...patch,
});
const task = (index, patch = {}) => ({
  id: `h-${index}`,
  classId: "a",
  date: `2026-09-${`${(index % 28) + 1}`.padStart(2, "0")}`,
  subject: index % 2 ? "语文" : "数学",
  title: `第 ${index + 1} 次练习`,
  statuses: {},
  followUpStudentIds: [],
  ...patch,
});
const filters = (patch) => ({
  query: "",
  subject: "全部学科",
  month: "全部月份",
  status: "全部",
  group: "全部小组",
  studentQuery: "",
  dateFrom: "",
  dateTo: "",
  ...patch,
});

test("作业读取覆盖 0、3、30 项任务，并严格隔离当前班级", () => {
  for (const count of [0, 3, 30]) {
    const own = Array.from({ length: count }, (_, index) => task(index));
    const data = {
      activeClassId: "a",
      students: [],
      rosterClasses: [
        { id: "a", name: "甲班", grade: "", term: "", students: [] },
        { id: "b", name: "乙班", grade: "", term: "", students: [] },
      ],
      homeworkTasks: [...own, task(99, { id: "other", classId: "b" })],
    };
    assert.equal(
      model.homeworkTasksForClass(data, model.activeHomeworkClass(data).id)
        .length,
      count,
    );
  }
});

test("105 人四态汇总准确，任务状态优先于学生默认状态", () => {
  const students = Array.from({ length: 105 }, (_, index) =>
    student(index, { homework: index % 2 ? "已交" : "未交" }),
  );
  const statuses = Object.fromEntries(
    students
      .slice(0, 4)
      .map((item, index) => [item.id, model.HOMEWORK_STATUSES[index]]),
  );
  const summary = model.summarizeHomeworkTask(task(0, { statuses }), students);
  assert.deepEqual(summary.counts, {
    已交: 51,
    未交: 52,
    待订正: 1,
    已复查: 1,
  });
  assert.equal(summary.total, 105);
  assert.equal(summary.pending, 53);
  assert.equal(summary.rate, 50);
});

test("任务筛选支持倒置日期、学科、月份、状态、小组与学生条件", () => {
  const students = [
    student(0, {
      name: "欧阳一个很长很长的学生姓名",
      note: "需重点复查",
      group: 1,
    }),
    student(1, { group: 2 }),
  ];
  const tasks = [
    task(0, {
      id: "early",
      date: "2026-08-31",
      subject: "数学",
      statuses: { "s-0": "待订正" },
    }),
    task(1, {
      id: "target",
      date: "2026-09-12",
      subject: "语文",
      title: "古诗默写与订正",
      statuses: { "s-0": "未交" },
    }),
    task(2, { id: "late", date: "2026-10-01", subject: "语文" }),
  ];
  const result = model.filterHomeworkTasks(
    tasks,
    students,
    filters({
      query: "默写",
      subject: "语文",
      month: "2026-09",
      status: "未交",
      group: "1",
      studentQuery: "重点复查",
      dateFrom: "2026-09-30",
      dateTo: "2026-09-01",
    }),
  );
  assert.deepEqual(
    result.map((item) => item.id),
    ["target"],
  );
});

test("任务的学生关键词、状态和小组必须由同一名学生命中", () => {
  const students = [
    student(0, { name: "林初夏", group: 1 }),
    student(1, { name: "另一名学生", group: 2 }),
  ];
  const sourceTask = task(0, { statuses: { "s-0": "已交", "s-1": "未交" } });
  assert.equal(
    model.filterHomeworkTasks(
      [sourceTask],
      students,
      filters({ studentQuery: "林初夏", status: "未交", group: "1" }),
    ).length,
    0,
  );
  assert.equal(
    model.filterHomeworkTasks(
      [sourceTask],
      students,
      filters({ studentQuery: "另一名学生", status: "未交", group: "2" }),
    ).length,
    1,
  );
});

test("学生搜索覆盖姓名、学号和完整备注，不暴露家长电话且不修改输入", () => {
  const students = [
    student(0, {
      name: "欧阳一个很长很长的学生姓名",
      note: "连续三天需要提醒完成订正",
      parentPhone: "13800000000",
    }),
    student(1, { studentNo: "A-105" }),
  ];
  const sourceTask = task(0, {
    statuses: { "s-0": "待订正", "s-1": "已复查" },
  });
  const before = structuredClone(students);
  assert.equal(
    model.filterHomeworkStudents(sourceTask, students, {
      query: "很长很长",
      status: "待订正",
      group: "全部小组",
    })[0].id,
    "s-0",
  );
  assert.equal(
    model.filterHomeworkStudents(sourceTask, students, {
      query: "A-105",
      status: "全部",
      group: "全部小组",
    })[0].id,
    "s-1",
  );
  assert.equal(
    model.filterHomeworkStudents(sourceTask, students, {
      query: "13800000000",
      status: "全部",
      group: "全部小组",
    }).length,
    0,
  );
  assert.deepEqual(students, before);
});
