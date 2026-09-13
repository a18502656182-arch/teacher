import type { ExamReflection, ScoreExam, Student } from '@/lib/classroom';
import { scoreEntry, studentScoreSummary } from './operations';

export type ScoreLevel = '优秀' | '临界' | '帮扶';
export type ScoreRange = { id: string; label: string; min: number; max: number };

export function scoreSubjects(exam: ScoreExam): string[] {
  return exam.subjects.length ? exam.subjects : ['总分'];
}

export function scoreValue(exam: ScoreExam, student: Student, subject: string): number {
  return scoreEntry(exam, student.id, subject) ?? 0;
}

export function scoreWeakSubject(exam: ScoreExam, student: Student): string {
  return studentScoreSummary(exam, student.id).weakSubject ?? '待录入';
}

export function autoScoreLevel(average: number): ScoreLevel {
  if (average < 80) return '帮扶';
  if (average < 90) return '临界';
  return '优秀';
}

export function defaultScoreAdvice(level: ScoreLevel, _weakSubject: string): string {
  if (level === '帮扶') return '安排一次错题复盘和学生面谈，先明确本周最小改进目标。';
  if (level === '临界') return '做一次阶段复盘，结合课堂表现和订正情况制定跟进动作。';
  return '保持当前节奏，整理有效学习方法，可结合学生实际做经验分享。';
}

export function parseScoreSubjects(text: string): string[] {
  return Array.from(new Set(text.split(/[，,、\s]+/).map(item => item.trim()).filter(Boolean)));
}

export function scoreSubjectKey(subject: string): string {
  return subject === '总分' ? '__total' : subject;
}

export function subjectMaxScore(exam: ScoreExam, subject: string): number {
  if (subject === '总分') return scoreSubjects(exam).reduce((sum, item) => sum + subjectMaxScore(exam, item), 0);
  return exam.subjectMaxScores?.[subject] ?? 100;
}

export function defaultScoreRanges(maxScore: number): ScoreRange[] {
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

export function scoreRangesFor(exam: ScoreExam, subject: string): ScoreRange[] {
  const key = scoreSubjectKey(subject);
  return exam.scoreRanges?.[key]?.length ? exam.scoreRanges[key] : defaultScoreRanges(subjectMaxScore(exam, subject));
}

export function scoreRowsFor(exam: ScoreExam, students: Student[], reflections: ExamReflection[]) {
  return students.map(student => {
    const summary = studentScoreSummary(exam, student.id);
    const total = summary.total ?? 0;
    const average = summary.average ?? 0;
    const weakSubject = exam.focusSubjects?.[student.id] ?? scoreWeakSubject(exam, student);
    const level = (exam.levels?.[student.id] as ScoreLevel | undefined) ?? autoScoreLevel(average);
    const advice = exam.advice?.[student.id] ?? (summary.enteredCount ? defaultScoreAdvice(level, weakSubject) : '成绩尚未录入，暂不生成跟进结论。');
    const hasReflection = reflections.some(item => item.studentId === student.id && item.examId === exam.id);
    const followUp = Boolean(exam.followUpStudentIds?.includes(student.id));
    return { student, total, average, weakSubject, level, advice, hasReflection, followUp, enteredCount: summary.enteredCount, complete: summary.complete };
  });
}
