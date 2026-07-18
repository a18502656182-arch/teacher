export type Student = {
  id: string;
  studentNo?: string;
  name: string;
  gender: "男" | "女";
  group: number;
  seat: number;
  points: number;
  homework: "已交" | "待订正" | "未交";
  attendance: "正常" | "迟到" | "请假";
  score: number;
  parentPhone?: string;
  note?: string;
  avoidWith?: string;
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
  studentId: string;
  scene: string;
  reason: string;
  delta: number;
  date: string;
  operator?: string;
};

export type GrowthEvidence = {
  id: string;
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
  role: string;
  studentId: string;
  duty: string;
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
  content: string;
  nextFocus: string;
  createdAt: string;
  updatedAt: string;
};

export type ClassroomData = {
  students: Student[];
  activeClassId?: string;
  rosterClasses?: RosterClass[];
  dutyOffset: number;
  records: { id: string; student: string; type: string; content: string; date: string }[];
  courses: string[][];
  homeworkTasks?: HomeworkTask[];
  pointEvents?: PointEvent[];
  growthEvidence?: GrowthEvidence[];
  pointRules?: PointRule[];
  cadres?: CadreRole[];
  weeklyPlan?: { day: string; focus: string; event: string }[];
  weeklyReports?: WeeklyReport[];
  license?: { tier: "基础版" | "高级版"; canExport: boolean; expiresAt: string };
};

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
  records: [
    { id: "r1", student: "周雨桐", type: "成长记录", content: "主动帮助同桌整理错题，课堂表达清晰。", date: "今天 10:20" },
    { id: "r2", student: "王子谦", type: "作业跟进", content: "数学订正已完成，明天复查同类题。", date: "昨天 16:45" },
    { id: "r3", student: "苏沐晴", type: "家校沟通", content: "与家长确认近期作息调整方案。", date: "周一 19:10" },
    { id: "r4", student: "李明轩", type: "谈心记录", content: "近期课堂举手减少，约定每天至少主动表达一次观点，周五复盘。", date: "周二 12:35" },
    { id: "r5", student: "陈思远", type: "家访准备", content: "家长反馈晚间作业拖拉，建议先固定20分钟专注时段，再逐步延长。", date: "周三 18:20" },
    { id: "r6", student: "唐语柔", type: "表扬记录", content: "卫生角整理到位，被生活委员和同学共同推荐为本周劳动小能手。", date: "周四 09:15" },
  ],
  courses: [
    ["语文", "数学", "英语", "体育", "科学"],
    ["数学", "语文", "音乐", "英语", "美术"],
    ["英语", "数学", "语文", "科学", "班会"],
    ["语文", "体育", "数学", "英语", "信息"],
    ["数学", "语文", "劳动", "阅读", "社团"],
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
    { id: "c1", role: "班长", studentId: "s3", duty: "协助班主任管理自习、值日班长和班级常规。" },
    { id: "c2", role: "学习委员", studentId: "s1", duty: "组织早读，汇总作业缺交名单，联系课代表。" },
    { id: "c3", role: "纪律委员", studentId: "s9", duty: "记录课间和自习纪律，提醒同学遵守班级公约。" },
    { id: "c4", role: "劳动委员", studentId: "s13", duty: "安排卫生岗位，检查桌椅、地面、黑板和门窗。" },
  ],
  weeklyPlan: [
    { day: "周一", focus: "班级公约", event: "晨会强调作业提交与课前准备" },
    { day: "周二", focus: "作业闭环", event: "复查待订正学生" },
    { day: "周三", focus: "家校沟通", event: "联系连续未交作业家长" },
    { day: "周四", focus: "积分表扬", event: "公布小组积分榜" },
    { day: "周五", focus: "周报生成", event: "整理进步学生和待跟进名单" },
  ],
  license: { tier: "高级版", canExport: true, expiresAt: "2099-12-31" },
};
