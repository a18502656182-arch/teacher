import { LegacyScopeProbe } from './LegacyScopeProbe';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeBoundary } from '../../app/components/workbench/theme/ThemeBoundary';
import { campusTheme, glassTheme } from '../../app/components/workbench/theme/definitions';
import { Button } from '../../app/components/workbench/ui/Button';
import { Field, Input, Textarea } from '../../app/components/workbench/ui/Field';
import { StatusSegment } from '../../app/components/workbench/ui/StatusSegment';
import { SelectionBar } from '../../app/components/workbench/ui/SelectionBar';
import { Dialog } from '../../app/components/workbench/ui/Dialog';
import { Menu, MenuItem } from '../../app/components/workbench/ui/Menu';
import { EmptyState, LoadingState } from '../../app/components/workbench/ui/FeedbackState';
import { StudentPicker } from '../../app/components/workbench/ui/StudentPicker';
import './preview.css';
import { GradingProbe } from './GradingProbe';

const SYNTHETIC_STUDENTS = Array.from({ length: 105 }, (_, index) => ({
  id: `synthetic-student-${index + 1}`,
  name: `合成学生${String(index + 1).padStart(3, '0')}`,
  studentNo: String(index + 1).padStart(3, '0'),
  group: Math.ceil((index + 1) / 5),
  seat: index + 1,
}));

function Preview() {
  const [glass, setGlass] = useState(false);
  return <ThemeBoundary definition={glass ? glassTheme : campusTheme}>
    <main className="preview">
      <header><h1>校园重构 · 组件验证</h1><p>仅本地开发使用。这里不访问数据库，不提交任何工作区数据；此页不代表全站已完成。</p>
        <Button onClick={() => setGlass(value => !value)}>内部材质探针：{glass ? '玻璃预留' : '校园'}</Button>
      </header>
      <ControlProbe/>
    </main>
  </ThemeBoundary>;
}

function ControlProbe() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('未交');
  const [selected, setSelected] = useState(false);
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSelection, setPickerSelection] = useState<string[]>(['synthetic-student-2']);
  const [note, setNote] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState(true);
  const [showLoading, setShowLoading] = useState(true);
  async function simulate() {
    setBusy(true); setMessage('正在模拟响应，此操作不会联网');
    await new Promise(resolve => setTimeout(resolve, 500));
    setBusy(false);
    setMessage(fail ? '模拟保存失败，输入仍保留，可以重试' : '模拟响应成功，没有向服务器保存');
    if (!fail) { setNote(''); setOpen(false); setSelected(false); }
  }
  return <>
    <section><h2>输入与操作</h2><div className="preview-fields">
      <Field id="probe-name" label="任务名称" hint="输入后切换内部材质，内容应保持。"><Input id="probe-name" hint="输入后切换内部材质，内容应保持。" value={text} onChange={e => setText(e.target.value)} placeholder="例如：英语 Unit 2"/></Field>
      <Field id="probe-error" label="必填字段" error="请输入任务名称"><Input id="probe-error" error="请输入任务名称" required/></Field>
      <Field id="probe-disabled" label="只读状态"><Input id="probe-disabled" disabled value="只能查看"/></Field>
    </div><div className="preview-row"><Button intent="primary" onClick={() => setOpen(true)}>打开编辑器</Button><Button disabled>只读操作</Button><Button busy>处理中</Button><Button intent="danger" onClick={() => setMessage('仅展示危险动作样式，没有删除数据')}>删除样例</Button><Button>这是一段需要在窄屏完整换行显示的较长按钮文字</Button></div></section>
    <section><h2>状态与批量选择</h2><StatusSegment label="作业状态" options={['未交','已交','待订正','已复查'].map(value => ({ value, label: value }))} value={status} onChange={setStatus}/>
      <p><label><input type="checkbox" checked={selected} onChange={e => setSelected(e.target.checked)}/> 选择合成学生 01</label></p>
      <SelectionBar count={selected ? 1 : 0} scopeLabel="仅当前显示范围" onClear={() => setSelected(false)} actions={<Button intent="primary" onClick={() => setOpen(true)}>批量处理</Button>}/>
    </section>
    <section><h2>菜单、加载与空态</h2><div className="preview-row">
      <Menu label="打开操作菜单"><MenuItem onSelect={() => setMessage('已选择查看详情')}>查看详情</MenuItem><MenuItem onSelect={() => setMessage('已选择导出当前筛选')}>导出当前筛选中的全部记录</MenuItem><MenuItem disabled onSelect={() => undefined}>只读时不可用</MenuItem></Menu>
      <Button onClick={() => setShowLoading(value => !value)}>{showLoading ? '显示空态' : '显示加载'}</Button>
    </div>{showLoading ? <LoadingState title="正在读取合成数据" detail="加载状态不伪造业务结果。"/> : <EmptyState title="当前筛选没有结果" description="调整筛选条件，或清空搜索后重新查看。" artworkRole="empty.no-results" action={<Button onClick={() => setMessage('已清空合成筛选')}>清空筛选</Button>}/>}</section>
    <p role="status" aria-live="polite">{message}</p>
    <Dialog open={open} title="编辑任务（本地验证）" dirty={Boolean(note)} busy={busy} onRequestClose={() => note ? setConfirmClose(true) : setOpen(false)} footer={<><Button onClick={() => setPickerOpen(true)} disabled={busy}>选择学生</Button><Button intent="primary" busy={busy} onClick={simulate}>{busy ? '模拟处理中' : '模拟保存'}</Button></>}>
      <Field id="probe-note" label="备注"><Textarea id="probe-note" value={note} onChange={e => setNote(e.target.value)} disabled={busy}/></Field>
      <p><label><input type="checkbox" checked={fail} onChange={e => setFail(e.target.checked)}/> 模拟保存失败</label></p>
      <p role="status">{message}</p>
      <p>这里用于检查手机短屏中的滚动、底部按钮、嵌套浮层与焦点恢复。</p>
    </Dialog>
    <StudentPicker
      open={pickerOpen}
      title="选择参与学生（105人合成名单）"
      items={SYNTHETIC_STUDENTS}
      selectedIds={pickerSelection}
      selectionMode="multiple"
      onConfirm={async ids => {
        await new Promise(resolve => setTimeout(resolve, 300));
        if (fail) throw new Error('模拟保存失败，跨页选择和当前搜索仍保留。');
        setPickerSelection(ids);
        setPickerOpen(false);
        setMessage(`已确认 ${ids.length} 名合成学生；没有连接服务器`);
      }}
      onRequestClose={() => setPickerOpen(false)}
    />
    <Dialog open={confirmClose} title="备注尚未完成" onRequestClose={() => setConfirmClose(false)} footer={<><Button onClick={() => setConfirmClose(false)}>继续编辑</Button><Button intent="danger" onClick={() => {setNote('');setConfirmClose(false);setOpen(false);}}>放弃样例草稿</Button></>}><p>关闭、Esc 与遮罩进入同一个离开检查。</p></Dialog>
  </>;
}

createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('isolation') ? <LegacyScopeProbe/> : new URLSearchParams(location.search).has('grading') ? <GradingProbe/> : <Preview/>);
