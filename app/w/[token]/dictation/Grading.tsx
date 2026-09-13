'use client';

import { type DictationResult } from '@/lib/dictation';
import { Button } from '@/app/components/workbench/ui/Button';
import { Drawer } from '@/app/components/workbench/ui/Drawer';
import { Field, Input, Select } from '@/app/components/workbench/ui/Field';
import { useGradingController, type GradingProps } from '../features/dictation/useGradingController';
import styles from './Grading.module.css';

const PAGE_SIZE = 20;
function resultLabel(result?: DictationResult) {
  if (!result) return '待批改';
  if (result[0] === 'graded') return '已批改';
  return result[0] === 'leave' ? '请假' : '未参加';
}

export function Grading(props: GradingProps) {
  const { task, readOnly, onBack, onReview } = props;
  const { query, setQuery, pendingOnly, setPendingOnly, page, setPage, wrong, setWrong,
    state, setState, confirmed, setConfirmed, note, setNote, dirty, setDirty, busy,
    message, setMessage, showRoster, setShowRoster, saved, student, rows, resultRef,
    changeStudent, discard, save, studentId } = useGradingController(props);
  const currentPage = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const completed = Object.keys(task.results).length;
  const personLabel = task.context.kind === 'class' ? '学生' : '孩子';

  function back() {
    if (dirty || busy) setMessage('请先保存或放弃修改');
    else onBack();
  }

  function renderQueue(idPrefix: string) { return <div className={styles.queueBody}>
    <Field id={`${idPrefix}-student-search`} label="搜索姓名或学号">
      <Input id={`${idPrefix}-student-search`} type="search" value={query}
        onChange={event => { setQuery(event.target.value); setPage(1); }}/>
    </Field>
    <label className={styles.pendingToggle}>
      <input type="checkbox" checked={pendingOnly}
        onChange={event => { setPendingOnly(event.target.checked); setPage(1); }}/>
      只看待批改
    </label>
    <div className={styles.queueList} aria-label="本次学生队列">
      {currentPage.map(person => <button type="button" className={styles.queuePerson}
        data-current={person.id === studentId || undefined}
        aria-current={person.id === studentId ? 'true' : undefined} key={person.id}
        onClick={() => changeStudent(person.id)}>
        <span><b>{person.name}</b><small>{person.number || '未填写学号'}</small></span>
        <small data-state={task.results[person.id]?.[0] ?? 'pending'}>{resultLabel(task.results[person.id])}</small>
      </button>)}
      {!currentPage.length && <p className={styles.queueEmpty}>没有符合条件的学生</p>}
    </div>
    {pages > 1 && <div className={styles.pager} aria-label="学生队列分页">
      <Button intent="text" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))}>上一页</Button>
      <span>{Math.min(page, pages)} / {pages}</span>
      <Button intent="text" disabled={page >= pages} onClick={() => setPage(Math.min(pages, page + 1))}>下一页</Button>
    </div>}
  </div>; }

  return <div className={styles.workspace} data-ui-generation="next" data-readonly={readOnly || undefined}>
    <main className={styles.main}>
      <header className={styles.taskHeader}>
        <div className={styles.taskActions}>
          <Button intent="text" onClick={back}>返回任务</Button>
          <Button intent="text" onClick={() => window.print()}>打印材料</Button>
        </div>
        <div className={styles.taskIdentity}>
          <div><h2>{task.title}</h2><p>{task.date} · {task.subject} · {task.words.length} 个词</p></div>
          <span>{completed}/{task.participants.length} 已处理</span>
        </div>
        <details className={styles.material}>
          <summary>展开本次材料 <span>{task.words.length} 个词</span></summary>
          <ol>{task.words.map(word => <li key={word.id}><b>{word.text}</b>{word.meaning && <small>{word.meaning}</small>}</li>)}</ol>
        </details>
      </header>

      <section className={styles.studentHeader} aria-labelledby="grading-student-name">
        <div><small>当前{personLabel}</small><h3 id="grading-student-name">{student.name} <span>{student.number}</span></h3></div>
        <div className={styles.studentState}>
          <span data-state={saved?.[0] ?? 'pending'}>{resultLabel(saved)}</span>
          {task.context.kind === 'class' && <Button className={styles.queueTrigger} onClick={() => setShowRoster(true)}>换学生</Button>}
        </div>
      </section>

      <p className={styles.instruction}>对照纸面逐词核对，只标记写错的词；未确认前不会计入统计。</p>
      <fieldset disabled={readOnly || busy} className={styles.fields}>
        <div className={styles.controlRow}>
          <Field id="dictation-participation-state" label="参与状态">
            <Select id="dictation-participation-state" value={state} onChange={event => {
              setState(event.target.value as DictationResult[0]); setDirty(true); setConfirmed(false); resultRef.current = null;
            }}><option value="graded">实际参与，批改</option><option value="leave">请假</option><option value="absent">未参加</option></Select>
          </Field>
          <Field id="dictation-grading-note" label="备注（可选）">
            <Input id="dictation-grading-note" value={note} maxLength={300}
              onChange={event => { setNote(event.target.value); setDirty(true); resultRef.current = null; }}/>
          </Field>
        </div>

        <div className={styles.words} data-size={task.words.length > 60 ? 'large' : undefined}>
          {task.words.map((word, index) => {
            const isWrong = state === 'graded' && wrong.includes(index);
            return <label className={styles.word} data-wrong={isWrong || undefined} key={word.id}>
              <span className={styles.wordNumber}>{index + 1}</span>
              <span className={styles.wordCopy}><b>{word.text}</b>{word.meaning && <small>{word.meaning}</small>}</span>
              <input type="checkbox" aria-label={`错词 ${word.text}`} checked={isWrong} disabled={state !== 'graded'}
                onChange={event => { setWrong(event.target.checked ? [...wrong, index] : wrong.filter(value => value !== index)); setDirty(true); setConfirmed(false); resultRef.current = null; }}/>
              <span className={styles.wordStatus}>{isWrong ? '已标错' : '正确'}</span>
            </label>;
          })}
        </div>

        <label className={styles.confirm}>
          <input type="checkbox" checked={confirmed} onChange={event => { setConfirmed(event.target.checked); setDirty(true); }}/>
          <span>{state === 'graded' ? `确认已核对全部 ${task.words.length} 个词${wrong.length ? `，其中 ${wrong.length} 个错词` : '，本次全对'}`
            : state === 'leave' ? '确认本次请假，不计入错误率' : '确认本次未参加，不计入错误率'}</span>
        </label>
      </fieldset>

      <div role="status" aria-live="polite" className={styles.feedback} data-error={message.includes('失败') || undefined}>
        {readOnly ? '当前只读，可查看记录与打印，不能提交批改。' : message || '完成逐词核对后，请勾选确认并保存。'}
      </div>
      {saved?.[0] === 'graded' && saved[1].length > 0 && <div className={styles.reviewAction}>
        <Button disabled={dirty || busy || readOnly} onClick={() => void onReview(student)}>为{student.name}安排错词复习</Button>
      </div>}
      <footer className={styles.saveBar}>
        <span>已标记 <b>{state === 'graded' ? wrong.length : 0}</b> 个错词</span>
        <Button intent="text" disabled={busy || readOnly} onClick={discard}>放弃修改</Button>
        <Button intent="primary" busy={busy} disabled={!confirmed || readOnly} onClick={() => void save()}>{task.context.kind === 'class' ? '保存并下一位' : '保存批改'}</Button>
      </footer>
    </main>

    {task.context.kind === 'class' && <aside className={styles.queue}>
      <div className={styles.queueHeading}><h3>本次学生</h3><span>{rows.length} 人</span></div>{renderQueue('desktop-dictation')}
    </aside>}
    {task.context.kind === 'class' && <Drawer open={showRoster} title="选择学生"
      description={`本次共 ${task.participants.length} 人，已处理 ${completed} 人。`}
      onRequestClose={() => setShowRoster(false)}>{renderQueue('mobile-dictation')}</Drawer>}
  </div>;
}
