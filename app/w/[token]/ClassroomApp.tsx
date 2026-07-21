"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CadreRole, ClassroomData, GrowthEvidence, HomeworkTask, PointEvent, PointRule, RosterClass, SeatingConfig, Student } from "@/lib/classroom";

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

const defaultPointRules: PointRule[] = [
  { id: "pr-class-speak", scene: "课堂", title: "主动表达", reason: "主动回答问题并说清思路", delta: 1, owner: "学习委员", enabled: true, level: "温和版", detail: "来自课堂提问、积极回答、精彩表现等资料场景。" },
  { id: "pr-class-disrupt", scene: "课堂", title: "扰乱课堂", reason: "上课讲话、走神或影响同学听课", delta: -1, owner: "纪律委员", enabled: true, level: "温和版", detail: "轻微课堂问题先提醒再记录，连续出现再转入沟通。" },
  { id: "pr-homework-good", scene: "作业", title: "优秀作业", reason: "作业完成认真，订正及时", delta: 1, owner: "课代表", enabled: true, level: "小学版", detail: "对应优秀作业、书写认真、按时订正。" },
  { id: "pr-homework-missing", scene: "作业", title: "未交或拖拉", reason: "作业未按时提交、迟交或订正拖拉", delta: -2, owner: "课代表", enabled: true, level: "严格版", detail: "资料中常见扣分项，后续应同步到作业追踪。" },
  { id: "pr-discipline-routine", scene: "纪律", title: "常规达标", reason: "早读、两操、路队或集会表现稳定", delta: 1, owner: "值日班长", enabled: true, level: "小学版", detail: "对应常规、三操、早读、路队等每日记录。" },
  { id: "pr-discipline-conflict", scene: "纪律", title: "冲突顶撞", reason: "顶撞老师、班干部或与同学发生冲突", delta: -3, owner: "班长", enabled: true, level: "严格版", detail: "严重情况可按规则调整到 -5 至 -10，并补充谈心记录。" },
  { id: "pr-health-duty", scene: "卫生", title: "主动值日", reason: "主动整理卫生角或完成值日岗位", delta: 1, owner: "劳动委员", enabled: true, level: "小学版", detail: "来自卫生、值日、承包区达标等资料。" },
  { id: "pr-health-miss", scene: "卫生", title: "卫生未达标", reason: "值日不到位或座位周边不整洁", delta: -1, owner: "劳动委员", enabled: true, level: "温和版", detail: "适合轻量记录，避免只惩罚不补救。" },
  { id: "pr-group-activity", scene: "集体活动", title: "集体贡献", reason: "代表班级参与活动或主动服务集体", delta: 2, owner: "班长", enabled: true, level: "初中版", detail: "参考集体活动、黑板报、比赛、班级服务。" },
  { id: "pr-group-award", scene: "集体活动", title: "竞赛获奖", reason: "代表班级参赛获奖或被学校表扬", delta: 5, owner: "班长", enabled: true, level: "严格版", detail: "资料中常见 3-8 分或更高奖励，可按学校情况调整。" },
  { id: "pr-manner-help", scene: "文明礼仪", title: "文明互助", reason: "帮助同学，文明沟通有示范作用", delta: 1, owner: "班长", enabled: true, level: "小学版", detail: "可沉淀为文明礼仪之星、期末评语证据。" },
  { id: "pr-cadre-duty", scene: "班干部", title: "履职认真", reason: "班干部或课代表认真完成职责", delta: 2, owner: "班主任", enabled: true, level: "自定义", detail: "参考班干部每周履职奖励，适合周五汇总。" },
];

const ruleSets = {
  小学温和版: {
    focus: "少扣多奖，适合低中年级先建立正向习惯。",
    levels: ["小学版", "温和版"],
    rhythm: ["每天只记录关键 3-5 次", "加分理由尽量具体", "扣分后给补救机会"],
  },
  初中严格版: {
    focus: "边界清楚，适合作业、纪律和课堂秩序需要快速立规的班级。",
    levels: ["初中版", "严格版"],
    rhythm: ["严重事件直接记录", "责任人分工明确", "连续扣分转入沟通跟进"],
  },
  班级精细版: {
    focus: "按责任人和场景拆细，适合已经有班干部协作记录的班级。",
    levels: ["小学版", "初中版", "温和版", "严格版", "自定义"],
    rhythm: ["课代表记作业", "劳动委员记卫生", "班长和值日班长看常规"],
  },
};

const awardOptions = ["进步之星", "文明礼仪之星", "优秀班干部", "阅读小明星", "劳动小能手", "三好学生", "作业标兵", "课堂表达之星"];
const homeworkOrder: HomeworkTask["statuses"][string][] = ["已交", "未交", "待订正", "已复查"];
const days = ["星期一", "星期二", "星期三", "星期四", "星期五"];

function today() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function normalizeData(data: ClassroomData): ClassroomData {
  const fallbackStudents = data.students.map((student, index) => ({
    studentNo: student.studentNo ?? `${index + 1}`.padStart(2, "0"),
    parentPhone: student.parentPhone ?? "",
    note: student.note ?? "",
    ...student,
    avoidWith: student.avoidWith ?? "",
    seatNeed: student.seatNeed ?? "无",
    seatFixed: student.seatFixed ?? false,
    groupLeader: student.groupLeader ?? false,
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
        avoidWith: student.avoidWith ?? "",
        seatNeed: student.seatNeed ?? "无",
        seatFixed: student.seatFixed ?? false,
        groupLeader: student.groupLeader ?? false,
      })),
    }))
    : [{ id: "class-1", name: "当前班级", grade: "", term: "", students: fallbackStudents }];
  const activeClassId = data.activeClassId && rosterClasses.some((item) => item.id === data.activeClassId) ? data.activeClassId : rosterClasses[0].id;
  const students = rosterClasses.find((item) => item.id === activeClassId)?.students ?? fallbackStudents;
  const columns = Math.max(2, Math.min(10, data.seatingConfig?.columns ?? 6));
  const rows = Math.max(1, Math.min(12, Math.max(data.seatingConfig?.rows ?? 6, Math.ceil(students.length / columns))));
  const existingGroupCount = Math.max(1, ...students.map((student) => student.group || 1));
  const groupCount = Math.max(1, Math.min(12, data.seatingConfig?.groupCount ?? existingGroupCount));
  const aisleAfter = (data.seatingConfig?.aisleAfter ?? Array.from({ length: Math.floor((columns - 1) / 2) }, (_, index) => (index + 1) * 2))
    .filter((column, index, values) => column > 0 && column < columns && values.indexOf(column) === index)
    .sort((a, b) => a - b);
  const firstTask: HomeworkTask = {
    id: "h-default",
    classId: activeClassId,
    followUpStudentIds: [],
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
    homeworkTasks: data.homeworkTasks?.length ? data.homeworkTasks.map((task) => ({ ...task, classId: task.classId ?? rosterClasses[0].id, followUpStudentIds: task.followUpStudentIds ?? [] })) : [firstTask],
    pointEvents: data.pointEvents ?? [],
    growthEvidence: data.growthEvidence ?? [],
    pointRules: data.pointRules?.length ? data.pointRules.map((rule) => ({ ...rule, enabled: rule.enabled !== false })) : defaultPointRules,
    cadres: data.cadres?.length ? data.cadres : [
      { id: "c1", role: "班长", studentId: students[0]?.id ?? "", duty: "协助班主任管理班级常规。" },
      { id: "c2", role: "学习委员", studentId: students[1]?.id ?? "", duty: "组织早读，记录作业缺交。" },
      { id: "c3", role: "劳动委员", studentId: students[2]?.id ?? "", duty: "安排和检查卫生岗位。" },
    ],
    weeklyPlan: data.weeklyPlan ?? days.map((day) => ({ day: day.replace("星期", "周"), focus: "班级常规", event: "记录作业、积分、沟通事项" })),
    weeklyReports: data.weeklyReports ?? [],
    seatingConfig: { rows, columns, groupCount, aisleAfter },
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

  useEffect(() => {
    function syncPageFromUrl() {
      const page = new URLSearchParams(window.location.search).get("page");
      if (page && nav.some((item) => item.id === page)) setActive(page as ModuleId);
    }
    syncPageFromUrl();
    window.addEventListener("popstate", syncPageFromUrl);
    return () => window.removeEventListener("popstate", syncPageFromUrl);
  }, []);

  function openModule(id: ModuleId) {
    setActive(id);
    const url = new URL(window.location.href);
    url.searchParams.set("page", id);
    window.history.replaceState({}, "", url);
  }

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

  const editable: ModuleId[] = ["students", "homework", "points", "rules", "growth", "weekly", "schedule", "seating", "duty", "cadres", "records", "scores", "reflection", "comments", "certificates"];
  const activeLabel = nav.find((item) => item.id === active)?.label;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand sidebar-brand" href="/"><span className="brand-mark">班</span><span>云工具箱</span></a>
        <div className="class-switch"><small>当前班级</small><b>{workspace.className}</b><span>{workspace.term}</span></div>
        <nav className="side-nav" aria-label="班级工具">{nav.map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => openModule(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
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
          {active === "dashboard" && <Dashboard data={workspace.data} open={openModule} />}
          {active === "students" && <Students data={workspace.data} update={updateData} />}
          {active === "homework" && <Homework data={workspace.data} update={updateData} />}
          {active === "points" && <Points data={workspace.data} update={updateData} />}
          {active === "rules" && <Rules data={workspace.data} update={updateData} />}
          {active === "growth" && <Growth data={workspace.data} update={updateData} />}
          {active === "weekly" && <Weekly data={workspace.data} update={updateData} />}
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
  const classes = data.rosterClasses ?? [];
  const activeClass = data.rosterClasses?.find((item) => item.id === activeClassId);
  const tasks = (data.homeworkTasks ?? []).filter((item) => item.classId === activeClassId);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [createError, setCreateError] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editError, setEditError] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [copyMessage, setCopyMessage] = useState("");
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
  const followStudents = task ? (task.followUpStudentIds ?? [])
    .map((id) => data.students.find((student) => student.id === id))
    .filter((student): student is Student => Boolean(student)) : [];
  const followMissingCount = followStudents.filter((student) => (task?.statuses[student.id] ?? student.homework) === "未交").length;
  const followFixingCount = followStudents.filter((student) => (task?.statuses[student.id] ?? student.homework) === "待订正").length;
  const followDoneCount = followStudents.length - followMissingCount - followFixingCount;
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
  function switchHomeworkClass(id: string) {
    const nextClass = classes.find((item) => item.id === id);
    if (!nextClass || id === activeClassId) return;
    update((d) => ({ ...d, activeClassId: id, students: nextClass.students }));
    setSelectedTaskId("");
    setDetailOpen(false);
    setFollowOpen(false);
    setSelectedStudentIds([]);
    resetTaskFilters();
  }
  function openCreateTask() {
    setDraftDate(today());
    setDraftSubject("");
    setDraftTitle("");
    setCreateError("");
    setCreateOpen(true);
  }
  function confirmAddTask() {
    if (!draftDate || !draftSubject.trim() || !draftTitle.trim()) {
      setCreateError("请填写日期、学科和作业内容后再确认。");
      return;
    }
    const newTask: HomeworkTask = {
      id: crypto.randomUUID(),
      classId: activeClassId,
      followUpStudentIds: [],
      date: draftDate,
      subject: draftSubject.trim(),
      title: draftTitle.trim(),
      statuses: Object.fromEntries(data.students.map((s) => [s.id, "已交"])),
    };
    update((d) => ({ ...d, homeworkTasks: [newTask, ...(d.homeworkTasks ?? [])] }));
    setCreateOpen(false);
  }
  function deleteTaskById(id: string) {
    const target = tasks.find((item) => item.id === id);
    if (!target || !window.confirm(`确认删除“${target.subject} · ${target.title}”吗？删除后无法恢复。`)) return;
    update((d) => ({ ...d, homeworkTasks: (d.homeworkTasks ?? []).filter((item) => item.id !== id) }));
    if (selectedTaskId === id) {
      setSelectedTaskId("");
      setDetailOpen(false);
    }
  }
  function openTask(id: string) {
    setSelectedTaskId(id);
    setDetailOpen(true);
    setFollowOpen(false);
    setSelectedStudentIds([]);
    setCopyMessage("");
    setDetailStudentKeyword("");
    setDetailStatusFilter("全部");
    setDetailGroupFilter("全部");
  }
  function openEditTask() {
    if (!task) return;
    setEditDate(task.date);
    setEditSubject(task.subject);
    setEditTitle(task.title);
    setEditError("");
    setEditOpen(true);
  }
  function confirmEditTask() {
    if (!editDate || !editSubject.trim() || !editTitle.trim()) {
      setEditError("请完整填写日期、学科和作业内容。");
      return;
    }
    setTask({ date: editDate, subject: editSubject.trim(), title: editTitle.trim() });
    setEditOpen(false);
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
  function toggleStudentSelection(id: string) {
    setSelectedStudentIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function toggleCurrentPage() {
    const pageIds = pagedStudents.map((student) => student.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedStudentIds.includes(id));
    setSelectedStudentIds((current) => allSelected ? current.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...current, ...pageIds])));
  }
  function addSelectedToFollowList() {
    if (!task || !selectedStudentIds.length) return;
    setTask({ followUpStudentIds: Array.from(new Set([...(task.followUpStudentIds ?? []), ...selectedStudentIds])) });
    setCopyMessage("");
    setFollowOpen(true);
  }
  function removeFromFollowList(studentId: string) {
    if (!task) return;
    setTask({ followUpStudentIds: (task.followUpStudentIds ?? []).filter((id) => id !== studentId) });
    setCopyMessage("");
  }
  function bulkSet(next: HomeworkTask["statuses"][string]) {
    if (!taskId) return;
    const target = data.students.filter((student) => selectedStudentIds.includes(student.id));
    if (!target.length) return;
    const ids = new Set(target.map((student) => student.id));
    update((d) => ({
      ...d,
      students: d.students.map((s) => ids.has(s.id) ? { ...s, homework: next === "已复查" ? "已交" : next } : s),
      homeworkTasks: d.homeworkTasks?.map((item) => item.id === taskId ? { ...item, statuses: { ...item.statuses, ...Object.fromEntries(target.map((student) => [student.id, next])) } } : item),
    }));
  }
  function setStudentNote(studentId: string, note: string) {
    update((d) => ({
      ...d,
      students: d.students.map((student) => student.id === studentId ? { ...student, note } : student),
      rosterClasses: d.rosterClasses?.map((item) => item.id === activeClassId ? { ...item, students: item.students.map((student) => student.id === studentId ? { ...student, note } : student) } : item),
    }));
  }
  async function copyFollowList() {
    if (!followStudents.length) {
      setCopyMessage("待跟进名单为空，请先勾选学生加入名单");
      return;
    }
    const list = `${task?.date ?? ""} ${task?.subject ?? ""} · ${task?.title ?? ""}\n` + followStudents
      .map((student, index) => `${index + 1}. ${student.name}（第${student.group}组：${task?.statuses[student.id] ?? student.homework}）`)
      .join("\n");
    try {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(list);
          copied = true;
        } catch {
          copied = false;
        }
      }
      if (!copied) {
        const textarea = document.createElement("textarea");
        textarea.value = list;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("copy failed");
      }
      setCopyMessage(`已复制 ${followStudents.length} 名待跟进学生`);
    } catch {
      setCopyMessage("浏览器未允许复制，请检查复制权限后重试");
    }
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
    {editOpen && <div className="homework-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditOpen(false); }}>
      <section className="homework-create-modal" role="dialog" aria-modal="true" aria-labelledby="edit-homework-title">
        <header><div><span>编辑作业</span><h3 id="edit-homework-title">修改作业信息</h3><p>较长的作业内容可以在下面完整编写。</p></div><button aria-label="关闭" onClick={() => setEditOpen(false)}>×</button></header>
        <div className="homework-create-fields">
          <label>日期<input type="date" value={editDate} onChange={(e) => { setEditDate(e.target.value); setEditError(""); }} /></label>
          <label>学科<input value={editSubject} onChange={(e) => { setEditSubject(e.target.value); setEditError(""); }} placeholder="请输入学科" /></label>
          <label className="wide">作业内容<textarea value={editTitle} onChange={(e) => { setEditTitle(e.target.value); setEditError(""); }} placeholder="请输入具体作业内容，可换行编写" rows={8} autoFocus /></label>
        </div>
        {editError && <p className="homework-create-error">{editError}</p>}
        <footer><button className="cancel" onClick={() => setEditOpen(false)}>取消</button><button className="confirm" onClick={confirmEditTask}>确认保存</button></footer>
      </section>
    </div>}
    {followOpen && <div className="homework-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFollowOpen(false); }}>
      <section className="homework-follow-modal" role="dialog" aria-modal="true" aria-labelledby="follow-list-title">
        <header><div><span>作业待跟进名单</span><h3 id="follow-list-title">{task.subject} · {task.title}</h3><p>{task.date}｜名单由老师勾选加入，可随时移除；学生状态用于辅助判断。</p></div><button aria-label="关闭" onClick={() => setFollowOpen(false)}>×</button></header>
        <div className="homework-follow-stats"><div><span>名单总人数</span><b>{followStudents.length}</b></div><div><span>未交</span><b>{followMissingCount}</b></div><div><span>待订正</span><b>{followFixingCount}</b></div><div><span>已交/复查</span><b>{followDoneCount}</b></div></div>
        <div className="homework-follow-list">
          {followStudents.map((student, index) => {
            const status = task.statuses[student.id] ?? student.homework;
            return <article key={student.id}><span>{index + 1}</span><i>{student.name.slice(0, 1)}</i><div><b>{student.name}</b><small>第{student.group}组{student.note ? ` · ${student.note}` : ""}</small></div><em className={`homework-pill ${status}`}>{status}</em><button className="remove" onClick={() => removeFromFollowList(student.id)}>移除</button></article>;
          })}
          {!followStudents.length && <div className="empty-result"><b>待跟进名单还是空的</b><span>关闭窗口，在学生列表中勾选学生，再点击“选中加入待跟进名单”。</span></div>}
        </div>
        {copyMessage && <p className={`homework-copy-message ${copyMessage.startsWith("已复制") ? "success" : ""}`}>{copyMessage}</p>}
        <footer><button className="cancel" onClick={() => setFollowOpen(false)}>关闭</button><button className="confirm" disabled={!followStudents.length} onClick={copyFollowList}>复制完整名单</button></footer>
      </section>
    </div>}
    <section className="homework-detail-page">
      <section className="homework-detail-summary">
        <div><span>日期</span><b>{task.date}</b></div>
        <div><span>学科</span><b>{task.subject}</b></div>
        <div className="content"><span>作业内容</span><p>{task.title}</p></div>
        <button onClick={openEditTask}>编辑作业信息</button>
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
        <span>已选择 <b>{selectedStudentIds.length}</b> 人</span>
        <button onClick={toggleCurrentPage}>{pagedStudents.length > 0 && pagedStudents.every((student) => selectedStudentIds.includes(student.id)) ? "取消本页全选" : "全选本页"}</button>
        <button disabled={!selectedStudentIds.length} onClick={() => bulkSet("已交")}>选中设为已交</button>
        <button disabled={!selectedStudentIds.length} onClick={() => bulkSet("未交")}>选中设为未交</button>
        <button disabled={!selectedStudentIds.length} onClick={() => bulkSet("待订正")}>选中设为待订正</button>
        <button disabled={!selectedStudentIds.length} onClick={() => bulkSet("已复查")}>选中设为已复查</button>
        <button className="follow-add" disabled={!selectedStudentIds.length} onClick={addSelectedToFollowList}>选中加入待跟进名单</button>
        <button onClick={() => { setCopyMessage(""); setFollowOpen(true); }}>查看待跟进名单（{followStudents.length}）</button>
      </section>
      <section className="homework-table">
        <div className="homework-head"><span className="student-select-head"><input type="checkbox" aria-label="全选本页学生" checked={pagedStudents.length > 0 && pagedStudents.every((student) => selectedStudentIds.includes(student.id))} onChange={toggleCurrentPage} />学生</span><span>小组</span><span>状态</span><span>快速操作</span><span>备注（可编辑）</span></div>
        {pagedStudents.map((student) => {
          const status = task.statuses[student.id] ?? student.homework;
          return <div className={`homework-line ${selectedStudentIds.includes(student.id) ? "selected" : ""}`} key={student.id}><b><input type="checkbox" aria-label={`选择${student.name}`} checked={selectedStudentIds.includes(student.id)} onChange={() => toggleStudentSelection(student.id)} /><i>{student.name.slice(0,1)}</i>{student.name}</b><span>第{student.group}组</span><em className={`homework-pill ${status}`}>{status}</em><div>{statusOptions.map((next) => <button className={next === status ? "active" : ""} key={next} onClick={() => setStatus(student, next)}>{next}</button>)}</div><input className="homework-note-input" value={student.note ?? ""} onChange={(e) => setStudentNote(student.id, e.target.value)} placeholder="点击填写备注" /></div>;
        })}
      </section>
      <section className="homework-mobile-grid">{pagedStudents.map((student) => { const status = task.statuses[student.id] ?? student.homework; return <article className={`homework-mobile-student ${selectedStudentIds.includes(student.id) ? "selected" : ""}`} key={student.id}><header><label><input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={() => toggleStudentSelection(student.id)} /><i>{student.name.slice(0,1)}</i><b>{student.name}</b></label><span>第{student.group}组</span></header><button className={`student-status-card ${status}`} onClick={() => toggle(student)}><span>{status}</span><small>点击切换状态</small></button><label className="mobile-note">备注<input value={student.note ?? ""} onChange={(e) => setStudentNote(student.id, e.target.value)} placeholder="点击填写备注" /></label></article>; })}</section>
      <div className="homework-pagination">
        <button disabled={safeStudentPage <= 1} onClick={() => setStudentPage((page) => Math.max(1, page - 1))}>上一页</button>
        <span>学生第 {safeStudentPage} / {studentTotalPages} 页，共 {visibleStudents.length} 人</span>
        <button disabled={safeStudentPage >= studentTotalPages} onClick={() => setStudentPage((page) => Math.min(studentTotalPages, page + 1))}>下一页</button>
      </div>
    </section>
  </>;

  return <>
    <ToolHeading kicker="作业追踪" title="每天记录，按月归档，需要时再查" text={`${activeClass?.name ?? "当前班级"}的作业独立保存。首页每页只显示 10 项，作业再多也不会变成长页面。`} action={<button className="primary-small" onClick={openCreateTask}>＋ 新增作业</button>} />
    <section className="homework-class-switch">
      <header><div><b>选择管理班级</b><span>切换后只显示该班的作业、学生状态和待跟进名单</span></div><strong>{activeClass?.name ?? "当前班级"}</strong></header>
      <div>
        {classes.map((item) => {
          const homeworkCount = (data.homeworkTasks ?? []).filter((taskItem) => taskItem.classId === item.id).length;
          return <button className={item.id === activeClassId ? "active" : ""} key={item.id} onClick={() => switchHomeworkClass(item.id)}><b>{item.name}</b><span>{item.students.length}名学生 · {homeworkCount}项作业</span></button>;
        })}
      </div>
    </section>
    {createOpen && <div className="homework-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
      <section className="homework-create-modal" role="dialog" aria-modal="true" aria-labelledby="create-homework-title">
        <header><div><span>新增作业</span><h3 id="create-homework-title">填写一项作业</h3><p>不预填任何内容，确认后才会加入台账。</p></div><button aria-label="关闭" onClick={() => setCreateOpen(false)}>×</button></header>
        <div className="homework-create-fields">
          <label>日期<input type="date" value={draftDate} onChange={(e) => { setDraftDate(e.target.value); setCreateError(""); }} /></label>
          <label>学科<input value={draftSubject} onChange={(e) => { setDraftSubject(e.target.value); setCreateError(""); }} placeholder="请输入学科" autoFocus /></label>
          <label className="wide">作业内容<textarea value={draftTitle} onChange={(e) => { setDraftTitle(e.target.value); setCreateError(""); }} placeholder="请输入具体作业内容" rows={4} /></label>
        </div>
        {createError && <p className="homework-create-error">{createError}</p>}
        <footer><button className="cancel" onClick={() => setCreateOpen(false)}>取消</button><button className="confirm" onClick={confirmAddTask}>确认新增</button></footer>
      </section>
    </div>}
    <section className="homework-overview">
      <article><span>今日新增</span><b>{todayTasks.length}</b><p>今天布置的作业</p></article>
      <article><span>仍需跟进</span><b>{unresolvedTasks}</b><p>存在未交或待订正的作业</p></article>
      <article><span>本班累计</span><b>{tasks.length}</b><p>全部历史作业</p></article>
      <article><span>归档月份</span><b>{archiveMonths.length}</b><p>按月份快速定位</p></article>
    </section>
    <section className="homework-today-board">
      <header><div><b>今天</b><span>{todayTasks.length ? `共 ${todayTasks.length} 项，只显示今天，不混入历史作业` : "今天还没有记录作业"}</span></div></header>
      <div>
        {todayTasks.slice(0, 4).map((item) => {
          const summary = taskSummary(item);
          return <article className="homework-today-item" key={item.id}><button className="homework-today-open" onClick={() => openTask(item.id)}><span>{item.date}</span><b>{item.subject} · {item.title}</b><em>{summary.missing ? `未交 ${summary.missing}` : "无未交"}</em><small>待订正 {summary.fixing} · 完成率 {summary.rate}%</small></button><button className="homework-card-delete" onClick={() => deleteTaskById(item.id)}>删除</button></article>;
        })}
        {!todayTasks.length && <div className="empty-result"><b>今天还没有作业</b><span>使用页面右上角“新增作业”进行记录。</span></div>}
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
      <div className="homework-history-table">
        <div className="homework-history-head"><span>日期</span><span>学科</span><span>作业内容</span><span>完成情况</span><span>操作</span></div>
      {pagedTasks.map((item) => {
        const summary = taskSummary(item);
        return <article className="homework-history-row" key={item.id}>
          <time>{item.date}</time>
          <b className="homework-subject-badge">{item.subject}</b>
          <div className="homework-history-title"><b>{item.title}</b><small>已交/复查 {summary.done} 人</small></div>
          <div className="homework-history-status"><strong>{summary.rate}%</strong><span className={summary.missing ? "warning" : ""}>未交 {summary.missing}</span><span className={summary.fixing ? "fixing" : ""}>待订正 {summary.fixing}</span></div>
          <div className="homework-history-actions"><button className="open" onClick={() => openTask(item.id)}>处理</button><button className="delete" onClick={() => deleteTaskById(item.id)}>删除</button></div>
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
  const [delta, setDelta] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [operator, setOperator] = useState("班主任");
  const [selected, setSelected] = useState<string[]>([]);
  const rules = (data.pointRules?.length ? data.pointRules : defaultPointRules).filter((item) => item.enabled !== false);
  const scenes = Array.from(new Set(rules.map((item) => item.scene)));
  const ranked = [...data.students].sort((a, b) => b.points - a.points);
  const filtered = ranked.filter((student) => `${student.name}${student.studentNo ?? ""}第${student.group}组`.includes(keyword.trim()));
  const events = data.pointEvents ?? [];
  const positiveCount = events.filter((event) => event.delta > 0).length;
  const negativeCount = events.filter((event) => event.delta < 0).length;
  const average = Math.round(data.students.reduce((sum, student) => sum + student.points, 0) / Math.max(1, data.students.length));
  const leaders = ranked.slice(0, 3);
  const groups = Array.from(new Set(data.students.map((student) => student.group))).sort((a, b) => a - b).map((group) => {
    const members = data.students.filter((student) => student.group === group);
    return { group, total: members.reduce((sum, student) => sum + student.points, 0), count: members.length };
  }).sort((a, b) => b.total - a.total);
  const maxGroupTotal = Math.max(1, ...groups.map((group) => group.total));
  const careList = ranked.filter((student) => student.points <= average - 4).slice(-4).reverse();
  const selectedStudents = selected.length ? data.students.filter((student) => selected.includes(student.id)) : [];
  function chooseRule(rule: PointRule) {
    setScene(rule.scene);
    setReason(rule.reason);
    setDelta(Math.abs(rule.delta));
  }
  function toggleStudent(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function selectGroup(group: number) {
    const ids = data.students.filter((student) => student.group === group).map((student) => student.id);
    setSelected((current) => ids.every((id) => current.includes(id)) ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids])));
  }
  function applyScore(studentIds: string[], direction: 1 | -1) {
    if (!studentIds.length) return;
    const value = direction * delta;
    const stamp = new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const newEvents: PointEvent[] = studentIds.map((studentId) => ({ id: crypto.randomUUID(), studentId, scene, reason: reason.trim() || "课堂即时记录", delta: value, date: stamp, operator: operator.trim() || "班主任" }));
    update((d) => ({ ...d, students: d.students.map((student) => studentIds.includes(student.id) ? { ...student, points: student.points + value } : student), pointEvents: [...newEvents, ...(d.pointEvents ?? [])] }));
    setSelected([]);
  }
  return <><ToolHeading kicker="积分评价" title="课堂快速记录，也能批量处理小组表现" text="按计划记录时间、场景、原因和操作人；支持逐个学生、多选学生和小组批量加扣分。" /><section className="points-hero"><div><span>本周积分概览</span><h2>{data.students.length} 名学生 · 平均 {average} 分</h2><p>先从积分规则选择口径，再选择学生或小组批量处理；记录会进入成长档案、周报、评语和奖状候选。</p></div><div className="points-hero-stats"><b>{positiveCount}</b><span>表扬记录</span><b>{negativeCount}</b><span>提醒记录</span></div></section><section className="point-preset-strip">{rules.slice(0, 8).map((rule) => <button className={rule.scene === scene && rule.reason === reason ? "selected" : ""} key={rule.id} onClick={() => chooseRule(rule)}><span>{rule.scene}</span><b>{rule.title}</b><em className={rule.delta > 0 ? "good-text" : "bad-text"}>{rule.delta > 0 ? `+${rule.delta}` : rule.delta}</em></button>)}</section><section className="quick-scorebar upgraded"><select value={scene} onChange={(e)=>setScene(e.target.value)}>{scenes.map(s=><option key={s}>{s}</option>)}</select><input value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="输入具体原因，比如：主动订正错题" /><div className="delta-picks">{[1,2,3,5,10].map((item)=><button className={delta===item?"active":""} key={item} onClick={()=>setDelta(item)}>±{item}</button>)}</div><input value={operator} onChange={(e)=>setOperator(e.target.value)} placeholder="操作人" /><input className="point-search" value={keyword} onChange={(e)=>setKeyword(e.target.value)} placeholder="搜姓名/学号/小组" /></section><section className="batch-scorebar"><div><b>已选择 {selected.length} 人</b><span>{selectedStudents.map((student) => student.name).join("、") || "可勾选学生，也可按小组批量选择"}</span></div><button onClick={() => applyScore(selected, -1)} disabled={!selected.length}>批量扣 {delta}</button><button onClick={() => applyScore(selected, 1)} disabled={!selected.length}>批量加 {delta}</button><button onClick={() => setSelected([])} disabled={!selected.length}>清空</button></section><section className="group-pickbar">{groups.map((item) => <button key={item.group} onClick={() => selectGroup(item.group)}>第{item.group}组<span>{item.count}人 · {item.total}分</span></button>)}</section><div className="points-layout enriched"><div className="points-list rich selectable">{filtered.map((s) => <div className={selected.includes(s.id) ? "selected" : ""} key={s.id}><label><input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleStudent(s.id)} />{ranked.findIndex((student) => student.id === s.id) + 1}</label><b>{s.name}</b><small>第{s.group}组 · 学号{s.studentNo}</small><em>{s.points}</em><button className="minus" onClick={() => applyScore([s.id], -1)}>−{delta}</button><button className="plus" onClick={() => applyScore([s.id], 1)}>＋{delta}</button></div>)}</div><div className="point-side-panel"><section className="podium compact">{leaders.map((student, index) => <article className={`place p${index + 1}`} key={student.id}><span>{index + 1}</span><i>{student.name.slice(0,1)}</i><b>{student.name}</b><em>{student.points} 分</em></article>)}</section><section className="group-score-card"><h3>小组积分</h3>{groups.map((item) => <div key={item.group}><span>第{item.group}组</span><i><b style={{ width: `${Math.max(8, Math.round(item.total / maxGroupTotal * 100))}%` }}></b></i><em>{item.total}</em></div>)}</section><section className="care-card"><h3>需要温和提醒</h3>{careList.length === 0 ? <p>目前没有明显低于平均分的学生。</p> : careList.map((student) => <p key={student.id}><b>{student.name}</b><span>{student.points} 分，建议给一次可补救任务。</span></p>)}</section></div><div className="event-feed"><h3>最近积分记录</h3>{events.length === 0 && <p className="muted-text">暂无积分记录，先从左侧给学生加扣分。</p>}{events.slice(0, 10).map((e) => <div key={e.id}><b className={e.delta > 0 ? "good-text" : "bad-text"}>{e.delta > 0 ? `+${e.delta}` : e.delta}</b><span>{data.students.find(s=>s.id===e.studentId)?.name ?? "未知学生"} · {e.scene}</span><small>{e.reason} · {e.date} · {e.operator ?? "班主任"}</small></div>)}</div></div></>;
}

function Rules({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [current, setCurrent] = useState<keyof typeof ruleSets>("小学温和版");
  const rule = ruleSets[current];
  const rules = data.pointRules?.length ? data.pointRules : defaultPointRules;
  const visibleRules = rules.filter((item) => rule.levels.includes(item.level));
  const sceneNames = Array.from(new Set(visibleRules.map((item) => item.scene)));
  function editRule(id: string, patch: Partial<PointRule>) {
    update((d) => ({ ...d, pointRules: (d.pointRules?.length ? d.pointRules : defaultPointRules).map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }
  function addRule() {
    const newRule: PointRule = { id: crypto.randomUUID(), scene: "自定义", title: "新规则", reason: "填写评价口径", delta: 1, owner: "班主任", enabled: true, level: "自定义", detail: "根据班级需要补充。" };
    update((d) => ({ ...d, pointRules: [newRule, ...(d.pointRules?.length ? d.pointRules : defaultPointRules)] }));
    setCurrent("班级精细版");
  }
  return <><ToolHeading kicker="积分规则" title="规则可编辑，积分评价才有据可依" text="严格按照计划：小学版、初中版、温和版、严格版都可启用、停用、改分值和自定义。" action={<button className="primary-small" onClick={addRule}>＋ 新增规则</button>} /><section className="rules-hero"><div><span>当前方案</span><h2>{current}</h2><p>{rule.focus}</p></div><aside>{rule.rhythm.map((item) => <b key={item}>{item}</b>)}</aside></section><div className="segmented">{(Object.keys(ruleSets) as Array<keyof typeof ruleSets>).map((name) => <button className={current === name ? "active" : ""} key={name} onClick={() => setCurrent(name)}>{name}</button>)}</div><section className="rule-scene-tabs">{sceneNames.map((scene) => <span key={scene}>{scene}</span>)}</section><section className="rules-editor"><div className="rules-editor-head"><span>启用</span><span>版本</span><span>场景</span><span>规则名称</span><span>评价口径</span><span>分值</span><span>负责人</span></div>{visibleRules.map((item) => <div className={item.enabled ? "rule-edit-line" : "rule-edit-line disabled"} key={item.id}><label><input type="checkbox" checked={item.enabled} onChange={(e)=>editRule(item.id,{enabled:e.target.checked})} />{item.enabled ? "启用" : "停用"}</label><select value={item.level} onChange={(e)=>editRule(item.id,{level:e.target.value as PointRule["level"]})}>{["小学版","初中版","温和版","严格版","自定义"].map((level)=><option key={level}>{level}</option>)}</select><input value={item.scene} onChange={(e)=>editRule(item.id,{scene:e.target.value})} /><input value={item.title} onChange={(e)=>editRule(item.id,{title:e.target.value})} /><input value={item.reason} onChange={(e)=>editRule(item.id,{reason:e.target.value})} /><input type="number" value={item.delta} onChange={(e)=>editRule(item.id,{delta:Number(e.target.value)||0})} /><input value={item.owner} onChange={(e)=>editRule(item.id,{owner:e.target.value})} /><textarea value={item.detail ?? ""} onChange={(e)=>editRule(item.id,{detail:e.target.value})} /></div>)}</section><section className="rule-workflow"><article><b>1</b><span>先定规则</span><p>班主任选一个方案，明确每类事项由谁记录。</p></article><article><b>2</b><span>课堂即时记</span><p>积分评价页会读取已启用规则，作为快捷原因。</p></article><article><b>3</b><span>周末再复盘</span><p>用积分榜、成长档案和周报判断谁该表扬、谁要跟进。</p></article></section></>;
}

type GrowthKind = "沟通记录" | "积分表现" | "作业记录" | "老师补充";
type GrowthTime = "全部时间" | "近7天" | "近30天" | "本学期";
type GrowthTimelineItem = {
  id: string;
  kind: GrowthKind;
  label: string;
  title: string;
  content: string;
  followUp?: string;
  date: string;
  tone: "positive" | "attention" | "neutral";
  timestamp: number | null;
};

function growthTimestamp(value: string, createdAt?: number) {
  if (createdAt) return createdAt;
  const iso = value.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();
  const now = new Date();
  if (value.includes("今天") || value.includes("刚刚")) return now.getTime();
  if (value.includes("昨天")) return now.getTime() - 86400000;
  const weekDay = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"].findIndex((day) => value.includes(day));
  if (weekDay >= 0) {
    const current = now.getDay() === 0 ? 7 : now.getDay();
    return now.getTime() - (current - weekDay - 1) * 86400000;
  }
  return null;
}

function inGrowthRange(timestamp: number | null, range: GrowthTime) {
  if (range === "全部时间") return true;
  if (!timestamp) return false;
  const now = new Date();
  if (range === "近7天") return timestamp >= now.getTime() - 7 * 86400000;
  if (range === "近30天") return timestamp >= now.getTime() - 30 * 86400000;
  const month = now.getMonth() + 1;
  const start = month >= 8 ? new Date(now.getFullYear(), 7, 1) : month >= 2 ? new Date(now.getFullYear(), 1, 1) : new Date(now.getFullYear() - 1, 7, 1);
  return timestamp >= start.getTime();
}

function Growth({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [id, setId] = useState(data.students[0]?.id ?? "");
  const [keyword, setKeyword] = useState("");
  const [kind, setKind] = useState<"全部类型" | GrowthKind>("全部类型");
  const [range, setRange] = useState<GrowthTime>("全部时间");
  const [page, setPage] = useState(1);
  const [showComposer, setShowComposer] = useState(false);
  const [formError, setFormError] = useState("");
  const [copyState, setCopyState] = useState("复制成长摘要");
  const [draft, setDraft] = useState({ date: today(), type: "表扬记录", title: "", content: "", followUp: "" });
  const student = data.students.find((item) => item.id === id) ?? data.students[0];
  if (!student) return <div className="growth-first-empty"><b>先建立学生名单</b><span>成长档案会复用学生名单；导入名单后即可自动归集记录。</span></div>;

  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id;
  const records = data.records.filter((record) => record.student === student.name);
  const events = (data.pointEvents ?? []).filter((event) => event.studentId === student.id);
  const tasks = (data.homeworkTasks ?? []).filter((task) => !task.classId || task.classId === activeClassId);
  const homework = tasks.map((task) => ({ task, status: task.statuses[student.id] ?? student.homework }));
  const manual = (data.growthEvidence ?? []).filter((item) => item.studentId === student.id);
  const homeworkDone = homework.filter(({ status }) => status === "已交" || status === "已复查").length;
  const homeworkRate = homework.length ? Math.round(homeworkDone / homework.length * 100) : 0;
  const positiveEvents = events.filter((event) => event.delta > 0);
  const negativeEvents = events.filter((event) => event.delta < 0);
  const cadre = (data.cadres ?? []).find((role) => role.studentId === student.id);
  const status = student.score < 80 || student.homework !== "已交" || student.attendance !== "正常" || negativeEvents.length > positiveEvents.length
    ? "需要跟进"
    : student.score >= 90 || student.points >= 18 ? "表现良好" : "整体稳定";
  const statusTone = status === "需要跟进" ? "attention" : status === "表现良好" ? "positive" : "steady";
  const shownStudents = data.students.filter((item) => `${item.name}${item.studentNo ?? ""}${item.group}`.toLocaleLowerCase("zh-CN").includes(keyword.trim().toLocaleLowerCase("zh-CN")));

  const evidence: GrowthTimelineItem[] = [
    ...manual.map((item) => ({ id: `manual-${item.id}`, kind: "老师补充" as const, label: item.type, title: item.title, content: item.content, followUp: item.followUp, date: item.date, tone: item.type.includes("表扬") || item.type.includes("进步") ? "positive" as const : "neutral" as const, timestamp: growthTimestamp(item.date, item.createdAt) })),
    ...records.map((record) => ({ id: `record-${record.id}`, kind: "沟通记录" as const, label: record.type, title: record.type.includes("表扬") || record.type.includes("成长") ? "积极表现记录" : "沟通与跟进记录", content: record.content, date: record.date, tone: record.type.includes("表扬") || record.type.includes("成长") ? "positive" as const : "neutral" as const, timestamp: growthTimestamp(record.date) })),
    ...events.map((event) => ({ id: `event-${event.id}`, kind: "积分表现" as const, label: event.scene, title: `${event.delta > 0 ? "+" : ""}${event.delta} 积分`, content: event.reason, date: event.date, tone: event.delta > 0 ? "positive" as const : "attention" as const, timestamp: growthTimestamp(event.date) })),
    ...homework.map(({ task, status: taskStatus }) => ({ id: `homework-${task.id}`, kind: "作业记录" as const, label: task.subject, title: task.title, content: `完成状态：${taskStatus}`, date: task.date, tone: taskStatus === "已交" || taskStatus === "已复查" ? "positive" as const : "attention" as const, timestamp: growthTimestamp(task.date) })),
  ].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  const filteredEvidence = evidence.filter((item) => (kind === "全部类型" || item.kind === kind) && inGrowthRange(item.timestamp, range));
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredEvidence.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleEvidence = filteredEvidence.slice((safePage - 1) * pageSize, safePage * pageSize);
  const strengths = [
    student.score >= 90 ? "学习表现稳定优秀" : student.score >= 80 ? "学习基础较稳定" : "已经形成明确的学习帮扶方向",
    student.points >= 18 ? "日常表现有较多正向积累" : student.points >= 14 ? "日常表现稳步积累" : "需要增加具体、及时的正向反馈",
    homeworkRate >= 90 ? "作业完成习惯良好" : homeworkRate >= 70 ? "多数作业能够完成" : "作业提交与订正闭环需要加强",
  ];
  const followUps = [
    student.score < 80 ? "安排一次错题复盘或学习谈话，并记录具体困难。" : "保持当前学习节奏，补充一条可观察的进步事实。",
    student.attendance !== "正常" ? `跟进考勤状态：${student.attendance}。` : "考勤状态正常，继续保持。",
    homework.some(({ status: taskStatus }) => taskStatus === "未交" || taskStatus === "待订正") ? "完成未交或待订正作业的复查闭环。" : "作业暂无待处理事项。",
    records.length + manual.length === 0 ? "补充一次谈心、家访、表扬或课堂观察记录。" : "根据最近一条证据安排下次观察或回访。",
  ];
  const summary = `${student.name}：当前${status}。成绩${student.score}分，积分${student.points}分，作业完成率${homeworkRate}%，已沉淀${evidence.length}条成长证据。优势：${strengths.join("；")}。下一步：${followUps[0]}`;

  function selectStudent(studentId: string) {
    setId(studentId); setPage(1); setShowComposer(false); setFormError("");
  }
  function saveEvidence() {
    if (!draft.date || !draft.title.trim() || !draft.content.trim()) { setFormError("请填写日期、简短标题和具体事实。"); return; }
    const item: GrowthEvidence = { id: crypto.randomUUID(), studentId: student.id, date: draft.date, type: draft.type, title: draft.title.trim(), content: draft.content.trim(), followUp: draft.followUp.trim(), source: "班主任补充", createdAt: Date.now() };
    update((current) => ({ ...current, growthEvidence: [item, ...(current.growthEvidence ?? [])] }));
    setDraft({ date: today(), type: "表扬记录", title: "", content: "", followUp: "" });
    setFormError(""); setKind("全部类型"); setRange("全部时间"); setPage(1); setShowComposer(false);
  }
  async function copySummary() {
    await navigator.clipboard?.writeText(summary);
    setCopyState("已复制");
    window.setTimeout(() => setCopyState("复制成长摘要"), 1600);
  }

  return <>
    <ToolHeading kicker="成长档案" title="让每一条日常记录都成为成长证据" text="自动归集作业、积分、成绩、考勤、沟通和表扬记录，也可以由班主任补充具体事实与后续措施。" action={<div className="growth-heading-actions"><button className="ghost-btn" onClick={() => window.print()}>打印学生档案</button><button className="primary-small" onClick={() => setShowComposer(true)}>＋ 补充成长证据</button></div>} />
    <div className="growth-layout">
      <aside className="growth-student-panel">
        <div className="growth-student-head"><div><span>学生目录</span><b>{data.students.length} 名学生</b></div><small>搜索并选择一名学生</small></div>
        <label className="growth-search"><span>⌕</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索姓名、学号或小组" /></label>
        <div className="growth-student-list">{shownStudents.map((item) => { const needsAttention = item.score < 80 || item.homework !== "已交" || item.attendance !== "正常"; return <button className={item.id === student.id ? "selected" : ""} key={item.id} onClick={() => selectStudent(item.id)}><i>{item.name.slice(0, 1)}</i><span><b>{item.name}</b><small>学号 {item.studentNo || "未填"} · 第{item.group}组</small></span><em className={needsAttention ? "attention" : ""}>{needsAttention ? "待关注" : `${item.points}分`}</em></button>; })}{!shownStudents.length && <div className="growth-empty-students">没有找到匹配的学生</div>}</div>
      </aside>
      <div className="growth-main">
        <section className="growth-hero-card"><div className="growth-identity"><i>{student.name.slice(0, 1)}</i><div><span>学生成长档案</span><h2>{student.name}</h2><p>学号 {student.studentNo || "未填写"} · 第{student.group}组 · {student.gender}生{cadre ? ` · ${cadre.role}` : ""}</p></div></div><div className={`growth-status ${statusTone}`}><span>当前状态</span><b>{status}</b><small>{student.note || "暂无特别备注"}</small></div></section>
        <section className="growth-metrics"><article><span>当前成绩</span><b>{student.score}<small>分</small></b><em>{student.score >= 90 ? "优秀" : student.score >= 80 ? "稳定" : "需帮扶"}</em></article><article><span>班级积分</span><b>{student.points}<small>分</small></b><em>{positiveEvents.length} 条正向记录</em></article><article><span>作业完成率</span><b>{homeworkRate}<small>%</small></b><em>{homeworkDone}/{homework.length || 0} 项完成</em></article><article><span>成长证据</span><b>{evidence.length}<small>条</small></b><em>沟通 {records.length} · 补充 {manual.length}</em></article></section>
        <div className="growth-insight-grid"><section className="growth-insight-card strengths"><header><div><span>学生画像</span><h3>由事实归纳的优势与基础</h3></div><b>画像</b></header><ul>{strengths.map((item) => <li key={item}>{item}</li>)}</ul><div className="growth-tags"><span>{student.attendance}</span><span>{student.homework}</span>{cadre && <span>{cadre.role}</span>}</div></section><section className="growth-insight-card follow"><header><div><span>下一步</span><h3>可以执行的跟进建议</h3></div><b>行动</b></header><ol>{followUps.map((item, index) => <li key={item}><i>{index + 1}</i><span>{item}</span></li>)}</ol></section></div>
        {showComposer && <section className="growth-composer"><header><div><span>班主任补充</span><h3>为 {student.name} 添加成长证据</h3><p>按参考表单保留“时间—具体事实—后续措施”，避免只写笼统评价。</p></div><button onClick={() => setShowComposer(false)} aria-label="关闭">×</button></header><div className="growth-form-grid"><label><span>发生日期 *</span><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label><span>记录类型 *</span><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>{["表扬记录", "课堂表现", "学习进步", "问题与反思", "谈心跟进", "家校沟通", "活动与劳动", "其他"].map((item) => <option key={item}>{item}</option>)}</select></label><label className="wide"><span>简短标题 *</span><input value={draft.title} maxLength={40} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="如：第一次主动上台讲题" /></label><label className="wide"><span>具体事实 / 事情经过 *</span><textarea value={draft.content} maxLength={500} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="记录看见、听见或核实到的具体行为，不贴标签。" /></label><label className="wide"><span>后续措施 / 下次观察点</span><textarea value={draft.followUp} maxLength={300} onChange={(event) => setDraft({ ...draft, followUp: event.target.value })} placeholder="如：下周继续观察课堂发言，并在周五反馈。" /></label></div>{formError && <p className="growth-form-error">{formError}</p>}<footer><span>添加后需点击页面右上角“保存更改”，记录才会长期保留。</span><div><button className="ghost-btn" onClick={() => setShowComposer(false)}>取消</button><button className="primary-small" onClick={saveEvidence}>添加到档案</button></div></footer></section>}
        <section className="growth-evidence-card"><header className="growth-evidence-head"><div><span>成长证据</span><h3>按时间与类型查看记录</h3><p>来源包括作业追踪、积分评价、家校沟通和班主任补充。</p></div><button onClick={copySummary}>{copyState}</button></header><div className="growth-filter-row"><label><span>时间范围</span><select value={range} onChange={(event) => { setRange(event.target.value as GrowthTime); setPage(1); }}>{["全部时间", "近7天", "近30天", "本学期"].map((item) => <option key={item}>{item}</option>)}</select></label><label><span>记录类型</span><select value={kind} onChange={(event) => { setKind(event.target.value as "全部类型" | GrowthKind); setPage(1); }}>{["全部类型", "沟通记录", "积分表现", "作业记录", "老师补充"].map((item) => <option key={item}>{item}</option>)}</select></label><span className="growth-result-count">筛选到 {filteredEvidence.length} 条</span></div><div className="growth-timeline">{visibleEvidence.map((item) => <article className={item.tone} key={item.id}><div className="growth-timeline-mark"><i></i></div><div className="growth-evidence-content"><header><span>{item.kind} · {item.label}</span><time>{item.date}</time></header><h4>{item.title}</h4><p>{item.content}</p>{item.followUp && <div className="growth-followup-note"><b>后续措施</b><span>{item.followUp}</span></div>}</div></article>)}{!visibleEvidence.length && <div className="growth-empty-evidence"><b>{evidence.length ? "当前筛选条件下没有记录" : "还没有成长证据"}</b><span>{evidence.length ? "可以放宽时间或记录类型。" : "先补充一条具体事实，后续作业、积分和沟通记录也会自动汇入。"}</span>{!evidence.length && <button className="primary-small" onClick={() => setShowComposer(true)}>补充第一条证据</button>}</div>}</div>{filteredEvidence.length > pageSize && <div className="growth-pagination"><button disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>上一页</button><span>第 {safePage} / {pageCount} 页</span><button disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>下一页</button></div>}</section>
      </div>
    </div>
  </>;
}

function Weekly({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [edition, setEdition] = useState<"家长版" | "教师版">("家长版");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [followFilter, setFollowFilter] = useState<"全部" | "作业" | "成绩" | "考勤">("全部");
  const [customDraft, setCustomDraft] = useState("");
  const [draftTouched, setDraftTouched] = useState(false);
  const [nextFocus, setNextFocus] = useState(() => (data.weeklyPlan ?? []).map((item) => `${item.day}：${item.focus} · ${item.event}`).join("\n"));
  const now = new Date();
  const monday = new Date(now);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const iso = (date: Date) => `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
  const shortDate = (date: Date) => `${date.getMonth() + 1}月${date.getDate()}日`;
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id;
  const weekTasks = (data.homeworkTasks ?? []).filter((task) => (!activeClassId || task.classId === activeClassId) && task.date >= iso(monday) && task.date <= iso(sunday));
  const totalChecks = weekTasks.length * data.students.length;
  let submitted = 0;
  let missing = 0;
  let fixing = 0;
  for (const task of weekTasks) {
    for (const student of data.students) {
      const status = task.statuses[student.id] ?? student.homework;
      if (status === "已交" || status === "已复查") submitted += 1;
      if (status === "未交") missing += 1;
      if (status === "待订正") fixing += 1;
    }
  }
  const completionRate = totalChecks ? Math.round(submitted / totalChecks * 100) : 0;
  const averageScore = data.students.length ? Math.round(data.students.reduce((sum, student) => sum + student.score, 0) / data.students.length) : 0;
  const pointEvents = data.pointEvents ?? [];
  const hasDatedPointEvents = pointEvents.some((event) => /^\d{4}-\d{2}-\d{2}/.test(event.date));
  const reportPointEvents = hasDatedPointEvents ? pointEvents.filter((event) => event.date >= weekStartValue() && event.date <= weekEndValue()) : pointEvents;
  const positiveEvents = reportPointEvents.filter((event) => event.delta > 0);
  const ranked = [...data.students].sort((a, b) => b.points - a.points);
  const stars = ranked.slice(0, 4);
  const progressMap = new Map<string, { student: Student; delta: number; evidence: string }>();
  for (const event of positiveEvents) {
    const student = data.students.find((item) => item.id === event.studentId);
    if (!student) continue;
    const current = progressMap.get(student.id);
    progressMap.set(student.id, { student, delta: (current?.delta ?? 0) + event.delta, evidence: current?.evidence ?? event.reason });
  }
  const progress = [...progressMap.values()].sort((a, b) => b.delta - a.delta).slice(0, 4);
  const follow = data.students.map((student) => {
    const unresolved = weekTasks.reduce((count, task) => {
      const status = task.statuses[student.id] ?? student.homework;
      return count + (status === "未交" || status === "待订正" ? 1 : 0);
    }, 0);
    const reasons = [
      student.score < 80 ? { kind: "成绩", text: `成绩 ${student.score} 分` } : null,
      unresolved ? { kind: "作业", text: `${unresolved} 项作业待处理` } : null,
      student.attendance !== "正常" ? { kind: "考勤", text: student.attendance } : null,
    ].filter((item): item is { kind: string; text: string } => Boolean(item));
    return { student, reasons };
  }).filter((item) => item.reasons.length).sort((a, b) => b.reasons.length - a.reasons.length).slice(0, 6);
  const filteredFollow = follow.filter((item) => followFilter === "全部" || item.reasons.some((reason) => reason.kind === followFilter));
  const groupStats = [...new Set(data.students.map((student) => student.group))].sort((a, b) => a - b).map((group) => {
    const students = data.students.filter((student) => student.group === group);
    const points = students.reduce((sum, student) => sum + student.points, 0);
    const unresolved = weekTasks.reduce((count, task) => count + students.filter((student) => {
      const status = task.statuses[student.id] ?? student.homework;
      return status === "未交" || status === "待订正";
    }).length, 0);
    return { group, students: students.length, points, average: students.length ? Math.round(points / students.length) : 0, unresolved };
  }).sort((a, b) => b.average - a.average);
  const hasDatedRecords = data.records.some((record) => /^\d{4}-\d{2}-\d{2}/.test(record.date));
  const reportRecords = hasDatedRecords ? data.records.filter((record) => record.date >= weekStartValue() && record.date <= weekEndValue()) : data.records;
  const latestRecords = reportRecords.slice(0, 4);
  const reportText = useMemo(() => {
    const title = `班级周报｜${shortDate(monday)}—${shortDate(sunday)}`;
    const overview = `本周共记录 ${weekTasks.length} 项作业，整体完成率 ${completionRate}%；班级当前平均分 ${averageScore} 分，累计记录 ${positiveEvents.length} 次正向表现。`;
    const praise = stars.length ? `优秀学生：${stars.map((student) => `${student.name}（${student.points}积分）`).join("、")}。` : "优秀学生：暂无数据。";
    const improvement = progress.length ? `进步学生：${progress.map((item) => `${item.student.name}（${item.evidence}）`).join("、")}。` : "进步学生：本周还没有足够的正向记录。";
    const attention = edition === "家长版"
      ? `温馨提醒：仍有 ${missing} 人次未交、${fixing} 人次待订正，请家长协助孩子及时完成学习闭环。`
      : `重点跟进：${follow.length ? follow.map(({ student, reasons }) => `${student.name}（${reasons.map((reason) => reason.text).join("、")}）`).join("；") : "暂无重点跟进学生"}。`;
    const plan = nextFocus.trim() ? `下周安排：\n${nextFocus.trim()}` : "下周安排：继续关注作业习惯、课堂参与和自我管理。";
    return [title, overview, praise, improvement, attention, plan].join("\n\n");
  }, [averageScore, completionRate, edition, fixing, follow, missing, nextFocus, positiveEvents.length, progress, stars, weekTasks.length]);
  const activeClassKey = activeClassId ?? "class-1";
  const weekStart = iso(monday);
  const weekEnd = iso(sunday);
  const reports = (data.weeklyReports ?? []).filter((report) => report.classId === activeClassKey).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const currentSavedReport = reports.find((report) => report.weekStart === weekStart && report.edition === edition);
  const draftContent = draftTouched ? customDraft : currentSavedReport?.content ?? reportText;

  function weekStartValue() { return iso(monday); }
  function weekEndValue() { return iso(sunday); }

  async function copyReport() {
    await navigator.clipboard?.writeText(draftContent);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function changeEdition(next: "家长版" | "教师版") {
    setEdition(next);
    setDraftTouched(false);
    setCustomDraft("");
    setSaved(false);
  }

  function saveReport() {
    const nowText = new Date().toISOString();
    const report = {
      id: currentSavedReport?.id ?? crypto.randomUUID(),
      classId: activeClassKey,
      weekStart,
      weekEnd,
      edition,
      content: draftContent,
      nextFocus,
      createdAt: currentSavedReport?.createdAt ?? nowText,
      updatedAt: nowText,
    };
    update((current) => ({ ...current, weeklyReports: [...(current.weeklyReports ?? []).filter((item) => item.id !== report.id), report] }));
    setDraftTouched(false);
    setSaved(true);
  }

  return <div className="weekly-report-page">
    <ToolHeading kicker="班级周报" title="一周班情，自动汇成一张可读周报" text="参考每周积分表、班级日志和家校联系本，把值得表扬、进步、提醒和共性问题汇成可修改周报。" action={<div className="weekly-heading-actions"><button className="weekly-secondary-btn" onClick={() => window.print()}>打印 / 导出</button><button className="weekly-secondary-btn" onClick={saveReport}>{saved ? "已加入保存" : "保存本周"}</button><button className="primary-small" onClick={copyReport}>{copied ? "已复制" : "复制周报"}</button></div>} />

    <section className="weekly-report-hero">
      <div>
        <span>第 {Math.ceil((((monday.getTime() - new Date(monday.getFullYear(), 0, 1).getTime()) / 86400000) + new Date(monday.getFullYear(), 0, 1).getDay() + 1) / 7)} 周</span>
        <h2>{shortDate(monday)}—{shortDate(sunday)}</h2>
        <p>已根据当前班级数据生成本周概览，切换版本后可以直接复制发送。</p>
      </div>
      <div className="weekly-edition-switch" aria-label="周报版本">
        {(["家长版", "教师版"] as const).map((item) => <button className={edition === item ? "active" : ""} key={item} onClick={() => changeEdition(item)}><b>{item}</b><span>{item === "家长版" ? "简洁、积极、适合班级群" : "显示学生姓名和跟进原因"}</span></button>)}
      </div>
    </section>

    <section className="weekly-metrics" aria-label="本周核心数据">
      <article><span>本周作业</span><b>{weekTasks.length}<small>项</small></b><p>{totalChecks ? `${submitted}/${totalChecks} 人次完成` : "本周暂无作业记录"}</p></article>
      <article><span>作业完成率</span><b>{completionRate}<small>%</small></b><p>{missing} 人次未交 · {fixing} 人次待订正</p></article>
      <article><span>正向表现</span><b>{positiveEvents.length}<small>次</small></b><p>{hasDatedPointEvents ? "按本周积分记录统计" : "日期待完善，暂按当前记录"}</p></article>
      <article><span>班级平均分</span><b>{averageScore}<small>分</small></b><p>{data.students.filter((student) => student.score >= 90).length} 人达到优秀</p></article>
    </section>

    <div className="weekly-report-layout">
      <section className="weekly-report-main">
        <article className="weekly-section-card weekly-praise-card">
          <header><div><span>值得表扬</span><h3>优秀学生排行榜</h3></div><em>{stars.length} 名候选</em></header>
          <div className="weekly-star-list">{stars.map((student, index) => {
            const evidence = reportPointEvents.find((event) => event.studentId === student.id && event.delta > 0);
            return <div key={student.id}><i>{index + 1}</i><b>{student.name}</b><span>{evidence?.reason ?? (student.score >= 90 ? "学习表现稳定优秀" : "班级积分表现突出")}</span><strong>{student.points} 积分</strong></div>;
          })}{!stars.length && <p className="weekly-empty">导入学生并记录积分后，这里会自动生成优秀学生排行榜。</p>}</div>
        </article>

        <article className="weekly-section-card weekly-progress-card">
          <header><div><span>持续进步</span><h3>有真实正向记录的学生</h3></div><em>{progress.length} 名学生</em></header>
          <div className="weekly-progress-list">{progress.length ? progress.map((item) => <div key={item.student.id}><i>↗</i><span><b>{item.student.name}</b><small>{item.evidence}</small></span><strong>+{item.delta}</strong></div>) : <p className="weekly-empty">积分评价中还没有正向记录，暂时无法生成进步学生名单。</p>}</div>
        </article>

        <article className="weekly-section-card weekly-group-card">
          <header><div><span>分组统计</span><h3>小组表现与作业闭环</h3></div><em>{groupStats.length} 个小组</em></header>
          {groupStats.length ? <div className="weekly-group-table"><div className="weekly-group-head"><span>排名</span><span>小组</span><span>人数</span><span>人均积分</span><span>作业待办</span></div>{groupStats.map((item, index) => <div key={item.group}><b>{index + 1}</b><span>第{item.group}组</span><span>{item.students}人</span><strong>{item.average}</strong><em className={item.unresolved ? "warn" : ""}>{item.unresolved ? `${item.unresolved}人次` : "已清零"}</em></div>)}</div> : <p className="weekly-empty">学生名单完成分组后，这里会自动生成小组统计。</p>}
        </article>

        <article className="weekly-section-card">
          <header><div><span>成长片段</span><h3>本周留下的具体证据</h3></div><em>{reportRecords.length} 条记录</em></header>
          <div className="weekly-record-list">{latestRecords.length ? latestRecords.map((record) => <div key={record.id}><i>{record.student.slice(0, 1)}</i><div><b>{record.student}<small>{record.type}</small></b><p>{record.content}</p></div><time>{record.date}</time></div>) : <p className="weekly-empty">还没有成长记录，可从家校沟通或积分评价中积累。</p>}</div>
        </article>

        <article className="weekly-section-card weekly-plan-card">
          <header><div><span>下周行动</span><h3>把计划写成可以执行的事项</h3></div><em>会进入复制内容</em></header>
          <textarea aria-label="下周重点安排" value={nextFocus} onChange={(event) => setNextFocus(event.target.value)} placeholder="例如：周一检查订正，周三联系重点学生家长……" />
        </article>
      </section>

      <aside className="weekly-report-side">
        <section className="weekly-section-card weekly-follow-card">
          <header><div><span>需要关注</span><h3>{edition === "家长版" ? "班级共性提醒" : "重点学生清单"}</h3></div><em>{follow.length} 人</em></header>
          {edition === "家长版" ? <div className="weekly-class-reminder"><b>本周共性问题</b><p>仍有 {missing} 人次作业未交、{fixing} 人次等待订正。建议周末完成查漏补缺，下周一带齐学习用品。</p><span>只呈现班级整体情况，不公开学生姓名</span></div> : <><div className="weekly-follow-filters">{(["全部", "作业", "成绩", "考勤"] as const).map((item) => <button className={followFilter === item ? "active" : ""} key={item} onClick={() => setFollowFilter(item)}>{item}</button>)}</div><div className="weekly-follow-list">{filteredFollow.length ? filteredFollow.map(({ student, reasons }) => <div key={student.id}><i>{student.name.slice(0, 1)}</i><span><b>{student.name}</b><small>{reasons.map((reason) => reason.text).join(" · ")}</small></span></div>) : <p className="weekly-empty">当前条件下没有需要跟进的学生。</p>}</div></>}
        </section>

        <section className="weekly-copy-preview weekly-draft-editor">
          <header><span>周报正文 · 可修改</span><div><button onClick={() => { setCustomDraft(reportText); setDraftTouched(true); setSaved(false); }}>重新生成</button><b>{edition}</b></div></header>
          <textarea aria-label="可编辑周报正文" value={draftContent} onChange={(event) => { setCustomDraft(event.target.value); setDraftTouched(true); setSaved(false); }} />
          <button className="weekly-copy-action" onClick={copyReport}>{copied ? "✓ 已复制到剪贴板" : "复制后发送到班级群"}</button>
        </section>

        <section className="weekly-section-card weekly-archive-card">
          <header><div><span>历史归档</span><h3>已保存的周报</h3></div><em>{reports.length} 份</em></header>
          <div className="weekly-archive-list">{reports.length ? reports.slice(0, 5).map((report) => <div key={report.id}><span><b>{report.weekStart}—{report.weekEnd}</b><small>{report.edition} · {new Date(report.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small></span><button onClick={() => navigator.clipboard?.writeText(report.content)}>复制</button></div>) : <p className="weekly-empty">保存本周周报后，会在这里形成历史记录。</p>}</div>
        </section>
      </aside>
    </div>
  </div>;
}

function Schedule({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const periodLabels = ["早读", "第1节", "第2节", "第3节", "第4节", "第5节", "午间", "延时"];
  const templateCourses = ["语文", "数学", "英语", "科学", "体育", "音乐", "美术", "劳动", "阅读", "班会", "信息"];
  const savedWeekPlan = data.weeklyPlan ?? [];
  const weekPlan = days.map((day, index) => savedWeekPlan[index] ?? { day: day.replace("星期", "周"), focus: "班级常规", event: "记录作业、积分、沟通事项" });
  const courseRows = Math.max(6, ...data.courses.map((row) => row.length), 0);
  const todayIndex = Math.max(0, Math.min(4, new Date().getDay() - 1));
  const todayCourses = data.courses[todayIndex] ?? [];
  const filledCells = data.courses.flat().filter((item) => item.trim()).length;
  const filledPlans = savedWeekPlan.filter((item) => item.focus.trim() || item.event.trim()).length;
  const hasScheduleData = filledCells > 0 || filledPlans > 0;
  const upcomingArrangements = weekPlan
    .map((item, index) => ({ ...item, index, courses: data.courses[index]?.filter(Boolean) ?? [] }))
    .filter((item) => item.event.trim() || item.focus.trim() || item.courses.length)
    .slice(todayIndex, todayIndex + 3);
  const recentArrangements = upcomingArrangements.length
    ? upcomingArrangements
    : weekPlan.slice(todayIndex, todayIndex + 3).map((item, offset) => ({ ...item, index: todayIndex + offset, courses: data.courses[todayIndex + offset]?.filter(Boolean) ?? [] }));
  const subjectStats = data.courses.flat().filter(Boolean).reduce((result, subject) => {
    result[subject] = (result[subject] ?? 0) + 1;
    return result;
  }, {} as Record<string, number>);
  const topSubjects = Object.entries(subjectStats).sort((a, b) => b[1] - a[1]).slice(0, 4);

  function normalizeCourses(courses: string[][]) {
    return days.map((_, dayIndex) => Array.from({ length: courseRows }, (__, period) => courses[dayIndex]?.[period] ?? ""));
  }
  function changeCourse(day: number, period: number, value: string) {
    update((current) => ({ ...current, courses: normalizeCourses(current.courses).map((row, rowIndex) => rowIndex === day ? row.map((course, colIndex) => colIndex === period ? value : course) : row) }));
  }
  function changePlan(index: number, patch: Partial<{ day: string; focus: string; event: string }>) {
    update((current) => ({ ...current, weeklyPlan: weekPlan.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  }
  function applyPrimaryTemplate() {
    update((current) => ({
      ...current,
      courses: [
        ["语文", "数学", "英语", "体育", "阅读", "班会"],
        ["数学", "语文", "科学", "音乐", "劳动", "写字"],
        ["英语", "数学", "语文", "美术", "信息", "社团"],
        ["语文", "体育", "数学", "科学", "阅读", "综合"],
        ["数学", "语文", "英语", "劳动", "班会", "社团"],
      ],
    }));
  }
  function clearSchedule() {
    if (!window.confirm("确认清空当前课程表吗？周计划不会被清空。")) return;
    update((current) => ({ ...current, courses: days.map(() => Array.from({ length: courseRows }, () => "")) }));
  }
  return <>
    <ToolHeading
      kicker="课程与日程"
      title="把课程表、周重点和课前提醒放在一页"
      text="课程表可直接编辑；每天的重点和事件会进入班级周报，适合打印、手机查看和周一快速调整。"
      action={<button className="primary-small" onClick={() => window.print()}>打印课程日程</button>}
    />
    {!hasScheduleData && <section className="schedule-empty-guide">
      <div>
        <span>首次使用引导</span>
        <h3>先把一周框架搭起来，再每天微调</h3>
        <p>参考课程表模板的“周一到周五、上午下午、节次/午间/延时”结构，建议先套用模板，再补班会、活动和每天重点。</p>
      </div>
      <ol>
        <li>套用小学模板，得到可编辑的五天课程表。</li>
        <li>把“午餐、午睡、延时、班会”等真实日程也填进节次。</li>
        <li>在周计划里写每天重点和班会/活动安排，周报会同步读取。</li>
      </ol>
    </section>}
    <section className="schedule-overview">
      <article><span>本周课程格</span><b>{filledCells}</b><p>已填写的课程安排</p></article>
      <article><span>今日课程</span><b>{todayCourses.filter(Boolean).length}</b><p>{days[todayIndex]}需要提前准备</p></article>
      <article><span>周重点</span><b>{filledPlans}</b><p>同步到班级周报</p></article>
      <article><span>高频学科</span><b>{topSubjects[0]?.[0] ?? "待填"}</b><p>{topSubjects[0] ? `本周 ${topSubjects[0][1]} 次` : "填写后自动统计"}</p></article>
    </section>
    <section className="schedule-workbench">
      <div className="schedule-main-card">
        <div className="schedule-card-head">
          <div><span>可编辑课程表</span><h3>本周课程安排</h3><p>点任意格子即可修改，右上角保存后写入当前班级数据。</p></div>
          <div className="schedule-actions"><button onClick={applyPrimaryTemplate}>套用小学模板</button><button className="soft" onClick={clearSchedule}>清空课程</button></div>
        </div>
        <div className="course-palette">{[...templateCourses, "早餐", "午餐", "午睡"].map((subject) => <button key={subject} type="button">{subject}</button>)}</div>
        <div className="schedule-scroll">
          <div className="schedule-grid rich-schedule-grid">
            <div className="schedule-corner">节次</div>
            {days.map((d, dayIndex) => <b className={dayIndex === todayIndex ? "today-col" : ""} key={d}>{d}<small>{dayIndex === todayIndex ? "今天" : weekPlan[dayIndex]?.focus}</small></b>)}
            {Array.from({ length: courseRows }, (_, period) => <div className="schedule-row" key={period}>
              <span>{periodLabels[period] ?? `第${period + 1}节`}</span>
              {days.map((_, day) => <div className={`editable-cell ${day === todayIndex ? "today-cell" : ""}`} key={day}><input value={data.courses[day]?.[period] ?? ""} onChange={(event) => changeCourse(day, period, event.target.value)} placeholder="填课程" /></div>)}
            </div>)}
          </div>
        </div>
      </div>
      <aside className="today-brief">
        <div className="today-brief-head"><span>今日课务</span><b>{days[todayIndex]}</b></div>
        {todayCourses.filter(Boolean).length ? todayCourses.map((course, index) => course && <div className="today-course" key={`${course}-${index}`}><i>{periodLabels[index] ?? `第${index + 1}节`}</i><span><b>{course}</b><small>{course === "体育" ? "提醒学生穿运动鞋" : course === "美术" ? "检查工具材料" : course === "班会" ? "准备班级常规议题" : "确认教材、作业和课堂任务"}</small></span></div>) : <p className="empty-schedule">今天还没有填写课程。</p>}
        <div className="today-plan-note">
          <span>今日重点</span>
          <b>{weekPlan[todayIndex]?.focus || "待填写"}</b>
          <small>{weekPlan[todayIndex]?.event || "可补充班会、活动、放学提醒或特殊安排。"}</small>
        </div>
        <div className="subject-cloud"><b>本周学科分布</b>{topSubjects.map(([subject, count]) => <span key={subject}>{subject}<em>{count}</em></span>)}</div>
      </aside>
    </section>
    <section className="schedule-arrangements">
      <div className="schedule-card-head compact"><div><span>近期安排</span><h3>班会、活动和特殊日程</h3><p>手机端优先看这里：今天到后两天要上什么课、有什么事，一眼能确认。</p></div></div>
      <div className="arrangement-grid">
        {recentArrangements.map((item) => <article key={item.day}>
          <header><b>{item.day}</b><span>{item.index === todayIndex ? "今天" : "近期"}</span></header>
          <p>{item.event || "暂无班会或活动安排"}</p>
          <small>{item.focus || "本日重点待补充"}</small>
          <div>{(item.courses ?? []).slice(0, 5).map((course) => <em key={course}>{course}</em>)}</div>
        </article>)}
      </div>
    </section>
    <section className="week-plan-editor">
      <div className="schedule-card-head compact"><div><span>周计划</span><h3>每天一个重点，一件必须处理的事</h3><p>这些内容会被班级周报读取，建议保持短句，方便周五汇总。</p></div></div>
      <div className="week-plan-grid">{weekPlan.map((item, index) => <article key={item.day}>
        <input value={item.day} onChange={(event) => changePlan(index, { day: event.target.value })} />
        <label>本日重点<input value={item.focus} onChange={(event) => changePlan(index, { focus: event.target.value })} /></label>
        <label>班会 / 活动安排<textarea value={item.event} onChange={(event) => changePlan(index, { event: event.target.value })} /></label>
      </article>)}</div>
    </section>
  </>;
}

function Seating({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [lastStudents, setLastStudents] = useState<Student[] | null>(null);
  const [needsOpen, setNeedsOpen] = useState(false);
  const config: SeatingConfig = data.seatingConfig ?? { rows: 6, columns: 6, groupCount: Math.max(1, ...data.students.map((student) => student.group || 1)), aisleAfter: [2, 4] };
  const capacity = config.rows * config.columns;
  const sortedStudents = [...data.students].sort((a, b) => a.seat - b.seat);
  const studentBySeat = new Map(sortedStudents.map((student) => [student.seat, student]));
  const needs = ["无", "前排", "后排", "靠窗", "靠过道"] as const;

  function groupForSeat(seat: number, nextConfig = config) {
    const column = (seat - 1) % nextConfig.columns;
    if (nextConfig.groupCount <= nextConfig.columns) return Math.min(nextConfig.groupCount, Math.floor(column * nextConfig.groupCount / nextConfig.columns) + 1);
    return Math.min(nextConfig.groupCount, Math.floor((seat - 1) * nextConfig.groupCount / (nextConfig.rows * nextConfig.columns)) + 1);
  }

  function syncStudents(current: ClassroomData, students: Student[]): ClassroomData {
    const activeClassId = current.activeClassId ?? current.rosterClasses?.[0]?.id;
    return {
      ...current,
      students,
      rosterClasses: current.rosterClasses?.map((item) => item.id === activeClassId ? { ...item, students } : item),
    };
  }

  function remember() {
    setLastStudents(data.students.map((student) => ({ ...student })));
  }

  function updateConfig(patch: Partial<SeatingConfig>) {
    update((current) => {
      const currentConfig = current.seatingConfig ?? config;
      const columns = Math.max(2, Math.min(10, patch.columns ?? currentConfig.columns));
      const rows = Math.max(Math.ceil(current.students.length / columns), Math.max(1, Math.min(12, patch.rows ?? currentConfig.rows)));
      const groupCount = Math.max(1, Math.min(12, patch.groupCount ?? currentConfig.groupCount));
      const aisleAfter = (patch.aisleAfter ?? currentConfig.aisleAfter).filter((column) => column > 0 && column < columns);
      const seatingConfig = { rows, columns, groupCount, aisleAfter };
      const students = current.students.map((student) => ({ ...student, group: groupForSeat(student.seat, seatingConfig) }));
      return syncStudents({ ...current, seatingConfig }, students);
    });
    setMessage("教室布局已更新，现有座位保持不变。超出容量时会自动补足排数。");
  }

  function swapStudentTo(studentId: string, targetSeat: number) {
    if (targetSeat < 1 || targetSeat > capacity) return;
    remember();
    update((current) => {
      const first = current.students.find((item) => item.id === studentId);
      const second = current.students.find((item) => item.seat === targetSeat);
      if (!first || first.seat === targetSeat) return current;
      const students = current.students.map((item) => {
        if (item.id === first.id) return { ...item, seat: targetSeat, group: groupForSeat(targetSeat) };
        if (second && item.id === second.id) return { ...item, seat: first.seat, group: groupForSeat(first.seat) };
        return item;
      });
      return syncStudents(current, students);
    });
    setSelected(null);
    setMessage("座位已调整，可继续换座或使用“撤销上一步”。");
  }

  function chooseSeat(seat: number, student?: Student) {
    if (!selected) {
      if (!student) return setMessage("这是一个空座位，请先选择要移动的学生。");
      setSelected(student.id);
      setMessage(`已选择 ${student.name}，再点学生或空座位即可调整。`);
      return;
    }
    if (selected === student?.id) {
      setSelected(null);
      setMessage("已取消选择。");
      return;
    }
    swapStudentTo(selected, seat);
  }

  function isAisleSeat(seat: number, nextConfig = config) {
    const column = (seat - 1) % nextConfig.columns + 1;
    return nextConfig.aisleAfter.some((after) => column === after || column === after + 1);
  }

  function mateSeat(seat: number, nextConfig = config) {
    const column = (seat - 1) % nextConfig.columns;
    if (column % 2 === 0) return column + 1 < nextConfig.columns ? seat + 1 : 0;
    return seat - 1;
  }

  function smartArrange() {
    remember();
    update((current) => {
      const nextConfig = current.seatingConfig ?? config;
      const maxSeat = nextConfig.rows * nextConfig.columns;
      const allSeats = Array.from({ length: maxSeat }, (_, index) => index + 1);
      const fixedSeats = new Set<number>();
      const fixedIds = new Set<string>();
      const placed = new Map<number, Student>();
      for (const student of current.students) {
        if (student.seatFixed && student.seat >= 1 && student.seat <= maxSeat && !fixedSeats.has(student.seat)) {
          fixedSeats.add(student.seat);
          fixedIds.add(student.id);
          placed.set(student.seat, student);
        }
      }
      const candidates = allSeats.filter((seat) => !fixedSeats.has(seat));
      for (let index = candidates.length - 1; index > 0; index -= 1) {
        const pick = Math.floor(Math.random() * (index + 1));
        [candidates[index], candidates[pick]] = [candidates[pick], candidates[index]];
      }
      const movable = current.students.filter((student) => !fixedIds.has(student.id)).sort((a, b) => {
        const aPriority = a.seatNeed && a.seatNeed !== "无" ? 1 : 0;
        const bPriority = b.seatNeed && b.seatNeed !== "无" ? 1 : 0;
        return bPriority - aPriority || (b.height ?? 0) - (a.height ?? 0);
      });
      const assigned = new Map<string, number>();
      for (const student of movable) {
        const valid = candidates.filter((seat) => {
          const mate = placed.get(mateSeat(seat, nextConfig));
          return !mate || (student.avoidWith !== mate.id && mate.avoidWith !== student.id);
        });
        const pool = valid.length ? valid : candidates;
        const ranked = pool.map((seat) => {
          const row = Math.floor((seat - 1) / nextConfig.columns) + 1;
          const column = (seat - 1) % nextConfig.columns;
          let score = Math.random();
          if (student.seatNeed === "前排") score += (nextConfig.rows - row + 1) * 20;
          if (student.seatNeed === "后排") score += row * 20;
          if (student.seatNeed === "靠窗") score += column === 0 || column === nextConfig.columns - 1 ? 120 : 0;
          if (student.seatNeed === "靠过道") score += isAisleSeat(seat, nextConfig) ? 120 : 0;
          if (student.height) score += row * student.height / 20;
          return { seat, score };
        }).sort((a, b) => b.score - a.score);
        const chosen = ranked[0]?.seat;
        if (!chosen) continue;
        assigned.set(student.id, chosen);
        placed.set(chosen, student);
        candidates.splice(candidates.indexOf(chosen), 1);
      }
      const students = current.students.map((student) => {
        const seat = assigned.get(student.id) ?? student.seat;
        return { ...student, seat, group: groupForSeat(seat, nextConfig) };
      });
      return syncStudents(current, students);
    });
    setSelected(null);
    setMessage("智能排座已完成：固定座保留，并优先处理特殊座位和不能同桌要求。");
  }

  function rotateRows() {
    remember();
    update((current) => {
      const fixedSeats = new Set(current.students.filter((student) => student.seatFixed).map((student) => student.seat));
      const movable = [...current.students].filter((student) => !student.seatFixed).sort((a, b) => a.seat - b.seat);
      const targetSeats = movable.map((student) => student.seat).filter((seat) => !fixedSeats.has(seat));
      const shift = Math.min(config.columns, Math.max(1, targetSeats.length - 1));
      const targetById = new Map(movable.map((student, index) => [student.id, targetSeats[(index - shift + targetSeats.length) % targetSeats.length]]));
      const students = current.students.map((student) => {
        const seat = targetById.get(student.id) ?? student.seat;
        return { ...student, seat, group: groupForSeat(seat) };
      });
      return syncStudents(current, students);
    });
    setSelected(null);
    setMessage("已完成一轮前后排轮换，固定座位未移动。");
  }

  function undo() {
    if (!lastStudents) return;
    update((current) => syncStudents(current, lastStudents));
    setLastStudents(null);
    setSelected(null);
    setMessage("已撤销上一步座位调整。");
  }

  function editStudent(id: string, patch: Partial<Student>) {
    update((current) => syncStudents(current, current.students.map((student) => student.id === id ? { ...student, ...patch } : student)));
  }

  function setLeader(student: Student) {
    update((current) => syncStudents(current, current.students.map((item) => item.group === student.group ? { ...item, groupLeader: item.id === student.id } : item)));
    setMessage(`${student.name} 已设为第${student.group}组组长。`);
  }

  function regroupBySeat() {
    remember();
    update((current) => syncStudents(current, current.students.map((student) => ({ ...student, group: groupForSeat(student.seat) }))));
    setMessage("已按当前座位列重新分组，每组人数会随座位自动变化。");
  }

  const groups = Array.from({ length: config.groupCount }, (_, index) => {
    const number = index + 1;
    return { number, students: sortedStudents.filter((student) => student.group === number) };
  });
  const specialCount = data.students.filter((student) => student.seatFixed || (student.seatNeed && student.seatNeed !== "无") || student.avoidWith).length;

  return <>
    <ToolHeading kicker="座位与分组" title="把真实教室排成一张能调整、能打印的座位表" text="名单自动带入；电脑端可拖动或点选换座，手机端用学生卡片操作。" action={<div className="seat-heading-actions"><button className="soft-action" onClick={rotateRows}>前后排轮换</button><button className="primary-small" onClick={smartArrange}>智能排座</button></div>} />
    <section className="seat-summary">
      <article><span>当前学生</span><b>{data.students.length}</b><small>来自当前班级名单</small></article>
      <article><span>教室容量</span><b>{capacity}</b><small>{config.rows}排 × {config.columns}列</small></article>
      <article><span>学习小组</span><b>{config.groupCount}</b><small>按座位列自动分组</small></article>
      <article><span>特殊安排</span><b>{specialCount}</b><small>固定座 / 座位需求 / 避让</small></article>
    </section>
    <section className="seat-controls paper-card">
      <div className="seat-control-fields">
        <label>教室排数<input type="number" min={1} max={12} value={config.rows} onChange={(event) => updateConfig({ rows: Number(event.target.value) || 1 })} /></label>
        <label>每排列数<input type="number" min={2} max={10} value={config.columns} onChange={(event) => updateConfig({ columns: Number(event.target.value) || 2 })} /></label>
        <label>小组数量<input type="number" min={1} max={12} value={config.groupCount} onChange={(event) => updateConfig({ groupCount: Number(event.target.value) || 1 })} /></label>
      </div>
      <div className="aisle-control"><b>过道位置</b>{Array.from({ length: config.columns - 1 }, (_, index) => index + 1).map((column) => <label key={column}><input type="checkbox" checked={config.aisleAfter.includes(column)} onChange={() => updateConfig({ aisleAfter: config.aisleAfter.includes(column) ? config.aisleAfter.filter((item) => item !== column) : [...config.aisleAfter, column] })} />第{column}列后</label>)}</div>
      <div className="seat-control-actions"><button onClick={regroupBySeat}>按座位重新分组</button><button disabled={!lastStudents} onClick={undo}>撤销上一步</button><button onClick={() => window.print()}>打印完整座位表</button></div>
    </section>
    {message && <div className="inline-alert seat-message" onClick={() => setMessage("")}>{message}<span>×</span></div>}
    <div className="seat-instruction"><b>{selected ? `已选择 ${data.students.find((student) => student.id === selected)?.name ?? "学生"}` : "手动调整座位"}</b><span>{selected ? "再点另一名学生或空座位即可移动；电脑端也可以直接拖动" : "先点一名学生，再点目标座位；固定座只限制自动排座"}</span></div>
    <section className="seating-workspace">
      <div className="seating-wrap seating-advanced">
        <div className="blackboard">黑 板</div>
        <div className="classroom-orientation"><span>前门</span><b>面向黑板</b><span>窗户</span></div>
        <div className="seat-grid advanced-grid" style={{ gridTemplateColumns: `repeat(${config.columns}, minmax(76px, 1fr))` }}>
          {Array.from({ length: capacity }, (_, index) => index + 1).map((seat) => {
            const student = studentBySeat.get(seat);
            const column = (seat - 1) % config.columns + 1;
            const row = Math.floor((seat - 1) / config.columns) + 1;
            const aisleEdge = config.aisleAfter.includes(column);
            return <button
              className={`seat-slot ${student ? "occupied" : "empty"} ${student && selected === student.id ? "selected" : ""} ${student?.seatFixed ? "fixed" : ""} ${aisleEdge ? "aisle-edge" : ""}`}
              aria-label={`${student?.name ?? "空座"} 座位${seat}`}
              draggable={Boolean(student)}
              onDragStart={() => { if (student) setDragged(student.id); }}
              onDragEnd={() => setDragged(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); if (dragged) swapStudentTo(dragged, seat); setDragged(null); }}
              onClick={() => chooseSeat(seat, student)}
              key={seat}
            >
              <small>{row}排{column}列 · 座{seat}</small>
              {student ? <><span>{student.name}{student.groupLeader ? <i>组长</i> : null}</span><em>第{student.group}组 · {student.studentNo || "未填学号"}</em><strong>{student.seatFixed ? "固定座" : student.seatNeed && student.seatNeed !== "无" ? student.seatNeed : student.avoidWith ? "需避让" : "可调整"}</strong></> : <><span>空座</span><em>可移动学生到这里</em></>}
            </button>;
          })}
        </div>
        <div className="teacher-desk">讲 台</div>
        <div className="classroom-back"><span>后门</span><b>教室后方</b><span>卫生角</span></div>
      </div>
      <aside className="seat-groups-panel">
        <header><div><span>分组管理</span><h3>当前小组</h3></div><button onClick={regroupBySeat}>按座位更新</button></header>
        {groups.map((group) => <article key={group.number}><div><b>第{group.number}组</b><span>{group.students.length}人</span></div><p>{group.students.map((student) => <button className={student.groupLeader ? "leader" : ""} aria-label={`将${student.name}设为第${student.group}组组长`} onClick={() => setLeader(student)} title="点击设为组长" key={student.id}>{student.name}{student.groupLeader ? " · 组长" : ""}</button>)}</p></article>)}
        <small>点击组员姓名可设为本组组长。小组信息会供值日轮换和积分统计复用。</small>
      </aside>
    </section>
    <section className="mobile-seat-list">
      <header><b>手机调整座位</b><span>先点学生，再点目标学生或空座</span></header>
      {Array.from({ length: capacity }, (_, index) => index + 1).map((seat) => { const student = studentBySeat.get(seat); return <button aria-label={`${student?.name ?? "空座"} 座位${seat}`} className={`${selected === student?.id ? "selected" : ""} ${student ? "" : "empty"}`} onClick={() => chooseSeat(seat, student)} key={seat}><i>{student?.name.slice(0, 1) ?? "空"}</i><span><b>{student?.name ?? "空座位"}</b><small>座{seat} · {student ? `第${student.group}组` : "可移动到此处"}</small></span><em>{student?.seatFixed ? "固定座" : student?.seatNeed && student.seatNeed !== "无" ? student.seatNeed : "调整"}</em></button>; })}
    </section>
    <section className="seat-needs-card">
      <header><div><span>排座条件</span><h3>特殊座位与不能同桌</h3><p>智能排座会优先满足这些条件；固定座在自动排座和前后轮换时保持不动。</p></div><button onClick={() => setNeedsOpen((open) => !open)}>{needsOpen ? "收起设置" : `展开设置（${specialCount}项）`}</button></header>
      {needsOpen && <div className="seat-needs-table"><div className="seat-needs-head"><span>学生</span><span>身高(cm)</span><span>座位需求</span><span>不能同桌</span><span>固定座</span><span>小组</span></div>{sortedStudents.map((student) => <div className="seat-needs-row" key={student.id}><b>{student.name}<small>当前座{student.seat}</small></b><input aria-label={`${student.name}身高`} type="number" min={80} max={220} value={student.height ?? ""} placeholder="选填" onChange={(event) => editStudent(student.id, { height: event.target.value ? Number(event.target.value) : undefined })} /><select aria-label={`${student.name}座位需求`} value={student.seatNeed ?? "无"} onChange={(event) => editStudent(student.id, { seatNeed: event.target.value as Student["seatNeed"] })}>{needs.map((need) => <option key={need}>{need}</option>)}</select><select aria-label={`${student.name}不能同桌`} value={student.avoidWith ?? ""} onChange={(event) => editStudent(student.id, { avoidWith: event.target.value })}><option value="">无</option>{data.students.filter((item) => item.id !== student.id).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><label className="fixed-check"><input aria-label={`${student.name}固定座`} type="checkbox" checked={Boolean(student.seatFixed)} onChange={(event) => editStudent(student.id, { seatFixed: event.target.checked })} />{student.seatFixed ? "已固定" : "不固定"}</label><select aria-label={`${student.name}小组`} value={student.group} onChange={(event) => editStudent(student.id, { group: Number(event.target.value) })}>{groups.map((group) => <option value={group.number} key={group.number}>第{group.number}组</option>)}</select></div>)}</div>}
    </section>
  </>;
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


