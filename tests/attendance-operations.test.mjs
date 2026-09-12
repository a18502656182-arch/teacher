import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/w/[token]/features/attendance/operations.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { applyAttendanceChanges, localDateToday } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function fixture() {
  const a = [{ id: 'a-0', attendance: '请假' }, { id: 'a-1', attendance: '迟到' }];
  const b = [{ id: 'b-0', attendance: '缺勤' }];
  return {
    activeClassId: 'a', students: a, rosterClasses: [{ id: 'a', students: a }, { id: 'b', students: b }],
    attendanceRecords: [
      { id: 'old', classId: 'a', studentId: 'a-0', date: '2026-09-12', createdAt: 1, period: '上午', status: '请假', leaveType: '病假', reason: '合成原因', note: '保留备注' },
      { id: 'b-record', classId: 'b', studentId: 'b-0', date: '2026-09-12', createdAt: 2, period: '全天', status: '缺勤', note: '他班' },
    ],
    dictation: { children: [{ id: 'child-1' }, { id: 'child-2' }], tasks: [] },
  };
}

test('今天按本机年月日生成，不经过UTC日期截取', () => {
  assert.equal(localDateToday(new Date(2026, 8, 12, 0, 30)), '2026-09-12');
});

test('一键状态变更未提供备注时保留原备注，并只更新目标班', () => {
  const data = fixture(), before = structuredClone(data);
  const next = applyAttendanceChanges(data, 'a', [{ studentId: 'a-0', status: '正常' }], '2026-09-12', () => 'new', '2026-09-12');
  assert.deepEqual(data, before);
  const record = next.attendanceRecords.find(item => item.id === 'old');
  assert.equal(record.status, '正常');
  assert.equal(record.note, '保留备注');
  assert.equal(record.leaveType, undefined);
  assert.equal(next.students[0].attendance, '正常');
  assert.equal(next.rosterClasses[0].students[0].attendance, '正常');
  assert.equal(next.rosterClasses[1], data.rosterClasses[1]);
  assert.equal(next.attendanceRecords.find(item => item.id === 'b-record'), data.attendanceRecords[1]);
  assert.equal(next.dictation, data.dictation);
});

test('历史日期只写台账，不覆盖学生当前考勤汇总', () => {
  const data = fixture();
  const next = applyAttendanceChanges(data, 'a', [{ studentId: 'a-1', status: '缺勤', note: '历史记录' }], '2026-09-10', () => 'history', '2026-09-12');
  assert.equal(next.students, data.students);
  assert.equal(next.rosterClasses, data.rosterClasses);
  assert.equal(next.attendanceRecords.at(-1).id, 'history');
  assert.equal(next.attendanceRecords.at(-1).note, '历史记录');
});

test('拒绝另一班和不存在学生ID，不调用ID生成器', () => {
  const data = fixture(); let calls = 0;
  for (const studentId of ['b-0', 'missing']) {
    assert.equal(applyAttendanceChanges(data, 'a', [{ studentId, status: '正常' }], '2026-09-12', () => { calls++; return 'bad'; }, '2026-09-12'), data);
  }
  assert.equal(calls, 0);
});
