import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/w/[token]/features/students/profile.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { applyStudentProfile } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function fixture() {
  const a = [{ id: 'a-0', name: '合成甲', residence: '未填', tags: ['原标签'] }];
  const b = [{ id: 'b-0', name: '合成乙', residence: '住宿', tags: ['他班'] }];
  return {
    activeClassId: 'a', students: a, rosterClasses: [{ id: 'a', students: a }, { id: 'b', students: b }],
    guardians: [{ id: 'old', classId: 'a', studentId: 'a-0', name: '旧联系人' }, { id: 'b-g', classId: 'b', studentId: 'b-0', name: '他班联系人' }],
    careProfiles: [{ id: 'old-c', classId: 'a', studentId: 'a-0', instruction: '旧提醒' }, { id: 'b-c', classId: 'b', studentId: 'b-0', instruction: '他班提醒' }],
    dictation: { children: [{ id: 'child-1' }, { id: 'child-2' }], tasks: [] },
  };
}

test('档案保存清洗字段并只更新目标学生与当前班', () => {
  const data = fixture(), before = structuredClone(data);
  const result = applyStudentProfile(data, 'a-0', 'a', {
    residence: '走读', tags: ' 重点、 需提醒，重点,第4,第5,第6,第7,第8,第9 ',
    guardians: [{ id: 'g1', studentId: 'wrong', name: ' 王老师 ', phone: '138-0013-8000', emergencyPriority: 0 }],
    care: [{ id: 'c1', studentId: 'wrong', instruction: ' 课间提醒 ', contraindication: ' 避免剧烈活动 ', visibleScope: '班主任' }],
  });
  assert.equal(result.error, undefined);
  assert.deepEqual(data, before);
  assert.deepEqual(result.data.students[0].tags, ['重点', '需提醒', '重点', '第4', '第5', '第6', '第7', '第8']);
  assert.equal(result.data.rosterClasses[0].students[0].residence, '走读');
  assert.equal(result.data.rosterClasses[1], data.rosterClasses[1]);
  assert.deepEqual(result.data.guardians[0], { id: 'b-g', classId: 'b', studentId: 'b-0', name: '他班联系人' });
  assert.deepEqual(result.data.guardians[1], { id: 'g1', classId: 'a', studentId: 'a-0', name: '王老师', phone: '13800138000', emergencyPriority: 1, isPrimary: false });
  assert.equal(result.data.careProfiles[1].instruction, '课间提醒');
  assert.equal(result.data.careProfiles[1].studentId, 'a-0');
  assert.equal(result.data.dictation, data.dictation);
});

test('无效电话不产生数据，家庭孩子与原数据不变', () => {
  const data = fixture();
  const result = applyStudentProfile(data, 'a-0', 'a', {
    residence: '未填', tags: '',
    guardians: [{ id: 'g1', studentId: 'a-0', name: '监护人', phone: '12345' }],
    care: [],
  });
  assert.equal(result.error, '监护人电话需为 11 位手机号，或留空。');
  assert.equal(result.data, undefined);
  assert.deepEqual(data.dictation.children, [{ id: 'child-1' }, { id: 'child-2' }]);
});

test('空姓名联系人被忽略，空字段不伪造联系人关系', () => {
  const result = applyStudentProfile(fixture(), 'a-0', 'a', {
    residence: '未填', tags: '', guardians: [{ id: 'empty', studentId: 'a-0', name: '  ', phone: '13800138000' }], care: [],
  });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.data.guardians.map(item => item.id), ['b-g']);
});
