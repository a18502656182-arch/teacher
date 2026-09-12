import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/w/[token]/features/duty/operations.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const duty = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function students(prefix, count = 50) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`, studentNo: String(index + 1).padStart(3, '0'), name: `${prefix}班长姓名${index + 1}`,
    gender: index % 2 ? '男' : '女', group: index % 8 + 1, seat: index + 1,
    points: 0, homework: '已交', attendance: '正常', score: 0,
  }));
}

function fixture(countA = 50, countB = 50) {
  const a = students('甲', countA), b = students('乙', countB);
  return {
    activeClassId: 'a', students: a,
    rosterClasses: [{ id: 'a', name: '甲班', students: a }, { id: 'b', name: '乙班', students: b }],
    dutyOffset: 0, dutyJobs: duty.cloneDutyJobs(), dutyRecords: [],
    classDutySettings: {
      a: { offset: 0, jobs: duty.cloneDutyJobs() },
      b: { offset: 1, jobs: duty.cloneDutyJobs().map(job => ({ ...job, name: `乙-${job.name}` })) },
    },
    scheduleConfig: { days: ['周一', '周二', '周三', '周四', '周五', '周六'] },
    records: [{ id: 'communication-a' }],
    dictation: { children: [{ id: 'child-1' }, { id: 'child-2' }] },
  };
}

const monday = new Date(2026, 8, 7, 12, 0, 0);

test('教学日使用当前自然周的本地日期，星期别名视为同一天', () => {
  assert.equal(duty.localDutyDate(new Date(2026, 8, 7, 0, 30)), '2026-09-07');
  assert.equal(duty.dutyDateForDay('周一', monday), '2026-09-07');
  assert.equal(duty.dutyDateForDay('星期六', monday), '2026-09-12');
  assert.equal(duty.dutyDateForDay('周日', monday), '2026-09-13');
  assert.equal(duty.sameDutyDay('星期二', '周二'), true);
  assert.equal(duty.dutyDateForDay('教学日A', monday), '2026-09-07');
});

test('六天和七天教学日按有学生的小组轮换，不要求连续组号', () => {
  const data = fixture(12, 8);
  data.students.forEach((student, index) => { student.group = index < 6 ? 2 : 7; });
  data.rosterClasses[0].students = data.students;
  const groups = duty.dutyGroupsForClass(data, 'a');
  assert.deepEqual(groups.groups.map(group => group.number), [2, 7]);
  assert.equal(duty.dutyAssignmentFor(data, 'a', '周一', 'dj-floor', monday).groupNumber, 2);
  assert.equal(duty.dutyAssignmentFor(data, 'a', '周六', 'dj-floor', monday).groupNumber, 7);
  data.scheduleConfig.days.push('周日');
  assert.equal(duty.dutyAssignmentFor(data, 'a', '周日', 'dj-floor', monday).groupNumber, 2);
});

test('未分组学生被明确列出且不会使自动轮换崩溃', () => {
  const data = fixture(5, 5);
  data.students[0].group = 0;
  data.students[1].group = Number.NaN;
  data.rosterClasses[0].students = data.students;
  const result = duty.dutyGroupsForClass(data, 'a');
  assert.deepEqual(result.ungrouped.map(student => student.id), ['甲-1', '甲-2']);
  assert.equal(duty.dutyAssignmentFor(data, 'a', '周一', 'dj-floor', monday).students.length, 1);
  data.students.forEach(student => { student.group = 0; });
  assert.deepEqual(duty.dutyAssignmentFor(data, 'a', '周一', 'dj-floor', monday).students, []);
  assert.match(duty.rotateDutyWeek(data, 'a').error, /至少需要两个/);
});

test('固定学生优先于自动轮换且轮换不会覆盖固定配置', () => {
  const data = fixture(16, 8);
  data.classDutySettings.a.jobs[0].studentIds = ['甲-16'];
  data.dutyJobs = duty.cloneDutyJobs(data.classDutySettings.a.jobs);
  const before = structuredClone(data.classDutySettings.a.jobs[0]);
  assert.deepEqual(duty.dutyAssignmentFor(data, 'a', '周一', 'dj-floor', monday).students.map(student => student.id), ['甲-16']);
  const rotated = duty.rotateDutyWeek(data, 'a');
  assert.equal(rotated.error, undefined);
  assert.deepEqual(rotated.data.classDutySettings.a.jobs[0], before);
  assert.deepEqual(duty.dutyAssignmentFor(rotated.data, 'a', '周一', 'dj-floor', monday).students.map(student => student.id), ['甲-16']);
});

test('岗位保存校验必填项和固定学生班级，且严格更新目标班', () => {
  const data = fixture(8, 8);
  const beforeB = structuredClone(data.classDutySettings.b);
  assert.match(duty.saveDutyJob(data, 'a', { id: '', name: '', area: '', standard: '', enabled: true }, () => 'new').error, /请填写/);
  assert.match(duty.saveDutyJob(data, 'a', { id: '', name: '门窗', area: '后门', standard: '关好', studentIds: ['乙-1'], enabled: true }, () => 'new').error, /当前班级/);
  const saved = duty.saveDutyJob(data, 'a', { id: '', name: ' 门窗 ', area: ' 后门 ', standard: ' 关好 ', studentIds: ['甲-1'], enabled: true }, () => 'new');
  assert.equal(saved.error, undefined);
  assert.equal(saved.data.classDutySettings.a.jobs[0].name, '门窗');
  assert.deepEqual(saved.data.classDutySettings.b, beforeB);
  assert.equal(saved.data.dictation, data.dictation);
  assert.equal(saved.data.records, data.records);
});

test('手动指定只接受当前班学生并保留为日期快照', () => {
  const data = fixture(16, 8);
  assert.match(duty.assignDutyStudent(data, 'a', '周二', 'dj-floor', '乙-1', () => 'bad', monday).error, /当前班级/);
  const assigned = duty.assignDutyStudent(data, 'a', '星期二', 'dj-floor', '甲-15', () => 'record-a', monday);
  assert.equal(assigned.error, undefined);
  const record = assigned.data.dutyRecords[0];
  assert.equal(record.date, '2026-09-08');
  assert.equal(record.classId, 'a');
  assert.equal(record.assignmentSource, 'manual');
  assert.deepEqual(duty.dutyAssignmentFor(assigned.data, 'a', '周二', 'dj-floor', monday).students.map(student => student.id), ['甲-15']);
});

test('恢复自动轮换保留已存在的检查状态和备注', () => {
  let data = fixture(16, 8);
  data = duty.assignDutyStudent(data, 'a', '周一', 'dj-floor', '甲-15', () => 'record-a', monday).data;
  data.dutyRecords[0].status = '需返工';
  data.dutyRecords[0].note = '窗台仍有杂物';
  const restored = duty.assignDutyStudent(data, 'a', '星期一', 'dj-floor', undefined, () => 'unused', monday);
  assert.equal(restored.error, undefined);
  assert.equal(restored.data.dutyRecords[0].id, 'record-a');
  assert.equal(restored.data.dutyRecords[0].status, '需返工');
  assert.equal(restored.data.dutyRecords[0].note, '窗台仍有杂物');
  assert.equal(restored.data.dutyRecords[0].assignmentSource, 'auto');
  assert.notDeepEqual(restored.data.dutyRecords[0].studentIds, ['甲-15']);
});

test('检查操作保存当日负责人快照，不把自动分配误标为手动', () => {
  const data = fixture(16, 8);
  const assignment = duty.dutyAssignmentFor(data, 'a', '周三', 'dj-board', monday);
  const marked = duty.markDutyRecord(data, 'a', '星期三', 'dj-board', '已完成', () => 'record-a', monday);
  assert.equal(marked.error, undefined);
  assert.deepEqual(marked.data.dutyRecords[0].studentIds, assignment.students.map(student => student.id));
  assert.equal(marked.data.dutyRecords[0].assignmentSource, 'auto');
  assert.equal(marked.data.dutyRecords[0].date, '2026-09-09');
  assert.equal(duty.dutyAssignmentFor(marked.data, 'a', '周三', 'dj-board', monday).source, 'auto');
});

test('检查与备注写入不能越过班级边界', () => {
  const data = fixture(8, 8);
  const marked = duty.markDutyRecord(data, 'b', '周一', 'dj-floor', '已完成', () => 'record-b', monday);
  assert.equal(marked.error, undefined);
  assert.equal(marked.data.dutyRecords[0].classId, 'b');
  assert.equal(duty.dutyRecordsForClass(marked.data, 'a').length, 0);
  assert.match(duty.patchDutyRecord(marked.data, 'a', 'record-b', { note: '越界' }).error, /不属于当前班级/);
  const patched = duty.patchDutyRecord(marked.data, 'b', 'record-b', { note: '复查通过', checkedBy: '班主任' });
  assert.equal(patched.error, undefined);
  assert.equal(patched.data.dutyRecords[0].note, '复查通过');
});

test('同一岗位在不同教学日使用各自日期和唯一记录', () => {
  let data = fixture(16, 8);
  data = duty.markDutyRecord(data, 'a', '周一', 'dj-floor', '已完成', () => 'monday', monday).data;
  data = duty.markDutyRecord(data, 'a', '周二', 'dj-floor', '需返工', () => 'tuesday', monday).data;
  assert.equal(data.dutyRecords.length, 2);
  assert.deepEqual(data.dutyRecords.map(record => record.date).sort(), ['2026-09-07', '2026-09-08']);
  const changed = duty.markDutyRecord(data, 'a', '星期一', 'dj-floor', '需返工', () => 'duplicate', monday).data;
  assert.equal(changed.dutyRecords.length, 2);
  assert.equal(changed.dutyRecords.find(record => record.id === 'monday').status, '需返工');
});

test('新班级无独立配置时使用干净默认值，不继承活动班固定学生', () => {
  const data = fixture(8, 0);
  data.classDutySettings.a.jobs[0].studentIds = ['甲-1'];
  delete data.classDutySettings.b;
  data.activeClassId = 'b';
  data.students = [];
  const settings = duty.dutySettingsForClass(data, 'b');
  assert.equal(settings.offset, 0);
  assert.deepEqual(settings.jobs[0].studentIds, []);
  assert.equal(settings.jobs[0].name, '地面保洁');
});

test('停用岗位不能检查，空班不能生成虚假完成记录', () => {
  const data = fixture(0, 8);
  data.classDutySettings.a.jobs[0].enabled = false;
  data.dutyJobs = duty.cloneDutyJobs(data.classDutySettings.a.jobs);
  assert.match(duty.markDutyRecord(data, 'a', '周一', 'dj-floor', '已完成', () => 'bad', monday).error, /停用或不存在/);
  assert.match(duty.markDutyRecord(data, 'a', '周一', 'dj-board', '已完成', () => 'bad', monday).error, /没有可记录/);
});
