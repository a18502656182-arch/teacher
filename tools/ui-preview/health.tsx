import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {ClassroomData} from '../../lib/classroom';
import {HealthDesign} from '../../app/designs/health/HealthDesign';
import {useHealthDesignController} from '../../app/designs/health/useHealthDesignController';
import {WorkbenchShell} from '../../app/components/workbench/shell/WorkbenchShell';
import {healthFixture,healthStates} from './health-fixture';
import './students-preview.css';
const RealDate=Date,frozen=RealDate.parse('2026-09-15T09:00:00+08:00');
globalThis.Date=new Proxy(RealDate,{construct:(target,args)=>Reflect.construct(target,args.length?args:[frozen]),get:(target,key)=>key==='now'?()=>frozen:Reflect.get(target,key)});
const scenario=new URLSearchParams(location.search).get('state')||'normal';
function Preview(){
 const [data,setData]=useState(()=>healthFixture(scenario)),[mobile,setMobile]=useState(innerWidth<=900),[sync,setSync]=useState('normal');const attempts=useRef(0),initialized=useRef(false),submitted=useRef(false);const readOnly=scenario==='readonly';
 const update=(fn:(d:ClassroomData)=>ClassroomData)=>{if(!readOnly)setData(fn);};
 const save=async()=>{if(readOnly)return false;attempts.current++;setSync('saving');await new Promise(r=>setTimeout(r,scenario==='saving'?60000:400));const fail=scenario==='conflict-409'||attempts.current===1&&['save-failure','save-throw','delete-failure'].includes(scenario);setSync(fail?scenario:'normal');if(fail&&scenario==='save-throw')throw Error('synthetic network interruption');return !fail;};
 const exportDraft=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));a.href=url;a.download='synthetic-health-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const loadLatest=()=>location.assign('health.html?state=normal');
 const c=useHealthDesignController({data,update,save,readOnly,mobile,conflict:sync==='conflict-409',exportDraft,loadLatest});
 useEffect(()=>{const media=matchMedia('(max-width:900px)');const changed=()=>setMobile(media.matches);media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);},[]);
 useEffect(()=>{if(initialized.current)return;initialized.current=true;if(scenario==='search-empty')c.changeFilter('query','不存在');if(['mobile-detail','long-record','readonly','summary-only','contact'].includes(scenario))c.setDetailOpen(true);if(scenario==='filters')c.changeFilter('severity','重要');if(['composer','validation','dirty-close','saving','save-failure','save-throw','conflict-409'].includes(scenario))c.openEditor();if(scenario==='delete-confirm'){c.openEditor(c.profiles[0]);c.setConfirmDelete(true);}},[c]);
 useEffect(()=>{if(submitted.current||!c.draft)return;if(['saving','save-failure','save-throw','conflict-409','dirty-close'].includes(scenario)){if(!c.draft.studentId){c.setDraft({...c.draft,studentId:c.students[0].id,summary:'合成补充照护'});return;}submitted.current=true;if(scenario==='dirty-close')c.requestClose();else void c.persist();}if(scenario==='validation'){submitted.current=true;void c.persist();}},[c]);
 useEffect(()=>{Object.assign(window,{__health:{getData:()=>data,controller:c,getState:()=>({busy:c.busy,dirty:c.dirty,pending:c.pending,sync,composer:!!c.draft,selected:c.selected?.id})}});},[c,data,sync]);
 const navigate=()=>{if(window.dispatchEvent(new Event('classroom:before-navigate',{cancelable:true})))c.setMessage('独立照护设计稿：当前仅含合成数据。');};
 const surface=scenario==='loading'?<p className="design-loading" role="status">正在加载健康与照护…</p>:<HealthDesign controller={c}/>;
 return <><script id="health-design-fixture" type="application/json">{JSON.stringify(healthFixture(scenario))}</script><WorkbenchShell active="health" scene="class" classes={data.rosterClasses!} activeClass={data.rosterClasses![0]} workspaceGrade="三年级" saving={sync==='saving'} dirty={sync!=='normal'} error={sync==='conflict-409'?'版本冲突，草稿已保留。':['save-failure','save-throw','delete-failure'].includes(sync)?'保存失败，草稿已保留。':''} isDemo={false} isReadOnly={readOnly} desktopContent={!mobile?surface:null} mobileContent={mobile?surface:null} onOpen={navigate} onBack={navigate} onSwitchClass={navigate} onScene={navigate} onAccount={navigate} onRetrySave={()=>void c.persist()} onClearError={()=>{}} saveConflict={sync==='conflict-409'} onExportDraft={()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));a.href=url;a.download='synthetic-health-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}} onLoadLatest={()=>location.reload()}/><details className="design-controls"><summary>设计预览 · 合成数据</summary><label>查看状态<select aria-label="预览状态" value={scenario} onChange={e=>location.assign(`health.html?state=${e.target.value}`)}>{healthStates.map(v=><option key={v}>{v}</option>)}</select></label><p>仅内存数据，保存/失败/409为模拟；刷新恢复。</p></details></>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
