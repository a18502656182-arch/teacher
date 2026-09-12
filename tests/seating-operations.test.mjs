import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/w/[token]/features/seating/operations.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const seating = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function makeStudents(prefix, count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    studentNo: String(index + 1).padStart(3, '0'),
    name: `${prefix}班超长姓名${index + 1}`,
    gender: index % 2 ? '男' : '女',
    group: index % 8 + 1,
    seat: index + 1,
    points: 0,
    homework: '已交',
    attendance: '正常',
    score: 0,
  }));
}

function fixture(countA = 50, countB = 50) {
  const a = makeStudents('甲', countA);
  const b = makeStudents('乙', countB);
  return {
    activeClassId: 'class-a',
    students: a,
    rosterClasses: [
      { id: 'class-a', name: '甲班', grade: '三年级', term: '上学期', students: a },
      { id: 'class-b', name: '乙班', grade: '三年级', term: '上学期', students: b },
    ],
    seatingConfig: { rows: Math.max(6, Math.ceil(countA / 10)), columns: 10, groupCount: 8, aisleAfter: [2, 5, 8] },
    classSeatingConfigs: {
      'class-a': { rows: Math.max(6, Math.ceil(countA / 10)), columns: 10, groupCount: 8, aisleAfter: [2, 5, 8] },
      'class-b': { rows: Math.max(6, Math.ceil(countB / 10)), columns: 10, groupCount: 8, aisleAfter: [2, 5, 8] },
    },
    pointEvents: [{ id: 'point-a', classId: 'class-a', studentId: '甲-1', delta: 1, reason: '原记录', date: '2026-09-01' }],
    dictation: { children: [{ id: 'child-1', name: '家庭孩子一' }, { id: 'child-2', name: '家庭孩子二' }] },
  };
}

function assertUniqueValid(students, capacity) {
  assert.equal(students.length, new Set(students.map(student => student.id)).size);
  assert.equal(students.length, new Set(students.map(student => student.seat)).size);
  assert.equal(students.every(student => Number.isInteger(student.seat) && student.seat >= 1 && student.seat <= capacity), true);
}

test('105人配置可保存，容量不足、非整数和超上限配置被拒绝', () => {
  const data = fixture(105);
  const saved = seating.saveSeatingConfig(data, 'class-a', { rows: 11, columns: 10, groupCount: 12, aisleAfter: [8, 2, 2, 10, -1] });
  assert.equal(saved.error, undefined);
  assert.deepEqual(saved.data.seatingConfig, { rows: 11, columns: 10, groupCount: 12, aisleAfter: [2, 8] });
  assert.match(seating.saveSeatingConfig(data, 'class-a', { rows: 10, columns: 10, groupCount: 8, aisleAfter: [] }).error, /不能容纳 105/);
  assert.match(seating.saveSeatingConfig(data, 'class-a', { rows: 11.5, columns: 10, groupCount: 8, aisleAfter: [] }).error, /必须是整数/);
  assert.match(seating.saveSeatingConfig(data, 'class-a', { rows: 21, columns: 10, groupCount: 8, aisleAfter: [] }).error, /1 至 20/);
});

test('换座交换占用座或移入空座，不遗漏学生且不触碰另一班与家庭数据', () => {
  const data = fixture(50, 50);
  const before = structuredClone(data);
  const occupied = seating.swapSeatingStudent(data, 'class-a', '甲-1', 2);
  assert.equal(occupied.error, undefined);
  assert.equal(occupied.data.students.find(student => student.id === '甲-1').seat, 2);
  assert.equal(occupied.data.students.find(student => student.id === '甲-2').seat, 1);
  assertUniqueValid(occupied.data.students, 60);
  assert.equal(occupied.data.rosterClasses[1], data.rosterClasses[1]);
  assert.equal(occupied.data.dictation, data.dictation);
  assert.equal(occupied.data.pointEvents, data.pointEvents);
  assert.deepEqual(data, before);

  const empty = seating.swapSeatingStudent(occupied.data, 'class-a', '甲-3', 60);
  assert.equal(empty.data.students.find(student => student.id === '甲-3').seat, 60);
  assertUniqueValid(empty.data.students, 60);
});

test('一步撤销绑定班级，并在名册变化后拒绝恢复旧快照', () => {
  const data = fixture(5, 5);
  const moved = seating.swapSeatingStudent(data, 'class-a', '甲-1', 2);
  const restored = seating.restoreSeatingSnapshot(moved.data, 'class-a', moved.snapshot);
  assert.equal(restored.error, undefined);
  assert.deepEqual(restored.data.students.map(student => student.seat), data.students.map(student => student.seat));
  assert.match(seating.restoreSeatingSnapshot(moved.data, 'class-b', moved.snapshot).error, /属于其他班级/);
  const rosterChanged = structuredClone(moved.data);
  rosterChanged.students.pop();
  rosterChanged.rosterClasses[0].students.pop();
  assert.match(seating.restoreSeatingSnapshot(rosterChanged, 'class-a', moved.snapshot).error, /名册已经变化/);
});

test('105人智能排座修复重复和越界座位，固定座保留且全员唯一', () => {
  const data = fixture(105);
  data.students[0].seat = 999;
  data.students[1].seat = 3;
  data.students[2].seat = 3;
  data.students[3].seat = 4;
  data.students[3].seatFixed = true;
  data.rosterClasses[0].students = data.students;
  const result = seating.arrangeSeating(data, 'class-a', () => 0.37);
  assert.equal(result.error, undefined);
  assert.equal(result.data.students.find(student => student.id === '甲-4').seat, 4);
  assertUniqueValid(result.data.students, 110);
  assert.equal(result.data.students.length, 105);
});

test('智能排座优先方位需求并避免可满足的不能同桌关系', () => {
  const data = fixture(8, 5);
  data.seatingConfig = { rows: 4, columns: 2, groupCount: 2, aisleAfter: [1] };
  data.classSeatingConfigs['class-a'] = data.seatingConfig;
  data.students[0].seatNeed = '前排';
  data.students[1].seatNeed = '后排';
  data.students[2].avoidWith = data.students[3].id;
  data.rosterClasses[0].students = data.students;
  const result = seating.arrangeSeating(data, 'class-a', () => 0.2);
  assert.equal(result.error, undefined);
  const front = result.data.students.find(student => student.id === '甲-1');
  const back = result.data.students.find(student => student.id === '甲-2');
  assert.ok(front.seat <= 2);
  assert.ok(back.seat >= 7);
  const avoidA = result.data.students.find(student => student.id === '甲-3');
  const avoidB = result.data.students.find(student => student.id === '甲-4');
  assert.notEqual(Math.floor((avoidA.seat - 1) / 2), Math.floor((avoidB.seat - 1) / 2));
  assert.equal(result.warning, undefined);
});

test('前后排轮换不移动固定座，不重复不丢失并按新座位更新小组', () => {
  const data = fixture(20, 5);
  data.students[0].seatFixed = true;
  data.students[0].groupLeader = true;
  data.students[1].groupLeader = true;
  data.rosterClasses[0].students = data.students;
  const result = seating.rotateSeatingRows(data, 'class-a');
  assert.equal(result.error, undefined);
  assert.equal(result.data.students.find(student => student.id === '甲-1').seat, 1);
  assert.notEqual(result.data.students.find(student => student.id === '甲-2').seat, 2);
  assertUniqueValid(result.data.students, 60);
  for (const group of new Set(result.data.students.map(student => student.group))) {
    assert.ok(result.data.students.filter(student => student.group === group && student.groupLeader).length <= 1);
  }
});

test('学生条件校验当前班、身高、小组与避让对象，组长在组内保持唯一', () => {
  const data = fixture(8, 8);
  assert.match(seating.patchSeatingStudent(data, 'class-a', '乙-1', { seatFixed: true }).error, /不属于当前班级/);
  assert.match(seating.patchSeatingStudent(data, 'class-a', '甲-1', { height: 60 }).error, /80 至 220/);
  assert.match(seating.patchSeatingStudent(data, 'class-a', '甲-1', { group: 99 }).error, /1 至 8/);
  assert.match(seating.patchSeatingStudent(data, 'class-a', '甲-1', { avoidWith: '乙-1' }).error, /当前班/);
  assert.match(seating.patchSeatingStudent(data, 'class-a', '甲-1', { avoidWith: '甲-1' }).error, /另一名学生/);

  data.students[0].group = 1;
  data.students[1].group = 1;
  data.students[0].groupLeader = true;
  data.rosterClasses[0].students = data.students;
  const leader = seating.setSeatingGroupLeader(data, 'class-a', '甲-2');
  assert.equal(leader.data.students.find(student => student.id === '甲-1').groupLeader, false);
  assert.equal(leader.data.students.find(student => student.id === '甲-2').groupLeader, true);
});

test('破损座位会阻止手动交换和轮换，但允许智能排座修复', () => {
  const data = fixture(6, 6);
  data.students[1].seat = data.students[0].seat;
  data.students[2].group = 99;
  data.rosterClasses[0].students = data.students;
  assert.deepEqual(seating.inspectSeating(data.students, data.seatingConfig).invalidGroupStudentIds, ['甲-3']);
  assert.match(seating.swapSeatingStudent(data, 'class-a', '甲-1', 3).error, /重复或越界/);
  assert.match(seating.rotateSeatingRows(data, 'class-a').error, /重复或越界/);
  const repaired = seating.arrangeSeating(data, 'class-a', () => 0.5);
  assert.equal(repaired.error, undefined);
  assertUniqueValid(repaired.data.students, 60);
  assert.equal(repaired.data.students.every(student => student.group >= 1 && student.group <= 8), true);
});

test('非活动班操作只更新目标班和对应配置，不污染活动班根数据', () => {
  const data = fixture(10, 10);
  const result = seating.saveSeatingConfig(data, 'class-b', { rows: 5, columns: 2, groupCount: 3, aisleAfter: [1] });
  assert.equal(result.error, undefined);
  assert.equal(result.data.students, data.students);
  assert.equal(result.data.rosterClasses[0], data.rosterClasses[0]);
  assert.notEqual(result.data.rosterClasses[1], data.rosterClasses[1]);
  assert.deepEqual(result.data.classSeatingConfigs['class-b'], { rows: 5, columns: 2, groupCount: 3, aisleAfter: [1] });
  assert.deepEqual(result.data.seatingConfig, data.seatingConfig);
  assert.match(seating.saveSeatingConfig(data, 'missing', { rows: 5, columns: 2, groupCount: 3, aisleAfter: [] }).error, /班级已不存在/);
});

test('空班可保留座位图，只有一名可移动学生时轮换给出明确错误', () => {
  const empty = fixture(0, 2);
  const config = seating.seatingConfigForClass(empty, 'class-a');
  assert.equal(config.error, undefined);
  assert.ok(config.config.rows * config.config.columns >= 1);
  const single = fixture(1, 2);
  assert.match(seating.rotateSeatingRows(single, 'class-a').error, /至少需要 2 名/);
});

test('新班级不会继承其他班已经保存的座位布局', () => {
  const data = fixture(50, 0);
  delete data.classSeatingConfigs['class-b'];
  data.activeClassId = 'class-b';
  data.students = data.rosterClasses[1].students;
  const config = seating.seatingConfigForClass(data, 'class-b');
  assert.equal(config.error, undefined);
  assert.deepEqual(config.config, { rows: 1, columns: 6, groupCount: 3, aisleAfter: [2, 4] });
  assert.notDeepEqual(config.config, data.classSeatingConfigs['class-a']);
});
