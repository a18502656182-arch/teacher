"use client";

import { StudentLookupDialog } from "@/app/components/campus/StudentLookupDialog";
import { CampusIcon, ThemeArtwork } from "@/app/components/campus/primitives";
import { copyTextToClipboard } from "@/lib/clipboard";
import { makeId, scheduleTermLabel } from "@/lib/classroom";
import type { CadreRole, ClassroomData } from "@/lib/classroom";
import { useState } from "react";
import {
  cadreAppointmentText,
  cadreCandidatesForRole,
  cadreGroupNumbersForClass,
  cadreRoleGroupNumber,
  cadreRoleKind,
  cadreRolesForClass,
  cadreStudentsForClass,
  missingCadreGroups,
  removeCadreRole,
  saveCadreRole,
} from "./features/cadres/operations";
import { WorkbenchPageHeader } from "./WorkbenchPageHeader";
import styles from "./Cadres.module.css";

type CadreView = "全部" | "班委" | "小组长";
type Notice = { classId: string; text: string; tone: "info" | "error" };
type EditorState = { classId: string; draft: CadreRole; baseline: string };
type ClassSelection = { classId: string; roleId: string };
type ConfirmAction = (message: string, title?: string, confirmLabel?: string) => Promise<boolean>;

const statuses: NonNullable<CadreRole["status"]>[] = ["在任", "试用", "轮换"];

function statusClass(status: CadreRole["status"]) {
  return status === "试用" ? styles.trial : status === "轮换" ? styles.rotating : styles.active;
}

export function Cadres({ data, update, readOnly = false, mobile = false, confirmAction }: {
  data: ClassroomData;
  update: (fn: (data: ClassroomData) => ClassroomData) => void;
  readOnly?: boolean;
  mobile?: boolean;
  confirmAction: ConfirmAction;
}) {
  const classId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "";
  const activeClass = data.rosterClasses?.find(item => item.id === classId);
  const students = cadreStudentsForClass(data, classId);
  const roles = cadreRolesForClass(data, classId);
  const groups = cadreGroupNumbersForClass(data, classId);
  const missingGroups = missingCadreGroups(data, classId);
  const [view, setView] = useState<CadreView>("全部");
  const [keywordState, setKeywordState] = useState({ classId, value: "" });
  const [statusFilter, setStatusFilter] = useState<"全部状态" | NonNullable<CadreRole["status"]>>("全部状态");
  const [selection, setSelection] = useState<ClassSelection | null>(null);
  const [mobileDetail, setMobileDetail] = useState<ClassSelection | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [noticeState, setNoticeState] = useState<Notice | null>(null);
  const keyword = keywordState.classId === classId ? keywordState.value : "";
  const notice = noticeState?.classId === classId ? noticeState : null;
  const editor = editorState?.classId === classId ? editorState : null;
  const selectedId = selection?.classId === classId && roles.some(role => role.id === selection.roleId) ? selection.roleId : roles[0]?.id ?? "";
  const selectedRole = roles.find(role => role.id === selectedId);
  const showMobileDetail = mobile && mobileDetail?.classId === classId && mobileDetail.roleId === selectedRole?.id;
  const studentById = new Map(students.map(student => [student.id, student]));
  const committee = roles.filter(role => cadreRoleKind(role) === "班委");
  const leaders = roles.filter(role => cadreRoleKind(role) === "小组长");
  const scoredRoles = roles.filter(role => Number.isInteger(role.weeklyScore));
  const average = scoredRoles.length ? (scoredRoles.reduce((sum, role) => sum + Number(role.weeklyScore), 0) / scoredRoles.length).toFixed(1) : "—";
  const filteredRoles = roles.filter(role => {
    const kind = cadreRoleKind(role);
    const student = studentById.get(role.studentId);
    const matchesView = view === "全部" || kind === view;
    const matchesStatus = statusFilter === "全部状态" || (role.status ?? "在任") === statusFilter;
    const query = keyword.trim().toLocaleLowerCase("zh-CN");
    const matchesText = !query || `${role.role}${role.duty}${role.term ?? ""}${role.summary ?? ""}${student?.name ?? "待任命"}`.toLocaleLowerCase("zh-CN").includes(query);
    return matchesView && matchesStatus && matchesText;
  });

  function show(text: string, tone: Notice["tone"] = "info") {
    setNoticeState({ classId, text, tone });
  }

  function ensureWritable() {
    if (!readOnly) return true;
    show("当前为只读模式，班干部岗位未修改。", "error");
    return false;
  }

  function createDraft(kind: Exclude<CadreView, "全部">): CadreRole | null {
    if (kind === "小组长" && !groups.length) {
      show("当前班还没有有效小组，请先在学生名单中设置小组。", "error");
      return null;
    }
    const group = kind === "小组长" ? missingGroups[0] ?? groups[0] : undefined;
    const firstStudent = group ? students.find(student => student.group === group) : undefined;
    return {
      id: "",
      classId,
      role: group ? `第${group}组组长` : "新班委岗位",
      studentId: firstStudent?.id ?? "",
      duty: "",
      scope: group ? "小组管理" : "班级管理",
      groupNumber: group,
      term: scheduleTermLabel(data.scheduleConfig, activeClass?.term || "当前学期"),
      status: "在任",
      weeklyScore: 4,
      summary: "",
    };
  }

  function openNew(kind: Exclude<CadreView, "全部">) {
    if (!ensureWritable()) return;
    const draft = createDraft(kind);
    if (!draft) return;
    setEditorState({ classId, draft, baseline: JSON.stringify(draft) });
    setPickerOpen(false);
  }

  function openEditor(role: CadreRole) {
    if (!ensureWritable()) return;
    const draft = { ...role, groupNumber: cadreRoleGroupNumber(data, classId, role) };
    setEditorState({ classId, draft, baseline: JSON.stringify(draft) });
    setPickerOpen(false);
  }

  function patchDraft(patch: Partial<CadreRole>) {
    setEditorState(current => current?.classId === classId ? { ...current, draft: { ...current.draft, ...patch } } : current);
  }

  async function closeEditor() {
    if (!editor) return;
    if (JSON.stringify(editor.draft) !== editor.baseline && !await confirmAction("尚未保存的岗位内容会丢失。", "放弃本次修改？", "放弃修改")) return;
    setEditorState(null);
    setPickerOpen(false);
  }

  function changeKind(kind: Exclude<CadreView, "全部">) {
    if (!editor || cadreRoleKind(editor.draft) === kind) return;
    if (kind === "小组长") {
      const group = missingGroups[0] ?? groups[0];
      if (!group) {
        show("当前班还没有有效小组，请先在学生名单中设置小组。", "error");
        return;
      }
      const student = students.find(item => item.group === group);
      patchDraft({ role: `第${group}组组长`, scope: "小组管理", groupNumber: group, studentId: student?.id ?? "" });
      return;
    }
    patchDraft({ role: /^第?\s*\d+\s*组组长$/.test(editor.draft.role) ? "新班委岗位" : editor.draft.role, scope: "班级管理", groupNumber: undefined });
  }

  function changeGroup(group: number) {
    if (!editor) return;
    const student = students.find(item => item.group === group);
    patchDraft({ role: `第${group}组组长`, scope: "小组管理", groupNumber: group, studentId: student?.id ?? "" });
  }

  function submitRole() {
    if (!editor || !ensureWritable()) return;
    const result = saveCadreRole(data, classId, editor.draft, () => makeId("cadre"));
    if (result.error || !result.data || !result.role) {
      show(result.error ?? "岗位没有保存，请检查后重试。", "error");
      return;
    }
    update(() => result.data!);
    setSelection({ classId, roleId: result.role.id });
    if (mobile) setMobileDetail({ classId, roleId: result.role.id });
    setEditorState(null);
    setPickerOpen(false);
    show(`${editor.draft.id ? "岗位已更新" : "岗位已建立"}，本机草稿正在同步。`);
  }

  async function removeRole(role: CadreRole) {
    if (!ensureWritable()) return;
    if (!await confirmAction(`“${role.role}”会从当前班的岗位台账中移除，其他班级不受影响。`, "删除这个岗位？", "删除岗位")) return;
    const result = removeCadreRole(data, classId, role.id);
    if (result.error || !result.data) {
      show(result.error ?? "岗位没有删除，请重试。", "error");
      return;
    }
    update(() => result.data!);
    setSelection(null);
    setMobileDetail(null);
    show("岗位已移除，本机草稿正在同步。");
  }

  function selectRole(role: CadreRole) {
    const next = { classId, roleId: role.id };
    setSelection(next);
    if (mobile) setMobileDetail(next);
  }

  function copyRole(role: CadreRole) {
    void copyTextToClipboard(cadreAppointmentText(data, classId, role), "聘任内容已复制");
  }

  function copyAll() {
    const text = roles.map(role => cadreAppointmentText(data, classId, role)).join("\n");
    if (!text) {
      show("当前班还没有可复制的岗位。", "error");
      return;
    }
    void copyTextToClipboard(text, "当前班岗位内容已复制");
  }

  function renderDetail(role: CadreRole) {
    const student = studentById.get(role.studentId);
    const group = cadreRoleGroupNumber(data, classId, role);
    return <section className={styles.detailPanel} aria-label={`${role.role}详情`}>
      {mobile && <button type="button" className={styles.backButton} onClick={() => setMobileDetail(null)}><CampusIcon name="arrow" />返回岗位列表</button>}
      <header className={styles.detailHeader}>
        <span className={styles.roleSeal}><CampusIcon name="cadres" /></span>
        <div><small>{cadreRoleKind(role)}{group ? ` · 第${group}组` : ""}</small><h2>{role.role}</h2><p>{student ? `${student.name} · 学号 ${student.studentNo || "未填"}` : "待任命学生"}</p></div>
        <em className={statusClass(role.status)}>{role.status ?? "在任"}</em>
      </header>
      <dl className={styles.detailFacts}>
        <div><dt>任期</dt><dd>{role.term?.trim() || "未填写"}</dd></div>
        <div><dt>本周评价</dt><dd>{role.weeklyScore ?? "—"}<small>/5</small></dd></div>
      </dl>
      <section className={styles.detailCopy}><h3>岗位职责</h3><p>{role.duty}</p></section>
      <section className={styles.detailCopy}><h3>履职小结</h3><p>{role.summary?.trim() || "还没有填写本周履职小结。"}</p></section>
      <footer className={styles.detailActions}>
        <button type="button" disabled={readOnly} onClick={() => openEditor(role)}><CampusIcon name="edit" />编辑岗位</button>
        <button type="button" onClick={() => copyRole(role)}><CampusIcon name="copy" />复制聘任内容</button>
        <button type="button" className={styles.dangerButton} disabled={readOnly} onClick={() => void removeRole(role)}><CampusIcon name="trash" />删除岗位</button>
      </footer>
    </section>;
  }

  const roleList = <section className={styles.listPanel} aria-label="班干部岗位列表">
    <header className={styles.listHeader}><div><h2>岗位名单</h2><span>当前筛选 {filteredRoles.length} 个</span></div><button type="button" onClick={copyAll} disabled={!roles.length}><CampusIcon name="copy" />复制全部</button></header>
    <div className={styles.roleList}>{filteredRoles.map(role => {
      const student = studentById.get(role.studentId);
      const selected = role.id === selectedId;
      return <button type="button" className={styles.roleRow} aria-pressed={selected} key={role.id} onClick={() => selectRole(role)}>
        <span className={styles.roleIcon}><CampusIcon name={cadreRoleKind(role) === "小组长" ? "group" : "cadres"} /></span>
        <span className={styles.roleCopy}><b>{role.role}</b><small>{student?.name || "待任命"} · {role.duty}</small></span>
        <span className={`${styles.status} ${statusClass(role.status)}`}>{role.status ?? "在任"}</span>
        <span className={styles.rowScore}>{role.weeklyScore ?? "—"}<small>/5</small></span>
        <CampusIcon name="arrow" className={styles.rowArrow} />
      </button>;
    })}{!filteredRoles.length && <div className={styles.empty}>
      <ThemeArtwork slot={roles.length ? "empty" : "cadres"} />
      <b>{roles.length ? "没有符合条件的岗位" : "当前班还没有干部岗位"}</b>
      <p>{roles.length ? "调整岗位类型、状态或搜索词后再查看。" : students.length ? "先建立班委岗位，或按现有小组补齐小组长。" : "可以先建立一个待任命的班委岗位；小组长需先有学生和小组。"}</p>
      {!roles.length && !readOnly && <button type="button" onClick={() => openNew("班委")}>建立第一个岗位</button>}
    </div>}</div>
  </section>;

  const candidates = editor ? cadreCandidatesForRole(data, classId, editor.draft) : [];
  const assigned = editor ? students.find(student => student.id === editor.draft.studentId) : undefined;
  const editorKind = editor ? cadreRoleKind(editor.draft) : "班委";

  return <div className={`${styles.page} ${mobile ? styles.mobile : ""}`}>
    {mobile ? <header className={styles.mobileIntro}><span><CampusIcon name="cadres" /></span><div><small>{activeClass?.name ?? "当前班级"}</small><h1>班干部岗位</h1><p>{roles.length} 个岗位 · {missingGroups.length ? `${missingGroups.length} 个小组待补齐` : "岗位分工清楚"}</p></div><ThemeArtwork slot="cadres" /></header> : <WorkbenchPageHeader icon="cadres" title="班干部" description="建立班委和小组长岗位，记录职责、任期与每周履职表现。" meta={`${activeClass?.name ?? "当前班级"} · ${students.length} 名学生`} actions={<><button type="button" className={styles.secondaryButton} onClick={copyAll} disabled={!roles.length}>复制岗位内容</button><button type="button" className={styles.primaryButton} onClick={() => openNew("班委")} disabled={readOnly}>新增班委岗位</button></>} tone="iris" />}

    {notice && <button type="button" className={`${styles.notice} ${notice.tone === "error" ? styles.error : ""}`} onClick={() => setNoticeState(null)}><span>{notice.text}</span><b>关闭</b></button>}
    {readOnly && <p className={styles.readOnlyNote}><CampusIcon name="lock" />当前为只读模式，可以查看和复制岗位内容。</p>}
    {!showMobileDetail && <>
      <section className={styles.metrics} aria-label="班干部概况">
        <div><span>班委岗位</span><b>{committee.length}</b><small>含待任命岗位</small></div>
        <div><span>小组长</span><b>{leaders.length}</b><small>共 {groups.length} 个有效小组</small></div>
        <div className={missingGroups.length ? styles.warningMetric : ""}><span>待补小组</span><b>{missingGroups.length}</b><small>{missingGroups.length ? `第${missingGroups.join("、")}组` : "已覆盖现有小组"}</small></div>
        <div><span>平均评价</span><b>{average}</b><small>{scoredRoles.length ? "按已记录岗位计算" : "暂无评价"}</small></div>
      </section>

      {missingGroups.length > 0 && <p className={styles.groupWarning}><CampusIcon name="alert" />第 {missingGroups.join("、")} 组尚未建立小组长岗位；统计只依据明确的小组长岗位，不会把同组普通学生误算为组长。</p>}

      <section className={styles.toolbar} aria-label="筛选班干部岗位">
        <nav className={styles.tabs} aria-label="岗位类型">{(["全部", "班委", "小组长"] as const).map(item => <button type="button" aria-pressed={view === item} key={item} onClick={() => setView(item)}><b>{item}</b><small>{item === "全部" ? roles.length : item === "班委" ? committee.length : leaders.length}</small></button>)}</nav>
        <label className={styles.search}><CampusIcon name="search" /><span className="visually-hidden">搜索岗位或学生</span><input value={keyword} onChange={event => setKeywordState({ classId, value: event.target.value })} placeholder="搜索岗位、学生或职责" /></label>
        <label className={styles.filter}><span>状态</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}><option>全部状态</option>{statuses.map(status => <option key={status}>{status}</option>)}</select></label>
        <div className={styles.toolbarActions}><button type="button" disabled={readOnly} onClick={() => openNew("班委")}>新增班委</button><button type="button" disabled={readOnly || !groups.length} onClick={() => openNew("小组长")}>新增小组长</button></div>
      </section>
    </>}

    {showMobileDetail && selectedRole ? renderDetail(selectedRole) : <div className={styles.workspace}>{roleList}{!mobile && (selectedRole ? renderDetail(selectedRole) : <section className={styles.detailEmpty}><ThemeArtwork slot="cadres" /><h2>从左侧选择一个岗位</h2><p>查看任命学生、任期、职责和本周履职记录。</p></section>)}</div>}

    {editor && <div className={styles.backdrop} role="presentation" onMouseDown={() => void closeEditor()}><section className={styles.editor} role="dialog" aria-modal="true" aria-labelledby="cadre-editor-title" onMouseDown={event => event.stopPropagation()}>
      <header><div><small>{activeClass?.name ?? "当前班级"}</small><h2 id="cadre-editor-title">{editor.draft.id ? "编辑干部岗位" : "新增干部岗位"}</h2><p>提交后才会写入工作区；取消不会保留半成品。</p></div><button type="button" aria-label="关闭岗位编辑" onClick={() => void closeEditor()}>关闭</button></header>
      <div className={styles.editorBody}>
        <nav className={styles.kindSwitch} aria-label="岗位类型"><button type="button" aria-pressed={editorKind === "班委"} onClick={() => changeKind("班委")}>班委岗位</button><button type="button" aria-pressed={editorKind === "小组长"} disabled={!groups.length} onClick={() => changeKind("小组长")}>小组长</button></nav>
        <div className={styles.formGrid}>
          <label><span>岗位名称 <i>必填</i></span><input autoFocus value={editor.draft.role} onChange={event => patchDraft({ role: event.target.value })} placeholder="例如：学习委员" /></label>
          {editorKind === "小组长" && <label><span>负责小组 <i>必填</i></span><select value={editor.draft.groupNumber ?? ""} onChange={event => changeGroup(Number(event.target.value))}>{groups.map(group => <option key={group} value={group}>第{group}组</option>)}</select></label>}
          <label className={styles.studentField}><span>任命学生 {editorKind === "小组长" ? <i>必填</i> : <small>可稍后</small>}</span><button type="button" className={styles.studentPicker} onClick={() => setPickerOpen(true)}><span>{assigned ? <><b>{assigned.name}</b><small>学号 {assigned.studentNo || "未填"} · 第{assigned.group}组</small></> : <><b>待任命</b><small>{students.length ? "从当前班选择学生" : "当前班暂无学生"}</small></>}</span><CampusIcon name="arrow" /></button></label>
          <label><span>岗位状态</span><select value={editor.draft.status ?? "在任"} onChange={event => patchDraft({ status: event.target.value as CadreRole["status"] })}>{statuses.map(status => <option key={status}>{status}</option>)}</select></label>
          <label><span>任期 <small>可留空</small></span><input value={editor.draft.term ?? ""} onChange={event => patchDraft({ term: event.target.value })} placeholder="例如：2026秋季学期" /></label>
          <label><span>本周评价</span><select value={editor.draft.weeklyScore ?? 4} onChange={event => patchDraft({ weeklyScore: Number(event.target.value) })}>{[5, 4, 3, 2, 1].map(score => <option value={score} key={score}>{score} 分</option>)}</select></label>
          <label className={styles.wide}><span>岗位职责 <i>必填</i></span><textarea value={editor.draft.duty} onChange={event => patchDraft({ duty: event.target.value })} placeholder="写清楚要负责什么、何时检查和如何反馈" /></label>
          <label className={styles.wide}><span>履职小结 <small>可留空</small></span><textarea value={editor.draft.summary ?? ""} onChange={event => patchDraft({ summary: event.target.value })} placeholder="记录本周表现和下周提醒" /></label>
        </div>
      </div>
      <footer><button type="button" onClick={() => void closeEditor()}>取消</button><button type="button" className={styles.primaryButton} onClick={submitRole}>保存岗位</button></footer>
    </section></div>}

    {pickerOpen && editor && <StudentLookupDialog title={editorKind === "小组长" ? `选择第${editor.draft.groupNumber ?? "—"}组组长` : "选择任命学生"} subtitle={editorKind === "小组长" ? "候选人只来自当前小组" : "候选人只来自当前班级"} students={candidates} selectedId={editor.draft.studentId} allowClear={editorKind === "班委"} clearLabel="设为待任命" onPick={student => { patchDraft({ studentId: student.id }); setPickerOpen(false); }} onClear={() => patchDraft({ studentId: "" })} onClose={() => setPickerOpen(false)} />}
  </div>;
}
