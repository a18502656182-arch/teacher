import type { ClassroomData } from './classroom';
import { makeId } from './classroom';
export type LearningContext = { kind: 'class'; classId: string } | { kind: 'family'; childId: string };
export type FamilyChild = { id: string; name: string; grade: string; archived?: boolean };
export type WordEntry = { id: string; text: string; meaning: string; lesson: string };
export type WordBook = { id: string; title: string; subject: string; edition: string; grade: string; term: string; entries: WordEntry[] };
export type Participant = { id: string; name: string; number: string };
// Compact result: state, wrong snapshot indexes, confirmed timestamp, note.
export type DictationResult = ['graded' | 'leave' | 'absent', number[], string, string];
export type DictationTask = { id: string; title: string; date: string; subject: string; context: LearningContext; participants: Participant[]; words: WordEntry[]; results: Record<string, DictationResult>; createdAt: string; sourceId?: string; bookId?: string; lesson?: string; archived?: boolean; homeworkId?: string };
export type DictationData = { version: 1; children: FamilyChild[]; books: WordBook[]; tasks: DictationTask[] };
export const emptyDictation = (): DictationData => ({ version: 1, children: [], books: [], tasks: [] });
export const contextKey = (c: LearningContext) => c.kind === 'class' ? `class:${c.classId}` : `family:${c.childId}`;
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const taskState = (t: DictationTask) => Object.keys(t.results).length === t.participants.length ? '已完成' : Object.keys(t.results).length ? '批改中' : '待听写';
export function parseWords(text: string): WordEntry[] {
  const seen = new Set<string>();
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).flatMap(line => {
    const [word = '', meaning = '', lesson = '第1组'] = line.split(/[\t|]/).map(s => s.trim());
    const key = `${lesson}:${word.toLocaleLowerCase()}`;
    if (!word || seen.has(key)) return [];
    if (word.length > 120 || meaning.length > 300 || lesson.length > 80) throw new Error('词语、释义或课次过长，请精简后导入');
    seen.add(key); return [{ id: makeId('word'), text: word, meaning, lesson }];
  });
}
export function statistics(tasks: DictationTask[], participantId?: string) {
  let words = 0, wrong = 0, graded = 0, leave = 0, absent = 0, pending = 0;
  for (const t of tasks) for (const p of t.participants) {
    if (participantId && p.id !== participantId) continue;
    const r = t.results[p.id];
    if (!r) pending++; else if (r[0] === 'leave') leave++; else if (r[0] === 'absent') absent++;
    else { graded++; words += t.words.length; wrong += r[1].length; }
  }
  return { words, wrong, graded, leave, absent, pending, rate: words ? wrong / words : null };
}
export function wrongWords(tasks: DictationTask[], participantId?: string) {
  const rows = new Map<string, { word: WordEntry; count: number; last: string; sourceIds: string[]; participant: Participant; subject: string }>();
  for (const t of tasks.toSorted((a,b) => a.date.localeCompare(b.date))) for (const p of t.participants) {
    if (participantId && p.id !== participantId) continue;
    const r = t.results[p.id]; if (r?.[0] !== 'graded') continue;
    for (const [i, w] of t.words.entries()) {
      const key = `${contextKey(t.context)}:${p.id}:${t.subject}:${w.text.toLocaleLowerCase()}`;
      const previous = rows.get(key);
      if (!r[1].includes(i)) { if (previous) previous.last = t.date; continue; }
      rows.set(key, { word: w, count: (previous?.count ?? 0) + 1, last: t.date, sourceIds: [...(previous?.sourceIds ?? []), t.id], participant: p, subject: t.subject });
    }
  }
  return [...rows.values()].sort((a,b) => b.count-a.count || b.last.localeCompare(a.last));
}
export function newTask(input: Omit<DictationTask, 'id' | 'createdAt' | 'results'>): DictationTask {
  if (!input.title.trim() || !input.words.length || !input.participants.length) throw new Error('请填写名称、听写材料并选择参与者');
  if (input.words.length > 200) throw new Error('每次听写最多200个词，请按课次或词组拆分');
  return { ...input, words: input.words.map(w => ({ ...w })), participants: input.participants.map(p => ({ ...p })), id: makeId('dictation'), createdAt: new Date().toISOString(), results: {} };
}
export function assertDictation(value: unknown, data: ClassroomData, previous?: ClassroomData): asserts value is DictationData | undefined {
  if (value === undefined) return;
  function fail(): never { throw new Error('听写数据或参与者归属不正确，无法保存或恢复'); }
  if (!value || typeof value !== 'object') fail();
  const d = value as DictationData;
  if (d.version !== 1 || !Array.isArray(d.children) || !Array.isArray(d.books) || !Array.isArray(d.tasks)) fail();
  const unique = (rows: { id: string }[]) => { const ids = new Set<string>(); for (const r of rows) { if (!r || typeof r.id !== 'string' || !r.id || r.id.length > 150 || ids.has(r.id)) fail(); ids.add(r.id); } };
  unique(d.children); unique(d.books); unique(d.tasks);
  const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
  const wordList = (entries: WordEntry[], max: number) => { if (!Array.isArray(entries) || entries.length > max) fail(); unique(entries); for (const w of entries) if (!text(w.text,120) || !w.text.trim() || !text(w.meaning,300) || !text(w.lesson,80)) fail(); };
  if (d.children.length > 100 || d.books.length > 500 || d.tasks.length > 3000) throw new Error('听写记录已达到容量边界，请先导出并整理历史任务');
  for (const c of d.children) if (!text(c.name,80) || !c.name.trim() || !text(c.grade,80)) fail();
  for (const b of d.books) { if (!text(b.title,120) || !text(b.subject,40) || !text(b.edition,120) || !text(b.grade,80) || !text(b.term,80)) fail(); wordList(b.entries,10000); }
  for (const t of d.tasks) {
    if (!text(t.title,120) || !text(t.subject,40) || !/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !text(t.createdAt,40) || !t.context) fail();
    wordList(t.words,200); if (!t.words.length || !Array.isArray(t.participants) || !t.participants.length || t.participants.length > 500) fail(); unique(t.participants);
    const old = previous?.dictation?.tasks.find(item => item.id === t.id);
    if (old && Object.keys(old.results).length) {
      if (contextKey(old.context) !== contextKey(t.context) || JSON.stringify(old.words) !== JSON.stringify(t.words)) throw new Error('已批改任务的场景和材料不可更改，请新建听写轮次');
    }
    const c = t.context;
    if (c.kind === 'class') {
      if ('childId' in c) fail();
      const classroom = data.rosterClasses?.find(item => item.id === c.classId); if (!classroom) fail();
      for (const p of t.participants) if (!classroom.students.some(s => s.id === p.id) && !(old && contextKey(old.context) === contextKey(c) && old.participants.some(s => s.id === p.id))) fail();
    } else if (c.kind === 'family') {
      if ('classId' in c || !d.children.some(child => child.id === c.childId) || t.participants.length !== 1 || t.participants[0].id !== c.childId) fail();
    } else fail();
    for (const p of t.participants) if (!text(p.name,80) || !text(p.number,80)) fail();
    if (!t.results || typeof t.results !== 'object' || Array.isArray(t.results)) fail();
    for (const [id, r] of Object.entries(t.results)) {
      if (!t.participants.some(p => p.id === id) || !Array.isArray(r) || r.length !== 4 || !['graded','leave','absent'].includes(r[0]) || !Array.isArray(r[1]) || !text(r[2],40) || !Number.isFinite(Date.parse(r[2])) || !text(r[3],300)) fail();
      if (new Set(r[1]).size !== r[1].length || r[1].some(i => !Number.isInteger(i) || i < 0 || i >= t.words.length) || (r[0] !== 'graded' && r[1].length)) fail();
    }
    if (t.homeworkId && !(data.homeworkTasks ?? []).some(h => h.id === t.homeworkId && c.kind === 'class' && h.classId === c.classId) && !(old?.homeworkId === t.homeworkId && contextKey(old.context) === contextKey(c))) fail();
  }
}
