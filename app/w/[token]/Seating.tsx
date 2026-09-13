"use client";

import { StudentLookupDialog } from "@/app/components/campus/StudentLookupDialog";
import type { ClassroomData, SeatingConfig, Student } from "@/lib/classroom";
import { useState } from "react";
import type { CSSProperties, DragEvent, FormEvent } from "react";
import {
  arrangeSeating,
  inspectSeating,
  normalizeSeatingConfig,
  patchSeatingStudent,
  regroupSeating,
  restoreSeatingSnapshot,
  rotateSeatingRows,
  saveSeatingConfig,
  seatingConfigForClass,
  seatingGroupForSeat,
  seatingLimits,
  seatingStudentsForClass,
  setSeatingGroupLeader,
  swapSeatingStudent,
  type SeatingMutationResult,
  type SeatingSnapshot,
} from "./features/seating/operations";
import { WorkbenchPageHeader } from "./WorkbenchPageHeader";
import styles from "./Seating.module.css";

type LayoutMode = "秧田式" | "小组式" | "U型";
type Notice = { classId: string; text: string; tone: "info" | "error" };
type ConfigDraft = { classId: string; rows: string; columns: string; groupCount: string; aisleAfter: string };

function draftFromConfig(classId: string, config: SeatingConfig): ConfigDraft {
  return { classId, rows: String(config.rows), columns: String(config.columns), groupCount: String(config.groupCount), aisleAfter: config.aisleAfter.join("，") };
}

export function Seating({ data, update, save, readOnly = false, mobile = false }: {
  data: ClassroomData;
  update: (fn: (data: ClassroomData) => ClassroomData) => void;
  save: () => Promise<boolean>;
  readOnly?: boolean;
  mobile?: boolean;
}) {
  const classId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "";
  const students = seatingStudentsForClass(data, classId);
  const configResult = seatingConfigForClass(data, classId);
  const fallbackConfig = normalizeSeatingConfig(undefined, students.length).config ?? { rows: 1, columns: 2, groupCount: 1, aisleAfter: [] };
  const config = configResult.config ?? fallbackConfig;
  const capacity = config.rows * config.columns;
  const integrity = inspectSeating(students, config);
  const sortedStudents = [...students].sort((left, right) => left.seat - right.seat || left.name.localeCompare(right.name, "zh-CN"));
  const studentBySeat = new Map(sortedStudents.filter(student => student.seat >= 1 && student.seat <= capacity).map(student => [student.seat, student]));
  const [selection, setSelection] = useState<{ classId: string; studentId: string } | null>(null);
  const [dragged, setDragged] = useState<{ classId: string; studentId: string } | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("秧田式");
  const [undoSnapshot, setUndoSnapshot] = useState<SeatingSnapshot | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [configDraftState, setConfigDraftState] = useState<ConfigDraft>(() => draftFromConfig(classId, config));
  const [editingSeat, setEditingSeat] = useState<{ classId: string; seat: number } | null>(null);
  const [avoidPicker, setAvoidPicker] = useState<{ classId: string; studentId: string } | null>(null);
  const [conditionSearchState, setConditionSearchState] = useState({ classId, value: "" });
  const selectedId = selection?.classId === classId ? selection.studentId : "";
  const activeUndo = undoSnapshot?.classId === classId ? undoSnapshot : null;
  const message = notice?.classId === classId ? notice : null;
  const configDraft = configDraftState.classId === classId ? configDraftState : draftFromConfig(classId, config);
  const conditionSearch = conditionSearchState.classId === classId ? conditionSearchState.value : "";
  const editingSeatNumber = editingSeat?.classId === classId ? editingSeat.seat : null;
  const avoidStudentId = avoidPicker?.classId === classId ? avoidPicker.studentId : "";
  const specialCount = students.filter(student => student.seatFixed || (student.seatNeed && student.seatNeed !== "无") || student.avoidWith).length;
  const invalidCount = integrity.invalidStudentIds.length + integrity.duplicateSeatStudentIds.length + integrity.duplicateStudentIds.length + integrity.invalidGroupStudentIds.length;
  const groups = Array.from({ length: config.groupCount }, (_, index) => {
    const number = index + 1;
    return { number, students: sortedStudents.filter(student => student.group === number) };
  });
  const shownConditions = sortedStudents.filter(student => {
    const keyword = conditionSearch.trim();
    return !keyword || `${student.name}${student.studentNo ?? ""}第${student.group}组座位${student.seat}`.includes(keyword);
  });

  function show(text: string, tone: Notice["tone"] = "info") {
    setNotice({ classId, text, tone });
  }

  function ensureWritable(): boolean {
    if (busy) return false;
    if (!readOnly) return true;
    show("当前为只读模式，座位安排未修改。", "error");
    return false;
  }

  async function apply(result: SeatingMutationResult, success: string, remember = true) {
    if (result.error || !result.data) {
      show(result.error ?? "座位调整未完成，请重试。", "error");
      return false;
    }
    update(() => result.data!);
    if (remember && result.snapshot) setUndoSnapshot(result.snapshot);
    setBusy(true);
    show("座位修改已保留在本机，正在同步工作区。");
    const ok = await save();
    setBusy(false);
    if (!ok) {
      show("座位同步失败，本机安排与撤销快照已保留，请重试或等待自动同步。", "error");
      return false;
    }
    setSelection(null);
    setDragged(null);
    show(result.warning ? `${success} ${result.warning} 服务器已确认。` : `${success} 服务器已确认。`);
    return true;
  }

  async function run(operation: () => SeatingMutationResult, success: string, remember = true) {
    if (!ensureWritable()) return false;
    return await apply(operation(), success, remember);
  }

  async function submitConfig(event: FormEvent) {
    event.preventDefault();
    if (!ensureWritable()) return;
    const rows = Number(configDraft.rows);
    const columns = Number(configDraft.columns);
    const groupCount = Number(configDraft.groupCount);
    const aisleAfter = configDraft.aisleAfter.split(/[，,、\s]+/).filter(Boolean).map(Number);
    const result = saveSeatingConfig(data, classId, { rows, columns, groupCount, aisleAfter });
    if (!await apply(result, "教室布局已更新。")) return;
    const nextConfig = seatingConfigForClass(result.data!, classId).config;
    if (nextConfig) setConfigDraftState(draftFromConfig(classId, nextConfig));
  }

  async function swap(studentId: string, targetSeat: number) {
    return run(() => swapSeatingStudent(data, classId, studentId, targetSeat), "座位已调整，可使用“撤销上一步”恢复。");
  }

  function chooseSeat(seat: number, student?: Student) {
    if (readOnly) return show("当前为只读模式，只能查看座位安排。", "error");
    if (!selectedId) {
      if (!student) {
        setEditingSeat({ classId, seat });
        return;
      }
      setSelection({ classId, studentId: student.id });
      show(`已选择 ${student.name}，再点目标学生或空座位。`);
      return;
    }
    if (student?.id === selectedId) {
      setSelection(null);
      show("已取消选择。");
      return;
    }
    void swap(selectedId, seat);
  }

  async function assignStudent(studentId: string, seat: number) {
    if (await swap(studentId, seat)) setEditingSeat(null);
  }

  async function handleDrop(event: DragEvent<HTMLButtonElement>, seat: number) {
    event.preventDefault();
    if (dragged?.classId === classId) await swap(dragged.studentId, seat);
    setDragged(null);
  }

  async function patchStudent(studentId: string, patch: Partial<Student>, success = "座位条件已更新。") {
    return await run(() => patchSeatingStudent(data, classId, studentId, patch), success, false);
  }

  async function undo() {
    if (!activeUndo || !ensureWritable()) return;
    if (await apply(restoreSeatingSnapshot(data, classId, activeUndo), "已撤销上一步座位调整。", false)) setUndoSnapshot(null);
  }

  function updateDraft(patch: Partial<ConfigDraft>) {
    setConfigDraftState({ ...configDraft, ...patch, classId });
  }

  const selectedStudent = students.find(student => student.id === selectedId);
  const editingSeatStudent = editingSeatNumber ? studentBySeat.get(editingSeatNumber) : undefined;
  const avoidTarget = students.find(student => student.id === avoidStudentId);

  return <div className={`${styles.page} ${mobile ? styles.mobile : ""}`} data-seating-surface="campus-v2">
    {!mobile && <WorkbenchPageHeader icon="🪑" tone="jade" title="座位分组" description="在同一张教室图上维护换座、特殊条件和小组组长；所有修改先进入本机草稿并由工作区统一同步。" />}

    <section className={styles.summary} aria-label="座位分组概览">
      <div><span>有效入座</span><b>{integrity.assignedCount}/{capacity}</b><small>{config.rows} 排 × {config.columns} 列</small></div>
      <div><span>当前小组</span><b>{config.groupCount}</b><small>按座位或人工调整</small></div>
      <div><span>特殊条件</span><b>{specialCount}</b><small>固定 / 方位 / 避让</small></div>
      <div className={invalidCount ? styles.warningMetric : ""}><span>待修复</span><b>{invalidCount}</b><small>{invalidCount ? "座位或小组需整理" : "座位与小组有效"}</small></div>
    </section>

    {configResult.error && <p className={`${styles.notice} ${styles.error}`} role="alert">{configResult.error}</p>}
    {message && <button type="button" className={`${styles.notice} ${message.tone === "error" ? styles.error : ""}`} onClick={() => setNotice(null)}>{message.text}<span>关闭</span></button>}
    {readOnly && <p className={styles.readOnlyNote}>只读模式：可以查看、切换构图和打印，排座、换座与条件编辑已停用。</p>}

    <section className={styles.commandBar} aria-label="座位操作">
      <div className={styles.primaryActions}>
        <button type="button" className={styles.primaryButton} disabled={readOnly || busy || Boolean(configResult.error)} onClick={() => void run(() => arrangeSeating(data, classId), "智能排座已完成；固定座已保留，并优先处理特殊条件。")}>{busy ? "同步中…" : "智能排座"}</button>
        <button type="button" disabled={readOnly || busy || Boolean(configResult.error)} onClick={() => void run(() => rotateSeatingRows(data, classId), "前后排轮换已完成，固定座未移动。")}>前后排轮换</button>
      </div>
      <details className={styles.moreActions}>
        <summary>更多操作</summary>
        <div>
          <button type="button" disabled={readOnly || busy || Boolean(configResult.error)} onClick={() => void run(() => regroupSeating(data, classId), "已按当前座位重新分组。")}>按座位更新分组</button>
          <button type="button" disabled={readOnly || busy || !activeUndo} onClick={() => void undo()}>撤销上一步</button>
          <button type="button" onClick={() => window.print()}>打印座位表</button>
        </div>
      </details>
      <div className={styles.layoutModes} aria-label="座位构图">
        {(["秧田式", "小组式", "U型"] as const).map(mode => <button type="button" aria-pressed={layoutMode === mode} className={layoutMode === mode ? styles.active : ""} onClick={() => setLayoutMode(mode)} key={mode}>{mode}</button>)}
      </div>
    </section>

    <details className={styles.configPanel}>
      <summary><span><b>教室布局</b><small>行列、分组与过道位置</small></span><em>展开配置</em></summary>
      <form onSubmit={event => void submitConfig(event)}>
        <label><span>教室排数</span><input aria-label="教室排数" type="number" min={seatingLimits.minRows} max={seatingLimits.maxRows} disabled={readOnly || busy} value={configDraft.rows} onChange={event => updateDraft({ rows: event.target.value })} /></label>
        <label><span>每排列数</span><input aria-label="每排列数" type="number" min={seatingLimits.minColumns} max={seatingLimits.maxColumns} disabled={readOnly || busy} value={configDraft.columns} onChange={event => updateDraft({ columns: event.target.value })} /></label>
        <label><span>小组数量</span><input aria-label="小组数量" type="number" min={seatingLimits.minGroups} max={seatingLimits.maxGroups} disabled={readOnly || busy} value={configDraft.groupCount} onChange={event => updateDraft({ groupCount: event.target.value })} /></label>
        <label className={styles.aisleField}><span>过道列后</span><input aria-label="过道列后" disabled={readOnly || busy} value={configDraft.aisleAfter} onChange={event => updateDraft({ aisleAfter: event.target.value })} placeholder="例如 2，4" /><small>填写列号，用逗号分隔</small></label>
        <button type="submit" disabled={readOnly || busy}>{busy ? "同步中…" : "应用布局"}</button>
      </form>
    </details>

    <div className={styles.moveGuide}>
      <b>{selectedStudent ? `已选择 ${selectedStudent.name}` : "手动换座"}</b>
      <span>{selectedStudent ? "再点另一名学生或空座位；当前班切换后不会沿用这次选择。" : "点学生后再点目标座位；点空座可直接打开学生选择器。"}</span>
      {selectedStudent && <button type="button" onClick={() => setSelection(null)}>取消选择</button>}
    </div>

    <section className={`${styles.workspace} ${layoutMode === "小组式" ? styles.clusterMode : layoutMode === "U型" ? styles.uMode : ""}`}>
      <div className={styles.boardScroll}>
        <div className={styles.board} style={{ minWidth: `${Math.max(680, config.columns * 112)}px` }}>
          <div className={styles.front}><span>前门</span><b>黑板 · 讲台</b><span>教师视角</span></div>
          <div className={styles.seatGrid} style={{ gridTemplateColumns: `repeat(${config.columns}, minmax(96px, 1fr))` }}>
            {Array.from({ length: capacity }, (_, index) => index + 1).map(seat => {
              const student = studentBySeat.get(seat);
              const column = (seat - 1) % config.columns + 1;
              const row = Math.floor((seat - 1) / config.columns) + 1;
              const aisleEdge = config.aisleAfter.includes(column);
              const uCenter = layoutMode === "U型" && row > 1 && column > 1 && column < config.columns;
              const group = seatingGroupForSeat(seat, config);
              const style = { "--seat-wash": `hsl(${(group * 43 + 160) % 360} 58% 94%)` } as CSSProperties;
              return <button
                type="button"
                key={seat}
                style={style}
                aria-label={`座位 ${seat}，${student?.name ?? "空座"}${student?.seatFixed ? "，固定座" : ""}`}
                className={`${styles.seat} ${student ? styles.occupied : styles.empty} ${student?.id === selectedId ? styles.selected : ""} ${student?.seatFixed ? styles.fixed : ""} ${aisleEdge ? styles.aisle : ""} ${uCenter ? styles.uCenter : ""}`}
                disabled={readOnly || busy || Boolean(configResult.error)}
                draggable={!readOnly && !busy && Boolean(student)}
                onDragStart={() => student && setDragged({ classId, studentId: student.id })}
                onDragEnd={() => setDragged(null)}
                onDragOver={event => event.preventDefault()}
                onDrop={event => void handleDrop(event, seat)}
                onClick={() => chooseSeat(seat, student)}
                onDoubleClick={event => { event.preventDefault(); if (!readOnly) { setSelection(null); setEditingSeat({ classId, seat }); } }}
              >
                <small>{seat}</small>
                <i aria-hidden="true">{student?.name.slice(0, 1) ?? "空"}</i>
                <b>{student?.name ?? "空座"}</b>
                <em>{student ? `${student.groupLeader ? "组长 · " : ""}第 ${student.group} 组` : "点此安排学生"}</em>
                {student && <strong>{student.seatFixed ? "固定座" : student.seatNeed && student.seatNeed !== "无" ? student.seatNeed : student.avoidWith ? "需避让" : "可调整"}</strong>}
              </button>;
            })}
          </div>
          <div className={styles.back}><span>后门</span><b>教室后方</b><span>图书角 · 卫生角</span></div>
        </div>
      </div>

      <aside className={styles.groups}>
        <header><span>分组名单</span><b>点击姓名设为组长</b></header>
        <div>
          {groups.map(group => <section key={group.number}>
            <h3>第 {group.number} 组 <small>{group.students.length} 人</small></h3>
            <p>{group.students.map(student => <button type="button" disabled={readOnly || busy} className={student.groupLeader ? styles.leader : ""} onClick={() => void run(() => setSeatingGroupLeader(data, classId, student.id), `${student.name} 已设为第 ${group.number} 组组长。`, false)} key={student.id}>{student.name}{student.groupLeader ? " · 组长" : ""}</button>)}</p>
            {!group.students.length && <p className={styles.emptyText}>暂无学生</p>}
          </section>)}
        </div>
      </aside>
    </section>

    <section className={styles.conditions}>
      <header>
        <div><span>排座条件</span><h2>特殊座位与不能同桌</h2><p>智能排座会优先处理；受固定座或容量限制时会明确提示人工复核。</p></div>
        <label><span>查找学生</span><input value={conditionSearch} onChange={event => setConditionSearchState({ classId, value: event.target.value })} placeholder="姓名、学号、小组或座位" /></label>
      </header>
      <div className={styles.conditionScroll}>
        <div className={styles.conditionTable} role="table" aria-label="学生排座条件">
          <div className={styles.conditionHead} role="row"><span>学生</span><span>座位</span><span>身高</span><span>座位需求</span><span>不能同桌</span><span>固定座</span><span>小组</span></div>
          {shownConditions.map(student => {
            const avoid = students.find(item => item.id === student.avoidWith);
            return <div className={styles.conditionRow} role="row" key={student.id}>
              <b>{student.name}<small>{student.studentNo || "未填学号"}</small></b>
              <input key={`${student.id}-seat-${student.seat}`} aria-label={`${student.name}座位`} type="number" min={1} max={capacity} disabled={readOnly} defaultValue={student.seat} onBlur={event => { if (Number(event.target.value) !== student.seat) swap(student.id, Number(event.target.value)); }}/>
              <input key={`${student.id}-height-${student.height ?? "empty"}`} aria-label={`${student.name}身高`} type="number" min={80} max={220} disabled={readOnly} defaultValue={student.height ?? ""} placeholder="选填" onBlur={event => { const next = event.target.value ? Number(event.target.value) : undefined; if (next !== student.height) patchStudent(student.id, { height: next }); }}/>
              <select aria-label={`${student.name}座位需求`} disabled={readOnly} value={student.seatNeed ?? "无"} onChange={event => patchStudent(student.id, { seatNeed: event.target.value as Student["seatNeed"] })}><option>无</option><option>前排</option><option>后排</option><option>靠窗</option><option>靠过道</option></select>
              <button type="button" disabled={readOnly} onClick={() => setAvoidPicker({ classId, studentId: student.id })}>{avoid?.name ?? "无"}<small>{avoid ? "更换" : "选择"}</small></button>
              <label className={styles.fixedToggle}><input aria-label={`${student.name}固定座`} type="checkbox" disabled={readOnly} checked={Boolean(student.seatFixed)} onChange={event => patchStudent(student.id, { seatFixed: event.target.checked })}/><span>{student.seatFixed ? "已固定" : "可调整"}</span></label>
              <select aria-label={`${student.name}小组`} disabled={readOnly} value={student.group} onChange={event => patchStudent(student.id, { group: Number(event.target.value) })}>{groups.map(group => <option key={group.number} value={group.number}>第 {group.number} 组</option>)}</select>
            </div>;
          })}
          {!shownConditions.length && <p className={styles.noResults}>{students.length ? "没有符合条件的学生。" : "当前班级还没有学生，添加名册后即可排座。"}</p>}
        </div>
      </div>
    </section>

    {editingSeatNumber && <StudentLookupDialog
      title={`选择座位 ${editingSeatNumber} 的学生`}
      subtitle={editingSeatStudent ? `当前：${editingSeatStudent.name}。选择其他学生后自动互换座位。` : "当前为空座。选择学生后会移动到这里。"}
      students={sortedStudents}
      selectedId={editingSeatStudent?.id}
      onPick={student => void assignStudent(student.id, editingSeatNumber)}
      onClose={() => setEditingSeat(null)}
    />}
    {avoidTarget && <StudentLookupDialog
      title="选择不能同桌的学生"
      subtitle={`${avoidTarget.name} 的避让对象。`}
      students={students.filter(student => student.id !== avoidTarget.id)}
      selectedId={avoidTarget.avoidWith}
      allowClear
      clearLabel="设为无"
      onPick={student => void patchStudent(avoidTarget.id, { avoidWith: student.id }).then(ok => { if (ok) setAvoidPicker(null); })}
      onClear={() => void patchStudent(avoidTarget.id, { avoidWith: "" }).then(ok => { if (ok) setAvoidPicker(null); })}
      onClose={() => setAvoidPicker(null)}
    />}
  </div>;
}
