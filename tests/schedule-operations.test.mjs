import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/w/[token]/features/schedule/operations.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const schedule = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const config = {
  schoolYear: ' 2026秋季 ', term: ' 期中阶段 ', termStartMonth: '2026-09', termEndMonth: '2027-01', termNote: ' 校历 ',
  days: ['周一', '周二', '周三', '周四', '周五'],
  periods: [{ label: '第1节', time: ' 08:00-08:40 ' }, { label: '第2节', time: '' }],
};

function students(prefix, count = 50) {
  return Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, name: `${prefix}班${index}`, score: 0, points: 0, homework: '已交', attendance: '正常', group: index % 8 + 1 }));
}

function fixture() {
  const a = students('a'), b = students('b');
  return {
    activeClassId: 'a', students: a,
    rosterClasses: [{ id: 'a', name: '甲班', term: '原学期', students: a }, { id: 'b', name: '乙班', term: '乙班学期', students: b }],
    scheduleConfig: config,
    courses: [['语文', '数学'], ['英语', '体育'], [], [], []],
    scheduleWeeks: [{
      id: 'week-1', month: '2026-09', weekOfMonth: 1, label: '旧标签', startDate: '2026-09-01', endDate: '2026-09-07', config,
      courses: [['旧语文', '数学'], [], [], [], []],
      events: [{ id: 'event-1', date: '2026-09-03', type: '班会', title: '原活动', detail: '' }],
      focuses: [{ id: 'focus-1', date: '2026-09-04', focus: '原重点', todo: '', status: '待处理' }],
    }],
    scheduleEvents: [
      { id: 'event-1', date: '2026-09-03', type: '班会', title: '原活动', detail: '' },
      { id: 'legacy-future', date: '2026-10-10', type: '活动', title: '未入周表旧活动', detail: '' },
    ],
    dailyFocus: [
      { id: 'focus-1', date: '2026-09-04', focus: '原重点', todo: '', status: '待处理' },
      { id: 'legacy-focus', date: '2026-10-11', focus: '未入周表旧重点', todo: '', status: '待处理' },
    ],
    classSchedules: { b: { courses: [['乙班课程']], events: [{ id: 'b-event', date: '2026-09-03', type: '考试', title: '乙班考试', detail: '' }], focuses: [], weeks: [] } },
    teacherAgenda: [
      { id: 'agenda-a', classId: 'a', date: '2026-09-12', startTime: '09:00', endTime: '10:00', type: '备课', title: '甲班事项', detail: '', relatedStudentIds: ['a-0', 'a-1'], status: '待处理', createdAt: 1 },
      { id: 'agenda-b', classId: 'b', date: '2026-09-12', type: '会议', title: '乙班事项', status: '待处理', createdAt: 2 },
    ],
    workLogs: [{ id: 'log-b', classId: 'b', date: '2026-09-12', type: '会议', title: '乙班留痕', relatedStudentIds: [], createdAt: 3 }],
    dictation: { children: [{ id: 'child-1' }, { id: 'child-2' }] },
  };
}

function weekDraft(patch = {}) {
  return {
    month: '2026-09', weekOfMonth: 1, config,
    courses: [[' 新语文 ', '数学'], ['英语', '体育']],
    events: [{ id: 'event-1', date: '2026-09-03', type: '班会', title: ' 更新活动 ', detail: ' 地点 ' }],
    focuses: [{ id: 'focus-1', date: '2026-09-04', focus: ' 更新重点 ', todo: ' 跟进 ', status: '进行中' }],
    ...patch,
  };
}

test('本机日期不经UTC截取，月周范围包含月末短周', () => {
  assert.equal(schedule.localScheduleDate(new Date(2026, 8, 12, 0, 30)), '2026-09-12');
  assert.deepEqual(schedule.scheduleWeekRange('2026-09', 5), { startDate: '2026-09-29', endDate: '2026-09-30', label: '2026年9月第5周' });
  assert.equal(schedule.scheduleWeekRange('2026-02', 5), null);
});

test('保存周课表稳定更新并保留未进入周表的旧活动、他班和家庭数据', () => {
  const data = fixture(), before = structuredClone(data);
  const result = schedule.saveClassScheduleWeek(data, 'a', weekDraft());
  assert.deepEqual(data, before);
  assert.equal(result.error, undefined);
  assert.equal(result.week.id, 'week-1');
  assert.equal(result.week.courses[0][0], '新语文');
  assert.equal(result.week.events[0].title, '更新活动');
  assert.equal(result.data.scheduleEvents.some(item => item.id === 'legacy-future'), true);
  assert.equal(result.data.dailyFocus.some(item => item.id === 'legacy-focus'), true);
  assert.equal(result.data.classSchedules, data.classSchedules);
  assert.equal(result.data.dictation, data.dictation);
  assert.equal(result.data.rosterClasses[1], data.rosterClasses[1]);
});

test('六天和七天教学日可保存，重复、超限和倒置月份被拒绝', () => {
  assert.equal(schedule.saveClassScheduleWeek(fixture(), 'a', weekDraft({ config: { ...config, days: [...config.days, '周六'] } })).error, undefined);
  assert.equal(schedule.saveClassScheduleWeek(fixture(), 'a', weekDraft({ config: { ...config, days: [...config.days, '周六', '周日'] } })).error, undefined);
  assert.match(schedule.saveClassScheduleWeek(fixture(), 'a', weekDraft({ config: { ...config, days: [...config.days, '周一'] } })).error, /不能重复/);
  assert.match(schedule.saveClassScheduleWeek(fixture(), 'a', weekDraft({ config: { ...config, days: [...config.days, '周六', '周日', '第8天'] } })).error, /最多设置 7 天/);
  assert.match(schedule.saveScheduleTermConfig(fixture(), 'a', { ...config, termStartMonth: '2027-01', termEndMonth: '2026-09' }).error, /月份范围无效/);
});

test('周保存拒绝周外日期、空标题、重复标识和其他周占用的标识', () => {
  assert.match(schedule.saveClassScheduleWeek(fixture(), 'a', weekDraft({ events: [{ id: 'outside', date: '2026-09-08', type: '活动', title: '周外', detail: '' }] })).error, /当前周内/);
  assert.match(schedule.saveClassScheduleWeek(fixture(), 'a', weekDraft({ events: [{ id: 'empty', date: '2026-09-03', type: '活动', title: ' ', detail: '' }] })).error, /标题不能为空/);
  assert.match(schedule.saveClassScheduleWeek(fixture(), 'a', weekDraft({ focuses: [{ id: 'empty', date: '2026-09-03', focus: '', todo: '', status: '待处理' }] })).error, /不能同时为空/);
  const data = fixture();
  data.scheduleWeeks.push({ ...data.scheduleWeeks[0], id: 'week-2', weekOfMonth: 2, startDate: '2026-09-08', endDate: '2026-09-14', events: [{ id: 'occupied', date: '2026-09-09', type: '活动', title: '其他周', detail: '' }], focuses: [] });
  assert.match(schedule.saveClassScheduleWeek(data, 'a', weekDraft({ events: [{ id: 'occupied', date: '2026-09-03', type: '活动', title: '错误移动', detail: '' }] })).error, /属于其他周/);
});

test('学期配置只更新当前班标签并拒绝失效班级', () => {
  const data = fixture();
  const result = schedule.saveScheduleTermConfig(data, 'a', config);
  assert.equal(result.error, undefined);
  assert.equal(result.data.rosterClasses[0].term, '2026秋季 · 期中阶段');
  assert.equal(result.data.rosterClasses[1].term, '乙班学期');
  assert.match(schedule.saveScheduleTermConfig(data, 'missing', config).error, /班级已不存在/);
});

test('个人日程和工作留痕严格按班级过滤并兼容活动班旧数据', () => {
  const data = fixture();
  data.teacherAgenda.push({ ...data.teacherAgenda[0], id: 'legacy', classId: undefined });
  assert.deepEqual(schedule.teacherAgendaForClass(data, 'a').map(item => item.id), ['agenda-a', 'legacy']);
  assert.deepEqual(schedule.teacherAgendaForClass(data, 'b').map(item => item.id), ['agenda-b']);
  assert.deepEqual(schedule.workLogsForClass(data, 'a'), []);
});

test('事项保存保留多人关联、清理字段并正确维护完成时间', () => {
  const data = fixture();
  const completed = schedule.saveTeacherAgenda(data, 'a', { ...data.teacherAgenda[0], status: '已完成', title: ' 更新事项 ', relatedStudentIds: ['a-0', 'a-1', 'a-0'] }, () => 'unused', '2026-09-12T03:00:00.000Z');
  assert.equal(completed.error, undefined);
  assert.deepEqual(completed.item.relatedStudentIds, ['a-0', 'a-1']);
  assert.equal(completed.item.completedAt, '2026-09-12T03:00:00.000Z');
  const reopened = schedule.saveTeacherAgenda(completed.data, 'a', { ...completed.item, status: '进行中' }, () => 'unused', '2026-09-12T04:00:00.000Z');
  assert.equal(reopened.item.completedAt, undefined);
});

test('事项保存拒绝跨班编辑、他班学生、倒置时间和无效日期', () => {
  const data = fixture();
  assert.match(schedule.saveTeacherAgenda(data, 'a', { ...data.teacherAgenda[1], title: '越界' }, () => 'bad', '').error, /不属于当前班级/);
  assert.match(schedule.saveTeacherAgenda(data, 'a', { ...data.teacherAgenda[0], relatedStudentIds: ['b-0'] }, () => 'bad', '').error, /属于当前班级/);
  assert.match(schedule.saveTeacherAgenda(data, 'a', { ...data.teacherAgenda[0], startTime: '11:00', endTime: '10:00' }, () => 'bad', '').error, /不能早于/);
  assert.match(schedule.saveTeacherAgenda(data, 'a', { ...data.teacherAgenda[0], date: '2026-02-30' }, () => 'bad', '').error, /日期无效/);
});

test('完成并留痕在重复操作时幂等，且不修改另一班记录', () => {
  const data = fixture();
  const first = schedule.completeAgendaWithLog(data, 'a', 'agenda-a', () => 'log-a', '2026-09-12T05:00:00.000Z', 10);
  assert.equal(first.error, undefined);
  assert.equal(first.data.workLogs.filter(item => item.agendaId === 'agenda-a').length, 1);
  const second = schedule.completeAgendaWithLog(first.data, 'a', 'agenda-a', () => 'log-duplicate', '2026-09-12T06:00:00.000Z', 11);
  assert.equal(second.data.workLogs.filter(item => item.agendaId === 'agenda-a').length, 1);
  assert.equal(second.data.teacherAgenda.find(item => item.id === 'agenda-a').completedAt, '2026-09-12T05:00:00.000Z');
  assert.equal(second.data.workLogs.find(item => item.id === 'log-b'), data.workLogs[0]);
});

test('留痕保存和删除校验班级、关联事项、学生及耗时', () => {
  const data = fixture();
  const draft = { id: '', date: '2026-09-12', type: '辅导', title: ' 个别辅导 ', detail: ' 已完成 ', durationMinutes: 25, relatedStudentIds: ['a-0'], createdAt: 0 };
  const saved = schedule.saveWorkLog(data, 'a', draft, () => 'log-a');
  assert.equal(saved.error, undefined);
  assert.equal(saved.item.title, '个别辅导');
  assert.match(schedule.saveWorkLog(data, 'a', { ...draft, durationMinutes: -1 }, () => 'bad').error, /不能小于/);
  assert.match(schedule.saveWorkLog(data, 'a', { ...draft, agendaId: 'agenda-b' }, () => 'bad').error, /关联日程/);
  assert.match(schedule.removeWorkLog(data, 'a', 'log-b').error, /不属于当前班级/);
  assert.equal(schedule.removeWorkLog(saved.data, 'a', 'log-a').error, undefined);
  assert.match(schedule.removeTeacherAgenda(data, 'a', 'agenda-b').error, /不属于当前班级/);
});
