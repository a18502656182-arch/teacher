import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || 'docs/page-designs/V4/reflection/screenshots/p01-interactions');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9261',`--user-data-dir=${path.resolve('.qa-shots/reflection-design/interaction-chrome')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9261/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');

 const check=async(name,expression)=>{const passed=!!await evaluate(expression);report.interactions.push({name,passed});if(!passed){console.log(await evaluate('({state:window.__reflection.getState(),error:window.__reflection.controller.error,body:document.body.innerText.slice(-1500)})'));throw Error(name);}};
 const go=async(state,width)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:width<900?844:1024,deviceScaleFactor:1,mobile:width<900});await send('Page.navigate',{url:'http://127.0.0.1:4220/reflection.html?state='+state});await wait(1100);for(let i=0;i<30;i++){if(await evaluate("!!window.__reflection"))return;await wait(200);}throw Error("preview not ready");};
 const act=async(code)=>{await evaluate(`(()=>{const c=window.__reflection.controller;${code}})()`);await wait(120);};
 const click=async(text)=>{await evaluate(`[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0).reverse().find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`);await wait(120);};

for(const width of [1536,390]){
 await go('normal',width);
 await act("c.setField('problem','合成验证修改')");
 // The dirty guard is checked after React has rendered the edit.
 await act("c.chooseStudent(c.students[2].id)");
 await check(width+' dirty context guard','window.__reflection.controller.confirm');
 await act('c.setConfirm(false)');
 await check(width+' cancel keeps draft',"window.__reflection.controller.draft.problem==='合成验证修改'");
 await act("void c.submit('已完成')");await wait(550);
 await check(width+' completed saved',"window.__reflection.controller.existing.status==='已完成'&&!window.__reflection.controller.pending&&!window.__reflection.controller.dirty");
 const count=await evaluate('window.__reflection.getData().records.length');await act("void c.submit('已完成')");await wait(550);
 await check(width+' repeated archive idempotent','window.__reflection.getData().records.length==='+count);
 await act("c.setField('problem','')");await act("void c.submit('草稿')");await check(width+' empty problem blocked',"window.__reflection.controller.error.includes('主要问题')");
 await go('normal',width);await act("c.setQuery('无此学生')");await check(width+' search empty hides unrelated editor',"!document.querySelector('textarea')&&document.body.innerText.includes('没有找到学生')");
 for(const state of ['save-failure','save-throw']){await go(state,width);await check(width+' '+state+' retains draft',"window.__reflection.controller.pending&&!window.__reflection.controller.busy&&document.body.innerText.includes('重试同步')");const n=await evaluate('window.__reflection.getData().records.length');await act('void c.sync()');await wait(550);await check(width+' '+state+' retry saves once','!window.__reflection.controller.pending&&window.__reflection.getData().records.length==='+n);}
 await go('conflict-409',width);await check(width+' conflict recovery',"window.__reflection.controller.pending&&document.body.innerText.includes('导出草稿')&&document.body.innerText.includes('载入最新数据')");
 await go('readonly',width);await check(width+' readonly inputs disabled',"[...document.querySelectorAll('textarea')].length===5&&[...document.querySelectorAll('textarea')].every(e=>e.disabled)");
 await go('normal',width);await act("c.setField('problem','保存草稿验证')");await act("void c.submit('草稿')");await check(width+' saving no normal pending banner',"!document.body.innerText.includes('本机反思尚未同步')");await wait(550);await check(width+' save completed in-place',"window.__reflection.controller.saved&&document.body.innerText.includes('已保存')");
}
console.log(report.interactions);
}catch(e){report.failures.push(String(e));console.error(e);process.exitCode=1;}finally{writeFileSync(path.join(out,'interactions.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
