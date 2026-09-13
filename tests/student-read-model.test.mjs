import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const temp = await mkdtemp(path.join(tmpdir(), 'student-read-model-'));
after(() => rm(temp, { recursive: true, force: true }));
const recordsSource = await readFile(new URL('../app/w/[token]/features/records/operations.ts', import.meta.url), 'utf8');
const recordsOutput = ts.transpileModule(recordsSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText;
await writeFile(path.join(temp, 'records.mjs'), recordsOutput);
const source = await readFile(new URL('../app/w/[token]/features/students/read-model.ts', import.meta.url), 'utf8');
let output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText;
output = output.replace("'../records/operations'", "'./records.mjs'");
await writeFile(path.join(temp, 'students.mjs'), output);
const model = await import(pathToFileURL(path.join(temp, 'students.mjs')));

const student = (index, patch = {}) => ({ id: `s-${index}`, studentNo: `${index + 1}`.padStart(3, '0'), name: `学生${index}`, gender: index % 2 ? '男' : '女', group: Math.floor(index / 4) + 1, seat: index + 1, points: 0, homework: '已交', attendance: '正常', score: 0, ...patch });
const dataWith = count => ({ students: [], activeClassId: 'a', rosterClasses: [{ id: 'a', name: '甲班', grade: '', term: '', students: Array.from({ length: count }, (_, index) => student(index)) }, { id: 'b', name: '乙班', grade: '', term: '', students: [student(0, { id: 'b-0', name: '同名学生' })] }], records: [] });

test('学生读取覆盖 0、50、105 人并保持班级隔离', () => {
  for (const count of [0, 50, 105]) assert.equal(model.activeRosterClass(dataWith(count)).students.length, count);
  assert.equal(model.activeRosterClass(dataWith(50)).name, '甲班');
  assert.equal(model.filterStudents(dataWith(105).rosterClasses[0].students, '', '全部小组').length, 105);
});

test('搜索支持长姓名、缺失电话、学号与小组，且不修改输入', () => {
  const students = [student(0, { name: '欧阳一个很长很长的复姓学生姓名', parentPhone: undefined, note: '需作业提醒' }), student(1, { parentPhone: '13800000001' })];
  const before = structuredClone(students);
  assert.equal(model.filterStudents(students, '很长很长', '全部小组')[0].id, 's-0');
  assert.equal(model.filterStudents(students, '13800000001', '全部小组')[0].id, 's-1');
  assert.equal(model.filterStudents(students, '', '1').length, 2);
  assert.deepEqual(students, before);
});

test('名单解析不补造成绩或积分，并保留可选电话和备注', () => {
  assert.deepEqual(model.parseRosterRows(' 张三 13800000001 需提醒\n\n李四 '), ['张三 13800000001 需提醒', '李四']);
  const created = model.makeRosterStudent('张三 13800000001 需提醒', 0, 50, 'fixed');
  assert.equal(created.points, 0);
  assert.equal(created.score, 0);
  assert.equal(created.parentPhone, '13800000001');
  assert.equal(created.note, '需提醒');
});

test('同步当前班名单不改写另一班', () => {
  const sourceData = dataWith(50), beforeOther = sourceData.rosterClasses[1];
  const next = model.syncRosterStudents(sourceData, 'a', [student(0, { name: '改名后' })]);
  assert.equal(next.students[0].name, '改名后');
  assert.equal(next.rosterClasses[0].students[0].name, '改名后');
  assert.equal(next.rosterClasses[1], beforeOther);
});
