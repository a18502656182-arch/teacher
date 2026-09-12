import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeBoundary } from '../../app/components/workbench/theme/ThemeBoundary';
import { campusTheme, glassTheme } from '../../app/components/workbench/theme/definitions';
import { Button } from '../../app/components/workbench/ui/Button';
import { Field, Input, Textarea } from '../../app/components/workbench/ui/Field';
import { StatusSegment } from '../../app/components/workbench/ui/StatusSegment';
import { SelectionBar } from '../../app/components/workbench/ui/SelectionBar';
import { Dialog } from '../../app/components/workbench/ui/Dialog';
import './preview.css';

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
  const [nested, setNested] = useState(false);
  const [note, setNote] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState(true);
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
    </div><div className="preview-row"><Button intent="primary" onClick={() => setOpen(true)}>打开编辑器</Button><Button disabled>只读操作</Button><Button busy>处理中</Button><Button intent="danger" onClick={() => setMessage('仅展示危险动作样式，没有删除数据')}>删除样例</Button></div></section>
    <section><h2>状态与批量选择</h2><StatusSegment label="作业状态" options={['未交','已交','待订正','已复查'].map(value => ({ value, label: value }))} value={status} onChange={setStatus}/>
      <p><label><input type="checkbox" checked={selected} onChange={e => setSelected(e.target.checked)}/> 选择合成学生 01</label></p>
      <SelectionBar count={selected ? 1 : 0} scopeLabel="仅当前显示范围" onClear={() => setSelected(false)} actions={<Button intent="primary" onClick={() => setOpen(true)}>批量处理</Button>}/>
    </section>
    <p role="status" aria-live="polite">{message}</p>
    <Dialog open={open} title="编辑任务（本地验证）" dirty={Boolean(note)} busy={busy} onRequestClose={() => note ? setConfirmClose(true) : setOpen(false)} footer={<><Button onClick={() => setNested(true)} disabled={busy}>选择学生</Button><Button intent="primary" busy={busy} onClick={simulate}>{busy ? '模拟处理中' : '模拟保存'}</Button></>}>
      <Field id="probe-note" label="备注"><Textarea id="probe-note" value={note} onChange={e => setNote(e.target.value)} disabled={busy}/></Field>
      <p><label><input type="checkbox" checked={fail} onChange={e => setFail(e.target.checked)}/> 模拟保存失败</label></p>
      <p role="status">{message}</p>
      <p>这里用于检查手机短屏中的滚动、底部按钮、嵌套浮层与焦点恢复。</p>
    </Dialog>
    <Dialog open={nested} title="选人子层（合成数据）" onRequestClose={() => setNested(false)} footer={<Button intent="primary" onClick={() => setNested(false)}>返回编辑器</Button>}><p>子层关闭后，父表单的备注应保留。</p></Dialog>
    <Dialog open={confirmClose} title="备注尚未完成" onRequestClose={() => setConfirmClose(false)} footer={<><Button onClick={() => setConfirmClose(false)}>继续编辑</Button><Button intent="danger" onClick={() => {setNote('');setConfirmClose(false);setOpen(false);}}>放弃样例草稿</Button></>}><p>关闭、Esc 与遮罩进入同一个离开检查。</p></Dialog>
  </>;
}

createRoot(document.getElementById('root')!).render(<Preview/>);
