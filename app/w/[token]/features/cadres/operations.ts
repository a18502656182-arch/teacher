import type { CadreRole, ClassroomData, Student } from '@/lib/classroom';

export type CadreKind = '班委' | '小组长';
export type CadreMutationResult = { data?: ClassroomData; role?: CadreRole; error?: string };

const validStatuses = new Set<CadreRole['status']>(['在任', '试用', '轮换']);

function firstClassId(data: ClassroomData): string {
  return data.rosterClasses?.[0]?.id ?? data.activeClassId ?? 'class-1';
}

function classExists(data: ClassroomData, classId: string): boolean {
  return data.rosterClasses?.length ? data.rosterClasses.some(item => item.id === classId) : classId === firstClassId(data);
}

export function cadreStudentsForClass(data: ClassroomData, classId: string): Student[] {
  const roster = data.rosterClasses?.find(item => item.id === classId);
  if (roster) return roster.students ?? [];
  return classId === (data.activeClassId ?? firstClassId(data)) ? data.students : [];
}

export function cadreRoleKind(role: CadreRole): CadreKind {
  return role.scope === '小组管理' || (Number.isInteger(role.groupNumber) && Number(role.groupNumber) > 0) || /第?\s*\d+\s*组/.test(role.role) || role.role.includes('组长') ? '小组长' : '班委';
}

export function cadreRoleBelongsToClass(data: ClassroomData, role: CadreRole, classId: string): boolean {
  if (role.classId) return role.classId === classId;
  if (role.studentId) {
    const matches = (data.rosterClasses ?? []).filter(item => item.students.some(student => student.id === role.studentId));
    if (matches.length === 1) return matches[0].id === classId;
  }
  return classId === (data.activeClassId ?? firstClassId(data));
}

export function cadreRolesForClass(data: ClassroomData, classId: string): CadreRole[] {
  return (data.cadres ?? []).filter(role => cadreRoleBelongsToClass(data, role, classId));
}

export function cadreGroupNumbersForClass(data: ClassroomData, classId: string): number[] {
  return [...new Set(cadreStudentsForClass(data, classId).map(student => student.group).filter(group => Number.isInteger(group) && group > 0))].sort((left, right) => left - right);
}

export function cadreRoleGroupNumber(data: ClassroomData, classId: string, role: CadreRole): number | undefined {
  if (Number.isInteger(role.groupNumber) && Number(role.groupNumber) > 0) return Number(role.groupNumber);
  const fromName = Number(role.role.match(/第?\s*(\d+)\s*组/)?.[1]);
  if (Number.isInteger(fromName) && fromName > 0) return fromName;
  if (cadreRoleKind(role) !== '小组长') return undefined;
  const student = cadreStudentsForClass(data, classId).find(item => item.id === role.studentId);
  return Number.isInteger(student?.group) && Number(student?.group) > 0 ? Number(student?.group) : undefined;
}

export function cadreCandidatesForRole(data: ClassroomData, classId: string, role: CadreRole): Student[] {
  const students = cadreStudentsForClass(data, classId);
  if (cadreRoleKind(role) === '班委') return students;
  const group = cadreRoleGroupNumber(data, classId, role);
  return group ? students.filter(student => student.group === group) : [];
}

export function missingCadreGroups(data: ClassroomData, classId: string): number[] {
  const groupRoles = cadreRolesForClass(data, classId).filter(role => cadreRoleKind(role) === '小组长');
  return cadreGroupNumbersForClass(data, classId).filter(group => !groupRoles.some(role => cadreRoleGroupNumber(data, classId, role) === group));
}

export function cadreAppointmentText(data: ClassroomData, classId: string, role: CadreRole): string {
  const student = cadreStudentsForClass(data, classId).find(item => item.id === role.studentId);
  if (!student) return `${role.role}尚未任命学生。岗位职责：${role.duty}`;
  const term = role.term?.trim() ? `，任期：${role.term.trim()}` : '';
  return `兹聘任 ${student.name} 为本班 ${role.role}，负责：${role.duty}${term}`;
}

export function saveCadreRole(data: ClassroomData, classId: string, input: CadreRole, makeId: () => string): CadreMutationResult {
  if (!classExists(data, classId)) return { error: '当前班级已不存在，请刷新后重试。' };
  const roles = data.cadres ?? [];
  const existing = input.id ? roles.find(role => role.id === input.id) : undefined;
  if (input.id && (!existing || !cadreRoleBelongsToClass(data, existing, classId))) return { error: '这个岗位已不存在或不属于当前班级。' };

  const roleName = String(input.role ?? '').trim();
  const duty = String(input.duty ?? '').trim();
  if (!roleName || !duty) return { error: '请填写岗位名称和岗位职责。' };

  const kind = cadreRoleKind(input);
  const students = cadreStudentsForClass(data, classId);
  const student = input.studentId ? students.find(item => item.id === input.studentId) : undefined;
  if (input.studentId && !student) return { error: '任命学生必须来自当前班级。' };

  let groupNumber: number | undefined;
  if (kind === '小组长') {
    groupNumber = cadreRoleGroupNumber(data, classId, input);
    if (!groupNumber || !cadreGroupNumbersForClass(data, classId).includes(groupNumber)) return { error: '请选择当前班级已有的小组。' };
    if (!student || student.group !== groupNumber) return { error: `请选择第${groupNumber}组的学生担任小组长。` };
  }

  const weeklyScore = Number(input.weeklyScore);
  if (!Number.isInteger(weeklyScore) || weeklyScore < 1 || weeklyScore > 5) return { error: '本周评价只能选择 1 至 5 分。' };
  const status = input.status ?? '在任';
  if (!validStatuses.has(status)) return { error: '请选择有效的岗位状态。' };

  const id = existing?.id ?? makeId();
  if (!id || (!existing && roles.some(role => role.id === id))) return { error: '岗位编号冲突，请重试。' };
  const scope = kind === '小组长' ? '小组管理' : input.scope === '小组管理' ? '班级管理' : String(input.scope ?? '班级管理').trim() || '班级管理';
  const next: CadreRole = {
    ...input,
    id,
    classId,
    role: roleName,
    studentId: student?.id ?? '',
    duty,
    scope,
    groupNumber,
    term: String(input.term ?? '').trim(),
    status,
    weeklyScore,
    summary: String(input.summary ?? '').trim(),
  };
  const nextRoles = existing ? roles.map(role => role.id === id ? next : role) : [next, ...roles];
  return { data: { ...data, cadres: nextRoles }, role: next };
}

export function removeCadreRole(data: ClassroomData, classId: string, roleId: string): CadreMutationResult {
  const target = (data.cadres ?? []).find(role => role.id === roleId);
  if (!target || !cadreRoleBelongsToClass(data, target, classId)) return { error: '这个岗位已不存在或不属于当前班级。' };
  return { data: { ...data, cadres: (data.cadres ?? []).filter(role => role.id !== roleId) }, role: target };
}
