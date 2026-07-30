"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CadreRole, ClassroomData, CommunicationRecord, DutyJob, DutyRecord, ExamReflection, GrowthEvidence, HomeworkTask, PointEvent, PointRule, RosterClass, ScoreExam, SeatingConfig, Student, TermComment } from "@/lib/classroom";
import { CourseSchedule } from "./CourseSchedule";

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
const shortDays = ["周一", "周二", "周三", "周四", "周五"];
const defaultDutyJobs: DutyJob[] = [
  { id: "dj-floor", name: "地面保洁", area: "教室地面、桌椅间", standard: "无明显纸屑，桌椅摆正，放学前复查一次。", enabled: true },
  { id: "dj-board", name: "黑板讲台", area: "黑板、粉笔槽、讲台", standard: "课间擦净黑板，粉笔和教具归位。", enabled: true },
  { id: "dj-corridor", name: "走廊门窗", area: "走廊、门窗、窗台", standard: "走廊无杂物，窗台不堆放个人物品。", enabled: true },
  { id: "dj-corner", name: "卫生角", area: "扫把、拖把、垃圾桶", standard: "工具摆放整齐，垃圾桶及时清理。", enabled: true },
  { id: "dj-books", name: "图书角", area: "图书角、阅读柜", standard: "图书按类归位，破损图书单独放置。", enabled: true },
];

function today() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function defaultScoreExam(students: Student[], classId: string): ScoreExam {
  return {
    id: "exam-default",
    classId,
    title: "最近一次学情检测",
    date: today(),
    subjects: ["语文", "数学", "英语"],
    scores: Object.fromEntries(students.map((student, index) => [student.id, {
      语文: Math.max(0, Math.min(100, student.score + [-2, 1, 0, -4, 3][index % 5])),
      数学: Math.max(0, Math.min(100, student.score + [3, -1, 2, -6, 0][index % 5])),
      英语: Math.max(0, Math.min(100, student.score + [0, 2, -3, 1, -2][index % 5])),
    }])),
  };
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
    dutyJobs: data.dutyJobs?.length ? data.dutyJobs.map((job) => ({ ...job, enabled: job.enabled !== false })) : defaultDutyJobs,
    dutyRecords: data.dutyRecords ?? [],
    records: (data.records ?? []).map((record) => ({ ...record, channel: record.channel ?? "面谈", followUp: record.followUp ?? "", status: record.status ?? "待跟进" })),
    cadres: data.cadres?.length ? data.cadres.map((role) => ({ ...role, scope: role.scope ?? "班级管理", term: role.term ?? "本学期", status: role.status ?? "在任", weeklyScore: role.weeklyScore ?? 4, summary: role.summary ?? "填写本周履职表现。" })) : [
      { id: "c1", role: "班长", studentId: students[0]?.id ?? "", duty: "协助班主任管理班级常规。", scope: "班级常规", term: "本学期", status: "在任", weeklyScore: 5, summary: "能主动提醒同学，适合继续培养组织能力。" },
      { id: "c2", role: "学习委员", studentId: students[1]?.id ?? "", duty: "组织早读，记录作业缺交。", scope: "学习管理", term: "本学期", status: "在任", weeklyScore: 4, summary: "作业反馈及时，早读组织还可以更大胆。" },
      { id: "c3", role: "劳动委员", studentId: students[2]?.id ?? "", duty: "安排和检查卫生岗位。", scope: "卫生值日", term: "本学期", status: "在任", weeklyScore: 5, summary: "检查细致，能把值日问题及时反馈给老师。" },
    ],
    scoreExams: data.scoreExams?.length ? data.scoreExams : [defaultScoreExam(students, activeClassId)],
    examReflections: data.examReflections ?? [],
    termComments: data.termComments ?? [],
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
          {active === "schedule" && <CourseSchedule data={workspace.data} update={updateData} />}
          {active === "seating" && <Seating data={workspace.data} update={updateData} />}
          {active === "duty" && <Duty data={workspace.data} update={updateData} />}
          {active === "cadres" && <Cadres data={workspace.data} update={updateData} />}
          {active === "records" && <Records data={workspace.data} update={updateData} />}
          {active === "scores" && <Scores data={workspace.data} update={updateData} />}
          {active === "reflection" && <Reflection data={workspace.data} update={updateData} />}
          {active === "comments" && <Comments data={workspace.data} update={updateData} />}
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
  const activeClass = data.rosterClasses?.find((item) => item.id === data.activeClassId) ?? data.rosterClasses?.[0];
  const classStudents = activeClass?.students?.length ? activeClass.students : data.students;
  const tasks = data.homeworkTasks?.filter((item) => !item.classId || item.classId === (activeClass?.id ?? data.activeClassId)) ?? [];
  const notDone = tasks.reduce((count, task) => count + Object.values(task.statuses).filter((s) => s !== "已交" && s !== "已复查").length, 0);
  const attention = data.students.filter((s) => s.score < 80 || s.attendance !== "正常" || s.homework !== "已交");
  const top = [...classStudents].sort((a, b) => b.points - a.points).slice(0, 10);
  const now = new Date();
  const todayLabel = now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
  const todayTasks = tasks.filter((item) => item.date === today()).length;
  const doneCount = tasks.reduce((count, task) => count + classStudents.filter((student) => {
    const status = task.statuses[student.id] ?? student.homework;
    return status === "已交" || status === "已复查";
  }).length, 0);
  const totalChecks = Math.max(1, tasks.length * classStudents.length);
  const dutyJobs = (data.dutyJobs?.length ? data.dutyJobs : defaultDutyJobs).filter((job) => job.enabled).slice(0, 4);
  const dutyStudents = dutyJobs.map((job, index) => {
    const assigned = job.studentIds?.map((id) => classStudents.find((student) => student.id === id)).find(Boolean);
    return { job, student: assigned ?? classStudents[index % Math.max(1, classStudents.length)] };
  });
  return <>
    <section className="welcome"><div><span className="eyebrow">{activeClass?.name ?? "当前班级"} · 每日工作台</span><h2>{todayLabel}，先看待办再进功能。</h2><p>把学生名单、作业、积分、值日、沟通和评语串在一起，班主任每天打开后能迅速知道今天先处理什么。</p></div><div className="date-badge"><b>{now.getDate()}</b><span>{now.toLocaleDateString("zh-CN", { month: "long" })}</span></div></section>
    <section className="daily-grid">
      <button onClick={() => open("students")}><b>学生名单</b><span>批量导入、编辑电话和备注</span></button>
      <button onClick={() => open("homework")}><b>作业管理</b><span>发布、批改、跟进未交作业</span></button>
      <button onClick={() => open("points")}><b>积分事件</b><span>快速记录表扬和提醒</span></button>
      <button onClick={() => open("scores")}><b>成绩管理</b><span>录入考试并查看波动</span></button>
    </section>
    <div className="workbench-split">
      <section className="todo-section"><h3><span>!</span>待办事项</h3>
        <div className="todo-line"><i>{notDone}</i><div><b>作业状态待处理</b><small>未交、待订正、未复查都汇总在这里</small></div><button onClick={() => open("homework")}>处理</button></div>
        <div className="todo-line"><i>{attention.length}</i><div><b>重点关注学生</b><small>成绩、考勤或作业出现异常</small></div><button onClick={() => open("growth")}>查看</button></div>
        <div className="todo-line"><i>{data.records.length}</i><div><b>本周沟通记录</b><small>可沉淀到成长档案和期末评语</small></div><button onClick={() => open("records")}>记录</button></div>
      </section>
      <section className="weekly-stats"><h3><span>▦</span>本周数据看板</h3><div className="stat-mini-grid">
        <article><span>学生总数</span><b>{classStudents.length}</b><small>{activeClass?.name ?? "当前班级"}</small></article>
        <article><span>今日作业</span><b>{todayTasks}</b><small>今天布置的任务</small></article>
        <article><span>完成率</span><b>{Math.round(doneCount / totalChecks * 100)}%</b><small>已交与已复查占比</small></article>
        <article><span>待跟进</span><b>{attention.length}</b><small>建议优先沟通</small></article>
      </div></section>
      <section className="duty-today"><h3><span>值</span>今日值日</h3>{dutyStudents.map(({ job, student }) => <div className="duty-card" key={job.id}><i className="avatar-mini">{student?.name.slice(0, 1) ?? "待"}</i><div><b>{student?.name ?? "待安排"}</b><small>{job.name} · {job.area}</small></div></div>)}</section>
      <section className="rank-section"><h3><span>积分排行榜</span><small>TOP 10</small></h3>{top.map((s, index) => <div className="rank-line" key={s.id}><b className="rank-badge">{index + 1}</b><span>{s.name}</span><strong>{s.points}</strong><small>分</small></div>)}</section>
    </div>
  </>;
}

function Students({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [bulk, setBulk] = useState("张三 13800000001 备注可不填\n李四 13800000002\n王五 13800000003");
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [editMode, setEditMode] = useState(false);
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
  const boys = classStudents.filter((s) => s.gender === "男").length;
  const girls = classStudents.filter((s) => s.gender === "女").length;
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
    const target = classStudents.find((student) => student.id === id);
    if (target && !window.confirm(`确认删除 ${target.name} 吗？删除后该学生的作业状态、积分记录和班干部岗位会同步清理。`)) return;
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
  function exportRoster() {
    const header = ["学号", "姓名", "性别", "小组", "座位", "家长电话", "备注"];
    const rows = classStudents.map((student) => [
      student.studentNo ?? "",
      student.name,
      student.gender,
      `第${student.group}组`,
      `${student.seat}`,
      student.parentPhone ?? "",
      student.note ?? "",
    ]);
    const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeClass.name || "学生名单"}-${today()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage(`已导出 ${activeClass.name} 的学生名单。`);
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
      <article><span>总人数</span><b>{classStudents.length}</b></article>
      <article><span>男生</span><b>{boys}</b></article>
      <article><span>女生</span><b>{girls}</b></article>
      <article><span>已填电话</span><b>{withPhone}</b><small>{groups} 个学习小组</small></article>
    </section>
    <section className="import-card roster-import"><div><h3>批量导入名单</h3><p>每行一个学生，格式建议：姓名 手机号 备注。可以“替换当前名单”，也可以“追加到末尾”。</p></div><textarea value={bulk} onChange={(e) => setBulk(e.target.value)} /><div className="import-actions"><button onClick={replaceNames}>替换当前名单</button><button className="soft-action" onClick={appendNames}>追加学生</button></div></section>
    {message && <div className="inline-alert roster-message" onClick={() => setMessage("")}>{message}<span>×</span></div>}
    <div className="roster-toolbar"><div className="resource-search compact-search"><span>⌕</span><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="搜索姓名、学号、电话、备注、小组或座位" /></div><select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}><option value={10}>每页10人</option><option value={20}>每页20人</option><option value={50}>每页50人</option></select><button className="soft-action" onClick={exportRoster}>导出Excel</button><button className={`toggle-edit ${editMode ? "active" : ""}`} onClick={() => setEditMode((value) => !value)}><span>{editMode ? "✓" : "✎"}</span>{editMode ? "编辑中" : "编辑模式"}</button><small>{editMode ? "现在可以直接修改表格。" : "当前为只读展示，打开编辑模式后再改资料。"}</small></div>
    <section className="editable-student-table roster-table">
      <div className="student-edit-head roster"><span>学号</span><span>姓名</span><span>性别</span><span>小组</span><span>座位</span><span>家长电话</span><span>备注</span><span>操作</span></div>
      {pageItems.map((s) => <div className="student-edit-line full" key={s.id}>
        <input disabled={!editMode} value={s.studentNo ?? ""} onChange={(e) => edit(s.id, { studentNo: e.target.value })} />
        <input disabled={!editMode} value={s.name} onChange={(e) => edit(s.id, { name: e.target.value })} />
        <select disabled={!editMode} value={s.gender} onChange={(e) => edit(s.id, { gender: e.target.value as Student["gender"] })}><option>女</option><option>男</option></select>
        <input disabled={!editMode} type="number" value={s.group} onChange={(e) => edit(s.id, { group: Number(e.target.value) || 1 })} />
        <input disabled={!editMode} type="number" value={s.seat} onChange={(e) => edit(s.id, { seat: Number(e.target.value) || 1 })} />
        <input disabled={!editMode} value={s.parentPhone ?? ""} onChange={(e) => edit(s.id, { parentPhone: e.target.value })} />
        <input disabled={!editMode} value={s.note ?? ""} onChange={(e) => edit(s.id, { note: e.target.value })} />
        <button className="danger-small" disabled={!editMode} onClick={() => removeStudent(s.id)}>删除</button>
      </div>)}
      {!pageItems.length && <div className="empty-roster"><span>名</span><p>当前没有学生，先粘贴名单导入，或切换到其他班级。</p></div>}
    </section>
    <section className="roster-mobile-list">
      {pageItems.map((s) => <article className="roster-mobile-card" key={s.id}>
        <header><i>{s.name.slice(0,1)}</i><div><input disabled={!editMode} value={s.name} onChange={(e) => edit(s.id, { name: e.target.value })} /><span>学号 {s.studentNo || "未填"} · 第{s.group}组 · 座位{s.seat}</span></div></header>
        <div className="mobile-fields">
          <label>学号<input disabled={!editMode} value={s.studentNo ?? ""} onChange={(e) => edit(s.id, { studentNo: e.target.value })} /></label>
          <label>性别<select disabled={!editMode} value={s.gender} onChange={(e) => edit(s.id, { gender: e.target.value as Student["gender"] })}><option>女</option><option>男</option></select></label>
          <label>小组<input disabled={!editMode} type="number" value={s.group} onChange={(e) => edit(s.id, { group: Number(e.target.value) || 1 })} /></label>
          <label>座位<input disabled={!editMode} type="number" value={s.seat} onChange={(e) => edit(s.id, { seat: Number(e.target.value) || 1 })} /></label>
          <label className="wide">家长电话<input disabled={!editMode} value={s.parentPhone ?? ""} onChange={(e) => edit(s.id, { parentPhone: e.target.value })} /></label>
          <label className="wide">备注<input disabled={!editMode} value={s.note ?? ""} onChange={(e) => edit(s.id, { note: e.target.value })} /></label>
        </div>
        <button className="danger-small" disabled={!editMode} onClick={() => removeStudent(s.id)}>删除这名学生</button>
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
  const totalTaskChecks = Math.max(1, tasks.length * data.students.length);
  const finishedTaskChecks = tasks.reduce((count, item) => count + taskSummary(item).done, 0);
  const overallRate = Math.round(finishedTaskChecks / totalTaskChecks * 100);
  const excellentRate = tasks.length ? Math.round(tasks.filter((item) => taskSummary(item).rate >= 90).length / tasks.length * 100) : 0;

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
      <article><span>总任务</span><b>{tasks.length}</b><p>当前班级全部作业</p></article>
      <article><span>待批改</span><b>{unresolvedTasks}</b><p>存在未交或待订正</p></article>
      <article><span>完成率</span><b>{overallRate}%</b><p>已交和已复查占比</p></article>
      <article><span>优秀率</span><b>{excellentRate}%</b><p>完成率 90% 以上任务</p></article>
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
      <div className="homework-toolbar homework-primary-filters">
        <label className="wide">搜索作业内容<input value={taskKeyword} onChange={(e) => setTaskKeyword(e.target.value)} placeholder="输入学科、页码、练习名称等" /></label>
        <label>归档月份<select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}><option>全部月份</option>{archiveMonths.map((month) => <option key={month} value={month}>{month.replace("-", "年")}月（{monthCounts[month]}项）</option>)}</select></label>
        <label>学科<select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}><option value="全部">全部学科</option>{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
        <label>状态<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}><option>全部</option>{statusOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button className="advanced-toggle" onClick={() => setAdvancedOpen((open) => !open)}>{advancedOpen ? "收起高级查询" : "更多查询条件"}</button>
      </div>
      {advancedOpen && <div className="homework-advanced-filters">
        <label>开始日期<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
        <label>结束日期<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
        <label>查某个学生<input value={studentKeyword} onChange={(e) => setStudentKeyword(e.target.value)} placeholder="姓名或学号" /></label>
        <label>学生小组<select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}><option>全部</option>{groups.map((group) => <option value={group} key={group}>第{group}组</option>)}</select></label>
      </div>}
      {dateFrom && dateTo && dateFrom > dateTo && <p className="homework-hint">日期顺序已自动调整为 {normalizedFrom} 至 {normalizedTo}。</p>}
      <div className="homework-result-bar"><b>{selectedMonth === "全部月份" ? "全部归档" : `${selectedMonth.replace("-", "年")}月`}</b><span>找到 {filteredTasks.length} 项 · 当前第 {safePage} / {totalPages} 页</span></div>
      {filteredTasks.length === 0 && <div className="empty-result"><b>没有找到符合条件的作业</b><span>建议先清空条件，或新增一项作业。</span></div>}
      <div className="homework-list">
      {pagedTasks.map((item) => {
        const summary = taskSummary(item);
        const overdue = item.date < today() && summary.missing > 0;
        const done = summary.rate === 100;
        const badgeClass = overdue ? "overdue" : done ? "done" : summary.fixing ? "grading" : "pending";
        const badgeText = overdue ? "已逾期" : done ? "已完成" : summary.fixing ? "待批改" : "进行中";
        return <article className={`homework-card ${overdue ? "overdue" : done ? "completed" : ""}`} key={item.id}>
          <header className="homework-card-header">
            <div className="homework-card-title"><span className="subject-tag">{item.subject}</span><h4>{item.title}</h4><p>截止：{item.date} · 已交/复查 {summary.done}/{data.students.length || 0} · 未交 {summary.missing} · 待订正 {summary.fixing}</p></div>
            <div className="homework-card-status"><span className={`status-badge ${badgeClass}`}>{badgeText}</span><small>{summary.rate}%</small></div>
          </header>
          <div className="homework-card-meta">
            <div className="meta-item"><span>日</span><b>{item.date}</b></div>
            <div className="meta-item"><span>交</span><b>{summary.done}</b>人</div>
            <div className="meta-item"><span>补</span><b>{summary.fixing}</b>人</div>
          </div>
          <div className="homework-progress"><div className="progress-bar"><div className="progress-fill" style={{ width: `${summary.rate}%` }} /></div><div className="progress-label"><span>提交进度</span><b>{summary.rate}%</b></div></div>
          <div className="homework-card-actions"><button onClick={() => openTask(item.id)}><span>查</span>查看详情</button><button className="primary" onClick={() => openTask(item.id)}><span>改</span>批改处理</button><button onClick={() => deleteTaskById(item.id)}><span>删</span>删除</button></div>
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
  const rules = (data.pointRules?.length ? data.pointRules : defaultPointRules).filter((item) => item.enabled !== false);
  const [ruleId, setRuleId] = useState(rules[0]?.id ?? "");
  const [keyword, setKeyword] = useState("");
  const [operator, setOperator] = useState("班主任");
  const [note, setNote] = useState("");
  const [customDelta, setCustomDelta] = useState(rules[0]?.delta ?? 1);
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const classes = data.rosterClasses?.length
    ? data.rosterClasses
    : [{ id: data.activeClassId ?? "class-1", name: "当前班级", grade: "", term: "", students: data.students }];
  const activeClassId = data.activeClassId && classes.some((item) => item.id === data.activeClassId) ? data.activeClassId : classes[0]?.id;
  const activeClass = classes.find((item) => item.id === activeClassId) ?? classes[0];
  const students = activeClass?.students?.length ? activeClass.students : data.students;
  const rule = rules.find((item) => item.id === ruleId) ?? rules[0] ?? defaultPointRules[0];
  const value = Number(customDelta) || 0;
  const absDelta = Math.max(1, Math.abs(value));
  const actionText = (value >= 0 ? "加" : "扣") + absDelta;
  const groups = Array.from(new Set(students.map((student) => student.group))).sort((a, b) => a - b);
  const filtered = students.filter((student) => (student.name + (student.studentNo ?? "") + "第" + student.group + "组").includes(keyword.trim()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStudents = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageStudentIds = pageStudents.map((student) => student.id);
  const pageAllSelected = pageStudentIds.length > 0 && pageStudentIds.every((id) => selected.includes(id));
  const events = data.pointEvents ?? [];
  const selectedNames = students.filter((student) => selected.includes(student.id)).map((student) => student.name);
  const studentIds = new Set(students.map((student) => student.id));
  const classEvents = events.filter((event) => studentIds.has(event.studentId));
  const positiveTotal = classEvents.filter((event) => event.delta > 0).reduce((sum, event) => sum + event.delta, 0);
  const negativeTotal = classEvents.filter((event) => event.delta < 0).reduce((sum, event) => sum + Math.abs(event.delta), 0);
  const participants = new Set(classEvents.map((event) => event.studentId)).size;
  const timelineGroups = classEvents.slice(0, 30).reduce((result, event) => {
    const date = event.date.slice(0, 10).replace(/\//g, "-");
    if (!result[date]) result[date] = [];
    result[date].push(event);
    return result;
  }, {} as Record<string, PointEvent[]>);

  useEffect(() => {
    setPage(1);
  }, [keyword, activeClassId]);

  useEffect(() => {
    setCustomDelta(rule?.delta ?? 1);
  }, [rule?.id]);

  function switchClass(id: string) {
    const nextClass = classes.find((item) => item.id === id);
    if (!nextClass) return;
    update((d) => ({ ...d, activeClassId: id, students: nextClass.students }));
    setSelected([]);
  }

  function toggleStudent(id: string) {
    setSelected((list) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  function toggleCurrentPage() {
    setSelected((list) => {
      if (pageAllSelected) return list.filter((id) => !pageStudentIds.includes(id));
      return Array.from(new Set([...list, ...pageStudentIds]));
    });
  }

  function selectGroup(group: number) {
    const ids = students.filter((student) => student.group === group).map((student) => student.id);
    setSelected((list) => Array.from(new Set([...list, ...ids])));
  }

  function applyScore(studentIds: string[]) {
    if (!studentIds.length || !rule || value === 0) return;
    const stamp = new Date().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const newEvents: PointEvent[] = studentIds.map((studentId) => ({
      id: crypto.randomUUID(),
      studentId,
      scene: rule.scene,
      reason: note.trim() ? `${rule.reason || rule.title}｜${note.trim()}` : rule.reason || rule.title,
      delta: value,
      date: stamp,
      operator: operator.trim() || "班主任",
    }));

    update((d) => {
      const updateStudents = (list: Student[]) => list.map((student) => studentIds.includes(student.id) ? { ...student, points: student.points + value } : student);
      const nextStudents = updateStudents(d.students);
      const nextClasses: RosterClass[] | undefined = d.rosterClasses?.map((item) => item.id === activeClassId ? { ...item, students: updateStudents(item.students) } : item);
      return { ...d, students: nextStudents, rosterClasses: nextClasses, pointEvents: [...newEvents, ...(d.pointEvents ?? [])] };
    });
    setSelected([]);
    setNote("");
  }

  function undoEvent(event: PointEvent) {
    update((d) => {
      const nextStudents = d.students.map((student) => student.id === event.studentId ? { ...student, points: student.points - event.delta } : student);
      const nextClasses = d.rosterClasses?.map((item) => item.id === activeClassId ? { ...item, students: item.students.map((student) => student.id === event.studentId ? { ...student, points: student.points - event.delta } : student) } : item);
      return { ...d, students: nextStudents, rosterClasses: nextClasses, pointEvents: (d.pointEvents ?? []).filter((item) => item.id !== event.id) };
    });
  }

  return <>
    <ToolHeading kicker="积分事件" title="快速记录日常加减分，并自动沉淀时间轴" text="先选学生，再选规则；可以按小组批量选择，也可以用自定义分数微调。" />
    <section className="class-tabs points-class-tabs">{classes.map((item) => <button className={activeClassId === item.id ? "active" : ""} key={item.id} onClick={() => switchClass(item.id)}><b>{item.name}</b><span>{item.students.length}人</span></button>)}</section>
    <section className="points-summary stat-row">
      <div><span>本周总加分</span><b>{positiveTotal}</b><small className="good">正向事件累计</small></div>
      <div><span>本周总减分</span><b>{negativeTotal}</b><small className="warn">提醒事件累计</small></div>
      <div><span>参与人次</span><b>{participants}</b><small>有积分记录的学生</small></div>
      <div><span>启用规则</span><b>{rules.length}</b><small>来自积分规则库</small></div>
    </section>
    <section className="points-split">
      <aside className="points-input-panel">
        <h3><span>＋</span>快速录入</h3>
        <div className="form-section"><label>学生多选</label><div className="batch-actions"><button onClick={toggleCurrentPage}>{pageAllSelected ? "取消本页" : "选择本页"}</button><button onClick={() => setSelected(students.map((student) => student.id))}>全班</button><button onClick={() => setSelected([])}>清空</button></div><div className="batch-actions">{groups.slice(0, 4).map((group) => <button key={group} onClick={() => selectGroup(group)}>第{group}组</button>)}</div><div className="resource-search compact-search"><span>⌕</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索姓名、学号、小组" /></div><div className="student-picker points-picker">{pageStudents.map((student) => <button className={selected.includes(student.id) ? "selected" : ""} key={student.id} onClick={() => toggleStudent(student.id)}>{student.name}</button>)}</div></div>
        <div className="form-section"><label>规则快选</label><div className="rule-picker">{rules.slice(0, 6).map((item) => <button className={item.id === rule?.id ? "selected" : ""} key={item.id} onClick={() => setRuleId(item.id)}><span className="rule-name">{item.scene} · {item.title}</span><span className={item.delta >= 0 ? "rule-score positive" : "rule-score negative"}>{item.delta > 0 ? "+" : ""}{item.delta}</span></button>)}</div></div>
        <div className="form-section"><label>自定义分数</label><div className="custom-score-input"><input type="range" min={-10} max={10} value={customDelta} onChange={(event) => setCustomDelta(Number(event.target.value))} /><span className="score-display">{value > 0 ? "+" : ""}{value}</span></div></div>
        <div className="form-section"><label>备注</label><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="可补充具体事实，如：主动帮同学讲题" rows={3} /></div>
        <label className="operator-box"><span>操作人</span><input value={operator} onChange={(event) => setOperator(event.target.value)} placeholder="例如：班主任" /></label>
        <button className="points-submit-btn" disabled={!selected.length || value === 0} onClick={() => applyScore(selected)}><span>{value >= 0 ? "＋" : "－"}</span>{selected.length ? `给 ${selected.length} 人${actionText}` : "请选择学生"}</button>
        <p className="points-selected-names">{selectedNames.join("、") || "还未选择学生"}</p>
      </aside>
      <section className="points-timeline"><h3><span>本周积分事件时间轴</span><small>{classEvents.length} 条</small></h3>
        {Object.keys(timelineGroups).map((date) => <div className="timeline-date-group" key={date}><div className="timeline-date-header"><span>{date}</span></div>{timelineGroups[date].map((event) => { const student = students.find((item) => item.id === event.studentId); return <article className={event.delta > 0 ? "point-event positive" : "point-event negative"} key={event.id}><div className="point-event-score">{event.delta > 0 ? "+" : ""}{event.delta}</div><div className="point-event-body"><div className="student-names">{student?.name ?? "其他班学生"}</div><div className="rule-label">{event.scene} · {event.reason}</div><div className="point-event-meta"><span>记</span>{event.operator ?? "班主任"} · {event.date}</div></div><div className="point-event-actions"><button onClick={() => undoEvent(event)}>撤销</button></div></article>; })}</div>)}
        {!classEvents.length && <div className="timeline-empty"><span>分</span><p>还没有积分事件，左侧提交后会立刻出现在这里。</p></div>}
      </section>
    </section>
  </>;
}


function Rules({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [category, setCategory] = useState("全部");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ scene: "学习", title: "", reason: "", delta: 1, owner: "班主任", level: "自定义" as PointRule["level"] });
  const rules = data.pointRules?.length ? data.pointRules : defaultPointRules;
  const categories = ["全部", ...Array.from(new Set(rules.map((item) => item.scene)))];
  const visibleRules = rules.filter((item) => category === "全部" || item.scene === category);
  const activeRules = rules.filter((item) => item.enabled !== false);
  const positiveRules = rules.filter((item) => item.delta > 0).length;
  const negativeRules = rules.filter((item) => item.delta < 0).length;
  const usageFor = (item: PointRule) => (data.pointEvents ?? []).filter((event) => event.scene === item.scene && (event.reason.includes(item.title) || event.reason.includes(item.reason) || item.reason.includes(event.reason))).length;
  function editRule(id: string, patch: Partial<PointRule>) {
    update((d) => ({ ...d, pointRules: (d.pointRules?.length ? d.pointRules : defaultPointRules).map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }
  function addRule() {
    if (!draft.title.trim() || !draft.reason.trim()) return;
    const newRule: PointRule = { id: crypto.randomUUID(), scene: draft.scene.trim() || "其他", title: draft.title.trim(), reason: draft.reason.trim(), delta: Number(draft.delta) || 0, owner: draft.owner.trim() || "班主任", enabled: true, level: draft.level, detail: "由班主任自定义添加。" };
    update((d) => ({ ...d, pointRules: [newRule, ...(d.pointRules?.length ? d.pointRules : defaultPointRules)] }));
    setDraft({ scene: "学习", title: "", reason: "", delta: 1, owner: "班主任", level: "自定义" });
    setCategory(newRule.scene);
    setShowForm(false);
  }
  function copyRule(item: PointRule) {
    const copied: PointRule = { ...item, id: crypto.randomUUID(), title: `${item.title} 副本`, enabled: true, level: "自定义" };
    update((d) => ({ ...d, pointRules: [copied, ...(d.pointRules?.length ? d.pointRules : defaultPointRules)] }));
  }
  function deleteRule(id: string) {
    const target = rules.find((item) => item.id === id);
    if (!target || !window.confirm(`确认删除规则“${target.title}”吗？历史积分记录不会删除。`)) return;
    update((d) => ({ ...d, pointRules: (d.pointRules?.length ? d.pointRules : defaultPointRules).filter((item) => item.id !== id) }));
  }
  return <>
    <ToolHeading kicker="积分规则" title="管理班级常用加减分规则库" text="规则会同步到积分事件页，班主任可以按纪律、学习、卫生、活动等分类维护。" action={<button className="primary-small" onClick={() => setShowForm((value) => !value)}>{showForm ? "收起表单" : "＋ 添加规则"}</button>} />
    <section className="rules-summary stat-row">
      <div><span>总规则数</span><b>{rules.length}</b><small>{activeRules.length} 条已启用</small></div>
      <div><span>加分规则</span><b>{positiveRules}</b><small className="good">正向激励</small></div>
      <div><span>减分规则</span><b>{negativeRules}</b><small className="warn">提醒约束</small></div>
      <div><span>本周使用</span><b>{data.pointEvents?.length ?? 0}</b><small>积分事件记录</small></div>
    </section>
    {showForm && <section className="rule-form"><h3><span>＋</span>添加规则</h3><div className="form-row half"><label>分类<input value={draft.scene} onChange={(event) => setDraft({ ...draft, scene: event.target.value })} /></label><label>分值<input type="number" value={draft.delta} onChange={(event) => setDraft({ ...draft, delta: Number(event.target.value) })} /></label></div><div className="form-row"><label>规则名称<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="如：主动讲题" /></label></div><div className="form-row"><label>评价口径<textarea value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} placeholder="写清楚什么时候可以使用这条规则" rows={3} /></label></div><div className="form-row half"><label>负责人<input value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} /></label><label>版本<select value={draft.level} onChange={(event) => setDraft({ ...draft, level: event.target.value as PointRule["level"] })}>{["小学版","初中版","温和版","严格版","自定义"].map((level)=><option key={level}>{level}</option>)}</select></label></div><footer className="form-actions"><button className="ghost-btn" onClick={() => setShowForm(false)}>取消</button><button className="primary-small" disabled={!draft.title.trim() || !draft.reason.trim()} onClick={addRule}>保存规则</button></footer></section>}
    <section className="rules-toolbar"><div className="category-filter">{categories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div><span className="spacer" /><button className="ghost-btn" onClick={() => setCategory("全部")}>显示全部</button></section>
    <section className="rules-grid cards">
      {visibleRules.map((item) => <article className={`rule-card ${item.delta >= 0 ? "positive" : "negative"} ${item.enabled === false ? "disabled" : ""}`} key={item.id}>
        <header className="rule-card-header"><input className="rule-card-category" value={item.scene} onChange={(event) => editRule(item.id, { scene: event.target.value })} /><input className="rule-card-score" type="number" value={item.delta} onChange={(event) => editRule(item.id, { delta: Number(event.target.value) || 0 })} /></header>
        <input className="rule-card-title-input" value={item.title} onChange={(event) => editRule(item.id, { title: event.target.value })} />
        <textarea className="rule-card-desc" value={item.reason} onChange={(event) => editRule(item.id, { reason: event.target.value })} />
        <div className="rule-card-stats"><span>本周使用</span><b>{usageFor(item)} 次</b><span>{item.level}</span></div>
        <label className="rule-owner-line">负责人<input value={item.owner} onChange={(event) => editRule(item.id, { owner: event.target.value })} /></label>
        <div className="rule-card-actions"><button onClick={() => editRule(item.id, { enabled: item.enabled === false })}>{item.enabled === false ? "启用" : "停用"}</button><button onClick={() => copyRule(item)}>复制</button><button className="danger" onClick={() => deleteRule(item.id)}>删除</button></div>
      </article>)}
      {!visibleRules.length && <div className="rules-empty"><span>规</span><h3>当前分类没有规则</h3><p>可以切回全部，或添加一条新规则。</p></div>}
    </section>
  </>;
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
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlyEvidence = evidence.filter((item) => item.timestamp && item.timestamp >= monthStart.getTime()).length;
  const studentsWithEvidence = data.students.filter((item) => {
    const hasManual = (data.growthEvidence ?? []).some((record) => record.studentId === item.id);
    const hasPoints = (data.pointEvents ?? []).some((event) => event.studentId === item.id);
    const hasRecords = data.records.some((record) => record.student === item.name);
    return hasManual || hasPoints || hasRecords;
  }).length;

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
    <ToolHeading kicker="成长记录" title="按学生沉淀成长轨迹和家长会素材" text="从积分、作业、沟通记录中自动汇入，也可以手动补充学习、活动、荣誉、日常和进步事实。" action={<div className="growth-heading-actions"><button className="ghost-btn" onClick={copySummary}>{copyState}</button><button className="primary-small" onClick={() => window.print()}>导出素材</button></div>} />
    <section className="growth-summary stat-row">
      <div><span>总记录数</span><b>{evidence.length}</b><small>当前学生</small></div>
      <div><span>本月新增</span><b>{monthlyEvidence}</b><small>最近沉淀</small></div>
      <div><span>有记录学生</span><b>{studentsWithEvidence}</b><small>全班覆盖</small></div>
      <div><span>照片数</span><b>0</b><small>照片上传后续接入</small></div>
    </section>
    <section className="growth-student-selector">
      <label>选择学生</label>
      <select value={student.id} onChange={(event) => selectStudent(event.target.value)}>{data.students.map((item) => <option key={item.id} value={item.id}>{item.name} · 学号 {item.studentNo || "未填"}</option>)}</select>
      <div className="student-avatar">{student.name.slice(0, 1)}</div>
      <div className="student-info"><b>{student.name}</b><small>第{student.group}组 · {status} · 作业完成率 {homeworkRate}%</small></div>
    </section>
    <section className="growth-split">
      <aside className="growth-input-panel">
        <h3><span>＋</span>添加记录</h3>
        <div className="form-section"><label>日期</label><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></div>
        <div className="form-section"><label>标题</label><input value={draft.title} maxLength={40} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="如：作文获奖" /></div>
        <div className="form-section"><label>内容描述</label><textarea value={draft.content} maxLength={500} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="记录具体事实、作品表现或老师观察。" /></div>
        <div className="form-section"><label>照片 / 作品扫描</label><div className="photo-upload-zone"><span>图</span><p>点击上传照片</p><small>当前先保留入口，后续接入真实图片存储</small></div></div>
        <div className="form-section"><label>标签</label><div className="tag-selector">{["学习","活动","荣誉","日常","进步"].map((tag) => <button className={draft.type === tag ? "selected" : ""} key={tag} onClick={() => setDraft({ ...draft, type: tag })}>{tag}</button>)}</div></div>
        <div className="form-section"><label>后续观察点</label><textarea value={draft.followUp} maxLength={300} onChange={(event) => setDraft({ ...draft, followUp: event.target.value })} placeholder="如：下周继续观察课堂发言。" rows={3} /></div>
        {formError && <p className="growth-form-error">{formError}</p>}
        <button className="points-submit-btn" onClick={saveEvidence}>保存成长记录</button>
      </aside>
      <section className="growth-timeline spec"><h3><span>成长时间轴</span>{filteredEvidence.length > 0 && <small>{filteredEvidence.length} 条</small>}</h3>
        <div className="growth-filter-row"><label><span>时间范围</span><select value={range} onChange={(event) => { setRange(event.target.value as GrowthTime); setPage(1); }}>{["全部时间", "近7天", "近30天", "本学期"].map((item) => <option key={item}>{item}</option>)}</select></label><label><span>记录类型</span><select value={kind} onChange={(event) => { setKind(event.target.value as "全部类型" | GrowthKind); setPage(1); }}>{["全部类型", "沟通记录", "积分表现", "作业记录", "老师补充"].map((item) => <option key={item}>{item}</option>)}</select></label></div>
        {visibleEvidence.map((item) => <article className="growth-record" key={item.id}><div className="growth-record-date">{item.date}</div><div className="growth-record-title">{item.title}</div><div className="growth-record-tags"><span>{item.kind}</span><span>{item.label}</span></div><div className="growth-record-content">{item.content}</div>{item.followUp && <div className="growth-followup-note"><b>后续措施</b><span>{item.followUp}</span></div>}<div className="growth-record-meta"><span>记</span>{student.name} · {item.tone === "attention" ? "需关注" : item.tone === "positive" ? "正向记录" : "日常记录"}</div></article>)}
        {!visibleEvidence.length && <div className="growth-empty"><span>档</span><p>{evidence.length ? "当前筛选条件下没有记录。" : "还没有成长记录，先从左侧添加第一条。"}</p></div>}
        {filteredEvidence.length > pageSize && <div className="growth-pagination"><button disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>上一页</button><span>第 {safePage} / {pageCount} 页</span><button disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>下一页</button></div>}
      </section>
    </section>
  </>;
}

function Weekly({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  type WeeklyView = "overview" | "editor" | "archive";
  type DetailPanel = "stars" | "progress" | "follow" | "groups" | "records" | null;
  const classes = data.rosterClasses?.length ? data.rosterClasses : [{ id: data.activeClassId ?? "class-1", name: "当前班级", grade: "", term: "", students: data.students }];
  const currentClassId = data.activeClassId ?? classes[0].id;
  const [view, setView] = useState<WeeklyView>("overview");
  const [selectedClassId, setSelectedClassId] = useState(currentClassId);
  const [weekOffset, setWeekOffset] = useState(0);
  const [edition, setEdition] = useState<"家长版" | "教师版">("家长版");
  const [detailPanel, setDetailPanel] = useState<DetailPanel>(null);
  const [followFilter, setFollowFilter] = useState<"全部" | "作业" | "成绩" | "考勤">("全部");
  const [copied, setCopied] = useState(false);
  const [savedState, setSavedState] = useState("");
  const [customDraft, setCustomDraft] = useState("");
  const [draftTouched, setDraftTouched] = useState(false);
  const [reportTitle, setReportTitle] = useState("班级周报");
  const [nextFocus, setNextFocus] = useState("");
  const [archiveClass, setArchiveClass] = useState("全部班级");
  const [archiveEdition, setArchiveEdition] = useState("全部版本");
  const [archiveSearch, setArchiveSearch] = useState("");
  const [archivePage, setArchivePage] = useState(1);
  const [previewReportId, setPreviewReportId] = useState<string | null>(null);

  const currentMonday = new Date();
  const currentDay = currentMonday.getDay() || 7;
  currentMonday.setDate(currentMonday.getDate() - currentDay + 1);
  currentMonday.setHours(0, 0, 0, 0);
  const monday = new Date(currentMonday);
  monday.setDate(monday.getDate() + weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const iso = (date: Date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  const shortDate = (date: Date) => (date.getMonth() + 1) + "月" + date.getDate() + "日";
  const weekStart = iso(monday);
  const weekEnd = iso(sunday);
  const weekNumber = Math.ceil((((monday.getTime() - new Date(monday.getFullYear(), 0, 1).getTime()) / 86400000) + new Date(monday.getFullYear(), 0, 1).getDay() + 1) / 7);
  const weekChoices = Array.from({ length: 13 }, (_, index) => {
    const offset = -index;
    const optionMonday = new Date(currentMonday);
    optionMonday.setDate(optionMonday.getDate() + offset * 7);
    const optionSunday = new Date(optionMonday);
    optionSunday.setDate(optionSunday.getDate() + 6);
    const label = shortDate(optionMonday) + "—" + shortDate(optionSunday);
    return { offset, label };
  });
  const selectedClass = classes.find((item) => item.id === selectedClassId) ?? classes[0];
  const students = selectedClass.students;
  const studentIds = new Set(students.map((student) => student.id));
  const studentNames = new Set(students.map((student) => student.name));
  const className = selectedClass.name;
  const weekTasks = (data.homeworkTasks ?? []).filter((task) => task.classId === selectedClassId && task.date >= weekStart && task.date <= weekEnd);
  const totalChecks = weekTasks.length * students.length;
  let submitted = 0;
  let missing = 0;
  let fixing = 0;
  for (const task of weekTasks) {
    for (const student of students) {
      const status = task.statuses[student.id] ?? student.homework;
      if (status === "已交" || status === "已复查") submitted += 1;
      if (status === "未交") missing += 1;
      if (status === "待订正") fixing += 1;
    }
  }
  const completionRate = totalChecks ? Math.round(submitted / totalChecks * 100) : 0;
  const averageScore = students.length ? Math.round(students.reduce((sum, student) => sum + student.score, 0) / students.length) : 0;
  const classPointEvents = (data.pointEvents ?? []).filter((event) => studentIds.has(event.studentId));
  const hasDatedPointEvents = classPointEvents.some((event) => /^\d{4}-\d{2}-\d{2}/.test(event.date));
  const reportPointEvents = hasDatedPointEvents ? classPointEvents.filter((event) => event.date >= weekStart && event.date <= weekEnd) : classPointEvents;
  const positiveEvents = reportPointEvents.filter((event) => event.delta > 0);
  const stars = [...students].sort((a, b) => b.points - a.points).slice(0, 8);
  const progressMap = new Map<string, { student: Student; delta: number; evidence: string }>();
  for (const event of positiveEvents) {
    const student = students.find((item) => item.id === event.studentId);
    if (!student) continue;
    const current = progressMap.get(student.id);
    progressMap.set(student.id, { student, delta: (current?.delta ?? 0) + event.delta, evidence: current?.evidence ?? event.reason });
  }
  const progress = [...progressMap.values()].sort((a, b) => b.delta - a.delta).slice(0, 8);
  const follow = students.map((student) => {
    const unresolved = weekTasks.reduce((count, task) => {
      const status = task.statuses[student.id] ?? student.homework;
      return count + (status === "未交" || status === "待订正" ? 1 : 0);
    }, 0);
    const reasons = [
      student.score < 80 ? { kind: "成绩", text: "成绩 " + student.score + " 分" } : null,
      unresolved ? { kind: "作业", text: unresolved + " 项作业待处理" } : null,
      student.attendance !== "正常" ? { kind: "考勤", text: student.attendance } : null,
    ].filter((item): item is { kind: string; text: string } => Boolean(item));
    return { student, reasons };
  }).filter((item) => item.reasons.length).sort((a, b) => b.reasons.length - a.reasons.length);
  const filteredFollow = follow.filter((item) => followFilter === "全部" || item.reasons.some((reason) => reason.kind === followFilter));
  const groupStats = [...new Set(students.map((student) => student.group))].sort((a, b) => a - b).map((group) => {
    const groupStudents = students.filter((student) => student.group === group);
    const points = groupStudents.reduce((sum, student) => sum + student.points, 0);
    const unresolved = weekTasks.reduce((count, task) => count + groupStudents.filter((student) => {
      const status = task.statuses[student.id] ?? student.homework;
      return status === "未交" || status === "待订正";
    }).length, 0);
    return { group, students: groupStudents.length, points, average: groupStudents.length ? Math.round(points / groupStudents.length) : 0, unresolved };
  }).sort((a, b) => b.average - a.average);
  const classRecords = data.records.filter((record) => studentNames.has(record.student));
  const hasDatedRecords = classRecords.some((record) => /^\d{4}-\d{2}-\d{2}/.test(record.date));
  const reportRecords = hasDatedRecords ? classRecords.filter((record) => record.date >= weekStart && record.date <= weekEnd) : weekOffset === 0 ? classRecords : [];
  const defaultPlan = (data.weeklyPlan ?? []).map((item) => item.day + "：" + item.focus + " · " + item.event).join("\n");
  const allReports = [...(data.weeklyReports ?? [])].sort((a, b) => b.weekStart.localeCompare(a.weekStart) || b.updatedAt.localeCompare(a.updatedAt));
  const currentSavedReport = allReports.find((report) => report.classId === selectedClassId && report.weekStart === weekStart && report.edition === edition);
  const defaultTitle = className + " · 第" + weekNumber + "周班级周报";

  useEffect(() => {
    const saved = (data.weeklyReports ?? []).find((report) => report.classId === selectedClassId && report.weekStart === weekStart && report.edition === edition);
    setReportTitle(saved?.title ?? defaultTitle);
    setNextFocus(saved?.nextFocus ?? defaultPlan);
    setCustomDraft("");
    setDraftTouched(false);
    setSavedState("");
  }, [selectedClassId, weekStart, edition]);

  const generatedText = [
    reportTitle || defaultTitle,
    shortDate(monday) + "—" + shortDate(sunday),
    "【本周概况】",
    "本周记录 " + weekTasks.length + " 项作业，整体完成率 " + completionRate + "%；班级当前平均分 " + averageScore + " 分，记录 " + positiveEvents.length + " 次正向表现。",
    "【值得表扬】",
    stars.length ? stars.slice(0, 4).map((student) => student.name + "（" + student.points + "积分）").join("、") + "。" : "本周暂无足够数据。",
    "【持续进步】",
    progress.length ? progress.slice(0, 4).map((item) => item.student.name + "（" + item.evidence + "）").join("、") + "。" : "本周还没有足够的正向记录。",
    edition === "家长版" ? "【温馨提醒】\n仍有 " + missing + " 人次未交、" + fixing + " 人次待订正，请家长协助孩子及时完成学习闭环。" : "【重点跟进】\n" + (follow.length ? follow.map((item) => item.student.name + "（" + item.reasons.map((reason) => reason.text).join("、") + "）").join("；") + "。" : "暂无重点跟进学生。"),
    "【下周行动】",
    nextFocus.trim() || "继续关注作业习惯、课堂参与和自我管理。",
  ].join("\n\n");
  const draftContent = draftTouched ? customDraft : currentSavedReport?.content ?? generatedText;
  const filteredReports = allReports.filter((report) => {
    const targetClass = classes.find((item) => item.id === report.classId);
    const keyword = archiveSearch.trim().toLowerCase();
    return (archiveClass === "全部班级" || report.classId === archiveClass)
      && (archiveEdition === "全部版本" || report.edition === archiveEdition)
      && (!keyword || (report.title ?? "").toLowerCase().includes(keyword) || (targetClass?.name ?? "").toLowerCase().includes(keyword) || report.content.toLowerCase().includes(keyword));
  });
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(filteredReports.length / pageSize));
  const safeArchivePage = Math.min(archivePage, pageCount);
  const pageReports = filteredReports.slice((safeArchivePage - 1) * pageSize, safeArchivePage * pageSize);
  const previewReport = allReports.find((report) => report.id === previewReportId);
  const previewClass = previewReport ? classes.find((item) => item.id === previewReport.classId) : undefined;

  function shiftWeek(delta: number) {
    setWeekOffset((current) => current + delta);
  }

  async function copyText(text: string) {
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function saveReport(status: "草稿" | "已归档") {
    const nowText = new Date().toISOString();
    const report = {
      id: currentSavedReport?.id ?? crypto.randomUUID(),
      classId: selectedClassId,
      weekStart,
      weekEnd,
      edition,
      title: reportTitle.trim() || defaultTitle,
      status,
      content: draftContent,
      nextFocus,
      createdAt: currentSavedReport?.createdAt ?? nowText,
      updatedAt: nowText,
      archivedAt: status === "已归档" ? nowText : currentSavedReport?.archivedAt,
    };
    update((current) => ({ ...current, weeklyReports: [...(current.weeklyReports ?? []).filter((item) => item.id !== report.id), report] }));
    setDraftTouched(false);
    setSavedState(status === "已归档" ? "已归档" : "草稿已保存");
  }

  function openSavedReport(report: NonNullable<ClassroomData["weeklyReports"]>[number]) {
    const offset = Math.round((new Date(report.weekStart + "T00:00:00").getTime() - currentMonday.getTime()) / 604800000);
    setSelectedClassId(report.classId);
    setWeekOffset(offset);
    setEdition(report.edition);
    setView("editor");
    setPreviewReportId(null);
  }

  const detailTitles: Record<Exclude<DetailPanel, null>, string> = {
    stars: "优秀学生排行榜",
    progress: "持续进步学生",
    follow: "需要跟进的学生",
    groups: "小组表现明细",
    records: "本周成长记录",
  };

  return <div className="weekly2-page">
    <ToolHeading kicker="班级周报" title="把每一周都沉淀成可回看的班级记录" text="按班级、周次和版本管理周报；先看概览，再编辑正文，需要时打开详细数据。" action={<button className="primary-small weekly2-new" onClick={() => { setWeekOffset(0); setView("editor"); }}>＋ 新建本周周报</button>} />

    <section className="weekly3-controlbar">
      <nav className="weekly3-view-nav" aria-label="周报页面">
        <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}><i>览</i><span><b>本周概览</b><small>班级数据摘要</small></span></button>
        <button className={view === "editor" ? "active" : ""} onClick={() => setView("editor")}><i>写</i><span><b>编辑周报</b><small>正文与行动计划</small></span></button>
        <button className={view === "archive" ? "active" : ""} onClick={() => setView("archive")}><i>库</i><span><b>周报库</b><small>{allReports.length} 份历史周报</small></span></button>
      </nav>
      <div className="weekly3-filters">
        <label><i>班</i><span><small>管理班级</small><select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></span></label>
        <label className="weekly3-date-filter"><i>日</i><span><small>查看周次</small><select value={weekOffset} onChange={(event) => setWeekOffset(Number(event.target.value))}>{weekChoices.map((item) => <option key={item.offset} value={item.offset}>{item.label}</option>)}</select></span></label>
      </div>
    </section>

    {view === "overview" && <div className="weekly2-overview">
      <section className="weekly2-summary">
        <div><span>第 {weekNumber} 周</span><h2>{className}</h2><p>{currentSavedReport ? (currentSavedReport.status ?? "草稿") + " · 更新于 " + new Date(currentSavedReport.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "尚未保存周报，数据概览已自动准备"}</p></div>
        <button onClick={() => setView("editor")}>{currentSavedReport ? "继续编辑" : "开始写周报"}<span>→</span></button>
      </section>
      <section className="weekly2-metrics">
        <article><i>作</i><div><span>本周作业</span><b>{weekTasks.length}<small>项</small></b><p>{totalChecks ? submitted + "/" + totalChecks + " 人次完成" : "暂无作业记录"}</p></div></article>
        <article><i>✓</i><div><span>完成率</span><b>{completionRate}<small>%</small></b><p>{missing} 未交 · {fixing} 待订正</p></div></article>
        <article><i>＋</i><div><span>正向表现</span><b>{positiveEvents.length}<small>次</small></b><p>{progress.length} 名学生持续进步</p></div></article>
        <article><i>分</i><div><span>班级平均分</span><b>{averageScore}<small>分</small></b><p>{students.filter((student) => student.score >= 90).length} 人达到优秀</p></div></article>
      </section>
      <section className="weekly2-insight-grid">
        <article className="weekly2-insight weekly2-praise">
          <header><div><span>值得表扬</span><h3>优秀学生</h3></div><button onClick={() => setDetailPanel("stars")}>查看全部</button></header>
          <div className="weekly2-person-list">{stars.slice(0, 3).map((student, index) => <div key={student.id}><i>{index + 1}</i><span><b>{student.name}</b><small>{reportPointEvents.find((event) => event.studentId === student.id && event.delta > 0)?.reason ?? "综合表现突出"}</small></span><strong>{student.points}</strong></div>)}{!stars.length && <p className="weekly2-empty">暂无学生数据</p>}</div>
        </article>
        <article className="weekly2-insight weekly2-progress">
          <header><div><span>持续进步</span><h3>本周进步学生</h3></div><button onClick={() => setDetailPanel("progress")}>查看全部</button></header>
          <div className="weekly2-person-list">{progress.slice(0, 3).map((item) => <div key={item.student.id}><i>↗</i><span><b>{item.student.name}</b><small>{item.evidence}</small></span><strong>+{item.delta}</strong></div>)}{!progress.length && <p className="weekly2-empty">记录正向积分后自动生成</p>}</div>
        </article>
        <article className="weekly2-insight weekly2-attention">
          <header><div><span>需要关注</span><h3>待跟进事项</h3></div><button onClick={() => setDetailPanel("follow")}>查看名单</button></header>
          <div className="weekly2-follow-summary"><div><b>{follow.length}</b><span>名学生</span></div><ul><li><i></i>作业待办 {follow.filter((item) => item.reasons.some((reason) => reason.kind === "作业")).length} 人</li><li><i></i>成绩关注 {follow.filter((item) => item.reasons.some((reason) => reason.kind === "成绩")).length} 人</li><li><i></i>考勤提醒 {follow.filter((item) => item.reasons.some((reason) => reason.kind === "考勤")).length} 人</li></ul></div>
        </article>
      </section>
      <section className="weekly2-lower-grid">
        <article className="weekly2-compact-card">
          <header><div><span>小组表现</span><h3>按人均积分排序</h3></div><button onClick={() => setDetailPanel("groups")}>完整统计</button></header>
          <div className="weekly2-group-preview">{groupStats.slice(0, 4).map((item, index) => <div key={item.group}><b>{index + 1}</b><span>第{item.group}组<small>{item.students} 人</small></span><strong>{item.average}<small>人均分</small></strong><em className={item.unresolved ? "warn" : ""}>{item.unresolved ? item.unresolved + " 待办" : "已清零"}</em></div>)}</div>
        </article>
        <article className="weekly2-compact-card">
          <header><div><span>成长记录 · 来自家校沟通</span><h3>最近记录</h3></div><button onClick={() => setDetailPanel("records")}>查看记录</button></header>
          <div className="weekly2-record-preview">{reportRecords.slice(0, 3).map((record) => <div key={record.id}><i>{record.student.slice(0, 1)}</i><span><b>{record.student}<small>{record.type}</small></b><p>{record.content}</p></span></div>)}{!reportRecords.length && <p className="weekly2-empty">暂无成长记录</p>}</div>
        </article>
      </section>
    </div>}

    {view === "editor" && <div className="weekly2-editor">
      <aside className="weekly2-editor-side">
        <div className="weekly2-editor-status"><span>当前编辑</span><h3>{className}</h3><p>{shortDate(monday)}—{shortDate(sunday)}</p><em className={currentSavedReport?.status === "已归档" ? "done" : ""}>{currentSavedReport?.status ?? "未保存"}</em></div>
        <section><span>周报版本</span><div className="weekly2-edition">{(["家长版", "教师版"] as const).map((item) => <button className={edition === item ? "active" : ""} key={item} onClick={() => setEdition(item)}><b>{item}</b><small>{item === "家长版" ? "适合班级群，不公开名单" : "保留详细跟进信息"}</small></button>)}</div></section>
        <section className="weekly2-source-check"><span>自动汇总来源</span><p><i>✓</i>作业记录 <b>{weekTasks.length} 项</b></p><p><i>✓</i>积分记录 <b>{reportPointEvents.length} 条</b></p><p><i>✓</i>成长记录 <b>{reportRecords.length} 条</b></p><p><i>✓</i>成绩与考勤 <b>{students.length} 人</b></p></section>
        <button className="weekly2-regenerate" onClick={() => { setCustomDraft(generatedText); setDraftTouched(true); setSavedState(""); }}>↻ 按当前数据重新生成</button>
      </aside>
      <main className="weekly2-editor-main">
        <section className="weekly2-edit-card weekly2-title-card">
          <label><span>周报标题</span><input value={reportTitle} onChange={(event) => { setReportTitle(event.target.value); setSavedState(""); }} /></label>
          <div><span>{draftContent.length} 字</span><span>{edition}</span></div>
        </section>
        <section className="weekly2-edit-card weekly2-body-card">
          <header><div><span>周报正文</span><h3>像写文档一样完整编辑</h3></div><small>自动生成只是起点，老师可以自由增删和调整语气</small></header>
          <textarea aria-label="周报正文" value={draftContent} onChange={(event) => { setCustomDraft(event.target.value); setDraftTouched(true); setSavedState(""); }} />
        </section>
        <section className="weekly2-edit-card weekly2-action-card">
          <header><div><span>下周行动</span><h3>单独规划，不再挤在小输入框里</h3></div><small>建议写清时间、对象、动作和复查节点</small></header>
          <textarea aria-label="下周行动计划" value={nextFocus} onChange={(event) => { setNextFocus(event.target.value); setSavedState(""); }} placeholder={"周一｜检查上周订正完成情况\n周三｜联系重点学生家长并记录沟通结果\n周五｜复盘小组积分与本周行动"} />
          <div className="weekly2-action-tips"><span>写法参考</span><button onClick={() => setNextFocus("周一｜检查作业订正，重点关注未完成学生\n周三｜与重点学生进行一次简短谈话并记录\n周五｜复盘小组表现，确定下周表扬与跟进名单")}>插入行动模板</button></div>
        </section>
        <footer className="weekly2-editor-footer">
          <div>{savedState ? <b>✓ {savedState}</b> : <span>{draftTouched ? "正文有未保存修改" : currentSavedReport ? "内容已保存" : "尚未保存"}</span>}</div>
          <div><button onClick={() => copyText(draftContent)}>{copied ? "已复制" : "复制正文"}</button><button onClick={() => window.print()}>打印 / 导出</button><button className="weekly2-save" onClick={() => saveReport("草稿")}>保存草稿</button><button className="weekly2-archive" onClick={() => saveReport("已归档")}>完成并归档</button></div>
        </footer>
      </main>
    </div>}

    {view === "archive" && <div className="weekly2-archive">
      <section className="weekly2-library-hero">
        <div><span>长期周报库</span><h2>{allReports.length} 份周报，覆盖 {new Set(allReports.map((report) => report.classId)).size || classes.length} 个班级</h2><p>按班级、版本和关键词查找，随时回看、复制或继续编辑。</p></div>
        <button onClick={() => setView("editor")}>＋ 新建周报</button>
      </section>
      <section className="weekly2-library-filters">
        <label><span>搜索</span><input value={archiveSearch} onChange={(event) => { setArchiveSearch(event.target.value); setArchivePage(1); }} placeholder="搜索标题、班级或正文内容" /></label>
        <label><span>班级</span><select value={archiveClass} onChange={(event) => { setArchiveClass(event.target.value); setArchivePage(1); }}><option>全部班级</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>版本</span><select value={archiveEdition} onChange={(event) => { setArchiveEdition(event.target.value); setArchivePage(1); }}><option>全部版本</option><option>家长版</option><option>教师版</option></select></label>
      </section>
      {pageReports.length ? <section className="weekly2-library-grid">{pageReports.map((report) => {
        const targetClass = classes.find((item) => item.id === report.classId);
        return <article key={report.id}>
          <header><span className={report.status === "已归档" ? "done" : ""}>{report.status ?? "草稿"}</span><em>{report.edition}</em></header>
          <h3>{report.title ?? (targetClass?.name ?? "班级") + "班级周报"}</h3>
          <p>{report.weekStart}—{report.weekEnd}</p>
          <div>{report.content.replace(/\s+/g, " ").slice(0, 92)}{report.content.length > 92 ? "…" : ""}</div>
          <footer><span>{targetClass?.name ?? "未知班级"}<small>更新于 {new Date(report.updatedAt).toLocaleDateString("zh-CN")}</small></span><div><button onClick={() => copyText(report.content)}>复制</button><button onClick={() => setPreviewReportId(report.id)}>预览</button><button onClick={() => openSavedReport(report)}>编辑</button></div></footer>
        </article>;
      })}</section> : <section className="weekly2-library-empty"><i>周</i><h3>还没有符合条件的周报</h3><p>选择班级和周次，先完成第一份周报；以后每周都会在这里沉淀。</p><button onClick={() => setView("editor")}>开始写第一份周报</button></section>}
      {filteredReports.length > pageSize && <nav className="weekly2-pagination" aria-label="周报分页"><button disabled={safeArchivePage <= 1} onClick={() => setArchivePage((page) => Math.max(1, page - 1))}>上一页</button><span>第 {safeArchivePage} / {pageCount} 页</span><button disabled={safeArchivePage >= pageCount} onClick={() => setArchivePage((page) => Math.min(pageCount, page + 1))}>下一页</button></nav>}
    </div>}

    {detailPanel && <div className="weekly2-modal-backdrop" onMouseDown={() => setDetailPanel(null)}><section className="weekly2-modal" role="dialog" aria-modal="true" aria-label={detailTitles[detailPanel]} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span>{detailPanel === "records" ? "来源：家校沟通页面保存到成长档案的记录" : className + " · " + shortDate(monday) + "—" + shortDate(sunday)}</span><h2>{detailTitles[detailPanel]}</h2></div><button aria-label="关闭" onClick={() => setDetailPanel(null)}>×</button></header>
      <div className="weekly2-modal-body">
        {detailPanel === "stars" && <div className="weekly2-detail-list">{stars.map((student, index) => <div key={student.id}><i>{index + 1}</i><span><b>{student.name}</b><small>{reportPointEvents.find((event) => event.studentId === student.id && event.delta > 0)?.reason ?? "综合表现突出"}</small></span><strong>{student.points} 积分</strong></div>)}</div>}
        {detailPanel === "progress" && <div className="weekly2-detail-list">{progress.length ? progress.map((item) => <div key={item.student.id}><i>↗</i><span><b>{item.student.name}</b><small>{item.evidence}</small></span><strong>+{item.delta}</strong></div>) : <p className="weekly2-empty">本周还没有足够的进步记录。</p>}</div>}
        {detailPanel === "follow" && <><div className="weekly2-modal-filters">{(["全部", "作业", "成绩", "考勤"] as const).map((item) => <button className={followFilter === item ? "active" : ""} key={item} onClick={() => setFollowFilter(item)}>{item}</button>)}</div><div className="weekly2-detail-list">{filteredFollow.length ? filteredFollow.map((item) => <div key={item.student.id}><i>{item.student.name.slice(0, 1)}</i><span><b>{item.student.name}</b><small>{item.reasons.map((reason) => reason.text).join(" · ")}</small></span><strong>{item.reasons.length} 项</strong></div>) : <p className="weekly2-empty">当前条件下没有需要跟进的学生。</p>}</div></>}
        {detailPanel === "groups" && <div className="weekly2-detail-table"><div><b>排名</b><b>小组</b><b>人数</b><b>总积分</b><b>人均积分</b><b>作业待办</b></div>{groupStats.map((item, index) => <div key={item.group}><span>{index + 1}</span><strong>第{item.group}组</strong><span>{item.students}</span><span>{item.points}</span><b>{item.average}</b><em>{item.unresolved ? item.unresolved + " 人次" : "已清零"}</em></div>)}</div>}
        {detailPanel === "records" && <div className="weekly2-record-detail">{reportRecords.length ? reportRecords.map((record) => <article key={record.id}><i>{record.student.slice(0, 1)}</i><div><h3>{record.student}<span>{record.type}</span></h3><p>{record.content}</p><time>{record.date}</time></div></article>) : <p className="weekly2-empty">本周暂无成长记录。</p>}</div>}
      </div>
    </section></div>}

    {previewReport && <div className="weekly2-modal-backdrop" onMouseDown={() => setPreviewReportId(null)}><section className="weekly2-modal weekly2-preview-modal" role="dialog" aria-modal="true" aria-label="周报预览" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span>{previewClass?.name} · {previewReport.edition}</span><h2>{previewReport.title ?? "班级周报"}</h2></div><button aria-label="关闭" onClick={() => setPreviewReportId(null)}>×</button></header>
      <div className="weekly2-preview-content"><pre>{previewReport.content}</pre><section><span>下周行动</span><p>{previewReport.nextFocus || "未填写"}</p></section></div>
      <footer><button onClick={() => copyText(previewReport.content)}>复制正文</button><button className="weekly2-save" onClick={() => openSavedReport(previewReport)}>打开编辑</button></footer>
    </section></div>}
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
  const [layoutMode, setLayoutMode] = useState<"秧田式" | "小组式" | "U型">("秧田式");
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
  const assignedCount = sortedStudents.filter((student) => student.seat >= 1 && student.seat <= capacity).length;
  const unassignedCount = Math.max(0, data.students.length - assignedCount);

  return <>
    <ToolHeading kicker="座位与分组" title="把真实教室排成一张能调整、能打印的座位表" text="名单自动带入；电脑端可拖动或点选换座，手机端用学生卡片操作。" action={<div className="seat-heading-actions"><button className="soft-action" onClick={rotateRows}>前后排轮换</button><button className="primary-small" onClick={smartArrange}>智能排座</button></div>} />
    <section className="seat-summary">
      <article><span>总座位</span><b>{capacity}</b><small>{config.rows}排 × {config.columns}列</small></article>
      <article><span>已分配</span><b>{assignedCount}</b><small>来自当前班级名单</small></article>
      <article><span>未分配</span><b>{unassignedCount}</b><small>超过容量时需增排</small></article>
      <article><span>本学期调整</span><b>{specialCount}</b><small>固定座 / 座位需求 / 避让</small></article>
    </section>
    <section className="seating-toolbar">
      <div className="layout-mode-selector">{(["秧田式", "小组式", "U型"] as const).map((mode) => <button className={layoutMode === mode ? "active" : ""} key={mode} onClick={() => setLayoutMode(mode)}>{mode}</button>)}</div>
      <button className="ghost-btn" onClick={smartArrange}>自动排座</button>
      <button className="ghost-btn" disabled={!lastStudents} onClick={undo}>历史版本/撤销</button>
      <span className="spacer" />
      <button className="primary-small" onClick={() => window.print()}>保存/打印</button>
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
    <section className={`seating-workspace seating-mode-${layoutMode}`}>
      <div className="seating-wrap seating-advanced seating-canvas">
        <div className="blackboard podium"><span>讲</span>讲 台</div>
        <div className="classroom-orientation"><span>前门</span><b>面向黑板</b><span>窗户</span></div>
        <div className={`seat-grid advanced-grid seats-grid rows-${config.rows}`} style={{ gridTemplateColumns: `repeat(${config.columns}, minmax(76px, 1fr))` }}>
          {Array.from({ length: capacity }, (_, index) => index + 1).map((seat) => {
            const student = studentBySeat.get(seat);
            const column = (seat - 1) % config.columns + 1;
            const row = Math.floor((seat - 1) / config.columns) + 1;
            const aisleEdge = config.aisleAfter.includes(column);
            return <button
              className={`seat-slot seat-card ${student ? "occupied" : "empty"} ${student && selected === student.id ? "selected" : ""} ${student?.seatFixed ? "fixed" : ""} ${aisleEdge ? "aisle-edge" : ""}`}
              aria-label={`${student?.name ?? "空座"} 座位${seat}`}
              draggable={Boolean(student)}
              onDragStart={() => { if (student) setDragged(student.id); }}
              onDragEnd={() => setDragged(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); if (dragged) swapStudentTo(dragged, seat); setDragged(null); }}
              onClick={() => chooseSeat(seat, student)}
              key={seat}
            >
              <small className="seat-number">{seat}</small>
              {student ? <><i className="seat-avatar">{student.name.slice(0, 1)}</i><span className="seat-name">{student.name}{student.groupLeader ? <em className="seat-badge">长</em> : null}</span><em>第{student.group}组 · {student.studentNo || "未填学号"}</em><strong>{student.seatFixed ? "固定座" : student.seatNeed && student.seatNeed !== "无" ? student.seatNeed : student.avoidWith ? "需避让" : "可调整"}</strong></> : <><span>空座</span><em>可移动学生到这里</em></>}
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
  const [selectedDay, setSelectedDay] = useState(days[Math.max(0, Math.min(4, new Date().getDay() - 1))]);
  const [keyword, setKeyword] = useState("");
  const [message, setMessage] = useState("");
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "class-1";
  const allJobs = data.dutyJobs?.length ? data.dutyJobs : defaultDutyJobs;
  const jobs = allJobs.filter((job) => job.enabled !== false);
  const maxGroup = Math.max(1, ...data.students.map((s) => s.group || 1));
  const groups = Array.from({ length: maxGroup }, (_, group) => data.students.filter((s) => s.group === group + 1));
  const records = (data.dutyRecords ?? []).filter((record) => !record.classId || record.classId === activeClassId);
  const selectedDayIndex = days.indexOf(selectedDay) >= 0 ? days.indexOf(selectedDay) : 0;
  const todayRecords = records.filter((record) => record.date === today());
  const pendingCount = jobs.filter((job) => {
    const record = todayRecords.find((item) => item.day === selectedDay && item.jobId === job.id);
    return !record || record.status === "待检查" || record.status === "需返工";
  }).length;

  function assignedStudents(dayIndex: number, job: DutyJob, jobIndex: number) {
    const fixed = (job.studentIds ?? []).map((id) => data.students.find((student) => student.id === id)).filter(Boolean) as Student[];
    if (fixed.length) return fixed;
    const group = groups[(dayIndex + data.dutyOffset) % groups.length] ?? [];
    return group.length ? [group[jobIndex % group.length]] : [];
  }

  function editJob(id: string, patch: Partial<DutyJob>) {
    update((current) => ({ ...current, dutyJobs: allJobs.map((job) => job.id === id ? { ...job, ...patch } : job) }));
  }

  function addJob() {
    update((current) => ({ ...current, dutyJobs: [...allJobs, { id: crypto.randomUUID(), name: "新岗位", area: "填写负责区域", standard: "填写检查标准", enabled: true }] }));
  }

  function mark(day: string, job: DutyJob, jobIndex: number, status: DutyRecord["status"]) {
    const students = assignedStudents(days.indexOf(day), job, jobIndex);
    const existing = records.find((record) => record.date === today() && record.day === day && record.jobId === job.id);
    const next: DutyRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      classId: activeClassId,
      date: today(),
      day,
      jobId: job.id,
      studentIds: students.map((student) => student.id),
      status,
      note: existing?.note ?? "",
      checkedBy: existing?.checkedBy ?? "劳动委员",
      createdAt: existing?.createdAt ?? Date.now(),
    };
    update((current) => ({ ...current, dutyRecords: [next, ...(current.dutyRecords ?? []).filter((record) => record.id !== next.id)] }));
    setMessage(`${day} ${job.name} 已记录为${status}`);
  }

  const dutyText = days.map((day, dayIndex) => {
    const groupIndex = (dayIndex + data.dutyOffset) % groups.length;
    return `${day} 第${groupIndex + 1}组：` + jobs.map((job, jobIndex) => `${job.name}-${assignedStudents(dayIndex, job, jobIndex).map((student) => student.name).join("、") || "待安排"}`).join("；");
  }).join("\n");

  const filteredRecords = records.filter((record) => {
    const job = allJobs.find((item) => item.id === record.jobId);
    const names = record.studentIds.map((id) => data.students.find((student) => student.id === id)?.name).filter(Boolean).join("、");
    const text = `${record.date}${record.day}${job?.name}${names}${record.status}${record.note}`;
    return !keyword.trim() || text.includes(keyword.trim());
  }).slice(0, 20);

  return <>
    <ToolHeading kicker="值日与岗位" title="一周排班、每日检查、返工记录放在一页" text="先按小组公平轮换，也可以给岗位固定学生；检查结果会进入台账，方便周报和家校沟通引用。" action={<div className="heading-actions"><button className="primary-small" onClick={() => update((d) => ({ ...d, dutyOffset: (d.dutyOffset + 1) % maxGroup }))}>轮换一周</button><button className="weekly-secondary-btn" onClick={() => navigator.clipboard?.writeText(dutyText)}>复制值日表</button></div>} />
    {message && <button className="inline-alert duty-message" onClick={() => setMessage("")}>{message}<span>点击关闭</span></button>}
    <section className="duty-summary">
      <article><span>启用岗位</span><b>{jobs.length}</b><small>岗位可新增、停用、固定人</small></article>
      <article><span>轮值小组</span><b>{maxGroup}</b><small>来自学生名单小组数据</small></article>
      <article><span>{selectedDay}待检查</span><b>{pendingCount}</b><small>含未记录和需返工</small></article>
      <article><span>今日已记录</span><b>{todayRecords.length}</b><small>保存后可复盘</small></article>
    </section>
    <section className="duty-layout">
      <div className="duty-main">
        <div className="duty-tabs">{days.map((day) => <button className={selectedDay === day ? "active" : ""} onClick={() => setSelectedDay(day)} key={day}>{day}</button>)}</div>
        <article className="duty-day-card">
          <header><div><span>{selectedDay}</span><h3>第{((selectedDayIndex + data.dutyOffset) % groups.length) + 1}组轮值</h3></div><button onClick={() => window.print()}>打印公示</button></header>
          {jobs.map((job, jobIndex) => {
            const students = assignedStudents(selectedDayIndex, job, jobIndex);
            const record = todayRecords.find((item) => item.day === selectedDay && item.jobId === job.id);
            return <div className="duty-task-line" key={job.id}>
              <span><b>{job.name}</b><small>{job.area}｜{job.standard}</small></span>
              <strong>{students.map((student) => student.name).join("、") || "待安排"}</strong>
              <em className={`duty-status ${record?.status ?? "待检查"}`}>{record?.status ?? "待检查"}</em>
              <button onClick={() => mark(selectedDay, job, jobIndex, "已完成")}>完成</button>
              <button onClick={() => mark(selectedDay, job, jobIndex, "需返工")}>返工</button>
            </div>;
          })}
        </article>
        <div className="duty-week-board">{days.map((day, dayIndex) => <article className={day === selectedDay ? "active" : ""} key={day}><b>{day}</b><span>第{((dayIndex + data.dutyOffset) % groups.length) + 1}组</span><p>{jobs.slice(0, 4).map((job, jobIndex) => `${job.name}：${assignedStudents(dayIndex, job, jobIndex).map((student) => student.name).join("、") || "待安排"}`).join("；")}</p></article>)}</div>
      </div>
      <aside className="duty-side">
        <section><header><div><span>岗位设置</span><h3>岗位、区域、标准</h3></div><button onClick={addJob}>新增岗位</button></header><div className="duty-job-editor">{allJobs.map((job) => <article key={job.id}><label><span>岗位名</span><input value={job.name} onChange={(e) => editJob(job.id, { name: e.target.value })} /></label><label><span>区域</span><input value={job.area} onChange={(e) => editJob(job.id, { area: e.target.value })} /></label><label><span>检查标准</span><textarea value={job.standard} onChange={(e) => editJob(job.id, { standard: e.target.value })} /></label><label><span>固定学生</span><select value={job.studentIds?.[0] ?? ""} onChange={(e) => editJob(job.id, { studentIds: e.target.value ? [e.target.value] : [] })}><option value="">按小组自动轮换</option>{data.students.map((student) => <option value={student.id} key={student.id}>{student.name}</option>)}</select></label><button className={job.enabled === false ? "" : "enabled"} onClick={() => editJob(job.id, { enabled: job.enabled === false })}>{job.enabled === false ? "已停用，点击启用" : "启用中，点击停用"}</button></article>)}</div></section>
        <section><header><div><span>检查台账</span><h3>最近记录</h3></div><button onClick={() => navigator.clipboard?.writeText(filteredRecords.map((record) => `${record.date} ${record.day} ${record.status} ${record.note}`).join("\n"))}>复制</button></header><input className="duty-search" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜岗位、学生、备注" /><div className="duty-record-list">{filteredRecords.length ? filteredRecords.map((record) => { const job = allJobs.find((item) => item.id === record.jobId); return <article key={record.id}><b>{record.date} {record.day}｜{job?.name ?? "值日岗位"}｜{record.status}</b><textarea value={record.note} placeholder="补充检查备注" onChange={(e) => update((current) => ({ ...current, dutyRecords: (current.dutyRecords ?? []).map((item) => item.id === record.id ? { ...item, note: e.target.value } : item) }))} /></article>; }) : <p>还没有符合条件的值日记录。</p>}</div></section>
      </aside>
    </section>
  </>;
}

function Cadres({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [status, setStatus] = useState("全部");
  const [keyword, setKeyword] = useState("");
  function edit(id: string, patch: Partial<CadreRole>) {
    update((d) => ({ ...d, cadres: (d.cadres ?? []).map((c) => c.id === id ? { ...c, ...patch } : c) }));
  }
  function add() {
    update((d) => ({ ...d, cadres: [...(d.cadres ?? []), { id: crypto.randomUUID(), role: "新岗位", studentId: d.students[0]?.id ?? "", duty: "填写岗位职责", scope: "班级管理", term: "本学期", status: "试用", weeklyScore: 3, summary: "填写本周履职表现。" }] }));
  }
  const roles = data.cadres ?? [];
  const filtered = roles.filter((role) => {
    const student = data.students.find((item) => item.id === role.studentId);
    const text = `${role.role}${student?.name}${role.duty}${role.scope}${role.summary}`;
    return (status === "全部" || role.status === status) && (!keyword.trim() || text.includes(keyword.trim()));
  });
  const appointmentText = filtered.map((role) => {
    const student = data.students.find((item) => item.id === role.studentId);
    return `兹聘任 ${student?.name ?? "某同学"} 为本班 ${role.role}，负责：${role.duty}`;
  }).join("\n");
  return <>
    <ToolHeading kicker="班干部" title="任命、职责、履职评价和聘任书连在一起" text="能新增岗位、选择学生、写职责、记录每周履职表现，也能复制聘任书文字。" action={<div className="heading-actions"><button className="primary-small" onClick={add}>新增岗位</button><button className="weekly-secondary-btn" onClick={() => navigator.clipboard?.writeText(appointmentText)}>复制聘任书</button></div>} />
    <section className="cadre-summary"><article><span>岗位数</span><b>{roles.length}</b><small>班委、课代表、岗位长都可管理</small></article><article><span>在任</span><b>{roles.filter((role) => role.status === "在任").length}</b><small>可用于班干部名单</small></article><article><span>试用/轮换</span><b>{roles.filter((role) => role.status !== "在任").length}</b><small>适合阶段调整</small></article><article><span>平均履职</span><b>{Math.round(roles.reduce((sum, role) => sum + (role.weeklyScore ?? 0), 0) / Math.max(1, roles.length))}</b><small>满分5分</small></article></section>
    <section className="cadre-toolbar"><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜岗位、学生、职责" /><select value={status} onChange={(e) => setStatus(e.target.value)}><option>全部</option><option>在任</option><option>试用</option><option>轮换</option></select></section>
    <section className="cadre-grid detailed">{filtered.map((role) => {
      const student = data.students.find((item) => item.id === role.studentId);
      return <article key={role.id}><div className="cadre-card-head"><input value={role.role} onChange={(e) => edit(role.id, { role: e.target.value })} /><select value={role.status ?? "在任"} onChange={(e) => edit(role.id, { status: e.target.value as CadreRole["status"] })}><option>在任</option><option>试用</option><option>轮换</option></select></div><label><span>任职学生</span><select value={role.studentId} onChange={(e) => edit(role.id, { studentId: e.target.value })}>{data.students.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label><span>管理范围</span><input value={role.scope ?? ""} onChange={(e) => edit(role.id, { scope: e.target.value })} /></label><label><span>岗位职责</span><textarea value={role.duty} onChange={(e) => edit(role.id, { duty: e.target.value })} /></label><label><span>本周履职评价</span><textarea value={role.summary ?? ""} onChange={(e) => edit(role.id, { summary: e.target.value })} /></label><label><span>履职分</span><input type="range" min={1} max={5} value={role.weeklyScore ?? 3} onChange={(e) => edit(role.id, { weeklyScore: Number(e.target.value) })} /><b>{role.weeklyScore ?? 3} / 5</b></label><div className="appointment"><b>班委聘任书</b><p>兹聘任 {student?.name || "某同学"} 为本班 {role.role}，负责：{role.duty}</p></div><button className="text-danger" onClick={() => update((d) => ({ ...d, cadres: (d.cadres ?? []).filter((item) => item.id !== role.id) }))}>删除岗位</button></article>;
    })}</section>
  </>;
}

function Records({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [student, setStudent] = useState(data.students[0]?.name ?? "");
  const [type, setType] = useState("家访登记");
  const [channel, setChannel] = useState("微信");
  const [purpose, setPurpose] = useState("了解学生在家学习与作息情况");
  const [home, setHome] = useState("家长工作较忙，孩子作业需要更多陪伴和提醒。");
  const [content, setContent] = useState("反馈学生在校表现，约定本周先从按时完成作业开始。");
  const [opinion, setOpinion] = useState("家长愿意配合，周五再次反馈。");
  const [followUp, setFollowUp] = useState("周五再次反馈执行情况。");
  const [filter, setFilter] = useState("全部类型");
  const [recordStatus, setRecordStatus] = useState("全部状态");
  const [keyword, setKeyword] = useState("");
  function add() {
    const text = `目的：${purpose}｜家庭情况：${home}｜沟通内容：${content}`;
    const selectedStudent = data.students.find((item) => item.name === student);
    const record: CommunicationRecord = { id: crypto.randomUUID(), student, type, channel, content: text, parentFeedback: opinion, followUp, status: "待跟进", date: "刚刚" };
    const evidence: GrowthEvidence | null = selectedStudent ? { id: crypto.randomUUID(), studentId: selectedStudent.id, date: today(), type, title: `${student} ${type}`, content: text, followUp, source: "家校沟通", createdAt: Date.now() } : null;
    update((d) => ({ ...d, records: [record, ...d.records], growthEvidence: evidence ? [evidence, ...(d.growthEvidence ?? [])] : d.growthEvidence }));
  }
  const types = ["全部类型", ...Array.from(new Set(data.records.map((record) => record.type)))];
  const visibleRecords = data.records.filter((record) => {
    const text = `${record.student}${record.type}${record.channel}${record.content}${record.parentFeedback}${record.followUp}`;
    return (filter === "全部类型" || record.type === filter) && (recordStatus === "全部状态" || record.status === recordStatus) && (!keyword.trim() || text.includes(keyword.trim()));
  });
  const followCount = data.records.filter((record) => record.status === "待跟进").length;
  return <>
    <ToolHeading kicker="家校沟通" title="家访、谈心、作业跟进都按结构记录" text="每条记录包含沟通方式、目的、过程、家长反馈和下一步跟进，并同步沉淀到成长档案。" />
    <section className="records-dashboard"><article><span>沟通记录</span><b>{data.records.length}</b><small>可筛选检索</small></article><article><span>待跟进</span><b>{followCount}</b><small>建议优先处理</small></article><article><span>涉及学生</span><b>{new Set(data.records.map((record) => record.student)).size}</b><small>避免只关注少数学生</small></article></section>
    <section className="visit-form rich"><div className="visit-grid"><label><span>学生</span><select value={student} onChange={(e) => setStudent(e.target.value)}>{data.students.map((s) => <option key={s.id}>{s.name}</option>)}</select></label><label><span>类型</span><select value={type} onChange={(e) => setType(e.target.value)}>{["家访登记", "谈心记录", "作业跟进", "纪律表现", "表扬记录", "心理关注"].map((t) => <option key={t}>{t}</option>)}</select></label><label><span>方式</span><select value={channel} onChange={(e) => setChannel(e.target.value)}>{["微信", "电话", "面谈", "家访", "班级群"].map((item) => <option key={item}>{item}</option>)}</select></label><label><span>沟通目的</span><input value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label><label><span>家庭/在校情况</span><textarea value={home} onChange={(e) => setHome(e.target.value)} /></label><label><span>沟通内容</span><textarea value={content} onChange={(e) => setContent(e.target.value)} /></label><label><span>家长反馈</span><textarea value={opinion} onChange={(e) => setOpinion(e.target.value)} /></label><label><span>下一步跟进</span><textarea value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></label></div><button onClick={add}>保存记录并同步成长档案</button></section>
    <section className="record-filters"><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜学生、内容、反馈、跟进" /><select value={filter} onChange={(e) => setFilter(e.target.value)}>{types.map((item) => <option key={item}>{item}</option>)}</select><select value={recordStatus} onChange={(e) => setRecordStatus(e.target.value)}><option>全部状态</option><option>待跟进</option><option>已跟进</option><option>已归档</option></select></section>
    <div className="timeline records-list">{visibleRecords.map((r) => <article key={r.id}><i>{r.student.slice(0,1)}</i><div><header><b>{r.student}</b><span>{r.type}</span><em>{r.channel ?? "面谈"}</em><time>{r.date}</time></header><p>{r.content}</p>{r.parentFeedback && <small>家长反馈：{r.parentFeedback}</small>}{r.followUp && <small>下一步：{r.followUp}</small>}<footer><select value={r.status ?? "待跟进"} onChange={(e) => update((d) => ({ ...d, records: d.records.map((item) => item.id === r.id ? { ...item, status: e.target.value as CommunicationRecord["status"] } : item) }))}><option>待跟进</option><option>已跟进</option><option>已归档</option></select><button onClick={() => navigator.clipboard?.writeText(`${r.student}｜${r.type}｜${r.content}｜${r.followUp ?? ""}`)}>复制</button><button onClick={() => update((d) => ({ ...d, records: d.records.filter((item) => item.id !== r.id) }))}>删除</button></footer></div></article>)}</div>
  </>;
}

function Scores({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [examId, setExamId] = useState(data.scoreExams?.[0]?.id ?? "");
  const [keyword, setKeyword] = useState("");
  const [band, setBand] = useState("全部");
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "class-1";
  const exams = data.scoreExams?.length ? data.scoreExams : [defaultScoreExam(data.students, activeClassId)];
  const exam = exams.find((item) => item.id === examId) ?? exams[0];
  const subjects = exam.subjects.length ? exam.subjects : ["总分"];
  const averageForExam = (sourceExam: ScoreExam, student: Student) => {
    const sourceSubjects = sourceExam.subjects.length ? sourceExam.subjects : ["总分"];
    return Math.round(sourceSubjects.reduce((sum, subject) => sum + (sourceExam.scores[student.id]?.[subject] ?? student.score), 0) / Math.max(1, sourceSubjects.length));
  };
  const averageFor = (student: Student) => averageForExam(exam, student);
  const ranked = [...data.students].map((student) => ({ student, average: averageFor(student) })).sort((a, b) => a.average - b.average);
  const visible = ranked.filter(({ student, average }) => {
    const text = `${student.name}${student.studentNo}${student.group}`;
    const bandOk = band === "全部" || (band === "优秀" && average >= 90) || (band === "临界" && average >= 80 && average < 90) || (band === "帮扶" && average < 80);
    return bandOk && (!keyword.trim() || text.includes(keyword.trim()));
  });
  const average = Math.round(ranked.reduce((sum, item) => sum + item.average, 0) / Math.max(1, ranked.length));
  function updateExam(nextExam: ScoreExam) {
    const nextStudents = data.students.map((student) => ({ ...student, score: nextExam.id === exam.id ? averageForExam(nextExam, student) : student.score }));
    update((current) => ({ ...current, students: nextStudents, rosterClasses: current.rosterClasses?.map((item) => item.id === activeClassId ? { ...item, students: nextStudents } : item), scoreExams: exams.map((item) => item.id === nextExam.id ? nextExam : item) }));
  }
  function setScore(studentId: string, subject: string, score: number) {
    const nextExam = { ...exam, scores: { ...exam.scores, [studentId]: { ...(exam.scores[studentId] ?? {}), [subject]: score } } };
    updateExam(nextExam);
  }
  function addExam() {
    const next = defaultScoreExam(data.students, activeClassId);
    next.id = crypto.randomUUID(); next.title = "新考试"; next.date = today();
    update((current) => ({ ...current, scoreExams: [next, ...exams] }));
    setExamId(next.id);
  }
  return <>
    <ToolHeading kicker="成绩分析" title="多科成绩、临界学生、帮扶建议先跑起来" text="支持新建考试、逐科录分、按优秀/临界/帮扶筛选，并自动生成班级分析与学生建议。" action={<button className="primary-small" onClick={addExam}>新增考试</button>} />
    <section className="score-summary"><div><span>平均分</span><b>{average}</b><small>{exam.title}</small></div><div><span>优秀率</span><b>{Math.round(ranked.filter((item) => item.average >= 90).length / Math.max(1, ranked.length) * 100)}%</b><small>平均90分以上</small></div><div><span>临界/帮扶</span><b>{ranked.filter((item) => item.average < 90).length}</b><small>需要分层关注</small></div></section>
    <section className="score-toolbar"><label><span>考试</span><select value={exam.id} onChange={(e) => setExamId(e.target.value)}>{exams.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><label><span>名称</span><input value={exam.title} onChange={(e) => updateExam({ ...exam, title: e.target.value })} /></label><label><span>日期</span><input type="date" value={exam.date} onChange={(e) => updateExam({ ...exam, date: e.target.value })} /></label><label><span>筛选</span><select value={band} onChange={(e) => setBand(e.target.value)}><option>全部</option><option>优秀</option><option>临界</option><option>帮扶</option></select></label><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜姓名/学号/小组" /></section>
    <section className="score-layout"><div className="score-table-wrap"><div className="score-table" style={{ gridTemplateColumns: `90px repeat(${subjects.length}, 76px) 76px 1.4fr` }}><b>学生</b>{subjects.map((subject) => <b key={subject}>{subject}</b>)}<b>平均</b><b>建议</b>{visible.map(({ student, average }) => <div className="score-row" key={student.id} style={{ display: "contents" }}><span>{student.name}<small>第{student.group}组</small></span>{subjects.map((subject) => <input aria-label={`${student.name}${subject}成绩`} type="number" min={0} max={100} value={exam.scores[student.id]?.[subject] ?? student.score} onChange={(e) => setScore(student.id, subject, Number(e.target.value) || 0)} key={subject} />)}<strong>{average}</strong><em>{average < 80 ? "安排谈心+错题复盘" : average < 90 ? "临界突破，盯薄弱科" : "推荐表扬，可做经验分享"}</em></div>)}</div></div><aside className="score-insight"><h3>班级诊断</h3><p>低于80分的学生优先进入帮扶名单；80-89分学生适合做临界突破；90分以上可沉淀为表扬和经验分享。</p><h3>重点名单</h3>{ranked.slice(0, 8).map(({ student, average }) => <button key={student.id} onClick={() => setKeyword(student.name)}><b>{student.name}</b><span>{average}分</span><em>{average < 80 ? "帮扶" : average < 90 ? "临界" : "优秀"}</em></button>)}</aside></section>
  </>;
}

function Reflection({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [id, setId] = useState(data.students[0]?.id ?? "");
  const [examId, setExamId] = useState(data.scoreExams?.[0]?.id ?? "");
  const [savedState, setSavedState] = useState("");
  const student = data.students.find(s=>s.id===id) ?? data.students[0];
  if (!student) return null;
  const exams = data.scoreExams?.length ? data.scoreExams : [defaultScoreExam(data.students, data.activeClassId ?? "class-1")];
  const exam = exams.find((item) => item.id === examId) ?? exams[0];
  const existing = (data.examReflections ?? []).find((item) => item.studentId === id && item.examId === exam.id);
  const scoreMap = exam.scores[student.id] ?? {};
  const weakSubject = exam.subjects.length ? [...exam.subjects].sort((a, b) => (scoreMap[a] ?? student.score) - (scoreMap[b] ?? student.score))[0] : "薄弱学科";
  const [draft, setDraft] = useState<ExamReflection>({
    id: crypto.randomUUID(),
    studentId: id,
    examId: exam.id,
    date: today(),
    problem: "",
    reason: "",
    action: "",
    familyMessage: "",
    teacherNote: "",
    status: "草稿",
  });
  useEffect(() => {
    setDraft(existing ?? {
      id: crypto.randomUUID(),
      studentId: id,
      examId: exam.id,
      date: today(),
      problem: `${weakSubject}失分较多，需要先把错题类型分清楚。`,
      reason: "审题、计算或知识点迁移还不够稳定。",
      action: `本周每天整理1道${weakSubject}错题，并向同桌讲清订正思路。`,
      familyMessage: "希望家长提醒我按计划订正错题，不只看分数。",
      teacherNote: "先抓一个最明显的问题，下一次小测看变化。",
      status: "草稿",
    });
    setSavedState("");
  }, [id, exam.id, existing, weakSubject]);
  function save(status: ExamReflection["status"]) {
    const next = { ...draft, id: existing?.id ?? draft.id, studentId: id, examId: exam.id, status };
    const record: CommunicationRecord = { id: crypto.randomUUID(), student: student.name, type: "考试反思", channel: "学生复盘", content: `问题：${next.problem}｜原因：${next.reason}｜行动：${next.action}`, followUp: next.teacherNote, status: status === "已完成" ? "已归档" : "待跟进", date: "刚刚" };
    update((current) => ({ ...current, examReflections: [next, ...(current.examReflections ?? []).filter((item) => item.id !== next.id)], records: status === "已完成" ? [record, ...current.records] : current.records }));
    setSavedState(status === "已完成" ? "已保存，并同步到家校沟通记录" : "草稿已保存");
  }
  return <>
    <ToolHeading kicker="考试反思" title="把分数后面的错因和行动计划保存下来" text="选择学生和考试后，系统会带出薄弱学科提示，老师可编辑问题、原因、行动、家长话术和跟进意见。" action={<button className="primary-small" onClick={() => window.print()}>打印反思单</button>} />
    {savedState && <button className="inline-alert duty-message" onClick={() => setSavedState("")}>{savedState}<span>点击关闭</span></button>}
    <div className="reflection-layout rich"><aside className="student-picker"><h3>选择学生</h3>{data.students.map(s=><button className={s.id===id?"selected":""} key={s.id} onClick={()=>setId(s.id)}><i>{s.name.slice(0,1)}</i><span>{s.name}<small>{s.score}分 · {s.homework}</small></span></button>)}</aside><section className="reflection-paper"><header><div><span>个人复盘单</span><h2>{student.name} 的考试反思</h2></div><select value={exam.id} onChange={(e) => setExamId(e.target.value)}>{exams.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></header><div className="reflection-score-strip">{exam.subjects.map((subject) => <span key={subject}>{subject}<b>{scoreMap[subject] ?? student.score}</b></span>)}<em>薄弱：{weakSubject}</em></div><div className="reflection-form"><label><span>主要问题</span><textarea value={draft.problem} onChange={(e) => setDraft({ ...draft, problem: e.target.value })} /></label><label><span>原因分析</span><textarea value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></label><label><span>下一步行动</span><textarea value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} /></label><label><span>写给家长的话</span><textarea value={draft.familyMessage} onChange={(e) => setDraft({ ...draft, familyMessage: e.target.value })} /></label><label className="wide"><span>班主任跟进</span><textarea value={draft.teacherNote} onChange={(e) => setDraft({ ...draft, teacherNote: e.target.value })} /></label></div><footer><button onClick={() => save("草稿")}>保存草稿</button><button className="primary-small" onClick={() => save("已完成")}>完成并归档</button><button onClick={() => navigator.clipboard?.writeText(`${student.name}考试反思\n问题：${draft.problem}\n原因：${draft.reason}\n行动：${draft.action}\n家长：${draft.familyMessage}\n老师：${draft.teacherNote}`)}>复制反思</button></footer></section></div>
  </>;
}

function Comments({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const [id, setId] = useState(data.students[0]?.id ?? "");
  const [style, setStyle] = useState<TermComment["style"]>("家长可读");
  const [term, setTerm] = useState("2026—2027学年第一学期");
  const [savedState, setSavedState] = useState("");
  const student = data.students.find(s=>s.id===id) ?? data.students[0];
  const evidence = data.records.filter(r=>r.student===student?.name);
  const events = (data.pointEvents ?? []).filter(e=>e.studentId===student?.id);
  const reflections = (data.examReflections ?? []).filter((item) => item.studentId === student?.id);
  const saved = (data.termComments ?? []).find((item) => item.studentId === student?.id && item.term === term && item.style === style);
  const comment = useMemo(() => {
    if (!student) return "";
    const opening = style === "客观正式" ? `${student.name}同学本学期能遵守班级常规，整体学习状态` : style === "温和鼓励" ? `${student.name}同学，这一学期老师看到了你的努力，整体表现` : `${student.name}同学本学期在校表现`;
    const level = student.score >= 90 ? "稳定优秀，学习主动性较强" : student.score >= 80 ? "较为踏实，能够完成多数学习任务" : "还需要老师和家长共同陪伴，逐步建立稳定习惯";
    const eventText = events[0] ? `在日常记录中，${events[0].reason}，说明他/她具备继续进步的基础。` : "平时能够参与班级活动，也在逐步积累自己的小进步。";
    const evidenceText = evidence[0] ? `近期记录显示：${evidence[0].content}` : "接下来可以继续多积累课堂表达、作业订正和自我管理方面的具体表现。";
    const reflectionText = reflections[0] ? `考试后能看到自己的问题：${reflections[0].problem}，并已经形成改进计划。` : "";
    const advice = student.homework === "未交" ? "下阶段建议重点抓作业提交和订正闭环，把每天的小任务落实到位。" : student.score < 80 ? "下阶段建议先从薄弱知识点和错题复盘入手，建立信心。" : "下阶段希望继续保持主动表达和稳定复盘，把优势坚持下去。";
    return `${opening}${level}。${eventText}${evidenceText}${reflectionText}${advice}`;
  }, [student, style, evidence, events, reflections]);
  const [draft, setDraft] = useState(saved?.content ?? comment);
  useEffect(() => { setDraft(saved?.content ?? comment); setSavedState(""); }, [saved?.content, comment]);
  if (!student) return null;
  function save() {
    const item: TermComment = { id: saved?.id ?? crypto.randomUUID(), studentId: student.id, term, style, content: draft, updatedAt: today() };
    update((current) => ({ ...current, termComments: [item, ...(current.termComments ?? []).filter((commentItem) => commentItem.id !== item.id)] }));
    setSavedState("评语已保存");
  }
  return <>
    <ToolHeading kicker="期末评语" title="从成绩、积分、沟通和反思中生成可编辑评语" text="先生成一版可用草稿，老师可切换语气、补充证据、保存和复制；后续再做批量生成。" action={<button className="primary-small" onClick={() => window.print()}>打印当前评语</button>} />
    {savedState && <button className="inline-alert duty-message" onClick={() => setSavedState("")}>{savedState}<span>点击关闭</span></button>}
    <div className="comment-layout rich"><div className="student-picker"><h3>选择学生</h3>{data.students.map(s=><button className={s.id===id?"selected":""} onClick={()=>setId(s.id)} key={s.id}><i>{s.name.slice(0,1)}</i><span>{s.name}<small>{data.records.filter(r=>r.student===s.name).length}条证据 · {s.score}分</small></span></button>)}</div><div className="comment-paper rich"><div className="comment-head"><span>可编辑评语草稿</span><div><select value={style} onChange={(e) => setStyle(e.target.value as TermComment["style"])}><option>家长可读</option><option>温和鼓励</option><option>客观正式</option></select><input value={term} onChange={(e) => setTerm(e.target.value)} /><button onClick={() => setDraft(comment)}>重新生成</button></div></div><h2>{student.name}</h2><textarea value={draft} onChange={(event) => setDraft(event.target.value)} /><div className="evidence-row wrap"><span>引用依据</span><em>成绩 {student.score}</em><em>积分 {student.points}</em><em>{student.homework}</em><em>{evidence.length}条沟通/成长记录</em><em>{reflections.length}条考试反思</em></div><section className="comment-evidence"><h3>可引用证据</h3>{evidence.slice(0, 4).map((item) => <button key={item.id} onClick={() => setDraft(`${draft}${draft.endsWith("。") ? "" : "。"}平时记录中还可以看到：${item.content}`)}><b>{item.type}</b><span>{item.content}</span></button>)}{!evidence.length && <p>暂无记录，可先到家校沟通或成长档案补充证据。</p>}</section><footer><button className="primary-small" onClick={save}>保存评语</button><button onClick={() => navigator.clipboard?.writeText(draft)}>复制评语</button></footer></div></div>
  </>;
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


