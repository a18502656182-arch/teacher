import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ClassroomData } from '../../lib/classroom';
import { HomeworkDesign } from '../../app/designs/homework/HomeworkDesign';
import { useHomeworkController } from '../../app/w/[token]/features/homework/useHomeworkController';
import { WorkbenchShell } from '../../app/components/workbench/shell/WorkbenchShell';
import { ThemeBoundary } from '../../app/components/workbench/theme/ThemeBoundary';
import { Dialog } from '../../app/components/workbench/ui/Dialog';
import { Button } from '../../app/components/workbench/ui/Button';
import { homeworkFixture, homeworkStates } from './homework-fixture';
import './students-preview.css';

// Frozen in this standalone page only; never imported by the product entry.
const RealDate = Date;
const frozenTime = Date.parse('2026-09-15T09:00:00+08:00');
class FixtureDate extends RealDate {
  constructor(value: string | number = frozenTime) { super(value); }
  static now() { return frozenTime; }
}
globalThis.Date = FixtureDate as DateConstructor;
const params = new URLSearchParams(location.search);
const scenario = params.get('state') || 'normal';
const states = homeworkStates;

function Preview() {
  const [data,setData] = useState(() => homeworkFixture(scenario));
  const [mobile,setMobile] = useState(innerWidth <= 900);
  const [notice,setNotice] = useState('');
  const [save,setSave] = useState(scenario);
  const [confirm,setConfirm] = useState<{message:string;title:string;label:string;resolve:(value:boolean)=>void}|null>(null);
  const readOnly = scenario === 'readonly';
  const update = (fn:(data:ClassroomData)=>ClassroomData) => { if (!readOnly) { setData(fn); setSave('saving'); window.setTimeout(() => setSave(scenario === 'save-failure' ? 'save-failure' : scenario === 'conflict-409' ? 'conflict-409' : 'normal'),600); } };
  const c = useHomeworkController({data,update,readOnly,confirmAction:(message,title='删除作业',label='确认删除') => new Promise(resolve => setConfirm({message,title,label,resolve}))});
  const initialized = useRef(false);
  useEffect(() => {
    const media = matchMedia('(max-width:900px)'); const changed = () => setMobile(media.matches);
    media.addEventListener('change',changed); return () => media.removeEventListener('change',changed);
  },[]);
  useEffect(() => {
    if (initialized.current) return; initialized.current = true;
    if (scenario === 'search-empty') c.patchTaskFilters({query:'无匹配合成作业'});
    if (scenario === 'filters') c.setAdvancedOpen(true);
    if (['task-editor','validation','dirty-close'].includes(scenario)) { c.openNewTask(); }
    if (['mobile-detail','selected','students-105','long-title-note'].includes(scenario) || scenario.startsWith('follow-')) c.setMobileDetailOpen(mobile);
    if (scenario === 'selected') { c.toggleStudent('hw-student-1'); c.toggleStudent('hw-student-3'); }
    if (scenario.startsWith('follow-')) c.setFollowOpen(true);
    if (scenario === 'delete-confirm') void c.deleteTask();
  },[c,mobile]);
  const surface = scenario === 'loading' ? <div className="design-loading" role="status">正在加载作业任务…</div> : <HomeworkDesign controller={c} mobile={mobile}/>;
  const activeClass = data.rosterClasses![0];
  return <>
    <script type="application/json" id="homework-design-fixture">{JSON.stringify(homeworkFixture(scenario))}</script>
    <WorkbenchShell active="homework" scene="class" classes={data.rosterClasses!} activeClass={activeClass} workspaceGrade="三年级"
      saving={save==='saving'} dirty={save==='saving'} error={save==='save-failure'?'保存失败，输入已保留。':save==='conflict-409'?'版本冲突：有较新的工作区版本。':''} isDemo={false} isReadOnly={readOnly}
      desktopContent={!mobile ? surface : null} mobileContent={mobile ? surface : null}
      onOpen={() => setNotice('当前为作业独立设计稿，其他模块尚未接入。')} onBack={() => setNotice('已在作业设计稿入口。')} onSwitchClass={() => setNotice('此设计稿只包含一个合成班级。')} onScene={() => setNotice('家庭教育不在本批设计范围内。')} onAccount={() => setNotice('隔离设计稿：只使用合成数据，刷新恢复初始状态。')}
      onRetrySave={() => { setSave('saving'); window.setTimeout(()=>setSave('normal'),600); }} onClearError={()=>setSave('normal')} saveConflict={save==='conflict-409'}
      onExportDraft={() => { const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));a.download='synthetic-design-draft.json';a.click();URL.revokeObjectURL(a.href); }}
      onLoadLatest={()=>{setData(homeworkFixture(scenario));setSave('normal');}}/>
    <ThemeBoundary><Dialog open={Boolean(confirm)} title={confirm?.title||'确认'} onRequestClose={()=>{confirm?.resolve(false);setConfirm(null);}} footer={<><Button onClick={()=>{confirm?.resolve(false);setConfirm(null);}}>取消</Button><Button intent="danger" onClick={()=>{confirm?.resolve(true);setConfirm(null);}}>{confirm?.label}</Button></>}><p>{confirm?.message}</p></Dialog>
      <Dialog open={Boolean(notice)} title="隔离设计预览" onRequestClose={()=>setNotice('')} footer={<Button onClick={()=>setNotice('')}>返回设计稿</Button>}><p>{notice}</p></Dialog>
    </ThemeBoundary>
    <details className="design-controls"><summary>设计预览 · 合成数据</summary><label>查看状态<select value={scenario} onChange={e=>location.assign(`homework.html?state=${e.target.value}`)}>{states.map(s=><option key={s}>{s}</option>)}</select></label><p>仅内存交互；保存与冲突为模拟。刷新后恢复，未接入正式业务。</p></details>
  </>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
