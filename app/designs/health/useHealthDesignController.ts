import {useEffect,useRef,useState} from 'react';
import {makeId,type ClassroomData,type CareProfile} from '@/lib/classroom';
import {localCareDate,saveCareProfile,removeCareProfile,primaryGuardianForStudent,type CareProfileDraft} from '@/app/w/[token]/features/health/operations';
export const categories=['过敏与饮食','呼吸与心血管','视觉与感官','行动与书写','心理与情绪','健康提醒','活动注意','座位照护','其他'] as const;
export const contexts=['体育活动','外出实践','午餐饮食','座位安排','考试安排','日常观察'];
export const categoryLabel=(p:CareProfileDraft)=>p.category==='其他'&&p.customCategory?.trim()?p.customCategory:p.category;
export function useHealthDesignController({data,update,save,readOnly,mobile,conflict=false,exportDraft,loadLatest}:{data:ClassroomData;update:(fn:(d:ClassroomData)=>ClassroomData)=>void;save:()=>Promise<boolean>;readOnly:boolean;mobile:boolean;conflict?:boolean;exportDraft:()=>void;loadLatest:()=>void}){
 const classId=data.activeClassId??data.rosterClasses?.[0]?.id??'',activeClass=data.rosterClasses?.find(v=>v.id===classId),students=activeClass?.students??data.students;
 const defaults={query:'',severity:'全部',category:'全部',context:'全部'};
 const [filters,setFilters]=useState(defaults),[page,setPage]=useState(1),[id,setId]=useState(''),[detailOpen,setDetailOpen]=useState(false),[draft,setDraft]=useState<CareProfileDraft|null>(null),[baseline,setBaseline]=useState(''),[owner,setOwner]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState<''|'save'|'delete'>(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[confirmClose,setConfirmClose]=useState(false),[confirmDelete,setConfirmDelete]=useState(false);
 const [customContextsText,setCustomContextsText]=useState(''),[customBaseline,setCustomBaseline]=useState('');
 const busyRef=useRef(false),pendingRef=useRef<''|'save'|'delete'>('');
 const profiles=(data.careProfiles??[]).filter(p=>(!p.classId||p.classId===classId)&&students.some(s=>s.id===p.studentId)).toSorted((a,b)=>({紧急:0,重要:1,一般:2}[a.severity]-{紧急:0,重要:1,一般:2}[b.severity])||(students.find(s=>s.id===a.studentId)?.name??'').localeCompare(students.find(s=>s.id===b.studentId)?.name??'','zh-CN'));
 const shown=profiles.filter(p=>(filters.severity==='全部'||p.severity===filters.severity)&&(filters.category==='全部'||p.category===filters.category)&&(filters.context==='全部'||p.actionContexts?.includes(filters.context))&&`${students.find(s=>s.id===p.studentId)?.name} ${categoryLabel(p)} ${p.summary??''} ${p.instruction} ${p.contraindication??''} ${p.actionContexts?.join(' ')}`.includes(filters.query.trim()));
 const pages=Math.max(1,Math.ceil(shown.length/10)),safePage=Math.min(page,pages),rows=shown.slice((safePage-1)*10,safePage*10),selected=rows.find(p=>p.id===id)??rows[0],dirty=!!draft&&(JSON.stringify(draft)!==baseline||customContextsText!==customBaseline||!!pending);
 const changeFilter=(key:keyof typeof defaults,value:string)=>{setFilters(f=>({...f,[key]:value}));setPage(1);};
 const reset=()=>{setFilters(defaults);setPage(1);};
 const openEditor=(profile?:CareProfile)=>{if(readOnly||busyRef.current||pendingRef.current)return;const next:CareProfileDraft=profile?{...profile}:{id:'',studentId:'',category:'健康提醒',severity:'一般',summary:'',instruction:'',contraindication:'',actionContexts:[],customCategory:'',reviewedAt:localCareDate()};const custom=(next.actionContexts??[]).filter(v=>!contexts.includes(v)).join('、');setCustomContextsText(custom);setCustomBaseline(custom);setDraft(next);setBaseline(JSON.stringify(next));setOwner(classId);setError('');};
 const requestClose=()=>{if(busyRef.current)return;if(dirty){setConfirmClose(true);return;}setDraft(null);};
 const discard=()=>{if(pendingRef.current)return;setDraft(null);setConfirmClose(false);setError('');};
 async function persist(kind:'save'|'delete'='save'){
  if(readOnly||busyRef.current||!draft)return;
  if(owner!==classId){setError('班级已变化，请返回原班级处理草稿。');return;}
  if(!pendingRef.current){
   if(kind==='save'){if(!draft.studentId){setError('请先选择学生。');return;}const result=saveCareProfile(data,classId,{...draft,actionContexts:[...(draft.actionContexts??[]).filter(v=>contexts.includes(v)),...customContextsText.split(/[、，,\n]/).map(v=>v.trim()).filter(Boolean).slice(0,8)]},makeId);if(result.error){setError(result.error);return;}const profile=result.profile!;update(current=>({...current,careProfiles:[profile,...(current.careProfiles??[]).filter(p=>p.id!==profile.id)]}));setId(profile.id);}
   else {if(!draft.id)return;update(current=>removeCareProfile(current,classId,draft.id));}
   pendingRef.current=kind;setPending(kind);
  }
  busyRef.current=true;setBusy(true);setError('');setConfirmDelete(false);
  try{if(!await save()){setError('同步失败，本机改动已保留。重试不会重复新增。');return;}setMessage(pendingRef.current==='delete'?'照护登记已删除':'照护登记已保存');pendingRef.current='';setPending('');setDraft(null);setConfirmClose(false);}
  catch{setError('保存连接中断，本机改动已保留，请重试。');}
  finally{busyRef.current=false;setBusy(false);}
 }
 useEffect(()=>{const leave=(e:Event)=>{if(busyRef.current||dirty){e.preventDefault();if(!busyRef.current)setConfirmClose(true);}};const unload=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('classroom:before-navigate',leave);window.addEventListener('beforeunload',unload);return()=>{window.removeEventListener('classroom:before-navigate',leave);window.removeEventListener('beforeunload',unload);};},[dirty]);
 return {data,classId,activeClass,students,profiles,shown,selected,pages,safePage,setPage,rows,customContextsText,setCustomContextsText,filters,changeFilter,reset,select:(next:string)=>{setId(next);setDetailOpen(true);},detailOpen,setDetailOpen,draft,setDraft,openEditor,requestClose,discard,persist,busy,pending,dirty,error,message,setMessage,confirmClose,setConfirmClose,confirmDelete,setConfirmDelete,readOnly,mobile,conflict,exportDraft,loadLatest,availableContexts:[...new Set([...contexts,...profiles.flatMap(p=>p.actionContexts??[])])],guardian:(studentId:string)=>primaryGuardianForStudent(data.guardians??[],classId,studentId)};
}
