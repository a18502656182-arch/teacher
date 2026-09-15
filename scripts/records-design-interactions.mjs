import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || '.qa-shots/records-design/interactions');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9251',`--user-data-dir=${path.resolve('.qa-shots/records-design/interaction-chrome')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9251/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');

 const check=async(name,expression)=>{const passed=!!await evaluate(expression);report.interactions.push({name,passed});if(!passed)throw Error(name);};
 const go=async(state,width)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:width<900?844:1024,deviceScaleFactor:1,mobile:width<900});await send('Page.navigate',{url:'http://127.0.0.1:4216/records.html?state='+state});await wait(1200);};
 const act=async(code)=>{await evaluate(`(()=>{const c=window.__records.controller;${code}})()`);await wait(150);};
 const click=async(text)=>{await evaluate(`[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0).reverse().find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`);await wait(150);};
 for(const width of [1536,390]){
 await go('normal',width);await check(width+' normal list',"document.querySelectorAll('[data-record-id]').length===3");
 await act("c.setQuery('阅读作业')");await check(width+' search',"document.querySelectorAll('[data-record-id]').length===1");await act("c.reset();c.setStatus('已跟进')");await check(width+' status filter',"document.querySelectorAll('[data-record-id]').length===1");
 await go('students-105',width);await check(width+' pagination10',"document.querySelectorAll('[data-record-id]').length===10");await act('c.setPage(11)');await check(width+' final page5',"document.querySelectorAll('[data-record-id]').length===5");
 await go('normal',width);await act('c.setDetailId(c.records[0].id)');await check(width+' detail accessible',"[...document.querySelectorAll('dialog[open]')].some(d=>d.innerText.includes('下一步跟进'))");await act("return c.changeStatus(c.records[0],'已归档')");await check(width+' detail live status',"document.querySelector('[aria-label=修改沟通状态]').value==='已归档'");
 await go('composer',width);await click('保存记录');await check(width+' validation no mutation',"window.__records.getData().records.length===3&&!!document.querySelector('[role=alert]')");await act("c.setEditor({...c.editor,value:{...c.editor.value,content:'合成未保存事实'}})");await click('取消');await check(width+' dirty guard',"window.__records.controller.confirmClose");await click('放弃改动');await check(width+' discard',"!window.__records.controller.editor");
 await go('legacy',width);await act('c.openRecord(c.records[0])');await check(width+' legacy time',"document.querySelector('[aria-label=沟通时间]').value==='开学第二周 周三'");await act("c.setEditor({...c.editor,value:{...c.editor.value,content:'保留字面｜沟通内容：分隔符'}})");await click('保存记录');await wait(500);await check(width+' linked record preserved',"window.__records.getData().records[0].reflectionId==='synthetic-reflection'&&window.__records.getData().records[0].content.endsWith('保留字面｜沟通内容：分隔符')&&window.__records.getData().records.length===3");
 for(const state of ['save-failure','save-throw']){await go(state,width);await check(width+' '+state+' pending one mutation',"!!window.__records.controller.pending&&!window.__records.controller.busy&&window.__records.getData().records.length===4");await click('重试同步');await wait(500);await check(width+' '+state+' unique recovery',"!window.__records.controller.pending&&!window.__records.controller.editor&&window.__records.getData().records.length===4");}
 await go('normal',width);await act('c.openNotice()');await act("c.setEditor({...c.editor,value:{...c.editor.value,title:'合成通知',content:'请确认时间',recipientStudentIds:c.students.slice(0,2).map(s=>s.id)}})");await click('保存草稿');await wait(500);await check(width+' create multiple recipients',"window.__records.getData().notificationDrafts.length===3&&window.__records.getData().notificationDrafts[0].recipientStudentIds.length===2");
 await act('c.openReceipt(c.notices[0])');await click('保存回执');await wait(500);await check(width+' empty receipt legacy rule',"window.__records.getData().notificationDrafts[0].receiptNote==='已确认知晓'");
 await evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}})");await act('return c.copyNotice(c.notices[0])');await check(width+' copy preserves receipt',"window.__records.getData().notificationDrafts[0].status==='已复制'&&window.__records.getData().notificationDrafts[0].receiptNote==='已确认知晓'");
 await evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('synthetic')}}});document.execCommand=()=>false");await act('return c.copyNotice(c.notices[1])');await check(width+' failed clipboard no status mutation',"window.__records.getData().notificationDrafts[1].status==='草稿'");
 await act("c.setDeleteTarget({kind:'record',id:c.records[0].id,title:'合成记录'})");await click('取消删除');await check(width+' delete cancel',"window.__records.getData().records.length===3");await act("c.setDeleteTarget({kind:'record',id:c.records[0].id,title:'合成记录'})");await click('确认删除');await wait(500);await check(width+' delete confirm',"window.__records.getData().records.length===2");
 await go('readonly',width);await act('c.openRecord();c.openNotice()');await check(width+' readonly',"!window.__records.controller.editor&&window.__records.getData().records.length===3");
 await go('conflict-409',width);await click('重试同步');await wait(500);await check(width+' 409 stays recoverable',"!!window.__records.controller.pending&&!window.__records.controller.busy&&window.__records.getData().records.length===4");await check(width+' navigation guarded',"!window.dispatchEvent(new Event('classroom:before-navigate',{cancelable:true}))");
 }
 console.log(JSON.stringify({checks:report.interactions.length,failed:report.interactions.filter(x=>!x.passed),consoleErrors:report.consoleErrors}));
}catch(e){report.failures.push(String(e));console.error(e);process.exitCode=1;}finally{writeFileSync(path.join(out,'interactions.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
