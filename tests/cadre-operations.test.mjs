import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/w/[token]/features/cadres/operations.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const cadres = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function students(prefix, groups = [1, 2, 4], count = 50) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`, studentNo: String(index + 1).padStart(3, '0'), name: `${prefix}班长姓名${index + 1}`,
    gender: index % 2 ? '男' : '女', group: groups[index % groups.length], seat: index + 1,
    points: 0, homework: '已交', attendance: '正常', score: 0,
  }));
}

function fixture() {
  const a = students('甲'), b = students('乙', [3, 7]);
  return {
    activeClassId: 'a', students: a,
    rosterClasses: [{ id: 'a', name: '甲班', term: '2026秋', students: a }, { id: 'b', name: '乙班', term: '2026秋', students: b }],
    dutyOffset: 0, records: [{ id: 'communication-a' }],
    cadres: [
      { id: 'a-monitor', classId: 'a', role: '班长', studentId: '甲-1', duty: '维护班级日常', scope: '班级常规', term: '2026秋', status: '在任', weeklyScore: 5, summary: '' },
      { id: 'a-group-1', classId: 'a', role: '第1组组长', studentId: '甲-1', duty: '收发作业', scope: '小组管理', groupNumber: 1, term: '', status: '试用', weeklyScore: 4, summary: '' },
      { id: 'b-monitor', classId: 'b', role: '班长', studentId: '乙-1', duty: '维护班级日常', scope: '班级常规', term: '2026秋', status: '在任', weeklyScore: 5, summary: '' },
      { id: 'legacy-b', role: '学习委员', studentId: '乙-2', duty: '学习管理', scope: '学习管理', term: '', status: '轮换', weeklyScore: 3, summary: '' },
    ],
    dictation: { children: [{ id: 'child-1' }, { id: 'child-2' }] },
  };
}

test('岗位与学生严格按班级读取，旧岗位按唯一学生归属解析', () => {
  const data = fixture();
  assert.equal(cadres.cadreStudentsForClass(data, 'a').length, 50);
  assert.deepEqual(cadres.cadreRolesForClass(data, 'a').map(role => role.id), ['a-monitor', 'a-group-1']);
  assert.deepEqual(cadres.cadreRolesForClass(data, 'b').map(role => role.id), ['b-monitor', 'legacy-b']);
});

test('小组编号只使用正整数并支持不连续组号', () => {
  const data = fixture();
  data.rosterClasses[0].students[0].group = 0;
  data.rosterClasses[0].students[1].group = -2;
  assert.deepEqual(cadres.cadreGroupNumbersForClass(data, 'a'), [1, 2, 4]);
  assert.equal(cadres.cadreRoleGroupNumber(data, 'a', data.cadres[1]), 1);
  assert.equal(cadres.cadreRoleKind({ role: '第4组组长', scope: '', groupNumber: undefined }), '小组长');
});

test('班委候选人为全班，小组长候选人只来自目标小组', () => {
  const data = fixture();
  assert.equal(cadres.cadreCandidatesForRole(data, 'a', data.cadres[0]).length, 50);
  const candidates = cadres.cadreCandidatesForRole(data, 'a', data.cadres[1]);
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every(student => student.group === 1));
});

test('未设置组长统计使用岗位小组，不拿任意同组学生误判', () => {
  const data = fixture();
  assert.deepEqual(cadres.missingCadreGroups(data, 'a'), [2, 4]);
  data.cadres.push({ id: 'legacy-group-4', classId: 'a', role: '第4组组长', studentId: '甲-3', duty: '小组协作', scope: '', weeklyScore: 3 });
  assert.deepEqual(cadres.missingCadreGroups(data, 'a'), [2]);
});

test('班委可先建空岗，空任期和长职责原样保存且不影响其他数据', () => {
  const data = fixture();
  const longDuty = '负责班级常规、集会队列、同学建议收集与每周反馈。'.repeat(20);
  const result = cadres.saveCadreRole(data, 'a', { id: '', role: ' 新班委岗位 ', studentId: '', duty: ` ${longDuty} `, scope: '班级管理', term: ' ', status: '在任', weeklyScore: 4, summary: ' ' }, () => 'new-role');
  assert.equal(result.error, undefined);
  assert.equal(result.role.classId, 'a');
  assert.equal(result.role.studentId, '');
  assert.equal(result.role.term, '');
  assert.equal(result.role.duty, longDuty);
  assert.equal(result.data.dictation, data.dictation);
  assert.equal(result.data.records, data.records);
  assert.equal(result.data.cadres.find(role => role.id === 'b-monitor'), data.cadres.find(role => role.id === 'b-monitor'));
});

test('小组长必须选择当前班已有小组及该组学生', () => {
  const data = fixture();
  const draft = { id: '', role: '第2组组长', studentId: '', duty: '负责收发作业', scope: '小组管理', groupNumber: 2, term: '', status: '在任', weeklyScore: 4, summary: '' };
  assert.match(cadres.saveCadreRole(data, 'a', draft, () => 'bad').error, /第2组/);
  assert.match(cadres.saveCadreRole(data, 'a', { ...draft, groupNumber: 9, role: '第9组组长', studentId: '甲-1' }, () => 'bad').error, /已有的小组/);
  assert.match(cadres.saveCadreRole(data, 'a', { ...draft, studentId: '乙-1' }, () => 'bad').error, /当前班级/);
  assert.match(cadres.saveCadreRole(data, 'a', { ...draft, studentId: '甲-1' }, () => 'bad').error, /第2组/);
  const member = data.rosterClasses[0].students.find(student => student.group === 2);
  assert.equal(cadres.saveCadreRole(data, 'a', { ...draft, studentId: member.id }, () => 'group-2').error, undefined);
});

test('更新不能越班或改写其他岗位，评分和状态必须有效', () => {
  const data = fixture();
  const input = { ...data.cadres[0], role: '执行班长', weeklyScore: 6 };
  assert.match(cadres.saveCadreRole(data, 'a', input, () => 'unused').error, /1 至 5/);
  assert.match(cadres.saveCadreRole(data, 'a', { ...input, weeklyScore: 4, status: '未知' }, () => 'unused').error, /有效/);
  assert.match(cadres.saveCadreRole(data, 'a', { ...data.cadres[2], role: '越界修改' }, () => 'unused').error, /不属于/);
  const saved = cadres.saveCadreRole(data, 'a', { ...data.cadres[0], role: '执行班长', weeklyScore: 4 }, () => 'unused');
  assert.equal(saved.data.cadres.find(role => role.id === 'a-monitor').role, '执行班长');
  assert.equal(saved.data.cadres.find(role => role.id === 'b-monitor').role, '班长');
});

test('删除严格按班级，重复编号和不存在班级均会拒绝', () => {
  const data = fixture();
  assert.match(cadres.removeCadreRole(data, 'a', 'b-monitor').error, /不属于/);
  const removed = cadres.removeCadreRole(data, 'a', 'a-monitor');
  assert.equal(removed.error, undefined);
  assert.ok(!removed.data.cadres.some(role => role.id === 'a-monitor'));
  assert.match(cadres.saveCadreRole(data, 'missing', { id: '', role: '班长', studentId: '', duty: '管理', weeklyScore: 4 }, () => 'x').error, /不存在/);
  assert.match(cadres.saveCadreRole(data, 'a', { id: '', role: '班长', studentId: '', duty: '管理', weeklyScore: 4 }, () => 'b-monitor').error, /编号冲突/);
});

test('聘书文案不把待任命岗位伪装成真实任命', () => {
  const data = fixture();
  assert.match(cadres.cadreAppointmentText(data, 'a', data.cadres[0]), /甲班长姓名1/);
  const pending = { ...data.cadres[0], studentId: '' };
  assert.equal(cadres.cadreAppointmentText(data, 'a', pending), '班长尚未任命学生。岗位职责：维护班级日常');
});

test('空班保持空岗位且班委空岗仍可建立，小组长不能虚构小组', () => {
  const data = fixture();
  data.students = [];
  data.rosterClasses[0].students = [];
  data.cadres = data.cadres.filter(role => role.classId !== 'a');
  assert.deepEqual(cadres.cadreRolesForClass(data, 'a'), []);
  assert.deepEqual(cadres.cadreGroupNumbersForClass(data, 'a'), []);
  assert.equal(cadres.saveCadreRole(data, 'a', { id: '', role: '班长', studentId: '', duty: '协助管理', scope: '班级管理', status: '在任', weeklyScore: 4 }, () => 'empty-role').error, undefined);
  assert.match(cadres.saveCadreRole(data, 'a', { id: '', role: '第1组组长', studentId: '', duty: '小组管理', scope: '小组管理', groupNumber: 1, status: '在任', weeklyScore: 4 }, () => 'bad').error, /已有的小组/);
});
