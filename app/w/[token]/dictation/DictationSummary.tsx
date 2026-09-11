'use client';
import type { ClassroomData } from '@/lib/classroom';
import { statistics, today } from '@/lib/dictation';
import { Button, ThemeArtwork } from '@/app/components/campus/primitives';
export function DictationSummary({data,open}:{data:ClassroomData;open:()=>void}) {
 const tasks=(data.dictation?.tasks??[]).filter(t=>!t.archived&&t.context.kind==='class'&&t.context.classId===data.activeClassId&&t.date<=today());
 const pending=tasks.filter(t=>statistics([t]).pending>0);
 return <section className="campus-home-intro"><div><h2>今天的班务</h2><p>{today()} · {data.rosterClasses?.find(c=>c.id===data.activeClassId)?.name??'当前班级'}</p><div className="campus-home-links"><Button intent="primary" onClick={open}>{pending.length?`继续批改 · ${pending.length}次听写`:'听写与复习'}</Button><Button intent="text" onClick={()=>{window.sessionStorage.setItem('classroom-learning-scene','family');open();}}>家庭学习 · {data.dictation?.children.filter(c=>!c.archived).length??0}个孩子</Button></div></div><ThemeArtwork slot="dashboard"/></section>;
}
export function StudentDictationHistory({data,studentId}:{data:ClassroomData;studentId:string}) {
 const tasks=(data.dictation?.tasks??[]).filter(t=>t.context.kind==='class'&&t.context.classId===data.activeClassId&&t.participants.some(p=>p.id===studentId)).toSorted((a,b)=>b.date.localeCompare(a.date));
 return <section className="student-profile-attendance"><h3>听写学习记录</h3>{tasks.slice(0,20).map(t=>{const r=t.results[studentId];return <article key={t.id}><b>{t.date} · {t.title}</b><span>{!r?'未批改':r[0]==='graded'?`${r[1].length}错 / ${t.words.length}词`:r[0]==='leave'?'请假':'未参加'}</span><small>{r?.[0]==='graded'?r[1].map(i=>t.words[i].text).join('、')||'已确认全对':'不计入错误率'}</small></article>;})}{!tasks.length&&<p>暂无听写记录。</p>}{tasks.length>20&&<p>展示最近20次，完整记录可在听写与复习查询。</p>}</section>;
}
