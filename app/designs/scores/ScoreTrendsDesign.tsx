"use client";

import { StudentLookupDialog } from "@/app/components/campus/StudentLookupDialog";
import { useMemo, useState } from "react";
import type { ClassroomData, ScoreExam, Student } from "@/lib/classroom";
import { scoreEntry, scoreExamsForClass } from "@/app/w/[token]/features/scores/operations";

type TrendPoint = { exam: ScoreExam; value: number | null; entered: number; total: number };

function subjects(exam: ScoreExam) { return exam.subjects?.length ? exam.subjects : Object.values(exam.scores)[0] ? Object.keys(Object.values(exam.scores)[0]) : []; }
function rate(exam: ScoreExam, student: Student) {
  const list = subjects(exam);
  const entered = list.filter((subject) => scoreEntry(exam, student.id, subject) != null);
  if (!entered.length) return null;
  const total = entered.reduce((sum, subject) => sum + Number(scoreEntry(exam, student.id, subject) ?? 0), 0);
  const max = entered.reduce((sum, subject) => sum + Number(exam.subjectMaxScores?.[subject] ?? 100), 0);
  return max ? Math.round(total / max * 100) : null;
}

function linePath(points: TrendPoint[]) {let pen=false;return points.map((point,index)=>{if(point.value==null){pen=false;return '';}const command=pen?'L':'M';pen=true;return command+(points.length===1?500:80+index/(points.length-1)*840)+' '+(239.2-point.value*2.028);}).join(' ');}

export function ScoreTrendsDesign({ data, classId }: { data: ClassroomData; classId: string }) {
  const students = data.rosterClasses?.find((item) => item.id === classId)?.students ?? data.students;
  const exams = useMemo(() => scoreExamsForClass(data, classId).toSorted((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)), [classId, data]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [subject, setSubject] = useState("全部");
  const [range, setRange] = useState<"12" | "24" | "all">("12");
  const [page, setPage] = useState(1);
  const student = students.find((item) => item.id === studentId);
  const allSubjects = useMemo(() => Array.from(new Set(exams.flatMap(subjects))).sort((a, b) => a.localeCompare(b)), [exams]);
  const filtered = exams.filter((exam) => {
    const text = `${exam.title}${exam.date}${subjects(exam).join(" ")}`;
    return (!keyword.trim() || text.includes(keyword.trim())) && (subject === "全部" || subjects(exam).includes(subject));
  });
  const scoped = range === "all" ? filtered : filtered.slice(-Number(range));
  const points: TrendPoint[] = scoped.map((exam) => {
    const values = student ? [rate(exam, student)].filter((value): value is number => value != null) : students.map((item) => rate(exam, item)).filter((value): value is number => value != null);
    return { exam, value: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null, entered: values.length, total: student ? 1 : students.length };
  });
  const recorded = points.filter((point) => point.value != null);
  const latest = recorded.at(-1)?.value ?? null;
  const previous = recorded.at(-2)?.value ?? null;
  const delta = latest != null && previous != null ? latest - previous : null;
  const coverage = points.length ? Math.round(points.reduce((sum, point) => sum + point.entered / Math.max(1, point.total), 0) / points.length * 100) : 0;
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(points.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedPoints = [...points].reverse().slice((safePage - 1) * pageSize, safePage * pageSize);
  const chartPoints = points.length > 36 ? points.slice(-36) : points;
  const path = linePath(chartPoints);

  return <section className="score-trends score-trends-workbench" aria-label="历次成绩趋势">
    {pickerOpen && <StudentLookupDialog title="选择趋势学生" students={students} selectedId={studentId} allowClear clearLabel="查看班级整体" onClear={() => { setStudentId(""); setPage(1); }} onPick={(item) => { setStudentId(item.id); setPage(1); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />}
    <header>
      <div><h2>历次趋势</h2><p>按得分率比较不同满分；空白表示未录入，不等同于零分。</p></div>
      <div className="score-trends-heading-actions"><label><span>查看学生</span><button type="button" className="campus-button" onClick={() => setPickerOpen(true)}>{student?.name ?? "班级整体"}</button></label><label><span>时间范围</span><select value={range} onChange={(event) => { setRange(event.target.value as typeof range); setPage(1); }}><option value="12">最近 12 场</option><option value="24">最近 24 场</option><option value="all">全部考试</option></select></label></div>
    </header>
    <div className="score-trends-filters"><label><span>搜索考试</span><input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} placeholder="名称、日期或科目" /></label><label><span>考试包含科目</span><select value={subject} onChange={(event) => { setSubject(event.target.value); setPage(1); }}><option>全部</option>{allSubjects.map((item) => <option key={item}>{item}</option>)}</select></label><p>已纳入 <b>{points.length}</b> / {exams.length} 场考试；平均有录入学生占比 <b>{coverage}%</b>（每人至少录入一科即计入）</p></div>
    {points.length < 2 ? <div className="score-trends-empty">至少需要两场已保存考试，才能显示纵向变化；当前仍可在本次成绩中处理学生跟进。</div> : <>
      <section className="score-trends-summary" aria-label="趋势摘要"><article><span>最近得分率</span><b>{latest == null ? "未录入" : `${latest}%`}</b><small>{student ? student.name : "班级整体"}</small></article><article><span>相对上次</span><b className={delta == null ? "neutral" : delta > 0 ? "up" : delta < 0 ? "down" : "neutral"}>{delta == null ? "数据不足" : `${delta > 0 ? "+" : ""}${delta} 个百分点`}</b><small>比较最近两场有录入的考试</small></article><article><span>可用记录</span><b>{recorded.length}/{points.length}</b><small>未录入的场次不会连接为零分</small></article></section>
      <section className="score-trends-chart" aria-label="得分率折线图"><div><h3>{student ? `${student.name}的得分率变化` : "班级整体得分率变化"}</h3><span>{points.length > chartPoints.length ? `图表展示最近 ${chartPoints.length} 场；完整记录见下方台账` : "按考试日期排序，场次等距；纵轴为得分率"}</span></div><svg viewBox="0 0 1000 260" role="img" aria-label="得分率随考试时间变化的折线图" preserveAspectRatio="xMidYMid meet"><line x1="80" x2="920" y1="36.4" y2="36.4" /><line x1="80" x2="920" y1="137.8" y2="137.8" /><line x1="80" x2="920" y1="239.2" y2="239.2" />{path && <path d={path} />}{chartPoints.map((point, index) => point.value == null ? null : <circle key={point.exam.id} cx={chartPoints.length === 1 ? 500 : 80 + index / (chartPoints.length - 1) * 840} cy={239.2 - point.value * 2.028} r="4"><title>{`${point.exam.title}：${point.value}%`}</title></circle>)}</svg><div className="score-trends-axis"><span>{chartPoints[0]?.exam.date || ""}</span><span>{chartPoints.at(-1)?.exam.date || ""}</span></div></section>
      <section className="score-trends-ledger"><header><h3>趋势台账</h3><span>倒序显示，支持长期考试库</span></header><div>{pagedPoints.map((point) => { const index = points.findIndex((item) => item.exam.id === point.exam.id); const previousPoint = points.slice(0, index).toReversed().find((item) => item.value != null); const change = point.value != null && previousPoint?.value != null ? point.value - previousPoint.value : null; return <article key={point.exam.id}><time>{point.exam.date}</time><span><b>{point.exam.title}</b><small>{subjects(point.exam).join("、") || "未标注科目"}</small></span><strong>{point.value == null ? "未录入" : `${point.value}%`}</strong><em className={change == null ? "neutral" : change > 0 ? "up" : change < 0 ? "down" : "neutral"}>{change == null ? `${point.entered}/${point.total} 已录` : `${change > 0 ? "+" : ""}${change} 个百分点`}</em></article>; })}</div><footer><button type="button" disabled={safePage <= 1} onClick={() => setPage((value) => value - 1)}>上一页</button><span>{safePage} / {totalPages} · 共 {points.length} 场</span><button type="button" disabled={safePage >= totalPages} onClick={() => setPage((value) => value + 1)}>下一页</button></footer></section>
    </>}
  </section>;
}
