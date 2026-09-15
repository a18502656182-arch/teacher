import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ClassroomData } from '../../lib/classroom';
import { AttendanceDesign } from '../../app/designs/attendance/AttendanceDesign';
import { useAttendanceDesignController } from '../../app/designs/attendance/useAttendanceDesignController';
import { WorkbenchShell } from '../../app/components/workbench/shell/WorkbenchShell';
import { ThemeBoundary } from '../../app/components/workbench/theme/ThemeBoundary';
import { Dialog } from '../../app/components/workbench/ui/Dialog';
import { attendanceFixture, attendanceStates } from './attendance-fixture';
import './students-preview.css';

const RealDate=Date;
const frozen=RealDate.parse('2026-09-15T09:00:00+08:00');
globalThis.Date=new Proxy(RealDate,{construct:(target,args)=>Reflect.construct(target,args.length?args:[frozen]),get:(target,key)=>key==='now'?()=>frozen:Reflect.get(target,key)});
const scenario=new URLSearchParams(location.search).get('state')||'normal';

function Preview(){
 const [data,setData]=useState(()=>attendanceFixture(scenario));
 const [mobile,setMobile]=useState(innerWidth<=900);
 const [sync,setSync]=useState('normal');
 const [notice,setNotice]=useState('');
 const attempts=useRef(0); const initialized=useRef(false);
 const readOnly=scenario==='readonly';
 const update=(fn:(d:ClassroomData)=>ClassroomData)=>{if(!readOnly)setData(fn);};
 const save=async()=>{if(readOnly)return false;attempts.current++;setSync('saving');await new Promise(r=>setTimeout(r,scenario==='saving'?60000:500));const failed=attempts.current===1&&['save-failure','conflict-409','save-failure-empty'].includes(scenario);setSync(failed?(scenario==='save-failure-empty'?'save-failure':scenario):'normal');return !failed;};
 const c=useAttendanceDesignController({data,update,save,readOnly,mobile,unsynced:sync!=='normal'});
 useEffect(()=>{const media=matchMedia('(max-width:900px)');const changed=()=>setMobile(media.matches);media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);},[]);
 useEffect(()=>{if(initialized.current)return;initialized.current=true;
  if(scenario==='search-empty')c.setKeyword('不存在的合成学生');
  if(scenario==='history-date')c.changeDate('2026-09-14');
  if(scenario==='selected-batch'){c.setSelectedIds(['att-student-1','att-student-2']);c.setBatchStatus('请假');c.setBatchNote('合成：家长已联系');}
  if(['day-note','dirty-leave'].includes(scenario))c.setNoteDrafts({'att-student-1':'合成未保存备注'});
  if(['saving','save-failure','conflict-409','save-failure-empty'].includes(scenario))void c.setStudentStatus('att-student-1','迟到');
 },[c]);
 const navigate=()=>{const allowed=window.dispatchEvent(new Event('classroom:before-navigate',{cancelable:true}));if(allowed)setNotice('当前为考勤独立设计稿，仅包含合成数据。');};
 const surface=scenario==='loading'?<p role="status">正在加载考勤名单…</p>:<AttendanceDesign controller={c}/>;
 useEffect(()=>{Object.assign(window,{__attendance:{getData:()=>data,getState:()=>({selected:c.selectedIds,date:c.selectedDate,busy:c.busy,unsaved:c.hasUnsavedInput,sync,notes:c.noteDrafts,page:c.safeListPage}),controller:c}});},[c,data,sync]);
 return <><script type="application/json" id="attendance-design-fixture">{JSON.stringify(attendanceFixture(scenario))}</script><WorkbenchShell active="attendance" scene="class" classes={data.rosterClasses!} activeClass={data.rosterClasses![0]} workspaceGrade="三年级" saving={sync==='saving'} dirty={sync!=='normal'} error={sync==='save-failure'?'保存失败，输入已保留。':sync==='conflict-409'?'版本冲突：工作区已有更新。':''} isDemo={false} isReadOnly={readOnly} desktopContent={!mobile?surface:null} mobileContent={mobile?surface:null} onOpen={navigate} onBack={navigate} onSwitchClass={navigate} onScene={navigate} onAccount={()=>setNotice('隔离考勤设计 · 合成数据 · 保存与冲突均为模拟。')} onRetrySave={()=>void save()} onClearError={()=>{}} saveConflict={sync==='conflict-409'} onExportDraft={()=>{const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));a.href=url;a.download='synthetic-attendance-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}} onLoadLatest={()=>location.reload()}/><ThemeBoundary><Dialog open={!!notice} title="隔离设计预览" onRequestClose={()=>setNotice('')}><p>{notice}</p></Dialog></ThemeBoundary><details className="design-controls"><summary>设计预览 · 合成数据</summary><label>查看状态<select aria-label="预览状态" value={scenario} onChange={e=>location.assign(`attendance.html?state=${e.target.value}`)}>{attendanceStates.map(s=><option key={s}>{s}</option>)}</select></label><p>仅内存交互，保存/失败/409为模拟，刷新恢复。</p></details></>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
