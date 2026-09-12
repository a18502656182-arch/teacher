import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/w/[token]/features/tools/operations.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const tools = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function students(prefix, count) {
  return Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, name: `${prefix}班${index + 1}`, score: 0, points: 0, homework: '已交', attendance: '正常', group: index % 8 + 1 }));
}

function fixture(countA = 50, countB = 50) {
  const a = students('a', countA), b = students('b', countB);
  return {
    activeClassId: 'a', students: a, dutyOffset: 0, courses: [], records: [],
    rosterClasses: [{ id: 'a', name: '甲班', grade: '三年级', term: '上学期', students: a }, { id: 'b', name: '乙班', grade: '三年级', term: '上学期', students: b }],
    attendanceRecords: [
      { id: 'leave-a', classId: 'a', date: '2026-09-12', period: '全天', studentId: 'a-0', status: '请假', note: '', createdAt: 1 },
      { id: 'leave-b', classId: 'b', date: '2026-09-12', period: '全天', studentId: 'b-0', status: '请假', note: '', createdAt: 2 },
      { id: 'removed', classId: 'a', date: '2026-09-12', period: '全天', studentId: 'removed-student', status: '请假', note: '', createdAt: 3 },
    ],
    classroomToolSessions: [
      { id: 'group-a-old', classId: 'a', date: '2026-09-10', kind: '临时分组', selectedStudentIds: ['a-0', 'a-1'], groups: [['a-0'], ['a-1']], createdAt: 10 },
      { id: 'group-b', classId: 'b', date: '2026-09-11', kind: '临时分组', selectedStudentIds: ['b-0', 'b-1'], groups: [['b-0'], ['b-1']], createdAt: 11 },
    ],
    pointEvents: [{ id: 'point-a', classId: 'a', studentId: 'a-1', delta: 1, reason: '原积分', date: '2026-09-01' }],
    dictation: { children: [{ id: 'child-1', name: '家庭孩子' }] },
  };
}

test('课堂工具日期使用本机年月日，不经UTC截取', () => {
  assert.equal(tools.localToolDate(new Date(2026, 8, 12, 0, 15)), '2026-09-12');
});

test('候选人只来自当前班，并只统计名册内当天请假学生', () => {
  const data = fixture();
  const result = tools.eligibleClassroomToolStudents(data, 'a', '2026-09-12');
  assert.deepEqual(result.excludedStudentIds, ['a-0']);
  assert.equal(result.students.length, 49);
  assert.equal(result.students.some(student => student.id === 'b-1'), false);
  assert.match(tools.eligibleClassroomToolStudents(data, 'missing', '2026-09-12').error, /班级已不存在/);
  assert.match(tools.eligibleClassroomToolStudents(data, 'a', '2026-02-30').error, /日期无效/);
});

test('随机点名按抽取顺序去重，并清理不属于当前候选人的旧轮次ID', () => {
  const data = fixture(4, 4);
  const first = tools.drawClassroomStudent(data, 'a', '2026-09-12', ['b-0', 'a-0'], () => 0);
  assert.equal(first.studentId, 'a-1');
  assert.deepEqual(first.pickedIds, ['a-1']);
  const second = tools.drawClassroomStudent(data, 'a', '2026-09-12', first.pickedIds, () => 0);
  assert.equal(second.studentId, 'a-2');
  assert.deepEqual(second.pickedIds, ['a-1', 'a-2']);
  const third = tools.drawClassroomStudent(data, 'a', '2026-09-12', second.pickedIds, () => 0);
  assert.equal(third.studentId, 'a-3');
  assert.equal(third.complete, true);
});

test('全轮完成和全员请假都有明确结果，不重复返回学生', () => {
  const data = fixture(3, 3);
  const complete = tools.drawClassroomStudent(data, 'a', '2026-09-12', ['a-1', 'a-2'], () => 0);
  assert.equal(complete.studentId, undefined);
  assert.equal(complete.complete, true);
  assert.match(complete.error, /全部抽取/);
  data.attendanceRecords.push(
    { id: 'leave-a1', classId: 'a', date: '2026-09-12', period: '全天', studentId: 'a-1', status: '请假', note: '', createdAt: 4 },
    { id: 'leave-a2', classId: 'a', date: '2026-09-12', period: '全天', studentId: 'a-2', status: '请假', note: '', createdAt: 5 },
  );
  const none = tools.drawClassroomStudent(data, 'a', '2026-09-12', [], () => 0);
  assert.equal(none.eligibleCount, 0);
  assert.match(none.error, /没有可参与/);
});

test('人数少于请求组数时只生成非空小组，且不写积分或家庭数据', () => {
  const data = fixture(4, 4), before = structuredClone(data);
  const result = tools.createTemporaryGrouping(data, 'a', '2026-09-12', 6, () => 'group-new', 20, () => 0);
  assert.equal('error' in result, false);
  assert.equal(result.session.groups.length, 3);
  assert.equal(result.session.groups.every(group => group.length === 1), true);
  assert.equal(result.session.selectedStudentIds.includes('a-0'), false);
  assert.equal(result.data.pointEvents, data.pointEvents);
  assert.equal(result.data.dictation, data.dictation);
  assert.equal(result.data.rosterClasses, data.rosterClasses);
  assert.deepEqual(data, before);
});

test('105人长名单随机分组不遗漏不重复，组间人数最多相差1', () => {
  const data = fixture(105, 50);
  data.attendanceRecords = [];
  const result = tools.createTemporaryGrouping(data, 'a', '2026-09-12', 12, () => 'group-105', 30, () => 0.37);
  assert.equal('error' in result, false);
  const ids = result.session.groups.flat();
  assert.equal(ids.length, 105);
  assert.equal(new Set(ids).size, 105);
  const sizes = result.session.groups.map(group => group.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
});

test('分组历史严格按班级过滤，旧无班级记录只归当前活动班', () => {
  const data = fixture();
  data.classroomToolSessions.push({ id: 'legacy', date: '2026-09-09', kind: '临时分组', selectedStudentIds: ['a-2', 'a-3'], groups: [['a-2'], ['a-3']], createdAt: 9 });
  assert.deepEqual(tools.classroomToolSessionsForClass(data, 'a').map(item => item.id), ['group-a-old', 'legacy']);
  assert.deepEqual(tools.classroomToolSessionsForClass(data, 'b').map(item => item.id), ['group-b']);
});

test('复制文本按历史快照顺序输出，移除学生不泄露其他班姓名', () => {
  const data = fixture();
  data.classroomToolSessions[0].groups = [['a-1', 'removed-student'], ['a-2']];
  const result = tools.formatTemporaryGrouping(data, 'a', 'group-a-old');
  assert.equal(result.text, '第1组：a班2、已移除学生\n第2组：a班3');
  assert.match(tools.formatTemporaryGrouping(data, 'a', 'group-b').error, /不属于当前班级/);
});

test('非法分组数、人数不足和重复记录ID都拒绝写入', () => {
  const data = fixture(2, 2);
  assert.match(tools.createTemporaryGrouping(data, 'a', '2026-09-12', 1, () => 'bad', 1).error, /2 至 12/);
  assert.match(tools.createTemporaryGrouping(data, 'a', '2026-09-12', 2, () => 'bad', 1).error, /至少需要 2 名/);
  const enough = fixture(3, 3);
  assert.match(tools.createTemporaryGrouping(enough, 'a', '2026-09-12', 2, () => 'group-a-old', 1).error, /标识冲突/);
});
