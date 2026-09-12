import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function load(feature) {
  const source = await readFile(new URL(`../app/w/[token]/features/${feature}/operations.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const growth = await load('growth');
const health = await load('health');

function fixture() {
  const a = [{ id: 'a-0', name: '合成甲' }, { id: 'a-1', name: '合成乙' }];
  const b = [{ id: 'b-0', name: '合成丙' }];
  return {
    activeClassId: 'a', students: a, rosterClasses: [{ id: 'a', students: a }, { id: 'b', students: b }],
    growthEvidence: [
      { id: 'a-old', classId: 'a', studentId: 'a-0', date: '2026-09-10', type: '日常', title: '原记录', content: '保留' },
      { id: 'wrong-class', classId: 'b', studentId: 'a-0', date: '2026-09-10', type: '日常', title: '显式他班', content: '不能显示' },
    ],
    careProfiles: [
      { id: 'a-care', classId: 'a', studentId: 'a-0', category: '健康提醒', severity: '一般', instruction: '保留', visibleScope: '班主任' },
      { id: 'b-care', classId: 'b', studentId: 'b-0', category: '座位照护', severity: '重要', instruction: '他班', visibleScope: '班主任' },
    ],
    guardians: [
      { id: 'a-secondary', classId: 'a', studentId: 'a-0', name: '联系人二', relation: '父亲', emergencyPriority: 1 },
      { id: 'a-primary', classId: 'a', studentId: 'a-0', name: '联系人一', relation: '母亲', isPrimary: true, emergencyPriority: 9 },
      { id: 'b-primary', classId: 'b', studentId: 'b-0', name: '他班联系人', relation: '母亲', isPrimary: true },
    ],
    dictation: { children: [{ id: 'child-1' }, { id: 'child-2' }], tasks: [] },
  };
}

test('成长事实写入当前班快照并保留另一班与家庭数据', () => {
  const data = fixture(), before = structuredClone(data);
  const result = growth.addGrowthEvidence(data, 'a', 'a-1', { date: '2026-09-12', type: ' 进步 ', title: ' 主动表达 ', content: ' 清楚说明思路 ', followUp: ' 下周观察 ' }, () => 'new-growth', 123);
  assert.deepEqual(data, before);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.item, { id: 'new-growth', classId: 'a', studentId: 'a-1', date: '2026-09-12', type: '进步', title: '主动表达', content: '清楚说明思路', followUp: '下周观察', source: '班主任补充', createdAt: 123 });
  assert.equal(result.data.growthEvidence[1], data.growthEvidence[0]);
  assert.equal(result.data.dictation, data.dictation);
});

test('成长事实拒绝另一班、空字段并按显式classId隔离旧记录', () => {
  const data = fixture();
  assert.equal(growth.addGrowthEvidence(data, 'a', 'b-0', { date: '2026-09-12', type: '日常', title: '标题', content: '事实', followUp: '' }, () => 'bad').error, '所选学生不属于当前班级。');
  assert.equal(growth.addGrowthEvidence(data, 'a', 'a-0', { date: '', type: '日常', title: '', content: '', followUp: '' }, () => 'bad').error, '请填写日期、标题和具体事实。');
  assert.deepEqual(growth.growthEvidenceForStudent(data, 'a', 'a-0').map(item => item.id), ['a-old']);
});

test('照护默认日期使用本机年月日，不经过UTC字符串截取', () => {
  assert.equal(health.localCareDate(new Date(2026, 8, 12, 0, 30)), '2026-09-12');
});

test('照护登记只写当前班学生并清洗最小行动字段', () => {
  const data = fixture(), before = structuredClone(data);
  const result = health.saveCareProfile(data, 'a', { id: '', studentId: 'a-1', category: '其他', severity: '重要', summary: ' 靠前安排 ', instruction: ' 提前提醒 ', contraindication: ' 避免强光 ', customCategory: ' 临时照护 ', actionContexts: [' 体育活动 ', '体育活动', '', '自定义'], reviewedAt: '2026-09-12' }, () => 'new-care');
  assert.deepEqual(data, before);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.profile, { id: 'new-care', classId: 'a', studentId: 'a-1', category: '其他', severity: '重要', summary: '靠前安排', instruction: '提前提醒', contraindication: '避免强光', customCategory: '临时照护', actionContexts: ['体育活动', '自定义'], reviewedAt: '2026-09-12', visibleScope: '班主任' });
  assert.equal(result.data.careProfiles[1], data.careProfiles[0]);
  assert.equal(result.data.careProfiles[2], data.careProfiles[1]);
  assert.equal(result.data.dictation, data.dictation);
});

test('照护保存拒绝另一班学生和不属于当前班的编辑记录', () => {
  const data = fixture();
  const draft = { id: '', studentId: 'b-0', category: '健康提醒', severity: '一般', instruction: '', actionContexts: [] };
  assert.equal(health.saveCareProfile(data, 'a', draft, () => 'bad').error, '所选学生不属于当前班级。');
  assert.match(health.saveCareProfile(data, 'a', { ...draft, id: 'b-care', studentId: 'a-0' }, () => 'bad').error, /不属于当前班级/);
});

test('照护删除只接受当前班记录', () => {
  const data = fixture();
  assert.equal(health.removeCareProfile(data, 'a', 'b-care'), data);
  const next = health.removeCareProfile(data, 'a', 'a-care');
  assert.deepEqual(next.careProfiles.map(item => item.id), ['b-care']);
});

test('监护人同步优先当前班主联系人，再按紧急顺序', () => {
  const data = fixture();
  assert.equal(health.primaryGuardianForStudent(data.guardians, 'a', 'a-0').id, 'a-primary');
  assert.equal(health.primaryGuardianForStudent(data.guardians.filter(item => !item.isPrimary), 'a', 'a-0').id, 'a-secondary');
  assert.equal(health.primaryGuardianForStudent(data.guardians, 'a', 'b-0'), undefined);
});
