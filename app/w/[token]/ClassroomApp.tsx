"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CadreRole, ClassroomData, HomeworkTask, PointEvent, RosterClass, Student } from "@/lib/classroom";

type Workspace = { className: string; grade: string; term: string; expiresAt: string; data: ClassroomData };
type ModuleId = "dashboard" | "students" | "homework" | "points" | "rules" | "growth" | "weekly" | "schedule" | "seating" | "duty" | "cadres" | "records" | "scores" | "reflection" | "comments" | "certificates" | "license";

const nav: { id: ModuleId; icon: string; label: string }[] = [
  { id: "dashboard", icon: "⌂", label: "今日工作台" },
  { id: "students", icon: "名", label: "学生名单" },
  { id: "homework", icon: "作", label: "作业追踪" },
  { id: "points", icon: "分", label: "积分评价" },
  { id: "rules", icon: "规", label: "积分规则" },
  { id: "growth", icon: "档", label: "成长档案" },
  { id: "weekly", icon: "周", label: "班级周报" },
  { id: "schedule", icon: "日", label: "课程日程" },
  { id: "seating", icon: "座", label: "座位分组" },
  { id: "duty", icon: "值", label: "值日岗位" },
  { id: "cadres", icon: "干", label: "班干部" },
  { id: "records", icon: "访", label: "家校沟通" },
  { id: "scores", icon: "绩", label: "成绩分析" },
  { id: "reflection", icon: "思", label: "考试反思" },
  { id: "comments", icon: "评", label: "期末评语" },
  { id: "certificates", icon: "奖", label: "奖状生成" },
  { id: "license", icon: "权", label: "权限导出" },
];

const ruleSets = {
  小学温和版: [
    ["作业", "优秀作业/订正及时 +1", "未交 -2，拖拉订正 -1", "课代表"],
    ["课堂", "主动发言/认真倾听 +1", "插话、走神 -1", "学习委员"],
    ["卫生", "主动整理、值日认真 +1", "乱丢垃圾 -1", "劳动委员"],
    ["礼仪", "帮助同学、文明用语 +1", "冲突、脏话 -2", "班长"],
  ],
  初中严格版: [
    ["作业", "优秀作业 +2，阶段进步 +3", "未交 -3，抄袭双方 -5", "课代表"],
    ["课堂", "高质量回答 +2", "睡觉、顶撞、扰乱课堂 -5", "学习委员"],
    ["纪律", "一周无违纪 +5", "迟到 -2，旷课 -10", "纪律委员"],
    ["集体", "竞赛获奖 +3 至 +8", "集会拖拉、队伍讲话 -2", "班长"],
  ],
  班级精细版: [
    ["常规", "校服、三操、早读达标 +3", "连续不达标 -2", "值日班长"],
    ["学习", "满分/明显进步 +3", "复习背诵未完成 -2", "学习委员"],
    ["卫生", "承包区长期达标 +3", "检查不达标 -1", "劳动委员"],
    ["活动", "代表班级参与 +5", "影响班级形象 -3", "班长"],
  ],
};

const awardOptions = ["进步之星", "文明礼仪之星", "优秀班干部", "阅读小明星", "劳动小能手", "三好学生", "作业标兵", "课堂表达之星"];
const homeworkOrder: HomeworkTask["statuses"][string][] = ["已交", "未交", "待订正", "已复查"];
const days = ["星期一", "星期二", "星期三", "星期四", "星期五"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeData(data: ClassroomData): ClassroomData {
  const fallbackStudents = data.students.map((student, index) => ({
    studentNo: student.studentNo ?? `${index + 1}`.padStart(2, "0"),
    parentPhone: student.parentPhone ?? "",
    note: student.note ?? "",
    ...student,
  }));
  const rosterClasses: RosterClass[] = data.rosterClasses?.length
    ? data.rosterClasses.map((item, classIndex) => ({
      id: item.id || `class-${classIndex + 1}`,
      name: item.name || `班级${classIndex + 1}`,
      grade: item.grade || "",
      term: item.term || "",
      students: item.students.map((student, index) => ({
        studentNo: student.studentNo ?? `${index + 1}`.padStart(2, "0"),
        parentPhone: student.parentPhone ?? "",
        note: student.note ?? "",
        ...student,
      })),
    }))
    : [{ id: "class-1", name: "当前班级", grade: "", term: "", students: fallbackStudents }];
  const activeClassId = data.activeClassId && rosterClasses.some((item) => item.id === data.activeClassId) ? data.activeClassId : rosterClasses[0].id;
  const students = rosterClasses.find((item) => item.id === activeClassId)?.students ?? fallbackStudents;
  const firstTask: HomeworkTask = {
    id: "h-default",
    classId: activeClassId,
    date: today(),
    subject: "数学",
    title: "今日作业",
    statuses: Object.fromEntries(students.map((student) => [student.id, student.homework === "已交" ? "已交" : student.homework])),
  };
  return {
    ...data,
    activeClassId,
    rosterClasses,
    students,
    homeworkTasks: data.homeworkTasks?.length ? data.homeworkTasks.map((task) => ({ ...task, classId: task.classId ?? rosterClasses[0].id })) : [firstTask],
    pointEvents: data.pointEvents ?? [],
    cadres: data.cadres?.length ? data.cadres : [
      { id: "c1", role: "班长", studentId: students[0]?.id ?? "", duty: "协助班主任管理班级常规。" },
      { id: "c2", role: "学习委员", studentId: students[1]?.id ?? "", duty: "组织早读，记录作业缺交。" },
      { id: "c3", role: "劳动委员", studentId: students[2]?.id ?? "", duty: "安排和检查卫生岗位。" },
    ],
    weeklyPlan: data.weeklyPlan ?? days.map((day) => ({ day: day.replace("星期", "周"), focus: "班级常规", event: "记录作业、积分、沟通事项" })),
    license: data.license ?? { tier: "基础版", canExport: true, expiresAt: "2099-12-31" },
  };
}

export default function ClassroomApp({ token }: { token: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [active, setActive] = useState<ModuleId>("homework");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/workspace/${token}`).then(async (res) => {
      const body = await res.json() as { workspace?: Workspace; error?: string };
      if (!res.ok || !body.workspace) throw new Error(body.error || "链接读取失败");
      setWorkspace({ ...body.workspace, data: normalizeData(body.workspace.data) });
    }).catch((err) => setError(err instanceof Error ? err.message : "链接读取失败")).finally(() => setLoading(false));
  }, [token]);

  function updateData(updater: (current: ClassroomData) => ClassroomData) {
    setWorkspace((current) => current ? { ...current, data: normalizeData(updater(current.data)) } : current);
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

  if (loading) return <div className="app-state"><div className="loader"></div><h2>正在打开班主任云工具箱</h2><p>名单、作业、积分、座位和值日正在同步中…</p></div>;
  if (error && !workspace) return <div className="app-state error-state"><span>!</span><h2>暂时不能打开这个班级</h2><p>{error}</p><a href="/">返回首页</a></div>;
  if (!workspace) return null;

  const editable: ModuleId[] = ["students", "homework", "points", "rules", "schedule", "seating", "duty", "cadres", "records", "scores", "reflection", "comments", "certificates"];
  const activeLabel = nav.find((item) => item.id === active)?.label;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand sidebar-brand" href="/"><span className="brand-mark">班</span><span>云工具箱</span></a>
        <div className="class-switch"><small>当前班级</small><b>{workspace.className}</b><span>{workspace.term}</span></div>
        <nav className="side-nav" aria-label="班级工具">{nav.map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setActive(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
        <div className="license-card"><span className="live-dot"></span><div><b>{workspace.data.license?.tier ?? "基础版"}</b><small>有效期至 {workspace.expiresAt}</small></div></div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <div><p>{workspace.grade} · {workspace.term}</p><h1>{activeLabel}</h1></div>
          <div className="top-actions"><button className="ghost-btn" onClick={() => window.print()}>打印 / 导出</button><button className="save-btn" disabled={!dirty || saving} onClick={save}>{saving ? "正在保存…" : dirty ? "保存更改" : "已保存"}</button><span className="avatar">林</span></div>
        </header>
        {error && workspace && <div className="inline-alert" onClick={() => setError("")}>{error}<span>×</span></div>}
        {editable.includes(active) && <div className="edit-mode-banner"><b>✎ 当前页面可以编辑</b><span>电脑端适合批量整理，手机端可快速点选记录；修改后点右上角保存。</span></div>}
        <div className="page-content">
          {active === "dashboard" && <Dashboard data={workspace.data} open={setActive} />}
          {active === "students" && <Students data={workspace.data} update={updateData} />}
          {active === "homework" && <Homework data={workspace.data} update={updateData} />}
          {active === "points" && <Points data={workspace.data} update={updateData} />}
          {active === "rules" && <Rules />}
          {active === "growth" && <Growth data={workspace.data} />}
          {active === "weekly" && <Weekly data={workspace.data} />}
          {active === "schedule" && <Schedule data={workspace.data} update={updateData} />}
          {active === "seating" && <Seating data={workspace.data} update={updateData} />}
          {active === "duty" && <Duty data={workspace.data} update={updateData} />}
          {active === "cadres" && <Cadres data={workspace.data} update={updateData} />}
          {active === "records" && <Records data={workspace.data} update={updateData} />}
          {active === "scores" && <Scores data={workspace.data} update={updateData} />}
          {active === "reflection" && <Reflection data={workspace.data} />}
          {active === "comments" && <Comments data={workspace.data} />}
          {active === "certificates" && <Certificates data={workspace.data} />}
          {active === "license" && <LicensePanel workspace={workspace} />}
        </div>
      </main>
    </div>
  );
}

function ToolHeading({ kicker, title, text, action }: { kicker: string; title: string; text: string; action?: ReactNode }) {
  return <div className="tool-heading"><div><span>{kicker}</span><h2>{title}</h2><p>{text}</p></div>{action}</div>;
}

function Dashboard({ data, open }: { data: ClassroomData; open: (id: ModuleId) => void }) {
  const notDone = data.homeworkTasks?.[0] ? Object.values(data.homeworkTasks[0].statuses).filter((s) => s !== "已交" && s !== "已复查").length : 0;
  const attention = data.students.filter((s) => s.score < 80 || s.attendance !== "正常" || s.homework !== "已交");
  const top = [...data.students].sort((a, b) => b.points - a.points).slice(0, 3);
  return <>
    <section className="welcome"><div><span className="eyebrow">1分钟看懂班级状态</span><h2>导入一次名单，所有表都自动联动。</h2><p>作业、积分、座位、值日、家访、成绩、评语和奖状共用同一套学生数据。</p></div><div className="date-badge"><b>{new Date().getDate()}</b><span>今日 · 工作台</span></div></section>
    <section className="stat-row"><div><span>学生档案</span><b>{data.students.length}</b><small>已连接所有页面</small></div><div><span>今日待办</span><b>{notDone}</b><small className="warn">作业待处理</small></div><div><span>重点关注</span><b>{attention.length}</b><small>成绩/考勤/作业综合</small></div><div><span>本周记录</span><b>{data.records.length}</b><small className="good">可生成评语</small></div></section>
    <section className="daily-grid">
      <button onClick={() => open("students")}><b>名单底座</b><span>批量导入、编辑家长电话和备注</span></button>
      <button onClick={() => open("homework")}><b>作业闭环</b><span>未交、待订正、已复查一键切换</span></button>
      <button onClick={() => open("points")}><b>课堂加分</b><span>手机端快速给学生加扣分</span></button>
      <button onClick={() => open("records")}><b>家访谈心</b><span>按登记表结构保存沟通记录</span></button>
    </section>
    <div className="workbench-split">
      <section className="paper-card"><div className="section-title"><div><span>今日提醒</span><h2>建议优先处理</h2></div></div>{attention.slice(0, 5).map((s) => <div className="todo-line" key={s.id}><i>{s.name.slice(0,1)}</i><span><b>{s.name}</b><small>{s.score < 80 ? "成绩需跟进" : s.homework !== "已交" ? "作业需复查" : "考勤异常"}</small></span><button onClick={() => open("records")}>记录</button></div>)}</section>
      <section className="paper-card"><div className="section-title"><div><span>积分榜</span><h2>本周表扬候选</h2></div><button onClick={() => open("certificates")}>生成奖状 →</button></div>{top.map((s, index) => <div className="rank-line" key={s.id}><b>{index + 1}</b><span>{s.name}</span><em>{s.points}分</em></div>)}</section>
    </div>
  </>;
}

function Students({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [bulk, setBulk] = useState("张三 13800000001 备注可不填\n李四 13800000002\n王五 13800000003");
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const classes = data.rosterClasses?.length ? data.rosterClasses : [{ id: "class-1", name: "当前班级", grade: "", term: "", students: data.students }];
  const activeClassId = data.activeClassId ?? classes[0].id;
  const activeClass = classes.find((item) => item.id === activeClassId) ?? classes[0];
  const classStudents = activeClass.students;
  const keyword = filter.trim().toLocaleLowerCase("zh-CN");
  const shown = classStudents.filter((s) => `${s.name}${s.studentNo}${s.parentPhone}${s.note}${s.group}${s.seat}`.toLocaleLowerCase("zh-CN").includes(keyword));
  const groups = new Set(classStudents.map((s) => s.group)).size;
  const withPhone = classStudents.filter((s) => s.parentPhone?.trim()).length;
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = shown.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => setPage(1), [filter, activeClassId, pageSize]);

  function syncActiveClass(current: ClassroomData, nextStudents: Student[], patch?: Partial<RosterClass>): ClassroomData {
    const currentClasses = current.rosterClasses?.length ? current.rosterClasses : classes;
    const rosterClasses = currentClasses.map((item) => item.id === activeClassId ? { ...item, ...patch, students: nextStudents } : item);
    return { ...current, rosterClasses, activeClassId, students: nextStudents };
  }

  function makeStudent(row: string, index: number, baseIndex: number): Student {
    const parts = row.split(/[\s,，、\t]+/).filter(Boolean);
    const name = parts[0] ?? `学生${baseIndex + index + 1}`;
    return {
      id: `s${Date.now()}-${baseIndex}-${index}`,
      studentNo: `${baseIndex + index + 1}`.padStart(2, "0"),
      name,
      gender: index % 2 === 0 ? "女" : "男",
      group: Math.floor((baseIndex + index) / 4) + 1,
      seat: baseIndex + index + 1,
      points: 60,
      homework: "已交",
      attendance: "正常",
      score: 85,
      parentPhone: parts.find((part) => /^1\d{10}$/.test(part)) ?? "",
      note: parts.filter((part, partIndex) => partIndex > 0 && !/^1\d{10}$/.test(part)).join(" "),
    };
  }

  function edit(id: string, patch: Partial<Student>) {
    update((d) => syncActiveClass(d, classStudents.map((s) => s.id === id ? { ...s, ...patch } : s)));
  }
  function editClass(patch: Partial<RosterClass>) {
    update((d) => syncActiveClass(d, classStudents, patch));
    setMessage("班级信息已更新，记得保存。");
  }
  function switchClass(id: string) {
    const nextClass = classes.find((item) => item.id === id);
    if (!nextClass) return;
    update((d) => ({ ...d, activeClassId: id, students: nextClass.students }));
    setMessage(`已切换到 ${nextClass.name}。`);
  }
  function addClass() {
    const id = `class-${Date.now()}`;
    const newClass: RosterClass = { id, name: `新班级${classes.length + 1}`, grade: "", term: "", students: [] };
    update((d) => ({ ...d, rosterClasses: [...classes, newClass], activeClassId: id, students: [] }));
    setMessage("已创建新班级，可以开始导入名单。");
  }
  function rowsFromBulk() {
    const rows = bulk.split(/\n+/).map((row) => row.trim()).filter(Boolean);
    return rows;
  }
  function replaceNames() {
    const rows = rowsFromBulk();
    if (!rows.length) return setMessage("请先粘贴学生姓名。");
    const students = rows.map((row, index) => makeStudent(row, index, 0));
    update((d) => ({
      ...syncActiveClass(d, students),
      homeworkTasks: d.homeworkTasks?.map((task) => task.classId === activeClassId ? { ...task, statuses: Object.fromEntries(students.map((student) => [student.id, "已交"])) } : task),
      pointEvents: [],
      cadres: d.cadres?.filter((role) => students.some((student) => student.id === role.studentId)) ?? [],
    }));
    setMessage(`已导入 ${students.length} 名学生，并重新生成学号、座位和小组。`);
  }
  function appendNames() {
    const rows = rowsFromBulk();
    if (!rows.length) return setMessage("请先粘贴学生姓名。");
    update((d) => {
      const added = rows.map((row, index) => makeStudent(row, index, classStudents.length));
      const nextStudents = [...classStudents, ...added];
      return {
        ...syncActiveClass(d, nextStudents),
        homeworkTasks: d.homeworkTasks?.map((task) => task.classId === activeClassId ? { ...task, statuses: { ...task.statuses, ...Object.fromEntries(added.map((student) => [student.id, "已交"])) } } : task),
      };
    });
    setMessage(`已追加 ${rows.length} 名学生。`);
  }
  function addStudent() {
    update((d) => syncActiveClass(d, [...classStudents, makeStudent("新同学", 0, classStudents.length)]));
    setMessage("已新增 1 名学生，请直接编辑姓名和资料。");
  }
  function removeStudent(id: string) {
    update((d) => ({
      ...syncActiveClass(d, classStudents.filter((s) => s.id !== id).map((s, index) => ({ ...s, seat: index + 1, group: Math.floor(index / 4) + 1 }))),
      homeworkTasks: d.homeworkTasks?.map((task) => {
        if (task.classId !== activeClassId) return task;
        const statuses = { ...task.statuses };
        delete statuses[id];
        return { ...task, statuses };
      }),
      pointEvents: d.pointEvents?.filter((event) => event.studentId !== id),
      cadres: d.cadres?.filter((role) => role.studentId !== id),
    }));
    setMessage("已删除学生，并重新整理座位和小组。");
  }
  return <>
    <ToolHeading kicker="学生名单" title="按班级分别管理花名册" text="一个班主任可以管理多个班；每个班都有独立名单、分页、搜索、导入和手机卡片。" action={<button className="primary-small" onClick={addStudent}>新增学生</button>} />
    <section className="class-manager">
      <div className="class-tabs">
        {classes.map((item) => <button className={item.id === activeClassId ? "active" : ""} key={item.id} onClick={() => switchClass(item.id)}><b>{item.name}</b><span>{item.students.length}人</span></button>)}
        <button className="add-class" onClick={addClass}>＋ 新建班级</button>
      </div>
      <div className="class-fields">
        <label>班级名称<input value={activeClass.name} onChange={(e) => editClass({ name: e.target.value })} /></label>
        <label>年级<input value={activeClass.grade} onChange={(e) => editClass({ grade: e.target.value })} /></label>
        <label>学期<input value={activeClass.term} onChange={(e) => editClass({ term: e.target.value })} /></label>
      </div>
    </section>
    <section className="roster-summary">
      <div><span>当前班级</span><b>{classStudents.length}</b></div>
      <div><span>学习小组</span><b>{groups}</b></div>
      <div><span>已填电话</span><b>{withPhone}</b></div>
      <div><span>当前筛选</span><b>{shown.length}</b></div>
    </section>
    <section className="import-card roster-import"><div><h3>批量导入名单</h3><p>每行一个学生，格式建议：姓名 手机号 备注。可以“替换当前名单”，也可以“追加到末尾”。</p></div><textarea value={bulk} onChange={(e) => setBulk(e.target.value)} /><div className="import-actions"><button onClick={replaceNames}>替换当前名单</button><button className="soft-action" onClick={appendNames}>追加学生</button></div></section>
    {message && <div className="inline-alert roster-message" onClick={() => setMessage("")}>{message}<span>×</span></div>}
    <div className="roster-toolbar"><div className="resource-search compact-search"><span>⌕</span><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="搜索姓名、学号、电话、备注、小组或座位" /></div><select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}><option value={10}>每页10人</option><option value={20}>每页20人</option><option value={50}>每页50人</option></select><small>电脑端编辑表格；手机端编辑下方学生卡片。</small></div>
    <section className="editable-student-table roster-table">
      <div className="student-edit-head roster"><span>学号</span><span>姓名</span><span>性别</span><span>小组</span><span>座位</span><span>家长电话</span><span>备注</span><span>操作</span></div>
      {pageItems.map((s) => <div className="student-edit-line full" key={s.id}>
        <input value={s.studentNo ?? ""} onChange={(e) => edit(s.id, { studentNo: e.target.value })} />
        <input value={s.name} onChange={(e) => edit(s.id, { name: e.target.value })} />
        <select value={s.gender} onChange={(e) => edit(s.id, { gender: e.target.value as Student["gender"] })}><option>女</option><option>男</option></select>
        <input type="number" value={s.group} onChange={(e) => edit(s.id, { group: Number(e.target.value) || 1 })} />
        <input type="number" value={s.seat} onChange={(e) => edit(s.id, { seat: Number(e.target.value) || 1 })} />
        <input value={s.parentPhone ?? ""} onChange={(e) => edit(s.id, { parentPhone: e.target.value })} />
        <input value={s.note ?? ""} onChange={(e) => edit(s.id, { note: e.target.value })} />
        <button className="danger-small" onClick={() => removeStudent(s.id)}>删除</button>
      </div>)}
    </section>
    <section className="roster-mobile-list">
      {pageItems.map((s) => <article className="roster-mobile-card" key={s.id}>
        <header><i>{s.name.slice(0,1)}</i><div><input value={s.name} onChange={(e) => edit(s.id, { name: e.target.value })} /><span>学号 {s.studentNo || "未填"} · 第{s.group}组 · 座位{s.seat}</span></div></header>
        <div className="mobile-fields">
          <label>学号<input value={s.studentNo ?? ""} onChange={(e) => edit(s.id, { studentNo: e.target.value })} /></label>
          <label>性别<select value={s.gender} onChange={(e) => edit(s.id, { gender: e.target.value as Student["gender"] })}><option>女</option><option>男</option></select></label>
          <label>小组<input type="number" value={s.group} onChange={(e) => edit(s.id, { group: Number(e.target.value) || 1 })} /></label>
          <label>座位<input type="number" value={s.seat} onChange={(e) => edit(s.id, { seat: Number(e.target.value) || 1 })} /></label>
          <label className="wide">家长电话<input value={s.parentPhone ?? ""} onChange={(e) => edit(s.id, { parentPhone: e.target.value })} /></label>
          <label className="wide">备注<input value={s.note ?? ""} onChange={(e) => edit(s.id, { note: e.target.value })} /></label>
        </div>
        <button className="danger-small" onClick={() => removeStudent(s.id)}>删除这名学生</button>
      </article>)}
    </section>
    <div className="roster-pagination">
      <button disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button>
      <span>第 {safePage} / {totalPages} 页，显示 {pageItems.length} / {shown.length} 人</span>
      <button disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</button>
    </div>
  </>;
}

function Homework({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "class-1";
  const activeClass = data.rosterClasses?.find((item) => item.id === activeClassId);
  const tasks = (data.homeworkTasks ?? []).filter((item) => item.classId === activeClassId);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("全部月份");
  const [listPage, setListPage] = useState(1);
  const [studentPage, setStudentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"全部" | HomeworkTask["statuses"][string]>("全部");
  const [groupFilter, setGroupFilter] = useState("全部");
  const [studentKeyword, setStudentKeyword] = useState("");
  const [detailStatusFilter, setDetailStatusFilter] = useState<"全部" | HomeworkTask["statuses"][string]>("全部");
  const [detailGroupFilter, setDetailGroupFilter] = useState("全部");
  const [detailStudentKeyword, setDetailStudentKeyword] = useState("");
  const [taskKeyword, setTaskKeyword] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("全部");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const pageSize = 10;
  const studentPageSize = 20;
  const statusOptions: HomeworkTask["statuses"][string][] = ["已交", "未交", "待订正", "已复查"];
  const groups = Array.from(new Set(data.students.map((s) => s.group))).sort((a, b) => a - b);
  const subjects = Array.from(new Set(tasks.map((item) => item.subject).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
  const monthCounts = tasks.reduce((result, item) => {
    const month = item.date.slice(0, 7);
    result[month] = (result[month] ?? 0) + 1;
    return result;
  }, {} as Record<string, number>);
  const archiveMonths = Object.keys(monthCounts).sort((a, b) => b.localeCompare(a));
  const normalizedFrom = dateFrom && dateTo && dateFrom > dateTo ? dateTo : dateFrom;
  const normalizedTo = dateFrom && dateTo && dateFrom > dateTo ? dateFrom : dateTo;
  const filteredTasks = tasks.filter((item) => {
    const taskText = `${item.date}${item.subject}${item.title}`.toLocaleLowerCase("zh-CN");
    const matchTask = taskText.includes(taskKeyword.trim().toLocaleLowerCase("zh-CN"));
    const matchSubject = subjectFilter === "全部" || item.subject === subjectFilter;
    const matchMonth = selectedMonth === "全部月份" || item.date.startsWith(selectedMonth);
    const matchFrom = !normalizedFrom || item.date >= normalizedFrom;
    const matchTo = !normalizedTo || item.date <= normalizedTo;
    const matchStudent = !studentKeyword.trim() || data.students.some((student) => {
      const status = item.statuses[student.id] ?? student.homework;
      const text = `${student.name}${student.studentNo}${student.parentPhone}${student.note}${student.group}${status}`.toLocaleLowerCase("zh-CN");
      return text.includes(studentKeyword.trim().toLocaleLowerCase("zh-CN"));
    });
    const matchStatus = statusFilter === "全部" || data.students.some((student) => (item.statuses[student.id] ?? student.homework) === statusFilter);
    const matchGroup = groupFilter === "全部" || data.students.some((student) => student.group === Number(groupFilter));
    return matchTask && matchSubject && matchMonth && matchFrom && matchTo && matchStudent && matchStatus && matchGroup;
  }).sort((a, b) => b.date.localeCompare(a.date) || a.subject.localeCompare(b.subject, "zh-CN"));
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const safePage = Math.min(listPage, totalPages);
  const pagedTasks = filteredTasks.slice((safePage - 1) * pageSize, safePage * pageSize);
  const task = tasks.find((item) => item.id === selectedTaskId);
  const taskId = task?.id ?? "";
  const visibleStudents = data.students.filter((student) => {
    const status = task?.statuses[student.id] ?? student.homework;
    const matchStatus = detailStatusFilter === "全部" || status === detailStatusFilter;
    const matchGroup = detailGroupFilter === "全部" || student.group === Number(detailGroupFilter);
    const text = `${student.name}${student.studentNo}${student.parentPhone}${student.note}`.toLocaleLowerCase("zh-CN");
    return matchStatus && matchGroup && text.includes(detailStudentKeyword.trim().toLocaleLowerCase("zh-CN"));
  });
  const studentTotalPages = Math.max(1, Math.ceil(visibleStudents.length / studentPageSize));
  const safeStudentPage = Math.min(studentPage, studentTotalPages);
  const pagedStudents = visibleStudents.slice((safeStudentPage - 1) * studentPageSize, safeStudentPage * studentPageSize);
  const counts = statusOptions.reduce((acc, status) => ({ ...acc, [status]: data.students.filter((student) => (task?.statuses[student.id] ?? student.homework) === status).length }), {} as Record<HomeworkTask["statuses"][string], number>);
  const completionRate = data.students.length ? Math.round(((counts["已交"] + counts["已复查"]) / data.students.length) * 100) : 0;
  const todayTasks = tasks.filter((item) => item.date === today()).sort((a, b) => taskSummary(b).missing - taskSummary(a).missing);
  const attentionTasks = tasks.filter((item) => {
    const summary = taskSummary(item);
    return summary.missing + summary.fixing > 0;
  }).sort((a, b) => taskSummary(b).missing + taskSummary(b).fixing - taskSummary(a).missing - taskSummary(a).fixing).slice(0, 4);
  const unresolvedTasks = tasks.filter((item) => {
    const summary = taskSummary(item);
    return summary.missing + summary.fixing > 0;
  }).length;

  useEffect(() => {
    if (selectedTaskId && tasks.length && !tasks.some((item) => item.id === selectedTaskId)) {
      setSelectedTaskId("");
      setDetailOpen(false);
    }
  }, [selectedTaskId, tasks]);

  useEffect(() => setListPage(1), [taskKeyword, subjectFilter, selectedMonth, dateFrom, dateTo, studentKeyword, statusFilter, groupFilter, activeClassId]);
  useEffect(() => setStudentPage(1), [detailStudentKeyword, detailStatusFilter, detailGroupFilter, selectedTaskId]);

  function setTask(patch: Partial<HomeworkTask>) {
    if (!taskId) return;
    update((d) => ({ ...d, homeworkTasks: d.homeworkTasks?.map((item) => item.id === taskId ? { ...item, ...patch } : item) ?? [] }));
  }
  function addTask() {
    const newTask: HomeworkTask = {
      id: crypto.randomUUID(),
      classId: activeClassId,
      date: today(),
      subject: "数学",
      title: "新作业",
      statuses: Object.fromEntries(data.students.map((s) => [s.id, "已交"])),
    };
    update((d) => ({ ...d, homeworkTasks: [newTask, ...(d.homeworkTasks ?? [])] }));
    setSelectedTaskId(newTask.id);
    setDetailOpen(true);
    setDetailStudentKeyword("");
    setDetailStatusFilter("全部");
    setDetailGroupFilter("全部");
  }
  function deleteTask() {
    if (!taskId) return;
    update((d) => ({ ...d, homeworkTasks: (d.homeworkTasks ?? []).filter((item) => item.id !== taskId) }));
    setSelectedTaskId("");
    setDetailOpen(false);
  }
  function openTask(id: string) {
    setSelectedTaskId(id);
    setDetailOpen(true);
    setDetailStudentKeyword("");
    setDetailStatusFilter("全部");
    setDetailGroupFilter("全部");
  }
  function setStatus(student: Student, next: HomeworkTask["statuses"][string]) {
    if (!taskId) return;
    update((d) => ({
      ...d,
      students: d.students.map((s) => s.id === student.id ? { ...s, homework: next === "已复查" ? "已交" : next } : s),
      homeworkTasks: d.homeworkTasks?.map((item) => item.id === taskId ? { ...item, statuses: { ...item.statuses, [student.id]: next } } : item),
    }));
  }
  function toggle(student: Student) {
    if (!task) return;
    const current = task.statuses[student.id] ?? student.homework;
    const next = homeworkOrder[(homeworkOrder.indexOf(current) + 1) % homeworkOrder.length];
    setStatus(student, next);
  }
  function bulkSet(next: HomeworkTask["statuses"][string], scope: "全部学生" | "当前筛选") {
    if (!taskId) return;
    const target = scope === "全部学生" ? data.students : visibleStudents;
    const ids = new Set(target.map((student) => student.id));
    update((d) => ({
      ...d,
      students: d.students.map((s) => ids.has(s.id) ? { ...s, homework: next === "已复查" ? "已交" : next } : s),
      homeworkTasks: d.homeworkTasks?.map((item) => item.id === taskId ? { ...item, statuses: { ...item.statuses, ...Object.fromEntries(target.map((student) => [student.id, next])) } } : item),
    }));
  }
  function copyFollowList() {
    const list = data.students
      .filter((student) => {
        const status = task?.statuses[student.id] ?? student.homework;
        return status === "未交" || status === "待订正";
      })
      .map((student) => `${student.name}（第${student.group}组：${task?.statuses[student.id] ?? student.homework}）`)
      .join("\n");
    navigator.clipboard?.writeText(list || "今天没有需要跟进的作业。");
  }
  function resetTaskFilters() {
    setTaskKeyword("");
    setSubjectFilter("全部");
    setSelectedMonth("全部月份");
    setDateFrom("");
    setDateTo("");
    setStudentKeyword("");
    setStatusFilter("全部");
    setGroupFilter("全部");
  }
  function taskSummary(item: HomeworkTask) {
    const total = data.students.length || 1;
    const done = data.students.filter((student) => {
      const status = item.statuses[student.id] ?? student.homework;
      return status === "已交" || status === "已复查";
    }).length;
    const missing = data.students.filter((student) => (item.statuses[student.id] ?? student.homework) === "未交").length;
    const fixing = data.students.filter((student) => (item.statuses[student.id] ?? student.homework) === "待订正").length;
    return { done, missing, fixing, rate: Math.round(done / total * 100) };
  }

  if (detailOpen && task) return <>
    <ToolHeading
      kicker="作业详情"
      title={`${task.subject} · ${task.title}`}
      text={`${task.date}｜这里专门处理这一项作业，返回后仍停留在原来的归档和页码。`}
      action={<button className="primary-small homework-back" onClick={() => setDetailOpen(false)}>← 返回作业台账</button>}
    />
    <section className="homework-detail-page">
      <section className="task-editor rich-task-editor">
        <label>日期<input type="date" value={task.date} onChange={(e) => setTask({ date: e.target.value })} /></label>
        <label>科目<input value={task.subject} onChange={(e) => setTask({ subject: e.target.value })} /></label>
        <label>作业内容<input value={task.title} onChange={(e) => setTask({ title: e.target.value })} /></label>
        <button className="danger-small" onClick={deleteTask}>删除这项作业</button>
      </section>
      <section className="homework-stats">
        <div><span>完成率</span><b>{completionRate}%</b></div>
        <div><span>已交</span><b>{counts["已交"]}</b></div>
        <div><span>未交</span><b>{counts["未交"]}</b></div>
        <div><span>待订正</span><b>{counts["待订正"]}</b></div>
        <div><span>已复查</span><b>{counts["已复查"]}</b></div>
      </section>
      <section className="homework-detail-tools">
        <div className="resource-search compact-search"><span>⌕</span><input value={detailStudentKeyword} onChange={(e) => setDetailStudentKeyword(e.target.value)} placeholder="搜索学生姓名、学号或备注" /></div>
        <select value={detailStatusFilter} onChange={(e) => setDetailStatusFilter(e.target.value as typeof detailStatusFilter)}><option>全部</option>{statusOptions.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={detailGroupFilter} onChange={(e) => setDetailGroupFilter(e.target.value)}><option>全部</option>{groups.map((group) => <option value={group} key={group}>第{group}组</option>)}</select>
      </section>
      <section className="homework-bulk">
        <span>当前筛选 {visibleStudents.length} 人</span>
        <button onClick={() => bulkSet("已交", "当前筛选")}>设为已交</button>
        <button onClick={() => bulkSet("待订正", "当前筛选")}>设为待订正</button>
        <button onClick={() => bulkSet("已复查", "当前筛选")}>设为已复查</button>
        <button onClick={copyFollowList}>复制待跟进名单</button>
      </section>
      <section className="homework-table">
        <div className="homework-head"><span>学生</span><span>小组</span><span>状态</span><span>快速操作</span><span>备注</span></div>
        {pagedStudents.map((student) => {
          const status = task.statuses[student.id] ?? student.homework;
          return <div className="homework-line" key={student.id}><b><i>{student.name.slice(0,1)}</i>{student.name}</b><span>第{student.group}组</span><em className={`homework-pill ${status}`}>{status}</em><div>{statusOptions.map((next) => <button className={next === status ? "active" : ""} key={next} onClick={() => setStatus(student, next)}>{next}</button>)}</div><small>{student.note || "无备注"}</small></div>;
        })}
      </section>
      <section className="student-card-grid homework-mobile-grid">{pagedStudents.map((student) => { const status = task.statuses[student.id] ?? student.homework; return <button className={`student-status-card ${status}`} key={student.id} onClick={() => toggle(student)}><i>{student.name.slice(0,1)}</i><b>{student.name}</b><span>{status}</span><small>第{student.group}组 · 点击切换</small></button>; })}</section>
      <div className="homework-pagination">
        <button disabled={safeStudentPage <= 1} onClick={() => setStudentPage((page) => Math.max(1, page - 1))}>上一页</button>
        <span>学生第 {safeStudentPage} / {studentTotalPages} 页，共 {visibleStudents.length} 人</span>
        <button disabled={safeStudentPage >= studentTotalPages} onClick={() => setStudentPage((page) => Math.min(studentTotalPages, page + 1))}>下一页</button>
      </div>
    </section>
  </>;

  return <>
    <ToolHeading kicker="作业追踪" title="每天记录，按月归档，需要时再查" text={`${activeClass?.name ?? "当前班级"}的作业独立保存。首页每页只显示 10 项，作业再多也不会变成长页面。`} action={<button className="primary-small" onClick={addTask}>＋ 新增作业</button>} />
    <section className="homework-overview">
      <article><span>今日新增</span><b>{todayTasks.length}</b><p>今天布置的作业</p></article>
      <article><span>仍需跟进</span><b>{unresolvedTasks}</b><p>存在未交或待订正的作业</p></article>
      <article><span>本班累计</span><b>{tasks.length}</b><p>全部历史作业</p></article>
      <article><span>归档月份</span><b>{archiveMonths.length}</b><p>按月份快速定位</p></article>
    </section>
    <section className="homework-today-board">
      <header><div><b>今天</b><span>{todayTasks.length ? `共 ${todayTasks.length} 项，只显示今天，不混入历史作业` : "今天还没有记录作业"}</span></div><button onClick={addTask}>新增今日作业</button></header>
      <div>
        {(todayTasks.length ? todayTasks.slice(0, 4) : attentionTasks).map((item) => {
          const summary = taskSummary(item);
          return <button key={item.id} onClick={() => openTask(item.id)}><span>{item.date}</span><b>{item.subject} · {item.title}</b><em>{summary.missing ? `未交 ${summary.missing}` : "无未交"}</em><small>待订正 {summary.fixing} · 完成率 {summary.rate}%</small></button>;
        })}
        {!todayTasks.length && !attentionTasks.length && <div className="empty-result"><b>暂无待处理作业</b><span>点“新增今日作业”开始记录。</span></div>}
      </div>
    </section>
    <section className="homework-ledger">
      <header className="homework-ledger-head"><div><b>历史作业台账</b><span>按月归档、按条件查找，每页固定 10 项</span></div><button onClick={resetTaskFilters}>重置查询</button></header>
      <div className="homework-primary-filters">
        <label className="wide">搜索作业内容<input value={taskKeyword} onChange={(e) => setTaskKeyword(e.target.value)} placeholder="输入学科、页码、练习名称等" /></label>
        <label>归档月份<select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}><option>全部月份</option>{archiveMonths.map((month) => <option key={month} value={month}>{month.replace("-", "年")}月（{monthCounts[month]}项）</option>)}</select></label>
        <label>学科<select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}><option value="全部">全部学科</option>{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
        <button className="advanced-toggle" onClick={() => setAdvancedOpen((open) => !open)}>{advancedOpen ? "收起高级查询" : "更多查询条件"}</button>
      </div>
      {advancedOpen && <div className="homework-advanced-filters">
        <label>开始日期<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
        <label>结束日期<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
        <label>查某个学生<input value={studentKeyword} onChange={(e) => setStudentKeyword(e.target.value)} placeholder="姓名或学号" /></label>
        <label>该生状态<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}><option>全部</option>{statusOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>学生小组<select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}><option>全部</option>{groups.map((group) => <option value={group} key={group}>第{group}组</option>)}</select></label>
      </div>}
      {dateFrom && dateTo && dateFrom > dateTo && <p className="homework-hint">日期顺序已自动调整为 {normalizedFrom} 至 {normalizedTo}。</p>}
      <div className="homework-result-bar"><b>{selectedMonth === "全部月份" ? "全部归档" : `${selectedMonth.replace("-", "年")}月`}</b><span>找到 {filteredTasks.length} 项 · 当前第 {safePage} / {totalPages} 页</span></div>
      {filteredTasks.length === 0 && <div className="empty-result"><b>没有找到符合条件的作业</b><span>建议先清空条件，或新增一项作业。</span></div>}
      <div className="homework-clean-list">
      {pagedTasks.map((item) => {
        const summary = taskSummary(item);
        return <article key={item.id}>
          <time>{item.date}</time>
          <div><b>{item.subject} · {item.title}</b><span>完成率 {summary.rate}% · 已交/复查 {summary.done} 人 · 未交 {summary.missing} 人 · 待订正 {summary.fixing} 人</span></div>
          <button onClick={() => openTask(item.id)}>处理这项</button>
        </article>;
      })}
      </div>
      <div className="homework-pagination">
        <button disabled={safePage <= 1} onClick={() => setListPage(1)}>首页</button>
        <button disabled={safePage <= 1} onClick={() => setListPage((page) => Math.max(1, page - 1))}>上一页</button>
        <span>第 {safePage} / {totalPages} 页，每页 10 项</span>
        <button disabled={safePage >= totalPages} onClick={() => setListPage((page) => Math.min(totalPages, page + 1))}>下一页</button>
        <button disabled={safePage >= totalPages} onClick={() => setListPage(totalPages)}>末页</button>
      </div>
    </section>
  </>;
}

function Points({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [scene, setScene] = useState("课堂");
  const [reason, setReason] = useState("主动回答问题");
  function add(student: Student, delta: number) {
    const event: PointEvent = { id: crypto.randomUUID(), studentId: student.id, scene, reason, delta, date: "刚刚" };
    update((d) => ({ ...d, students: d.students.map((s) => s.id === student.id ? { ...s, points: s.points + delta } : s), pointEvents: [event, ...(d.pointEvents ?? [])] }));
  }
  const ranked = [...data.students].sort((a, b) => b.points - a.points);
  return <><ToolHeading kicker="积分评价" title="课堂上可以直接点名加扣分" text="积分事件会进入成长档案、周报、评语和奖状候选。" /><section className="quick-scorebar"><select value={scene} onChange={(e)=>setScene(e.target.value)}>{["作业","课堂","纪律","卫生","集体","礼仪"].map(s=><option key={s}>{s}</option>)}</select><input value={reason} onChange={(e)=>setReason(e.target.value)} /><span>选择场景和原因后，点学生的 + 或 -</span></section><div className="points-layout"><div className="points-list rich">{ranked.map((s, i) => <div key={s.id}><span>{i + 1}</span><b>{s.name}</b><small>第{s.group}组</small><em>{s.points}</em><button onClick={() => add(s, -1)}>−</button><button onClick={() => add(s, 1)}>＋</button></div>)}</div><div className="event-feed"><h3>最近积分记录</h3>{(data.pointEvents ?? []).slice(0, 8).map((e) => <div key={e.id}><b className={e.delta > 0 ? "good-text" : "bad-text"}>{e.delta > 0 ? `+${e.delta}` : e.delta}</b><span>{data.students.find(s=>s.id===e.studentId)?.name} · {e.scene}</span><small>{e.reason}</small></div>)}</div></div></>;
}

function Rules() {
  const [current, setCurrent] = useState<keyof typeof ruleSets>("小学温和版");
  return <><ToolHeading kicker="积分规则" title="从资料里的量化考核细则提炼成可选规则" text="先提供三套常用规则，后续可做成老师自己的规则库。" /><div className="segmented">{Object.keys(ruleSets).map((name) => <button className={current === name ? "active" : ""} key={name} onClick={() => setCurrent(name as keyof typeof ruleSets)}>{name}</button>)}</div><section className="rules-grid wide">{ruleSets[current].map(([scene, plus, minus, owner]) => <article key={scene}><h3>{scene}</h3><p><b>加分：</b>{plus}</p><p><b>扣分：</b>{minus}</p><span>{owner}记录</span></article>)}</section></>;
}

function Growth({ data }: { data: ClassroomData }) {
  const [id, setId] = useState(data.students[0]?.id ?? "");
  const student = data.students.find(s => s.id === id) ?? data.students[0];
  if (!student) return null;
  const records = data.records.filter((r) => r.student === student.name);
  const events = (data.pointEvents ?? []).filter((e) => e.studentId === student.id);
  return <><ToolHeading kicker="成长档案" title="每个学生都有一张自动汇总的成长卡" text="作业、积分、成绩、沟通、表扬和问题记录会沉淀到这里。" /><div className="profile-layout"><aside className="student-picker">{data.students.map(s=><button className={s.id===id?"selected":""} key={s.id} onClick={()=>setId(s.id)}><i>{s.name.slice(0,1)}</i><span>{s.name}<small>{s.score}分 · {s.points}积分</small></span></button>)}</aside><section className="profile-card"><h2>{student.name}</h2><div className="profile-stats"><span>学号<b>{student.studentNo}</b></span><span>小组<b>{student.group}</b></span><span>成绩<b>{student.score}</b></span><span>积分<b>{student.points}</b></span></div><h3>成长证据</h3>{records.length === 0 && events.length === 0 && <p className="muted-text">暂无记录，去“家校沟通”或“积分评价”添加。</p>}{records.map(r=><p key={r.id}>【{r.type}】{r.content}</p>)}{events.map(e=><p key={e.id}>【{e.scene}】{e.reason}（{e.delta > 0 ? "+" : ""}{e.delta}）</p>)}</section></div></>;
}

function Weekly({ data }: { data: ClassroomData }) {
  const improved = [...data.students].filter(s => s.points >= 16).slice(0, 6);
  const follow = data.students.filter(s => s.score < 80 || s.homework !== "已交").slice(0, 6);
  return <><ToolHeading kicker="班级周报" title="把本周记录整理成可发给自己或家长的摘要" text="优秀、进步、待跟进、下周重点都会自动生成。" /><section className="weekly-grid"><article><h3>本周优秀</h3>{improved.map(s=><p key={s.id}>{s.name}：积分 {s.points}，建议表扬。</p>)}</article><article><h3>待跟进</h3>{follow.map(s=><p key={s.id}>{s.name}：{s.score < 80 ? "成绩需帮扶" : "作业需复查"}。</p>)}</article><article><h3>下周计划</h3>{(data.weeklyPlan ?? []).map(p=><p key={p.day}>{p.day}：{p.focus} · {p.event}</p>)}</article></section></>;
}

function Schedule({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  function changeCourse(day: number, period: number, value: string) {
    update((current) => ({ ...current, courses: current.courses.map((row, rowIndex) => rowIndex === day ? row.map((course, colIndex) => colIndex === period ? value : course) : row) }));
  }
  return <><ToolHeading kicker="课程与日程" title="课程表和周计划共用一页" text="电脑端显示完整课程表，手机端横向滑动查看。" /><div className="paper-card"><div className="schedule-grid"><div className="schedule-corner">节次</div>{days.map((d) => <b key={d}>{d}</b>)}{[0,1,2,3,4].map((period) => <div className="schedule-row" key={period}><span>第{period + 1}节</span>{days.map((_, day) => <div className="editable-cell" key={day}><input value={data.courses[day]?.[period] ?? ""} onChange={(event) => changeCourse(day, period, event.target.value)} /></div>)}</div>)}</div></div><section className="weekly-grid slim">{(data.weeklyPlan ?? []).map(item => <article key={item.day}><h3>{item.day}</h3><p>{item.focus}</p><small>{item.event}</small></article>)}</section></>;
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
  return <><ToolHeading kicker="座位与分组" title="自动排座，也能手动换座" text="参考座位表模板，保留讲台/黑板方位；手机端用列表式座位卡操作。" action={<button className="primary-small" onClick={shuffle}>重新排座</button>} /><div className="seat-instruction"><b>{selected ? "已选择第一名学生" : "手动换座"}</b><span>{selected ? "再点另一名学生即可互换" : "先点一名学生，再点另一名学生"}</span></div><div className="seating-wrap"><div className="blackboard">黑 板</div><div className="seat-grid">{[...data.students].sort((a, b) => a.seat - b.seat).map((s) => <button className={selected === s.id ? "selected" : ""} onClick={() => choose(s)} key={s.id}><span>{s.name}</span><small>第{s.group}组 · 座{s.seat}</small><em>{s.note || "点击换座"}</em></button>)}</div><div className="teacher-desk">讲台</div></div></>;
}

function Duty({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [customJob, setCustomJob] = useState("图书角");
  const jobs = ["地面", "黑板", "讲台", "走廊", "门窗", customJob].filter(Boolean);
  const maxGroup = Math.max(1, ...data.students.map((s) => s.group));
  const groups = Array.from({ length: maxGroup }, (_, group) => data.students.filter((s) => s.group === group + 1));
  return <><ToolHeading kicker="值日与岗位" title="按小组轮换，把岗位落到人" text="参考值日表和岗位职责表，可加入自定义岗位。" action={<button className="primary-small" onClick={() => update((d) => ({ ...d, dutyOffset: (d.dutyOffset + 1) % maxGroup }))}>轮换一周</button>} /><section className="quick-scorebar"><input value={customJob} onChange={(e)=>setCustomJob(e.target.value)} /><span>自定义岗位名称</span></section><div className="duty-board">{days.map((day, i) => { const groupIndex = (i + data.dutyOffset) % groups.length; const group = groups[groupIndex] ?? []; return <article key={day}><header><span>{day}</span><b>第{groupIndex + 1}组</b></header>{jobs.map((job, j) => <div key={job}><span>{job}</span><b>{group[j % Math.max(1, group.length)]?.name ?? "待安排"}</b></div>)}</article>; })}</div></>;
}

function Cadres({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  function edit(id: string, patch: Partial<CadreRole>) {
    update((d) => ({ ...d, cadres: (d.cadres ?? []).map((c) => c.id === id ? { ...c, ...patch } : c) }));
  }
  return <><ToolHeading kicker="班干部" title="职位、学生、职责、聘任书连在一起" text="参考班干部职责表和班委聘任书，先完成可编辑任命和预览。" action={<button className="primary-small" onClick={() => update((d) => ({ ...d, cadres: [...(d.cadres ?? []), { id: crypto.randomUUID(), role: "新岗位", studentId: d.students[0]?.id ?? "", duty: "填写岗位职责" }] }))}>新增岗位</button>} /><section className="cadre-grid">{(data.cadres ?? []).map((role) => <article key={role.id}><input value={role.role} onChange={(e)=>edit(role.id,{role:e.target.value})} /><select value={role.studentId} onChange={(e)=>edit(role.id,{studentId:e.target.value})}>{data.students.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select><textarea value={role.duty} onChange={(e)=>edit(role.id,{duty:e.target.value})} /><div className="appointment"><b>班委聘任书</b><p>兹聘任 {data.students.find(s=>s.id===role.studentId)?.name || "某同学"} 为本班 {role.role}，负责：{role.duty}</p></div></article>)}</section></>;
}

function Records({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [student, setStudent] = useState(data.students[0]?.name ?? "");
  const [type, setType] = useState("家访登记");
  const [purpose, setPurpose] = useState("了解学生在家学习与作息情况");
  const [home, setHome] = useState("家长工作较忙，孩子作业需要更多陪伴和提醒。");
  const [content, setContent] = useState("反馈学生在校表现，约定本周先从按时完成作业开始。");
  const [opinion, setOpinion] = useState("家长愿意配合，周五再次反馈。");
  function add() {
    const text = `目的：${purpose}｜家庭情况：${home}｜沟通内容：${content}｜家长意见：${opinion}`;
    update((d) => ({ ...d, records: [{ id: crypto.randomUUID(), student, type, content: text, date: "刚刚" }, ...d.records] }));
  }
  return <><ToolHeading kicker="家校沟通" title="家访、谈心、作业跟进都按结构记录" text="参考家访登记表，补齐目的、家庭情况、沟通内容、家长意见和下次跟进。" /><div className="visit-form"><select value={student} onChange={(e)=>setStudent(e.target.value)}>{data.students.map(s=><option key={s.id}>{s.name}</option>)}</select><select value={type} onChange={(e)=>setType(e.target.value)}>{["家访登记","谈心记录","作业跟进","纪律表现","表扬记录"].map(t=><option key={t}>{t}</option>)}</select><input value={purpose} onChange={(e)=>setPurpose(e.target.value)} /><textarea value={home} onChange={(e)=>setHome(e.target.value)} /><textarea value={content} onChange={(e)=>setContent(e.target.value)} /><textarea value={opinion} onChange={(e)=>setOpinion(e.target.value)} /><button onClick={add}>保存到成长档案</button></div><div className="timeline">{data.records.map((r) => <article key={r.id}><i>{r.student.slice(0,1)}</i><div><header><b>{r.student}</b><span>{r.type}</span><time>{r.date}</time></header><p>{r.content}</p></div></article>)}</div></>;
}

function Scores({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const average = Math.round(data.students.reduce((sum, s) => sum + s.score, 0) / Math.max(1, data.students.length));
  const sorted = [...data.students].sort((a,b) => a.score - b.score);
  return <><ToolHeading kicker="成绩分析" title="导入或编辑成绩后，自动找出重点学生" text="先支持逐个编辑和自动分析，后续再接 Excel 批量导入。" /><div className="score-summary"><div><span>平均分</span><b>{average}</b><small>当前考试</small></div><div><span>优秀率</span><b>{Math.round(data.students.filter((s) => s.score >= 90).length / Math.max(1, data.students.length) * 100)}%</b><small>90分以上</small></div><div><span>临界/低分</span><b>{data.students.filter((s) => s.score < 80).length}</b><small>优先帮扶</small></div></div><section className="editable-student-table"><div className="student-edit-head score"><span>学生</span><span>当前分数</span><span>帮扶建议</span></div>{sorted.map(s=><div className="student-edit-line score" key={s.id}><b>{s.name}</b><input type="number" value={s.score} onChange={(e)=>update(d=>({...d,students:d.students.map(item=>item.id===s.id?{...item,score:Number(e.target.value)||0}:item)}))} /><span>{s.score < 80 ? "安排谈心+错题复盘" : s.score < 90 ? "关注临界突破" : "推荐表扬"}</span></div>)}</section></>;
}

function Reflection({ data }: { data: ClassroomData }) {
  const [id, setId] = useState(data.students[0]?.id ?? "");
  const student = data.students.find(s=>s.id===id) ?? data.students[0];
  if (!student) return null;
  const checks = ["是否完成课前预习和课后巩固", "作业是否第一时间独立完成", "错题是否真正订正到会做", "考试时是否审题清楚、书写规范", "下一次要挑战的目标是谁"];
  return <><ToolHeading kicker="考试反思" title="把考试后反思表变成学生个人复盘单" text="错因、目标、写给家人和班主任的话都能打印。" /><div className="reflection-layout"><aside className="student-picker">{data.students.map(s=><button className={s.id===id?"selected":""} key={s.id} onClick={()=>setId(s.id)}><i>{s.name.slice(0,1)}</i><span>{s.name}<small>{s.score}分</small></span></button>)}</aside><section className="paper-card"><h2>{student.name} 的考试反思</h2>{checks.map(item=><label className="check-line" key={item}><input type="checkbox" />{item}</label>)}<textarea className="reflection-text" defaultValue={`本次考试我的主要问题是：\n下一步改进措施：\n写给家人的话：\n写给班主任的话：`} /></section></div></>;
}

function Comments({ data }: { data: ClassroomData }) {
  const [id, setId] = useState(data.students[0]?.id ?? "");
  const student = data.students.find(s=>s.id===id) ?? data.students[0];
  const evidence = data.records.filter(r=>r.student===student?.name);
  const events = (data.pointEvents ?? []).filter(e=>e.studentId===student?.id);
  const comment = useMemo(() => student ? `${student.name}同学本学期整体表现${student.score >= 90 ? "稳定优秀，学习主动性较强" : student.score >= 80 ? "较为踏实，能够按要求完成多数学习任务" : "仍需要老师和家长共同陪伴"}。${events[0] ? `在日常表现中，${events[0].reason}，体现出持续进步的可能。` : ""}${evidence[0] ? `老师也关注到：${evidence[0].content}` : "希望你继续积累每一次小进步。"}下学期建议继续在作业习惯、课堂表达和自我管理上设定更清晰目标。` : "", [student, evidence, events]);
  const [draft, setDraft] = useState(comment);
  useEffect(() => setDraft(comment), [comment]);
  if (!student) return null;
  return <><ToolHeading kicker="期末评语" title="结合成绩、积分、作业和成长记录生成草稿" text="不是空泛套话，能引用平时真实证据。" /><div className="comment-layout"><div className="student-picker">{data.students.map(s=><button className={s.id===id?"selected":""} onClick={()=>setId(s.id)} key={s.id}><i>{s.name.slice(0,1)}</i><span>{s.name}<small>{data.records.filter(r=>r.student===s.name).length}条证据</small></span></button>)}</div><div className="comment-paper"><div className="comment-head"><span>✎ 可编辑评语草稿</span><button onClick={() => setDraft(comment)}>重新生成</button></div><h2>{student.name}</h2><textarea value={draft} onChange={(event) => setDraft(event.target.value)} /><div className="evidence-row"><span>引用依据</span><em>成绩 {student.score}</em><em>积分 {student.points}</em><em>{student.homework}</em></div><button className="primary-small" onClick={() => navigator.clipboard?.writeText(draft)}>复制评语</button></div></div></>;
}

function Certificates({ data }: { data: ClassroomData }) {
  const recommended = [...data.students].sort((a,b)=>b.points-a.points);
  const [id,setId]=useState(recommended[0]?.id??"");
  const [award,setAward]=useState("进步之星");
  const student=data.students.find(s=>s.id===id)??data.students[0];
  if (!student) return null;
  return <><ToolHeading kicker="奖状生成" title="按积分和成长记录推荐奖项，支持单个预览和打印" text="批量导出后续接入；当前可逐个生成、打印或截图。" /><section className="award-suggestions">{recommended.slice(0,6).map(s=><button key={s.id} onClick={()=>setId(s.id)}><b>{s.name}</b><span>{s.points}积分</span><em>{s.points > 18 ? "三好学生" : "进步之星"}</em></button>)}</section><div className="certificate-layout"><div className="certificate-controls"><label>获奖学生<select value={id} onChange={e=>setId(e.target.value)}>{data.students.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>荣誉称号<select value={award} onChange={e=>setAward(e.target.value)}>{awardOptions.map(a=><option key={a}>{a}</option>)}</select></label><label>模板样式<div className="template-picks">{["金色经典","低年级可爱","简洁红章","清新校园"].map((n,i)=><button className={i===0?"selected":""} key={n}>{n}</button>)}</div></label><button className="primary-small" onClick={()=>window.print()}>打印当前奖状</button></div><div className="certificate"><span>荣 誉 证 书</span><p><b>{student.name}</b> 同学：</p><p>在本学期班级学习与生活中表现优秀，荣获</p><h2>“{award}”</h2><p>特发此证，以资鼓励。</p><footer><span>向阳小学三年级2班</span><span>2026年7月</span></footer></div></div></>;
}

function LicensePanel({ workspace }: { workspace: Workspace }) {
  const exports = ["学生名单", "作业登记表", "积分表", "座位表", "值日表", "家访记录", "期末评语", "奖状"];
  return <><ToolHeading kicker="权限与导出" title="用于后续小红书售卖的专属链接能力" text="当前先展示授权状态和导出入口；后台创建独立付费链接后续接入管理页。" /><section className="license-dashboard"><article><span>当前链接</span><b>{workspace.className}</b><p>有效期至 {workspace.expiresAt}</p></article><article><span>版本</span><b>{workspace.data.license?.tier ?? "基础版"}</b><p>{workspace.data.license?.canExport ? "允许打印/导出" : "仅允许查看"}</p></article><article><span>公开演示</span><b>可用于小红书</b><p>购买后生成独立班级链接</p></article></section><section className="export-grid">{exports.map(item=><button key={item} onClick={()=>window.print()}><b>{item}</b><span>打印 / 导出</span></button>)}</section></>;
}
