import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ClassroomData } from '../../lib/classroom';
import { StudentsDesign } from '../../app/designs/students/StudentsDesign';
import { useStudentsController } from '../../app/w/[token]/features/students/useStudentsController';
import { WorkbenchShell } from '../../app/components/workbench/shell/WorkbenchShell';
import { ThemeBoundary } from '../../app/components/workbench/theme/ThemeBoundary';
import { Dialog } from '../../app/components/workbench/ui/Dialog';
import { Button } from '../../app/components/workbench/ui/Button';
import { studentsFixture } from './students-fixture';
import './students-preview.css';

// Frozen in this standalone page only; never imported by the product entry.
const RealDate = Date;
const frozenTime = Date.parse('2026-09-14T09:00:00+08:00');
class FixtureDate extends RealDate {
  constructor(value: string | number = frozenTime) { super(value); }
  static now() { return frozenTime; }
}
globalThis.Date = FixtureDate as DateConstructor;
const params = new URLSearchParams(location.search);
const scenario = params.get('state') || 'normal';
const states = ['normal','empty','large-105','long-name','search-empty','loading','readonly','saving','save-failure','conflict-409','detail-drawer','profile','editor','validation','import','import-error','batch','danger-confirm','dirty-close'];

function Preview() {
  const [data,setData] = useState(() => studentsFixture(scenario));
  const [mobile,setMobile] = useState(innerWidth <= 900);
  const [notice,setNotice] = useState('');
  const [save,setSave] = useState(scenario);
  const [confirm,setConfirm] = useState<{message:string;title:string;label:string;resolve:(value:boolean)=>void}|null>(null);
  const readOnly = scenario === 'readonly';
  const update = (fn:(data:ClassroomData)=>ClassroomData) => { if (!readOnly) { setData(fn); setSave('saving'); window.setTimeout(() => setSave(scenario === 'save-failure' ? 'save-failure' : 'normal'),600); } };
  const c = useStudentsController({data,update,confirmAction:(message,title='删除学生及关联记录',label='确认删除') => new Promise(resolve => setConfirm({message,title,label,resolve}))});
  const initialized = useRef(false);
  useEffect(() => {
    const media = matchMedia('(max-width:900px)'); const changed = () => setMobile(media.matches);
    media.addEventListener('change',changed); return () => media.removeEventListener('change',changed);
  },[]);
  useEffect(() => {
    if (initialized.current) return; initialized.current = true;
    if (scenario === 'search-empty') c.setQuery('无匹配合成学生');
    if (scenario === 'detail-drawer') c.setFocusedId('design-student-2');
    if (scenario === 'profile') c.setProfileId('design-student-2');
    if (['editor','validation','dirty-close'].includes(scenario)) { c.openNewStudent(); if (scenario === 'validation') c.setMessage('请填写学生姓名。'); }
    if (['import','import-error'].includes(scenario)) { c.setImportOpen(true); if(scenario === 'import') c.setImportText('合成新生甲\n合成新生乙'); else c.setMessage('请先粘贴学生名单。'); }
    if (scenario === 'batch') { c.toggleSelect('design-student-1'); c.toggleSelect('design-student-2'); c.setBatchOpen(true); }
    if (scenario === 'danger-confirm') { c.setEditMode(true); void c.removeStudent('design-student-1'); }
  },[c]);
  const surface = scenario === 'loading' ? <div className="design-loading" role="status">正在加载学生名单…</div> : <StudentsDesign data={data} update={update} controller={c} mobile={mobile} readOnly={readOnly}/>;
  const activeClass = data.rosterClasses![0];
  return <>
    <script type="application/json" id="students-design-fixture">{JSON.stringify(studentsFixture(scenario))}</script>
    <WorkbenchShell active="students" scene="class" classes={data.rosterClasses!} activeClass={activeClass} workspaceGrade="三年级"
      saving={save==='saving'} dirty={save==='saving'} error={save==='save-failure'?'保存失败，输入已保留。':save==='conflict-409'?'版本冲突：有较新的工作区版本。':''} isDemo={false} isReadOnly={readOnly}
      desktopContent={!mobile ? surface : null} mobileContent={mobile ? surface : null}
      onOpen={() => setNotice('当前为学生独立设计稿，其他模块尚未接入。')} onBack={() => setNotice('已在学生设计稿入口。')} onSwitchClass={() => setNotice('此设计稿只包含一个合成班级。')} onScene={() => setNotice('家庭教育不在本批设计范围内。')} onAccount={() => setNotice('隔离设计稿：只使用合成数据，刷新恢复初始状态。')}
      onRetrySave={() => { setSave('saving'); window.setTimeout(()=>setSave('normal'),600); }} onClearError={()=>setSave('normal')} saveConflict={save==='conflict-409'}
      onExportDraft={() => { const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));a.download='synthetic-design-draft.json';a.click();URL.revokeObjectURL(a.href); }}
      onLoadLatest={()=>{setData(studentsFixture(scenario));setSave('normal');}}/>
    <ThemeBoundary><Dialog open={Boolean(confirm)} title={confirm?.title||'确认'} onRequestClose={()=>{confirm?.resolve(false);setConfirm(null);}} footer={<><Button onClick={()=>{confirm?.resolve(false);setConfirm(null);}}>取消</Button><Button intent="danger" onClick={()=>{confirm?.resolve(true);setConfirm(null);}}>{confirm?.label}</Button></>}><p>{confirm?.message}</p></Dialog>
      <Dialog open={Boolean(notice)} title="隔离设计预览" onRequestClose={()=>setNotice('')} footer={<Button onClick={()=>setNotice('')}>返回设计稿</Button>}><p>{notice}</p></Dialog>
    </ThemeBoundary>
    <details className="design-controls"><summary>设计预览 · 合成数据</summary><label>查看状态<select value={scenario} onChange={e=>location.assign(`students.html?state=${e.target.value}`)}>{states.map(s=><option key={s}>{s}</option>)}</select></label><p>仅内存交互；保存与冲突为模拟。刷新后恢复，未接入正式业务。</p></details>
  </>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
