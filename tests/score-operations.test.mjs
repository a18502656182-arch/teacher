import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/w/[token]/features/scores/operations.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const scores = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function fixture(count = 50) {
  const roster = prefix => Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, name: `合成${index}`, score: 80, points: 0, homework: '已交', attendance: '正常' }));
  const a = roster('a'), b = roster('b');
  return {
    activeClassId: 'a', students: a, rosterClasses: [{ id: 'a', students: a }, { id: 'b', students: b }],
    scoreExams: [
      { id: 'a-exam', classId: 'a', title: '甲班考试', date: '2026-09-10', subjects: ['语文', '数学'], scores: { 'a-0': { 语文: 0 }, 'a-1': { 语文: 90, 数学: 80 } }, subjectMaxScores: { 语文: 100, 数学: 100 }, followUpStudentIds: ['a-1'] },
      { id: 'b-exam', classId: 'b', title: '乙班考试', date: '2026-09-10', subjects: ['语文'], scores: { 'b-0': { 语文: 70 } } },
    ],
    examReflections: [{ id: 'a-reflection', classId: 'a', studentId: 'a-0', examId: 'a-exam' }, { id: 'b-reflection', classId: 'b', studentId: 'b-0', examId: 'b-exam' }],
    dictation: { children: [{ id: 'child-1' }, { id: 'child-2' }], tasks: [] },
  };
}

test('新考试为50名学生建立空记录，不把未录入预写为零分', () => {
  const data = fixture(), before = structuredClone(data);
  const result = scores.createScoreExam(data, 'a', { title: ' 新考试 ', date: '2026-09-12', subjects: [' 语文 ', '数学', '语文'] }, () => 'new-exam');
  assert.deepEqual(data, before);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.exam.subjects, ['语文', '数学']);
  assert.equal(Object.keys(result.exam.scores).length, 50);
  assert.equal(Object.values(result.exam.scores).every(item => Object.keys(item).length === 0), true);
  assert.equal(scores.scoreEntryCount(result.exam, data.students), 0);
  assert.equal(result.data.dictation, data.dictation);
});

test('真实零分计入录入数，空白保持null且不生成总分', () => {
  const data = fixture(), exam = data.scoreExams[0];
  assert.equal(scores.scoreEntry(exam, 'a-0', '语文'), 0);
  assert.equal(scores.scoreEntry(exam, 'a-0', '数学'), null);
  assert.equal(scores.scoreEntryCount(exam, data.students), 3);
  assert.deepEqual(scores.studentScoreSummary(exam, 'a-0'), { enteredCount: 1, expectedCount: 2, complete: false, total: null, average: 0, weakSubject: '语文' });
  assert.deepEqual(scores.studentScoreSummary(exam, 'a-1'), { enteredCount: 2, expectedCount: 2, complete: true, total: 170, average: 85, weakSubject: '数学' });
});

test('编辑科目只保留真实已录值，新科目继续为空白', () => {
  const data = fixture();
  const result = scores.editScoreExam(data, 'a', 'a-exam', { title: ' 调整后 ', date: '2026-09-11', subjects: ['语文', '英语'] });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.exam.scores['a-0'], { 语文: 0 });
  assert.deepEqual(result.exam.scores['a-1'], { 语文: 90 });
  assert.equal(result.exam.subjectMaxScores.英语, 100);
  assert.equal(result.data.scoreExams[1], data.scoreExams[1]);
});

test('逐生录分可清回未录入，且只同步当前班摘要', () => {
  const data = fixture(), before = structuredClone(data);
  const written = scores.setScoreEntries(data, 'a', 'a-exam', ['a-0'], '数学', 120);
  assert.deepEqual(data, before);
  assert.equal(written.error, undefined);
  assert.equal(written.exam.scores['a-0'].数学, 100);
  assert.equal(written.data.students[0].score, 50);
  assert.equal(written.data.rosterClasses[0].students[0].score, 50);
  assert.equal(written.data.rosterClasses[1], data.rosterClasses[1]);
  assert.equal(written.data.dictation, data.dictation);
  const cleared = scores.setScoreEntries(written.data, 'a', 'a-exam', ['a-0'], '数学', null);
  assert.equal(scores.scoreEntry(cleared.exam, 'a-0', '数学'), null);
  assert.equal(scores.scoreEntryCount(cleared.exam, data.students), 3);
});

test('105人批量录入保留零分并拒绝混入另一班对象', () => {
  const data = fixture(105);
  assert.match(scores.setScoreEntries(data, 'a', 'a-exam', ['a-0', 'b-0'], '数学', 0).error, /不属于当前班级/);
  const ids = data.students.map(student => student.id);
  const result = scores.setScoreEntries(data, 'a', 'a-exam', ids, '数学', 0);
  assert.equal(result.error, undefined);
  assert.equal(ids.every(id => result.exam.scores[id].数学 === 0), true);
  assert.equal(scores.scoreEntryCount(result.exam, data.students), 107);
});

test('成绩操作拒绝他班考试、他班学生、空科目和非法值', () => {
  const data = fixture();
  assert.match(scores.editScoreExam(data, 'a', 'b-exam', { title: '', date: '', subjects: ['语文'] }).error, /不属于当前班级/);
  assert.equal(scores.createScoreExam(data, 'a', { title: '', date: '', subjects: [] }, () => 'bad').error, '请填写至少一个考试科目。');
  assert.match(scores.setScoreEntries(data, 'a', 'b-exam', ['a-0'], '语文', 80).error, /不属于当前班级/);
  assert.match(scores.setScoreEntries(data, 'a', 'a-exam', ['a-0'], '英语', 80).error, /不在当前考试/);
  assert.equal(scores.setScoreEntries(data, 'a', 'a-exam', ['a-0'], '语文', Number.NaN).error, '请填写有效分数。');
});

test('考试补丁和删除都校验班级，删除仅清理对应反思', () => {
  const data = fixture();
  assert.equal(scores.patchScoreExam(data, 'a', 'b-exam', { title: '越界' }), data);
  assert.equal(scores.removeScoreExam(data, 'a', 'b-exam'), data);
  const patched = scores.patchScoreExam(data, 'a', 'a-exam', { title: '新标题' });
  assert.equal(patched.scoreExams[0].title, '新标题');
  const removed = scores.removeScoreExam(data, 'a', 'a-exam');
  assert.deepEqual(removed.scoreExams.map(item => item.id), ['b-exam']);
  assert.deepEqual(removed.examReflections.map(item => item.id), ['b-reflection']);
});

test('考试列表兼容旧无classId记录，并按本机日期生成', () => {
  const data = fixture();
  data.scoreExams.push({ id: 'legacy', title: '旧考试', date: '', subjects: ['语文'], scores: {} });
  assert.deepEqual(scores.scoreExamsForClass(data, 'a').map(item => item.id), ['a-exam', 'legacy']);
  assert.equal(scores.localScoreDate(new Date(2026, 8, 12, 0, 30)), '2026-09-12');
});

test('人工分析项按当前班保存，真实零分计入而空白可清除', () => {
  const data = fixture();
  const added = scores.addScoreKnowledgeItem(data, 'a', 'a-exam', { title: ' 阅读第3题 ', subject: ' 语文 ', questionNo: ' 3 ', knowledgePoint: ' 概括 ', questionType: ' 简答 ', maxScore: 10 }, () => 'item-1');
  assert.equal(added.error, undefined);
  assert.deepEqual(added.exam.knowledgeItems[0], { id: 'item-1', title: '阅读第3题', subject: '语文', questionNo: '3', knowledgePoint: '概括', questionType: '简答', maxScore: 10, source: 'teacher', scores: {} });
  const zero = scores.setKnowledgeItemScore(added.data, 'a', 'a-exam', 'item-1', 'a-0', 0);
  assert.equal(zero.exam.knowledgeItems[0].scores['a-0'], 0);
  const cleared = scores.setKnowledgeItemScore(zero.data, 'a', 'a-exam', 'item-1', 'a-0', null);
  assert.equal(cleared.exam.knowledgeItems[0].scores['a-0'], undefined);
  assert.match(scores.setKnowledgeItemScore(added.data, 'a', 'a-exam', 'item-1', 'b-0', 5).error, /不属于当前班级/);
  assert.equal(scores.removeScoreKnowledgeItem(data, 'a', 'b-exam', 'item-1'), data);
});

test('AI候选在教师确认前不进统计，确认操作幂等', () => {
  const data = fixture();
  const paper = { id: 'paper-1', sourceName: '合成试卷.pdf', sourceType: 'application/pdf', sourceSize: 100, createdAt: '2026-09-12T00:00:00.000Z', status: '待核对', items: [{ id: 'ai-1', title: ' 选择题 ', subject: '数学', source: 'ai', maxScore: 5, scores: {} }] };
  const added = scores.addScorePaperAnalysis(data, 'a', 'a-exam', paper);
  assert.equal(added.exam.knowledgeItems, undefined);
  const reviewed = scores.patchScorePaperAnalysis(added.data, 'a', 'a-exam', 'paper-1', { message: '教师已核对字段' });
  assert.equal(reviewed.scoreExams[0].paperAnalyses[0].message, '教师已核对字段');
  const confirmed = scores.confirmScorePaperAnalysis(reviewed, 'a', 'a-exam', 'paper-1');
  assert.equal(confirmed.error, undefined);
  assert.equal(confirmed.exam.knowledgeItems.length, 1);
  assert.equal(confirmed.exam.knowledgeItems[0].title, '选择题');
  assert.equal(confirmed.exam.paperAnalyses[0].status, '已确认');
  const repeated = scores.confirmScorePaperAnalysis(confirmed.data, 'a', 'a-exam', 'paper-1');
  assert.equal(repeated.exam.knowledgeItems.length, 1);
});

test('试卷候选状态不能通过他班考试ID修改或越过待核对直接确认', () => {
  const data = fixture();
  assert.equal(scores.patchScorePaperAnalysis(data, 'a', 'b-exam', 'paper', { status: '已确认' }), data);
  const paper = { id: 'paper-2', sourceName: '合成图.png', sourceType: 'image/png', sourceSize: 50, createdAt: '', status: '识别中', items: [{ id: 'ai-2', title: '题目', maxScore: 2, scores: {} }] };
  const added = scores.addScorePaperAnalysis(data, 'a', 'a-exam', paper);
  assert.match(scores.confirmScorePaperAnalysis(added.data, 'a', 'a-exam', 'paper-2').error, /只有待核对/);
});
