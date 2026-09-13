'use client';
import { useEffect, useRef, useState } from 'react';
import { makeId } from '@/lib/classroom';
import { parseWords, type WordBook } from '@/lib/dictation';
import { Pager } from '@/app/components/campus/primitives';
import { Button } from '@/app/components/workbench/ui/Button';
import { EmptyState } from '@/app/components/workbench/ui/FeedbackState';
import { Field, Input, Select, Textarea } from '@/app/components/workbench/ui/Field';
import styles from './WordLibrary.module.css';

type Props = { books: WordBook[]; readOnly: boolean; save: (book: WordBook) => Promise<boolean>; remove: (id: string) => Promise<void>; confirmAction: (message: string, title?: string, confirmLabel?: string) => Promise<boolean> };

export function WordLibrary({ books, readOnly, save, remove, confirmAction }: Props) {
  const [editing, setEditing] = useState<WordBook | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const newBookId = useRef('');
  const allowLeave = useRef(false);
  const rows = books.filter(book => `${book.title} ${book.subject} ${book.grade}`.includes(query));

  useEffect(() => {
    if (!dirty && !busy) return;
    const guard = (event: Event) => { if (!allowLeave.current) event.preventDefault(); };
    const unload = (event: BeforeUnloadEvent) => { if (!allowLeave.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('classroom:before-navigate', guard);
    window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener('classroom:before-navigate', guard); window.removeEventListener('beforeunload', unload); };
  }, [dirty, busy]);

  async function closeEditor() {
    if ((dirty || busy) && !await confirmAction('当前词库内容尚未保存，离开后本次修改会丢失。', '放弃词库草稿', '放弃修改')) return;
    allowLeave.current = true; setCreating(false); setEditing(null); setDirty(false); setError(''); newBookId.current = '';
    queueMicrotask(() => { allowLeave.current = false; });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || readOnly) return;
    const form = new FormData(event.currentTarget);
    try {
      const title = String(form.get('title')).trim(); if (!title) throw new Error('请填写词库名称');
      const entries = parseWords(String(form.get('words'))); if (!entries.length) throw new Error('请至少填写一个词');
      setBusy(true); setError('');
      const book: WordBook = { id: editing?.id ?? (newBookId.current ||= makeId('book')), title, subject: String(form.get('subject')), edition: String(form.get('edition')), grade: String(form.get('grade')), term: String(form.get('term')), entries };
      if (await save(book)) { allowLeave.current = true; setDirty(false); setEditing(null); setCreating(false); newBookId.current = ''; queueMicrotask(() => { allowLeave.current = false; }); }
      else setError('保存未完成，词库草稿已保留，请重试。');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败'); }
    finally { setBusy(false); }
  }

  if (creating || editing) return <form className={styles.form} onSubmit={submit} onChange={() => setDirty(true)}>
    <h2>{editing ? '编辑词库' : '建立词库'}</h2><p>每行一个词，可用竖线分隔：词语 | 释义 | 课次。同课次重复词自动去重。</p>
    <fieldset disabled={busy || readOnly}>
      <div className={styles.grid}>
        <Field id="wordbook-title" label="词库名称" required><Input id="wordbook-title" name="title" required maxLength={120} defaultValue={editing?.title}/></Field>
        <Field id="wordbook-subject" label="学科"><Select id="wordbook-subject" name="subject" defaultValue={editing?.subject ?? '英语'}><option>英语</option><option>语文</option><option>成语</option><option>自定义</option></Select></Field>
        <Field id="wordbook-edition" label="教材版本"><Input id="wordbook-edition" name="edition" maxLength={120} defaultValue={editing?.edition}/></Field>
        <Field id="wordbook-grade" label="年级"><Input id="wordbook-grade" name="grade" maxLength={80} defaultValue={editing?.grade}/></Field>
        <Field id="wordbook-term" label="学期"><Input id="wordbook-term" name="term" maxLength={80} defaultValue={editing?.term}/></Field>
      </div>
      <div className={styles.fullField}><Field id="wordbook-words" label="文本内容" required hint="最多 10,000 词；建立听写时每次最多取 200 词。"><Textarea id="wordbook-words" name="words" required rows={10} defaultValue={editing?.entries.map(word => `${word.text} | ${word.meaning} | ${word.lesson}`).join('\n')}/></Field></div>
      <div className={styles.fullField}><Field id="wordbook-file" label="导入 TXT 文件" hint="文件最大 512KB，内容会写入上方文本框供你核对。"><Input id="wordbook-file" type="file" accept=".txt,text/plain" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 512 * 1024) { setError('文本最多512KB，请分批导入'); return; } const area = event.target.form?.elements.namedItem('words') as HTMLTextAreaElement; if (area) { area.value = await file.text(); setDirty(true); } }}/></Field></div>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <div className={styles.actions}><Button disabled={busy} onClick={() => void closeEditor()}>取消</Button><Button type="submit" intent="primary" busy={busy} disabled={readOnly}>保存词库</Button></div>
  </form>;

  return <>
    <div className={`${styles.toolbar} campus-toolbar`}><Field id="wordbook-query" label="搜索词库"><Input id="wordbook-query" type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="名称、学科或年级"/></Field><Button intent="primary" disabled={readOnly} onClick={() => { newBookId.current = ''; setError(''); setDirty(false); setCreating(true); }}>建立词库 / 导入文本</Button></div>
    {!rows.length ? <EmptyState title={books.length ? '没有匹配的词库' : '还没有词库'} description={books.length ? '换个关键词，或清空搜索后查看全部词库。' : '可手动建立，也可导入 TXT 文本。'} artworkRole={books.length ? 'empty.no-results' : 'empty.first-use'}/>
      : <div className={styles.tableScroll}><table><thead><tr><th>词库</th><th>学科 / 年级</th><th>课次 / 词数</th><th>操作</th></tr></thead><tbody>{rows.slice((page - 1) * 20, page * 20).map(book => <tr key={book.id}><td>{book.title}<small>{book.edition} {book.term}</small></td><td>{book.subject} {book.grade}</td><td>{new Set(book.entries.map(word => word.lesson)).size}课 / {book.entries.length}词</td><td><div className={styles.cellActions}><Button intent="text" disabled={readOnly} onClick={() => { setError(''); setDirty(false); setEditing(book); }}>编辑</Button><Button intent="danger" disabled={readOnly} onClick={() => void remove(book.id)}>删除</Button></div></td></tr>)}</tbody></table></div>}
    <Pager page={page} count={rows.length} onPage={setPage}/>
  </>;
}
