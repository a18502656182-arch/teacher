import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/w/[token]/features/weekly/operations.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const weekly = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function fixture(count = 50) {
  const roster = prefix => Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    name: index === 0 ? '同名学生' : `${prefix}班${index}`,
    score: 100,
    points: 0,
    homework: index === 3 ? '未交' : '已交',
    attendance: index === 4 ? '缺勤' : '正常',
    group: index % 8 + 1,
  }));
  const a = roster('a'), b = roster('b');
  return {
    activeClassId: 'a',
    students: a,
    rosterClasses: [{ id: 'a', name: '甲班', students: a }, { id: 'b', name: '乙班', students: b }],
    homeworkTasks: [
      { id: 'a-task', classId: 'a', date: '2026-09-09', subject: '语文', title: '甲班作业', statuses: { 'a-0': '已交', 'a-1': '未交' } },
      { id: 'b-task', classId: 'b', date: '2026-09-09', subject: '语文', title: '乙班作业', statuses: { 'b-0': '未交' } },
    ],
    pointEvents: [],
    scoreExams: [],
    attendanceRecords: [],
    weeklyReports: [
      { id: 'a-report', classId: 'a', weekStart: '2026-09-07', weekEnd: '2026-09-13', edition: '家长版', title: '甲班周报', content: '原正文', nextFocus: '', status: '草稿', createdAt: '2026-09-10T00:00:00.000Z', updatedAt: '2026-09-10T00:00:00.000Z' },
      { id: 'b-report', classId: 'b', weekStart: '2026-09-07', weekEnd: '2026-09-13', edition: '家长版', title: '乙班周报', content: '他班正文', nextFocus: '', status: '草稿', createdAt: '2026-09-10T00:00:00.000Z', updatedAt: '2026-09-10T00:00:00.000Z' },
      { id: 'legacy-report', weekStart: '2026-09-07', weekEnd: '2026-09-13', edition: '教师版', content: '未归属旧数据', nextFocus: '', createdAt: '2026-09-10T00:00:00.000Z', updatedAt: '2026-09-10T00:00:00.000Z' },
    ],
    records: [],
    dictation: { children: [{ id: 'child-1' }, { id: 'child-2' }], tasks: [] },
  };
}

function reportDraft(patch = {}) {
  return { weekStart: '2026-09-07', weekEnd: '2026-09-13', edition: '教师版', title: ' 教师周报 ', content: ' 周报正文 ', nextFocus: ' 下周行动 ', ...patch };
}

test('周报列表只返回显式属于当前班的报告', () => {
  const data = fixture();
  assert.deepEqual(weekly.weeklyReportsForClass(data, 'a').map(item => item.id), ['a-report']);
  assert.deepEqual(weekly.weeklyReportsForClass(data, 'b').map(item => item.id), ['b-report']);
});

test('保存草稿清理字段、保持输入不可变并保留另一班与家庭数据', () => {
  const data = fixture(), before = structuredClone(data);
  const result = weekly.saveWeeklyReport(data, 'a', reportDraft(), '草稿', () => 'teacher-report', '2026-09-12T01:00:00.000Z');
  assert.deepEqual(data, before);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.report, {
    id: 'teacher-report', classId: 'a', weekStart: '2026-09-07', weekEnd: '2026-09-13', edition: '教师版', title: '教师周报', status: '草稿', content: '周报正文', nextFocus: '下周行动', createdAt: '2026-09-12T01:00:00.000Z', updatedAt: '2026-09-12T01:00:00.000Z', archivedAt: undefined,
  });
  assert.equal(result.data.weeklyReports.find(item => item.id === 'b-report'), data.weeklyReports[1]);
  assert.equal(result.data.dictation, data.dictation);
});

test('同班同周同版本稳定更新，完成归档写入归档时间', () => {
  const data = fixture();
  const result = weekly.saveWeeklyReport(data, 'a', reportDraft({ id: 'new-client-id', edition: '家长版', content: '更新后的正文' }), '已归档', () => 'unused', '2026-09-12T02:00:00.000Z');
  assert.equal(result.error, undefined);
  assert.equal(result.report.id, 'a-report');
  assert.equal(result.report.createdAt, '2026-09-10T00:00:00.000Z');
  assert.equal(result.report.archivedAt, '2026-09-12T02:00:00.000Z');
  assert.equal(result.data.weeklyReports.filter(item => item.classId === 'a' && item.edition === '家长版').length, 1);
});

test('保存拒绝跨班编辑、重复目标、空正文和无效日期', () => {
  const data = fixture();
  assert.match(weekly.saveWeeklyReport(data, 'a', reportDraft({ id: 'b-report' }), '草稿', () => 'bad').error, /不属于当前班级/);
  data.weeklyReports.push({ ...data.weeklyReports[0], id: 'a-other', edition: '教师版' });
  assert.match(weekly.saveWeeklyReport(data, 'a', reportDraft({ id: 'a-report' }), '草稿', () => 'bad').error, /已有另一份周报/);
  assert.match(weekly.saveWeeklyReport(fixture(), 'a', reportDraft({ content: ' ' }), '草稿', () => 'bad').error, /正文不能为空/);
  assert.match(weekly.saveWeeklyReport(fixture(), 'a', reportDraft({ weekStart: '2026-02-30' }), '草稿', () => 'bad').error, /日期范围无效/);
  assert.match(weekly.saveWeeklyReport(fixture(), 'missing', reportDraft(), '草稿', () => 'bad').error, /班级已不存在/);
});

test('作业指标只统计任务内真实逐生状态，不用学生当前状态填补历史', () => {
  const data = fixture();
  const metrics = weekly.weeklyHomeworkMetrics([data.homeworkTasks[0]], data.rosterClasses[0].students);
  assert.deepEqual(metrics, { expected: 50, recorded: 2, submitted: 1, missing: 1, fixing: 0, completionRate: 50 });
});

test('积分证据严格按班级、学生和有效日期范围过滤', () => {
  const data = fixture();
  data.pointEvents = [
    { id: 'inside', classId: 'a', studentId: 'a-0', reason: '主动发言', delta: 2, date: '2026-09-08' },
    { id: 'legacy-inside', studentId: 'a-1', reason: '作业认真', delta: 1, date: '2026-09-10' },
    { id: 'undated', classId: 'a', studentId: 'a-0', reason: '无日期', delta: 9, date: '' },
    { id: 'outside', classId: 'a', studentId: 'a-0', reason: '范围外', delta: 9, date: '2026-09-14' },
    { id: 'other-class', classId: 'b', studentId: 'b-0', reason: '他班', delta: 9, date: '2026-09-08' },
  ];
  const events = weekly.weeklyPointEventsForClass(data, 'a', data.rosterClasses[0].students, '2026-09-07', '2026-09-13');
  assert.deepEqual(events.map(item => item.id), ['inside', 'legacy-inside']);
});

test('成长与沟通按周合并，并排除沟通双写副本、他班和无日期记录', () => {
  const data = fixture();
  data.growthEvidence = [
    { id: 'growth', classId: 'a', studentId: 'a-0', date: '2026-09-08', type: '表扬记录', title: '进步', content: '主动整理图书' },
    { id: 'duplicate', classId: 'a', studentId: 'a-0', date: '2026-09-08', type: '家校沟通', title: '旧副本', content: '不应重复', source: '家校沟通' },
    { id: 'other', classId: 'b', studentId: 'b-0', date: '2026-09-08', type: '表扬记录', title: '他班', content: '他班内容' },
    { id: 'undated', classId: 'a', studentId: 'a-1', date: '', type: '观察记录', title: '无日期', content: '无日期内容' },
  ];
  const records = [
    { id: 'record', classId: 'a', studentId: 'a-1', student: 'a班1', type: '家校沟通', content: '家长已反馈', date: '2026-09-09' },
    { id: 'old', classId: 'a', studentId: 'a-2', student: 'a班2', type: '家校沟通', content: '上周记录', date: '2026-09-06' },
  ];
  const rows = weekly.weeklyActivityRows(data, 'a', data.rosterClasses[0].students, records, '2026-09-07', '2026-09-13');
  assert.deepEqual(rows.map(item => [item.id, item.source]), [['record:record', '家校沟通'], ['growth:growth', '成长档案']]);
});

test('正向名单聚合同一学生且不把扣分当表扬', () => {
  const students = fixture().rosterClasses[0].students;
  const rows = weekly.weeklyPositiveRows([
    { studentId: 'a-0', delta: 2, reason: '主动发言' },
    { studentId: 'a-0', delta: 3, reason: '作业认真' },
    { studentId: 'a-1', delta: -5, reason: '纪律提醒' },
  ], students);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].student.id, 'a-0');
  assert.equal(rows[0].delta, 5);
  assert.equal(rows[0].reason, '主动发言');
});

test('跟进只使用本周真实作业、标准化考试和考勤记录', () => {
  const data = fixture();
  data.scoreExams = [
    { id: 'a-exam', classId: 'a', title: '甲班测验', date: '2026-09-10', subjects: ['数学'], subjectMaxScores: { 数学: 50 }, scores: { 'a-0': { 数学: 35 }, 'a-1': { 数学: 50 }, 'a-3': {} } },
    { id: 'old-exam', classId: 'a', title: '上周测验', date: '2026-09-06', subjects: ['数学'], subjectMaxScores: { 数学: 100 }, scores: { 'a-2': { 数学: 0 } } },
    { id: 'b-exam', classId: 'b', title: '乙班测验', date: '2026-09-10', subjects: ['数学'], scores: { 'b-0': { 数学: 0 } } },
  ];
  data.attendanceRecords = [
    { id: 'absence', classId: 'a', studentId: 'a-2', date: '2026-09-11', period: '全天', status: '缺勤' },
    { id: 'normal', classId: 'a', studentId: 'a-3', date: '2026-09-11', period: '全天', status: '正常' },
    { id: 'other', classId: 'b', studentId: 'b-0', date: '2026-09-11', period: '全天', status: '缺勤' },
  ];
  const rows = weekly.weeklyFollowRows(data, 'a', data.rosterClasses[0].students, [data.homeworkTasks[0]], '2026-09-07', '2026-09-13');
  const byId = new Map(rows.map(item => [item.student.id, item.reasons]));
  assert.deepEqual(byId.get('a-0'), [{ kind: '成绩', text: '本周考试已录得分率 70%' }]);
  assert.deepEqual(byId.get('a-1'), [{ kind: '作业', text: '1 项作业待处理' }]);
  assert.deepEqual(byId.get('a-2'), [{ kind: '考勤', text: '缺勤1次' }]);
  assert.equal(byId.has('a-3'), false, '缺少本周成绩和正常考勤不应借用学生当前汇总形成跟进');
  assert.equal([...byId].some(([id]) => id.startsWith('b-')), false);
});

test('日期范围只接受真实本地日历日期并包含首尾日', () => {
  assert.equal(weekly.isDatedWithin('2026-09-07', '2026-09-07', '2026-09-13'), true);
  assert.equal(weekly.isDatedWithin('2026-09-13', '2026-09-07', '2026-09-13'), true);
  assert.equal(weekly.isDatedWithin('2026-02-30', '2026-02-01', '2026-02-28'), false);
  assert.equal(weekly.isDatedWithin('', '2026-09-07', '2026-09-13'), false);
});
