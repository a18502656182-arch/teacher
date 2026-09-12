import type { ClassroomData, SeatingConfig, Student } from '@/lib/classroom';

export const seatingLimits = {
  minRows: 1,
  maxRows: 20,
  minColumns: 2,
  maxColumns: 10,
  minGroups: 1,
  maxGroups: 12,
} as const;

export type SeatingSnapshot = {
  classId: string;
  students: Student[];
  config: SeatingConfig;
};

export type SeatingIntegrity = {
  assignedCount: number;
  invalidStudentIds: string[];
  duplicateSeatStudentIds: string[];
  duplicateStudentIds: string[];
  invalidGroupStudentIds: string[];
};

export type SeatingMutationResult = {
  data?: ClassroomData;
  snapshot?: SeatingSnapshot;
  warning?: string;
  error?: string;
};

const seatNeeds: Array<NonNullable<Student['seatNeed']>> = ['无', '前排', '后排', '靠窗', '靠过道'];

function activeClassId(data: ClassroomData): string {
  return data.activeClassId ?? data.rosterClasses?.[0]?.id ?? '';
}

function classExists(data: ClassroomData, classId: string): boolean {
  if (!classId) return false;
  if (data.rosterClasses?.length) return data.rosterClasses.some(item => item.id === classId);
  return activeClassId(data) === classId;
}

export function seatingStudentsForClass(data: ClassroomData, classId: string): Student[] {
  if (data.rosterClasses?.length) return data.rosterClasses.find(item => item.id === classId)?.students ?? [];
  return activeClassId(data) === classId ? data.students : [];
}

function rawConfigForClass(data: ClassroomData, classId: string): SeatingConfig | undefined {
  const classConfig = data.classSeatingConfigs?.[classId];
  if (classConfig) return classConfig;
  const hasClassConfigMap = Boolean(data.classSeatingConfigs && Object.keys(data.classSeatingConfigs).length);
  return !hasClassConfigMap && activeClassId(data) === classId ? data.seatingConfig : undefined;
}

function integer(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

export function normalizeSeatingConfig(input: SeatingConfig | undefined, studentCount: number): { config?: SeatingConfig; error?: string } {
  const rawColumns = integer(input?.columns);
  const columns = Math.max(seatingLimits.minColumns, Math.min(seatingLimits.maxColumns, rawColumns ?? 6));
  const minimumRows = Math.max(1, Math.ceil(studentCount / columns));
  if (minimumRows > seatingLimits.maxRows) {
    return { error: `当前 ${studentCount} 名学生超过座位图上限，请拆分班级或调整名册后再排座。` };
  }
  const rawRows = integer(input?.rows);
  const rows = Math.max(minimumRows, Math.max(seatingLimits.minRows, Math.min(seatingLimits.maxRows, rawRows ?? minimumRows)));
  const rawGroups = integer(input?.groupCount);
  const groupCount = Math.max(seatingLimits.minGroups, Math.min(seatingLimits.maxGroups, rawGroups ?? Math.max(1, Math.ceil(columns / 2))));
  const aisleAfter = [...new Set((input?.aisleAfter ?? [2, 4])
    .map(integer)
    .filter((column): column is number => column !== null && column > 0 && column < columns))]
    .sort((left, right) => left - right);
  return { config: { rows, columns, groupCount, aisleAfter } };
}

export function seatingConfigForClass(data: ClassroomData, classId: string): { config?: SeatingConfig; error?: string } {
  if (!classExists(data, classId)) return { error: '当前班级已不存在，请刷新后重试。' };
  return normalizeSeatingConfig(rawConfigForClass(data, classId), seatingStudentsForClass(data, classId).length);
}

export function seatingGroupForSeat(seat: number, config: SeatingConfig): number {
  if (!Number.isInteger(seat) || seat < 1) return 1;
  const column = (seat - 1) % config.columns;
  if (config.groupCount <= config.columns) {
    return Math.min(config.groupCount, Math.floor(column * config.groupCount / config.columns) + 1);
  }
  return Math.min(config.groupCount, Math.floor((seat - 1) * config.groupCount / (config.rows * config.columns)) + 1);
}

export function inspectSeating(students: readonly Student[], config: SeatingConfig): SeatingIntegrity {
  const capacity = config.rows * config.columns;
  const ids = new Set<string>();
  const seats = new Map<number, string>();
  const duplicateStudentIds: string[] = [];
  const duplicateSeatStudentIds: string[] = [];
  const invalidStudentIds: string[] = [];
  const invalidGroupStudentIds: string[] = [];
  let assignedCount = 0;
  for (const student of students) {
    if (ids.has(student.id)) duplicateStudentIds.push(student.id);
    ids.add(student.id);
    if (!Number.isInteger(student.group) || student.group < 1 || student.group > config.groupCount) invalidGroupStudentIds.push(student.id);
    if (!Number.isInteger(student.seat) || student.seat < 1 || student.seat > capacity) {
      invalidStudentIds.push(student.id);
      continue;
    }
    if (seats.has(student.seat)) {
      duplicateSeatStudentIds.push(student.id);
      continue;
    }
    seats.set(student.seat, student.id);
    assignedCount += 1;
  }
  return { assignedCount, invalidStudentIds, duplicateSeatStudentIds, duplicateStudentIds, invalidGroupStudentIds };
}

function integrityError(students: readonly Student[], config: SeatingConfig): string | undefined {
  const integrity = inspectSeating(students, config);
  if (integrity.duplicateStudentIds.length) return '当前名册存在重复学生标识，不能安全调整座位。';
  if (integrity.invalidStudentIds.length || integrity.duplicateSeatStudentIds.length) return '当前座位存在重复或越界，请先使用智能排座修复。';
  return undefined;
}

function normalizeGroupLeaders(students: Student[]): Student[] {
  const occupiedGroups = new Set<number>();
  return students.map(student => {
    if (!student.groupLeader) return student;
    if (occupiedGroups.has(student.group)) return { ...student, groupLeader: false };
    occupiedGroups.add(student.group);
    return student;
  });
}

function syncClass(data: ClassroomData, classId: string, students: Student[], config?: SeatingConfig): ClassroomData {
  const isActive = activeClassId(data) === classId;
  const classSeatingConfigs = config ? { ...(data.classSeatingConfigs ?? {}), [classId]: config } : data.classSeatingConfigs;
  return {
    ...data,
    students: isActive ? students : data.students,
    rosterClasses: data.rosterClasses?.map(item => item.id === classId ? { ...item, students } : item),
    seatingConfig: config && isActive ? config : data.seatingConfig,
    classSeatingConfigs,
  };
}

export function createSeatingSnapshot(data: ClassroomData, classId: string): { snapshot?: SeatingSnapshot; error?: string } {
  const configResult = seatingConfigForClass(data, classId);
  if (configResult.error) return { error: configResult.error };
  return {
    snapshot: {
      classId,
      students: seatingStudentsForClass(data, classId).map(student => ({ ...student, tags: student.tags ? [...student.tags] : student.tags })),
      config: { ...configResult.config!, aisleAfter: [...configResult.config!.aisleAfter] },
    },
  };
}

export function restoreSeatingSnapshot(data: ClassroomData, classId: string, snapshot: SeatingSnapshot): SeatingMutationResult {
  if (!classExists(data, classId)) return { error: '当前班级已不存在，请刷新后重试。' };
  if (snapshot.classId !== classId) return { error: '这份撤销记录属于其他班级，不能应用到当前班。' };
  const currentIds = seatingStudentsForClass(data, classId).map(student => student.id).sort();
  const snapshotIds = snapshot.students.map(student => student.id).sort();
  if (currentIds.length !== snapshotIds.length || currentIds.some((id, index) => id !== snapshotIds[index])) {
    return { error: '当前名册已经变化，不能恢复旧座位快照。' };
  }
  const configResult = normalizeSeatingConfig(snapshot.config, snapshot.students.length);
  if (configResult.error) return { error: configResult.error };
  return { data: syncClass(data, classId, snapshot.students.map(student => ({ ...student })), configResult.config) };
}

function parseStrictConfig(input: SeatingConfig, studentCount: number): { config?: SeatingConfig; error?: string } {
  const rows = integer(input.rows);
  const columns = integer(input.columns);
  const groupCount = integer(input.groupCount);
  if (rows === null || columns === null || groupCount === null) return { error: '行数、列数和小组数必须是整数。' };
  if (rows < seatingLimits.minRows || rows > seatingLimits.maxRows) return { error: `教室排数必须在 ${seatingLimits.minRows} 至 ${seatingLimits.maxRows} 之间。` };
  if (columns < seatingLimits.minColumns || columns > seatingLimits.maxColumns) return { error: `每排列数必须在 ${seatingLimits.minColumns} 至 ${seatingLimits.maxColumns} 之间。` };
  if (groupCount < seatingLimits.minGroups || groupCount > seatingLimits.maxGroups) return { error: `小组数必须在 ${seatingLimits.minGroups} 至 ${seatingLimits.maxGroups} 之间。` };
  if (rows * columns < studentCount) return { error: `当前配置只有 ${rows * columns} 个座位，不能容纳 ${studentCount} 名学生。` };
  const aisleAfter = [...new Set(input.aisleAfter.map(integer).filter((column): column is number => column !== null && column > 0 && column < columns))].sort((a, b) => a - b);
  return { config: { rows, columns, groupCount, aisleAfter } };
}

export function saveSeatingConfig(data: ClassroomData, classId: string, input: SeatingConfig): SeatingMutationResult {
  if (!classExists(data, classId)) return { error: '当前班级已不存在，请刷新后重试。' };
  const students = seatingStudentsForClass(data, classId);
  const parsed = parseStrictConfig(input, students.length);
  if (parsed.error) return { error: parsed.error };
  const snapshot = createSeatingSnapshot(data, classId).snapshot;
  const config = parsed.config!;
  const nextStudents = normalizeGroupLeaders(students.map(student => ({ ...student, group: seatingGroupForSeat(student.seat, config) })));
  return { data: syncClass(data, classId, nextStudents, config), snapshot };
}

export function swapSeatingStudent(data: ClassroomData, classId: string, studentId: string, targetSeat: number): SeatingMutationResult {
  const configResult = seatingConfigForClass(data, classId);
  if (configResult.error) return { error: configResult.error };
  const config = configResult.config!;
  const students = seatingStudentsForClass(data, classId);
  const problem = integrityError(students, config);
  if (problem) return { error: problem };
  if (!Number.isInteger(targetSeat) || targetSeat < 1 || targetSeat > config.rows * config.columns) return { error: '目标座位不在当前教室布局内。' };
  const first = students.find(student => student.id === studentId);
  if (!first) return { error: '这名学生已不属于当前班级，请重新选择。' };
  if (first.seat === targetSeat) return { error: `${first.name} 已在这个座位。` };
  const second = students.find(student => student.seat === targetSeat);
  const snapshot = createSeatingSnapshot(data, classId).snapshot;
  const nextStudents = normalizeGroupLeaders(students.map(student => {
    if (student.id === first.id) return { ...student, seat: targetSeat, group: seatingGroupForSeat(targetSeat, config) };
    if (second && student.id === second.id) return { ...student, seat: first.seat, group: seatingGroupForSeat(first.seat, config) };
    return student;
  }));
  return { data: syncClass(data, classId, nextStudents), snapshot };
}

function safeRandom(random: () => number): number {
  const value = Number(random());
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0.999999999, value));
}

function mateSeat(seat: number, config: SeatingConfig): number {
  const column = (seat - 1) % config.columns;
  if (column % 2 === 0) return column + 1 < config.columns ? seat + 1 : 0;
  return seat - 1;
}

function isAisleSeat(seat: number, config: SeatingConfig): boolean {
  const column = (seat - 1) % config.columns + 1;
  return config.aisleAfter.some(after => column === after || column === after + 1);
}

function avoidPairCount(students: readonly Student[], config: SeatingConfig): number {
  const bySeat = new Map(students.map(student => [student.seat, student]));
  const pairs = new Set<string>();
  for (const student of students) {
    const mate = bySeat.get(mateSeat(student.seat, config));
    if (mate && (student.avoidWith === mate.id || mate.avoidWith === student.id)) {
      pairs.add([student.id, mate.id].sort().join('|'));
    }
  }
  return pairs.size;
}

export function arrangeSeating(data: ClassroomData, classId: string, random: () => number = Math.random): SeatingMutationResult {
  const configResult = seatingConfigForClass(data, classId);
  if (configResult.error) return { error: configResult.error };
  const config = configResult.config!;
  const students = seatingStudentsForClass(data, classId);
  if (new Set(students.map(student => student.id)).size !== students.length) return { error: '当前名册存在重复学生标识，不能安全排座。' };
  const capacity = config.rows * config.columns;
  if (students.length > capacity) return { error: `当前座位只有 ${capacity} 个，不能容纳 ${students.length} 名学生。` };
  const snapshot = createSeatingSnapshot(data, classId).snapshot;
  const fixedSeats = new Set<number>();
  const fixedIds = new Set<string>();
  const placed = new Map<number, Student>();
  for (const student of students) {
    if (student.seatFixed && Number.isInteger(student.seat) && student.seat >= 1 && student.seat <= capacity && !fixedSeats.has(student.seat)) {
      fixedSeats.add(student.seat);
      fixedIds.add(student.id);
      placed.set(student.seat, student);
    }
  }
  const candidates = Array.from({ length: capacity }, (_, index) => index + 1).filter(seat => !fixedSeats.has(seat));
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(safeRandom(random) * (index + 1));
    [candidates[index], candidates[target]] = [candidates[target], candidates[index]];
  }
  const movable = students.filter(student => !fixedIds.has(student.id)).sort((left, right) => {
    const leftPriority = left.seatNeed && left.seatNeed !== '无' ? 1 : 0;
    const rightPriority = right.seatNeed && right.seatNeed !== '无' ? 1 : 0;
    return rightPriority - leftPriority || (right.height ?? 0) - (left.height ?? 0) || left.id.localeCompare(right.id);
  });
  const assigned = new Map<string, number>();
  for (const student of movable) {
    const valid = candidates.filter(seat => {
      const mate = placed.get(mateSeat(seat, config));
      return !mate || (student.avoidWith !== mate.id && mate.avoidWith !== student.id);
    });
    const pool = valid.length ? valid : candidates;
    const ranked = pool.map(seat => {
      const row = Math.floor((seat - 1) / config.columns) + 1;
      const column = (seat - 1) % config.columns;
      let score = safeRandom(random);
      if (student.seatNeed === '前排') score += (config.rows - row + 1) * 20;
      if (student.seatNeed === '后排') score += row * 20;
      if (student.seatNeed === '靠窗') score += column === 0 || column === config.columns - 1 ? 120 : 0;
      if (student.seatNeed === '靠过道') score += isAisleSeat(seat, config) ? 120 : 0;
      if (student.height) score += row * student.height / 20;
      return { seat, score };
    }).sort((left, right) => right.score - left.score || left.seat - right.seat);
    const chosen = ranked[0]?.seat;
    if (!chosen) return { error: '可用座位不足，智能排座未写入任何结果。' };
    assigned.set(student.id, chosen);
    placed.set(chosen, student);
    candidates.splice(candidates.indexOf(chosen), 1);
  }
  const nextStudents = normalizeGroupLeaders(students.map(student => {
    const seat = assigned.get(student.id) ?? student.seat;
    return { ...student, seat, group: seatingGroupForSeat(seat, config) };
  }));
  const problem = integrityError(nextStudents, config);
  if (problem) return { error: `智能排座校验失败：${problem}` };
  const unmet = avoidPairCount(nextStudents, config);
  return {
    data: syncClass(data, classId, nextStudents),
    snapshot,
    warning: unmet ? `有 ${unmet} 组避让条件受固定座位或容量限制，仍需人工复核。` : undefined,
  };
}

export function rotateSeatingRows(data: ClassroomData, classId: string): SeatingMutationResult {
  const configResult = seatingConfigForClass(data, classId);
  if (configResult.error) return { error: configResult.error };
  const config = configResult.config!;
  const students = seatingStudentsForClass(data, classId);
  const problem = integrityError(students, config);
  if (problem) return { error: problem };
  const movable = students.filter(student => !student.seatFixed).sort((left, right) => left.seat - right.seat || left.id.localeCompare(right.id));
  if (movable.length < 2) return { error: '至少需要 2 名非固定座学生才能轮换。' };
  const targetSeats = movable.map(student => student.seat);
  let shift = config.columns % targetSeats.length;
  if (shift === 0) shift = 1;
  const targetById = new Map(movable.map((student, index) => [student.id, targetSeats[(index - shift + targetSeats.length) % targetSeats.length]]));
  const snapshot = createSeatingSnapshot(data, classId).snapshot;
  const nextStudents = normalizeGroupLeaders(students.map(student => {
    const seat = targetById.get(student.id) ?? student.seat;
    return { ...student, seat, group: seatingGroupForSeat(seat, config) };
  }));
  return { data: syncClass(data, classId, nextStudents), snapshot };
}

export function regroupSeating(data: ClassroomData, classId: string): SeatingMutationResult {
  const configResult = seatingConfigForClass(data, classId);
  if (configResult.error) return { error: configResult.error };
  const config = configResult.config!;
  const students = seatingStudentsForClass(data, classId);
  const problem = integrityError(students, config);
  if (problem) return { error: problem };
  const snapshot = createSeatingSnapshot(data, classId).snapshot;
  return { data: syncClass(data, classId, normalizeGroupLeaders(students.map(student => ({ ...student, group: seatingGroupForSeat(student.seat, config) })))), snapshot };
}

export function patchSeatingStudent(data: ClassroomData, classId: string, studentId: string, patch: Partial<Student>): SeatingMutationResult {
  const configResult = seatingConfigForClass(data, classId);
  if (configResult.error) return { error: configResult.error };
  const config = configResult.config!;
  let students = seatingStudentsForClass(data, classId);
  const current = students.find(student => student.id === studentId);
  if (!current) return { error: '这名学生已不属于当前班级，请重新选择。' };
  if (patch.seat !== undefined && patch.seat !== current.seat) {
    const swapped = swapSeatingStudent(data, classId, studentId, Number(patch.seat));
    if (swapped.error) return swapped;
    data = swapped.data!;
    students = seatingStudentsForClass(data, classId);
  }
  const nextGroup = patch.group === undefined ? students.find(student => student.id === studentId)!.group : Number(patch.group);
  if (!Number.isInteger(nextGroup) || nextGroup < 1 || nextGroup > config.groupCount) return { error: `小组必须在 1 至 ${config.groupCount} 之间。` };
  if (patch.height !== undefined && (!Number.isFinite(Number(patch.height)) || Number(patch.height) < 80 || Number(patch.height) > 220)) return { error: '身高应填写 80 至 220 厘米，或留空。' };
  if (patch.seatNeed !== undefined && !seatNeeds.includes(patch.seatNeed)) return { error: '座位需求无效。' };
  if (patch.avoidWith && (patch.avoidWith === studentId || !students.some(student => student.id === patch.avoidWith))) return { error: '避让对象必须是当前班的另一名学生。' };
  const willLead = patch.groupLeader ?? students.find(student => student.id === studentId)!.groupLeader;
  const nextStudents = students.map(student => {
    if (student.id === studentId) {
      return {
        ...student,
        group: nextGroup,
        height: patch.height === undefined ? (Object.prototype.hasOwnProperty.call(patch, 'height') ? undefined : student.height) : Number(patch.height),
        seatNeed: patch.seatNeed ?? student.seatNeed,
        seatFixed: patch.seatFixed ?? student.seatFixed,
        avoidWith: Object.prototype.hasOwnProperty.call(patch, 'avoidWith') ? patch.avoidWith || undefined : student.avoidWith,
        groupLeader: patch.groupLeader ?? student.groupLeader,
      };
    }
    if (willLead && student.group === nextGroup) return { ...student, groupLeader: false };
    return student;
  });
  return { data: syncClass(data, classId, nextStudents) };
}

export function setSeatingGroupLeader(data: ClassroomData, classId: string, studentId: string): SeatingMutationResult {
  const students = seatingStudentsForClass(data, classId);
  const target = students.find(student => student.id === studentId);
  if (!classExists(data, classId)) return { error: '当前班级已不存在，请刷新后重试。' };
  if (!target) return { error: '这名学生已不属于当前班级，请重新选择。' };
  return {
    data: syncClass(data, classId, students.map(student => student.group === target.group ? { ...student, groupLeader: student.id === target.id } : student)),
  };
}
