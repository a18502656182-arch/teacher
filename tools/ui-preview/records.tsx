import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {ClassroomData} from '../../lib/classroom';
import {RecordsDesign} from '../../app/designs/records/RecordsDesign';
import {useRecordsDesignController} from '../../app/designs/records/useRecordsDesignController';
import {WorkbenchShell} from '../../app/components/workbench/shell/WorkbenchShell';
import {recordsFixture,recordsStates} from './records-fixture';
import './students-preview.css';
const RealDate=Date,frozen=RealDate.parse('2026-09-15T09:00:00+08:00');
globalThis.Date=new Proxy(RealDate,{construct:(target,args)=>Reflect.construct(target,args.length?args:[frozen]),get:(target,key)=>key==='now'?()=>frozen:Reflect.get(target,key)});
const scenario=new URLSearchParams(location.search).get('state')||'normal';
function Preview(){
 const [data,setData]=useState(()=>recordsFixture(scenario)),[mobile,setMobile]=useState(innerWidth<=900),[sync,setSync]=useState('normal');const attempts=useRef(0),initialized=useRef(false),submitted=useRef(false);const readOnly=scenario==='readonly';
 const update=(fn:(d:ClassroomData)=>ClassroomData)=>{if(!readOnly)setData(fn);};
 const save=async()=>{if(readOnly)return false;attempts.current++;setSync('saving');await new Promise(r=>setTimeout(r,scenario==='saving'?60000:400));const fail=scenario==='conflict-409'||attempts.current===1&&['save-failure','save-throw','delete-failure'].includes(scenario);setSync(fail?scenario:'normal');if(fail&&scenario==='save-throw')throw Error('synthetic network interruption');return !fail;};
 const exportDraft=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));a.href=url;a.download='synthetic-records-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const loadLatest=()=>location.assign('records.html?state=normal');
 const c=useRecordsDesignController({data,update,save,readOnly,mobile,conflict:sync==='conflict-409',exportDraft,loadLatest});
 useEffect(()=>{const media=matchMedia('(max-width:900px)');const changed=()=>setMobile(media.matches);media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);},[]);
 useEffect(()=>{if(initialized.current)return;initialized.current=true;if(scenario==='search-empty')c.setQuery('不存在');if(scenario==='notices')c.setTab('notices');if(['mobile-detail','long-record','legacy'].includes(scenario))c.setDetailId(c.records[0]?.id??'');if(['composer','validation','dirty-close','saving','save-failure','save-throw','conflict-409'].includes(scenario))c.openRecord();if(scenario==='notice-editor')c.openNotice();if(scenario==='receipt-editor')c.openReceipt(c.notices[0]);},[c]);
 useEffect(()=>{if(submitted.current||!c.editor)return;if(['saving','save-failure','save-throw','conflict-409','dirty-close'].includes(scenario)&&c.editor.kind==='record'){if(!c.editor.value.studentId){c.setEditor({...c.editor,value:{...c.editor.value,studentId:c.students[0].id,content:'合成沟通事实'}});return;}submitted.current=true;if(scenario==='dirty-close')c.requestClose();else void c.saveEditor();}if(scenario==='validation'){submitted.current=true;void c.saveEditor();}},[c]);
 useEffect(()=>{Object.assign(window,{__records:{getData:()=>data,controller:c,getState:()=>({busy:c.busy,dirty:c.dirty,pending:c.pending,sync,editor:c.editor?.kind,selected:c.detail?.id})}});},[c,data,sync]);
 const navigate=()=>{if(window.dispatchEvent(new Event('classroom:before-navigate',{cancelable:true})))c.setMessage('独立沟通设计稿：当前仅含合成数据。');};
 const surface=scenario==='loading'?<p className="design-loading" role="status">正在加载健康与沟通…</p>:<RecordsDesign controller={c}/>;
 return <><script id="records-design-fixture" type="application/json">{JSON.stringify(recordsFixture(scenario))}</script><WorkbenchShell active="records" scene="class" classes={data.rosterClasses!} activeClass={data.rosterClasses![0]} workspaceGrade="三年级" saving={sync==='saving'} dirty={sync!=='normal'} error={sync==='conflict-409'?'版本冲突，草稿已保留。':['save-failure','save-throw','delete-failure'].includes(sync)?'保存失败，草稿已保留。':''} isDemo={false} isReadOnly={readOnly} desktopContent={!mobile?surface:null} mobileContent={mobile?surface:null} onOpen={navigate} onBack={navigate} onSwitchClass={navigate} onScene={navigate} onAccount={navigate} onRetrySave={()=>void c.sync()} onClearError={()=>{}} saveConflict={sync==='conflict-409'} onExportDraft={()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));a.href=url;a.download='synthetic-records-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}} onLoadLatest={()=>location.reload()}/><details className="design-controls"><summary>设计预览 · 合成数据</summary><label>查看状态<select aria-label="预览状态" value={scenario} onChange={e=>location.assign(`records.html?state=${e.target.value}`)}>{recordsStates.map(v=><option key={v}>{v}</option>)}</select></label><p>仅内存数据，保存/失败/409为模拟；刷新恢复。</p></details></>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
