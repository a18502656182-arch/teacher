import type { ClassroomData, ScoreExam, ScoreKnowledgeItem, ScorePaperAnalysis, Student } from '@/lib/classroom';

export type ScoreExamDraft = { title: string; date: string; subjects: readonly string[] };
export type ScoreOperationResult = { data: ClassroomData; exam: ScoreExam; error?: never } | { data?: never; exam?: never; error: string };

function studentsForClass(data: ClassroomData, classId: string): Student[] {
  const roster = data.rosterClasses?.find(item => item.id === classId);
  if (roster) return roster.students;
  const activeClassId = data.activeClassId ?? classId;
  return activeClassId === classId ? data.students : [];
}

function examForClass(data: ClassroomData, classId: string, examId: string): ScoreExam | undefined {
  return (data.scoreExams ?? []).find(item => item.id === examId && (!item.classId || item.classId === classId));
}

function cleanSubjects(subjects: readonly string[]): string[] {
  return [...new Set(subjects.map(subject => subject.trim()).filter(Boolean))];
}

function defaultRanges(maxScore: number) {
  const safeMax = Math.max(1, Math.round(maxScore || 100));
  const excellentMin = Math.ceil(safeMax * 0.9);
  const goodMin = Math.ceil(safeMax * 0.8);
  const passMin = Math.ceil(safeMax * 0.6);
  return [
    { id: 'excellent', label: '优秀', min: excellentMin, max: safeMax },
    { id: 'good', label: '良好', min: goodMin, max: excellentMin - 1 },
    { id: 'pass', label: '及格', min: passMin, max: goodMin - 1 },
    { id: 'fail', label: '不及格', min: 0, max: passMin - 1 },
  ];
}

export function localScoreDate(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function scoreExamsForClass(data: ClassroomData, classId: string): ScoreExam[] {
  return (data.scoreExams ?? []).filter(item => !item.classId || item.classId === classId);
}

export function scoreEntry(exam: ScoreExam, studentId: string, subject: string): number | null {
  const value = exam.scores[studentId]?.[subject];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function scoreEntryCount(exam: ScoreExam, students: readonly Student[]): number {
  return students.reduce((count, student) => count + exam.subjects.filter(subject => scoreEntry(exam, student.id, subject) != null).length, 0);
}

export function studentScoreSummary(exam: ScoreExam, studentId: string) {
  const entries = exam.subjects.map(subject => ({ subject, value: scoreEntry(exam, studentId, subject) }));
  const entered = entries.filter((entry): entry is { subject: string; value: number } => entry.value != null);
  const sum = entered.reduce((total, entry) => total + entry.value, 0);
  return {
    enteredCount: entered.length,
    expectedCount: exam.subjects.length,
    complete: exam.subjects.length > 0 && entered.length === exam.subjects.length,
    total: exam.subjects.length > 0 && entered.length === exam.subjects.length ? sum : null,
    average: entered.length ? Math.round(sum / entered.length) : null,
    weakSubject: entered.toSorted((a, b) => a.value - b.value)[0]?.subject ?? null,
  };
}

function replaceExam(data: ClassroomData, exam: ScoreExam): ClassroomData {
  const scoreExams = data.scoreExams ?? [];
  return { ...data, scoreExams: scoreExams.map(item => item.id === exam.id ? exam : item) };
}

function patchStudentSummary(data: ClassroomData, classId: string, studentIds: readonly string[], exam: ScoreExam): ClassroomData {
  const summaries = new Map(studentIds.map(studentId => [studentId, studentScoreSummary(exam, studentId).average]));
  const patch = (students: Student[]) => students.map(student => {
    const average = summaries.get(student.id);
    return average == null ? student : { ...student, score: average };
  });
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? classId;
  return {
    ...data,
    students: activeClassId === classId ? patch(data.students) : data.students,
    rosterClasses: data.rosterClasses?.map(item => item.id === classId ? { ...item, students: patch(item.students) } : item),
  };
}

export function createScoreExam(data: ClassroomData, classId: string, draft: ScoreExamDraft, createId: () => string): ScoreOperationResult {
  const subjects = cleanSubjects(draft.subjects);
  if (!subjects.length) return { error: '请填写至少一个考试科目。' };
  const students = studentsForClass(data, classId);
  if (!students.length) return { error: '当前班级没有可录入成绩的学生。' };
  const subjectMaxScores = Object.fromEntries(subjects.map(subject => [subject, 100]));
  const scoreRanges = Object.fromEntries(subjects.map(subject => [subject, defaultRanges(100)]));
  const exam: ScoreExam = {
    id: createId(), classId, title: draft.title.trim() || `考试 ${scoreExamsForClass(data, classId).length + 1}`,
    date: draft.date.trim() || localScoreDate(), subjects,
    scores: Object.fromEntries(students.map(student => [student.id, {}])),
    subjectMaxScores, scoreRanges, levels: {}, advice: {}, focusSubjects: {}, followUpStudentIds: [],
  };
  return { data: { ...data, scoreExams: [exam, ...(data.scoreExams ?? [])] }, exam };
}

export function editScoreExam(data: ClassroomData, classId: string, examId: string, draft: ScoreExamDraft): ScoreOperationResult {
  const exam = examForClass(data, classId, examId);
  if (!exam) return { error: '这场考试已不属于当前班级，请关闭后重新打开。' };
  const subjects = cleanSubjects(draft.subjects);
  if (!subjects.length) return { error: '请填写至少一个考试科目。' };
  const students = studentsForClass(data, classId);
  const scores = Object.fromEntries(students.map(student => [student.id, Object.fromEntries(subjects.flatMap(subject => {
    const value = scoreEntry(exam, student.id, subject);
    return value == null ? [] : [[subject, value]];
  }))]));
  const subjectMaxScores = Object.fromEntries(subjects.map(subject => [subject, Math.max(1, Number(exam.subjectMaxScores?.[subject]) || 100)]));
  const existingRanges = exam.scoreRanges ?? {};
  const scoreRanges = Object.fromEntries([
    ...subjects.map(subject => [subject, existingRanges[subject] ?? defaultRanges(subjectMaxScores[subject])] as const),
    ...(existingRanges.__total ? [['__total', existingRanges.__total] as const] : []),
  ]);
  const next: ScoreExam = { ...exam, classId, title: draft.title.trim() || exam.title, date: draft.date.trim() || exam.date, subjects, scores, subjectMaxScores, scoreRanges };
  return { data: replaceExam(data, next), exam: next };
}

export function setScoreEntries(data: ClassroomData, classId: string, examId: string, studentIds: readonly string[], subject: string, value: number | null): ScoreOperationResult {
  const exam = examForClass(data, classId, examId);
  if (!exam) return { error: '这场考试已不属于当前班级，请关闭后重新打开。' };
  if (!exam.subjects.includes(subject)) return { error: '所选科目已不在当前考试中。' };
  const allowedIds = new Set(studentsForClass(data, classId).map(student => student.id));
  const ids = [...new Set(studentIds)];
  if (!ids.length) return { error: '请先选择要录入成绩的学生。' };
  if (ids.some(id => !allowedIds.has(id))) return { error: '所选学生包含不属于当前班级的对象。' };
  if (value != null && !Number.isFinite(value)) return { error: '请填写有效分数。' };
  const maxScore = Math.max(1, Number(exam.subjectMaxScores?.[subject]) || 100);
  const scores = { ...exam.scores };
  for (const studentId of ids) {
    const nextStudentScores = { ...(scores[studentId] ?? {}) };
    if (value == null) delete nextStudentScores[subject];
    else nextStudentScores[subject] = Math.max(0, Math.min(maxScore, value));
    scores[studentId] = nextStudentScores;
  }
  const next = { ...exam, classId, scores };
  const withExam = replaceExam(data, next);
  return { data: patchStudentSummary(withExam, classId, ids, next), exam: next };
}

export function patchScoreExam(data: ClassroomData, classId: string, examId: string, patch: Partial<ScoreExam>): ClassroomData {
  const exam = examForClass(data, classId, examId);
  if (!exam) return data;
  return replaceExam(data, { ...exam, ...patch, id: exam.id, classId });
}

export function removeScoreExam(data: ClassroomData, classId: string, examId: string): ClassroomData {
  const exam = examForClass(data, classId, examId);
  if (!exam) return data;
  return {
    ...data,
    scoreExams: (data.scoreExams ?? []).filter(item => item.id !== examId),
    examReflections: (data.examReflections ?? []).filter(item => item.examId !== examId),
  };
}

export function addScoreKnowledgeItem(
  data: ClassroomData,
  classId: string,
  examId: string,
  draft: Omit<ScoreKnowledgeItem, 'id' | 'scores' | 'source'>,
  createId: () => string,
): ScoreOperationResult {
  const exam = examForClass(data, classId, examId);
  if (!exam) return { error: '这场考试已不属于当前班级，请关闭后重新打开。' };
  if (!draft.title.trim() || !Number.isFinite(draft.maxScore) || draft.maxScore <= 0) return { error: '请填写分析项名称和大于零的满分。' };
  const item: ScoreKnowledgeItem = {
    ...draft,
    id: createId(),
    title: draft.title.trim(),
    subject: draft.subject?.trim() || undefined,
    questionNo: draft.questionNo?.trim() || undefined,
    knowledgePoint: draft.knowledgePoint?.trim() || undefined,
    questionType: draft.questionType?.trim() || undefined,
    source: 'teacher',
    scores: {},
  };
  const next = { ...exam, classId, knowledgeItems: [...(exam.knowledgeItems ?? []), item] };
  return { data: replaceExam(data, next), exam: next };
}

export function removeScoreKnowledgeItem(data: ClassroomData, classId: string, examId: string, itemId: string): ClassroomData {
  const exam = examForClass(data, classId, examId);
  if (!exam || !(exam.knowledgeItems ?? []).some(item => item.id === itemId)) return data;
  return replaceExam(data, { ...exam, classId, knowledgeItems: (exam.knowledgeItems ?? []).filter(item => item.id !== itemId) });
}

export function setKnowledgeItemScore(data: ClassroomData, classId: string, examId: string, itemId: string, studentId: string, value: number | null): ScoreOperationResult {
  const exam = examForClass(data, classId, examId);
  if (!exam) return { error: '这场考试已不属于当前班级，请关闭后重新打开。' };
  if (!studentsForClass(data, classId).some(student => student.id === studentId)) return { error: '所选学生不属于当前班级。' };
  const item = (exam.knowledgeItems ?? []).find(candidate => candidate.id === itemId);
  if (!item) return { error: '这项分析已不存在，请重新打开。' };
  if (value != null && !Number.isFinite(value)) return { error: '请填写有效分数。' };
  const scores = { ...item.scores };
  if (value == null) delete scores[studentId];
  else scores[studentId] = Math.max(0, Math.min(item.maxScore, value));
  const next = { ...exam, classId, knowledgeItems: (exam.knowledgeItems ?? []).map(candidate => candidate.id === itemId ? { ...candidate, scores } : candidate) };
  return { data: replaceExam(data, next), exam: next };
}

export function addScorePaperAnalysis(data: ClassroomData, classId: string, examId: string, paper: ScorePaperAnalysis): ScoreOperationResult {
  const exam = examForClass(data, classId, examId);
  if (!exam) return { error: '这场考试已不属于当前班级，请关闭后重新打开。' };
  const next = { ...exam, classId, paperAnalyses: [paper, ...(exam.paperAnalyses ?? []).filter(item => item.id !== paper.id)] };
  return { data: replaceExam(data, next), exam: next };
}

export function patchScorePaperAnalysis(data: ClassroomData, classId: string, examId: string, paperId: string, patch: Partial<ScorePaperAnalysis>): ClassroomData {
  const exam = examForClass(data, classId, examId);
  if (!exam || !(exam.paperAnalyses ?? []).some(paper => paper.id === paperId)) return data;
  return replaceExam(data, { ...exam, classId, paperAnalyses: (exam.paperAnalyses ?? []).map(paper => paper.id === paperId ? { ...paper, ...patch, id: paper.id } : paper) });
}

export function confirmScorePaperAnalysis(data: ClassroomData, classId: string, examId: string, paperId: string): ScoreOperationResult {
  const exam = examForClass(data, classId, examId);
  if (!exam) return { error: '这场考试已不属于当前班级，请关闭后重新打开。' };
  const paper = (exam.paperAnalyses ?? []).find(item => item.id === paperId);
  if (!paper) return { error: '这份试卷候选已不存在，请重新打开。' };
  if (paper.status === '已确认') return { data, exam };
  if (paper.status !== '待核对') return { error: '只有待核对的候选结果可以确认。' };
  const cleanItems = (paper.items ?? []).filter(item => item.title.trim() && Number.isFinite(item.maxScore) && item.maxScore > 0).map(item => ({ ...item, title: item.title.trim(), maxScore: item.maxScore, source: 'ai' as const }));
  if (!cleanItems.length) return { error: '没有可加入统计的有效分析项。' };
  const existingIds = new Set((exam.knowledgeItems ?? []).map(item => item.id));
  const nextItems = cleanItems.filter(item => !existingIds.has(item.id));
  const next = {
    ...exam,
    classId,
    knowledgeItems: [...(exam.knowledgeItems ?? []), ...nextItems],
    paperAnalyses: (exam.paperAnalyses ?? []).map(item => item.id === paperId ? { ...item, status: '已确认' as const, items: cleanItems } : item),
  };
  return { data: replaceExam(data, next), exam: next };
}
