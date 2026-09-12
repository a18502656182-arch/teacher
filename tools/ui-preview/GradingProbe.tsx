import { useState } from 'react';
import { GradingView } from '../../app/w/[token]/features/dictation/GradingView';
import { ThemeBoundary } from '../../app/components/workbench/theme/ThemeBoundary';
import { Button } from '../../app/components/workbench/ui/Button';
import type { DictationTask } from '../../lib/dictation';

const material = [['system','系统'],['balance','平衡'],['expression','表达'],['meeting','会议'],['period','时期'],['field','领域'],['advice','建议'],['environment','环境']];
function fixture(count=105,wordCount=8): DictationTask {
 return { id:`ui-rebuild-probe-${count}-${wordCount}`, title:'英语 Unit 2', subject:'英语', date:'2026-09-12', context:{kind:'class',classId:'synthetic-only'}, createdAt:'2026-09-12T00:00:00Z',
 participants:Array.from({length:count},(_,i)=>({id:`synthetic-${i+1}`,name:`合成学生${String(i+1).padStart(2,'0')}`,number:String(i+1).padStart(3,'0')})),
 words:Array.from({length:wordCount},(_,i)=>({id:`word-${i}`,text:material[i%8][0]+(i>=8?` ${i+1}`:''),meaning:material[i%8][1],lesson:'Unit 2'})),results:{} };
}
export function GradingProbe() {
 const [task,setTask]=useState(()=>fixture()),[readOnly,setReadOnly]=useState(false),[failure,setFailure]=useState(false),[note,setNote]=useState(''),[version,setVersion]=useState(0);
 return <ThemeBoundary><div style={{padding:'12px 24px',borderBottom:'1px solid #cbdce6'}}><strong>本地合成数据验证，不连接服务器</strong><p>批改使用实际共享控制器；此处“服务器确认”由模拟响应提供，仅用于验证状态，不是真实保存。</p><div style={{display:'flex',gap:12,flexWrap:'wrap'}}><label><input type="checkbox" checked={failure} onChange={e=>setFailure(e.target.checked)}/>模拟保存失败</label><label><input type="checkbox" checked={readOnly} onChange={e=>setReadOnly(e.target.checked)}/>只读</label><Button onClick={()=>{setTask(fixture());setVersion(v=>v+1);}}>重置105人/8词夹具</Button><Button onClick={()=>{setTask(fixture(105,200));setVersion(v=>v+1);}}>200词夹具</Button><Button onClick={()=>{const next=fixture(1);next.id="ui-rebuild-family";next.context={kind:"family",childId:"synthetic-1"};setTask(next);setVersion(v=>v+1);}}>家庭批改夹具</Button></div><p role="status">{note}</p></div>
 <GradingView key={version} task={task} token="ui-rebuild-synthetic" readOnly={readOnly} onBack={()=>setNote('已触发返回任务')} onReview={async p=>setNote(`已调用为${p.name}安排复习；本探针不创建正式任务`)} onSave={async(id,result)=>{await new Promise(resolve=>setTimeout(resolve,400));if(failure)return false;setTask(t=>({...t,results:{...t.results,[id]:result}}));return true;}}/>
 </ThemeBoundary>;
}
