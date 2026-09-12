import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function load(feature) {
  const source = await readFile(new URL(`../app/w/[token]/features/${feature}/operations.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const records = await load('records');
const notifications = await load('notifications');

function fixture(count = 50) {
  const roster = prefix => Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, name: index === 0 ? '同名学生' : `合成${index}`, studentNo: `${prefix.toUpperCase()}${String(index + 1).padStart(3, '0')}`, group: index % 8 + 1 }));
  const a = roster('a'), b = roster('b');
  return {
    activeClassId: 'a', students: a, rosterClasses: [{ id: 'a', students: a }, { id: 'b', students: b }],
    records: [
      { id: 'a-record', classId: 'a', studentId: 'a-0', student: '同名学生', type: '家访登记', channel: '微信', content: '目的：了解｜家庭情况：正常｜沟通内容：原记录', parentFeedback: '收到', followUp: '周五复查', status: '已跟进', date: '2026-09-10' },
      { id: 'b-record', classId: 'b', studentId: 'b-0', student: '同名学生', type: '家校沟通', content: '他班', status: '待跟进', date: '2026-09-10' },
    ],
    notificationDrafts: [
      { id: 'a-draft', classId: 'a', date: '2026-09-09', title: '原通知', content: '原内容', channel: '私聊', recipientStudentIds: ['a-0', 'a-1'], status: '已记录回执', receiptNote: '已知晓', createdAt: 10 },
      { id: 'b-draft', classId: 'b', date: '2026-09-09', title: '他班通知', content: '他班内容', channel: '班级群', recipientStudentIds: [], status: '草稿', createdAt: 11 },
    ],
    growthEvidence: [{ id: 'manual', classId: 'a', studentId: 'a-0', source: '班主任补充' }],
    dictation: { children: [{ id: 'child-1' }, { id: 'child-2' }], tasks: [] },
  };
}

test('两班各50人且存在同名学生时，沟通保存只按学生ID写当前班', () => {
  const data = fixture(), before = structuredClone(data);
  const result = records.saveCommunicationRecord(data, 'a', { studentId: 'a-0', type: ' 家校沟通 ', channel: ' 电话 ', date: '2026-09-12', purpose: ' 说明情况 ', home: ' 作息稳定 ', content: ' 约定复查 ', parentFeedback: ' 配合 ', followUp: ' 周五回访 ' }, () => 'new-record');
  assert.deepEqual(data, before);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.record, { id: 'new-record', classId: 'a', studentId: 'a-0', student: '同名学生', type: '家校沟通', channel: '电话', date: '2026-09-12', content: '目的：说明情况｜家庭情况：作息稳定｜沟通内容：约定复查', parentFeedback: '配合', followUp: '周五回访', status: '待跟进' });
  assert.equal(result.data.records[2], data.records[1]);
  assert.equal(result.data.growthEvidence, data.growthEvidence);
  assert.equal(result.data.dictation, data.dictation);
});

test('沟通编辑保留状态并拒绝他班学生、空内容和跨班目标', () => {
  const data = fixture();
  const edited = records.saveCommunicationRecord(data, 'a', { id: 'a-record', studentId: 'a-1', type: '谈心记录', channel: '面谈', date: '2026-09-12', purpose: '', home: '', content: '新的事实', parentFeedback: '', followUp: '' }, () => 'unused');
  assert.equal(edited.record.status, '已跟进');
  assert.equal(edited.record.studentId, 'a-1');
  assert.equal(records.saveCommunicationRecord(data, 'a', { studentId: 'b-0', type: '', channel: '', date: '', purpose: '', home: '', content: '内容', parentFeedback: '', followUp: '' }, () => 'bad').error, '请选择当前班级的沟通对象。');
  assert.equal(records.saveCommunicationRecord(data, 'a', { studentId: 'a-0', type: '', channel: '', date: '', purpose: '', home: '', content: ' ', parentFeedback: '', followUp: '' }, () => 'bad').error, '请填写沟通内容后再保存。');
  assert.match(records.saveCommunicationRecord(data, 'a', { id: 'b-record', studentId: 'a-0', type: '', channel: '', date: '', purpose: '', home: '', content: '内容', parentFeedback: '', followUp: '' }, () => 'bad').error, /不属于当前班级/);
});

test('沟通状态与删除不能用他班记录ID越界修改', () => {
  const data = fixture();
  assert.equal(records.patchCommunicationStatus(data, 'a', 'b-record', '已归档'), data);
  assert.equal(records.removeCommunicationRecord(data, 'a', 'b-record'), data);
  assert.equal(records.patchCommunicationStatus(data, 'a', 'a-record', '已归档').records[0].status, '已归档');
  assert.deepEqual(records.removeCommunicationRecord(data, 'a', 'a-record').records.map(item => item.id), ['b-record']);
});

test('沟通列表优先显式classId并兼容已能唯一归属的旧记录', () => {
  const data = fixture();
  data.records.push({ id: 'legacy-a', studentId: 'a-2', student: '合成2', type: '旧记录', content: '内容', date: '旧日期' });
  data.records.push({ id: 'wrong-explicit', classId: 'b', studentId: 'a-2', student: '合成2', type: '显式他班', content: '内容', date: '旧日期' });
  assert.deepEqual(records.communicationRecordsForClass(data, 'a').map(item => item.id), ['a-record', 'legacy-a']);
});

test('通知草稿保留多人对象和历史状态，不会编辑成全班通知', () => {
  const data = fixture(), before = structuredClone(data);
  const result = notifications.saveNotificationDraft(data, 'a', { id: 'a-draft', title: ' 更新通知 ', content: ' 新内容 ', channel: '电话提醒', recipientStudentIds: ['a-1', 'a-0', 'a-1'] }, () => 'unused', '2026-09-12', 99);
  assert.deepEqual(data, before);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.draft.recipientStudentIds, ['a-1', 'a-0']);
  assert.equal(result.draft.status, '已记录回执');
  assert.equal(result.draft.receiptNote, '已知晓');
  assert.equal(result.draft.date, '2026-09-09');
  assert.equal(result.draft.createdAt, 10);
});

test('通知草稿校验空内容、跨班对象与跨班编辑目标', () => {
  const data = fixture();
  assert.equal(notifications.saveNotificationDraft(data, 'a', { title: '', content: '', channel: '班级群', recipientStudentIds: [] }, () => 'bad').error, '请补全通知标题和内容，再保存草稿。');
  assert.match(notifications.saveNotificationDraft(data, 'a', { title: '标题', content: '内容', channel: '私聊', recipientStudentIds: ['a-0', 'b-0'] }, () => 'bad').error, /不属于当前班级/);
  assert.match(notifications.saveNotificationDraft(data, 'a', { id: 'b-draft', title: '标题', content: '内容', channel: '班级群', recipientStudentIds: [] }, () => 'bad').error, /不属于当前班级/);
});

test('通知复制、回执与删除只操作当前班草稿', () => {
  const data = fixture();
  assert.equal(notifications.markNotificationCopied(data, 'a', 'b-draft'), data);
  assert.equal(notifications.saveNotificationReceipt(data, 'a', 'b-draft', '越界'), data);
  assert.equal(notifications.removeNotificationDraft(data, 'a', 'b-draft'), data);
  assert.equal(notifications.markNotificationCopied(data, 'a', 'a-draft').notificationDrafts[0].status, '已复制');
  assert.equal(notifications.saveNotificationReceipt(data, 'a', 'a-draft', ' 已确认 ').notificationDrafts[0].receiptNote, '已确认');
  assert.deepEqual(notifications.removeNotificationDraft(data, 'a', 'a-draft').notificationDrafts.map(item => item.id), ['b-draft']);
});

test('沟通和通知日期都使用本机年月日，不经过UTC截取', () => {
  const nearMidnight = new Date(2026, 8, 12, 0, 30);
  assert.equal(records.localCommunicationDate(nearMidnight), '2026-09-12');
  assert.equal(notifications.localNotificationDate(nearMidnight), '2026-09-12');
});
