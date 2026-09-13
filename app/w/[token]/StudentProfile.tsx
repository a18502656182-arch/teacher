"use client";

import { useState } from 'react';
import { StudentDictationHistory } from './dictation/DictationSummary';
import { useStudentProfileController } from './features/students/useStudentProfileController';
import { localCareDate } from './features/health/operations';
import { Button } from '@/app/components/workbench/ui/Button';
import { Dialog } from '@/app/components/workbench/ui/Dialog';
import { DraftClosePrompt } from '@/app/components/workbench/ui/DraftClosePrompt';
import { Field, Input, Select } from '@/app/components/workbench/ui/Field';
import { makeId } from '@/lib/classroom';
import type { CareProfile, ClassroomData, Guardian, Student } from '@/lib/classroom';
import styles from './features/students/StudentProfile.module.css';

function blankGuardian(studentId: string): Guardian { return { id: makeId('guardian'), studentId, name: '', relation: '父亲', phone: '', isPrimary: false, emergencyPriority: 2 }; }
function blankCare(studentId: string): CareProfile { return { id: makeId('care'), studentId, category: '健康提醒', severity: '一般', instruction: '', contraindication: '', reviewedAt: localCareDate(), visibleScope: '班主任' }; }

export function StudentProfile({ student, data, update, onClose, readOnly = false }: { student: Student; data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; onClose: () => void; readOnly?: boolean }) {
  const c = useStudentProfileController({ student, data, update, onClose });
  const [closePrompt, setClosePrompt] = useState(false);
  const requestClose = () => c.dirty ? setClosePrompt(true) : onClose();
  return <>
    <Dialog open title={`${student.name} · 联系与照护`} description="敏感信息仅在本详情内向班主任显示，不进入名单主表。" size="wide" dirty={c.dirty} onRequestClose={requestClose} footer={<><Button onClick={requestClose}>{readOnly ? '关闭' : '取消'}</Button><Button intent="primary" disabled={readOnly} onClick={c.save}>保存档案</Button></>}>
      <fieldset className={styles.readonlyGroup} disabled={readOnly}><div className={styles.body}>
        <section><h3>基础扩展</h3><div className={styles.fields}><Field id="profile-residence" label="住宿情况"><Select id="profile-residence" value={c.residence} onChange={event => c.setResidence(event.target.value as typeof c.residence)}><option>未填</option><option>走读</option><option>住宿</option></Select></Field><Field id="profile-tags" label="学生标签"><Input id="profile-tags" value={c.tags} onChange={event => c.setTags(event.target.value)} placeholder="如：需作业提醒、班干部候选"/></Field></div></section>
        <section><div className={styles.sectionHead}><h3>监护人与紧急联系人</h3><Button intent="text" onClick={() => c.setGuardians(items => [...items, blankGuardian(student.id)])}>新增联系人</Button></div>{c.guardians.map(item => <div className={styles.contact} key={item.id}>
          <Field id={`guardian-name-${item.id}`} label="姓名"><Input id={`guardian-name-${item.id}`} value={item.name} onChange={event => c.setGuardians(items => items.map(current => current.id === item.id ? { ...current, name: event.target.value } : current))}/></Field>
          <Field id={`guardian-relation-${item.id}`} label="关系"><Select id={`guardian-relation-${item.id}`} value={item.relation} onChange={event => c.setGuardians(items => items.map(current => current.id === item.id ? { ...current, relation: event.target.value } : current))}><option>父亲</option><option>母亲</option><option>祖父母</option><option>其他监护人</option></Select></Field>
          <Field id={`guardian-phone-${item.id}`} label="联系电话"><Input id={`guardian-phone-${item.id}`} inputMode="tel" value={item.phone ?? ''} onChange={event => c.setGuardians(items => items.map(current => current.id === item.id ? { ...current, phone: event.target.value } : current))}/></Field>
          <label className={styles.primaryCheck}><input type="checkbox" checked={Boolean(item.isPrimary)} onChange={event => c.setGuardians(items => items.map(current => current.id === item.id ? { ...current, isPrimary: event.target.checked } : current))}/>主联系人</label>
          <Button intent="danger" onClick={() => c.setGuardians(items => items.filter(current => current.id !== item.id))}>删除</Button>
        </div>)}{!c.guardians.length && <p className={styles.empty}>暂未维护监护人；名单中的“家长电话”不会自动推断亲属关系。</p>}</section>
        <section><div className={styles.sectionHead}><h3>健康与照护提醒</h3><Button intent="text" onClick={() => c.setCare(items => [...items, blankCare(student.id)])}>新增提醒</Button></div>{c.care.map(item => <div className={styles.care} key={item.id}>
          <Field id={`care-category-${item.id}`} label="关注类型"><Select id={`care-category-${item.id}`} value={item.category} onChange={event => c.setCare(items => items.map(current => current.id === item.id ? { ...current, category: event.target.value as CareProfile['category'] } : current))}><option>健康提醒</option><option>活动注意</option><option>座位照护</option><option>过敏与饮食</option><option>呼吸与心血管</option><option>视觉与感官</option><option>行动与书写</option><option>心理与情绪</option><option>其他</option></Select></Field>
          <Field id={`care-severity-${item.id}`} label="优先级"><Select id={`care-severity-${item.id}`} value={item.severity} onChange={event => c.setCare(items => items.map(current => current.id === item.id ? { ...current, severity: event.target.value as CareProfile['severity'] } : current))}><option>一般</option><option>重要</option><option>紧急</option></Select></Field>
          <Field id={`care-action-${item.id}`} label="行动提示"><Input id={`care-action-${item.id}`} value={item.instruction} onChange={event => c.setCare(items => items.map(current => current.id === item.id ? { ...current, instruction: event.target.value } : current))}/></Field>
          <Field id={`care-note-${item.id}`} label="注意事项"><Input id={`care-note-${item.id}`} value={item.contraindication ?? ''} onChange={event => c.setCare(items => items.map(current => current.id === item.id ? { ...current, contraindication: event.target.value } : current))}/></Field>
          <Button intent="danger" onClick={() => c.setCare(items => items.filter(current => current.id !== item.id))}>删除</Button>
        </div>)}{!c.visibleCare.length && <p className={styles.empty}>暂无照护提醒。这里只记录班主任可执行的提醒，不记录不必要的病史细节。</p>}</section>
        <StudentDictationHistory data={data} studentId={student.id} className={styles.historySection}/>
        <section><h3>考勤历史</h3><p className={styles.hint}>仅展示本学生的已保存日期记录；空白日期不代表缺勤。</p><div className={styles.history}>{c.attendanceHistory.map(item => <article key={item.id}><b>{item.date}</b><span>{item.status} · {item.period}</span><small>{item.status === '请假' ? `${item.leaveType ?? '请假'}${item.reason ? `：${item.reason}` : ''}` : item.note || '已记录'}</small></article>)}</div>{!c.attendanceHistory.length && <p className={styles.empty}>暂无已保存的考勤记录。</p>}</section>
        {c.message && <p className={styles.error} role="alert">{c.message}</p>}
      </div></fieldset>
    </Dialog>
    <DraftClosePrompt open={closePrompt} title="放弃学生档案修改？" description="本次尚未保存的联系人、照护信息和标签会丢失。" onContinue={() => setClosePrompt(false)} onDiscard={onClose}/>
  </>;
}
