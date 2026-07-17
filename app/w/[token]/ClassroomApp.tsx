"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClassroomData, Student } from "@/lib/classroom";

type Workspace = { className: string; grade: string; term: string; expiresAt: string; data: ClassroomData };
type ModuleId = "dashboard" | "schedule" | "seating" | "duty" | "homework" | "points" | "scores" | "records" | "comments" | "certificates" | "resources";

const nav: { id: ModuleId; icon: string; label: string }[] = [
  { id: "dashboard", icon: "⌂", label: "今日工作台" },
  { id: "schedule", icon: "日", label: "课程与日程" },
  { id: "seating", icon: "座", label: "座位与分组" },
  { id: "duty", icon: "值", label: "值日与岗位" },
  { id: "homework", icon: "作", label: "作业追踪" },
  { id: "points", icon: "分", label: "积分评价" },
  { id: "scores", icon: "绩", label: "成绩分析" },
  { id: "records", icon: "记", label: "成长与沟通" },
  { id: "comments", icon: "评", label: "期末评语" },
  { id: "certificates", icon: "奖", label: "奖状生成" },
  { id: "resources", icon: "库", label: "资料知识库" },
];

const moduleCards: { id: ModuleId; eyebrow: string; title: string; desc: string; tone: string }[] = [
  { id: "seating", eyebrow: "今天可用", title: "座位与分组", desc: "自动排座、分组与轮换记录", tone: "mint" },
  { id: "duty", eyebrow: "本周安排", title: "值日与岗位", desc: "按组公平轮换，一键打印", tone: "blue" },
  { id: "homework", eyebrow: "2项待办", title: "作业追踪", desc: "提交、订正、复查形成闭环", tone: "orange" },
  { id: "points", eyebrow: "随手记录", title: "积分评价", desc: "课堂表现与班级荣誉联动", tone: "purple" },
  { id: "scores", eyebrow: "考试分析", title: "成绩与帮扶", desc: "发现波动、偏科和临界生", tone: "rose" },
  { id: "records", eyebrow: "成长档案", title: "沟通与记录", desc: "谈话、家访、亮点自动归档", tone: "yellow" },
  { id: "comments", eyebrow: "期末省时", title: "评语生成", desc: "用日常证据写出个性化评语", tone: "teal" },
  { id: "certificates", eyebrow: "批量输出", title: "奖状生成", desc: "几十种样式自动填充姓名", tone: "red" },
];

export default function ClassroomApp({ token }: { token: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [active, setActive] = useState<ModuleId>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/workspace/${token}`).then(async (res) => {
      const body = await res.json() as { workspace?: Workspace; error?: string };
      if (!res.ok || !body.workspace) throw new Error(body.error || "链接读取失败");
      setWorkspace(body.workspace);
    }).catch((err) => setError(err instanceof Error ? err.message : "链接读取失败")).finally(() => setLoading(false));
  }, [token]);

  function updateData(updater: (current: ClassroomData) => ClassroomData) {
    setWorkspace((current) => current ? { ...current, data: updater(current.data) } : current);
    setDirty(true);
  }

  async function save() {
    if (!workspace || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workspace/${token}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: workspace.data }) });
      if (!res.ok) throw new Error("保存失败");
      setDirty(false);
    } catch { setError("暂时无法保存，请稍后重试"); } finally { setSaving(false); }
  }

  if (loading) return <div className="app-state"><div className="loader"></div><h2>正在打开你的班级工作台</h2><p>课程、座位、值日和学生档案正在准备中…</p></div>;
  if (error && !workspace) return <div className="app-state error-state"><span>!</span><h2>暂时不能打开这个班级</h2><p>{error}</p><a href="/">返回首页</a></div>;
  if (!workspace) return null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand sidebar-brand" href="/"><span className="brand-mark">班</span><span>云工具箱</span></a>
        <div className="class-switch"><small>当前班级</small><b>{workspace.className}</b><span>{workspace.term}</span></div>
        <nav className="side-nav" aria-label="班级工具">{nav.map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setActive(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
        <div className="license-card"><span className="live-dot"></span><div><b>授权使用中</b><small>有效期至 {workspace.expiresAt}</small></div></div>
      </aside>
      <main className="app-main">
        <header className="topbar"><div><p>{workspace.grade} · {workspace.term}</p><h1>{nav.find((item) => item.id === active)?.label}</h1></div><div className="top-actions"><button className="ghost-btn">打印 / 导出</button><button className="save-btn" disabled={!dirty || saving} onClick={save}>{saving ? "正在保存…" : dirty ? "保存更改" : "已保存"}</button><span className="avatar">林</span></div></header>
        {error && workspace && <div className="inline-alert" onClick={() => setError("")}>{error}<span>×</span></div>}
        {(["schedule", "seating", "duty", "homework", "points", "records", "comments", "certificates"] as ModuleId[]).includes(active) && <div className="edit-mode-banner"><b>✎ 当前页面可以编辑</b><span>带浅绿色边框、输入框或操作按钮的内容都能修改；完成后点击右上角“保存更改”。</span></div>}
        <div className="page-content">
          {active === "dashboard" && <Dashboard data={workspace.data} open={setActive} />}
          {active === "schedule" && <Schedule data={workspace.data} update={updateData} />}
          {active === "seating" && <Seating data={workspace.data} update={updateData} />}
          {active === "duty" && <Duty data={workspace.data} update={updateData} />}
          {active === "homework" && <Homework data={workspace.data} update={updateData} />}
          {active === "points" && <Points data={workspace.data} update={updateData} />}
          {active === "scores" && <Scores data={workspace.data} />}
          {active === "records" && <Records data={workspace.data} update={updateData} />}
          {active === "comments" && <Comments data={workspace.data} />}
          {active === "certificates" && <Certificates data={workspace.data} />}
          {active === "resources" && <Resources token={token} />}
        </div>
      </main>
    </div>
  );
}

function Dashboard({ data, open }: { data: ClassroomData; open: (id: ModuleId) => void }) {
  const missing = data.students.filter((s) => s.homework !== "已交").length;
  const attention = data.students.filter((s) => s.score < 80 || s.attendance !== "正常").length;
  return <>
    <section className="welcome"><div><span className="eyebrow">下午好，林老师</span><h2>今天的班级情况，一眼看清。</h2><p>系统已从作业、考勤、成绩和成长记录中整理出需要优先处理的事项。</p></div><div className="date-badge"><b>17</b><span>七月 · 星期五</span></div></section>
    <section className="stat-row"><div><span>班级学生</span><b>{data.students.length}</b><small>6个学习小组</small></div><div><span>作业待跟进</span><b>{missing}</b><small className="warn">建议今天完成</small></div><div><span>需要关注</span><b>{attention}</b><small>综合作业、考勤与成绩</small></div><div><span>本周成长记录</span><b>{data.records.length}</b><small className="good">已自动归档</small></div></section>
    <div className="section-title"><div><span>常用工具</span><h2>需要做什么，直接点开</h2></div><button onClick={() => open("resources")}>查看全部资料 →</button></div>
    <section className="module-grid">{moduleCards.map((card) => <button key={card.id} className={`module-card ${card.tone}`} onClick={() => open(card.id)}><span>{card.eyebrow}</span><h3>{card.title}</h3><p>{card.desc}</p><i>打开工具 →</i></button>)}</section>
    <section className="activity-panel"><div className="section-title"><div><span>最近动态</span><h2>学生成长记录</h2></div><button onClick={() => open("records")}>添加记录 +</button></div>{data.records.slice(0, 3).map((record) => <div className="activity" key={record.id}><span>{record.student.slice(0, 1)}</span><div><b>{record.student}<em>{record.type}</em></b><p>{record.content}</p></div><time>{record.date}</time></div>)}</section>
  </>;
}

function ToolHeading({ kicker, title, text, action }: { kicker: string; title: string; text: string; action?: React.ReactNode }) {
  return <div className="tool-heading"><div><span>{kicker}</span><h2>{title}</h2><p>{text}</p></div>{action}</div>;
}

function Schedule({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const days = ["星期一", "星期二", "星期三", "星期四", "星期五"];
  function changeCourse(day: number, period: number, value: string) {
    update((current) => ({ ...current, courses: current.courses.map((row, rowIndex) => rowIndex === day ? row.map((course, colIndex) => colIndex === period ? value : course) : row) }));
  }
  return <><ToolHeading kicker="课程与日程" title="一张表同步班级每周安排" text="直接点击每个课程格修改名称，修改后会保存到当前班级。" action={<button className="primary-small">更换样式</button>} /><div className="paper-card"><div className="field-legend"><b>✎ 可编辑课程格</b><span>点击下面带绿色边框的格子直接输入</span></div><div className="schedule-grid"><div className="schedule-corner">节次</div>{days.map((d) => <b key={d}>{d}</b>)}{[0,1,2,3,4].map((period) => <div className="schedule-row" key={period}><span>第{period + 1}节</span>{days.map((_, day) => <div className="editable-cell" key={day}><input aria-label={`${days[day]}第${period + 1}节`} value={data.courses[day][period]} onChange={(event) => changeCourse(day, period, event.target.value)} /></div>)}</div>)}</div><div className="style-strip"><b>打印样式</b>{["清新绿", "黑板风", "低年级", "简约蓝", "护眼版"].map((s, i) => <button className={i === 0 ? "selected" : ""} key={s}><i></i>{s}</button>)}</div></div></>;
}

function Seating({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  function shuffle() { update((d) => ({ ...d, students: [...d.students].sort(() => Math.random() - .5).map((s, i) => ({ ...s, seat: i + 1 })) })); }
  function choose(student: Student) {
    if (!selected) { setSelected(student.id); return; }
    if (selected === student.id) { setSelected(null); return; }
    update((current) => {
      const first = current.students.find((item) => item.id === selected);
      if (!first) return current;
      return { ...current, students: current.students.map((item) => item.id === first.id ? { ...item, seat: student.seat } : item.id === student.id ? { ...item, seat: first.seat } : item) };
    });
    setSelected(null);
  }
  const seated = [...data.students].sort((a, b) => a.seat - b.seat);
  return <><ToolHeading kicker="座位与分组" title="兼顾公平，也保留老师的判断" text="点击两名学生即可互换座位，也可以一键重新排座。" action={<button className="primary-small" onClick={shuffle}>重新智能排座</button>} /><div className="seat-instruction"><b>{selected ? "已选择第一名学生" : "手动换座"}</b><span>{selected ? "现在再点击另一名学生，两人将立即互换座位" : "先点击一名学生，再点击另一名学生"}</span></div><div className="seating-wrap"><div className="blackboard">黑 板</div><div className="seat-grid">{seated.map((s) => <button className={selected === s.id ? "selected" : ""} onClick={() => choose(s)} key={s.id} title={`${s.name} · 第${s.group}组`}><span>{s.name}</span><small>{s.score}分 · {s.points}积分</small><em>点击换座</em></button>)}</div><div className="teacher-desk">讲台</div></div></>;
}

function Duty({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const jobs = ["地面", "黑板", "讲台", "走廊", "门窗"];
  const days = ["星期一", "星期二", "星期三", "星期四", "星期五"];
  const groups = Array.from({ length: 6 }, (_, group) => data.students.filter((s) => s.group === group + 1));
  return <><ToolHeading kicker="值日与岗位" title="每个人做过什么，系统替你记住" text="按组自动轮换，避免总是同一批学生承担重复工作。" action={<button className="primary-small" onClick={() => update((d) => ({ ...d, dutyOffset: (d.dutyOffset + 1) % 6 }))}>轮换到下一周</button>} /><div className="duty-board">{days.map((day, i) => { const group = groups[(i + data.dutyOffset) % groups.length]; return <article key={day}><header><span>{day}</span><b>第{(i + data.dutyOffset) % 6 + 1}组</b></header>{jobs.map((job, j) => <div key={job}><span>{job}</span><b>{group[j % group.length]?.name}</b></div>)}</article>; })}</div></>;
}

function Homework({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const order: Student["homework"][] = ["已交", "待订正", "未交"];
  function toggle(id: string) { update((d) => ({ ...d, students: d.students.map((s) => s.id === id ? { ...s, homework: order[(order.indexOf(s.homework) + 1) % order.length] } : s) })); }
  return <><ToolHeading kicker="作业追踪" title="从提交到订正，真正形成闭环" text="点击状态即可更新，系统会把未交和待订正学生汇总为待办。" /><div className="table-card"><div className="filter-bar"><b>今日数学作业</b><span>共{data.students.length}人</span><em>{data.students.filter((s) => s.homework === "未交").length}人未交</em></div><div className="student-table"><div className="table-head"><span>学生</span><span>小组</span><span>当前状态</span><span>操作</span></div>{data.students.map((s) => <div className="table-line" key={s.id}><b><i>{s.name.slice(0,1)}</i>{s.name}</b><span>第{s.group}组</span><span className={`status ${s.homework}`}>{s.homework}</span><button onClick={() => toggle(s.id)}>切换状态</button></div>)}</div></div></>;
}

function Points({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const ranked = [...data.students].sort((a, b) => b.points - a.points);
  function change(id: string, delta: number) { update((d) => ({ ...d, students: d.students.map((s) => s.id === id ? { ...s, points: s.points + delta } : s) })); }
  return <><ToolHeading kicker="积分评价" title="记录一次，荣誉和评语都能复用" text="积分不只是排行榜，它会成为成长档案、期末评语和奖状的证据。" /><div className="points-layout"><div className="podium">{ranked.slice(0,3).map((s, i) => <div className={`place p${i + 1}`} key={s.id}><span>{i + 1}</span><i>{s.name.slice(0,1)}</i><b>{s.name}</b><em>{s.points}分</em></div>)}</div><div className="points-list">{ranked.map((s, i) => <div key={s.id}><span>{i + 1}</span><b>{s.name}</b><small>第{s.group}组</small><em>{s.points}</em><button onClick={() => change(s.id, -1)}>−</button><button onClick={() => change(s.id, 1)}>＋</button></div>)}</div></div></>;
}

function Scores({ data }: { data: ClassroomData }) {
  const average = Math.round(data.students.reduce((sum, s) => sum + s.score, 0) / data.students.length);
  const sorted = [...data.students].sort((a,b) => a.score - b.score);
  return <><ToolHeading kicker="成绩与帮扶" title="不只给图表，还告诉你接下来关注谁" text="把成绩波动与作业、考勤、日常记录放在一起判断。" /><div className="score-summary"><div><span>班级平均分</span><b>{average}</b><small>较上次 +2.4</small></div><div><span>优秀率</span><b>{Math.round(data.students.filter((s) => s.score >= 90).length / data.students.length * 100)}%</b><small>90分及以上</small></div><div><span>重点跟进</span><b>{data.students.filter((s) => s.score < 80).length}</b><small>已生成帮扶建议</small></div></div><div className="analysis-grid"><div className="chart-card"><h3>学生成绩分布</h3>{["90—100", "80—89", "70—79", "60—69"].map((range, i) => { const counts = [data.students.filter(s=>s.score>=90).length,data.students.filter(s=>s.score>=80&&s.score<90).length,data.students.filter(s=>s.score>=70&&s.score<80).length,data.students.filter(s=>s.score>=60&&s.score<70).length]; return <div className="bar-row" key={range}><span>{range}</span><i><b style={{width:`${counts[i]/data.students.length*100}%`}}></b></i><em>{counts[i]}人</em></div>; })}</div><div className="attention-card"><h3>优先关注</h3>{sorted.slice(0,5).map((s) => <div key={s.id}><i>{s.name.slice(0,1)}</i><span><b>{s.name}</b><small>{s.homework} · {s.attendance}</small></span><em>{s.score}分</em></div>)}</div></div></>;
}

function Records({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [student, setStudent] = useState(data.students[0]?.name ?? ""); const [content, setContent] = useState(""); const [type, setType] = useState("成长记录");
  function add() { if (!content.trim()) return; update((d) => ({ ...d, records: [{ id: crypto.randomUUID(), student, type, content: content.trim(), date: "刚刚" }, ...d.records] })); setContent(""); }
  return <><ToolHeading kicker="成长与沟通" title="平时随手记，期末不用重新翻找" text="学生亮点、谈话、家访和家校沟通都进入同一份成长档案。" /><div className="record-compose"><select value={student} onChange={(e)=>setStudent(e.target.value)}>{data.students.map(s=><option key={s.id}>{s.name}</option>)}</select><select value={type} onChange={(e)=>setType(e.target.value)}>{["成长记录","谈心记录","家校沟通","作业跟进","纪律表现"].map(t=><option key={t}>{t}</option>)}</select><input value={content} onChange={(e)=>setContent(e.target.value)} placeholder="写下一条具体事实，例如：今天主动帮助同桌整理错题…" /><button onClick={add}>保存记录</button></div><div className="timeline">{data.records.map((r) => <article key={r.id}><i>{r.student.slice(0,1)}</i><div><header><b>{r.student}</b><span>{r.type}</span><time>{r.date}</time></header><p>{r.content}</p></div></article>)}</div></>;
}

function Comments({ data }: { data: ClassroomData }) {
  const [id, setId] = useState(data.students[0]?.id ?? ""); const student = data.students.find(s=>s.id===id) ?? data.students[0];
  const evidence = data.records.filter(r=>r.student===student.name);
  const comment = `${student.name}同学本学期学习态度${student.score >= 90 ? "认真主动，基础扎实" : "较为踏实，能够按要求完成学习任务"}。在班级生活中${student.points >= 15 ? "积极参与集体活动，乐于帮助同学" : "能够遵守班级约定，并在提醒下不断进步"}。${evidence[0]?.content ? `老师特别注意到：${evidence[0].content}` : "期待你继续积累每一次小进步。"}希望下学期${student.homework === "已交" ? "继续保持好习惯，勇于表达自己的想法" : "进一步提高作业的及时性，养成检查和订正的习惯"}。`;
  const [draft, setDraft] = useState(comment);
  useEffect(() => setDraft(comment), [id, comment]);
  return <><ToolHeading kicker="期末评语" title="每一句评价，都能找到日常依据" text="系统生成草稿后，可以直接在绿色编辑框里修改。" /><div className="comment-layout"><div className="student-picker"><h3>选择学生</h3>{data.students.map(s=><button className={s.id===id?"selected":""} onClick={()=>setId(s.id)} key={s.id}><i>{s.name.slice(0,1)}</i><span>{s.name}<small>{data.records.filter(r=>r.student===s.name).length}条成长证据</small></span></button>)}</div><div className="comment-paper"><div className="comment-head"><span>✎ 可编辑评语草稿</span><button onClick={() => setDraft(comment)}>重新生成</button></div><h2>{student.name}</h2><textarea aria-label="可编辑评语草稿" value={draft} onChange={(event) => setDraft(event.target.value)} /><div className="evidence-row"><span>引用依据</span><em>成绩 {student.score}</em><em>积分 {student.points}</em><em>{student.homework}</em></div><button className="primary-small" onClick={() => navigator.clipboard?.writeText(draft)}>复制评语</button></div></div></>;
}

function Certificates({ data }: { data: ClassroomData }) {
  const [id,setId]=useState(data.students[0]?.id??""); const [award,setAward]=useState("进步之星"); const student=data.students.find(s=>s.id===id)??data.students[0];
  return <><ToolHeading kicker="奖状生成" title="名单选好，几十份奖状一次生成" text="原资料中的奖状图片成为样式库，姓名、奖项和日期自动填充。" /><div className="certificate-layout"><div className="certificate-controls"><label>获奖学生<select value={id} onChange={e=>setId(e.target.value)}>{data.students.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>荣誉称号<select value={award} onChange={e=>setAward(e.target.value)}>{["进步之星","文明礼仪之星","优秀班干部","阅读小明星","劳动小能手","三好学生"].map(a=><option key={a}>{a}</option>)}</select></label><label>模板样式<div className="template-picks">{[1,2,3,4].map((n)=><button className={n===1?"selected":""} key={n}>样式{n}</button>)}</div></label><button className="primary-small">批量生成并导出</button></div><div className="certificate"><span>荣 誉 证 书</span><p><b>{student.name}</b> 同学：</p><p>在本学期班级学习与生活中表现优秀，荣获</p><h2>“{award}”</h2><p>特发此证，以资鼓励。</p><footer><span>向阳小学三年级2班</span><span>2026年7月</span></footer></div></div></>;
}

type KnowledgeResult = { id: string; title: string; category: string; extension: string; path: string; excerpt: string; content?: string };

function Resources({ token }: { token: string }) {
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("");
  const [results,setResults]=useState<KnowledgeResult[]>([]);
  const [categories,setCategories]=useState<{name:string;count:number}[]>([]);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<KnowledgeResult|null>(null);
  const [total,setTotal]=useState(0);

  async function search(nextQuery=query,nextCategory=category) {
    setLoading(true); setSelected(null);
    const params=new URLSearchParams(); if(nextQuery.trim())params.set("q",nextQuery.trim()); if(nextCategory)params.set("category",nextCategory);
    const response=await fetch(`/api/knowledge/${token}?${params}`);
    const body=await response.json() as {items?:KnowledgeResult[];categories?:{name:string;count:number}[];total?:number};
    setResults(body.items??[]); setCategories(body.categories??[]); setTotal(body.total??0); setLoading(false);
  }
  async function openItem(item:KnowledgeResult) {
    const response=await fetch(`/api/knowledge/${token}?id=${encodeURIComponent(item.id)}`);
    const body=await response.json() as {item?:KnowledgeResult};
    if(body.item)setSelected(body.item);
  }
  useEffect(()=>{ search("",""); },[]);

  return <><ToolHeading kicker="资料知识库" title="真实资料已经接入，可以搜索和阅读全文" text="当前收录620份能够稳定解析的资料正文；搜索会同时匹配标题和全文内容。" /><div className="resource-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} placeholder="搜索：家访记录、座位轮换、期末评语、成绩分析…" /><button onClick={()=>search()}>搜索正文</button></div><div className="resource-metrics"><span><b>620</b>份真实正文</span><span><b>500万+</b>可检索文字</span><span><b>{categories.length}</b>资料分类</span><span><b>{total}</b>条当前结果</span></div><div className="knowledge-layout"><aside className="knowledge-categories"><h3>资料分类</h3><button className={!category?"active":""} onClick={()=>{setCategory("");search(query,"")}}>全部资料 <span>620</span></button>{categories.map(cat=><button className={category===cat.name?"active":""} key={cat.name} onClick={()=>{setCategory(cat.name);search(query,cat.name)}}>{cat.name}<span>{cat.count}</span></button>)}</aside><section className="knowledge-results"><div className="results-head"><b>{loading?"正在检索真实资料…":`找到 ${total} 份相关资料`}</b><span>点击标题查看完整正文</span></div>{!loading&&results.length===0&&<div className="empty-result"><b>没有找到完全匹配的资料</b><span>可以缩短关键词，例如把“怎么和家长沟通”改为“家长沟通”</span></div>}{results.map(item=><button className="knowledge-item" key={item.id} onClick={()=>openItem(item)}><span className="file-type">{item.extension||"资料"}</span><div><h3>{item.title}</h3><p>{item.excerpt}</p><small>{item.category} · {item.path}</small></div><em>阅读全文 →</em></button>)}</section></div>{selected&&<div className="document-overlay" onClick={()=>setSelected(null)}><article className="document-reader" onClick={e=>e.stopPropagation()}><header><div><span>{selected.extension} · {selected.category}</span><h2>{selected.title}</h2></div><button aria-label="关闭正文" onClick={()=>setSelected(null)}>×</button></header><div className="document-path">来源：{selected.path}</div><pre>{selected.content}</pre></article></div>}<div className="rights-note">49份无法稳定还原排版的旧版Word没有直接展示，避免出现乱码；教师荐书等出版物仍需根据商业授权范围开放。</div></>;
}
