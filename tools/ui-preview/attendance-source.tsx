import { createRoot } from 'react-dom/client';
import { Attendance } from '../../app/w/[token]/Attendance';
import { ThemeBoundary } from '../../app/components/workbench/theme/ThemeBoundary';
import { homeworkFixture } from './homework-fixture';
import './students-preview.css';
import '../../app/globals.css';
import pageStyles from '../../app/w/[token]/ClassroomPages.module.css';

// Read-only source recovery, not a new design or a product entry. Synthetic only.
const data=homeworkFixture('normal');
data.activeClassId='class-1';
const day=new Date();
const date=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
data.attendanceRecords=data.students.map((student,i)=>({id:`attendance-source-${i}`,classId:'class-1',studentId:student.id,date,status:i===1?'迟到':i===2?'请假':i===3?'缺勤':'正常',note:i===1?'08:10 到校':i===2?'身体不适，家长已联系':'',period:'全天',createdAt:day.getTime()}));
createRoot(document.getElementById('root')!).render(<ThemeBoundary className={pageStyles.root}><Attendance data={data} update={()=>{}} save={async()=>false} readOnly mobile={innerWidth<=900}/></ThemeBoundary>);
