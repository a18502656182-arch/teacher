'use client';
import { useId, useEffect, useRef } from 'react';
import type { DictationResult } from '@/lib/dictation';
import { Button } from '@/app/components/workbench/ui/Button';
import { Field, Input, Select } from '@/app/components/workbench/ui/Field';
import { Icon } from '@/app/components/workbench/ui/Icon';
import { Artwork } from '@/app/components/workbench/theme/Artwork';
import { useGradingController, type GradingProps } from './useGradingController';
import styles from './grading.module.css';

export function GradingView(props: GradingProps) {
  const { task, readOnly, onBack, onReview } = props;
  const c = useGradingController(props);
  const id = useId();
  const rosterRef = useRef<HTMLElement>(null);
  const rosterTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (c.showRoster) rosterRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
  }, [c.showRoster]);
  function closeRoster() { c.setShowRoster(false); rosterTriggerRef.current?.focus(); }
  const pageCount = Math.max(1, Math.ceil(c.rows.length / 20));
  const page = Math.min(c.page, pageCount);
  const rows = c.rows.slice((page - 1) * 20, page * 20);
  function edit() { c.setDirty(true); c.setConfirmed(false); c.resultRef.current = null; }
  function back() { if (c.dirty || c.busy) c.setMessage('请先保存或放弃修改'); else onBack(); }
  const resultLabel = (result?: DictationResult) => result ? result[0] === 'graded' ? '已批改' : result[0] === 'leave' ? '请假' : '未参加' : '待批改';
  const index = task.participants.findIndex(person => person.id === c.studentId);
  return <section className={styles.page} aria-label="听写批改">
    <header className={styles.navigation}><Button intent="text" onClick={back}>返回任务</Button><h1>听写批改</h1><Button intent="text" onClick={() => window.print()}>打印材料</Button></header>
    <div className={styles.workspace} data-context={task.context.kind}>
      <main className={styles.main}>
        <header className={styles.context}>
          <div><h2>{task.title}</h2><p>{task.date} · {task.subject} · 本次 {task.words.length} 个词</p><span>{task.participants.length} 人参与 · {Object.keys(task.results).length} 人已处理</span></div>
          <Artwork role="dictation.context"/>
        </header>
        <div className={styles.student}>
          <div><span>当前{task.context.kind === 'class' ? '学生' : '孩子'}</span><h3>{c.student.name}<small>{c.student.number}</small></h3></div>
          <span className={styles.badge}>{resultLabel(c.saved)}</span>
          {task.context.kind === 'class' && <div className={styles.studentActions}>
            <Button disabled={index <= 0 || c.busy} onClick={() => c.changeStudent(task.participants[index-1].id)}>上一位</Button>
            <Button disabled={index >= task.participants.length-1 || c.busy} onClick={() => c.changeStudent(task.participants[index+1].id)}>下一位</Button>
            <Button ref={rosterTriggerRef} onClick={() => c.showRoster ? closeRoster() : c.setShowRoster(true)} aria-expanded={c.showRoster} aria-controls={`${id}-roster`}><Icon name="search"/>换学生</Button>
          </div>}
        </div>
        <p className={styles.instruction}>由教师或家长人工报词，点选纸面写错的词。</p>
        <fieldset className={styles.fields} disabled={readOnly || c.busy}>
          <div className={styles.participation}><Field id={`${id}-state`} label="参与状态"><Select id={`${id}-state`} value={c.state} onChange={e => {c.setState(e.target.value as DictationResult[0]);edit();}}><option value="graded">实际参与，批改</option><option value="leave">请假</option><option value="absent">未参加</option></Select></Field></div>
          <div className={styles.words}>{task.words.map((word,i) => <label key={word.id} className={styles.word} data-wrong={c.state==='graded' && c.wrong.includes(i)}>
            <span>{i+1}</span><b>{word.text}</b><small>{word.meaning}</small>
            <input type="checkbox" aria-label={`错词 ${word.text}`} disabled={c.state!=='graded'} checked={c.state==='graded' && c.wrong.includes(i)} onChange={e => {c.setWrong(e.target.checked ? [...c.wrong,i] : c.wrong.filter(n=>n!==i));edit();}}/>
          </label>)}</div>
          <Field id={`${id}-note`} label="备注（可选）"><Input id={`${id}-note`} maxLength={300} value={c.note} onChange={e => {c.setNote(e.target.value);c.setDirty(true);c.resultRef.current=null;}}/></Field>
          <label className={styles.confirm}><input type="checkbox" checked={c.confirmed} onChange={e=>{c.setConfirmed(e.target.checked);c.setDirty(true);}}/>{c.state==='graded' ? `确认已核对全部 ${task.words.length} 个词${!c.wrong.length ? '，本次全对' : ''}` : c.state==='leave' ? '确认本次请假，不计入错误率' : '确认本次未参加，不计入错误率'}</label>
        </fieldset>
        <p className={styles.feedback} data-error={c.message.includes('失败')} role="status">{readOnly ? '当前只读，可查看记录与打印，不能提交批改。' : c.message || '未确认前不会计入统计'}</p>
        {c.saved?.[0]==='graded' && c.saved[1].length>0 && <Button disabled={c.dirty || c.busy || readOnly} onClick={()=>void onReview(c.student)}>为{c.student.name}安排错词复习</Button>}
        <footer className={styles.savebar}><span>已标记 <strong>{c.state==='graded' ? c.wrong.length : 0}</strong> 个错词</span><Button intent="text" disabled={c.busy || readOnly} onClick={c.discard}>放弃修改</Button><Button intent="primary" disabled={!c.confirmed || readOnly} busy={c.busy} onClick={()=>void c.save()}>{c.busy ? '保存中…' : task.context.kind==='class' ? '保存并下一位' : '保存批改'}</Button></footer>
      </main>
      {task.context.kind==='class' && <aside id={`${id}-roster`} ref={rosterRef} className={styles.roster} data-open={c.showRoster} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closeRoster();}}}>
        <div className={styles.rosterHeading}><h2>本次学生</h2><Button intent="text" onClick={closeRoster}>收起名单</Button></div>
        <Field id={`${id}-search`} label="搜索姓名或学号"><Input id={`${id}-search`} type="search" value={c.query} onChange={e=>{c.setQuery(e.target.value);c.setPage(1);}}/></Field>
        <label className={styles.confirm}><input type="checkbox" checked={c.pendingOnly} onChange={e=>{c.setPendingOnly(e.target.checked);c.setPage(1);}}/>只看待批改</label>
        <div className={styles.people}>{rows.map(person=><button type="button" key={person.id} aria-current={person.id===c.studentId ? 'true' : undefined} onClick={()=>{c.changeStudent(person.id);if(!c.dirty&&!c.busy)rosterTriggerRef.current?.focus();}}><span><b>{person.name}</b><small>{person.number}</small></span><span>{resultLabel(task.results[person.id])}</span></button>)}</div>
        {!rows.length && <p>没有符合条件的学生，请调整搜索或筛选。</p>}
        <nav className={styles.pager} aria-label="学生分页"><Button disabled={page<=1} onClick={()=>c.setPage(page-1)}>上一页</Button><span>{page}/{pageCount}</span><Button disabled={page>=pageCount} onClick={()=>c.setPage(page+1)}>下一页</Button></nav>
        <p className={styles.count}>共 {c.rows.length} 人，每页最多 20 人</p>
      </aside>}
    </div>
  </section>;
}
