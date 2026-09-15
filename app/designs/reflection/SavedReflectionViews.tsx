import type {ExamReflection} from '@/lib/classroom';
import type {useReflectionDesignController} from './useReflectionDesignController';
import s from './ReflectionDesign.module.css';
type Controller=ReturnType<typeof useReflectionDesignController>;
export function ReflectionTabs({c}:{c:Controller}){return <nav className={s.tabs} aria-label="反思视图"><button aria-pressed={c.tab==='students'} onClick={()=>c.switchTab('students')}>学生状态</button><button aria-pressed={c.tab==='saved'} onClick={()=>c.switchTab('saved')}>已保存反思</button></nav>;}
export function SavedReflectionLibrary({c,onEdit}:{c:Controller;onEdit:(r:ExamReflection)=>void}){
 const reset=()=>{c.setQuery('');c.setStatus('全部状态');c.setLibraryExam('all');c.setFocusOnly(false);};
 return <section className={s.savedLibrary} aria-label="已保存反思记录库">
  <ReflectionTabs c={c}/>
  <header className={s.libraryHeading}><h2>已保存反思</h2><p>本班全部考试 · {c.reflections.length}条记录</p><div className={s.recordCounts}><span>草稿 {c.reflections.filter(r=>r.status==='草稿').length}</span><span>已完成 {c.reflections.filter(r=>r.status==='已完成').length}</span></div></header>
  <div className={s.libraryToolbar}><label className={s.search}><span className={s.searchIcon} aria-hidden="true"/><input aria-label="搜索学生或反思" placeholder="搜索学生、考试或反思内容" value={c.query} onChange={e=>c.setQuery(e.target.value)}/></label><label className={s.examFilter}><span className={s.srOnly}>筛选已保存考试</span><select aria-label="筛选已保存考试" value={c.libraryExam} onChange={e=>c.setLibraryExam(e.target.value)}><option value="all">全部考试</option><option value="unlinked">未关联考试</option>{c.exams.map(e=><option key={e.id} value={e.id}>{e.title} · {e.date}</option>)}</select></label><label><span className={s.srOnly}>反思状态</span><select aria-label="反思状态" value={c.status} onChange={e=>c.setStatus(e.target.value)}>{['全部状态','草稿','已完成'].map(v=><option key={v}>{v}</option>)}</select></label><button className={s.textButton} onClick={reset}>重置筛选</button></div>
  {c.error&&<p role="alert" className={s.error}>{c.error}</p>}
  <div className={s.recordTable} role="table" aria-label="已保存反思"><div className={s.recordTableHead} role="row"><span role="columnheader">记录日期</span><span role="columnheader">学生与考试</span><span role="columnheader">复盘内容</span><span role="columnheader">状态</span><span role="columnheader">操作</span></div><div role="rowgroup">{c.visible.map(({student,reflection:r})=>r&&<div className={s.recordRow} role="row" key={r.id}>
   <div role="cell" className={s.recordDate}>{r.date}</div><div role="cell" className={s.recordIdentity}><strong>{student.name}</strong><p>{!c.mobile&&<>学号{student.studentNo} · </>}{c.exams.find(e=>e.id===r.examId)?.title??'未关联考试'}{c.mobile&&<> · {r.date}</>}</p></div><div role="cell" className={s.recordSummary}><p>问题：{r.problem||'未填写'}</p><p>行动：{r.action||'待补充下一步行动'}</p></div><div role="cell" className={s.recordStatus}><span className={s.badge} data-status={r.status}>{r.status}</span></div><div role="cell" className={s.recordActions}><button className={s.textButton} aria-label={`查看${student.name}的反思`} onClick={()=>c.viewReflection(r)}>查看反思</button>{r.status==='草稿'&&r.examId&&!c.readOnly&&<button className={s.textButton} aria-label={`继续编辑${student.name}的反思`} disabled={c.locked} onClick={()=>onEdit(r)}>继续编辑</button>}</div>
  </div>)}</div></div>
  {!c.rows.length&&<div className={s.empty}><h3>{c.reflections.length?'没有符合条件的反思':'还没有保存的反思'}</h3><p>{c.reflections.length?'试试其它考试、状态或关键词。':'从学生状态选择一名学生，写下这次考试的问题和行动。'}</p><button onClick={c.reflections.length?reset:()=>c.switchTab('students')}>{c.reflections.length?'重置筛选':'前往学生状态'}</button></div>}
  <nav className={s.libraryPagination} aria-label="已保存反思分页"><span>共{c.rows.length}条 · 第{c.safePage}/{c.pages}页</span><div><button disabled={c.safePage===1} onClick={()=>c.setPage(c.safePage-1)}>上一页</button><button disabled={c.safePage===c.pages} onClick={()=>c.setPage(c.safePage+1)}>下一页</button></div></nav>
 </section>;
}
export function SavedReflectionDetail({c,onEdit}:{c:Controller;onEdit:(r:ExamReflection)=>void}){
 const r=c.savedReflection,student=c.students.find(st=>st.id===r?.studentId),exam=c.exams.find(e=>e.id===r?.examId);
 if(!r)return <section className={s.empty}><h2>这条反思已不可用</h2><button onClick={c.backToLibrary}>返回已保存反思</button></section>;
 const section=(title:string,value:string|undefined,action=false)=><section className={action?s.readAction:s.readSection}><h2>{title}</h2><p>{value||'未填写'}</p></section>;
 return <article className={s.savedDetail} aria-label="已保存反思详情"><button className={s.textButton} onClick={c.backToLibrary}>返回已保存反思</button><header className={s.detailHeading}><div><div className={s.detailTitle}><h1>{student?.name??'学生'} · 考试反思</h1><span className={s.badge} data-status={r.status}>{r.status}</span></div><p>学号{student?.studentNo??'—'} · 记录日期 {r.date}</p></div><div className={s.detailActions}><button onClick={()=>void c.copy(r)}>复制反思</button><button className={s.primary} disabled={c.locked} onClick={()=>onEdit(r)}>{exam?'编辑反思':'关联考试并编辑'}</button></div></header>
  <section className={s.detailExam}><strong>关联考试：{exam?.title??'未关联考试'}</strong>{exam&&<span>{exam.date} · {exam.subjects.join(' / ')}</span>}{!exam&&<span>保留历史内容，编辑前选择对应考试。</span>}</section>
  {c.error&&<p role="alert" className={s.error}>{c.error}</p>}{c.saved&&<p className={s.savedInline} role="status">已保存</p>}
  {section('主要问题',r.problem)}{section('原因分析',r.reason)}{section('下一步行动',r.action,true)}<div className={s.readNotes}>{section('写给家长的话',r.familyMessage)}{section('班主任跟进',r.teacherNote)}</div><footer className={s.readFooter}>归档到校内沟通记录，不自动发送给家长。{c.readOnly&&<p>只读模式，可查看和复制内容。</p>}</footer>
 </article>;
}
