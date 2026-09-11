"use client";

import { useMemo, useState } from "react";
import { makeId } from "@/lib/classroom";
import type { ClassroomData, NotificationDraft } from "@/lib/classroom";

type DraftInput = { title: string; content: string; channel: NotificationDraft["channel"]; recipient: string };
type ConfirmEventDetail = { message: string; title?: string; confirmLabel?: string; onResolve: (confirmed: boolean) => void };
const today = () => new Date().toISOString().slice(0, 10);
const emptyInput = (): DraftInput => ({ title: "", content: "", channel: "班级群", recipient: "__all__" });

function requestNotificationConfirm(message: string) {
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent<ConfirmEventDetail>("classroom:confirm", {
      detail: { message, title: "确认删除通知草稿", confirmLabel: "确认删除", onResolve: resolve },
    }));
  });
}

function recipientLabel(item: NotificationDraft, students: ClassroomData["students"]) {
  if (!item.recipientStudentIds?.length) return "全班家长";
  const names = item.recipientStudentIds.map((id) => students.find((student) => student.id === id)?.name).filter(Boolean);
  return names.join("、") || "已移除学生";
}

export function NotificationDrafts({ data, update, mobile = false }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; mobile?: boolean }) {
  const classId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "";
  const drafts = useMemo(() => (data.notificationDrafts ?? []).filter((item) => !item.classId || item.classId === classId), [classId, data.notificationDrafts]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [input, setInput] = useState<DraftInput>(emptyInput);
  const [error, setError] = useState("");
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [recipientKeyword, setRecipientKeyword] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const [receiptNote, setReceiptNote] = useState("");
  const recipientMatches = useMemo(() => {
    const query = recipientKeyword.trim().toLocaleLowerCase("zh-CN");
    return data.students.filter((student) => !query || `${student.name}${student.studentNo ?? ""}${student.group ?? ""}`.toLocaleLowerCase("zh-CN").includes(query)).slice(0, 20);
  }, [data.students, recipientKeyword]);
  const recipientStudent = data.students.find((student) => student.id === input.recipient);

  function openCreate() { setEditingId(""); setInput(emptyInput()); setError(""); setRecipientKeyword(""); setRecipientPickerOpen(false); setEditorOpen(true); }
  function openEdit(item: NotificationDraft) {
    setEditingId(item.id);
    setInput({ title: item.title, content: item.content, channel: item.channel, recipient: item.recipientStudentIds?.length === 1 ? item.recipientStudentIds[0] : "__all__" });
    setError(""); setRecipientKeyword(""); setRecipientPickerOpen(false); setEditorOpen(true);
  }
  function chooseRecipient(recipient: string) {
    setInput((current) => ({ ...current, recipient }));
    setRecipientPickerOpen(false);
    setRecipientKeyword("");
  }
  function save() {
    if (!input.title.trim() || !input.content.trim()) { setError("请补全通知标题和内容，再保存草稿。"); return; }
    const recipientStudentIds = input.recipient === "__all__" ? [] : [input.recipient];
    if (editingId) {
      update((current) => ({ ...current, notificationDrafts: (current.notificationDrafts ?? []).map((item) => item.id === editingId ? { ...item, title: input.title.trim(), content: input.content.trim(), channel: input.channel, recipientStudentIds } : item) }));
    } else {
      const draft: NotificationDraft = { id: makeId("notification"), classId, date: today(), title: input.title.trim(), content: input.content.trim(), channel: input.channel, recipientStudentIds, status: "草稿", createdAt: Date.now() };
      update((current) => ({ ...current, notificationDrafts: [draft, ...(current.notificationDrafts ?? [])] }));
    }
    setEditorOpen(false);
  }
  async function copy(item: NotificationDraft) {
    const text = `${item.title}\n\n${item.content}`;
    try { await navigator.clipboard.writeText(text); } catch { setError("浏览器未授予剪贴板权限，请手动复制内容。"); return; }
    update((current) => ({ ...current, notificationDrafts: (current.notificationDrafts ?? []).map((draft) => draft.id === item.id ? { ...draft, status: "已复制" } : draft) }));
  }
  function saveReceipt() {
    if (!receiptId) return;
    update((current) => ({ ...current, notificationDrafts: (current.notificationDrafts ?? []).map((item) => item.id === receiptId ? { ...item, status: "已记录回执", receiptNote: receiptNote.trim() || "已确认知晓" } : item) }));
    setReceiptId(""); setReceiptNote("");
  }
  async function remove(item: NotificationDraft) {
    if (!await requestNotificationConfirm(`通知草稿“${item.title}”会被删除，且无法恢复。`)) return;
    update((current) => ({ ...current, notificationDrafts: (current.notificationDrafts ?? []).filter((draft) => draft.id !== item.id) }));
  }

  return <section className={`notification-drafts${mobile ? " notification-drafts-mobile" : ""}`} aria-label="通知草稿与回执">
    <header><div><h2>通知草稿与回执</h2><p>生成可复制通知；发送由老师在对应渠道完成，系统不自动外发。</p></div><button type="button" className="notification-primary" onClick={openCreate}>新建草稿</button></header>
    <div className="notification-drafts-list">
      {drafts.map((item) => <article key={item.id}>
        <div className="notification-draft-main"><div><span className={`notification-status ${item.status}`}>{item.status}</span><time>{item.date} · {item.channel} · {recipientLabel(item, data.students)}</time></div><b>{item.title}</b><p>{item.content}</p>{item.receiptNote && <small>回执：{item.receiptNote}</small>}</div>
        <div className="notification-draft-actions"><button type="button" onClick={() => copy(item)}>复制通知</button><button type="button" onClick={() => { setReceiptId(item.id); setReceiptNote(item.receiptNote ?? ""); }}>记录回执</button><button type="button" onClick={() => openEdit(item)}>编辑</button><button type="button" onClick={() => remove(item)}>删除</button></div>
      </article>)}
      {!drafts.length && <p className="notification-empty">暂无通知草稿。可先把班级群或个别家长通知整理为可复制文本。</p>}
    </div>
    {error && <p className="notification-error">{error}</p>}
    {editorOpen && <div className="notification-backdrop" onClick={() => setEditorOpen(false)}><section className="notification-editor" role="dialog" aria-modal="true" aria-labelledby="notification-editor-title" onClick={(event) => event.stopPropagation()}>
      <header><div><h2 id="notification-editor-title">{editingId ? "编辑通知草稿" : "新建通知草稿"}</h2><p>保存后可复制到班级群、私聊或电话沟通记录中。</p></div><button type="button" onClick={() => setEditorOpen(false)}>关闭</button></header>
      <div className="notification-fields"><div className="notification-recipient-field"><span>通知对象</span><button type="button" className="notification-recipient-trigger" aria-haspopup="listbox" aria-expanded={recipientPickerOpen} onClick={() => setRecipientPickerOpen((open) => !open)}><b>{input.recipient === "__all__" ? "全班家长" : `${recipientStudent?.name ?? "已移除学生"}家长`}</b><small>{input.recipient === "__all__" ? "通知全部家长" : `学号 ${recipientStudent?.studentNo ?? "未填"} · 可搜索更换`}</small><span aria-hidden="true">⌄</span></button>{recipientPickerOpen && <div className="notification-recipient-menu" role="listbox" aria-label="选择通知对象"><input autoFocus value={recipientKeyword} onChange={(event) => setRecipientKeyword(event.target.value)} placeholder="搜索姓名、学号或小组" aria-label="搜索通知对象" /><button type="button" role="option" aria-selected={input.recipient === "__all__"} className={input.recipient === "__all__" ? "selected" : ""} onClick={() => chooseRecipient("__all__")}><b>全班家长</b><small>发送给当前班级全部家长</small></button>{recipientMatches.map((student) => <button type="button" role="option" aria-selected={input.recipient === student.id} className={input.recipient === student.id ? "selected" : ""} key={student.id} onClick={() => chooseRecipient(student.id)}><b>{student.name}家长</b><small>学号 {student.studentNo ?? "未填"} · 第{student.group}组</small></button>)}{!recipientMatches.length && <p>没有匹配的学生，请更换关键词。</p>}{recipientMatches.length === 20 && <em>仅显示前20条，请继续输入关键词缩小范围。</em>}</div>}</div><label><span>沟通渠道</span><select value={input.channel} onChange={(event) => setInput({ ...input, channel: event.target.value as NotificationDraft["channel"] })}><option>班级群</option><option>私聊</option><option>电话提醒</option></select></label><label className="wide"><span>标题</span><input value={input.title} onChange={(event) => setInput({ ...input, title: event.target.value })} placeholder="例如：本周作业与复习安排" /></label><label className="wide"><span>通知内容</span><textarea value={input.content} onChange={(event) => setInput({ ...input, content: event.target.value })} placeholder="说明事实、需要家长配合的事项与截止时间。" /></label></div>
      {error && <p className="notification-error">{error}</p>}<footer><button type="button" onClick={() => setEditorOpen(false)}>取消</button><button type="button" className="notification-primary" onClick={save}>保存草稿</button></footer>
    </section></div>}
    {receiptId && <div className="notification-backdrop" onClick={() => setReceiptId("")}><section className="notification-receipt" role="dialog" aria-modal="true" aria-labelledby="notification-receipt-title" onClick={(event) => event.stopPropagation()}><h2 id="notification-receipt-title">记录回执</h2><p>仅记录老师已收到的反馈，不会向家长发送任何信息。</p><textarea value={receiptNote} onChange={(event) => setReceiptNote(event.target.value)} placeholder="例如：家长已在群内回复“收到”" /><footer><button type="button" onClick={() => setReceiptId("")}>取消</button><button type="button" className="notification-primary" onClick={saveReceipt}>保存回执</button></footer></section></div>}
  </section>;
}
