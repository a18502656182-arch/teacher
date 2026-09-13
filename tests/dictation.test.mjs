import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';

const temp = await mkdtemp(path.join(tmpdir(), 'classroom-dictation-test-'));
for (const name of ['classroom', 'dictation', 'workspaceBackup']) {
  const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText.replace(/from (["'])\.\/(classroom|dictation)\1/g, "from './$2.mjs'");
  await writeFile(path.join(temp, `${name}.mjs`), compiled);
}
after(() => rm(temp, { recursive: true, force: true }));
const { newTask, parseWords, preserveTaskIdentity, recentTasks, statistics, wrongWords, assertDictation } = await import(pathToFileURL(path.join(temp, 'dictation.mjs')));
const { parseWorkspaceBackup } = await import(pathToFileURL(path.join(temp, 'workspaceBackup.mjs')));
const people = (prefix, count) => Array.from({length:count}, (_,i)=>({id:`${prefix}-${i}`,name:`测试学生${i+1}`,number:String(i+1)}));
const classes = ['a','b'].map(id=>({id,name:`测试班${id}`,students:people(id,50)}));
const children = people('child',2).map(p=>({...p,grade:'三年级'}));
const base = {students:classes[0].students,rosterClasses:classes,activeClassId:'a',records:[],courses:[],dictation:{version:1,books:[],children,tasks:[]}};
const task = () => newTask({title:'测试听写',date:'2026-09-11',subject:'英语',context:{kind:'class',classId:'a'},participants:classes[0].students,words:parseWords('apple | 苹果 | 第一课\nbook | 书 | 第一课')});
test('未批改、请假和未参加均不进入正确率分母',()=>{
 const t=task();t.results['a-0']=['graded',[0],'2026-09-11T01:00:00Z',''];t.results['a-1']=['leave',[],'2026-09-11T01:00:00Z',''];t.results['a-2']=['absent',[],'2026-09-11T01:00:00Z',''];
 assert.deepEqual(statistics([t]),{words:2,wrong:1,graded:1,leave:1,absent:1,pending:47,rate:.5});
});
test('材料和参与者是独立快照，复听创建新结果',()=>{
 const t=task();const repeat=newTask({...t,sourceId:t.id});repeat.words[0].text='changed';repeat.participants[0].name='changed';
 assert.equal(t.words[0].text,'apple');assert.notEqual(t.participants[0].name,'changed');assert.notEqual(t.id,repeat.id);assert.deepEqual(repeat.results,{});
});
test('编辑未批改的复习/归档任务保留来源、归档和身份字段',()=>{
 const initial={...task(),sourceId:'source-task',archived:true};
 const edited=newTask({...initial,title:'修改后的任务',words:parseWords('new | 新词 | 第二课')});
 const final=preserveTaskIdentity(initial,edited);
 assert.equal(final.id,initial.id);assert.equal(final.createdAt,initial.createdAt);assert.equal(final.sourceId,'source-task');assert.equal(final.archived,true);assert.equal(final.title,'修改后的任务');assert.deepEqual(final.results,initial.results);
});
test('两班与家庭孩子禁止交叉参与',()=>{
 const t=task();const data=structuredClone(base);data.dictation.tasks=[t];assert.doesNotThrow(()=>assertDictation(data.dictation,data));
 t.participants[0]=classes[1].students[0];assert.throws(()=>assertDictation(data.dictation,data));
 t.context={kind:'family',childId:children[0].id};t.participants=[children[1]];assert.throws(()=>assertDictation(data.dictation,data));
 t.participants=[children[0]];assert.doesNotThrow(()=>assertDictation(data.dictation,data));
});
test('非法错词索引和未参加带错词被拒绝',()=>{
 const t=task();const data={...base,dictation:{...base.dictation,tasks:[t]}};
 for(const result of [['graded',[2]],['graded',[0,0]],['leave',[0]]]){t.results['a-0']=[...result,'2026-09-11T01:00:00Z',''];assert.throws(()=>assertDictation(data.dictation,data));}
});
test('复习答对保留原错词历史，统计按词次加权',()=>{
 const t=task();t.results['a-0']=['graded',[0],'2026-09-11T01:00:00Z',''];const r=newTask({...t,sourceId:t.id,words:[t.words[0]]});r.results['a-0']=['graded',[],'2026-09-11T02:00:00Z',''];
 r.date='2026-09-12';
 assert.equal(wrongWords([t,r],'a-0')[0].count,1);assert.equal(wrongWords([t,r],'a-0')[0].last,'2026-09-12');assert.equal(statistics([t,r],'a-0').rate,1/3);
});

test('近30天窗口包含首尾自然日并排除未来与第31天',()=>{
 const rows=['2026-08-14','2026-08-15','2026-09-13','2026-09-14'].map((date,index)=>({...task(),id:`window-${index}`,date}));
 const window=recentTasks(rows,'2026-09-13');
 assert.equal(window.from,'2026-08-15');
 assert.equal(window.to,'2026-09-13');
 assert.deepEqual(window.tasks.map(item=>item.date),['2026-08-15','2026-09-13']);
});
test('旧版和新版完整备份均可预检',()=>{
 for(const version of [1,2]){const data=structuredClone(base);if(version===1)delete data.dictation;const text=JSON.stringify({format:'classroom-workspace-backup',version,data});assert.equal(parseWorkspaceBackup(text,Buffer.byteLength(text)).preview.students,100);}
});
test('已批改任务禁止改材料，作业删除不破坏历史关联',()=>{
 const t=task();t.results['a-0']=['graded',[0],'2026-09-11T01:00:00Z',''];t.homeworkId='past-homework';
 const before={...base,dictation:{...base.dictation,tasks:[t]}};const after=structuredClone(before);
 assert.doesNotThrow(()=>assertDictation(after.dictation,after,before));
 after.dictation.tasks[0].words[0].text='different';assert.throws(()=>assertDictation(after.dictation,after,before));
});
test('两班各50人、100教学日、每日20词的学期容量',()=>{
 const data=structuredClone(base);const start=performance.now();
 for(const c of classes)for(let day=0;day<100;day++){
  const t=newTask({title:`第${day+1}次听写`,date:'2026-09-11',subject:'英语',context:{kind:'class',classId:c.id},participants:c.students,words:parseWords(Array.from({length:20},(_,i)=>`word${i} | 测试释义 | 第一课`).join('\n'))});
  for(const p of c.students)t.results[p.id]=['graded',[0,3],'2026-09-11T01:00:00Z',''];data.dictation.tasks.push(t);
 }
 assertDictation(data.dictation,data);const text=JSON.stringify({format:'classroom-workspace-backup',version:2,data});const bytes=Buffer.byteLength(text);
 assert.ok(bytes<4.5*1024*1024);console.log(`容量基线：${bytes} bytes；生成、校验与序列化 ${(performance.now()-start).toFixed(1)}ms（不含网络或数据库）`);
 const db=new DatabaseSync(path.join(temp,'capacity.db'));
 try {
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE versions(id INTEGER PRIMARY KEY, data TEXT NOT NULL);');
  const insert=db.prepare('INSERT INTO versions(data) VALUES (?)');const writeStart=performance.now();
  db.exec('BEGIN IMMEDIATE');for(let i=0;i<20;i++)insert.run(text);db.exec('COMMIT');
  assert.equal(db.prepare('SELECT count(*) AS total FROM versions').get().total,20);
  const restored=db.prepare('SELECT data FROM versions WHERE id=20').get().data;
  assert.equal(parseWorkspaceBackup(restored,Buffer.byteLength(restored)).preview.dictationTasks,200);
  console.log(`本机SQLite WAL合成20版写入与回读 ${(performance.now()-writeStart).toFixed(1)}ms；此数值不是线上延迟承诺。`);
 } finally {db.close();}
});
