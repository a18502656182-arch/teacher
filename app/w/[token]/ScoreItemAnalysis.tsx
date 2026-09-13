"use client";

import { useMemo, useRef, useState } from "react";
import type { ClassroomData, ScoreExam, ScoreKnowledgeItem, ScorePaperAnalysis, Student } from "@/lib/classroom";
import { addScoreKnowledgeItem, addScorePaperAnalysis, confirmScorePaperAnalysis, patchScorePaperAnalysis, removeScoreKnowledgeItem, setKnowledgeItemScore } from "./features/scores/operations";

type ItemDraft = { title: string; subject: string; questionNo: string; knowledgePoint: string; questionType: string; maxScore: string };
const emptyDraft = (): ItemDraft => ({ title: "", subject: "", questionNo: "", knowledgePoint: "", questionType: "", maxScore: "10" });
const id = () => globalThis.crypto?.randomUUID?.() ?? `paper-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function itemRate(item: ScoreKnowledgeItem, students: Student[]) {
  const entered = students.map((student) => item.scores[student.id]).filter((value): value is number => value != null);
  return { entered: entered.length, value: entered.length && item.maxScore > 0 ? Math.round(entered.reduce((sum, value) => sum + value, 0) / entered.length / item.maxScore * 100) : null };
}

function statusClass(status: ScorePaperAnalysis["status"]) { return status === "已确认" ? "confirmed" : status === "待核对" ? "review" : status === "失败" ? "failed" : "pending"; }

export function ScoreItemAnalysis({ data: classroomData, classId, exam, students, update, save, readOnly, workspaceToken }: { data: ClassroomData; classId: string; exam: ScoreExam; students: Student[]; update: (fn: (data: ClassroomData) => ClassroomData) => void; save: () => Promise<boolean>; readOnly: boolean; workspaceToken?: string }) {
  const items = useMemo(() => exam.knowledgeItems ?? [], [exam.knowledgeItems]);
  const papers = useMemo(() => exam.paperAnalyses ?? [], [exam.paperAnalyses]);
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft);
  const [recordingId, setRecordingId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const weakest = useMemo(() => items.map((item) => ({ item, ...itemRate(item, students) })).filter((item) => item.value != null).toSorted((a, b) => a.value! - b.value!), [items, students]);
  const selectedPaper = papers.find((paper) => paper.id === selectedPaperId) ?? papers[0];
  const reviewItems = selectedPaper?.items ?? [];

  async function create() {
    if (readOnly || saving) return;
    const maxScore = Number(draft.maxScore);
    const input = { title: draft.title, subject: draft.subject, questionNo: draft.questionNo, knowledgePoint: draft.knowledgePoint, questionType: draft.questionType, maxScore, confidence: undefined };
    const itemId = id();
    const preview = addScoreKnowledgeItem(classroomData, classId, exam.id, input, () => itemId);
    if (preview.error) { setError(preview.error); return; }
    update((data) => addScoreKnowledgeItem(data, classId, exam.id, input, () => itemId).data ?? data);
    setSaving(true); setError("");
    const ok = await save(); setSaving(false);
    if (!ok) { setError("同步失败，本机新增的分析项已保留；表单内容不会清空。"); return; }
    setDraft(emptyDraft());
  }
  async function remove(idValue: string) {
    if (readOnly || saving) return;
    update((data) => removeScoreKnowledgeItem(data, classId, exam.id, idValue));
    setSaving(true); setError("");
    const ok = await save(); setSaving(false);
    if (!ok) { setError("删除同步失败，本机修改已保留；请重试保存。"); return; }
    if (recordingId === idValue) setRecordingId("");
  }
  function changeScore(item: ScoreKnowledgeItem, studentId: string, value: string) {
    if (readOnly) return;
    const numeric = value.trim() === "" ? null : Number(value);
    update((data) => setKnowledgeItemScore(data, classId, exam.id, item.id, studentId, numeric).data ?? data);
  }
  function patchPaper(paperId: string, patch: Partial<ScorePaperAnalysis>) {
    if (readOnly) return;
    update((data) => patchScorePaperAnalysis(data, classId, exam.id, paperId, patch));
  }
  function selectFile(next: File | null) {
    if (!next) { setFile(null); return; }
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(next.type) || next.size <= 0 || next.size > 12 * 1024 * 1024) {
      setFile(null); setError("仅支持不超过 12MB 的 JPG、PNG、WEBP 或 PDF 试卷。"); return;
    }
    setFile(next); setError("");
  }
  function patchReviewItem(index: number, patch: Partial<ScoreKnowledgeItem>) {
    if (readOnly || !selectedPaper) return;
    patchPaper(selectedPaper.id, { items: reviewItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  }
  async function analyzePaper() {
    if (readOnly || uploading || saving) return;
    if (!file) { setError("请先选择 JPG、PNG、WEBP 或 PDF 试卷。"); return; }
    if (!workspaceToken || workspaceToken === "demo") { setError("演示模式不发送试卷文件。请在正式工作台配置识别服务后使用。" ); return; }
    const paper: ScorePaperAnalysis = { id: id(), sourceName: file.name, sourceType: file.type || "unknown", sourceSize: file.size, createdAt: new Date().toISOString(), status: "识别中" };
    update((data) => addScorePaperAnalysis(data, classId, exam.id, paper).data ?? data);
    setSelectedPaperId(paper.id); setUploading(true); setError("");
    if (!await save()) { setUploading(false); setError("试卷任务同步失败，本机任务已保留；请重试保存后再识别。"); return; }
    try {
      const form = new FormData(); form.set("workspaceToken", workspaceToken); form.set("examId", exam.id); form.set("file", file);
      const response = await fetch("/api/ai/exam-paper", { method: "POST", body: form });
      const result = await response.json().catch(() => ({})) as { items?: Array<Omit<ScoreKnowledgeItem, "id" | "scores" | "source">>; error?: string; message?: string };
      if (!response.ok || !result.items?.length) throw new Error(result.error || "识别服务没有返回题目");
      const parsed = result.items.map((item) => ({ ...item, id: id(), scores: {}, source: "ai" as const }));
      update((data) => patchScorePaperAnalysis(data, classId, exam.id, paper.id, { status: "待核对", message: result.message, items: parsed }));
      if (!await save()) setError("识别结果已保留在本机，但同步失败；请重试保存后再确认。");
      setFile(null); if (fileRef.current) fileRef.current.value = "";
    } catch (uploadError) {
      patchPaper(paper.id, { status: "失败", message: uploadError instanceof Error ? uploadError.message : "试卷识别失败" });
      await save();
      setError(uploadError instanceof Error ? uploadError.message : "试卷识别失败");
    } finally { setUploading(false); }
  }
  async function confirmPaper() {
    if (readOnly || saving || !selectedPaper) return;
    const preview = confirmScorePaperAnalysis(classroomData, classId, exam.id, selectedPaper.id);
    if (preview.error) { setError(preview.error); return; }
    setError("");
    update((data) => confirmScorePaperAnalysis(data, classId, exam.id, selectedPaper.id).data ?? data);
    setSaving(true);
    const ok = await save(); setSaving(false);
    if (!ok) setError("确认结果同步失败，本机修改已保留；请重试保存。");
  }

  return <section className="score-item-analysis score-analysis-center" aria-label="试卷与知识点分析">
    <header><div><h2>试卷与知识点分析</h2><p>上传后先由 AI 提取题号、题型和知识点，再由老师核对；只有确认后的项目才进入统计。</p></div><div className="score-analysis-status"><b>{papers.length}</b><span>份试卷记录</span></div></header>
    <section className="score-paper-upload"><div><b>上传试卷</b><p>支持 JPG、PNG、WEBP、PDF，单份不超过 12MB。原文件只发送给已配置的识别服务，不写入工作台 JSON。</p></div><label className={file ? "selected" : ""} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!readOnly) selectFile(event.dataTransfer.files?.[0] ?? null); }}><input ref={fileRef} disabled={readOnly || uploading || saving} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} /><strong>{file ? file.name : "选择或拖入试卷"}</strong><small>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB · 等待识别` : "图片或 PDF"}</small></label><button className="score-item-primary" type="button" disabled={readOnly || saving || !file || uploading} onClick={() => void analyzePaper()}>{uploading ? "识别中…" : saving ? "保存中…" : "开始 AI 识别"}</button></section>
    {error && <p className="score-item-error" role="alert">{error}</p>}
    <section className="score-analysis-guide"><b>识别服务接入状态</b><span>部署者需在服务器配置 `EXAM_AI_ENDPOINT` 与 `EXAM_AI_API_KEY`。密钥不进入浏览器；未配置时不会伪造识别结论。</span></section>
    <section className="score-paper-workspace">
      <aside className="score-paper-list"><header><h3>试卷任务</h3><span>{papers.length} 份</span></header>{papers.map((paper) => <button type="button" className={paper.id === selectedPaper?.id ? "active" : ""} key={paper.id} onClick={() => setSelectedPaperId(paper.id)}><span><b>{paper.sourceName}</b><small>{new Date(paper.createdAt).toLocaleDateString("zh-CN")} · {Math.max(1, Math.round(paper.sourceSize / 1024))} KB</small></span><em className={statusClass(paper.status)}>{paper.status}</em></button>)}{!papers.length && <p>尚未上传试卷。也可以先手动建立分析项目。</p>}</aside>
      <section className="score-paper-review"><header><div><h3>{selectedPaper ? selectedPaper.sourceName : "待核对项目"}</h3><p>{selectedPaper?.message || "上传并识别后，在这里检查题号、知识点和分值。"}</p></div>{selectedPaper?.status === "待核对" && <button className="score-item-primary" type="button" disabled={readOnly || saving} onClick={() => void confirmPaper()}>{saving ? "保存中…" : "确认并加入统计"}</button>}</header>{selectedPaper?.status === "识别中" ? <p className="score-paper-pending">正在识别试卷，请勿关闭页面。</p> : selectedPaper?.status === "失败" ? <p className="score-paper-pending error">{selectedPaper.message || "识别失败，可重试上传或手动建立项目。"}</p> : reviewItems.length ? <div className="score-paper-review-list">{reviewItems.map((item, index) => <article key={item.id}><label><span>题号</span><input disabled={readOnly} value={item.questionNo ?? ""} onChange={(event) => patchReviewItem(index, { questionNo: event.target.value })} placeholder="例如 3" /></label><label><span>分析项</span><input disabled={readOnly} value={item.title} onChange={(event) => patchReviewItem(index, { title: event.target.value })} /></label><label><span>知识点</span><input disabled={readOnly} value={item.knowledgePoint ?? ""} onChange={(event) => patchReviewItem(index, { knowledgePoint: event.target.value })} placeholder="可修改" /></label><label><span>满分</span><input disabled={readOnly} type="number" min="0.5" value={item.maxScore} onChange={(event) => patchReviewItem(index, { maxScore: Math.max(.5, Number(event.target.value) || .5) })} /></label><small>{item.subject || "未标注科目"} · {item.questionType || "未标注题型"} · AI 置信度 {Math.round((item.confidence ?? 0) * 100)}%</small></article>)}</div> : <p className="score-paper-pending">选择一份试卷后，可在此核对 AI 提取的项目。</p>}</section>
    </section>
    <section className="score-analysis-manual"><header><div><h3>人工补充分析项</h3><p>用于没有试卷、AI 未覆盖或需要合并分析的题目和知识点。</p></div></header><div><label><span>题号</span><input disabled={readOnly} value={draft.questionNo} onChange={(event) => setDraft({ ...draft, questionNo: event.target.value })} placeholder="例如 12" /></label><label><span>分析项</span><input disabled={readOnly} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如 阅读理解第 3 题" /></label><label><span>科目</span><select disabled={readOnly} value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })}><option value="">未标注</option>{exam.subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label><label><span>知识点</span><input disabled={readOnly} value={draft.knowledgePoint} onChange={(event) => setDraft({ ...draft, knowledgePoint: event.target.value })} placeholder="例如 句型转换" /></label><label><span>题型</span><input disabled={readOnly} value={draft.questionType} onChange={(event) => setDraft({ ...draft, questionType: event.target.value })} placeholder="例如 填空" /></label><label><span>满分</span><input disabled={readOnly} type="number" min="0.5" value={draft.maxScore} onChange={(event) => setDraft({ ...draft, maxScore: event.target.value })} /></label><button className="score-item-primary" type="button" disabled={readOnly || saving} onClick={() => void create()}>{saving ? "保存中…" : "加入分析"}</button></div></section>
    <section className="score-analysis-items"><header><div><h3>已确认分析项</h3><p>空白为未录入，不按零分计算；系统不自动给学生或班级下结论。</p></div><span>{items.length} 项</span></header>{items.length ? <div className="score-item-list">{items.map((item) => { const summary = itemRate(item, students); return <article key={item.id}><div><b>{item.questionNo ? `${item.questionNo}. ` : ""}{item.title}</b><span>{item.subject || "未标注科目"}{item.knowledgePoint ? ` · ${item.knowledgePoint}` : ""} · 满分 {item.maxScore} 分</span></div><strong>{summary.value == null ? "未录入" : `${summary.value}%`}</strong><small>{summary.entered}/{students.length} 人已录入 · {item.source === "ai" ? "来自已核对试卷" : "人工建立"}</small><div className="score-item-actions"><button type="button" onClick={() => setRecordingId(recordingId === item.id ? "" : item.id)}>{recordingId === item.id ? "收起录分" : "录入分数"}</button><button type="button" disabled={readOnly || saving} onClick={() => void remove(item.id)}>删除</button></div>{recordingId === item.id && <div className="score-item-entry">{students.map((student) => <label key={student.id}><span>{student.name}</span><input disabled={readOnly} aria-label={`${item.title} ${student.name} 分数`} type="number" min="0" max={item.maxScore} value={item.scores[student.id] ?? ""} onChange={(event) => changeScore(item, student.id, event.target.value)} placeholder="未录入" /></label>)}</div>}</article>; })}</div> : <p className="score-item-empty">尚无已确认分析项。可上传试卷进行识别，或在上方人工补充。</p>}<p className="score-item-note">{weakest.length ? `当前最低得分率：${weakest[0].item.title}（${weakest[0].value}%）。请结合题目难度、缺考与录入覆盖率判断。` : "录入至少一名学生的分析项分数后，才会显示得分率比较。"}</p></section>
  </section>;
}
