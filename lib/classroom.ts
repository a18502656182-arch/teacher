export type Student = {
  id: string;
  name: string;
  gender: "男" | "女";
  group: number;
  seat: number;
  points: number;
  homework: "已交" | "待订正" | "未交";
  attendance: "正常" | "迟到" | "请假";
  score: number;
};

export type ClassroomData = {
  students: Student[];
  dutyOffset: number;
  records: { id: string; student: string; type: string; content: string; date: string }[];
  courses: string[][];
};

const names = [
  "林知夏", "陈思远", "周雨桐", "王子谦", "苏沐晴", "赵一鸣",
  "沈佳宁", "许嘉树", "顾安然", "李明轩", "叶可欣", "张景行",
  "唐语柔", "吴承泽", "陆星辰", "宋芷若", "江予安", "何书瑶",
  "徐嘉言", "郑清越", "程念初", "梁宇航", "谢知微", "罗浩然",
];

export const defaultClassroomData: ClassroomData = {
  students: names.map((name, index) => ({
    id: `s${index + 1}`,
    name,
    gender: index % 2 === 0 ? "女" : "男",
    group: Math.floor(index / 4) + 1,
    seat: index + 1,
    points: [18, 14, 21, 9, 16, 12][index % 6],
    homework: (["已交", "已交", "待订正", "已交", "未交"] as const)[index % 5],
    attendance: (["正常", "正常", "正常", "迟到", "正常", "请假"] as const)[index % 6],
    score: [92, 86, 95, 78, 89, 83][index % 6],
  })),
  dutyOffset: 0,
  records: [
    { id: "r1", student: "周雨桐", type: "成长记录", content: "主动帮助同桌整理错题，课堂表达清晰。", date: "今天 10:20" },
    { id: "r2", student: "王子谦", type: "作业跟进", content: "数学订正已完成，明天复查同类题。", date: "昨天 16:45" },
    { id: "r3", student: "苏沐晴", type: "家校沟通", content: "与家长确认近期作息调整方案。", date: "周一 19:10" },
  ],
  courses: [
    ["语文", "数学", "英语", "体育", "科学"],
    ["数学", "语文", "音乐", "英语", "美术"],
    ["英语", "数学", "语文", "科学", "班会"],
    ["语文", "体育", "数学", "英语", "信息"],
    ["数学", "语文", "劳动", "阅读", "社团"],
  ],
};
