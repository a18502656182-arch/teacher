import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/w/[token]/features/comments/operations.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const comments = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function fixture(count = 50) {
  const roster = prefix => Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    name: index === 0 ? '同名学生' : `${prefix}班${index}`,
    score: 90,
    points: 3,
    homework: '已交',
    attendance: '正常',
    group: index % 8 + 1,
  }));
  const a = roster('a'), b = roster('b');
  return {
    activeClassId: 'a',
    students: a,
    rosterClasses: [{ id: 'a', name: '甲班', students: a }, { id: 'b', name: '乙班', students: b }],
    termComments: [
      { id: 'a-comment', classId: 'a', studentId: 'a-0', term: '2026秋', style: '家长可读', content: '甲班原评语', updatedAt: '2026-09-10' },
      { id: 'b-comment', classId: 'b', studentId: 'b-0', term: '2026秋', style: '家长可读', content: '乙班原评语', updatedAt: '2026-09-10' },
      { id: 'legacy-a', studentId: 'a-1', term: '2025秋', style: '温和鼓励', content: '甲班旧评语', updatedAt: '2025-12-20' },
      { id: 'bad-explicit', classId: 'b', studentId: 'a-2', term: '2025秋', style: '温和鼓励', content: '错误归属', updatedAt: '2025-12-20' },
    ],
    dictation: { children: [{ id: 'child-1' }, { id: 'child-2' }], tasks: [] },
  };
}

function draft(patch = {}) {
  return { studentId: 'a-2', term: ' 2026秋 ', style: '家长可读', content: ' 新评语 ', ...patch };
}

test('评语列表按显式班级与当前名册双重隔离，并兼容无班级旧记录', () => {
  const data = fixture();
  assert.deepEqual(comments.termCommentsForClass(data, 'a').map(item => item.id), ['a-comment', 'legacy-a']);
  assert.deepEqual(comments.termCommentsForClass(data, 'b').map(item => item.id), ['b-comment']);
});

test('新建评语清理字段、写入班级且不改变输入和家庭数据', () => {
  const data = fixture(), before = structuredClone(data);
  const result = comments.saveTermComment(data, 'a', draft(), () => 'new-comment', '2026-09-12');
  assert.deepEqual(data, before);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.comment, { id: 'new-comment', classId: 'a', studentId: 'a-2', term: '2026秋', style: '家长可读', content: '新评语', updatedAt: '2026-09-12' });
  assert.equal(result.data.termComments.find(item => item.id === 'b-comment'), data.termComments[1]);
  assert.equal(result.data.dictation, data.dictation);
});

test('同学生同学期同语气使用原ID稳定更新而不重复', () => {
  const data = fixture();
  const result = comments.saveTermComment(data, 'a', draft({ studentId: 'a-0', content: '更新内容' }), () => 'unused', '2026-09-12');
  assert.equal(result.error, undefined);
  assert.equal(result.comment.id, 'a-comment');
  assert.equal(result.data.termComments.filter(item => item.studentId === 'a-0' && item.term === '2026秋' && item.style === '家长可读').length, 1);
});

test('保存拒绝跨班ID、改绑学生、重复目标、无效字段和失效班级', () => {
  const data = fixture();
  assert.match(comments.saveTermComment(data, 'a', draft({ id: 'b-comment' }), () => 'bad', '2026-09-12').error, /不属于当前班级/);
  assert.match(comments.saveTermComment(data, 'a', draft({ id: 'a-comment' }), () => 'bad', '2026-09-12').error, /不能改绑/);
  data.termComments.push({ ...data.termComments[0], id: 'a-other', style: '温和鼓励' });
  assert.match(comments.saveTermComment(data, 'a', draft({ id: 'a-comment', studentId: 'a-0', style: '温和鼓励' }), () => 'bad', '2026-09-12').error, /已有另一条评语/);
  assert.match(comments.saveTermComment(fixture(), 'a', draft({ content: ' ' }), () => 'bad', '2026-09-12').error, /内容不能为空/);
  assert.match(comments.saveTermComment(fixture(), 'a', draft({ term: ' ' }), () => 'bad', '2026-09-12').error, /学期不能为空/);
  assert.match(comments.saveTermComment(fixture(), 'a', draft({ style: '未知语气' }), () => 'bad', '2026-09-12').error, /语气无效/);
  assert.match(comments.saveTermComment(fixture(), 'a', draft({ studentId: 'b-0' }), () => 'bad', '2026-09-12').error, /不在当前班级/);
  assert.match(comments.saveTermComment(fixture(), 'missing', draft(), () => 'bad', '2026-09-12').error, /班级已不存在/);
});

test('无任何选中依据时本地生成返回空内容，不补写学生表现', () => {
  const student = fixture().rosterClasses[0].students[0];
  assert.equal(comments.buildLocalTermCommentDraft(student, '家长可读', { records: [], events: [], reflections: [] }), '');
});

test('本地生成只整理传入的沟通、积分、反思和教师补充', () => {
  const student = fixture().rosterClasses[0].students[0];
  const content = comments.buildLocalTermCommentDraft(student, '温和鼓励', {
    records: [{ id: 'record', date: '2026-09-08', type: '课堂观察', content: '主动整理图书' }],
    events: [{ id: 'event', date: '2026-09-09', reason: '主动发言', delta: 2, studentId: student.id }],
    reflections: [{ id: 'reflection', date: '2026-09-10', studentId: student.id, problem: '审题较快', reason: '', action: '圈画关键词', teacherNote: '', status: '草稿' }],
    teacherInput: '继续观察作业订正',
  });
  assert.match(content, /主动整理图书/);
  assert.match(content, /主动发言（\+2分）/);
  assert.match(content, /问题：审题较快；下一步：圈画关键词/);
  assert.match(content, /教师补充：继续观察作业订正/);
  assert.doesNotMatch(content, /稳定优秀|学习主动性较强|形成改进计划|积累自己的小进步/);
});

test('反思没有行动时不会声称已有改进计划', () => {
  const student = fixture().rosterClasses[0].students[0];
  const content = comments.buildLocalTermCommentDraft(student, '客观正式', {
    records: [], events: [], reflections: [{ id: 'reflection', date: '', studentId: student.id, problem: '计算失误', reason: '', action: '', status: '草稿' }],
  });
  assert.match(content, /问题：计算失误/);
  assert.doesNotMatch(content, /下一步|改进计划/);
});

test('追加文字不会在空草稿前产生句号，并统一句末标点', () => {
  assert.equal(comments.appendTermCommentText('', '第一条依据'), '第一条依据。');
  assert.equal(comments.appendTermCommentText('已有内容。', '下一条依据'), '已有内容。下一条依据。');
});
