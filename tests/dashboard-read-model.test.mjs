import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const temp = await mkdtemp(path.join(tmpdir(), 'classroom-dashboard-read-model-'));
after(() => rm(temp, { recursive: true, force: true }));

async function compile(sourcePath, targetName, replacements = []) {
  const source = await readFile(new URL(sourcePath, import.meta.url), 'utf8');
  let output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText;
  for (const [from, to] of replacements) output = output.replaceAll(from, to);
  await writeFile(path.join(temp, targetName), output);
}

await compile('../lib/classroom.ts', 'classroom.mjs', [["'./dictation'", "'./dictation.mjs'"]]);
await compile('../lib/dictation.ts', 'dictation.mjs', [["'./classroom'", "'./classroom.mjs'"]]);
await compile('../app/w/[token]/features/records/operations.ts', 'records.mjs');
await compile('../app/w/[token]/features/schedule/operations.ts', 'schedule.mjs');
await compile('../app/w/[token]/features/dashboard/read-model.ts', 'dashboard.mjs', [
  ["'@/lib/dictation'", "'./dictation.mjs'"],
  ["'../records/operations'", "'./records.mjs'"],
  ["'../schedule/operations'", "'./schedule.mjs'"],
]);

const { createDashboardReadModel } = await import(pathToFileURL(path.join(temp, 'dashboard.mjs')));
const NOW = new Date(2026, 8, 13, 9, 0);

function student(id, name) {
  return { id, name, gender: '女', group: 1, seat: 1, points: 0, homework: '已交', attendance: '正常', score: 90 };
}

function fixture() {
  const a = [student('a-1', '甲一'), student('a-2', '甲二')];
  const b = [student('b-1', '乙一')];
  return {
    students: a,
    activeClassId: 'a',
    rosterClasses: [{ id: 'a', name: '甲班', grade: '', term: '', students: a }, { id: 'b', name: '乙班', grade: '', term: '', students: b }],
    dutyOffset: 0,
    dutyJobs: [],
    records: [],
    courses: [],
    homeworkTasks: [],
    attendanceRecords: [],
    teacherAgenda: [],
    classSchedules: {},
    dictation: { version: 1, children: [], books: [], tasks: [] },
  };
}

test('首页作业与沟通数字只统计当前班级和当前名册', () => {
  const data = fixture();
  data.homeworkTasks = [
    { id: 'ha', classId: 'a', date: '2026-09-13', subject: '语文', title: '甲班作业', statuses: { 'a-1': '未交', ghost: '未交' } },
    { id: 'hb', classId: 'b', date: '2026-09-13', subject: '数学', title: '乙班作业', statuses: { 'b-1': '未交' } },
  ];
  data.records = [
    { id: 'ra', classId: 'a', studentId: 'a-2', student: '甲二', type: '家校', content: '甲班记录', date: '2026-09-13', status: '待跟进' },
    { id: 'rb', classId: 'b', studentId: 'b-1', student: '乙一', type: '家校', content: '乙班记录', date: '2026-09-13', status: '待跟进' },
  ];
  const model = createDashboardReadModel(data, [], NOW);
  assert.equal(model.outstandingHomework, 1);
  assert.deepEqual(model.pendingCommunication.map(item => item.id), ['ra']);
});

test('个人事项为空时仍按真实教学日显示课程，不把周日夹成周五', () => {
  const data = fixture();
  data.classSchedules.a = {
    config: { schoolYear: '', term: '', days: ['周日'], periods: [{ label: '第1节', time: '08:00-08:40' }, { label: '第2节', time: '08:50-09:30' }] },
    courses: [['语文', '数学']], events: [], focuses: [], weeks: [],
  };
  let model = createDashboardReadModel(data, [], NOW);
  assert.deepEqual(model.scheduleRows.map(item => [item.time, item.title, item.kind]), [['08:00', '语文', '课程'], ['08:50', '数学', '课程']]);
  data.classSchedules.a.config.days = ['周一'];
  model = createDashboardReadModel(data, [], NOW);
  assert.equal(model.scheduleRows.length, 0);
  assert.equal(model.hasConfiguredCourses, true);
});

test('过期事项决定首要动作，学生提醒保留日期和事实来源', () => {
  const data = fixture();
  data.teacherAgenda = [{ id: 'old', classId: 'a', date: '2026-09-12', type: '班级事务', title: '昨日未完成事项', status: '待处理', createdAt: 1 }];
  data.attendanceRecords = [{ id: 'att', classId: 'a', studentId: 'a-2', date: '2026-09-13', period: '上午', status: '迟到', createdAt: 1 }];
  const model = createDashboardReadModel(data, [], NOW);
  assert.deepEqual(model.primary, { id: 'schedule', label: '处理 1 项过期事项' });
  assert.deepEqual(model.attentionRows[0], { studentId: 'a-2', name: '甲二', date: '2026-09-13', source: '考勤', summary: '上午 · 迟到', priority: 3 });
});

test('正式空白首页不补造任务、值日岗位、学生提醒或家庭档案', () => {
  const model = createDashboardReadModel(fixture(), [{ id: 'default', name: '默认岗位', area: '', standard: '', enabled: true }], NOW);
  assert.equal(model.scheduleRows.length, 0);
  assert.equal(model.attentionRows.length, 0);
  assert.equal(model.outstandingHomework, 0);
  assert.equal(model.familyChildren.length, 0);
  assert.equal(model.duties.length, 0);
  assert.deepEqual(model.primary, { id: 'attendance', label: '登记今日考勤' });
});
