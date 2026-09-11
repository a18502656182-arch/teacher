"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { CareProfile, ClassroomData, Guardian, Student } from "@/lib/classroom";
import { WorkbenchPageHeader } from "./WorkbenchPageHeader";

const categories = ["过敏与饮食", "呼吸与心血管", "视觉与感官", "行动与书写", "心理与情绪", "健康提醒", "活动注意", "座位照护", "其他"] as const;
const contexts = ["体育活动", "外出实践", "午餐饮食", "座位安排", "考试安排", "日常观察"] as const;
const severityOrder = { 紧急: 0, 重要: 1, 一般: 2 } as const;
type CareDraft = Pick<CareProfile, "id" | "studentId" | "category" | "severity" | "instruction" | "contraindication" | "reviewedAt" | "summary" | "actionContexts" | "customCategory">;

function emptyDraft(): CareDraft { return { id: "", studentId: "", category: "健康提醒", severity: "一般", summary: "", instruction: "", contraindication: "", actionContexts: [], customCategory: "", reviewedAt: new Date().toISOString().slice(0, 10) }; }
function profileCategory(profile: Pick<CareProfile, "category" | "customCategory">) { return profile.category === "其他" && profile.customCategory?.trim() ? profile.customCategory.trim() : profile.category; }
function contactLabel(guardian?: Guardian) { return guardian ? `${guardian.name}${guardian.relation ? `（${guardian.relation}）` : ""}${guardian.phone ? ` · ${guardian.phone}` : ""}` : "学生名单中暂未维护监护人联系方式"; }
function requestCareConfirm(message: string) {
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent("classroom:confirm", { detail: { message, title: "确认删除", confirmLabel: "确认删除", onResolve: resolve } }));
  });
}

export function HealthCare({ data, update, mobile = false }: { data: ClassroomData; update: (recipe: (current: ClassroomData) => ClassroomData) => void; mobile?: boolean }) {
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "";
  const activeClass = data.rosterClasses?.find((item) => item.id === activeClassId);
  const students = useMemo(() => activeClass?.students ?? data.students ?? [], [activeClass, data.students]);
  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const guardiansByStudent = useMemo(() => {
    const grouped = new Map<string, Guardian[]>();
    (data.guardians ?? []).filter((guardian) => !guardian.classId || guardian.classId === activeClassId).forEach((guardian) => grouped.set(guardian.studentId, [...(grouped.get(guardian.studentId) ?? []), guardian]));
    return new Map([...grouped].map(([studentId, guardians]) => [studentId, guardians.toSorted((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)) || (a.emergencyPriority ?? 99) - (b.emergencyPriority ?? 99))[0]]));
  }, [data.guardians, activeClassId]);
  const profiles = useMemo(() => (data.careProfiles ?? []).filter((item) => (!item.classId || item.classId === activeClassId) && studentById.has(item.studentId)).toSorted((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || (studentById.get(a.studentId)?.name ?? "").localeCompare(studentById.get(b.studentId)?.name ?? "", "zh-CN")), [data.careProfiles, activeClassId, studentById]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [severity, setSeverity] = useState<"全部" | CareProfile["severity"]>("全部");
  const [category, setCategory] = useState<"全部" | CareProfile["category"]>("全部");
  const [context, setContext] = useState("全部");
  const [draft, setDraft] = useState<CareDraft | null>(null);
  const filtered = useMemo(() => profiles.filter((item) => {
    const student = studentById.get(item.studentId);
    return (!deferredQuery || `${student?.name ?? ""} ${profileCategory(item)} ${item.summary ?? ""} ${item.instruction} ${item.contraindication ?? ""} ${(item.actionContexts ?? []).join(" ")}`.includes(deferredQuery)) && (severity === "全部" || item.severity === severity) && (category === "全部" || item.category === category) && (context === "全部" || item.actionContexts?.includes(context));
  }), [profiles, studentById, deferredQuery, severity, category, context]);
  const coveredCount = new Set(profiles.map((item) => item.studentId)).size;
  const priorityCount = profiles.filter((item) => item.severity !== "一般").length;
  const availableContexts = useMemo(() => [...new Set([...contexts, ...profiles.flatMap((item) => item.actionContexts ?? [])])], [profiles]);
  function save() {
    if (!draft?.studentId) return;
    const next: CareProfile = { ...draft, id: draft.id || `care-${Date.now()}`, classId: activeClassId, summary: draft.summary?.trim(), instruction: draft.instruction.trim(), contraindication: draft.contraindication?.trim(), customCategory: draft.category === "其他" ? draft.customCategory?.trim() : "", actionContexts: [...new Set((draft.actionContexts ?? []).map((item) => item.trim()).filter(Boolean))], visibleScope: "班主任" };
    update((current) => ({ ...current, careProfiles: [next, ...(current.careProfiles ?? []).filter((item) => item.id !== next.id)] })); setDraft(null);
  }
  async function remove() { if (!draft?.id || !await requestCareConfirm("这条照护登记会从当前班级移除，且无法恢复。")) return; update((current) => ({ ...current, careProfiles: (current.careProfiles ?? []).filter((item) => item.id !== draft.id) })); setDraft(null); }
  const newEntry = () => setDraft(emptyDraft());
  return <main className={`health-care-page ${mobile ? "health-care-mobile" : ""}`}>
    {mobile ? <div className="health-care-mobile-intro"><span className="module-icon health">🩺</span><div><h1>健康与照护</h1><p>最小必要信息 · 仅班主任可见</p></div><button className="primary-button" onClick={newEntry}>新增登记</button></div> : <WorkbenchPageHeader icon="🩺" tone="coral" title="健康与照护" description="为日常安排保留必要行动提示；不展示诊断细节，也不作为公开标签。" meta={`${activeClass?.name ?? "当前班级"} · ${students.length} 名学生`} actions={<button className="primary-button" onClick={newEntry}>新增照护登记</button>} />}
    <section className="health-care-metrics" aria-label="照护概览"><article><span>已登记学生</span><strong>{coveredCount}</strong><small>当前班级 {students.length} 名学生中的必要提示</small></article><article><span>需优先留意</span><strong>{priorityCount}</strong><small>仅用于安排前核对，不替代医疗判断</small></article></section>
    <section className="health-care-privacy"><span>🔒</span><div><strong>隐私边界</strong><p>仅记录日常安排所需的行动提示；涉及诊疗、证明或敏感原件，请按学校制度线下保管。</p></div></section>
    <section className="health-care-controls" aria-label="筛选照护记录"><label className="health-care-search"><span>搜索</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="学生、类型或行动提示" aria-label="搜索学生、类型或行动提示" /></label><label><span>优先级</span><select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)}><option>全部</option><option>紧急</option><option>重要</option><option>一般</option></select></label><label><span>关注类型</span><select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}><option>全部</option>{categories.map((item) => <option key={item} value={item}>{item === "其他" ? "自定义类型" : item}</option>)}</select></label><label><span>适用场景</span><select value={context} onChange={(event) => setContext(event.target.value)}><option>全部</option>{availableContexts.map((item) => <option key={item}>{item}</option>)}</select></label><span className="health-care-result">{filtered.length} 条记录</span></section>
    <section className="health-care-register"><header><div><h2>当前班级照护登记</h2><p>点击记录可查看或编辑；仅展示老师填写的必要提示。</p></div></header>{filtered.length ? <div className="health-care-card-list">{filtered.map((item) => { const student = studentById.get(item.studentId); return <button key={item.id} className={`health-care-card severity-${item.severity}`} onClick={() => setDraft({ ...item, summary: item.summary ?? "", instruction: item.instruction ?? "", contraindication: item.contraindication ?? "", actionContexts: item.actionContexts ?? [], customCategory: item.customCategory ?? "" })}><div className="health-care-card-top"><div><span className="student-avatar">{student?.name?.slice(0, 1) ?? "学"}</span><strong>{student?.name ?? "已移除学生"}</strong></div><span className={`care-level ${item.severity}`}>{item.severity}</span></div><span className="care-category">{profileCategory(item)}</span>{item.summary && <b>{item.summary}</b>}{item.instruction && <p>{item.instruction}</p>}{item.actionContexts?.length ? <div className="care-contexts">{item.actionContexts.map((tag) => <span key={tag}>{tag}</span>)}</div> : <small className="care-empty-detail">暂未填写适用场景</small>}</button>; })}</div> : <div className="health-care-empty"><span>🩺</span><h3>{profiles.length ? "没有符合筛选条件的记录" : "尚未建立照护登记"}</h3><p>{profiles.length ? "调整筛选条件，或清除搜索词后再查看。" : "请使用页面顶部的“新增照护登记”建立第一条记录。"}</p></div>}</section>
    {draft && <CareEditor draft={draft} students={students} guardian={guardiansByStudent.get(draft.studentId)} onChange={setDraft} onClose={() => setDraft(null)} onSave={save} onRemove={remove} />}
  </main>;
}

function StudentPicker({ students, selectedId, onSelect }: { students: Student[]; selectedId: string; onSelect: (studentId: string) => void }) {
  const selected = students.find((student) => student.id === selectedId);
  const [search, setSearch] = useState(selected?.name ?? ""); const [open, setOpen] = useState(false);
  const matches = useMemo(() => students.filter((student) => !search.trim() || `${student.name} ${student.studentNo ?? ""} ${student.group ?? ""}`.includes(search.trim())).slice(0, 8), [students, search]);
  const hasResults = open && Boolean(search.trim());
  return <div className={`care-student-picker ${hasResults ? "has-results" : ""}`}><label><span className="care-field-label">学生 <em>必选</em></span><input role="combobox" aria-expanded={hasResults} aria-controls="care-student-options" value={search} placeholder="输入姓名、学号或小组搜索" onFocus={() => setOpen(Boolean(search.trim()))} onChange={(event) => { const value = event.target.value; setSearch(value); setOpen(Boolean(value.trim())); if (selectedId) onSelect(""); }} /></label>{hasResults && <div id="care-student-options" className="care-student-options" role="listbox">{matches.length ? matches.map((student) => <button type="button" key={student.id} role="option" aria-selected={student.id === selectedId} onClick={() => { onSelect(student.id); setSearch(student.name); setOpen(false); }}><strong>{student.name}</strong><span>{student.studentNo ? `学号 ${student.studentNo}` : "未填学号"}{student.group ? ` · ${student.group}` : ""}</span></button>) : <p>没有匹配的学生</p>}</div>}</div>;
}

function CareEditor({ draft, students, guardian, onChange, onClose, onSave, onRemove }: { draft: CareDraft; students: Student[]; guardian?: Guardian; onChange: (draft: CareDraft) => void; onClose: () => void; onSave: () => void; onRemove: () => void }) {
  const valid = Boolean(draft.studentId); const set = <K extends keyof CareDraft>(key: K, value: CareDraft[K]) => onChange({ ...draft, [key]: value });
  const customContexts = (draft.actionContexts ?? []).filter((item) => !contexts.includes(item as typeof contexts[number])).join("、");
  function updateCustomContexts(value: string) { const nextCustom = value.split(/[、，,\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 8); set("actionContexts", [...(draft.actionContexts ?? []).filter((item) => contexts.includes(item as typeof contexts[number])), ...nextCustom]); }
  return <div className="health-care-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="health-care-editor" role="dialog" aria-modal="true" aria-labelledby="care-editor-title"><header><div><h2 id="care-editor-title">{draft.id ? "编辑照护登记" : "新增照护登记"}</h2><p>先选择学生，再按需要补充提示。</p></div><button className="icon-button" aria-label="关闭" onClick={onClose}>×</button></header><div className="health-care-editor-content"><div className="care-form-grid"><StudentPicker students={students} selectedId={draft.studentId} onSelect={(studentId) => set("studentId", studentId)} /><label><span className="care-field-label">关注类型</span><select value={draft.category} onChange={(event) => set("category", event.target.value as CareProfile["category"])}>{categories.map((item) => <option key={item} value={item}>{item === "其他" ? "其他（自定义）" : item}</option>)}</select></label>{draft.category === "其他" && <label className="care-field-wide"><span className="care-field-label">自定义关注类型 <i>选填</i></span><input value={draft.customCategory ?? ""} maxLength={30} placeholder="例如：临时照护安排" onChange={(event) => set("customCategory", event.target.value)} /></label>}<label><span className="care-field-label">优先级</span><select value={draft.severity} onChange={(event) => set("severity", event.target.value as CareProfile["severity"])}><option>一般</option><option>重要</option><option>紧急</option></select></label><label><span className="care-field-label">最近确认日期 <i>选填</i></span><input type="date" value={draft.reviewedAt ?? ""} onChange={(event) => set("reviewedAt", event.target.value)} /></label></div><label><span className="care-field-label">行动摘要 <i>选填</i></span><input value={draft.summary ?? ""} maxLength={40} placeholder="例如：安排在靠前位置" onChange={(event) => set("summary", event.target.value)} /></label><label><span className="care-field-label">老师需要做什么 <i>选填</i></span><textarea value={draft.instruction} maxLength={180} placeholder="请写日常安排或观察方式，不记录诊疗过程。" onChange={(event) => set("instruction", event.target.value)} /></label><label><span className="care-field-label">需避免或注意的情况 <i>选填</i></span><textarea value={draft.contraindication ?? ""} maxLength={180} placeholder="只填写日常安排所必需的信息。" onChange={(event) => set("contraindication", event.target.value)} /></label><fieldset><legend>适用场景 <span>选填</span></legend><div className="care-context-checkboxes">{contexts.map((item) => <label key={item}><input type="checkbox" checked={draft.actionContexts?.includes(item)} onChange={() => set("actionContexts", draft.actionContexts?.includes(item) ? draft.actionContexts.filter((tag) => tag !== item) : [...(draft.actionContexts ?? []), item])} />{item}</label>)}</div><label className="care-custom-context">自定义场景 <input value={customContexts} maxLength={80} placeholder="例如：午休；接送（用顿号或逗号分隔）" onChange={(event) => updateCustomContexts(event.target.value)} /></label></fieldset><div className="care-guardian"><span>学生名单中的主要监护人</span><strong>{contactLabel(guardian)}</strong><small>联系人资料同步自学生名单；如需修改，请到该学生档案维护。</small></div></div><footer>{draft.id && <button className="danger-button" onClick={onRemove}>删除记录</button>}<span /><button className="care-editor-cancel" onClick={onClose}>取消</button><button className="care-editor-save" disabled={!valid} onClick={onSave}>保存登记</button></footer></section></div>;
}
