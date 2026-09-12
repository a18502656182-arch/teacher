'use client';
import { useEffect, useRef, useState } from 'react';
import type { DictationResult, DictationTask, Participant } from '@/lib/dictation';

export type GradingProps = {
 task: DictationTask; token: string; readOnly: boolean;
 onSave: (id: string, result: DictationResult) => Promise<boolean>;
 onBack: () => void; onReview: (person: Participant) => Promise<void>;
};

/** Shared by the incumbent view and its replacement. The parent owns server commits. */
export function useGradingController({task,token,readOnly,onSave}: GradingProps) {
 const [studentId,setStudentId]=useState(task.participants.find(p=>!task.results[p.id])?.id??task.participants[0].id),[query,setQuery]=useState(''),[pendingOnly,setPendingOnly]=useState(false),[page,setPage]=useState(1),[wrong,setWrong]=useState<number[]>([]),[state,setState]=useState<DictationResult[0]>('graded'),[confirmed,setConfirmed]=useState(false),[note,setNote]=useState(''),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[showRoster,setShowRoster]=useState(false);
 const saved=task.results[studentId],student=task.participants.find(p=>p.id===studentId)!;
 const storageKey=`classroom-dictation-draft:${token}:${task.id}:${studentId}`;
 const resultRef=useRef<DictationResult|null>(null);
 const rows=task.participants.filter(p=>(!pendingOnly||!task.results[p.id])&&`${p.name} ${p.number}`.toLowerCase().includes(query.toLowerCase()));
 useEffect(()=>{
   const r=task.results[studentId];setWrong(r?.[1]??[]);setState(r?.[0]??'graded');setConfirmed(false);setNote(r?.[3]??'');setDirty(false);resultRef.current=null;setMessage('');
   if(readOnly)return;
   try{const raw=localStorage.getItem(storageKey);if(raw){const d=JSON.parse(raw);if(Array.isArray(d.wrong)&&d.wrong.every((n:unknown)=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<task.words.length)&&['graded','leave','absent'].includes(d.state)&&typeof d.note==='string'){setWrong(d.wrong);setState(d.state);setNote(d.note);setDirty(true);setMessage('已恢复本机批改草稿，请核对并确认。');}}}catch{setMessage('本机草稿不可读取，请核对纸面记录。');}
 // Selection changes reload only that participant; server acknowledgements must not erase an in-flight draft.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[studentId,storageKey,readOnly]);
 useEffect(()=>{if(!dirty||readOnly)return;try{localStorage.setItem(storageKey,JSON.stringify({wrong,state,note}));}catch{setMessage('本机草稿存储不可用，请保持本页打开并重试保存。');}},[wrong,state,note,dirty,storageKey,readOnly]);
 useEffect(()=>{if(!dirty&&!busy)return;const guard=(e:Event)=>{e.preventDefault();setMessage('当前批改尚未保存，请先保存或放弃本次修改。');};const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('classroom:before-navigate',guard);window.addEventListener('beforeunload',unload);return()=>{window.removeEventListener('classroom:before-navigate',guard);window.removeEventListener('beforeunload',unload);};},[dirty,busy]);
 function changeStudent(id:string){if(dirty||busy){setMessage('请先保存当前批改，或点击“放弃修改”。');return;}setStudentId(id);setShowRoster(false);}
 function discard(){setWrong(saved?.[1]??[]);setState(saved?.[0]??'graded');setNote(saved?.[3]??'');setConfirmed(false);setDirty(false);resultRef.current=null;try{localStorage.removeItem(storageKey);}catch{}setMessage('已放弃本次未确认修改');}
 async function save(){if(readOnly||busy||!confirmed)return;setBusy(true);setMessage('正在保存…');const r=resultRef.current??[state,state==='graded'?wrong:[],new Date().toISOString(),note] as DictationResult;resultRef.current=r;try{if(!await onSave(studentId,r)){setDirty(true);setMessage('保存失败，仍停留在当前学生。请重试；若版本冲突，请先导出草稿并核对最新数据。');return;}setDirty(false);setConfirmed(false);resultRef.current=null;try{localStorage.removeItem(storageKey);}catch{}setMessage('服务器已确认保存');const next=task.participants.find(p=>p.id!==studentId&&!task.results[p.id]);if(next)setStudentId(next.id);}catch{setDirty(true);setMessage('保存失败，请重试');}finally{setBusy(false);}}
 return { studentId,query,setQuery,pendingOnly,setPendingOnly,page,setPage,wrong,setWrong,state,setState,confirmed,setConfirmed,note,setNote,dirty,setDirty,busy,message,setMessage,showRoster,setShowRoster,saved,student,rows,resultRef,changeStudent,discard,save };
}
