import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/w/[token]/features/reflections/operations.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const reflections = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function fixture(count = 50) {
  const roster = prefix => Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, name: index === 0 ? '同名学生' : `${prefix}班${index}`, score: 80, points: 0, homework: '已交', attendance: '正常' }));
  const a = roster('a'), b = roster('b');
  return {
    activeClassId: 'a',
    students: a,
    rosterClasses: [{ id: 'a', students: a }, { id: 'b', students: b }],
    scoreExams: [
      { id: 'a-exam', classId: 'a', title: '甲班期中', date: '2026-09-10', subjects: ['语文', '数学'], scores: {}, followUpStudentIds: ['a-0', 'a-1'] },
      { id: 'b-exam', classId: 'b', title: '乙班期中', date: '2026-09-10', subjects: ['语文'], scores: {}, followUpStudentIds: ['b-0'] },
    ],
    examReflections: [
      { id: 'a-reflection', classId: 'a', studentId: 'a-0', examId: 'a-exam', date: '2026-09-10', problem: '旧问题', reason: '旧原因', action: '旧行动', familyMessage: '', teacherNote: '', status: '草稿' },
      { id: 'b-reflection', classId: 'b', studentId: 'b-0', examId: 'b-exam', date: '2026-09-10', problem: '他班问题', reason: '', action: '', familyMessage: '', teacherNote: '', status: '草稿' },
    ],
    records: [{ id: 'old-record', classId: 'a', studentId: 'a-1', student: 'a班1', type: '家校沟通', content: '原记录', date: '2026-09-09' }],
    dictation: { children: [{ id: 'child-1' }, { id: 'child-2' }], tasks: [] },
  };
}

function draft(patch = {}) {
  return { studentId: 'a-0', examId: 'a-exam', date: '2026-09-12', problem: ' 计算粗心 ', reason: ' 草稿混乱 ', action: ' 每天验算 ', familyMessage: ' 提醒检查 ', teacherNote: ' 周五复查 ', ...patch };
}

test('反思列表按班级、学生和考试共同隔离，并兼容可唯一归属的旧记录', () => {
  const data = fixture();
  data.examReflections.push({ ...draft({ id: 'legacy-a' }), status: '草稿' });
  data.examReflections.push({ ...draft({ id: 'wrong-explicit', classId: 'b' }), status: '草稿' });
  data.examReflections.push({ ...draft({ id: 'wrong-exam', examId: 'b-exam' }), status: '草稿' });
  assert.deepEqual(reflections.examReflectionsForClass(data, 'a').map(item => item.id), ['a-reflection', 'legacy-a']);
});

test('保存草稿会清理文本并补齐班级，但不生成沟通记录或移除跟进', () => {
  const data = fixture(), before = structuredClone(data);
  const result = reflections.saveExamReflection(data, 'a', draft({ id: 'new-reflection' }), '草稿', () => 'unused-reflection', () => 'unused-record');
  assert.deepEqual(data, before);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.reflection, { id: 'new-reflection', classId: 'a', studentId: 'a-0', examId: 'a-exam', date: '2026-09-12', problem: '计算粗心', reason: '草稿混乱', action: '每天验算', familyMessage: '提醒检查', teacherNote: '周五复查', status: '草稿' });
  assert.equal(result.data.records, data.records);
  assert.deepEqual(result.data.scoreExams[0].followUpStudentIds, ['a-0', 'a-1']);
  assert.equal(result.data.dictation, data.dictation);
});

test('完成反思生成可追溯的内部记录，并只移除当前学生的当前考试跟进', () => {
  const data = fixture();
  const result = reflections.saveExamReflection(data, 'a', draft({ id: 'new-reflection' }), '已完成', () => 'unused-reflection', () => 'reflection-record');
  assert.equal(result.error, undefined);
  assert.equal(result.record.id, 'reflection-record');
  assert.equal(result.record.reflectionId, 'new-reflection');
  assert.equal(result.record.classId, 'a');
  assert.equal(result.record.studentId, 'a-0');
  assert.equal(result.record.date, '2026-09-12');
  assert.match(result.record.content, /家长沟通建议：提醒检查/);
  assert.deepEqual(result.data.scoreExams[0].followUpStudentIds, ['a-1']);
  assert.equal(result.data.scoreExams[1], data.scoreExams[1]);
});

test('重复完成同一反思会更新一条留痕而不重复追加', () => {
  const data = fixture();
  const first = reflections.saveExamReflection(data, 'a', draft({ id: 'stable-reflection' }), '已完成', () => 'unused', () => 'stable-record');
  first.data.records[0].parentFeedback = '家长已知晓';
  const second = reflections.saveExamReflection(first.data, 'a', draft({ id: 'stable-reflection', problem: '改后的问题' }), '已完成', () => 'unused-2', () => 'duplicate-record');
  assert.equal(second.data.records.filter(item => item.reflectionId === 'stable-reflection').length, 1);
  assert.equal(second.record.id, 'stable-record');
  assert.equal(second.record.parentFeedback, '家长已知晓');
  assert.match(second.record.content, /改后的问题/);
});

test('反思保存拒绝空问题、他班学生、他班考试和跨班编辑目标', () => {
  const data = fixture();
  assert.equal(reflections.saveExamReflection(data, 'a', draft({ problem: ' ' }), '草稿', () => 'bad', () => 'bad').error, '请填写主要问题后再保存。');
  assert.equal(reflections.saveExamReflection(data, 'a', draft({ studentId: 'b-0' }), '草稿', () => 'bad', () => 'bad').error, '请选择当前班级的学生。');
  assert.equal(reflections.saveExamReflection(data, 'a', draft({ examId: 'b-exam' }), '草稿', () => 'bad', () => 'bad').error, '请选择当前班级的考试。');
  assert.match(reflections.saveExamReflection(data, 'a', draft({ id: 'b-reflection' }), '草稿', () => 'bad', () => 'bad').error, /不属于当前班级/);
});

test('已保存反思不能改绑其他学生或考试', () => {
  const data = fixture();
  assert.match(reflections.saveExamReflection(data, 'a', draft({ id: 'a-reflection', studentId: 'a-1' }), '草稿', () => 'bad', () => 'bad').error, /不能改到其他学生或考试/);
  data.scoreExams.push({ id: 'a-exam-2', classId: 'a', title: '月考', date: '2026-09-11', subjects: ['语文'], scores: {} });
  assert.match(reflections.saveExamReflection(data, 'a', draft({ id: 'a-reflection', examId: 'a-exam-2' }), '草稿', () => 'bad', () => 'bad').error, /不能改到其他学生或考试/);
});

test('旧无考试反思首次编辑可补当前考试，之后保持关联稳定', () => {
  const data = fixture();
  data.examReflections.push({ ...draft({ id: 'legacy-unlinked', examId: undefined }), status: '草稿' });
  const linked = reflections.saveExamReflection(data, 'a', draft({ id: 'legacy-unlinked' }), '草稿', () => 'unused', () => 'unused');
  assert.equal(linked.reflection.examId, 'a-exam');
});

test('反思日期使用本机年月日', () => {
  assert.equal(reflections.localReflectionDate(new Date(2026, 8, 12, 0, 30)), '2026-09-12');
});
