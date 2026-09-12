import type { ClassroomData, PointEvent, PointRule } from '@/lib/classroom';
import { defaultPointRules } from './catalog';

export function pointRulesForData(data: ClassroomData): PointRule[] {
  if (data.pointRulesInitialized) return data.pointRules ?? [];
  return data.pointRules?.length ? data.pointRules : defaultPointRules;
}

export function replacePointRules(data: ClassroomData, rules: PointRule[]): ClassroomData {
  return { ...data, pointRules: rules, pointRulesInitialized: true };
}

export function upsertPointRule(data: ClassroomData, rule: PointRule): ClassroomData {
  const rules = pointRulesForData(data);
  const next = rules.some(item => item.id === rule.id)
    ? rules.map(item => item.id === rule.id ? rule : item)
    : [rule, ...rules];
  return replacePointRules(data, next);
}

export function patchPointRule(data: ClassroomData, id: string, patch: Partial<PointRule>): ClassroomData {
  const rules = pointRulesForData(data);
  if (!rules.some(item => item.id === id)) return data;
  return replacePointRules(data, rules.map(item => item.id === id ? { ...item, ...patch } : item));
}

export function deletePointRule(data: ClassroomData, id: string): ClassroomData {
  const rules = pointRulesForData(data);
  if (!rules.some(item => item.id === id)) return data;
  return replacePointRules(data, rules.filter(item => item.id !== id));
}

export function pointRuleUsageCount(events: readonly PointEvent[], rule: PointRule): number {
  return events.filter(event => {
    if (event.ruleId) return event.ruleId === rule.id;
    if (event.scene !== rule.scene) return false;
    return [rule.reason, rule.title].filter(Boolean).some(snapshot => event.reason === snapshot || event.reason.startsWith(`${snapshot}｜`));
  }).length;
}
