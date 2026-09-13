import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const temp = await mkdtemp(path.join(tmpdir(), 'classroom-business-read-models-'));
after(() => rm(temp, { recursive: true, force: true }));

async function compile(sourcePath, targetName, replacements = []) {
  const source = await readFile(new URL(sourcePath, import.meta.url), 'utf8');
  let output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText;
  for (const [from, to] of replacements) output = output.replaceAll(from, to);
  await writeFile(path.join(temp, targetName), output);
}

await compile('../app/w/[token]/features/schedule/read-model.ts', 'schedule-read-model.mjs');
await compile('../app/w/[token]/features/growth/time-range.ts', 'growth-time-range.mjs');
await compile('../app/w/[token]/features/scores/operations.ts', 'score-operations.mjs');
await compile('../app/w/[token]/features/scores/read-model.ts', 'score-read-model.mjs', [["'./operations'", "'./score-operations.mjs'"]]);

const schedule = await import(pathToFileURL(path.join(temp, 'schedule-read-model.mjs')));
const growth = await import(pathToFileURL(path.join(temp, 'growth-time-range.mjs')));
const scores = await import(pathToFileURL(path.join(temp, 'score-read-model.mjs')));

const scheduleConfig = {
  schoolYear: '2026—2027学年', term: '第一学期', termStartMonth: '2026-09', termEndMonth: '2027-01', termNote: '',
  days: ['周一', '周二', '周三', '周四', '周五', '周六'],
  periods: [{ label: '第1节', time: '08:00-08:40' }, { label: '第2节', time: '08:50-09:30' }],
};

test('日程默认值使用本机日期，学期月份与月末短周保持原计算', () => {
  const now = new Date(2026, 8, 13, 0, 30);
  assert.equal(schedule.currentLocalDate(now), '2026-09-13');
  assert.equal(schedule.createDefaultScheduleConfig(now).termStartMonth, '2026-09');
  assert.deepEqual(schedule.scheduleTermMonths(scheduleConfig, now), ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
  assert.deepEqual(schedule.scheduleWeekDates('2026-09', 5), { startDate: '2026-09-29', endDate: '2026-09-30', label: '2026年9月第5周' });
  assert.equal(schedule.scheduleWeeksInMonth(''), 4);
});

test('日程只按教学日和节次投影，不修改或补造输入课程内容', () => {
  const source = [[' 语文 ', '数学'], ['英语'], ['体育', '美术'], ['科学'], [], ['社团'], ['不应进入']];
  const before = structuredClone(source);
  const normalized = schedule.normalizeScheduleCourses(source, scheduleConfig);
  assert.deepEqual(source, before);
  assert.equal(normalized.length, 6);
  assert.deepEqual(normalized[0], [' 语文 ', '数学']);
  assert.deepEqual(normalized[1], ['英语', '']);
});

function scoreFixture() {
  const students = [
    { id: 'a-0', name: '甲零分', score: 0, points: 0, homework: '已交', attendance: '正常' },
    { id: 'a-1', name: '甲未录', score: 0, points: 0, homework: '已交', attendance: '正常' },
    { id: 'b-0', name: '乙同名', score: 0, points: 0, homework: '已交', attendance: '正常' },
  ];
  const exam = {
    id: 'exam-a', classId: 'a', title: '期中', date: '2026-09-10', subjects: ['语文', '数学'],
    scores: { 'a-0': { 语文: 0 }, 'a-1': {} }, subjectMaxScores: { 语文: 120, 数学: 100 }, followUpStudentIds: ['a-0'],
  };
  return { students, exam };
}

test('成绩读取区分真实零分和未录入，未录入不生成跟进结论', () => {
  const { students, exam } = scoreFixture();
  const rows = scores.scoreRowsFor(exam, students.slice(0, 2), [{ id: 'reflection-a', examId: 'exam-a', studentId: 'a-0' }]);
  assert.equal(rows[0].enteredCount, 1);
  assert.equal(rows[0].average, 0);
  assert.equal(rows[0].followUp, true);
  assert.equal(rows[0].hasReflection, true);
  assert.equal(rows[1].enteredCount, 0);
  assert.equal(rows[1].advice, '成绩尚未录入，暂不生成跟进结论。');
  assert.equal(rows[1].weakSubject, '待录入');
});

test('成绩科目、满分和区间派生保留去重、自定义及零值边界', () => {
  const { students, exam } = scoreFixture();
  exam.scoreRanges = { 语文: [{ id: 'custom', label: '自定义', min: 0, max: 120 }] };
  assert.deepEqual(scores.parseScoreSubjects('语文， 数学、语文 English'), ['语文', '数学', 'English']);
  assert.equal(scores.subjectMaxScore(exam, '总分'), 220);
  assert.deepEqual(scores.scoreRangesFor(exam, '语文'), exam.scoreRanges.语文);
  assert.deepEqual(scores.defaultScoreRanges(10), [
    { id: 'excellent', label: '优秀', min: 9, max: 10 },
    { id: 'good', label: '良好', min: 8, max: 8 },
    { id: 'pass', label: '及格', min: 6, max: 7 },
    { id: 'fail', label: '不及格', min: 0, max: 5 },
  ]);
  assert.equal(scores.scoreValue(exam, students[0], '语文'), 0);
});

test('成长时间范围在固定本机时间下处理日期、相对日期和学期边界', () => {
  const now = new Date(2026, 8, 13, 12, 0);
  const absolute = growth.growthTimestamp('2026年9月1日', undefined, now);
  assert.equal(absolute, new Date(2026, 8, 1).getTime());
  assert.equal(growth.growthTimestamp('昨天', undefined, now), now.getTime() - 86400000);
  assert.equal(growth.growthTimestamp('无日期', undefined, now), null);
  assert.equal(growth.isInGrowthRange(now.getTime() - 7 * 86400000, '近7天', undefined, now), true);
  assert.equal(growth.isInGrowthRange(now.getTime() - 31 * 86400000, '近30天', undefined, now), false);
  assert.equal(growth.isInGrowthRange(new Date(2026, 7, 31).getTime(), '本学期', new Date(2026, 8, 1).getTime(), now), false);
});
