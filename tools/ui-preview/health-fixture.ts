import {homeworkFixture} from './homework-fixture';
export const healthStates=['normal','mobile-detail','empty-class','no-records','search-empty','students-105','long-record','filters','composer','validation','readonly','loading','saving','save-failure','save-throw','conflict-409','dirty-close','delete-confirm','summary-only','contact','delete-failure'];
export function healthFixture(state:string){
const data=homeworkFixture(state==='students-105'?'students-105':'normal');data.activeClassId='class-1';
data.careProfiles=[{id:'care-demo-1',classId:'class-1',studentId:data.students[0].id,category:'座位照护',severity:'重要',summary:'安排靠前座位',instruction:'课堂展示时，安排便于看清的位置。',contraindication:'座位调整前先与学生确认。',actionContexts:['座位安排'],reviewedAt:'2026-09-15',visibleScope:'班主任'},{id:'care-demo-2',classId:'class-1',studentId:data.students[1].id,category:'活动注意',severity:'重要',summary:'活动前确认参与安排',instruction:'体育活动前与学生确认当天参与安排。',contraindication:'不要沿用未经确认的旧安排。',actionContexts:['体育活动','外出实践'],reviewedAt:'2026-09-14',visibleScope:'班主任'},{id:'care-demo-3',classId:'class-1',studentId:data.students[2].id,category:'健康提醒',severity:'一般',summary:'课间留意休息情况',instruction:'课间主动询问休息是否充足。',actionContexts:['日常观察'],reviewedAt:'2026-09-13',visibleScope:'班主任'}];

if(state==='students-105')data.careProfiles=data.students.map((s,i)=>({...data.careProfiles![i%3],id:'care-'+i,studentId:s.id}));
if(state==='long-record'){data.students[0].name='学生01合成长姓名';data.careProfiles[0].summary='合成长行动摘要'.repeat(5);data.careProfiles[0].instruction='课堂展示时先向学生确认是否可以看清，再安排合适的位置。'.repeat(6);data.careProfiles[0].contraindication='座位调整前先与学生确认。'.repeat(12);data.careProfiles[0].actionContexts=['座位安排','合成自定义午休场景','考试安排'];}
if(state==='no-records')data.careProfiles=[];
if(state==='empty-class'){data.students=[];data.rosterClasses![0].students=[];data.careProfiles=[];}
if(state==='summary-only'){data.careProfiles[0].summary='仅摘要：外出前确认集合地点';data.careProfiles[0].instruction='';}
if(state==='contact')data.guardians=[{id:'synthetic-guardian',classId:'class-1',studentId:data.students[0].id,name:'合成联系人',relation:'监护人',phone:'000-0000',isPrimary:true}];
return data;}
