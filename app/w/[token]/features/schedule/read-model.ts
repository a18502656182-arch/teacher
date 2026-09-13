import type { ScheduleConfig } from '@/lib/classroom';

export function currentLocalDate(now = new Date()): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function createDefaultScheduleConfig(now = new Date()): ScheduleConfig {
  const currentDate = currentLocalDate(now);
  return {
    schoolYear: '自定义学年/学段',
    term: '自定义学期',
    termStartMonth: currentDate.slice(0, 7),
    termEndMonth: `${currentDate.slice(0, 4)}-12`,
    termNote: '不同地区、不同学校开学时间不同，这里由老师自己填写。',
    days: ['周一', '周二', '周三', '周四', '周五'],
    periods: [
      { label: '早读', time: '08:00-08:20' },
      { label: '第1节', time: '08:30-09:10' },
      { label: '第2节', time: '09:20-10:00' },
      { label: '第3节', time: '10:20-11:00' },
      { label: '第4节', time: '11:10-11:50' },
      { label: '午间', time: '12:00-13:30' },
      { label: '第5节', time: '14:00-14:40' },
      { label: '延时', time: '16:20-17:30' },
    ],
  };
}

export function scheduleMonthIndex(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return 0;
  return year * 12 + monthNumber - 1;
}

export function scheduleMonthFromIndex(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function scheduleTermMonths(config?: ScheduleConfig, now = new Date()): string[] {
  const fallback = currentLocalDate(now).slice(0, 7);
  const start = config?.termStartMonth || fallback;
  const end = config?.termEndMonth || start;
  const startIndex = Math.min(scheduleMonthIndex(start), scheduleMonthIndex(end));
  const endIndex = Math.max(scheduleMonthIndex(start), scheduleMonthIndex(end));
  const length = Math.min(24, Math.max(1, endIndex - startIndex + 1));
  return Array.from({ length }, (_, index) => scheduleMonthFromIndex(startIndex + index));
}

export function formatScheduleDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function scheduleWeekDates(month: string, weekOfMonth: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const safeYear = year || new Date().getFullYear();
  const safeMonth = monthNumber || new Date().getMonth() + 1;
  const start = new Date(safeYear, safeMonth - 1, 1 + (weekOfMonth - 1) * 7);
  const end = new Date(safeYear, safeMonth - 1, Math.min(new Date(safeYear, safeMonth, 0).getDate(), weekOfMonth * 7));
  return { startDate: formatScheduleDate(start), endDate: formatScheduleDate(end), label: `${safeYear}年${safeMonth}月第${weekOfMonth}周` };
}

export function scheduleWeeksInMonth(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return 4;
  return Math.ceil(new Date(year, monthNumber, 0).getDate() / 7);
}

export function normalizeScheduleCourses(courses: string[][] | undefined, config: ScheduleConfig): string[][] {
  return config.days.map((_, dayIndex) => Array.from({ length: config.periods.length }, (__, periodIndex) => courses?.[dayIndex]?.[periodIndex] ?? ''));
}
