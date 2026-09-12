import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function load(relativePath, replacements = {}) {
  let source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  for (const [from, to] of Object.entries(replacements)) source = source.replace(from, to);
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const points = await load('../app/w/[token]/features/points/operations.ts');
const catalogSource = await readFile(new URL('../app/w/[token]/features/rules/catalog.ts', import.meta.url), 'utf8');
const { outputText: catalogOutput } = ts.transpileModule(catalogSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const catalogUrl = `data:text/javascript;base64,${Buffer.from(catalogOutput).toString('base64')}`;
const rules = await load('../app/w/[token]/features/rules/operations.ts', { "'./catalog'": `'${catalogUrl}'` });
const { defaultPointRules } = await import(catalogUrl);

function fixture(count = 50) {
  const roster = prefix => Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, name: `合成${index}`, points: 60 }));
  const a = roster('a'), b = roster('b');
  return {
    activeClassId: 'a', students: a, rosterClasses: [{ id: 'a', students: a }, { id: 'b', students: b }],
    pointEvents: [{ id: 'b-event', classId: 'b', studentId: 'b-0', ruleId: 'rule', scene: '课堂', reason: '他班', delta: 2, date: '2026-09-12' }],
    pointRules: [{ id: 'rule', scene: '课堂', title: '主动表达', reason: '说清思路', delta: 2, owner: '班主任', enabled: true, level: '自定义' }],
    pointRulesInitialized: true,
    dictation: { children: [{ id: 'child-1' }, { id: 'child-2' }], tasks: [] },
  };
}

test('两班各50人：批量记分只更新当前班并保留家庭数据', () => {
  const data = fixture(), before = structuredClone(data); let id = 0;
  const next = points.applyPointEvents(data, 'a', ['a-0', 'a-49', 'b-0', 'missing'], data.pointRules[0], 3, ' 主动讲题 ', ' 王老师 ', '2026-09-12 10:00', () => `event-${++id}`);
  assert.deepEqual(data, before);
  assert.equal(next.students[0].points, 63);
  assert.equal(next.students[49].points, 63);
  assert.equal(next.rosterClasses[0].students[49].points, 63);
  assert.equal(next.rosterClasses[1], data.rosterClasses[1]);
  assert.equal(next.dictation, data.dictation);
  assert.equal(next.pointEvents.length, 3);
  assert.deepEqual(next.pointEvents.slice(0, 2).map(event => ({ classId: event.classId, studentId: event.studentId, ruleId: event.ruleId, reason: event.reason, operator: event.operator })), [
    { classId: 'a', studentId: 'a-0', ruleId: 'rule', reason: '说清思路｜主动讲题', operator: '王老师' },
    { classId: 'a', studentId: 'a-49', ruleId: 'rule', reason: '说清思路｜主动讲题', operator: '王老师' },
  ]);
});

test('105人全选去重后逐人建立快照，零分与非法班级不写入', () => {
  const data = fixture(105), ids = [...data.students.map(student => student.id), 'a-0']; let id = 0;
  const next = points.applyPointEvents(data, 'a', ids, data.pointRules[0], -1, '', '', '2026-09-12', () => `event-${++id}`);
  assert.equal(id, 105);
  assert.equal(next.students.every(student => student.points === 59), true);
  assert.equal(next.pointEvents.length, 106);
  assert.equal(points.applyPointEvents(data, 'a', ids, data.pointRules[0], 0, '', '', '', () => 'bad'), data);
  assert.equal(points.applyPointEvents(data, 'missing-class', ['a-0'], data.pointRules[0], 1, '', '', '', () => 'bad'), data);
});

test('撤销只接受当前班事件，旧事件仍按学生归属兼容', () => {
  const data = fixture();
  const withCurrent = points.applyPointEvents(data, 'a', ['a-0'], data.pointRules[0], 2, '', '', '2026-09-12', () => 'a-event');
  assert.equal(points.undoPointEvent(withCurrent, 'a', 'b-event'), withCurrent);
  const undone = points.undoPointEvent(withCurrent, 'a', 'a-event');
  assert.equal(undone.students[0].points, 60);
  assert.equal(undone.pointEvents.some(event => event.id === 'a-event'), false);
  const legacy = { ...data, pointEvents: [{ id: 'legacy', studentId: 'a-0', scene: '课堂', reason: '旧记录', delta: 1, date: '旧日期' }], students: data.students.map((student, index) => index ? student : { ...student, points: 61 }), rosterClasses: data.rosterClasses.map((item, classIndex) => classIndex ? item : { ...item, students: item.students.map((student, index) => index ? student : { ...student, points: 61 }) }) };
  assert.equal(points.undoPointEvent(legacy, 'a', 'legacy').students[0].points, 60);
});

test('班级事件列表优先使用classId，旧记录才按当前名册归属', () => {
  const data = fixture();
  data.pointEvents.push({ id: 'wrong-class', classId: 'b', studentId: 'a-0', scene: '课堂', reason: '显式他班', delta: 1, date: '' });
  data.pointEvents.push({ id: 'legacy-a', studentId: 'a-1', scene: '课堂', reason: '旧记录', delta: 1, date: '' });
  assert.deepEqual(points.pointEventsForClass(data, 'a').map(event => event.id), ['legacy-a']);
});

test('旧备份空规则仍显示默认目录，首次修改后可保留真正空目录', () => {
  const legacy = { pointRules: [] };
  assert.equal(rules.pointRulesForData(legacy), defaultPointRules);
  const initialized = rules.replacePointRules(legacy, []);
  assert.equal(initialized.pointRulesInitialized, true);
  assert.deepEqual(rules.pointRulesForData(initialized), []);
  assert.equal(rules.deletePointRule(fixture(), 'rule').pointRules.length, 0);
  assert.deepEqual(rules.pointRulesForData(rules.deletePointRule(fixture(), 'rule')), []);
});

test('规则编辑不追改历史快照，使用次数优先稳定ruleId并兼容旧快照', () => {
  const data = fixture();
  const oldEvent = { id: 'old', studentId: 'a-0', scene: '课堂', reason: '说清思路｜补充', delta: 2, date: '' };
  const unrelated = { id: 'other', studentId: 'a-1', scene: '课堂', reason: '说清', delta: 1, date: '' };
  const next = rules.patchPointRule({ ...data, pointEvents: [oldEvent, unrelated] }, 'rule', { reason: '新的口径' });
  assert.equal(next.pointEvents[0].reason, '说清思路｜补充');
  assert.equal(rules.pointRuleUsageCount([data.pointEvents[0], oldEvent, unrelated], data.pointRules[0]), 2);
  assert.equal(rules.pointRuleUsageCount([{ ...data.pointEvents[0], ruleId: 'another' }], data.pointRules[0]), 0);
});
