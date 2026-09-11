'use client';
import { useState } from 'react';
import type { Participant } from '@/lib/dictation';
import { Button, Pager } from '@/app/components/campus/primitives';

export function PersonFilter({ people, value, onChange }: { people: Participant[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const rows = people.filter(p => `${p.name} ${p.number}`.includes(query));
  return <div className="dictation-person-filter">
    <Button aria-expanded={open} onClick={() => setOpen(!open)}>统计对象：{people.find(p => p.id === value)?.name ?? '全班'}</Button>
    {open && <div><label>查找学生<input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="姓名或学号" /></label>
      <Button intent="text" onClick={() => { onChange(''); setOpen(false); }}>全班</Button>
      <div className="dictation-participant-picker">{rows.slice((page - 1) * 20, page * 20).map(p => <Button key={p.id} intent="text" onClick={() => { onChange(p.id); setOpen(false); }}>{p.name} {p.number}</Button>)}</div>
      <Pager page={page} count={rows.length} onPage={setPage}/>
    </div>}
  </div>;
}
