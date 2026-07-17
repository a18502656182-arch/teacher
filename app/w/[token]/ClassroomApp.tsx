"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ClassroomData, Student } from "@/lib/classroom";

type Workspace = { className: string; grade: string; term: string; expiresAt: string; data: ClassroomData };
type ModuleId = "dashboard" | "students" | "schedule" | "seating" | "duty" | "homework" | "points" | "scores" | "records" | "comments" | "certificates" | "resources";

const nav: { id: ModuleId; icon: string; label: string }[] = [
  { id: "dashboard", icon: "⌂", label: "今日工作台" },
  { id: "students", icon: "名", label: "学生名单" },
  { id: "schedule", icon: "日", label: "课程与日程" },
  { id: "seating", icon: "座", label: "座位与分组" },
  { id: "duty", icon: "值", label: "值日与岗位" },
  { id: "homework", icon: "作", label: "作业追踪" },
  { id: "points", icon: "分", label: "积分评价" },
  { id: "scores", icon: "绩", label: "成绩分析" },
  { id: "records", icon: "访", label: "家校沟通" },
  { id: "comments", icon: "评", label: "期末评语" },
  { id: "certificates", icon: "奖", label: "奖状生成" },
  { id: "resources", icon: "库", label: "资料成品库" },
];

const pointRules = [
  { scene: "作业", plus: "优秀作业、订正及时 +1", minus: "迟交/漏写 -2，抄袭 -5", owner: "课代表" },
  { scene: "课堂", plus: "主动发言、被表扬 +1", minus: "讲话、走神、影响他人 -2", owner: "学习委员" },
  { scene: "纪律", plus: "一周无违纪 +3", minus: "迟到 -1，顶撞老师 -5", owner: "纪律委员" },
  { scene: "卫生", plus: "主动打扫、承包区达标 +1", minus: "乱丢垃圾/值日不认真 -2", owner: "劳动委员" },
  { scene: "集体", plus: "活动获奖、为班争光 +3", minus: "集会拖拉、队伍讲话 -1", owner: "班长" },
];

const templates = [
  { title: "班级公约", tag: "常规管理", body: "出勤、课前、课堂、课间、自习、作业、卫生、仪表、升旗十项约定，适合开学第一周直接公布。" },
  { title: "积分考核准则", tag: "积分体系", body: "起始分、周结分、月奖励、扣分翻倍、班干部责任都已整理成可执行规则。" },
  { title: "考试后反思表", tag: "成绩提升", body: "包含预习复习、听课状态、错因分析、挑战目标、写给家人和班主任的话。" },
  { title: "家访登记表", tag: "家校沟通", body: "时间、地点、接访人、家访目的、家庭情况、沟通内容、家长意见一张表记录。" },
  { title: "班干部职责表", tag: "班委管理", body: "班长、副班长、学习委员、纪律委员、劳动委员、课代表的职责可直接分配。" },
  { title: "作业完成登记表", tag: "作业追踪", body: "按周记录语数英完成情况，自动沉淀未交、待订正、表现良好的学生名单。" },
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
    } catch {
      setError("暂时无法保存，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="app-state"><div className="loader"></div><h2>正在打开你的班级工作台</h2><p>课程、名单、积分和家校沟通表正在准备中…</p></div>;
  if (error && !workspace) return <div className="app-state error-state"><span>!</span><h2>暂时不能打开这个班级</h2><p>{error}</p><a href="/">返回首页</a></div>;
  if (!workspace) return null;

  const activeLabel = nav.find((item) => item.id === active)?.label;
  const editableModules: ModuleId[] = ["students", "schedule", "seating", "duty", "homework", "points", "records", "comments", "certificates"];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand sidebar-brand" href="/"><span className="brand-mark">班</span><span>云工具箱</span></a>
        <div className="class-switch"><small>当前班级</small><b>{workspace.className}</b><span>{workspace.term}</span></div>
        <nav className="side-nav" aria-label="班级工具">{nav.map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setActive(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
        <div className="license-card"><span className="live-dot"></span><div><b>授权使用中</b><small>有效期至 {workspace.expiresAt}</small></div></div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <div><p>{workspace.grade} · {workspace.term}</p><h1>{activeLabel}</h1></div>
          <div className="top-actions"><button className="ghost-btn" onClick={() => window.print()}>打印</button><button className="save-btn" disabled={!dirty || saving} onClick={save}>{saving ? "正在保存…" : dirty ? "保存更改" : "已保存"}</button><span className="avatar">林</span></div>
        </header>
        {error && workspace && <div className="inline-alert" onClick={() => setError("")}>{error}<span>×</span></div>}
        {editableModules.includes(active) && <div className="edit-mode-banner"><b>✎ 当前页面可以编辑</b><span>绿色边框、输入框、加减按钮都可以改；改完点右上角“保存更改”。</span></div>}
        <div className="page-content">
          {active === "dashboard" && <Dashboard data={workspace.data} open={setActive} />}
          {active === "students" && <Students data={workspace.data} update={updateData} />}
          {active === "schedule" && <Schedule data={workspace.data} update={updateData} />}
          {active === "seating" && <Seating data={workspace.data} update={updateData} />}
          {active === "duty" && <Duty data={workspace.data} update={updateData} />}
          {active === "homework" && <Homework data={workspace.data} update={updateData} />}
          {active === "points" && <Points data={workspace.data} update={updateData} />}
          {active === "scores" && <Scores data={workspace.data} />}
          {active === "records" && <Records data={workspace.data} update={updateData} />}
          {active === "comments" && <Comments data={workspace.data} />}
          {active === "certificates" && <Certificates data={workspace.data} />}
          {active === "resources" && <Resources open={setActive} />}
        </div>
      </main>
    </div>
  );
}

function ToolHeading({ kicker, title, text, action }: { kicker: string; title: string; text: string; action?: ReactNode }) {
  return <div className="tool-heading"><div><span>{kicker}</span><h2>{title}</h2><p>{text}</p></div>{action}</div>;
}

function Dashboard({ data, open }: { data: ClassroomData; open: (id: ModuleId) => void }) {
  const missing = data.students.filter((s) => s.homework !== "已交").length;
  const attention = data.students.filter((s) => s.score < 80 || s.attendance !== "正常").length;
  const groups = new Set(data.students.map((s) => s.group)).size;
  return <>
    <section className="welcome"><div><span className="eyebrow">班主任一日工作台</span><h2>不是资料夹，是可以直接用的班级系统。</h2><p>我已把资料里的公约、积分、作业、家访、反思、班干部职责拆成了可编辑的日常工具。</p></div><div className="date-badge"><b>17</b><span>七月 · 星期五</span></div></section>
    <section className="stat-row"><div><span>班级学生</span><b>{data.students.length}</b><small>{groups}个学习小组</small></div><div><span>作业待跟进</span><b>{missing}</b><small className="warn">未交和待订正</small></div><div><span>需要关注</span><b>{attention}</b><small>成绩、考勤、作业综合判断</small></div><div><span>本周沟通记录</span><b>{data.records.length}</b><small className="good">可生成评语证据</small></div></section>
    <section className="quick-board">
      <button onClick={() => open("students")}><b>导入学生名单</b><span>批量粘贴姓名，自动生成座位、小组、积分档案。</span></button>
      <button onClick={() => open("points")}><b>套用积分准则</b><span>作业、课堂、纪律、卫生、集体表现都有加扣分依据。</span></button>
      <button onClick={() => open("records")}><b>写家访/谈心记录</b><span>按家访登记表结构记录，期末评语能直接引用。</span></button>
      <button onClick={() => open("scores")}><b>考试后帮扶</b><span>从低分、未交、迟到里找出优先关注学生。</span></button>
    </section>
    <div className="section-title"><div><span>资料已工具化</span><h2>这些不是空按钮，都是老师每天会用的工作流</h2></div><button onClick={() => open("resources")}>查看成品库 →</button></div>
    <section className="module-grid">{templates.slice(0, 4).map((card) => <button key={card.title} className="module-card mint" onClick={() => open(card.title.includes("家访") ? "records" : card.title.includes("积分") ? "points" : card.title.includes("作业") ? "homework" : "resources")}><span>{card.tag}</span><h3>{card.title}</h3><p>{card.body}</p><i>打开 →</i></button>)}</section>
  </>;
}

function Students({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [bulk, setBulk] = useState("张三\n李四\n王五");
  function editStudent(id: string, patch: Partial<Student>) {
    update((d) => ({ ...d, students: d.students.map((s) => s.id === id ? { ...s, ...patch } : s) }));
  }
  function importNames() {
    const names = bulk.split(/[\n,，、\s]+/).map((name) => name.trim()).filter(Boolean);
    if (!names.length) return;
    update((d) => ({
      ...d,
      students: names.map((name, index) => ({
        id: `s${Date.now()}-${index}`,
        name,
        gender: index % 2 === 0 ? "女" : "男",
        group: Math.floor(index / 4) + 1,
        seat: index + 1,
        points: 60,
        homework: "已交",
        attendance: "正常",
        score: 85,
      })),
    }));
  }
  function addStudent() {
    update((d) => ({ ...d, students: [...d.students, { id: crypto.randomUUID(), name: "新同学", gender: "女", group: Math.floor(d.students.length / 4) + 1, seat: d.students.length + 1, points: 60, homework: "已交", attendance: "正常", score: 85 }] }));
  }
  return <>
    <ToolHeading kicker="学生名单" title="先把学生变成系统里的可编辑档案" text="可以批量导入姓名，也可以逐个改姓名、性别、小组、座位、成绩和积分。" action={<button className="primary-small" onClick={addStudent}>新增学生</button>} />
    <section className="import-card">
      <div><h3>批量导入名单</h3><p>从表格或微信里复制姓名，按换行、空格、顿号分隔都可以。导入后会自动生成小组和座位。</p></div>
      <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} />
      <button onClick={importNames}>导入并替换当前名单</button>
    </section>
    <section className="editable-student-table">
      <div className="student-edit-head"><span>姓名</span><span>性别</span><span>小组</span><span>座位</span><span>积分</span><span>成绩</span><span>作业</span><span>考勤</span></div>
      {data.students.map((s) => <div className="student-edit-line" key={s.id}>
        <input value={s.name} onChange={(e) => editStudent(s.id, { name: e.target.value })} />
        <select value={s.gender} onChange={(e) => editStudent(s.id, { gender: e.target.value as Student["gender"] })}><option>女</option><option>男</option></select>
        <input type="number" value={s.group} onChange={(e) => editStudent(s.id, { group: Number(e.target.value) || 1 })} />
        <input type="number" value={s.seat} onChange={(e) => editStudent(s.id, { seat: Number(e.target.value) || 1 })} />
        <input type="number" value={s.points} onChange={(e) => editStudent(s.id, { points: Number(e.target.value) || 0 })} />
        <input type="number" value={s.score} onChange={(e) => editStudent(s.id, { score: Number(e.target.value) || 0 })} />
        <select value={s.homework} onChange={(e) => editStudent(s.id, { homework: e.target.value as Student["homework"] })}><option>已交</option><option>待订正</option><option>未交</option></select>
        <select value={s.attendance} onChange={(e) => editStudent(s.id, { attendance: e.target.value as Student["attendance"] })}><option>正常</option><option>迟到</option><option>请假</option></select>
      </div>)}
    </section>
  </>;
}

function Schedule({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const days = ["星期一", "星期二", "星期三", "星期四", "星期五"];
  function changeCourse(day: number, period: number, value: string) {
    update((current) => ({ ...current, courses: current.courses.map((row, rowIndex) => rowIndex === day ? row.map((course, colIndex) => colIndex === period ? value : course) : row) }));
  }
  return <><ToolHeading kicker="课程与日程" title="一张表同步班级每周安排" text="点击课程格即可修改；这张表来自原资料里的课程表和座位表思路。" /><div className="paper-card"><div className="field-legend"><b>✎ 可编辑课程格</b><span>绿色边框里的内容都可以直接输入</span></div><div className="schedule-grid"><div className="schedule-corner">节次</div>{days.map((d) => <b key={d}>{d}</b>)}{[0,1,2,3,4].map((period) => <div className="schedule-row" key={period}><span>第{period + 1}节</span>{days.map((_, day) => <div className="editable-cell" key={day}><input aria-label={`${days[day]}第${period + 1}节`} value={data.courses[day]?.[period] ?? ""} onChange={(event) => changeCourse(day, period, event.target.value)} /></div>)}</div>)}</div></div></>;
}

function Seating({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  function shuffle() { update((d) => ({ ...d, students: [...d.students].sort(() => Math.random() - .5).map((s, i) => ({ ...s, seat: i + 1, group: Math.floor(i / 4) + 1 })) })); }
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
  return <><ToolHeading kicker="座位与分组" title="从名单自动生成，也能手动换座" text="点击两名学生即可互换座位；重新排座会同步更新分组。" action={<button className="primary-small" onClick={shuffle}>重新排座</button>} /><div className="seat-instruction"><b>{selected ? "已选择第一名学生" : "手动换座"}</b><span>{selected ? "现在再点击另一名学生，两人将互换座位" : "先点击一名学生，再点击另一名学生"}</span></div><div className="seating-wrap"><div className="blackboard">黑 板</div><div className="seat-grid">{[...data.students].sort((a, b) => a.seat - b.seat).map((s) => <button className={selected === s.id ? "selected" : ""} onClick={() => choose(s)} key={s.id}><span>{s.name}</span><small>第{s.group}组 · {s.score}分</small><em>点击换座</em></button>)}</div><div className="teacher-desk">讲台</div></div></>;
}

function Duty({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const jobs = ["地面", "黑板", "讲台", "走廊", "门窗"];
  const days = ["星期一", "星期二", "星期三", "星期四", "星期五"];
  const maxGroup = Math.max(1, ...data.students.map((s) => s.group));
  const groups = Array.from({ length: maxGroup }, (_, group) => data.students.filter((s) => s.group === group + 1));
  return <><ToolHeading kicker="值日与岗位" title="照着班干部职责表，把岗位落到人" text="按小组轮换值日，避免总是同一批学生承担重复工作。" action={<button className="primary-small" onClick={() => update((d) => ({ ...d, dutyOffset: (d.dutyOffset + 1) % maxGroup }))}>轮换到下一周</button>} /><div className="duty-board">{days.map((day, i) => { const groupIndex = (i + data.dutyOffset) % groups.length; const group = groups[groupIndex] ?? []; return <article key={day}><header><span>{day}</span><b>第{groupIndex + 1}组</b></header>{jobs.map((job, j) => <div key={job}><span>{job}</span><b>{group[j % Math.max(1, group.length)]?.name ?? "待安排"}</b></div>)}</article>; })}</div></>;
}

function Homework({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const order: Student["homework"][] = ["已交", "待订正", "未交"];
  function toggle(id: string) { update((d) => ({ ...d, students: d.students.map((s) => s.id === id ? { ...s, homework: order[(order.indexOf(s.homework) + 1) % order.length] } : s) })); }
  return <><ToolHeading kicker="作业追踪" title="从提交到订正，真正形成闭环" text="参考作业完成登记表，保留已交、待订正、未交三种老师最常用状态。" /><div className="table-card"><div className="filter-bar"><b>今日作业完成情况</b><span>共{data.students.length}人</span><em>{data.students.filter((s) => s.homework === "未交").length}人未交</em></div><div className="student-table"><div className="table-head"><span>学生</span><span>小组</span><span>当前状态</span><span>操作</span></div>{data.students.map((s) => <div className="table-line" key={s.id}><b><i>{s.name.slice(0,1)}</i>{s.name}</b><span>第{s.group}组</span><span className={`status ${s.homework}`}>{s.homework}</span><button onClick={() => toggle(s.id)}>切换状态</button></div>)}</div></div></>;
}

function Points({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const ranked = [...data.students].sort((a, b) => b.points - a.points);
  function change(id: string, delta: number) { update((d) => ({ ...d, students: d.students.map((s) => s.id === id ? { ...s, points: s.points + delta } : s) })); }
  return <><ToolHeading kicker="积分评价" title="把资料里的量化考核细则变成可点击规则" text="老师不需要翻文件，按场景直接加减分即可。" /><section className="rules-grid">{pointRules.map((rule) => <article key={rule.scene}><h3>{rule.scene}</h3><p><b>加分：</b>{rule.plus}</p><p><b>扣分：</b>{rule.minus}</p><span>{rule.owner}记录</span></article>)}</section><div className="points-layout"><div className="podium">{ranked.slice(0,3).map((s, i) => <div className={`place p${i + 1}`} key={s.id}><span>{i + 1}</span><i>{s.name.slice(0,1)}</i><b>{s.name}</b><em>{s.points}分</em></div>)}</div><div className="points-list">{ranked.map((s, i) => <div key={s.id}><span>{i + 1}</span><b>{s.name}</b><small>第{s.group}组</small><em>{s.points}</em><button onClick={() => change(s.id, -1)}>−</button><button onClick={() => change(s.id, 1)}>＋</button></div>)}</div></div></>;
}

function Scores({ data }: { data: ClassroomData }) {
  const average = Math.round(data.students.reduce((sum, s) => sum + s.score, 0) / Math.max(1, data.students.length));
  const sorted = [...data.students].sort((a,b) => a.score - b.score);
  const weak = sorted.slice(0, 5);
  return <><ToolHeading kicker="成绩与帮扶" title="考试后不止看分数，还要生成跟进动作" text="参考考试后学生反思表，把低分、未交、迟到合并成优先帮扶名单。" /><div className="score-summary"><div><span>班级平均分</span><b>{average}</b><small>当前样例数据</small></div><div><span>优秀率</span><b>{Math.round(data.students.filter((s) => s.score >= 90).length / Math.max(1, data.students.length) * 100)}%</b><small>90分及以上</small></div><div><span>重点跟进</span><b>{data.students.filter((s) => s.score < 80 || s.homework !== "已交").length}</b><small>已生成帮扶建议</small></div></div><div className="analysis-grid"><div className="chart-card"><h3>考试后反思清单</h3>{["是否完成课前预习和课后巩固", "作业是否第一时间独立完成", "错题是否真正订正到会做", "考试时是否审题清楚、书写规范", "下一次要挑战的目标是谁"].map((item) => <label className="check-line" key={item}><input type="checkbox" />{item}</label>)}</div><div className="attention-card"><h3>优先关注</h3>{weak.map((s) => <div key={s.id}><i>{s.name.slice(0,1)}</i><span><b>{s.name}</b><small>{s.homework} · {s.attendance}</small></span><em>{s.score}分</em></div>)}</div></div></>;
}

function Records({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [student, setStudent] = useState(data.students[0]?.name ?? "");
  const [type, setType] = useState("家访登记");
  const [purpose, setPurpose] = useState("了解学生在家学习与作息情况");
  const [home, setHome] = useState("家长工作较忙，孩子作业需要更多陪伴和提醒。");
  const [content, setContent] = useState("反馈学生在校表现，约定本周先从按时完成作业和整理书包开始。");
  function add() {
    const text = `${purpose}｜家庭情况：${home}｜沟通内容：${content}`;
    update((d) => ({ ...d, records: [{ id: crypto.randomUUID(), student, type, content: text, date: "刚刚" }, ...d.records] }));
  }
  return <><ToolHeading kicker="家校沟通" title="把家访登记表做成可直接填写的记录器" text="原表里的时间、目的、家庭情况、沟通内容被整理成结构化输入。" /><div className="visit-form"><select value={student} onChange={(e)=>setStudent(e.target.value)}>{data.students.map(s=><option key={s.id}>{s.name}</option>)}</select><select value={type} onChange={(e)=>setType(e.target.value)}>{["家访登记","谈心记录","作业跟进","纪律表现","表扬记录"].map(t=><option key={t}>{t}</option>)}</select><input value={purpose} onChange={(e)=>setPurpose(e.target.value)} placeholder="家访目的" /><textarea value={home} onChange={(e)=>setHome(e.target.value)} placeholder="家庭情况及在家表现" /><textarea value={content} onChange={(e)=>setContent(e.target.value)} placeholder="沟通内容与下一步约定" /><button onClick={add}>保存到成长档案</button></div><div className="timeline">{data.records.map((r) => <article key={r.id}><i>{r.student.slice(0,1)}</i><div><header><b>{r.student}</b><span>{r.type}</span><time>{r.date}</time></header><p>{r.content}</p></div></article>)}</div></>;
}

function Comments({ data }: { data: ClassroomData }) {
  const [id, setId] = useState(data.students[0]?.id ?? "");
  const student = data.students.find(s=>s.id===id) ?? data.students[0];
  const evidence = data.records.filter(r=>r.student===student?.name);
  const comment = useMemo(() => student ? `${student.name}同学本学期能够参与班级生活，整体表现${student.score >= 90 ? "稳定优秀，学习主动性较强" : student.score >= 80 ? "较为踏实，仍有继续提升空间" : "需要老师和家长继续共同陪伴"}。在日常记录中，${evidence[0]?.content ?? "老师期待你把每一次小进步坚持下来"}。希望下学期继续在作业习惯、课堂表达和自我管理上给自己更明确的目标。` : "", [student, evidence]);
  const [draft, setDraft] = useState(comment);
  useEffect(() => setDraft(comment), [comment]);
  if (!student) return null;
  return <><ToolHeading kicker="期末评语" title="从平时记录里长出来的评语，更像老师亲自写的" text="可编辑草稿，不再只是套一句空话。" /><div className="comment-layout"><div className="student-picker"><h3>选择学生</h3>{data.students.map(s=><button className={s.id===id?"selected":""} onClick={()=>setId(s.id)} key={s.id}><i>{s.name.slice(0,1)}</i><span>{s.name}<small>{data.records.filter(r=>r.student===s.name).length}条证据</small></span></button>)}</div><div className="comment-paper"><div className="comment-head"><span>✎ 可编辑评语草稿</span><button onClick={() => setDraft(comment)}>重新生成</button></div><h2>{student.name}</h2><textarea value={draft} onChange={(event) => setDraft(event.target.value)} /><div className="evidence-row"><span>引用依据</span><em>成绩 {student.score}</em><em>积分 {student.points}</em><em>{student.homework}</em></div><button className="primary-small" onClick={() => navigator.clipboard?.writeText(draft)}>复制评语</button></div></div></>;
}

function Certificates({ data }: { data: ClassroomData }) {
  const [id,setId]=useState(data.students[0]?.id??"");
  const [award,setAward]=useState("进步之星");
  const student=data.students.find(s=>s.id===id)??data.students[0];
  if (!student) return null;
  return <><ToolHeading kicker="奖状生成" title="姓名和奖项可改，适合班级批量表扬" text="先做成在线预览，后续再接真正的批量导出。" /><div className="certificate-layout"><div className="certificate-controls"><label>获奖学生<select value={id} onChange={e=>setId(e.target.value)}>{data.students.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>荣誉称号<select value={award} onChange={e=>setAward(e.target.value)}>{["进步之星","文明礼仪之星","优秀班干部","阅读小明星","劳动小能手","三好学生"].map(a=><option key={a}>{a}</option>)}</select></label><label>模板样式<div className="template-picks">{["金色经典","低年级可爱","简洁红章","清新校园"].map((n,i)=><button className={i===0?"selected":""} key={n}>{n}</button>)}</div></label></div><div className="certificate"><span>荣 誉 证 书</span><p><b>{student.name}</b> 同学：</p><p>在本学期班级学习与生活中表现优秀，荣获</p><h2>“{award}”</h2><p>特发此证，以资鼓励。</p><footer><span>向阳小学三年级2班</span><span>2026年7月</span></footer></div></div></>;
}

function Resources({ open }: { open: (id: ModuleId) => void }) {
  return <><ToolHeading kicker="资料成品库" title="先不展示乱码正文，只展示已经工具化的资料" text="我把比较完整、可落地的资料提炼成模板入口，后面再单独做知识库清洗。" /><section className="resource-grid">{templates.map((item) => <article key={item.title}><span>{item.tag}</span><h3>{item.title}</h3><p>{item.body}</p><button onClick={() => open(item.title.includes("家访") ? "records" : item.title.includes("作业") ? "homework" : item.title.includes("积分") ? "points" : item.title.includes("考试") ? "scores" : item.title.includes("班干部") ? "duty" : "resources")}>打开对应工具</button></article>)}</section><div className="rights-note">原始全文知识库暂时收起：当前抽取结果还有乱码和排版问题，等后续清洗好再开放搜索和全文阅读。</div></>;
}
