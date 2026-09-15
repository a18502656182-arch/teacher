import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || 'docs/page-designs/V4/scores/screenshots/p02-feedback');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9255',`--user-data-dir=${path.resolve('.qa-shots/scores-design/interaction-chrome')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9255/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');

 const check=async(name,expression)=>{const passed=!!await evaluate(expression);report.interactions.push({name,passed});if(!passed){console.log(await evaluate('({state:window.__scores.getState(),error:window.__scores.controller.error,body:document.body.innerText.slice(-1500)})'));throw Error(name);}};
 const go=async(state,width)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:width<900?844:1024,deviceScaleFactor:1,mobile:width<900});await send('Page.navigate',{url:'http://127.0.0.1:4218/scores.html?state='+state});await wait(1100);for(let i=0;i<30;i++){if(await evaluate("!!window.__scores"))return;await wait(200);}throw Error("preview not ready");};
 const act=async(code)=>{await evaluate(`(()=>{const c=window.__scores.controller;${code}})()`);await wait(120);};
 const click=async(text)=>{await evaluate(`[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0).reverse().find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`);await wait(120);};
for(const width of [1536,390]){await go('normal',width);await evaluate("(()=>{void window.__scores.controller.toggleFollow(window.__scores.controller.students[0].id)})()");await wait(20);await check(width+' no normal pending banner',"!document.body.innerText.includes('本机改动待同步')");await wait(500);await check(width+' success visible in-place',"window.__scores.controller.exam.followUpStudentIds.includes(window.__scores.controller.students[0].id)&&[...document.querySelectorAll('[role=status]')].filter(e=>e.textContent==='改动已保存').every(e=>getComputedStyle(e).clipPath==='inset(50%)')");await go('save-failure',width);await check(width+' failure recovery retained',"document.body.innerText.includes('重试同步')&&window.__scores.controller.pending");await click('重试同步');await wait(500);await check(width+' retry completed',"!window.__scores.controller.pending");await act("c.setMessage('测试普通提示')" );await check(width+' routine message floats',"[...document.querySelectorAll('[role=status]')].some(e=>e.textContent==='测试普通提示'&&getComputedStyle(e).position==='fixed')" );await wait(2700);await check(width+' routine message dismissed',"!document.body.innerText.includes('测试普通提示')" );const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const bytes=Buffer.from(shot.data,'base64'),name=width+'-feedback.png';writeFileSync(path.join(out,name),bytes);report.evidence.push({path:name,sha256:hash(bytes)});}console.log(report.interactions);
}catch(e){report.failures.push(String(e));console.error(e);process.exitCode=1;}finally{writeFileSync(path.join(out,'feedback-checks.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
