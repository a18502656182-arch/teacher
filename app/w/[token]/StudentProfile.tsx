"use client";

import { StudentDictationHistory } from './dictation/DictationSummary';
import { useMemo, useState } from "react";
import { makeId } from "@/lib/classroom";
import type { CareProfile, ClassroomData, Guardian, Student } from "@/lib/classroom";

function blankGuardian(studentId: string): Guardian { return { id: makeId("guardian"), studentId, name: "", relation: "父亲", phone: "", isPrimary: false, emergencyPriority: 2 }; }
function blankCare(studentId: string): CareProfile { return { id: makeId("care"), studentId, category: "健康提醒", severity: "一般", instruction: "", contraindication: "", reviewedAt: new Date().toISOString().slice(0, 10), visibleScope: "班主任" }; }

export function StudentProfile({ student, data, update, onClose }: { student: Student; data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; onClose: () => void }) {
  const classId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "";
  const [residence, setResidence] = useState(student.residence ?? "未填");
  const [tags, setTags] = useState((student.tags ?? []).join("、"));
  const [guardians, setGuardians] = useState<Guardian[]>(() => (data.guardians ?? []).filter((item) => item.studentId === student.id));
  const [care, setCare] = useState<CareProfile[]>(() => (data.careProfiles ?? []).filter((item) => item.studentId === student.id));
  const [message, setMessage] = useState("");
  const visibleCare = useMemo(() => care, [care]);
  const attendanceHistory = useMemo(() => (data.attendanceRecords ?? []).filter((item) => item.classId === classId && item.studentId === student.id).toSorted((a, b) => b.date.localeCompare(a.date)).slice(0, 24), [classId, data.attendanceRecords, student.id]);
  function save() {
    const cleanedGuardians = guardians.filter((item) => item.name.trim()).map((item, index) => ({ ...item, classId, name: item.name.trim(), phone: item.phone?.replace(/[\s-]/g, "") ?? "", isPrimary: Boolean(item.isPrimary), emergencyPriority: Math.max(1, Number(item.emergencyPriority) || index + 1) }));
    if (cleanedGuardians.some((item) => item.phone && !/^1[3-9]\d{9}$/.test(item.phone))) return setMessage("监护人电话需为 11 位手机号，或留空。");
    const cleanedCare = care.map((item) => ({ ...item, classId, instruction: item.instruction.trim(), contraindication: item.contraindication?.trim() ?? "", visibleScope: "班主任" as const }));
    update((current) => ({ ...current,
      students: current.students.map((item) => item.id === student.id ? { ...item, residence, tags: tags.split(/[、，,]/).map((item) => item.trim()).filter(Boolean).slice(0, 8) } : item),
      rosterClasses: current.rosterClasses?.map((classroom) => classroom.id === classId ? { ...classroom, students: classroom.students.map((item) => item.id === student.id ? { ...item, residence, tags: tags.split(/[、，,]/).map((item) => item.trim()).filter(Boolean).slice(0, 8) } : item) } : classroom),
      guardians: [...(current.guardians ?? []).filter((item) => item.studentId !== student.id), ...cleanedGuardians],
      careProfiles: [...(current.careProfiles ?? []).filter((item) => item.studentId !== student.id), ...cleanedCare],
    }));
    onClose();
  }
  return <div className="student-profile-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="student-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="student-profile-title">
    <header><div><span>受控学生档案</span><h2 id="student-profile-title">{student.name} · 联系与照护</h2><p>健康与紧急信息仅在本详情内向班主任显示，不进入名单主表。</p></div><button type="button" onClick={onClose} aria-label="关闭">×</button></header>
    <div className="student-profile-body"><section><h3>基础扩展</h3><div className="student-profile-fields"><label><span>住宿情况</span><select value={residence} onChange={(event) => setResidence(event.target.value as typeof residence)}><option>未填</option><option>走读</option><option>住宿</option></select></label><label className="wide"><span>学生标签</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="如：需作业提醒、班干部候选（用顿号或逗号分隔）" /></label></div></section>
    <section><div className="student-profile-section-head"><h3>监护人与紧急联系人</h3><button type="button" onClick={() => setGuardians((items) => [...items, blankGuardian(student.id)])}>新增联系人</button></div>{guardians.map((item, index) => <div className="student-profile-contact" key={item.id}><input value={item.name} onChange={(event) => setGuardians((items) => items.map((current) => current.id === item.id ? { ...current, name: event.target.value } : current))} placeholder="姓名" /><select value={item.relation} onChange={(event) => setGuardians((items) => items.map((current) => current.id === item.id ? { ...current, relation: event.target.value } : current))}><option>父亲</option><option>母亲</option><option>祖父母</option><option>其他监护人</option></select><input inputMode="tel" value={item.phone ?? ""} onChange={(event) => setGuardians((items) => items.map((current) => current.id === item.id ? { ...current, phone: event.target.value } : current))} placeholder="联系电话" /><label><input type="checkbox" checked={Boolean(item.isPrimary)} onChange={(event) => setGuardians((items) => items.map((current) => current.id === item.id ? { ...current, isPrimary: event.target.checked } : current))} />主联系人</label><button type="button" onClick={() => setGuardians((items) => items.filter((current) => current.id !== item.id))}>删除</button></div>)}{!guardians.length && <p className="student-profile-empty">暂未维护监护人；名单中的“家长电话”不会自动推断亲属关系。</p>}</section>
    <section><div className="student-profile-section-head"><h3>健康与照护提醒</h3><button type="button" onClick={() => setCare((items) => [...items, blankCare(student.id)])}>新增提醒</button></div>{care.map((item) => <div className="student-profile-care" key={item.id}><select value={item.category} onChange={(event) => setCare((items) => items.map((current) => current.id === item.id ? { ...current, category: event.target.value as CareProfile["category"] } : current))}><option>健康提醒</option><option>活动注意</option><option>座位照护</option><option>过敏与饮食</option><option>呼吸与心血管</option><option>视觉与感官</option><option>行动与书写</option><option>心理与情绪</option><option>其他</option></select><select value={item.severity} onChange={(event) => setCare((items) => items.map((current) => current.id === item.id ? { ...current, severity: event.target.value as CareProfile["severity"] } : current))}><option>一般</option><option>重要</option><option>紧急</option></select><input value={item.instruction} onChange={(event) => setCare((items) => items.map((current) => current.id === item.id ? { ...current, instruction: event.target.value } : current))} placeholder="需要老师采取的照护措施" /><input value={item.contraindication ?? ""} onChange={(event) => setCare((items) => items.map((current) => current.id === item.id ? { ...current, contraindication: event.target.value } : current))} placeholder="活动/用药禁忌（可选）" /><button type="button" onClick={() => setCare((items) => items.filter((current) => current.id !== item.id))}>删除</button></div>)}{!visibleCare.length && <p className="student-profile-empty">暂无照护提醒。此处用于记录可执行的班主任提醒，不记录不必要的病史细节。</p>}</section>
    <StudentDictationHistory data={data} studentId={student.id}/><section className="student-profile-attendance"><h3>考勤历史</h3><p>仅展示本学生的已保存日期记录；空白日期不代表缺勤。</p>{attendanceHistory.map((item) => <article key={item.id}><b>{item.date}</b><span>{item.status} · {item.period}</span><small>{item.status === "请假" ? `${item.leaveType ?? "请假"}${item.reason ? `：${item.reason}` : ""}` : item.note || "已记录"}</small></article>)}{!attendanceHistory.length && <p className="student-profile-empty">暂无已保存的考勤记录。</p>}</section></div>
    {message && <p className="student-profile-error" role="alert">{message}</p>}<footer><button type="button" onClick={onClose}>取消</button><button type="button" className="primary" onClick={save}>保存档案</button></footer>
  </section></div>;
}
