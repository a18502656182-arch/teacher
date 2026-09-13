export type GrowthTime = '全部时间' | '近7天' | '近30天' | '本学期';

export function growthTimestamp(value: string, createdAt?: number, now = new Date()): number | null {
  if (createdAt) return createdAt;
  const iso = value.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();
  if (value.includes('今天') || value.includes('刚刚')) return now.getTime();
  if (value.includes('昨天')) return now.getTime() - 86400000;
  const weekDay = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].findIndex(day => value.includes(day));
  if (weekDay >= 0) {
    const current = now.getDay() === 0 ? 7 : now.getDay();
    return now.getTime() - (current - weekDay - 1) * 86400000;
  }
  return null;
}

export function isInGrowthRange(timestamp: number | null, range: GrowthTime, termStartTime?: number, now = new Date()): boolean {
  if (range === '全部时间') return true;
  if (!timestamp) return false;
  if (range === '近7天') return timestamp >= now.getTime() - 7 * 86400000;
  if (range === '近30天') return timestamp >= now.getTime() - 30 * 86400000;
  if (termStartTime) return timestamp >= termStartTime;
  const month = now.getMonth() + 1;
  const start = month >= 8 ? new Date(now.getFullYear(), 7, 1) : month >= 2 ? new Date(now.getFullYear(), 1, 1) : new Date(now.getFullYear() - 1, 7, 1);
  return timestamp >= start.getTime();
}
