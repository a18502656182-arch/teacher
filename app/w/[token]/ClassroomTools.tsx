"use client";

import { copyTextToClipboard } from "@/lib/clipboard";
import { makeId } from "@/lib/classroom";
import type { ClassroomData, Student } from "@/lib/classroom";
import { useMemo, useState } from "react";
import {
  classroomToolSessionsForClass,
  createTemporaryGrouping,
  drawClassroomStudent,
  eligibleClassroomToolStudents,
  formatTemporaryGrouping,
  localToolDate,
} from "./features/tools/operations";
import { WorkbenchPageHeader } from "./WorkbenchPageHeader";
import styles from "./ClassroomTools.module.css";

const today = () => localToolDate();

export function ClassroomTools({ data, update, readOnly = false }: {
  data: ClassroomData;
  update: (fn: (d: ClassroomData) => ClassroomData) => void;
  readOnly?: boolean;
}) {
  const classId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "";
  const students = data.rosterClasses?.find((item) => item.id === classId)?.students ?? data.students;
  const currentDate = today();
  const [round, setRound] = useState<{ classId: string; ids: string[] }>({ classId, ids: [] });
  const picked = round.classId === classId ? round.ids : [];
  const [groupCount, setGroupCount] = useState(6);
  const [historyId, setHistoryId] = useState("");
  const [notice, setNotice] = useState<{ classId: string; text: string }>({ classId, text: "" });
  const message = notice.classId === classId ? notice.text : "";
  const eligibility = useMemo(() => eligibleClassroomToolStudents(data, classId, currentDate), [classId, currentDate, data]);
  const candidates = eligibility.students;
  const selected = picked
    .map((id) => students.find((student) => student.id === id))
    .filter((student): student is Student => Boolean(student));
  const groupSessions = useMemo(() => classroomToolSessionsForClass(data, classId), [classId, data]);
  const selectedHistory = groupSessions.find((session) => session.id === historyId);
  const latestSession = selectedHistory ?? groupSessions[0];
  const viewingHistory = Boolean(selectedHistory && groupSessions[0]?.id !== selectedHistory.id);

  function showMessage(text: string) {
    setNotice({ classId, text });
  }

  function draw() {
    const result = drawClassroomStudent(data, classId, currentDate, picked);
    if (result.error) {
      showMessage(result.error);
      return;
    }
    setRound({ classId, ids: result.pickedIds });
    showMessage(result.complete ? "本轮可参与学生已全部抽取。" : `已抽取第 ${result.pickedIds.length} 名学生。`);
  }

  function resetRound() {
    setRound({ classId, ids: [] });
    showMessage("已重置本轮点名。");
  }

  function makeGroups() {
    if (readOnly) {
      showMessage("当前为只读模式，不能保存新的临时分组。");
      return;
    }
    const result = createTemporaryGrouping(data, classId, currentDate, groupCount, () => makeId("tool-session"), Date.now());
    if ("error" in result) {
      showMessage(result.error);
      return;
    }
    update(() => result.data);
    setHistoryId(result.session.id);
    showMessage(result.session.groups!.length < groupCount
      ? `可参与学生不足 ${groupCount} 人，已生成 ${result.session.groups!.length} 个非空小组并正在同步。`
      : "临时分组已生成，正在同步到工作区。");
  }

  async function copyGroups(session: NonNullable<typeof latestSession>) {
    const result = formatTemporaryGrouping(data, classId, session.id);
    if (result.error) {
      showMessage(result.error);
      return;
    }
    await copyTextToClipboard(result.text!, "已复制分组结果");
  }

  const complete = candidates.length > 0 && picked.length === candidates.length;
  return <div className="classroom-tools">
    <WorkbenchPageHeader icon="🎲" tone="iris" title="课堂工具" description="随机点名与临时分组默认不写入积分，也不会形成学生评价。" />
    {message && <p className={styles.message} role="status">{message}</p>}
    <section>
      <header><h2>随机点名</h2><span>已排除 {eligibility.excludedStudentIds.length} 名当天请假学生</span></header>
      <div className="tool-draw">
        <button className="primary" type="button" onClick={draw} disabled={!candidates.length || complete}>随机抽取</button>
        <button type="button" onClick={resetRound} disabled={!picked.length}>重置本轮</button>
        {selected.map((student, index) => <article key={`${student.id}-${index}`}><b>{student.name}</b><span>第 {index + 1} 次</span></article>)}
        {!selected.length && <p>{candidates.length ? "本轮尚未抽取；被抽到的学生会暂时避开，直到重置本轮。" : "今天没有可参与点名的学生，请先核对考勤。"}</p>}
        {complete && <p>本轮所有可参与学生均已抽到，请重置后开始下一轮。</p>}
      </div>
    </section>
    <section>
      <header><div><h2>临时分组</h2><span>按当前班级可参与学生随机分组，结果会保留在本页</span></div><span>{latestSession ? `${viewingHistory ? "历史记录" : "最近一次"}：${latestSession.date}` : "尚未生成"}</span></header>
      <div className="tool-groups">
        <label><span>分组数</span><input type="number" min="2" max="12" value={groupCount} onChange={(event) => setGroupCount(Math.max(2, Math.min(12, Number(event.target.value) || 2)))} /></label>
        <button className="primary" type="button" onClick={makeGroups} disabled={candidates.length < 2}>生成分组</button>
      </div>
      {candidates.length < 2 && <p className="tool-group-empty">至少需要 2 名可参与学生才能生成临时分组。</p>}
      {latestSession ? <div className="tool-group-results" aria-live="polite">
        <header><div><b>{viewingHistory ? "历史分组结果" : "最近一次分组结果"}</b><span>{latestSession.groups?.length ?? 0} 组 · {latestSession.selectedStudentIds.length} 人 · {latestSession.date}</span></div><button type="button" onClick={() => void copyGroups(latestSession)}>复制分组</button></header>
        <div className="tool-group-grid">{(latestSession.groups ?? []).map((group, index) => <article key={`${latestSession.id}-${index}`}><header><b>第{index + 1}组</b><span>{group.length}人</span></header><ol>{group.map((id) => <li key={id}>{students.find((student) => student.id === id)?.name ?? "已移除学生"}</li>)}</ol></article>)}</div>
        {groupSessions.length > 1 && <details className="tool-group-history"><summary>查看历史分组（{groupSessions.length - 1} 次）</summary>{viewingHistory && <button type="button" onClick={() => setHistoryId("")}>返回最近一次</button>}<div>{groupSessions.slice(1, 6).map((session) => <button type="button" key={session.id} onClick={() => setHistoryId(session.id)}>{session.date} · {session.groups?.length ?? 0} 组 · {session.selectedStudentIds.length} 人</button>)}</div></details>}
      </div> : candidates.length >= 2 ? <p className="tool-group-empty">点击“生成分组”后，这里会显示每组学生，可直接核对或复制。</p> : null}
    </section>
  </div>;
}
