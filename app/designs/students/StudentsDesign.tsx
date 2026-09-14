'use client';

import type { ClassroomData, Student } from '@/lib/classroom';
import { CampusIcon, ThemeArtwork } from '@/app/components/campus/primitives';
import { Button } from '@/app/components/workbench/ui/Button';
import { Dialog } from '@/app/components/workbench/ui/Dialog';
import { Drawer } from '@/app/components/workbench/ui/Drawer';
import { Field, Input, Select, Textarea } from '@/app/components/workbench/ui/Field';
import { Menu, MenuItem } from '@/app/components/workbench/ui/Menu';
import { SelectionBar } from '@/app/components/workbench/ui/SelectionBar';
import { ThemeBoundary } from '@/app/components/workbench/theme/ThemeBoundary';
import { useState } from 'react';
import { StudentProfile } from '@/app/w/[token]/StudentProfile';
import { useStudentsController } from '@/app/w/[token]/features/students/useStudentsController';
import styles from './StudentsDesign.module.css';

type Update = (fn: (data: ClassroomData) => ClassroomData) => void;
function StatusBadge({ status }: { status: string; tone?: string }) {
  const tone = /^(已交|正常|已完成|已记录|0 个错词)$/.test(status) ? 'success' : /^(请假|未参加)$/.test(status) ? 'info' : /待|错词/.test(status) ? 'warning' : /未交|缺勤|迟到/.test(status) ? 'danger' : 'neutral';
  return <span className={styles.statusBadge} data-tone={tone}>{status}</span>;
}

function ActivityList({ controller }: { controller: ReturnType<typeof useStudentsController> }) {
  const { focusedStudent: student, activity } = controller;
  if (!student || !activity) return null;
  const dictationText = activity.dictation?.results[student.id];
  const dictationStatus = !dictationText ? '待批改' : dictationText[0] === 'graded' ? `${dictationText[1].length} 个错词` : dictationText[0] === 'leave' ? '请假' : '未参加';
  return <ol className={styles.timeline} data-students-region="timeline">
    {activity.dictation && <li><CampusIcon name="dictation"/><div><b>{activity.dictation.title}</b><span>{activity.dictation.date} · 听写</span></div><StatusBadge status={dictationStatus}/></li>}
    {activity.homework.map(task => <li key={task.id}><CampusIcon name="homework"/><div><b>{task.title}</b><span>{task.date} · 作业</span></div><StatusBadge status={task.statuses[student.id]}/></li>)}
    {activity.attendance.map(record => <li key={record.id}><CampusIcon name="attendance"/><div><b>{record.reason || record.note || record.period || '考勤记录'}</b><span>{record.date} · 考勤</span></div><StatusBadge status={record.status}/></li>)}
    {activity.records.map(record => <li key={record.id}><CampusIcon name="records"/><div><b>{record.type}</b><span>{record.date} · 学生记录</span></div><StatusBadge status={record.status || '已记录'}/></li>)}
    {!activity.dictation && !activity.homework.length && !activity.attendance.length && !activity.records.length && <li><CampusIcon name="growth"/><div><b>暂无近期记录</b><span>新的作业、听写、考勤与沟通会显示在这里。</span></div></li>}
  </ol>;
}

function StudentDetail({ controller, compact = false }: { controller: ReturnType<typeof useStudentsController>; compact?: boolean }) {
  const student = controller.focusedStudent;
  if (!student) return <div className={styles.emptyDetail}><ThemeArtwork slot="roster"/><p>名单为空。新增或导入学生后，可在这里查看个人动态。</p></div>;
  return <div className={compact ? styles.compactDetail : styles.detailInner}>
    {!compact && <div className={styles.art}><Stationery/></div>}
    <header className={styles.detailHeader}><i aria-hidden="true">{student.name.slice(0, 1)}</i><div><h3>{student.name}</h3><p>学号 {student.studentNo || '未填'} · 第{student.group}组 · {student.seat}号座位</p></div></header>
    <dl className={styles.facts}><div><dt>积分</dt><dd>{student.points}</dd></div><div><dt>近期成绩</dt><dd>{student.score ?? '未录入'}</dd></div><div><dt>考勤</dt><dd>{student.attendance}</dd></div><div><dt>作业</dt><dd><StatusBadge status={student.homework}/></dd></div></dl>
    <section className={styles.activity}><h4>学习与近期记录</h4><ActivityList controller={controller}/></section>
    {student.note && <section className={styles.note}><h4>班务备注</h4><p>{student.note}</p></section>}
    {!compact && <Button className={styles.profileAction} intent="primary" onClick={() => controller.setProfileId(student.id)}><CampusIcon name="growth"/>打开完整档案</Button>}
  </div>;
}

function StudentForm({ draft, setDraft }: { draft: Student; setDraft: (student: Student) => void }) {
  return <div className={styles.formGrid}>
    <Field id="student-name" label="姓名" required><Input id="student-name" autoFocus value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })}/></Field>
    <Field id="student-number" label="学号"><Input id="student-number" value={draft.studentNo ?? ''} onChange={event => setDraft({ ...draft, studentNo: event.target.value })}/></Field>
    <Field id="student-gender" label="性别"><Select id="student-gender" value={draft.gender} onChange={event => setDraft({ ...draft, gender: event.target.value as Student['gender'] })}><option>女</option><option>男</option></Select></Field>
    <Field id="student-group" label="小组"><Input id="student-group" type="number" min={1} value={draft.group} onChange={event => setDraft({ ...draft, group: Number(event.target.value) || 1 })}/></Field>
    <Field id="student-seat" label="座位"><Input id="student-seat" type="number" min={1} value={draft.seat} onChange={event => setDraft({ ...draft, seat: Number(event.target.value) || 1 })}/></Field>
    <Field id="student-phone" label="家长电话" hint="选填；名单页只显示是否已维护"><Input id="student-phone" inputMode="tel" value={draft.parentPhone ?? ''} onChange={event => setDraft({ ...draft, parentPhone: event.target.value })}/></Field>
    <div className={styles.wide}><Field id="student-note" label="班务备注" hint="只记录班主任确需长期记住的信息"><Textarea id="student-note" value={draft.note ?? ''} onChange={event => setDraft({ ...draft, note: event.target.value })}/></Field></div>
  </div>;
}

function Stationery() {
  // Local authored bitmap, never a screenshot slice or rendered text.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={new URL('./stationery-c01.png', import.meta.url).href} width={1536} height={1024} alt="" aria-hidden="true"/>;
}

/** Accept both the committed string contract and the in-flight structured summary.
 * This is display normalization only; the controller still chooses the recent record. */
function displaySummary(value: unknown) {
  if (value && typeof value === 'object' && 'status' in value && 'date' in value && 'source' in value) {
    return {status:String(value.status),date:String(value.date),source:String(value.source)};
  }
  const text = String(value ?? '暂无近期记录');
  const match = text.match(/^(\S+)\s+(.+?)\s*·\s*(.+)$/);
  return match ? {date:match[1],source:match[2],status:match[3]} : {date:'',source:'近期记录',status:'暂无记录'};
}

export function StudentsDesign({ data, update, controller: c, mobile = false, readOnly = false }: { data: ClassroomData; update: Update; controller: ReturnType<typeof useStudentsController>; mobile?: boolean; readOnly?: boolean }) {
  const recentStatusById = new Map(c.students.map(student => [student.id, displaySummary(c.recentStatusById.get(student.id))]));
  const [discard, setDiscard] = useState<null | (() => void)>(null);
  const closeEditor = () => { if (c.studentDraft) setDiscard(() => () => c.setStudentDraft(null)); };
  const closeImport = () => { if (c.importText) setDiscard(() => () => c.setImportOpen(false)); else c.setImportOpen(false); };
  const importCount = c.importRows().length;
  return <ThemeBoundary><section className={`${styles.page} ${mobile ? styles.mobile : ''}`} aria-labelledby={mobile ? 'mobile-student-title' : undefined}>
    {mobile
      ? <><div className={styles.mobileArt}><Stationery/></div><header className={styles.mobileHeader}><h2 id="mobile-student-title">{c.activeClass.name} · {c.metrics.total}人</h2><Button intent="primary" disabled={readOnly} onClick={c.openNewStudent}><CampusIcon name="plus"/>新增学生</Button></header></>
      : <header className={styles.heading} data-design-region="heading"><div><h1>学生名单</h1><p>{c.activeClass.name} · {c.metrics.total}人</p></div><div className={styles.headerActions}><Button intent="primary" disabled={readOnly} onClick={c.openNewStudent}><CampusIcon name="plus"/>新增学生</Button><Menu label="名单操作" align="end"><MenuItem disabled={readOnly} onSelect={() => c.setImportOpen(true)}>导入名单</MenuItem><MenuItem onSelect={c.exportRoster}>导出 CSV</MenuItem></Menu></div></header>
    }
    <div className={styles.workspace} data-students-region="workspace">
      <div className={styles.master}>
        <div className={styles.rosterSummary} data-students-region="summary">{!mobile && <strong>共 {c.metrics.total} 人</strong>}<span>男 {c.metrics.boys} 人</span><span>女 {c.metrics.girls} 人</span><span>电话已维护 {c.metrics.withPhone} 人{!mobile && `（${c.metrics.phoneRate}%）`}</span></div>
        <div className={styles.tools} data-students-region="tools">
          <Field id={`${mobile ? 'mobile-' : ''}student-search`} label="搜索"><Input id={`${mobile ? 'mobile-' : ''}student-search`} value={c.query} onChange={event => c.setQuery(event.target.value)} placeholder="姓名、学号、小组或备注"/></Field>
          <Field id={`${mobile ? 'mobile-' : ''}student-group-filter`} label="小组"><Select id={`${mobile ? 'mobile-' : ''}student-group-filter`} value={c.groupFilter} onChange={event => c.setGroupFilter(event.target.value)}><option>全部小组</option>{c.groupOptions.map(group => <option key={group} value={group}>第{group}组</option>)}</Select></Field>
          {!mobile && <Field id="student-page-size" label="每页"><Select id="student-page-size" value={c.pageSize} onChange={event => c.setPageSize(Number(event.target.value))}><option value={20}>20 人</option><option value={50}>50 人</option></Select></Field>}
          <Button disabled={readOnly} aria-pressed={c.editMode} onClick={() => c.setEditMode(!c.editMode)}>{c.editMode ? '退出编辑' : '编辑资料'}</Button>
          {mobile && <Menu label="名单操作" align="end"><MenuItem disabled={readOnly} onSelect={() => c.setImportOpen(true)}>追加名单</MenuItem><MenuItem onSelect={c.exportRoster}>导出 CSV</MenuItem></Menu>}
        </div>
        <SelectionBar count={c.selectedIds.length} scopeLabel={`当前筛选共 ${c.filtered.length} 人`} onClear={c.clearSelection} actions={<><Button onClick={c.toggleFiltered}>{c.allFilteredSelected ? '取消当前筛选' : '全选当前筛选'}</Button><Button intent="primary" disabled={readOnly} onClick={() => c.setBatchOpen(true)}>批量编辑</Button></>}/>
        {c.message && <button type="button" className={styles.message} onClick={() => c.setMessage('')} aria-label="关闭提示">{c.message}<span>关闭</span></button>}
        {mobile ? <div className={styles.mobileList} data-students-region="list">
          {c.pageItems.map(student => <article key={student.id} className={styles.mobileRow}>
            <label><input type="checkbox" checked={c.selectedIds.includes(student.id)} onChange={() => c.toggleSelect(student.id)}/><span className="sr-only">选择{student.name}</span></label>
            <button type="button" onClick={() => c.editMode ? c.openEditStudent(student.id) : c.setFocusedId(student.id)}><span className={styles.mobileIdentity}><b>{student.name}</b><small>学号 {student.studentNo || '未填'} · 第{student.group}组</small></span><span className={styles.mobileStatus}><StatusBadge status={recentStatusById.get(student.id)!.status}/><small>{recentStatusById.get(student.id)!.date || '尚无'} · {recentStatusById.get(student.id)!.source}</small></span><CampusIcon name="chevron"/></button>
          </article>)}
          {!c.pageItems.length && <div className={styles.emptyList}><ThemeArtwork slot="empty"/><b>没有符合条件的学生</b><p>调整搜索条件，或新增学生。</p></div>}
        </div> : <div className={styles.tableWrap} data-students-region="list"><table className={styles.table}><thead><tr><th><input aria-label="选择当前筛选学生" type="checkbox" checked={c.allFilteredSelected} onChange={c.toggleFiltered}/></th><th>学号</th><th>姓名</th><th>性别</th><th>小组</th><th>近期状态</th><th>操作</th></tr></thead><tbody>
          {c.pageItems.map(student => <tr key={student.id} data-focused={c.focusedStudent?.id === student.id || undefined} aria-current={c.focusedStudent?.id === student.id ? 'true' : undefined} onClick={() => c.setFocusedId(student.id)}>
            <td><input aria-label={`选择${student.name}`} type="checkbox" checked={c.selectedIds.includes(student.id)} onClick={event => event.stopPropagation()} onChange={() => c.toggleSelect(student.id)}/></td>
            <td>{c.editMode ? <Input aria-label={`${student.name}学号`} value={student.studentNo ?? ''} onChange={event => c.patchStudent(student.id, { studentNo: event.target.value })}/> : student.studentNo || '—'}</td>
            <td><strong>{c.editMode ? <Input aria-label={`${student.name}姓名`} value={student.name} onChange={event => c.patchStudent(student.id, { name: event.target.value })}/> : student.name}</strong></td>
            <td>{c.editMode ? <Select aria-label={`${student.name}性别`} value={student.gender} onChange={event => c.patchStudent(student.id, { gender: event.target.value as Student['gender'] })}><option>女</option><option>男</option></Select> : student.gender}</td>
            <td>{c.editMode ? <Input aria-label={`${student.name}小组`} type="number" min={1} value={student.group} onChange={event => c.patchStudent(student.id, { group: Math.max(1, Number(event.target.value) || 1) })}/> : `第${student.group}组`}</td>
            <td><div className={styles.statusCell}><StatusBadge status={recentStatusById.get(student.id)!.status}/><small>{recentStatusById.get(student.id)!.date || '尚无'} · {recentStatusById.get(student.id)!.source}</small></div></td>
            <td>{c.editMode ? <Button intent="text" onClick={event => { event.stopPropagation(); c.openEditStudent(student.id); }}>编辑</Button> : <Button intent="text" onClick={event => { event.stopPropagation(); c.setFocusedId(student.id); }}>查看</Button>}{c.editMode && <Button intent="danger" onClick={event => { event.stopPropagation(); void c.removeStudent(student.id); }}>删除</Button>}</td>
          </tr>)}
          {!c.pageItems.length && <tr><td colSpan={7} className={styles.emptyCell}>没有符合条件的学生。调整筛选，或新增学生。</td></tr>}
        </tbody></table></div>}
        <footer className={styles.pager}><span>显示 {c.pageItems.length} / {c.filtered.length} 人</span><div><Button disabled={c.page <= 1} onClick={() => c.setPage(c.page - 1)}>上一页</Button><span>{c.page} / {c.totalPages}</span><Button disabled={c.page >= c.totalPages} onClick={() => c.setPage(c.page + 1)}>下一页</Button></div></footer>
      </div>
      {!mobile && <aside className={styles.detail} data-students-region="detail" aria-live="polite"><StudentDetail controller={c}/></aside>}
    </div>

    <Drawer open={mobile && Boolean(c.focusedId)} title={c.focusedStudent ? `${c.focusedStudent.name} · 学生概览` : '学生概览'} description="只显示当前选择的学生，返回后保留名单位置。" onRequestClose={() => c.setFocusedId('')} footer={c.focusedStudent ? <><Button onClick={() => c.setFocusedId('')}>返回名单</Button><Button intent="primary" onClick={() => { c.setProfileId(c.focusedStudent!.id); c.setFocusedId(''); }}>打开完整档案</Button></> : undefined}><StudentDetail controller={c} compact/></Drawer>
    <Dialog open={c.importOpen} title="导入学生名单" description="每行一名学生，可写姓名、手机号和备注；先核对人数，再决定追加或替换。" size="wide" dirty={Boolean(c.importText)} onRequestClose={closeImport} footer={<><span className={styles.precheck}>预检：{importCount} 人</span><Button onClick={closeImport}>取消</Button><Button disabled={readOnly} onClick={c.appendRoster}>追加名单</Button><Button disabled={readOnly} intent="danger" onClick={() => void c.replaceRoster()}>替换当前名单</Button></>}>{c.message && <p role="alert">{c.message}</p>}<Field id="student-import" label="名单内容" hint="每行姓名，可附家长电话和备注"><Textarea id="student-import" value={c.importText} onChange={event => c.setImportText(event.target.value)} rows={10}/></Field></Dialog>
    <Drawer open={c.batchOpen} title={`批量编辑 ${c.selectedIds.length} 名学生`} description="留空表示不修改；备注填写后会覆盖原备注。" onRequestClose={() => c.setBatchOpen(false)} footer={<><Button onClick={() => c.setBatchOpen(false)}>取消</Button><Button intent="primary" onClick={c.applyBatch}>应用修改</Button></>}><div className={styles.batchForm}><Field id="batch-group" label="小组"><Input id="batch-group" type="number" min={1} value={c.batchDraft.group} onChange={event => c.setBatchDraft({ ...c.batchDraft, group: event.target.value })} placeholder="不修改"/></Field><Field id="batch-gender" label="性别"><Select id="batch-gender" value={c.batchDraft.gender} onChange={event => c.setBatchDraft({ ...c.batchDraft, gender: event.target.value as Student['gender'] | '不修改' })}><option>不修改</option><option>女</option><option>男</option></Select></Field><Field id="batch-note" label="备注"><Textarea id="batch-note" value={c.batchDraft.note} onChange={event => c.setBatchDraft({ ...c.batchDraft, note: event.target.value })} placeholder="留空不修改"/></Field></div></Drawer>
    <Dialog open={Boolean(c.studentDraft)} title={c.studentDraft && c.students.some(student => student.id === c.studentDraft?.id) ? '编辑学生资料' : '新增学生'} description="电话等敏感信息只在当前单学生编辑流程中显示。" dirty={Boolean(c.studentDraft)} onRequestClose={closeEditor} footer={<><Button onClick={closeEditor}>取消</Button><Button disabled={readOnly} intent="primary" onClick={c.saveStudent}>保存学生</Button></>}>{c.message && <p role="alert">{c.message}</p>}{c.studentDraft && <StudentForm draft={c.studentDraft} setDraft={c.setStudentDraft}/>}</Dialog>
    <Dialog open={Boolean(discard)} title="放弃未完成的编辑？" onRequestClose={() => setDiscard(null)} footer={<><Button onClick={() => setDiscard(null)}>继续编辑</Button><Button intent="danger" onClick={() => { discard?.(); setDiscard(null); }}>放弃编辑</Button></>}><p>关闭后将退出当前编辑；继续编辑可保留输入。</p></Dialog>
    {c.profileStudent && <StudentProfile student={c.profileStudent}
      data={data}
      update={update}
      readOnly={readOnly}
      onClose={() => c.setProfileId('')}
    />}
  </section></ThemeBoundary>;
}
