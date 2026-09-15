import {createRoot} from 'react-dom/client';
import {HealthCare} from '../../app/w/[token]/HealthCare';
import {ThemeBoundary} from '../../app/components/workbench/theme/ThemeBoundary';
import {homeworkFixture} from './homework-fixture';
import './students-preview.css';
import '../../app/globals.css';
import pageStyles from '../../app/w/[token]/ClassroomPages.module.css';
// Current source, synthetic read-only recovery. No workspace API or real contacts.
const data=homeworkFixture('normal');data.activeClassId='class-1';
data.careProfiles=[{id:'care-demo-1',classId:'class-1',studentId:data.students[0].id,category:'座位照护',severity:'重要',summary:'安排靠前座位',instruction:'课堂展示时，安排便于看清的位置。',contraindication:'座位调整前先与学生确认。',actionContexts:['座位安排'],reviewedAt:'2026-09-15',visibleScope:'班主任'},{id:'care-demo-2',classId:'class-1',studentId:data.students[1].id,category:'活动注意',severity:'重要',summary:'活动前确认参与安排',instruction:'体育活动前与学生确认当天参与安排。',contraindication:'不要沿用未经确认的旧安排。',actionContexts:['体育活动','外出实践'],reviewedAt:'2026-09-14',visibleScope:'班主任'},{id:'care-demo-3',classId:'class-1',studentId:data.students[2].id,category:'健康提醒',severity:'一般',summary:'课间留意休息情况',instruction:'课间主动询问休息是否充足。',actionContexts:['日常观察'],reviewedAt:'2026-09-13',visibleScope:'班主任'}];
createRoot(document.getElementById('root')!).render(<ThemeBoundary className={pageStyles.root}><HealthCare data={data} update={()=>{}} save={async()=>false} readOnly mobile={innerWidth<=900}/></ThemeBoundary>);
