import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/w/[token]/features/account/operations.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const account = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function student(prefix, index) {
  return { id: `${prefix}-${index}`, name: `${prefix}班学生${index}`, gender: '女', group: 1, seat: index, points: 0, homework: '已交', attendance: '正常', score: 0 };
}

function fixture() {
  const a = Array.from({ length: 50 }, (_, index) => student('a', index + 1));
  const b = Array.from({ length: 50 }, (_, index) => student('b', index + 1));
  return {
    activeClassId: 'a',
    students: a,
    rosterClasses: [
      { id: 'a', name: '甲班', grade: '三年级', term: '2026秋', students: a },
      { id: 'b', name: '乙班', grade: '四年级', term: '2026秋', students: b },
    ],
    dutyOffset: 0,
    records: [
      { id: 'record-a', classId: 'a', studentId: 'a-1', student: '甲', type: '沟通', content: '甲班', date: '2026-09-13' },
      { id: 'record-b', classId: 'b', studentId: 'b-1', student: '乙', type: '沟通', content: '乙班', date: '2026-09-13' },
    ],
    courses: [],
    homeworkTasks: [{ id: 'homework-a', classId: 'a', statuses: {} }, { id: 'homework-b', classId: 'b', statuses: {} }],
    pointEvents: [{ id: 'point-a', classId: 'a', studentId: 'a-1' }, { id: 'point-b', classId: 'b', studentId: 'b-1' }],
    scoreExams: [{ id: 'exam-a', classId: 'a' }, { id: 'exam-b', classId: 'b' }],
    examReflections: [{ id: 'reflection-a', classId: 'a', studentId: 'a-1', examId: 'exam-a' }, { id: 'reflection-b', classId: 'b', studentId: 'b-1', examId: 'exam-b' }],
    classSchedules: { a: { courses: [] }, b: { courses: [['乙班课程']] } },
    classSeatingConfigs: { a: { rows: 5 }, b: { rows: 6 } },
    classDutySettings: { a: { offset: 0, jobs: [] }, b: { offset: 1, jobs: [] } },
    dictation: {
      children: [{ id: 'child-1', name: '家庭孩子' }], books: [], tasks: [
        { id: 'dictation-a', context: { kind: 'class', classId: 'a' } },
        { id: 'dictation-b', context: { kind: 'class', classId: 'b' } },
        { id: 'dictation-family', context: { kind: 'family', childId: 'child-1' } },
      ],
    },
  };
}

test('两班各50人切换与编辑只更新目标班', () => {
  const data = fixture();
  const before = structuredClone(data);
  const switched = account.switchWorkspaceClass(data, 'b').data;
  assert.equal(switched.activeClassId, 'b');
  assert.equal(switched.students, data.rosterClasses[1].students);
  const patched = account.patchWorkspaceClass(switched, 'a', { name: '甲班新名称', grade: '五年级' }).data;
  assert.equal(patched.rosterClasses[0].name, '甲班新名称');
  assert.equal(patched.rosterClasses[1], switched.rosterClasses[1]);
  assert.equal(patched.students, switched.students);
  assert.deepEqual(data, before);
});

test('新班级为空且不复制学生、听写或另一班资料', () => {
  const data = fixture();
  const result = account.addWorkspaceClass(data, 'class-new').data;
  const created = result.rosterClasses.at(-1);
  assert.equal(result.activeClassId, 'class-new');
  assert.equal(created.name, '新班级3');
  assert.equal(created.term, '2026秋');
  assert.deepEqual(created.students, []);
  assert.deepEqual(result.students, []);
  assert.equal(result.dictation, data.dictation);
  assert.equal(result.rosterClasses[0], data.rosterClasses[0]);
});

test('删除班级清理该班关联并保留另一班与家庭历史', () => {
  const data = fixture();
  const before = structuredClone(data);
  const result = account.removeWorkspaceClass(data, 'a').data;
  assert.equal(result.activeClassId, 'b');
  assert.deepEqual(result.rosterClasses.map((item) => item.id), ['b']);
  assert.equal(result.students, data.rosterClasses[1].students);
  assert.deepEqual(result.records.map((item) => item.id), ['record-b']);
  assert.deepEqual(result.homeworkTasks.map((item) => item.id), ['homework-b']);
  assert.deepEqual(result.pointEvents.map((item) => item.id), ['point-b']);
  assert.deepEqual(result.scoreExams.map((item) => item.id), ['exam-b']);
  assert.deepEqual(result.examReflections.map((item) => item.id), ['reflection-b']);
  assert.deepEqual(result.dictation.tasks.map((item) => item.id), ['dictation-b', 'dictation-family']);
  assert.deepEqual(Object.keys(result.classSchedules), ['b']);
  assert.deepEqual(Object.keys(result.classSeatingConfigs), ['b']);
  assert.deepEqual(Object.keys(result.classDutySettings), ['b']);
  assert.deepEqual(data, before);
});

test('失效班级与删除最后一个班级均拒绝写入', () => {
  const data = fixture();
  assert.match(account.switchWorkspaceClass(data, 'missing').error, /不存在/);
  assert.equal(account.patchWorkspaceClass(data, 'missing', { name: '错误' }).data, data);
  const single = { ...data, rosterClasses: [data.rosterClasses[0]] };
  const result = account.removeWorkspaceClass(single, 'a');
  assert.match(result.error, /至少需要保留一个班级/);
  assert.equal(result.data, single);
});
