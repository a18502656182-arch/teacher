import type { DictationData, DictationTask, FamilyChild } from "@/lib/dictation";
import { contextKey, statistics, today, wrongWords } from "@/lib/dictation";

export type FamilyChildDraft = Pick<FamilyChild, "id" | "name" | "grade" | "archived">;

export function familyChildren(data: DictationData) {
  return data.children.slice();
}

export function familyChild(data: DictationData, childId: string) {
  return data.children.find(child => child.id === childId);
}

export function familyTasks(data: DictationData, childId: string) {
  if (!childId) return [];
  const key = contextKey({ kind: "family", childId });
  return data.tasks.filter(task => contextKey(task.context) === key);
}

export function saveFamilyChild(data: DictationData, draft: FamilyChildDraft, idFactory: () => string) {
  const name = draft.name.trim();
  const grade = draft.grade.trim();
  if (!name) return { error: "请填写孩子姓名" };
  if (name.length > 80 || grade.length > 80) return { error: "姓名或年级过长，请精简后保存" };
  const existing = draft.id ? data.children.find(child => child.id === draft.id) : undefined;
  if (draft.id && !existing) return { error: "孩子档案已变化，请刷新后重试" };
  const child: FamilyChild = { id: existing?.id ?? idFactory(), name, grade, archived: existing?.archived ?? false };
  if (!child.id || data.children.some(item => item.id === child.id && item.id !== existing?.id)) return { error: "孩子档案编号重复，请重试" };
  return {
    child,
    data: {
      ...data,
      children: existing ? data.children.map(item => item.id === existing.id ? child : item) : [...data.children, child],
    },
  };
}

export function setFamilyChildArchived(data: DictationData, childId: string, archived: boolean) {
  const child = familyChild(data, childId);
  if (!child) return { error: "孩子档案已变化，请刷新后重试" };
  return {
    child: { ...child, archived },
    data: { ...data, children: data.children.map(item => item.id === childId ? { ...item, archived } : item) },
  };
}

export function familyOverview(data: DictationData, childId: string, currentDate = today()) {
  const tasks = familyTasks(data, childId);
  const todayTasks = tasks.filter(task => task.date === currentDate && !task.archived).toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  const cutoff = new Date(`${currentDate}T12:00:00`);
  cutoff.setDate(cutoff.getDate() - 29);
  const from = cutoff.toLocaleDateString("sv-SE");
  const recentTasks = tasks.filter(task => task.date >= from && task.date <= currentDate);
  const stats = statistics(recentTasks, childId);
  const wrong = wrongWords(tasks, childId);
  return {
    tasks,
    todayTasks,
    recentTasks,
    stats,
    wrong,
    pending: tasks.filter(task => !task.archived).reduce((count, task) => count + task.participants.filter(person => person.id === childId && !task.results[person.id]).length, 0),
  };
}

export function familyTaskBelongsToChild(task: DictationTask, childId: string) {
  return task.context.kind === "family" && task.context.childId === childId && task.participants.length === 1 && task.participants[0]?.id === childId;
}
