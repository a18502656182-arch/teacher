// Derived from ClassroomApp.Growth at213a1a4; isolated design adapter, formal source unchanged.
import {scheduleTermRange,type ClassroomData,type Student} from '@/lib/classroom';
import {growthEvidenceForStudent} from '@/app/w/[token]/features/growth/operations';
import {growthTimestamp,isInGrowthRange as inGrowthRange,type GrowthTime} from '@/app/w/[token]/features/growth/time-range';
import {recordBelongsToStudent} from '@/app/w/[token]/features/records/operations';
export type GrowthKind = "沟通记录" | "积分表现" | "作业记录" | "老师补充";
export type GrowthTimelineItem = {
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


export type GrowthFilters={keyword:string;groupFilter:string;studentStatusFilter:string;coverageFilter:string;studentSort:string;kind:string;range:GrowthTime;page:number};
export function growthModel(data:ClassroomData,student:Student,f:GrowthFilters,mobile:boolean){
 const {keyword,groupFilter,studentStatusFilter,coverageFilter,studentSort,kind,range,page}=f;
  const activeClassId = data.activeClassId ?? data.rosterClasses?.[0]?.id;
  const termBounds = scheduleTermRange(data.scheduleConfig);
  const records = data.records.filter((record) => recordBelongsToStudent(record, student, activeClassId ?? "class-1"));
  const events = (data.pointEvents ?? []).filter((event) => event.studentId === student.id);
  const tasks = (data.homeworkTasks ?? []).filter((task) => !task.classId || task.classId === activeClassId);
  const homework = tasks.map((task) => ({ task, status: task.statuses[student.id] ?? student.homework }));
  const manual = growthEvidenceForStudent(data, activeClassId ?? "class-1", student.id);
  const homeworkDone = homework.filter(({ status }) => status === "已交" || status === "已复查").length;
  const homeworkRate = homework.length ? Math.round(homeworkDone / homework.length * 100) : 0;
  const positiveEvents = events.filter((event) => event.delta > 0);
  const negativeEvents = events.filter((event) => event.delta < 0);
  const cadre = (data.cadres ?? []).find((role) => role.studentId === student.id && (!role.classId || role.classId === activeClassId));
  const status = student.score < 80 || student.homework !== "已交" || student.attendance !== "正常" || negativeEvents.length > positiveEvents.length
    ? "需要跟进"
    : student.score >= 90 || student.points >= 18 ? "表现良好" : "整体稳定";
  const statusTone = status === "需要跟进" ? "attention" : status === "表现良好" ? "positive" : "steady";
  const studentEvidenceCount = (item: Student) => {
    const hasManual = growthEvidenceForStudent(data, activeClassId ?? "class-1", item.id).length;
    const hasPoints = (data.pointEvents ?? []).filter((event) => event.studentId === item.id).length;
    const hasRecords = data.records.filter((record) => recordBelongsToStudent(record, item, activeClassId ?? "class-1")).length;
    const homeworkCount = tasks.filter((task) => task.statuses[item.id]).length;
    return hasManual + hasPoints + hasRecords + homeworkCount;
  };
  const studentStatusFor = (item: Student) => {
    const itemEvents = (data.pointEvents ?? []).filter((event) => event.studentId === item.id);
    const itemPositive = itemEvents.filter((event) => event.delta > 0).length;
    const itemNegative = itemEvents.filter((event) => event.delta < 0).length;
    if (item.score < 80 || item.homework !== "已交" || item.attendance !== "正常" || itemNegative > itemPositive) return "需要跟进";
    if (item.score >= 90 || item.points >= 18) return "表现良好";
    return "整体稳定";
  };
  const groupOptions = Array.from(new Set(data.students.map((item) => item.group))).sort((a, b) => a - b);
  const attentionCount = data.students.filter((item) => studentStatusFor(item) === "需要跟进").length;
  const noEvidenceCount = data.students.filter((item) => studentEvidenceCount(item) === 0).length;
  const keywordText = keyword.trim().toLocaleLowerCase("zh-CN");
  const shownStudents = data.students
    .filter((item) => !keywordText || `${item.name}${item.studentNo ?? ""}${item.group}${item.score}${item.points}`.toLocaleLowerCase("zh-CN").includes(keywordText))
    .filter((item) => groupFilter === "全部小组" || String(item.group) === groupFilter)
    .filter((item) => studentStatusFilter === "全部状态" || studentStatusFor(item) === studentStatusFilter)
    .filter((item) => coverageFilter === "全部记录" || (coverageFilter === "有记录" ? studentEvidenceCount(item) > 0 : studentEvidenceCount(item) === 0))
    .sort((a, b) => {
      if (studentSort === "记录多优先") return studentEvidenceCount(b) - studentEvidenceCount(a);
      if (studentSort === "积分低优先") return a.points - b.points;
      if (studentSort === "成绩低优先") return a.score - b.score;
      return 0;
    });

  const evidence: GrowthTimelineItem[] = [
    ...manual.map((item) => ({ id: `manual-${item.id}`, kind: "老师补充" as const, label: item.type, title: item.title, content: item.content, followUp: item.followUp, date: item.date, tone: item.type.includes("表扬") || item.type.includes("进步") ? "positive" as const : "neutral" as const, timestamp: growthTimestamp(item.date, item.createdAt) })),
    ...records.map((record) => ({ id: `record-${record.id}`, kind: "沟通记录" as const, label: record.type, title: record.type.includes("表扬") || record.type.includes("成长") ? "积极表现记录" : "沟通与跟进记录", content: record.content, date: record.date, tone: record.type.includes("表扬") || record.type.includes("成长") ? "positive" as const : "neutral" as const, timestamp: growthTimestamp(record.date) })),
    ...events.map((event) => ({ id: `event-${event.id}`, kind: "积分表现" as const, label: event.scene, title: `${event.delta > 0 ? "+" : ""}${event.delta} 积分`, content: event.reason, date: event.date, tone: event.delta > 0 ? "positive" as const : "attention" as const, timestamp: growthTimestamp(event.date) })),
    ...homework.map(({ task, status: taskStatus }) => ({ id: `homework-${task.id}`, kind: "作业记录" as const, label: task.subject, title: task.title, content: `完成状态：${taskStatus}`, date: task.date, tone: taskStatus === "已交" || taskStatus === "已复查" ? "positive" as const : "attention" as const, timestamp: growthTimestamp(task.date) })),
  ].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  const filteredEvidence = evidence.filter((item) => (kind === "全部类型" || item.kind === kind) && inGrowthRange(item.timestamp, range, termBounds.startTime));
  const pageSize = mobile ? 6 : 8;
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
  const studentsWithEvidence = data.students.filter((item) => studentEvidenceCount(item) > 0).length;

 return {student,activeClassId,records,events,homework,homeworkRate,cadre,status,statusTone,studentEvidenceCount,studentStatusFor,groupOptions,attentionCount,noEvidenceCount,shownStudents,evidence,filteredEvidence,pageCount,safePage,visibleEvidence,strengths,followUps,summary,monthlyEvidence,studentsWithEvidence};
}
