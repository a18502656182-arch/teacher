import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {ClassroomData} from '../../lib/classroom';
import {ReflectionDesign} from '../../app/designs/reflection/ReflectionDesign';
import {useReflectionDesignController} from '../../app/designs/reflection/useReflectionDesignController';
import {WorkbenchShell} from '../../app/components/workbench/shell/WorkbenchShell';
import {reflectionFixture,reflectionStates} from './reflection-fixture';
import './students-preview.css';
const scenario=new URLSearchParams(location.search).get('state')||'normal';
function Preview(){
 const [data,setData]=useState(()=>reflectionFixture(scenario)),[mobile,setMobile]=useState(innerWidth<=900),[sync,setSync]=useState('normal');const attempts=useRef(0),initialized=useRef(false),submitted=useRef(false);const readOnly=['readonly','saved-readonly'].includes(scenario);
 const update=(fn:(d:ClassroomData)=>ClassroomData)=>{if(!readOnly)setData(fn);};
 const save=async()=>{attempts.current++;setSync('saving');await new Promise(r=>setTimeout(r,scenario==='saving'?60000:400));const fail=scenario==='conflict-409'||attempts.current===1&&['save-failure','save-throw'].includes(scenario);setSync(fail?scenario:'normal');if(fail&&scenario==='save-throw')throw Error('synthetic network interruption');return !fail;};
 const exportDraft=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));a.href=url;a.download='synthetic-reflection-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const loadLatest=()=>location.assign('reflection.html?state=normal');
 const c=useReflectionDesignController({data,update,save,readOnly,mobile,conflict:sync==='conflict-409',exportDraft,loadLatest});
 useEffect(()=>{const media=matchMedia('(max-width:900px)');const changed=()=>setMobile(media.matches);media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);},[]);
 useEffect(()=>{if(initialized.current)return;initialized.current=true;if(scenario==='search-empty')c.setQuery('不存在');if(scenario.startsWith('saved-')||scenario==='legacy-library')c.switchTab('saved');if(['saved-detail','saved-long-detail','saved-readonly'].includes(scenario))c.viewReflection(c.reflections.find(r=>r.studentId===c.students[3].id)!);if(scenario==='saved-search-empty')c.setQuery('不存在的反思');if(['mobile-editor','readonly','saving','save-failure','save-throw','conflict-409','dirty-close','score-detail'].includes(scenario))c.chooseStudent(c.students[0]?.id);},[c]);
 useEffect(()=>{if(submitted.current)return;if(['saving','save-failure','save-throw','conflict-409','dirty-close'].includes(scenario)){if(!c.dirty){c.setField('problem','这次考试需要再核对审题步骤。');return;}submitted.current=true;if(scenario==='dirty-close')c.chooseStudent(c.students[1].id);else void c.submit('已完成');}},[c]);
 useEffect(()=>{Object.assign(window,{__reflection:{getData:()=>data,controller:c,getState:()=>({busy:c.busy,dirty:c.dirty,pending:c.pending,sync,editor:c.editorOpen,selected:c.studentId})}});},[c,data,sync]);
 const navigate=()=>{if(window.dispatchEvent(new Event('classroom:before-navigate',{cancelable:true})))c.setMessage('当前为考试反思独立设计预览');};
 const surface=scenario==='loading'?<p className="design-loading" role="status">正在加载考试反思…</p>:<ReflectionDesign controller={c}/>;
 return <><script id="reflection-design-fixture" type="application/json">{JSON.stringify(reflectionFixture(scenario))}</script><WorkbenchShell active="reflection" scene="class" classes={data.rosterClasses!} activeClass={data.rosterClasses![0]} workspaceGrade="三年级" saving={sync==='saving'} dirty={c.dirty||c.pending} error={sync==='conflict-409'?'版本冲突，草稿已保留。':['save-failure','save-throw'].includes(sync)?'保存失败，草稿已保留。':''} isDemo={false} isReadOnly={readOnly} desktopContent={!mobile?surface:null} mobileContent={mobile?surface:null} onOpen={navigate} onBack={navigate} onSwitchClass={navigate} onScene={navigate} onAccount={navigate} onRetrySave={()=>void c.sync()} onClearError={()=>{}} saveConflict={sync==='conflict-409'} onExportDraft={exportDraft} onLoadLatest={loadLatest}/><details className="design-controls"><summary>设计预览 · 合成数据</summary><label>查看状态<select aria-label="预览状态" value={scenario} onChange={e=>location.assign(`reflection.html?state=${e.target.value}`)}>{reflectionStates.map(v=><option key={v}>{v}</option>)}</select></label><p>仅内存合成数据；保存与失败为模拟，刷新恢复。</p></details></>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
