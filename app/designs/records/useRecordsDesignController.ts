import {useEffect,useRef,useState} from 'react';
import {makeId,type ClassroomData,type CommunicationRecord,type NotificationDraft} from '@/lib/classroom';
import {communicationRecordsForClass,localCommunicationDate,saveCommunicationRecord,patchCommunicationStatus,removeCommunicationRecord,type CommunicationRecordDraft} from '@/app/w/[token]/features/records/operations';
import {notificationDraftsForClass,saveNotificationDraft,markNotificationCopied,saveNotificationReceipt,removeNotificationDraft,type NotificationDraftInput} from '@/app/w/[token]/features/notifications/operations';
import {copyTextToClipboard} from '@/lib/clipboard';

export const recordTypes=['家访登记','家校沟通','谈心记录','作业跟进','纪律表现','表扬记录','心理关注','成长记录'];
export const recordChannels=['微信','电话','面谈','家访','班级群'];
export const recordStatus=(r:CommunicationRecord)=>r.status??'待跟进';
export function recordFields(text:string){
 const parts=/^目的：([\s\S]*?)｜(?:家庭情况|家庭与在校情况)：([\s\S]*?)｜沟通内容：([\s\S]*)$/.exec(text);
 return parts?{purpose:parts[1],home:parts[2],content:parts[3]}:{purpose:'',home:'',content:text};
}
export type RecordEditor={kind:'record';value:CommunicationRecordDraft}|{kind:'notice';value:NotificationDraftInput}|{kind:'receipt';id:string;note:string};
type Pending={classId:string;label:string;closeEditor:boolean};
export function useRecordsDesignController({data,update,save,readOnly,mobile,conflict=false,exportDraft,loadLatest}:{data:ClassroomData;update:(fn:(d:ClassroomData)=>ClassroomData)=>void;save:()=>Promise<boolean>;readOnly:boolean;mobile:boolean;conflict?:boolean;exportDraft:()=>void;loadLatest:()=>void}){
 const classId=data.activeClassId??data.rosterClasses?.[0]?.id??'',activeClass=data.rosterClasses?.find(c=>c.id===classId),students=activeClass?.students??data.students;
 const [tab,setTab]=useState('records'),[query,setQuery]=useState(''),[type,setType]=useState('全部类型'),[status,setStatus]=useState('全部'),[page,setPage]=useState(1),[noticePage,setNoticePage]=useState(1),[detailId,setDetailId]=useState('');
 const [editor,setEditor]=useState<RecordEditor|null>(null),[baseline,setBaseline]=useState(''),[owner,setOwner]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState<Pending|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[confirmClose,setConfirmClose]=useState(false),[deleteTarget,setDeleteTarget]=useState<{kind:'record'|'notice';id:string;title:string}|null>(null);
 const busyRef=useRef(false),pendingRef=useRef<Pending|null>(null),allowLeave=useRef(false);
 const records=communicationRecordsForClass(data,classId),notices=notificationDraftsForClass(data,classId);
 const filtered=records.filter(r=>(type==='全部类型'||r.type===type)&&(status==='全部'||recordStatus(r)===status)&&`${r.student} ${r.date} ${r.type} ${r.channel??''} ${r.content} ${r.parentFeedback??''} ${r.followUp??''} ${recordStatus(r)}`.includes(query.trim()));
 const ordered=[...filtered].sort((a,b)=>['待跟进','已跟进','已归档'].indexOf(recordStatus(a))-['待跟进','已跟进','已归档'].indexOf(recordStatus(b)));
 const pages=Math.max(1,Math.ceil(ordered.length/10)),safePage=Math.min(page,pages),noticePages=Math.max(1,Math.ceil(notices.length/4)),safeNoticePage=Math.min(noticePage,noticePages),detail=records.find(r=>r.id===detailId);
 const dirty=!!editor&&JSON.stringify(editor)!==baseline;
 const locked=busy||!!pending;
 const reset=()=>{setQuery('');setType('全部类型');setStatus('全部');setPage(1);};
 const begin=(next:RecordEditor)=>{if(readOnly||busyRef.current||pendingRef.current)return;setEditor(next);setBaseline(JSON.stringify(next));setOwner(classId);setError('');};
 const openRecord=(r?:CommunicationRecord)=>{const student=r?(students.find(s=>s.id===r.studentId)??students.find(s=>s.name===r.student)):null;begin({kind:'record',value:r?{id:r.id,studentId:student?.id??'',type:r.type,channel:r.channel??'面谈',date:r.date,...recordFields(r.content),parentFeedback:r.parentFeedback??'',followUp:r.followUp??''}:{studentId:'',type:'家访登记',channel:'微信',date:localCommunicationDate(),purpose:'',home:'',content:'',parentFeedback:'',followUp:''}});};
 const openNotice=(n?:NotificationDraft)=>begin({kind:'notice',value:n?{id:n.id,title:n.title,content:n.content,channel:n.channel,recipientStudentIds:[...(n.recipientStudentIds??[])]}:{title:'',content:'',channel:'班级群',recipientStudentIds:[]}});
 const openReceipt=(n:NotificationDraft)=>begin({kind:'receipt',id:n.id,note:n.receiptNote??''});
 const requestClose=()=>{if(busyRef.current)return;if(dirty||pendingRef.current){setConfirmClose(true);return;}setEditor(null);};
 const discard=()=>{if(pendingRef.current)return;setEditor(null);setConfirmClose(false);setError('');};
 async function sync(){
  if(readOnly||busyRef.current||!pendingRef.current)return;
  if(pendingRef.current.classId!==classId){setError('班级已变化，请返回原班级处理待同步改动。');return;}
  busyRef.current=true;setBusy(true);setError('');
  try{if(!await save()){setError('同步失败，本机改动已保留。请重试同步，不会重复新增。');return;}const done=pendingRef.current;pendingRef.current=null;setPending(null);if(done?.closeEditor)setEditor(null);setConfirmClose(false);setMessage(done?.label??'已保存');}
  catch{setError('保存连接中断，本机改动已保留，请重试同步。');}
  finally{busyRef.current=false;setBusy(false);}
 }
 async function commit(recipe:(d:ClassroomData)=>ClassroomData,label:string,closeEditor=false){
  if(readOnly||busyRef.current||pendingRef.current)return;
  const item={classId,label,closeEditor};pendingRef.current=item;setPending(item);update(recipe);await sync();
 }
 async function saveEditor(){
  if(readOnly||busyRef.current||!editor)return;if(pendingRef.current){await sync();return;}
  if(owner!==classId){setError('班级已变化，请返回原班级处理草稿。');return;}
  if(editor.kind==='record'){
   const result=saveCommunicationRecord(data,classId,editor.value,makeId);if(result.error){setError(result.error);return;}
   const old=records.find(r=>r.id===editor.value.id),item={...old,...result.record!};
   await commit(current=>({...current,records:old?current.records.map(r=>r.id===item.id?item:r):[item,...current.records]}),'沟通记录已保存',true);
  }else if(editor.kind==='notice'){
   const result=saveNotificationDraft(data,classId,editor.value,()=>makeId('notice'));if(result.error){setError(result.error);return;}const item=result.draft!;
   await commit(current=>({...current,notificationDrafts:editor.value.id?(current.notificationDrafts??[]).map(n=>n.id===item.id?item:n):[item,...(current.notificationDrafts??[])]}),'通知草稿已保存',true);
  }else await commit(current=>saveNotificationReceipt(current,classId,editor.id,editor.note),'回执已记录',true);
 }
 async function changeStatus(r:CommunicationRecord,next:CommunicationRecord['status']){await commit(current=>patchCommunicationStatus(current,classId,r.id,next),'沟通状态已更新');}
 async function remove(){if(!deleteTarget||readOnly||busyRef.current||pendingRef.current)return;const target=deleteTarget;setDeleteTarget(null);await commit(current=>target.kind==='record'?removeCommunicationRecord(current,classId,target.id):removeNotificationDraft(current,classId,target.id),'记录已删除');if(target.kind==='record')setDetailId('');}
 async function copyRecord(r:CommunicationRecord){const ok=await copyTextToClipboard(`${r.student}｜${r.type}｜${r.content}｜${r.followUp??''}`,'已复制沟通记录');setMessage(ok?'已复制沟通记录':'复制失败，请重试。');}
 async function copyNotice(n:NotificationDraft){
  if(busyRef.current||pendingRef.current)return;busyRef.current=true;setBusy(true);
  let ok=false;try{ok=await copyTextToClipboard(`${n.title}\n\n${n.content}`,'已复制通知草稿');}finally{busyRef.current=false;setBusy(false);}
  if(!ok){setMessage('复制失败，请重试；草稿状态未改变。');return;}setMessage('已复制通知，请在对应渠道自行发送。');
  if(!readOnly)await commit(current=>markNotificationCopied(current,classId,n.id),'已复制通知，请在对应渠道自行发送。');
 }
 const replaceLatest=()=>{allowLeave.current=true;loadLatest();};
 useEffect(()=>{const guard=(event:Event)=>{if(!allowLeave.current&&(dirty||pending||busy)){event.preventDefault();if(!busy)setConfirmClose(true);}};const unload=(event:BeforeUnloadEvent)=>{if(!allowLeave.current&&(dirty||pending||busy)){event.preventDefault();event.returnValue='';}};window.addEventListener('classroom:before-navigate',guard);window.addEventListener('beforeunload',unload);return()=>{window.removeEventListener('classroom:before-navigate',guard);window.removeEventListener('beforeunload',unload);};},[dirty,pending,busy]);
 return {data,classId,activeClass,students,records,notices,filtered,rows:ordered.slice((safePage-1)*10,safePage*10),pages,safePage,setPage,noticeRows:notices.slice((safeNoticePage-1)*4,safeNoticePage*4),noticePages,safeNoticePage,setNoticePage,tab,setTab,query,setQuery:(v:string)=>{setQuery(v);setPage(1);},type,setType:(v:string)=>{setType(v);setPage(1);},status,setStatus:(v:string)=>{setStatus(v);setPage(1);},reset,detail,setDetailId,editor,setEditor,openRecord,openNotice,openReceipt,saveEditor,requestClose,discard,confirmClose,setConfirmClose,deleteTarget,setDeleteTarget,remove,changeStatus,copyRecord,copyNotice,busy,pending,dirty,locked,error,message,setMessage,readOnly,mobile,conflict,exportDraft,replaceLatest,sync};
}
