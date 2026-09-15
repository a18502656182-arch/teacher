import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || '.qa-shots/homework-design/interactions');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9233',`--user-data-dir=${path.resolve('.qa-shots/homework-design/chrome-interactions')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9233/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');

 const ui = async code => evaluate(`(async()=>{const pause=()=>new Promise(r=>setTimeout(r,100));const visible=e=>e.getBoundingClientRect().width>0;const click=(text,root=document)=>[...root.querySelectorAll('button')].find(e=>visible(e)&&e.textContent.trim()===text)?.click();const input=(selector,value)=>{const e=document.querySelector(selector);const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));};${code}})()`);
 const check=(name,value)=>{report.interactions.push({name,pass:!!value});if(!value)report.failures.push(name);};
 const go=async(state,width)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1024,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://127.0.0.1:4208/homework.html?state='+state});await wait(800);for(let i=0;i<40;i++){if(await evaluate('!!document.querySelector("[data-module=homework]")'))break;await wait(100);}await wait(200);};
 for(const width of [1536,390]) {
  await go(width===390?'mobile-detail':'normal',width);
  check('four-state '+width,await ui(`const row=document.querySelector('[data-status="未交"][class*=studentRow]');click('已复查',row);await pause();return row.dataset.status==='已复查'&&row.querySelector('[aria-pressed=true]').textContent==='已复查';`));
  check('shared-note '+width,await ui(`input('[id$="homework-note-hw-student-1"]','合成公共备注验证');await pause();click('返回作业列表');await pause();document.querySelector('[aria-label="作业任务列表"] button').click();await pause();return document.querySelector('[id$="homework-note-hw-student-1"]').value==='合成公共备注验证';`));
  check('student-pagination '+width,await ui(`const nav=document.querySelector('[aria-label="学生分页"]');click('下一页',nav);await pause();return document.body.innerText.includes('学生21');`));
  check('search '+width,await ui(`input('[id$="homework-student-query"]','学生08');await pause();return document.body.innerText.includes('显示 1 / 1 人');`));
  check('bulk '+width,await ui(`document.querySelector('[class*=studentRow] input[type=checkbox]').click();await pause();click('批量改状态');await pause();click('设为待订正');await pause();return document.querySelector('[class*=studentRow]').dataset.status==='待订正'&&!document.querySelector('[aria-label="批量操作"]');`));
  check('follow-add '+width,await ui(`document.querySelector('[class*=studentRow] input[type=checkbox]').click();await pause();click('加入待跟进');await pause();return [...document.querySelectorAll('dialog[open]')].some(d=>d.innerText.includes('待跟进名单')&&d.innerText.includes('学生08'));`));
  check('copy-feedback '+width,await ui(`click('复制名单');await new Promise(r=>setTimeout(r,400));return /已复制|浏览器未允许复制/.test(document.body.innerText);`));
  check('follow-remove '+width,await ui(`const ds=[...document.querySelectorAll('dialog[open]')];click('移出',ds[ds.length-1]);await pause();return document.body.innerText.includes('暂无待跟进学生');`));
  await go('normal',width);
  check('validation '+width,await ui(`click('新增作业');await pause();click('新增作业',document.querySelector('dialog[open]'));await pause();return document.body.innerText.includes('请填写学科');`));
  check('dirty-cancel '+width,await ui(`input('#homework-editor-subject','合成学科');await pause();click('取消',document.querySelector('dialog[open]'));await pause();return document.body.innerText.includes('放弃这次作业编辑');`));
  await go('normal',width);
  check('create-task '+width,await ui(`click('新增作业');await pause();input('#homework-editor-subject','合成学科');input('#homework-editor-title','合成新增任务验证');await pause();click('新增作业',document.querySelector('dialog[open]'));await pause();return document.body.innerText.includes('找到 4 项');`));
  await go('delete-confirm',width);
  check('delete-cancel '+width,await ui(`click('取消',document.querySelector('dialog[open]'));await pause();return document.body.innerText.includes('找到 3 项');`));
  await go('delete-confirm',width);
  check('delete-confirm '+width,await ui(`click('确认删除',document.querySelector('dialog[open]'));await pause();return document.body.innerText.includes('找到 2 项');`));
  await go('readonly',width);
  if(width===390)await ui(`document.querySelector('[aria-label="作业任务列表"] button').click();await pause();`);
  check('readonly '+width,await ui(`return [...document.querySelectorAll('[class*=studentRow] [role=group] button,[class*=studentRow] textarea')].every(e=>e.disabled);`));
  await go('tasks-30',width);
  check('task-pagination '+width,await ui(`click('下一页',document.querySelector('[aria-label="作业任务分页"]'));await pause();return document.querySelector('[aria-label="作业任务分页"]').textContent.includes('2 / 3');`));
 }
 console.log(JSON.stringify({interactions:report.interactions,failures:report.failures}));
 if(report.failures.length||report.consoleErrors.length)process.exitCode=1;
} finally {writeFileSync(path.join(out,'capture.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
