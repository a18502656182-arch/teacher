export type WorkspaceModuleId = 'dictation' | 'dashboard' | 'students' | 'attendance' | 'homework' | 'points' | 'rules' | 'growth' | 'health' | 'weekly' | 'schedule' | 'tools' | 'seating' | 'duty' | 'cadres' | 'records' | 'scores' | 'reflection' | 'comments';
export type LearningScene = 'class' | 'family';

export const workspaceModules: ReadonlyArray<{ id: WorkspaceModuleId; label: string }> = [
  { id: 'dashboard', label: '今日工作台' }, { id: 'students', label: '学生名单' },
  { id: 'dictation', label: '听写与复习' }, { id: 'attendance', label: '考勤与请假' },
  { id: 'homework', label: '作业追踪' }, { id: 'points', label: '积分评价' },
  { id: 'rules', label: '积分规则' }, { id: 'growth', label: '成长档案' },
  { id: 'health', label: '健康与照护' }, { id: 'weekly', label: '班级周报' },
  { id: 'schedule', label: '课程日程' }, { id: 'tools', label: '课堂工具' },
  { id: 'seating', label: '座位分组' }, { id: 'duty', label: '值日岗位' },
  { id: 'cadres', label: '班干部' }, { id: 'records', label: '家校沟通' },
  { id: 'scores', label: '成绩分析' }, { id: 'reflection', label: '考试反思' },
  { id: 'comments', label: '期末评语' },
];

export const workspaceNavGroups: ReadonlyArray<{ title: string; items: WorkspaceModuleId[] }> = [
  { title: '今日', items: ['dashboard', 'homework', 'dictation', 'attendance'] },
  { title: '学生', items: ['students', 'growth', 'points', 'health', 'records'] },
  { title: '教学', items: ['scores', 'reflection', 'schedule', 'tools'] },
  { title: '班级', items: ['seating', 'duty', 'cadres', 'rules', 'weekly', 'comments'] },
];

export const mobilePrimaryModules: ReadonlyArray<{ id: WorkspaceModuleId; label: string }> = [
  { id: 'dashboard', label: '首页' },
  { id: 'students', label: '学生' },
  { id: 'homework', label: '作业' },
  { id: 'scores', label: '成绩' },
];

const mobilePrimaryIds = new Set(mobilePrimaryModules.map(item => item.id));
export const mobileMoreGroups = workspaceNavGroups.map(group => ({
  ...group,
  items: group.items.filter(id => !mobilePrimaryIds.has(id)),
}));

export function isWorkspaceModule(value: string | null): value is WorkspaceModuleId {
  return workspaceModules.some(item => item.id === value);
}

export function moduleLabel(id: WorkspaceModuleId) {
  return workspaceModules.find(item => item.id === id)?.label ?? '工作台';
}
