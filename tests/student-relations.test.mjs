import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/w/[token]/features/students/relations.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { removeStudentRelations } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function fixture() {
  const students = prefix => Array.from({ length: 50 }, (_, i) => ({ id: `${prefix}-${i}` }));
  return {
    students: students('a'), rosterClasses: [{ id: 'a', students: students('a') }, { id: 'b', students: students('b') }],
    records: [{ studentId: 'a-0' }, { studentId: 'a-1' }, { studentId: 'b-0' }, { studentName: '旧无ID记录' }],
    scoreExams: [{ id: 'exam-a', classId: 'a', scores: { 'a-0': 10, 'a-1': 20 }, knowledgeItems: [{ scores: { 'a-0': 1, 'a-1': 2 } }] }, { id: 'exam-b', classId: 'b', scores: { 'b-0': 30 } }],
    examReflections: [{ id: 'r0', studentId: 'a-0', examId: 'exam-a' }, { id: 'r1', studentId: 'a-1', examId: 'exam-a' }, { id: 'r2', studentId: 'b-0', examId: 'exam-b' }],
    homeworkTasks: [{ classId: 'a', statuses: { 'a-0': '未交', 'a-1': '已交' }, followUpStudentIds: ['a-0', 'a-1'] }],
    dictation: { children: [{ id: 'child-1' }, { id: 'child-2' }], tasks: [
      { id: 'affected', context: { kind: 'class', classId: 'a' }, participants: [{ id: 'a-0' }, { id: 'a-1' }], results: { 'a-0': { status: 'graded' }, 'a-1': { status: 'graded' } } },
      { id: 'last', context: { kind: 'class', classId: 'a' }, participants: [{ id: 'a-0' }], results: {} },
      { id: 'family-empty', context: { kind: 'family', childId: 'child-1' }, participants: [], results: {} },
      { id: 'other-class-empty', context: { kind: 'class', classId: 'b' }, participants: [], results: {} },
      { id: 'same-class-unrelated-empty', context: { kind: 'class', classId: 'a' }, participants: [], results: {} },
    ] },
  };
}

test('删除一名学生不删除同一考试其他学生的反思', () => {
  const data = fixture(), before = structuredClone(data);
  const next = removeStudentRelations(data, ['a-0'], 'a');
  assert.deepEqual(next.examReflections.map(r => r.id), ['r1', 'r2']);
  assert.deepEqual(data, before);
});
test('听写只清理选中学生，保留家庭/他班/未受影响的空任务', () => {
  const data = fixture(), next = removeStudentRelations(data, ['a-0'], 'a');
  assert.deepEqual(next.dictation.tasks.map(t => t.id), ['affected', 'family-empty', 'other-class-empty', 'same-class-unrelated-empty']);
  assert.deepEqual(next.dictation.tasks[0].participants, [{ id: 'a-1' }]);
  assert.deepEqual(Object.keys(next.dictation.tasks[0].results), ['a-1']);
  assert.equal(next.dictation.children, data.dictation.children);
  assert.equal(next.dictation.tasks[1], data.dictation.tasks[2]);
});
test('关联清理保留未选数据、另一班成绩和旧无ID沟通记录', () => {
  const data = fixture(), next = removeStudentRelations(data, ['a-0'], 'a');
  assert.deepEqual(next.scoreExams[0].scores, { 'a-1': 20 });
  assert.deepEqual(next.scoreExams[0].knowledgeItems[0].scores, { 'a-1': 2 });
  assert.equal(next.scoreExams[1], data.scoreExams[1]);
  assert.deepEqual(next.homeworkTasks[0].statuses, { 'a-1': '已交' });
  assert.deepEqual(next.homeworkTasks[0].followUpStudentIds, ['a-1']);
  assert.equal(next.records.length, 3);
  assert.equal(next.rosterClasses, data.rosterClasses);
  assert.equal(removeStudentRelations(data, [], 'a'), data);
});
