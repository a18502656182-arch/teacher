"use client";

import { CampusIcon, ThemeArtwork } from "@/app/components/campus/primitives";
import type { DictationTask, FamilyChild } from "@/lib/dictation";
import { taskState } from "@/lib/dictation";
import { useEffect, useMemo, useState } from "react";
import type { FamilyChildDraft } from "../features/family/operations";
import styles from "./FamilyScene.module.css";

type ConfirmAction = (message: string, title?: string, confirmLabel?: string) => Promise<boolean>;

export function FamilyHeader({ profiles, child, tasks, pending, wrongCount, readOnly, onSelect, onManage, onNew, onClass }: {
  profiles: FamilyChild[];
  child?: FamilyChild;
  tasks: number;
  pending: number;
  wrongCount: number;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onManage: () => void;
  onNew: () => void;
  onClass: () => void;
}) {
  return <>
    <header className={styles.header}>
      <div className={styles.headerCopy}><span className={styles.eyebrow}><CampusIcon name="home" />家庭学习</span><h2>{child ? `${child.name}的听写计划` : "先建立孩子档案"}</h2><p>{child ? `${tasks} 次历史任务 · ${pending} 人次待批改 · ${wrongCount} 个个人错词` : "孩子档案与班级名册完全独立，建立后再安排每日听写。"}</p></div>
      <ThemeArtwork slot="family" />
      <div className={styles.headerActions}><button type="button" className={styles.backToClass} onClick={onClass}><CampusIcon name="school" />班级教学</button><button type="button" onClick={onManage}><CampusIcon name="user" />管理孩子</button><button type="button" className={styles.primary} onClick={child ? onNew : onManage} disabled={readOnly || Boolean(child?.archived)}><CampusIcon name="plus" />{child?.archived ? "档案已归档" : child ? "新建听写" : "新增孩子"}</button></div>
    </header>
    <section className={styles.childSwitch} aria-label="切换家庭孩子">
      <div><span>当前孩子</span><small>每个孩子使用独立任务、批改记录和错词统计</small></div>
      <nav>{profiles.map(item => <button type="button" key={item.id} aria-pressed={item.id === child?.id} onClick={() => onSelect(item.id)}><span><CampusIcon name="user" /></span><b>{item.name}</b><small>{item.grade || "年级未填"}{item.archived ? " · 已归档" : ""}</small></button>)}{!profiles.length && <p>还没有孩子档案</p>}</nav>
      <button type="button" className={styles.manageLink} onClick={onManage}>档案设置 <CampusIcon name="arrow" /></button>
    </section>
  </>;
}

export function FamilyToday({ child, tasks, wrongCount, readOnly, onNew, onOpen, onWrong }: {
  child?: FamilyChild;
  tasks: DictationTask[];
  wrongCount: number;
  readOnly: boolean;
  onNew: () => void;
  onOpen: (task: DictationTask) => void;
  onWrong: () => void;
}) {
  if (!child) return <section className={styles.emptyToday}><ThemeArtwork slot="family" /><div><h3>先为家庭学习建立孩子档案</h3><p>这里不会读取班级名册，也不会把家庭孩子加入任何班级。</p></div></section>;
  return <section className={styles.today}>
    <header><div><span>今日安排</span><h3>{child.archived ? `${child.name}的档案已归档` : `${child.name}今天的听写`}</h3><p>{tasks.length ? `已有 ${tasks.length} 个任务，打开后人工报词并确认批改。` : "今天还没有任务，可从词库选课次或粘贴自定义内容。"}</p></div><button type="button" onClick={onNew} disabled={readOnly || Boolean(child.archived)}><CampusIcon name="plus" />准备听写</button></header>
    {tasks.length ? <div className={styles.todayTasks}>{tasks.map(task => <button type="button" key={task.id} onClick={() => onOpen(task)}><span className={styles.taskIcon}><CampusIcon name="dictation" /></span><span><b>{task.title}</b><small>{task.subject} · {task.lesson || "自定义内容"} · {task.words.length}词</small></span><em data-state={taskState(task)}>{taskState(task)}</em><CampusIcon name="arrow" /></button>)}</div> : <div className={styles.todayBlank}><span><CampusIcon name="book" /></span><p>任务建立后会保存本次材料快照，后续修改词库不会追改这次听写。</p></div>}
    <footer><button type="button" onClick={onWrong}><CampusIcon name="reflection" /><span><b>个人错词复习</b><small>{wrongCount ? `${wrongCount} 个已确认错词待查看` : "暂无已确认错词"}</small></span><CampusIcon name="arrow" /></button></footer>
  </section>;
}

export function FamilyChildrenPanel({ profiles, activeId, busy, readOnly, onSelect, onSave, onArchive, confirmAction }: {
  profiles: FamilyChild[];
  activeId: string;
  busy: boolean;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onSave: (draft: FamilyChildDraft) => Promise<FamilyChild | undefined>;
  onArchive: (child: FamilyChild) => Promise<void>;
  confirmAction: ConfirmAction;
}) {
  const [editor, setEditor] = useState<FamilyChildDraft | null>(null);
  const [baseline, setBaseline] = useState("");
  const [error, setError] = useState("");
  const dirty = Boolean(editor && JSON.stringify(editor) !== baseline);
  const sorted = useMemo(() => profiles.toSorted((a, b) => Number(Boolean(a.archived)) - Number(Boolean(b.archived))), [profiles]);

  useEffect(() => {
    if (!dirty || busy) return;
    const guard = (event: Event) => { event.preventDefault(); setError("孩子档案还有未保存内容，请先保存或取消。"); };
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("classroom:before-navigate", guard);
    window.addEventListener("beforeunload", unload);
    return () => { window.removeEventListener("classroom:before-navigate", guard); window.removeEventListener("beforeunload", unload); };
  }, [dirty, busy]);

  function open(draft: FamilyChildDraft) {
    setEditor({ ...draft });
    setBaseline(JSON.stringify(draft));
    setError("");
  }

  async function close() {
    if (dirty && !await confirmAction("尚未保存的孩子档案内容会丢失。", "放弃本次修改？", "放弃修改")) return;
    setEditor(null);
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy || readOnly) return;
    setError("");
    const saved = await onSave(editor);
    if (!saved) { setError("档案没有保存，请核对提示后重试。"); return; }
    setEditor(null);
  }

  return <section className={styles.childrenPanel}>
    <header><div><span>家庭成员</span><h3>孩子档案</h3><p>孩子只用于当前账户的家庭听写；重名也按独立档案和ID保存。</p></div><button type="button" onClick={() => open({ id: "", name: "", grade: "", archived: false })} disabled={readOnly || busy}><CampusIcon name="plus" />新增孩子</button></header>
    {editor && <form className={styles.childEditor} onSubmit={submit}>
      <div><label><span>孩子姓名 <i>必填</i></span><input autoFocus maxLength={80} value={editor.name} onChange={event => setEditor({ ...editor, name: event.target.value })} placeholder="例如：小禾" /></label><label><span>年级 <small>可留空</small></span><input maxLength={80} value={editor.grade} onChange={event => setEditor({ ...editor, grade: event.target.value })} placeholder="例如：三年级" /></label></div>
      {error && <p role="alert">{error}</p>}
      <footer><button type="button" onClick={() => void close()} disabled={busy}>取消</button><button type="submit" className={styles.primary} disabled={busy || readOnly}>{busy ? "保存中…" : "保存档案"}</button></footer>
    </form>}
    {!sorted.length ? <div className={styles.childrenEmpty}><ThemeArtwork slot="family" /><b>还没有孩子档案</b><p>新增后可切换孩子，建立各自的每日听写和错词记录。</p></div> : <div className={styles.childrenList}>{sorted.map(item => <article key={item.id} data-active={item.id === activeId}><span><CampusIcon name="user" /></span><div><b>{item.name}</b><small>{item.grade || "年级未填写"} · {item.archived ? "已归档，历史仍保留" : "使用中"}</small></div><nav><button type="button" onClick={() => onSelect(item.id)}>查看任务</button><button type="button" onClick={() => open(item)} disabled={readOnly || busy}>编辑</button><button type="button" onClick={() => void onArchive(item)} disabled={readOnly || busy}>{item.archived ? "恢复" : "归档"}</button></nav></article>)}</div>}
  </section>;
}
