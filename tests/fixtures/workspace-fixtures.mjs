const DAY = '2026-09-13';
const ACTIVE_EXPIRES_AT = '2027-09-13';
const BACKUP_FORMAT = 'classroom-workspace-backup';

export const fixtureScenarioIds = Object.freeze(Array.from({ length: 12 }, (_, index) => `E${index}`));

function student(prefix, index, patch = {}) {
  return {
    id: `${prefix}-student-${index}`,
    studentNo: String(index).padStart(3, '0'),
    name: `${prefix.toUpperCase()}班学生${String(index).padStart(3, '0')}`,
    gender: index % 2 ? '男' : '女',
    group: Math.floor((index - 1) / 5) + 1,
    seat: index,
    points: index % 9,
    homework: index % 11 === 0 ? '未交' : index % 7 === 0 ? '待订正' : '已交',
    attendance: index % 17 === 0 ? '请假' : index % 13 === 0 ? '迟到' : '正常',
    score: 70 + (index % 28),
    residence: index % 4 === 0 ? '住宿' : '走读',
    note: '',
    ...patch,
  };
}

function classroom(id, count, patch = {}) {
  return {
    id,
    name: `${id.toUpperCase()}测试班`,
    grade: '三年级',
    term: '2026—2027学年第一学期',
    students: Array.from({ length: count }, (_, index) => student(id, index + 1)),
    ...patch,
  };
}

function emptyData(classes = [classroom('a', 0)]) {
  const activeClass = classes[0];
  return {
    students: activeClass.students,
    activeClassId: activeClass.id,
    rosterClasses: classes,
    dutyOffset: 0,
    dutyJobs: [],
    dutyRecords: [],
    classDutySettings: Object.fromEntries(classes.map((item) => [item.id, { offset: 0, jobs: [] }])),
    attendanceRecords: [],
    teacherAgenda: [],
    workLogs: [],
    guardians: [],
    careProfiles: [],
    classroomToolSessions: [],
    notificationDrafts: [],
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
    classSchedules: Object.fromEntries(classes.map((item) => [item.id, { courses: Array.from({ length: 5 }, () => []), events: [], focuses: [], weeks: [] }])),
    classSeatingConfigs: Object.fromEntries(classes.map((item) => [item.id, { rows: Math.max(1, Math.ceil(item.students.length / 6)), columns: 6, groupCount: Math.max(1, Math.ceil(item.students.length / 5)), aisleAfter: [2, 4] }])),
    dictation: { version: 1, children: [], books: [], tasks: [] },
  };
}

function words(count, prefix = 'word') {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    text: `${prefix}${String(index + 1).padStart(3, '0')}`,
    meaning: `第${index + 1}个合成释义`,
    lesson: `第${Math.floor(index / 10) + 1}课`,
  }));
}

function participants(classroomValue) {
  return classroomValue.students.map((item) => ({ id: item.id, name: item.name, number: item.studentNo ?? '' }));
}

function classDictationTask(classroomValue, index, wordCount = 20, graded = false) {
  const taskParticipants = participants(classroomValue);
  const taskWords = words(wordCount, `e-${classroomValue.id}-${index}-word`);
  const results = graded ? Object.fromEntries(taskParticipants.map((item, participantIndex) => [item.id, [
    'graded',
    participantIndex % 9 === 0 ? [0, Math.min(3, wordCount - 1)] : [],
    `${DAY}T08:00:00.000Z`,
    '',
  ]])) : {};
  return {
    id: `dictation-${classroomValue.id}-${index}`,
    title: `第${index}次合成听写`,
    date: DAY,
    subject: '语文',
    context: { kind: 'class', classId: classroomValue.id },
    participants: taskParticipants,
    words: taskWords,
    results,
    createdAt: `${DAY}T07:00:00.000Z`,
  };
}

function familyTask(child, index) {
  return {
    id: `family-dictation-${child.id}-${index}`,
    title: `家庭听写${index}`,
    date: DAY,
    subject: '语文',
    context: { kind: 'family', childId: child.id },
    participants: [{ id: child.id, name: child.name, number: '' }],
    words: words(8, `family-${child.id}-${index}`),
    results: {},
    createdAt: `${DAY}T09:00:00.000Z`,
  };
}

function homeworkTask(classroomValue, index) {
  return {
    id: `homework-${classroomValue.id}-${index}`,
    classId: classroomValue.id,
    followUpStudentIds: [],
    date: DAY,
    subject: index % 2 ? '语文' : '数学',
    title: `第${index}份合成作业`,
    statuses: Object.fromEntries(classroomValue.students.map((item, studentIndex) => [item.id, studentIndex % 10 === 0 ? '未交' : '已交'])),
  };
}

function workspace(id, data, patch = {}) {
  const first = data.rosterClasses[0];
  return {
    token: `fixture-${id.toLowerCase()}`,
    className: first.name,
    grade: first.grade,
    term: first.term,
    expiresAt: ACTIVE_EXPIRES_AT,
    revision: 1,
    data,
    ...patch,
  };
}

function backup(data, version) {
  const exportData = structuredClone(data);
  if (version === 1) delete exportData.dictation;
  return JSON.stringify({ format: BACKUP_FORMAT, version, exportedAt: `${DAY}T10:00:00.000Z`, data: exportData });
}

function standardTwoClassData() {
  const classes = [classroom('a', 50), classroom('b', 50)];
  const data = emptyData(classes);
  data.homeworkTasks = classes.flatMap((item) => [homeworkTask(item, 1)]);
  data.teacherAgenda = classes.map((item, index) => ({ id: `agenda-${item.id}`, classId: item.id, date: DAY, startTime: `0${index + 8}:00`, type: '班务', title: `${item.name}合成事项`, status: '待处理', createdAt: 1 }));
  data.records = classes.map((item) => ({ id: `record-${item.id}`, classId: item.id, studentId: item.students[0].id, student: item.students[0].name, type: '沟通', content: '合成记录', date: DAY, status: '待跟进' }));
  return data;
}

function nearCapacityData() {
  const targetMinimum = 4.2 * 1024 * 1024;
  const targetMaximum = 4.8 * 1024 * 1024;
  const classValue = classroom('capacity', 50);
  const data = emptyData([classValue]);
  let bytes = 0;
  for (let index = 1; index <= 800 && bytes < targetMinimum; index += 1) {
    data.dictation.tasks.push(classDictationTask(classValue, index, 20, true));
    if (index % 20 === 0) bytes = Buffer.byteLength(backup(data, 2));
  }
  bytes = Buffer.byteLength(backup(data, 2));
  if (bytes >= targetMaximum) throw new Error(`E11 fixture超过4.8MB预检线：${bytes}`);
  return { data, bytes };
}

export function createWorkspaceFixture(id, options = {}) {
  if (!fixtureScenarioIds.includes(id)) throw new Error(`未知fixture场景：${id}`);
  if (id === 'E0') return { id, description: '正式空白工作区', workspace: workspace(id, emptyData()) };
  if (id === 'E1') return { id, description: '两班各50人', workspace: workspace(id, standardTwoClassData()) };
  if (id === 'E2') return { id, description: '单班105人', workspace: workspace(id, emptyData([classroom('large', 105)])) };
  if (id === 'E3') {
    const data = standardTwoClassData();
    data.dictation.children = [{ id: 'child-a', name: '同名孩子', grade: '三年级' }, { id: 'child-b', name: '同名孩子', grade: '四年级' }];
    data.dictation.tasks = data.dictation.children.map((child, index) => familyTask(child, index + 1));
    return { id, description: '家庭两个重名孩子且与班级隔离', workspace: workspace(id, data) };
  }
  if (id === 'E4') {
    const taskCount = options.taskCount ?? 30;
    if (![0, 3, 30].includes(taskCount)) throw new Error('E4 taskCount只支持0、3或30');
    const data = standardTwoClassData();
    data.homeworkTasks = Array.from({ length: taskCount }, (_, index) => homeworkTask(data.rosterClasses[0], index + 1));
    return { id, description: `作业任务${taskCount}条`, workspace: workspace(`${id}-${taskCount}`, data), variant: taskCount };
  }
  if (id === 'E5') {
    const wordCount = options.wordCount ?? 200;
    if (![8, 12, 60, 200].includes(wordCount)) throw new Error('E5 wordCount只支持8、12、60或200');
    const data = standardTwoClassData();
    data.dictation.tasks = [classDictationTask(data.rosterClasses[0], 1, wordCount)];
    return { id, description: `单次听写${wordCount}词`, workspace: workspace(`${id}-${wordCount}`, data), variant: wordCount };
  }
  if (id === 'E6') {
    const longName = `边界姓名${'甲'.repeat(32)}`;
    const classValue = classroom('long', 50, { name: `超长班级名称${'班'.repeat(28)}` });
    classValue.students[0] = student('long', 1, { name: longName, note: `需要持续观察${'详细说明'.repeat(30)}` });
    const data = emptyData([classValue]);
    data.homeworkTasks = [{ ...homeworkTask(classValue, 1), title: `超长任务标题${'复习与订正'.repeat(15)}` }];
    data.teacherAgenda = [{ id: 'long-agenda', classId: classValue.id, date: DAY, startTime: '08:00', type: '班务', title: `超长日程${'家校协同'.repeat(18)}`, detail: `合成长备注${'内容'.repeat(80)}`, status: '待处理', createdAt: 1 }];
    return { id, description: '长姓名、长班名、长标题与长备注', workspace: workspace(id, data) };
  }
  if (id === 'E7') return { id, description: '到期宽限只读', workspace: workspace(id, standardTwoClassData(), { accessMode: 'readonly', expiresAt: '2026-09-12' }), behavior: { writesAllowed: false } };
  if (id === 'E8') return { id, description: '保存服务失败且保留草稿', workspace: workspace(id, standardTwoClassData()), behavior: { saveResponse: { status: 503, error: '合成保存失败，请保留本机草稿后重试' } } };
  if (id === 'E9') return { id, description: '服务器版本冲突', workspace: workspace(id, standardTwoClassData(), { revision: 2 }), behavior: { staleRevision: 1, currentRevision: 2, saveResponse: { status: 409, code: 'WORKSPACE_CONFLICT' } } };
  if (id === 'E10') {
    const data = standardTwoClassData();
    return { id, description: '旧版与当前完整备份', workspace: workspace(id, data), backups: { version1: backup(data, 1), version2: backup(data, 2) } };
  }
  const capacity = nearCapacityData();
  return { id, description: '接近4.8MB听写容量预检线', workspace: workspace(id, capacity.data), metadata: { backupBytes: capacity.bytes }, backups: { version2: backup(capacity.data, 2) } };
}

export function createAllWorkspaceFixtures() {
  return fixtureScenarioIds.map((id) => createWorkspaceFixture(id));
}
