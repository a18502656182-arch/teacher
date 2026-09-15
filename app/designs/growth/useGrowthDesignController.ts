import {useEffect,useRef,useState} from 'react';
import {makeId,type ClassroomData} from '@/lib/classroom';
import {addGrowthEvidence,type GrowthEvidenceDraft} from '@/app/w/[token]/features/growth/operations';
import {currentLocalDate} from '@/app/w/[token]/features/schedule/read-model';
import {copyTextToClipboard} from '@/lib/clipboard';
import {growthModel,type GrowthFilters} from './read-model';

export function useGrowthDesignController({data,update,save,readOnly,mobile,conflict=false,exportDraft,loadLatest}:{conflict?:boolean;exportDraft?:()=>void;loadLatest?:()=>void;data:ClassroomData;update:(fn:(d:ClassroomData)=>ClassroomData)=>void;save:()=>Promise<boolean>;readOnly:boolean;mobile:boolean}){
 const defaults:GrowthFilters={keyword:'',groupFilter:'全部小组',studentStatusFilter:'全部状态',coverageFilter:'全部记录',studentSort:'默认排序',kind:'全部类型',range:'全部时间',page:1};
 const [filters,setFilters]=useState(defaults),[id,setId]=useState(data.students[0]?.id??''),[listPage,setListPage]=useState(1),[detailOpen,setDetailOpen]=useState(false),[composer,setComposer]=useState(false),[summaryOpen,setSummaryOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[confirmClose,setConfirmClose]=useState(false);
 const newDraft=():GrowthEvidenceDraft=>({date:currentLocalDate(),type:'表扬记录',title:'',content:'',followUp:''});
 const [draft,setDraft]=useState(newDraft),[owner,setOwner]=useState(''),[pending,setPending]=useState(false);const pendingId=useRef<string|null>(null),busyRef=useRef(false);
 const student=data.students.find(s=>s.id===id)??data.students[0];const m=student?growthModel(data,student,filters,mobile):null;
 const dirty=!!(draft.title.trim()||draft.content.trim()||draft.followUp?.trim()||pending);
 const changeFilter=(key:keyof GrowthFilters,value:string|number)=>{setFilters(f=>({...f,[key]:value,page:key==='page'?Number(value):1}));if(!['kind','range','page'].includes(key))setListPage(1);};
 const reset=()=>{setFilters(defaults);setListPage(1);};
 const selectStudent=(next:string)=>{if(busyRef.current||composer&&dirty){setError('请先处理当前学生的记录草稿。');return;}setId(next);setDetailOpen(true);setFilters(f=>({...f,page:1}));};
 const openComposer=()=>{if(readOnly||busyRef.current||!student)return;setOwner(student.id);setComposer(true);setError('');};
 const requestClose=()=>{if(busyRef.current)return;if(dirty){setConfirmClose(true);return;}setComposer(false);};
 const discard=()=>{if(pendingId.current){setError('记录已在本机待同步，请先重试保存；关闭不会撤销它。');setConfirmClose(false);return;}setDraft(newDraft());setComposer(false);setConfirmClose(false);setError('');};
 async function saveEvidence(){
  if(readOnly||busyRef.current)return;
  if(!student||owner!==student.id){setError('学生已变化，请返回原学生处理草稿。');return;}
  if(!draft.date||!draft.title.trim()||!draft.content.trim()){setError('请填写日期、标题和具体事实。');return;}
  if(draft.title.length>40||draft.content.length>500||(draft.followUp?.length??0)>300){setError('内容超过字数限制，请缩短后保存。');return;}
  const classId=data.activeClassId??data.rosterClasses?.[0]?.id??'class-1';
  if(!pendingId.current){const result=addGrowthEvidence(data,classId,owner,draft,makeId);if(result.error){setError(result.error);return;}const item=result.item!;pendingId.current=item.id;setPending(true);update(current=>({...current,growthEvidence:[item,...(current.growthEvidence??[])]}));}
  busyRef.current=true;setBusy(true);setError('');
  try{const ok=await save();if(!ok){setError('同步失败，草稿已保留。请重试；不会重复新增记录。');return;}pendingId.current=null;setPending(false);setDraft(newDraft());setComposer(false);setMessage('成长记录已保存');setFilters(f=>({...f,page:1,kind:'全部类型',range:'全部时间'}));}
  catch{setError('保存连接中断，草稿已保留，请重试。');}
  finally{busyRef.current=false;setBusy(false);}
 }
 async function copySummary(){if(!m)return;const ok=await copyTextToClipboard('以下沿用旧规则生成；成绩与作业值没有明确长期统计范围，不能作为学生的常态评价。摘要口径待重新设计。\n\n'+m.summary,'已复制成长摘要');setMessage(ok?'已复制成长摘要':'复制失败，请重试或手动选择文本。');}
 useEffect(()=>{const leave=(e:Event)=>{if(busyRef.current||composer&&dirty){e.preventDefault();if(!busyRef.current)setConfirmClose(true);}};const unload=(e:BeforeUnloadEvent)=>{if(composer&&dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('classroom:before-navigate',leave);window.addEventListener('beforeunload',unload);return()=>{window.removeEventListener('classroom:before-navigate',leave);window.removeEventListener('beforeunload',unload);};},[composer,dirty]);
 const listPages=Math.max(1,Math.ceil((m?.shownStudents.length??0)/10)),safeListPage=Math.min(listPage,listPages);
 return {conflict,exportDraft,loadLatest,data,m,mobile,readOnly,filters,changeFilter,reset,id,selectStudent,listPages,safeListPage,setListPage,pageStudents:m?.shownStudents.slice((safeListPage-1)*10,safeListPage*10)??[],detailOpen,setDetailOpen,composer,openComposer,requestClose,summaryOpen,setSummaryOpen,draft,setDraft,owner,busy,error,message,setMessage,saveEvidence,copySummary,confirmClose,setConfirmClose,discard,dirty,pending};
}
