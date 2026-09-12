import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

async function loadOperations(feature) {
  const source = await readFile(new URL(`../app/w/[token]/features/${feature}/operations.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { applyHomeworkStatuses } = await loadOperations('homework');
const { applyStudentBatch } = await loadOperations('students');
function fixture(count = 50) {
  const roster = prefix => Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, name: `合成${i}`, homework: '未交', group: 2, gender: '女', note: '保留备注', points: 60 }));
  const a = roster('a'), b = roster('b');
  return { activeClassId: 'a', students: a, rosterClasses: [{ id: 'a', students: a }, { id: 'b', students: b }],
    homeworkTasks: [{ id: 'a-task', classId: 'a', statuses: { 'a-0': '未交', 'a-1': '待订正' }, followUpStudentIds: ['a-1'] }, { id: 'b-task', classId: 'b', statuses: { 'b-0': '未交' } }],
    dictation: { children: [{ id: 'child-1' }, { id: 'child-2' }], tasks: [] } };
}

test('两班各50人：批量作业只更新目标任务与班级名册，不改变家庭记录', () => {
  const data = fixture(), before = structuredClone(data);
  const next = applyHomeworkStatuses(data, 'a', 'a-task', ['a-0', 'a-49'], '待订正');
  assert.deepEqual(data, before);
  assert.equal(next.students[0].homework, '待订正');
  assert.equal(next.rosterClasses[0].students[49].homework, '待订正');
  assert.equal(next.students[1], data.students[1]);
  assert.equal(next.rosterClasses[1], data.rosterClasses[1]);
  assert.equal(next.homeworkTasks[1], data.homeworkTasks[1]);
  assert.equal(next.dictation, data.dictation);
  assert.deepEqual(next.homeworkTasks[0].followUpStudentIds, ['a-1']);
});
test('已复查保留任务四态，学生汇总仍兼容为已交', () => {
  const next = applyHomeworkStatuses(fixture(), 'a', 'a-task', ['a-1'], '已复查');
  assert.equal(next.homeworkTasks[0].statuses['a-1'], '已复查');
  assert.equal(next.students[1].homework, '已交');
  assert.equal(next.rosterClasses[0].students[1].homework, '已交');
});
test('105人全选与逐生操作获得相同业务结果', () => {
  const data = fixture(105), ids = data.students.map(s => s.id);
  const batch = applyHomeworkStatuses(data, 'a', 'a-task', ids, '已交');
  const sequential = ids.reduce((d, id) => applyHomeworkStatuses(d, 'a', 'a-task', [id], '已交'), data);
  assert.deepEqual(batch, sequential);
  assert.equal(Object.keys(batch.homeworkTasks[0].statuses).length, 105);
});
test('旧数据缺少可选班级/任务字段仍保持原兼容结构', () => {
  const data = { students: fixture().students };
  const next = applyHomeworkStatuses(data, 'a', 'task', ['a-0'], '已交');
  assert.equal(next.students[0].homework, '已交');
  assert.equal(next.homeworkTasks, undefined);
  assert.equal(next.rosterClasses, undefined);
});
test('学生批量空字段不清空已有资料，未选学生保持不变', () => {
  const students = fixture().students, before = structuredClone(students);
  const next = applyStudentBatch(students, ['a-0'], { group: ' ', gender: '不修改', note: ' ' });
  assert.deepEqual(next, students);
  assert.equal(next[1], students[1]);
  assert.deepEqual(students, before);
});
test('学生批量字段沿用原校正规则，不覆盖积分等非目标字段', () => {
  const students = fixture().students;
  const next = applyStudentBatch(students, ['a-0'], { group: '-2', gender: '男', note: '  新备注  ' });
  assert.deepEqual(next[0], { ...students[0], group: 1, gender: '男', note: '新备注' });
  assert.equal(next[1], students[1]);
  assert.equal(applyStudentBatch(students, ['a-0'], { group: '非数字', gender: '不修改', note: '' })[0].group, 1);
});
test('空选择与另一班学生ID不会修改当前名单', () => {
  const students = fixture(105).students;
  for (const ids of [[], ['b-0']]) {
    assert.deepEqual(applyStudentBatch(students, ids, { group: '9', gender: '男', note: '新备注' }), students);
  }
});
