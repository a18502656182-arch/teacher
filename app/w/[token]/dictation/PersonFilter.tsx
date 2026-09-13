'use client';
import { useState } from 'react';
import type { Participant } from '@/lib/dictation';
import { Button } from '@/app/components/workbench/ui/Button';
import { Field, Input } from '@/app/components/workbench/ui/Field';
import { Pager } from '@/app/components/campus/primitives';
import styles from './PersonFilter.module.css';

export function PersonFilter({ people, value, onChange }: { people: Participant[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const rows = people.filter(person => `${person.name} ${person.number}`.includes(query));
  return <div className={styles.filter}>
    <Button aria-expanded={open} onClick={() => setOpen(!open)}>统计对象：{people.find(person => person.id === value)?.name ?? '全班'}</Button>
    {open && <div className={styles.panel}>
      <Field id="dictation-person-query" label="查找学生"><Input id="dictation-person-query" type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="姓名或学号"/></Field>
      <div className={styles.people}>
        <Button intent="text" onClick={() => { onChange(''); setOpen(false); }}>全班</Button>
        {rows.slice((page - 1) * 20, page * 20).map(person => <Button key={person.id} intent="text" onClick={() => { onChange(person.id); setOpen(false); }}>{person.name} {person.number}</Button>)}
      </div>
      <Pager page={page} count={rows.length} onPage={setPage}/>
    </div>}
  </div>;
}
