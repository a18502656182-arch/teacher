import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const temp = await mkdtemp(path.join(tmpdir(), 'classroom-family-test-'));
for (const [name, sourceUrl] of [
  ['classroom', new URL('../lib/classroom.ts', import.meta.url)],
  ['dictation', new URL('../lib/dictation.ts', import.meta.url)],
  ['operations', new URL('../app/w/[token]/features/family/operations.ts', import.meta.url)],
]) {
  const source = await readFile(sourceUrl, 'utf8');
  let compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText;
  compiled = compiled
    .replace(/from ['"]\.\/classroom['"]/g, "from './classroom.mjs'")
    .replace(/from ['"]@\/lib\/dictation['"]/g, "from './dictation.mjs'");
  await writeFile(path.join(temp, `${name}.mjs`), compiled);
}
after(() => rm(temp, { recursive: true, force: true }));

const family = await import(pathToFileURL(path.join(temp, 'operations.mjs')));
const { assertDictation } = await import(pathToFileURL(path.join(temp, 'dictation.mjs')));

function task(id, childId, date, result) {
  return {
    id, title: `${childId}的听写`, date, subject: '英语', context: { kind: 'family', childId },
    participants: [{ id: childId, name: '同名孩子', number: '' }],
    words: [{ id: `${id}-word`, text: 'school', meaning: '学校', lesson: '第一组' }],
    results: result ? { [childId]: result } : {}, createdAt: `${date}T08:00:00.000Z`,
  };
}

function fixture() {
  return {
    version: 1,
    children: [
      { id: 'child-a', name: '同名孩子', grade: '三年级' },
      { id: 'child-b', name: '同名孩子', grade: '一年级' },
    ],
    books: [{ id: 'book-1', title: '家庭词库', subject: '英语', edition: '', grade: '', term: '', entries: [{ id: 'book-word', text: 'book', meaning: '书', lesson: '第一组' }] }],
    tasks: [
      task('a-today', 'child-a', '2026-09-12', ['graded', [0], '2026-09-12T09:00:00.000Z', '']),
      task('a-old', 'child-a', '2026-08-01'),
      task('b-today', 'child-b', '2026-09-12'),
      { ...task('class-task', 'child-a', '2026-09-12'), context: { kind: 'class', classId: 'class-a' }, participants: [{ id: 'student-a', name: '班级学生', number: '001' }] },
    ],
  };
}

test('新增孩子清洗字段并保留词库与历史任务', () => {
  const data = fixture();
  const result = family.saveFamilyChild(data, { id: '', name: '  小禾  ', grade: ' 二年级 ' }, () => 'child-c');
  assert.equal(result.error, undefined);
  assert.deepEqual(result.child, { id: 'child-c', name: '小禾', grade: '二年级', archived: false });
  assert.equal(result.data.books, data.books);
  assert.equal(result.data.tasks, data.tasks);
});

test('重名孩子按ID保持独立，编辑不会改绑或复制历史', () => {
  const data = fixture();
  const result = family.saveFamilyChild(data, { id: 'child-b', name: '同名孩子', grade: '二年级' }, () => 'unused');
  assert.equal(result.data.children[0], data.children[0]);
  assert.equal(result.data.children[1].grade, '二年级');
  assert.deepEqual(family.familyTasks(result.data, 'child-a').map(item => item.id), ['a-today', 'a-old']);
  assert.deepEqual(family.familyTasks(result.data, 'child-b').map(item => item.id), ['b-today']);
});

test('归档和恢复只改档案状态，词库与全部历史保留', () => {
  const data = fixture();
  const archived = family.setFamilyChildArchived(data, 'child-a', true);
  assert.equal(archived.child.archived, true);
  assert.equal(archived.data.tasks, data.tasks);
  assert.equal(archived.data.books, data.books);
  assert.equal(family.setFamilyChildArchived(archived.data, 'child-a', false).child.archived, false);
});

test('家庭任务严格按childId筛选，不吸收班级学生或另一孩子', () => {
  const data = fixture();
  assert.deepEqual(family.familyTasks(data, 'child-a').map(item => item.id), ['a-today', 'a-old']);
  assert.equal(family.familyTasks(data, 'student-a').length, 0);
  assert.equal(family.familyTaskBelongsToChild(data.tasks[0], 'child-a'), true);
  assert.equal(family.familyTaskBelongsToChild(data.tasks[2], 'child-a'), false);
  assert.equal(family.familyTaskBelongsToChild(data.tasks[3], 'child-a'), false);
});

test('近30天统计按所选孩子计算，未批改不算全对', () => {
  const data = fixture();
  data.tasks.push({ ...task('a-archived', 'child-a', '2026-09-12'), archived: true });
  const overview = family.familyOverview(data, 'child-a', '2026-09-12');
  assert.deepEqual(overview.todayTasks.map(item => item.id), ['a-today']);
  assert.equal(overview.recentTasks.length, 2);
  assert.equal(overview.stats.graded, 1);
  assert.equal(overview.stats.wrong, 1);
  assert.equal(overview.pending, 1);
  assert.equal(overview.wrong.length, 1);
});

test('家庭近30天窗口与班级口径一致并排除未来和第31天', () => {
  const data = fixture();
  data.tasks.push(task('a-boundary', 'child-a', '2026-08-13', ['graded', [], '2026-08-13T09:00:00.000Z', '']));
  data.tasks.push(task('a-future', 'child-a', '2026-09-13', ['graded', [], '2026-09-13T09:00:00.000Z', '']));
  const overview = family.familyOverview(data, 'child-a', '2026-09-12');
  assert.deepEqual(overview.recentTasks.map(item => item.id), ['a-today']);
});

test('空孩子没有任务和假统计', () => {
  const overview = family.familyOverview(fixture(), '', '2026-09-12');
  assert.equal(overview.tasks.length, 0);
  assert.equal(overview.todayTasks.length, 0);
  assert.equal(overview.stats.rate, null);
  assert.equal(overview.pending, 0);
});

test('失效档案与过长字段被拒绝且不生成ID', () => {
  const data = fixture();
  let calls = 0;
  assert.match(family.saveFamilyChild(data, { id: 'missing', name: '孩子', grade: '' }, () => `${++calls}`).error, /已变化/);
  assert.match(family.saveFamilyChild(data, { id: '', name: ' ', grade: '' }, () => `${++calls}`).error, /姓名/);
  assert.match(family.saveFamilyChild(data, { id: '', name: '孩子', grade: '年'.repeat(81) }, () => `${++calls}`).error, /过长/);
  assert.match(family.setFamilyChildArchived(data, 'missing', true).error, /已变化/);
  assert.equal(calls, 0);
});

test('归档孩子保留旧任务但服务端校验拒绝新增任务', () => {
  const dictation = fixture();
  const classroom = { activeClassId: 'class-a', students: [{ id: 'student-a', name: '班级学生' }], rosterClasses: [{ id: 'class-a', name: '甲班', students: [{ id: 'student-a', name: '班级学生' }] }], records: [], courses: [], dictation };
  const previous = structuredClone(classroom);
  dictation.children[0].archived = true;
  assert.doesNotThrow(() => assertDictation(dictation, classroom, previous));
  dictation.tasks.push(task('a-new-after-archive', 'child-a', '2026-09-12'));
  assert.throws(() => assertDictation(dictation, classroom, previous), /已归档/);
});
