import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || '.qa-shots/attendance-design/interactions');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9238',`--user-data-dir=${path.resolve('.qa-shots/attendance-design/chrome-interactions')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9238/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');
 const ui=code=>evaluate(`(async()=>{const pause=async(ms=100)=>new Promise(r=>setTimeout(r,ms));const click=(text,root=document)=>[...root.querySelectorAll('button')].find(e=>e.getBoundingClientRect().width>0&&e.textContent.trim()===text)?.click();const input=(selector,value)=>{const e=document.querySelector(selector);const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));};${code}})()`);
 const check=(name,pass)=>{report.interactions.push({name,pass:!!pass});if(!pass)report.failures.push(name);};
 const go=async(state,width)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:width<=900?844:1024,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://127.0.0.1:4210/attendance.html?state='+state});await wait(950);for(let i=0;i<40;i++){if(await evaluate('!!window.__attendance'))break;await wait(100);}await wait(200);};
 for(const width of (process.env.FOCUS_ONLY?[]:[1536,390])){
  await go('normal',width);
  check('single-state-and-class-scope '+width,await ui("const row=document.querySelector('[data-student-id=att-student-1]');click('迟到',row);await pause(700);const d=window.__attendance.getData();return d.attendanceRecords.find(r=>r.studentId==='att-student-1'&&r.date==='2026-09-15').status==='迟到'&&d.attendanceRecords.find(r=>r.id==='att-otherclass').status==='缺勤';"));
  check('saved-note-without-edits-retained '+width,await ui("click('保存',document.querySelector('[data-student-id=att-student-2]'));await pause(700);return window.__attendance.getData().attendanceRecords.find(r=>r.studentId==='att-student-2'&&r.date==='2026-09-15').note==='08:10到校';"));
  check('day-note-not-shared-note '+width,await ui("input('#note-att-student-1','合成当日备注验证');await pause();click('保存',document.querySelector('[data-student-id=att-student-1]'));await pause(700);const d=window.__attendance.getData();return d.attendanceRecords.find(r=>r.studentId==='att-student-1'&&r.date==='2026-09-15').note==='合成当日备注验证'&&d.students[0].note==='';"));
  check('search '+width,await ui("input('[aria-label=搜索学生]','学生08');await pause();return document.querySelectorAll('[data-student-id]').length===1&&!!document.querySelector('[data-student-id=att-student-8]');"));
  await go('selected-batch',width);
  check('batch-status-note-success-clears-selection '+width,await ui("click('应用并保存');await pause(700);const d=window.__attendance.getData();return !document.querySelector('[data-att-design=batch]')&&['att-student-1','att-student-2'].every(id=>{const r=d.attendanceRecords.find(r=>r.studentId===id&&r.date==='2026-09-15');return r.status==='请假'&&r.note==='合成：家长已联系';});"));
  await go('normal',width);
  check('batch-empty-note-preserves '+width,await ui("document.querySelector('[aria-label=选择学生02]').click();await pause();input('[aria-label=批量考勤状态]','缺勤');await pause();click('应用并保存');await pause(700);return window.__attendance.getData().attendanceRecords.find(r=>r.studentId==='att-student-2'&&r.date==='2026-09-15').note==='08:10到校';"));
  await go('history-date',width);
  check('history-no-summary-overwrite-and-departed-retained '+width,await ui("click('缺勤',document.querySelector('[data-student-id=att-student-1]'));await pause(700);const d=window.__attendance.getData();return d.students[0].attendance==='正常'&&d.attendanceRecords.some(r=>r.id==='att-departed')&&!document.querySelector('[data-student-id=departed-student]');"));
  await go('students-105',width);
  check('105-roster-page-count '+width,await ui("return document.querySelectorAll('[data-student-id]').length==="+(width===390?20:50)+";"));
  check('select-current-page '+width,await ui("click('全选本页');await pause();return window.__attendance.getState().selected.length==="+(width===390?20:50)+";"));
  check('105-pagination-last-page '+width,await ui("for(let i=0;i<"+(width===390?5:2)+";i++){click('下一页');await pause();}return !!document.querySelector('[data-student-id=att-student-105]');"));
  await go('dirty-leave',width);
  check('dirty-date-guard '+width,await ui("document.querySelector('[aria-label=前一天]').click();await pause();return window.__attendance.getState().date==='2026-09-15'&&document.body.innerText.includes('请先保存当前日期');"));
  check('dirty-navigation-guard '+width,await ui("return !window.dispatchEvent(new Event('classroom:before-navigate',{cancelable:true}));"));
  await go('save-failure',width);
  check('failed-save-preserves-local-change '+width,await ui("return window.__attendance.getState().sync==='save-failure'&&window.__attendance.getState().unsaved&&window.__attendance.getData().students[0].attendance==='迟到';"));
  check('failed-save-guards-date '+width,await ui("document.querySelector('[aria-label=前一天]').click();await pause();return window.__attendance.getState().date==='2026-09-15';"));
  check('retry-save '+width,await ui("click('迟到',document.querySelector('[data-student-id=att-student-1]'));await pause(700);return window.__attendance.getState().sync==='normal'&&!window.__attendance.getState().busy;"));
  await go('conflict-409',width);
  check('conflict-keeps-local-draft '+width,await ui("return window.__attendance.getState().sync==='conflict-409'&&window.__attendance.getState().unsaved&&document.body.innerText.includes('版本冲突');"));
  await go('readonly',width);
  check('readonly-no-writes '+width,await ui("return [...document.querySelectorAll('[data-student-id] button,[data-student-id] input')].every(e=>e.disabled);"));
  await go('normal',width);
  check('filters '+width,await ui("click('筛选');await pause();input('[aria-label=考勤状态筛选]','请假');await pause();return document.querySelectorAll('[data-student-id]').length===1&&!!document.querySelector('[data-student-id=att-student-3]');"));
  check('all-normal-affects-class-not-filter '+width,await ui("click('一键全员正常');await pause(700);return window.__attendance.getData().students.every(s=>s.attendance==='正常');"));
 }
 for(const width of (process.env.FOCUS_ONLY?[]:[1536,390])){
  await go('save-failure-empty',width);
  check('new-unsaved-calendar-date-pending '+width,await ui("if(innerWidth<=900){click('月历');await pause();}return [...document.querySelectorAll('[data-att-design=calendar] button')].some(b=>(b.getAttribute('aria-label')||'').includes('2026-09-15，本机改动待同步')&&b.textContent.includes('待同步'));"));
  check('calendar-ack-after-retry '+width,await ui("if(innerWidth<=900){click('关闭',document.querySelector('dialog[open]'));await pause();}click('迟到',document.querySelector('[data-student-id=att-student-1]'));await pause(700);if(innerWidth<=900){click('月历');await pause();}return [...document.querySelectorAll('[data-att-design=calendar] button')].some(b=>(b.getAttribute('aria-label')||'').includes('2026-09-15，1人已登记')&&!b.textContent.includes('待同步'));"));
 }
 await go('normal',390);
 check('mobile-calendar-opens-modal',await ui("[...document.querySelectorAll('button')].find(b=>b.textContent==='月历').focus();click('月历');await pause();return !!document.querySelector('dialog[open]')&&getComputedStyle(document.querySelector('dialog[open]')).backgroundColor!=='rgba(0, 0, 0, 0)';"));
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await wait(150);
 check('calendar-escape-returns-focus',await evaluate("!document.querySelector('dialog[open]')&&document.activeElement.textContent==='月历'"));
 console.log(JSON.stringify({checks:report.interactions.length,failures:report.failures,consoleErrors:report.consoleErrors.length}));if(report.failures.length||report.consoleErrors.length)process.exitCode=1;
}finally{writeFileSync(path.join(out,'interactions.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
