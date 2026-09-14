import { createEmptyClassroomData, type Student } from '../../lib/classroom';

/** Only synthetic data. Stable clock is installed by the standalone preview entry. */
export function studentsFixture(state: string) {
  const data = createEmptyClassroomData();
  const count = state === 'empty' ? 0 : state === 'large-105' || state === 'long-name' ? 105 : 32;
  const students: Student[] = Array.from({ length: count }, (_, i) => ({
    id: `design-student-${i + 1}`, studentNo: `${i + 1}`.padStart(2, '0'),
    name: state === 'long-name' && i === 0 ? '合成复姓学生长姓名测试' : `学生${`${i + 1}`.padStart(2, '0')}`,
    gender: i % 2 ? '女' : '男', group: Math.floor(i / 4) + 1, seat: i + 1,
    points: 18 + i, score: i === 4 ? 0 : 92,
    homework: i % 4 === 0 ? '待订正' : i % 4 === 3 ? '未交' : '已交',
    attendance: i === 2 ? '请假' : '正常', parentPhone: '', note: i === 1 ? '鼓励主动分享阅读收获。' : '',
  }));
  data.students = students;
  data.rosterClasses = [{ id: 'class-1', name: '三年级2班', grade: '三年级', term: '2026年秋季', students }];
  data.homeworkTasks = count ? [
    { id: 'design-hw-1', classId: 'class-1', title: '语文作业', subject: '语文', date: '2026-09-14', statuses: Object.fromEntries(students.filter((_,i) => i !== 4).map(s => [s.id, s.homework])) },
    { id: 'design-hw-2', classId: 'class-1', title: '数学练习', subject: '数学', date: '2026-09-13', statuses: Object.fromEntries(students.filter((_,i) => i !== 4).map(s => [s.id, '已交' as const])) },
  ] : [];
  if (count > 2) data.attendanceRecords = [{ id:'design-leave',classId:'class-1',studentId:students[2].id,date:'2026-09-14T08:30:00',period:'上午',status:'请假',reason:'病假',createdAt:1789345800000 }];
  return data;
}
