import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { createWorkspaceFixture } from './fixtures/workspace-fixtures.mjs';

const temp = await mkdtemp(path.join(tmpdir(), 'classroom-workspace-normalize-'));
after(() => rm(temp, { recursive: true, force: true }));

async function compile(sourcePath, targetName, replacements = []) {
  const source = await readFile(new URL(sourcePath, import.meta.url), 'utf8');
  let output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText;
  for (const [from, to] of replacements) output = output.replaceAll(from, to);
  await writeFile(path.join(temp, targetName), output);
}

await compile('../lib/classroom.ts', 'classroom.mjs');
await compile('../app/w/[token]/features/rules/catalog.ts', 'rules-catalog.mjs');
await compile('../app/w/[token]/features/rules/operations.ts', 'rules.mjs', [["'./catalog'", "'./rules-catalog.mjs'"]]);
await compile('../app/w/[token]/features/seating/operations.ts', 'seating.mjs');
await compile('../app/w/[token]/features/duty/operations.ts', 'duty.mjs');
await compile('../app/w/[token]/workspace/normalize.ts', 'normalize.mjs', [
  ["'@/lib/classroom'", "'./classroom.mjs'"],
  ["'../features/duty/operations'", "'./duty.mjs'"],
  ["'../features/rules/operations'", "'./rules.mjs'"],
  ["'../features/seating/operations'", "'./seating.mjs'"],
]);

const { normalizeWorkspaceData, scopeWorkspaceClassSettings } = await import(pathToFileURL(path.join(temp, 'normalize.mjs')));

test('正式空工作区保持空作业和空周计划', () => {
  const original = createWorkspaceFixture('E0').workspace.data;
  const before = structuredClone(original);
  const normalized = normalizeWorkspaceData(original);
  assert.deepEqual(normalized.homeworkTasks, []);
  assert.deepEqual(normalized.weeklyPlan, []);
  assert.deepEqual(original, before);
});

test('仅为旧数据中完全缺失的作业字段建立兼容任务', () => {
  const original = createWorkspaceFixture('E0').workspace.data;
  delete original.homeworkTasks;
  const normalized = normalizeWorkspaceData(original);
  assert.equal(normalized.homeworkTasks.length, 1);
  assert.equal(normalized.homeworkTasks[0].classId, 'a');
  assert.deepEqual(normalized.homeworkTasks[0].statuses, {});
});

test('两班关系按稳定学生ID归属且零值不被默认值覆盖', () => {
  const original = createWorkspaceFixture('E1').workspace.data;
  original.rosterClasses[0].students[0].score = 0;
  original.rosterClasses[0].students[0].points = 0;
  delete original.rosterClasses[0].students[0].studentNo;
  delete original.records[0].classId;
  delete original.records[1].classId;
  const normalized = normalizeWorkspaceData(original);
  assert.equal(normalized.students[0].score, 0);
  assert.equal(normalized.students[0].points, 0);
  assert.equal(normalized.students[0].studentNo, '01');
  assert.deepEqual(normalized.records.map((item) => item.classId), ['a', 'b']);
});

test('同名学生优先使用显式班级且无班级旧记录只落活动班', () => {
  const original = createWorkspaceFixture('E1').workspace.data;
  original.rosterClasses[0].students[0].name = '同名学生';
  original.rosterClasses[1].students[0].name = '同名学生';
  original.records = [
    { id: 'explicit-b', classId: 'b', student: '同名学生', type: '沟通', content: '乙班', date: '2026-09-13' },
    { id: 'legacy-active', student: '同名学生', type: '沟通', content: '旧记录', date: '2026-09-13' },
  ];
  const normalized = normalizeWorkspaceData(original);
  assert.equal(normalized.records[0].studentId, original.rosterClasses[1].students[0].id);
  assert.equal(normalized.records[0].classId, 'b');
  assert.equal(normalized.records[1].studentId, original.rosterClasses[0].students[0].id);
  assert.equal(normalized.records[1].classId, 'a');
});

test('切班时根课程座位和值日切到目标班且保留原班映射', () => {
  const previous = normalizeWorkspaceData(createWorkspaceFixture('E1').workspace.data);
  previous.classSchedules.a = { courses: [['甲班课程']], events: [], focuses: [], weeks: [] };
  previous.classSchedules.b = { courses: [['乙班课程']], events: [], focuses: [], weeks: [] };
  previous.courses = previous.classSchedules.a.courses;
  previous.classSeatingConfigs.a = { rows: 9, columns: 6, groupCount: 10, aisleAfter: [2, 4] };
  previous.classSeatingConfigs.b = { rows: 10, columns: 6, groupCount: 10, aisleAfter: [2, 4] };
  previous.seatingConfig = previous.classSeatingConfigs.a;
  previous.classDutySettings.a = { offset: 1, jobs: previous.dutyJobs };
  previous.classDutySettings.b = { offset: 2, jobs: previous.dutyJobs.map((job) => ({ ...job, id: `b-${job.id}` })) };
  previous.dutyOffset = 1;
  const targetClass = previous.rosterClasses[1];
  const updated = { ...previous, activeClassId: 'b', students: targetClass.students };
  const scoped = scopeWorkspaceClassSettings(previous, updated);
  assert.equal(scoped.courses[0][0], '乙班课程');
  assert.equal(scoped.seatingConfig.rows, 10);
  assert.equal(scoped.dutyOffset, 2);
  assert.equal(scoped.classSchedules.a.courses[0][0], '甲班课程');
  assert.equal(scoped.classSeatingConfigs.a.rows, 9);
});
