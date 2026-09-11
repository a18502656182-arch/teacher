export type Student = {
  id: string;
  studentNo?: string;
  name: string;
  gender: "男" | "女";
  group: number;
  seat: number;
  points: number;
  homework: "已交" | "待订正" | "未交";
  attendance: "正常" | "迟到" | "请假" | "缺勤";
  score: number;
  parentPhone?: string;
  note?: string;
  residence?: "走读" | "住宿" | "未填";
  tags?: string[];
  avoidWith?: string;
  seatNeed?: "无" | "前排" | "后排" | "靠窗" | "靠过道";
  seatFixed?: boolean;
  height?: number;
  groupLeader?: boolean;
};

export type AttendanceStatus = "正常" | "迟到" | "请假" | "缺勤";

export type AttendanceRecord = {
  id: string;
  classId?: string;
  studentId: string;
  date: string;
  period: "全天" | "上午" | "下午";
  status: AttendanceStatus;
  leaveType?: "病假" | "事假" | "其他";
  reason?: string;
  submittedBy?: string;
  contact?: string;
  approval?: "待确认" | "已确认" | "已销假";
  returnedAt?: string;
  note?: string;
  createdAt: number;
};

export type TeacherAgendaType = "备课" | "会议" | "教研" | "批改" | "辅导" | "班级事务" | "其他";

export type TeacherAgendaItem = {
  id: string;
  classId?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  type: TeacherAgendaType;
  title: string;
  detail?: string;
  location?: string;
  relatedStudentIds?: string[];
  status: "待处理" | "进行中" | "已完成" | "已取消";
  completedAt?: string;
  createdAt: number;
};

export type WorkLog = {
  id: string;
  classId?: string;
  agendaId?: string;
  date: string;
  type: TeacherAgendaType;
  title: string;
  detail?: string;
  durationMinutes?: number;
  relatedStudentIds?: string[];
  createdAt: number;
};

export type Guardian = {
  id: string;
  classId?: string;
  studentId: string;
  name: string;
  relation: string;
  phone?: string;
  isPrimary?: boolean;
  emergencyPriority?: number;
};

export type CareProfile = {
  id: string;
  classId?: string;
  studentId: string;
  category: "健康提醒" | "活动注意" | "座位照护" | "过敏与饮食" | "呼吸与心血管" | "视觉与感官" | "行动与书写" | "心理与情绪" | "其他";
  severity: "一般" | "重要" | "紧急";
  summary?: string;
  instruction: string;
  contraindication?: string;
  customCategory?: string;
  actionContexts?: string[];
  reviewedAt?: string;
  reviewDueAt?: string;
  visibleScope: "班主任";
};

export type ClassroomToolSession = {
  id: string;
  classId?: string;
  date: string;
  kind: "随机点名" | "临时分组";
  selectedStudentIds: string[];
  groups?: string[][];
  createdAt: number;
};

export type NotificationDraft = {
  id: string;
  classId?: string;
  date: string;
  title: string;
  content: string;
  channel: "班级群" | "私聊" | "电话提醒";
  recipientStudentIds?: string[];
  status: "草稿" | "已复制" | "已记录回执";
  receiptNote?: string;
  createdAt: number;
};

export type SeatingConfig = {
  rows: number;
  columns: number;
  groupCount: number;
  aisleAfter: number[];
};

export type HomeworkTask = {
  id: string;
  classId?: string;
  followUpStudentIds?: string[];
  date: string;
  subject: string;
  title: string;
  statuses: Record<string, "已交" | "未交" | "待订正" | "已复查">;
};

export type PointEvent = {
  id: string;
  classId?: string;
  studentId: string;
  scene: string;
  reason: string;
  delta: number;
  date: string;
  operator?: string;
};

export type GrowthEvidence = {
  id: string;
  classId?: string;
  studentId: string;
  date: string;
  type: string;
  title: string;
  content: string;
  followUp?: string;
  source?: string;
  createdAt?: number;
};

export type PointRule = {
  id: string;
  scene: string;
  title: string;
  reason: string;
  delta: number;
  owner: string;
  enabled: boolean;
  level: "小学版" | "初中版" | "温和版" | "严格版" | "自定义";
  detail?: string;
};

export type CadreRole = {
  id: string;
  classId?: string;
  role: string;
  studentId: string;
  duty: string;
  scope?: string;
  term?: string;
  status?: "在任" | "试用" | "轮换";
  weeklyScore?: number;
  summary?: string;
};

export type DutyJob = {
  id: string;
  name: string;
  area: string;
  standard: string;
  studentIds?: string[];
  enabled: boolean;
};

export type DutyRecord = {
  id: string;
  classId?: string;
  date: string;
  day: string;
  jobId: string;
  studentIds: string[];
  status: "待检查" | "已完成" | "需返工" | "已替换";
  note: string;
  checkedBy: string;
  createdAt: number;
};

export type CommunicationRecord = {
  id: string;
  classId?: string;
  studentId?: string;
  student: string;
  type: string;
  content: string;
  date: string;
  channel?: string;
  followUp?: string;
  status?: "待跟进" | "已跟进" | "已归档";
  parentFeedback?: string;
};

export type ScoreExam = {
  id: string;
  classId?: string;
  title: string;
  date: string;
  subjects: string[];
  scores: Record<string, Record<string, number>>;
  subjectMaxScores?: Record<string, number>;
  scoreRanges?: Record<string, { id: string; label: string; min: number; max: number }[]>;
  levels?: Record<string, "优秀" | "临界" | "帮扶">;
  advice?: Record<string, string>;
  focusSubjects?: Record<string, string>;
  followUpStudentIds?: string[];
  knowledgeItems?: ScoreKnowledgeItem[];
  paperAnalyses?: ScorePaperAnalysis[];
};

export type ScoreKnowledgeItem = {
  id: string;
  title: string;
  subject?: string;
  questionNo?: string;
  knowledgePoint?: string;
  questionType?: string;
  source?: "teacher" | "ai";
  confidence?: number;
  maxScore: number;
  scores: Record<string, number>;
};

export type ScorePaperAnalysis = {
  id: string;
  sourceName: string;
  sourceType: string;
  sourceSize: number;
  createdAt: string;
  status: "待识别" | "识别中" | "待核对" | "已确认" | "失败";
  message?: string;
  items?: ScoreKnowledgeItem[];
};

export type ExamReflection = {
  id: string;
  classId?: string;
  studentId: string;
  examId?: string;
  date: string;
  problem: string;
  reason: string;
  action: string;
  familyMessage: string;
  teacherNote: string;
  status: "草稿" | "已完成";
};

export type TermComment = {
  id: string;
  classId?: string;
  studentId: string;
  term: string;
  style: "温和鼓励" | "客观正式" | "家长可读";
  content: string;
  updatedAt: string;
};

export type SchedulePeriod = {
  label: string;
  time?: string;
};

export type ScheduleConfig = {
  schoolYear: string;
  term: string;
  termStartMonth?: string;
  termEndMonth?: string;
  termNote?: string;
  days: string[];
  periods: SchedulePeriod[];
};

export type ScheduleEvent = {
  id: string;
  date: string;
  title: string;
  type: "班会" | "活动" | "考试" | "放假" | "家校" | "其他";
  detail: string;
};

export type DailyFocus = {
  id: string;
  date: string;
  focus: string;
  todo: string;
  status: "待处理" | "进行中" | "已完成";
};

export type ScheduleWeek = {
  id: string;
  month: string;
  weekOfMonth: number;
  label: string;
  startDate: string;
  endDate: string;
  config: ScheduleConfig;
  courses: string[][];
  events: ScheduleEvent[];
  focuses: DailyFocus[];
};

export type ClassScheduleData = {
  config?: ScheduleConfig;
  courses: string[][];
  events: ScheduleEvent[];
  focuses: DailyFocus[];
  weeks: ScheduleWeek[];
};

export type RosterClass = {
  id: string;
  name: string;
  grade: string;
  term: string;
  students: Student[];
};

export type WeeklyReport = {
  id: string;
  classId: string;
  weekStart: string;
  weekEnd: string;
  edition: "家长版" | "教师版";
  title?: string;
  status?: "草稿" | "已归档";
  content: string;
  nextFocus: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

export type ClassroomData = {
  students: Student[];
  activeClassId?: string;
  rosterClasses?: RosterClass[];
  dutyOffset: number;
  dutyJobs?: DutyJob[];
  dutyRecords?: DutyRecord[];
  attendanceRecords?: AttendanceRecord[];
  teacherAgenda?: TeacherAgendaItem[];
  workLogs?: WorkLog[];
  guardians?: Guardian[];
  careProfiles?: CareProfile[];
  classroomToolSessions?: ClassroomToolSession[];
  notificationDrafts?: NotificationDraft[];
  records: CommunicationRecord[];
  courses: string[][];
  homeworkTasks?: HomeworkTask[];
  pointEvents?: PointEvent[];
  growthEvidence?: GrowthEvidence[];
  pointRules?: PointRule[];
  cadres?: CadreRole[];
  scoreExams?: ScoreExam[];
  examReflections?: ExamReflection[];
  termComments?: TermComment[];
  weeklyPlan?: { day: string; focus: string; event: string }[];
  weeklyReports?: WeeklyReport[];
  scheduleConfig?: ScheduleConfig;
  scheduleEvents?: ScheduleEvent[];
  dailyFocus?: DailyFocus[];
  scheduleWeeks?: ScheduleWeek[];
  seatingConfig?: SeatingConfig;
  classSchedules?: Record<string, ClassScheduleData>;
  classSeatingConfigs?: Record<string, SeatingConfig>;
  license?: { tier: "基础版" | "高级版"; canExport: boolean; expiresAt: string };
};

/**
 * Generate a client-safe record id. `crypto.randomUUID()` is unavailable on
 * non-secure HTTP origins and some older WebViews, so every write flow must
 * keep a non-throwing fallback.
 */
export function makeId(prefix = "id") {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 正式新工作台的最小空白数据；演示数据只能用于 /w/demo。 */
export function createEmptyClassroomData(): ClassroomData {
  const classId = "class-1";
  return {
    students: [],
    activeClassId: classId,
    rosterClasses: [{ id: classId, name: "我的班级", grade: "", term: "", students: [] }],
    dutyOffset: 0,
    records: [],
    courses: Array.from({ length: 5 }, () => []),
    homeworkTasks: [],
    pointEvents: [],
    growthEvidence: [],
    pointRules: [],
    cadres: [],
    scoreExams: [],
    examReflections: [],
    termComments: [],
    weeklyReports: [],
    attendanceRecords: [],
    teacherAgenda: [],
    workLogs: [],
    guardians: [],
    careProfiles: [],
    classroomToolSessions: [],
    notificationDrafts: [],
  };
}

export function monthIndex(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return 0;
  return year * 12 + monthNumber - 1;
}

export function scheduleTermRange(config?: Pick<ScheduleConfig, "termStartMonth" | "termEndMonth">, fallbackYear = new Date().getFullYear()) {
  const fallbackStart = `${fallbackYear}-08`;
  const fallbackEnd = `${fallbackYear + 1}-01`;
  const rawStart = config?.termStartMonth || fallbackStart;
  const rawEnd = config?.termEndMonth || fallbackEnd;
  const startMonth = monthIndex(rawStart) <= monthIndex(rawEnd) ? rawStart : rawEnd;
  const endMonth = monthIndex(rawStart) <= monthIndex(rawEnd) ? rawEnd : rawStart;
  const [startYear, startMonthNumber] = startMonth.split("-").map(Number);
  const [endYear, endMonthNumber] = endMonth.split("-").map(Number);
  const endDay = new Date(endYear, endMonthNumber, 0).getDate();
  return {
    startMonth,
    endMonth,
    startDate: `${startMonth}-01`,
    endDate: `${endMonth}-${String(endDay).padStart(2, "0")}`,
    startTime: new Date(startYear, startMonthNumber - 1, 1).getTime(),
    endTime: new Date(endYear, endMonthNumber - 1, endDay, 23, 59, 59, 999).getTime(),
  };
}

export function scheduleTermLabel(config?: Pick<ScheduleConfig, "schoolYear" | "term">, fallback = "当前学期") {
  const schoolYear = config?.schoolYear?.trim();
  const term = config?.term?.trim();
  if (schoolYear && term) return `${schoolYear} · ${term}`;
  return schoolYear || term || fallback;
}

const names = [
  "林知夏", "陈思远", "周雨桐", "王子谦", "苏沐晴", "赵一鸣",
  "沈佳宁", "许嘉树", "顾安然", "李明轩", "叶可欣", "张景行",
  "唐语柔", "吴承泽", "陆星辰", "宋芷若", "江予安", "何书瑶",
  "徐嘉言", "郑清越", "程念初", "梁宇航", "谢知微", "罗浩然",
  "韩亦辰", "高若溪", "马远航", "林沐阳", "秦子墨", "董思涵",
  "潘奕然", "夏知予",
];

export const defaultClassroomData: ClassroomData = {
  students: names.map((name, index) => ({
    id: `s${index + 1}`,
    studentNo: `${index + 1}`.padStart(2, "0"),
    name,
    gender: index % 2 === 0 ? "女" : "男",
    group: Math.floor(index / 4) + 1,
    seat: index + 1,
    points: [18, 14, 21, 9, 16, 12][index % 6],
    homework: (["已交", "已交", "待订正", "已交", "未交"] as const)[index % 5],
    attendance: (["正常", "正常", "正常", "迟到", "正常", "请假"] as const)[index % 6],
    score: [92, 86, 95, 78, 89, 83][index % 6],
    parentPhone: `1380000${(1000 + index).toString().slice(-4)}`,
    note: index % 6 === 3 ? "近期需要关注作业订正" : "",
  })),
  activeClassId: "class-1",
  rosterClasses: [
    {
      id: "class-1",
      name: "三年级2班",
      grade: "三年级",
      term: "2026—2027学年第一学期",
      students: names.map((name, index) => ({
        id: `s${index + 1}`,
        studentNo: `${index + 1}`.padStart(2, "0"),
        name,
        gender: index % 2 === 0 ? "女" : "男",
        group: Math.floor(index / 4) + 1,
        seat: index + 1,
        points: [18, 14, 21, 9, 16, 12][index % 6],
        homework: (["已交", "已交", "待订正", "已交", "未交"] as const)[index % 5],
        attendance: (["正常", "正常", "正常", "迟到", "正常", "请假"] as const)[index % 6],
        score: [92, 86, 95, 78, 89, 83][index % 6],
        parentPhone: `1380000${(1000 + index).toString().slice(-4)}`,
        note: index % 6 === 3 ? "近期需要关注作业订正" : "",
      })),
    },
    {
      id: "class-2",
      name: "四年级1班",
      grade: "四年级",
      term: "2026—2027学年第一学期",
      students: names.slice(0, 18).map((name, index) => ({
        id: `c2-s${index + 1}`,
        studentNo: `${index + 1}`.padStart(2, "0"),
        name: `${name}${index % 3 === 0 ? "" : ""}`,
        gender: index % 2 === 0 ? "女" : "男",
        group: Math.floor(index / 4) + 1,
        seat: index + 1,
        points: [15, 17, 12, 20, 11, 18][index % 6],
        homework: (["已交", "待订正", "已交", "未交"] as const)[index % 4],
        attendance: (["正常", "正常", "迟到", "正常"] as const)[index % 4],
        score: [88, 91, 76, 84, 93, 79][index % 6],
        parentPhone: `1390000${(2000 + index).toString().slice(-4)}`,
        note: index % 5 === 0 ? "新接班，需完善备注" : "",
      })),
    },
  ],
  dutyOffset: 0,
  dutyJobs: [
    { id: "dj-floor", name: "地面保洁", area: "教室地面、桌椅间", standard: "无明显纸屑，桌椅摆正，放学前复查一次。", enabled: true },
    { id: "dj-board", name: "黑板讲台", area: "黑板、粉笔槽、讲台", standard: "课间擦净黑板，粉笔和教具归位。", enabled: true },
    { id: "dj-corridor", name: "走廊门窗", area: "走廊、门窗、窗台", standard: "走廊无杂物，窗台不堆放个人物品。", enabled: true },
    { id: "dj-corner", name: "卫生角", area: "扫把、拖把、垃圾桶", standard: "工具摆放整齐，垃圾桶及时清理。", enabled: true },
    { id: "dj-books", name: "图书角", area: "图书角、阅读柜", standard: "图书按类归位，破损图书单独放置。", enabled: true },
  ],
  dutyRecords: [
    { id: "dr1", classId: "class-1", date: "2026-07-21", day: "星期二", jobId: "dj-board", studentIds: ["s5"], status: "已完成", note: "黑板和讲台整理到位。", checkedBy: "劳动委员", createdAt: 1784600000000 },
    { id: "dr2", classId: "class-1", date: "2026-07-21", day: "星期二", jobId: "dj-corner", studentIds: ["s8"], status: "需返工", note: "拖把未拧干，放学前再检查。", checkedBy: "班主任", createdAt: 1784600060000 },
  ],
  teacherAgenda: [
    { id: "agenda-1", classId: "class-1", date: "2026-08-25", startTime: "07:45", endTime: "08:10", type: "班级事务", title: "核对请假与晨检情况", detail: "确认当天请假学生，并把异常情况写入考勤记录。", relatedStudentIds: ["s4"], status: "待处理", createdAt: 1787600000000 },
    { id: "agenda-2", classId: "class-1", date: "2026-08-25", startTime: "12:20", endTime: "12:45", type: "批改", title: "复查数学订正", detail: "重点查看待订正学生的同类题是否真正掌握。", relatedStudentIds: ["s4", "s10"], status: "进行中", createdAt: 1787600060000 },
    { id: "agenda-3", classId: "class-1", date: "2026-08-26", startTime: "16:30", endTime: "17:00", type: "班级事务", title: "作业连续未交家校沟通", detail: "整理客观情况和下一步家庭配合建议。", relatedStudentIds: ["s10"], status: "待处理", createdAt: 1787600120000 },
  ],
  workLogs: [
    { id: "log-1", classId: "class-1", date: "2026-08-24", type: "备课", title: "完成本周班会材料", detail: "围绕安全与课前准备整理班会提纲。", durationMinutes: 35, createdAt: 1787510000000 },
  ],
  records: [
    { id: "r1", student: "周雨桐", type: "成长记录", channel: "面谈", content: "主动帮助同桌整理错题，课堂表达清晰。", followUp: "周五班会表扬", status: "已归档", date: "今天 10:20" },
    { id: "r2", student: "王子谦", type: "作业跟进", channel: "电话", content: "数学订正已完成，明天复查同类题。", followUp: "明天复查计算题", status: "待跟进", date: "昨天 16:45" },
    { id: "r3", student: "苏沐晴", type: "家校沟通", channel: "微信", content: "与家长确认近期作息调整方案。", parentFeedback: "家长愿意配合早睡打卡。", followUp: "三天后看早读状态", status: "已跟进", date: "周一 19:10" },
    { id: "r4", student: "李明轩", type: "谈心记录", channel: "面谈", content: "近期课堂举手减少，约定每天至少主动表达一次观点，周五复盘。", followUp: "周五课后谈心", status: "待跟进", date: "周二 12:35" },
    { id: "r5", student: "陈思远", type: "家访准备", channel: "电话", content: "家长反馈晚间作业拖拉，建议先固定20分钟专注时段，再逐步延长。", parentFeedback: "家长希望老师给出每日反馈。", followUp: "连续三天检查作业提交", status: "待跟进", date: "周三 18:20" },
    { id: "r6", student: "唐语柔", type: "表扬记录", channel: "班级群", content: "卫生角整理到位，被生活委员和同学共同推荐为本周劳动小能手。", followUp: "纳入周报亮点", status: "已归档", date: "周四 09:15" },
  ],
  courses: [
    ["语文", "数学", "英语", "体育", "科学"],
    ["数学", "语文", "音乐", "英语", "美术"],
    ["英语", "数学", "语文", "科学", "班会"],
    ["语文", "体育", "数学", "英语", "信息"],
    ["数学", "语文", "劳动", "阅读", "社团"],
  ],
  scheduleConfig: {
    schoolYear: "2026秋季接班档案",
    term: "自定义学期",
    termStartMonth: "2026-09",
    termEndMonth: "2027-01",
    termNote: "示例：各地开学时间不同，老师可在课程日程页按本校实际修改。",
    days: ["周一", "周二", "周三", "周四", "周五"],
    periods: [
      { label: "早读", time: "08:00-08:20" },
      { label: "第1节", time: "08:30-09:10" },
      { label: "第2节", time: "09:20-10:00" },
      { label: "第3节", time: "10:20-11:00" },
      { label: "第4节", time: "11:10-11:50" },
      { label: "午间", time: "12:00-13:30" },
      { label: "第5节", time: "14:00-14:40" },
      { label: "延时", time: "16:20-17:30" },
    ],
  },
  scheduleEvents: [
    { id: "se1", date: "2026-07-20", title: "暑期安全主题班会", type: "班会", detail: "防溺水、交通安全、假期作息提醒。" },
    { id: "se2", date: "2026-08-28", title: "开学报名与教室整理", type: "活动", detail: "检查学生资料、安排值日小组整理教室。" },
  ],
  dailyFocus: [
    { id: "df1", date: "2026-07-20", focus: "暑期安全提醒", todo: "班会后把安全回执发到家长群。", status: "进行中" },
    { id: "df2", date: "2026-07-21", focus: "作业闭环", todo: "复查待订正学生，更新作业追踪。", status: "待处理" },
  ],
  scheduleWeeks: [
    {
      id: "sw-2026-07-w4",
      month: "2026-07",
      weekOfMonth: 4,
      label: "2026年7月第4周",
      startDate: "2026-07-20",
      endDate: "2026-07-26",
      config: {
        schoolYear: "2026秋季接班档案",
        term: "自定义学期",
        termStartMonth: "2026-09",
        termEndMonth: "2027-01",
        termNote: "示例学期范围，可按本校实际开学、放假安排修改。",
        days: ["周一", "周二", "周三", "周四", "周五"],
        periods: [
          { label: "早读", time: "08:00-08:20" },
          { label: "第1节", time: "08:30-09:10" },
          { label: "第2节", time: "09:20-10:00" },
          { label: "第3节", time: "10:20-11:00" },
          { label: "第4节", time: "11:10-11:50" },
          { label: "午间", time: "12:00-13:30" },
          { label: "第5节", time: "14:00-14:40" },
          { label: "延时", time: "16:20-17:30" },
        ],
      },
      courses: [
        ["语文", "数学", "英语", "体育", "午餐/午休", "阅读", "班会", "延时服务"],
        ["数学", "语文", "科学", "音乐", "午餐/午休", "劳动", "写字", "社团"],
        ["英语", "数学", "语文", "美术", "午餐/午休", "信息", "心理", "延时作业"],
        ["语文", "体育", "数学", "科学", "午餐/午休", "阅读", "综合", "延时服务"],
        ["数学", "语文", "英语", "劳动", "午餐/午休", "班会", "社团", "放学整理"],
      ],
      events: [
        { id: "swe1", date: "2026-07-20", title: "暑期安全主题班会", type: "班会", detail: "防溺水、交通安全、假期作息提醒。" },
      ],
      focuses: [
        { id: "swf1", date: "2026-07-20", focus: "暑期安全提醒", todo: "班会后把安全回执发到家长群。", status: "进行中" },
        { id: "swf2", date: "2026-07-21", focus: "作业闭环", todo: "复查待订正学生，更新作业追踪。", status: "待处理" },
      ],
    },
  ],
  homeworkTasks: [
    { id: "h1", classId: "class-1", date: "2026-07-17", subject: "数学", title: "计算练习第3页", statuses: Object.fromEntries(names.map((_, index) => [`s${index + 1}`, (["已交", "已交", "待订正", "已复查", "未交"] as const)[index % 5]])) },
    { id: "h2", classId: "class-1", date: "2026-07-17", subject: "语文", title: "阅读摘抄一页", statuses: Object.fromEntries(names.map((_, index) => [`s${index + 1}`, (["已交", "已交", "已复查", "待订正"] as const)[index % 4]])) },
  ],
  pointEvents: [
    { id: "p1", studentId: "s3", scene: "课堂", reason: "主动分享解题思路", delta: 2, date: "今天" },
    { id: "p2", studentId: "s10", scene: "作业", reason: "作业未按时提交", delta: -2, date: "今天" },
    { id: "p3", studentId: "s13", scene: "卫生", reason: "主动整理卫生角", delta: 1, date: "昨天" },
  ],
  cadres: [
    { id: "c1", role: "班长", studentId: "s3", duty: "协助班主任管理自习、值日班长和班级常规。", scope: "班级常规", term: "本学期", status: "在任", weeklyScore: 5, summary: "能主动提醒同学，适合继续培养组织能力。" },
    { id: "c2", role: "学习委员", studentId: "s1", duty: "组织早读，汇总作业缺交名单，联系课代表。", scope: "学习管理", term: "本学期", status: "在任", weeklyScore: 4, summary: "作业反馈及时，早读组织还可以更大胆。" },
    { id: "c3", role: "纪律委员", studentId: "s9", duty: "记录课间和自习纪律，提醒同学遵守班级公约。", scope: "纪律管理", term: "本学期", status: "试用", weeklyScore: 3, summary: "提醒方式需要更温和，适合配合班长一起做。" },
    { id: "c4", role: "劳动委员", studentId: "s13", duty: "安排卫生岗位，检查桌椅、地面、黑板和门窗。", scope: "卫生值日", term: "本学期", status: "在任", weeklyScore: 5, summary: "检查细致，能把值日问题及时反馈给老师。" },
  ],
  scoreExams: [
    {
      id: "exam-mid",
      classId: "class-1",
      title: "期中学情检测",
      date: "2026-07-18",
      subjects: ["语文", "数学", "英语"],
      scores: Object.fromEntries(names.map((_, index) => [`s${index + 1}`, {
        语文: [91, 85, 94, 77, 88, 82][index % 6],
        数学: [96, 88, 92, 74, 90, 79][index % 6],
        英语: [89, 84, 97, 81, 86, 87][index % 6],
      }])),
    },
  ],
  examReflections: [
    { id: "er1", studentId: "s4", examId: "exam-mid", date: "2026-07-19", problem: "数学计算题失分较多，检查不够细。", reason: "草稿纸步骤不清楚，做完后没有复算。", action: "每天完成5道口算和2道竖式计算，错题当天订正。", familyMessage: "希望家长每天帮我看一次错题本签字。", teacherNote: "先抓计算准确率，下一次小测看进步。", status: "已完成" },
  ],
  termComments: [
    { id: "tc1", studentId: "s3", term: "2026—2027学年第一学期", style: "家长可读", content: "周雨桐同学本学期表现稳定，课堂上愿意主动表达，也能在小组合作中帮助同学。希望下阶段继续保持整理错题和课前准备的好习惯，在表达时尝试说得更完整、更有条理。", updatedAt: "2026-07-21" },
  ],
  weeklyPlan: [
    { day: "周一", focus: "班级公约", event: "晨会强调作业提交与课前准备" },
    { day: "周二", focus: "作业闭环", event: "复查待订正学生" },
    { day: "周三", focus: "家校沟通", event: "联系连续未交作业家长" },
    { day: "周四", focus: "积分表扬", event: "公布小组积分榜" },
    { day: "周五", focus: "周报生成", event: "整理进步学生和待跟进名单" },
  ],
  seatingConfig: { rows: 6, columns: 6, groupCount: 8, aisleAfter: [2, 4] },
  license: { tier: "高级版", canExport: true, expiresAt: "2099-12-31" },
};
