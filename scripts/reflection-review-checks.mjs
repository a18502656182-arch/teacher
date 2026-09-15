import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || 'docs/page-designs/V4/reflection/screenshots/p01-review-fixes');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9262',`--user-data-dir=${path.resolve('.qa-shots/reflection-design/interaction-chrome')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9262/json').then(r=>r.json());break;}catch{await wait(250);}}
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
 await go('legacy-library',width);await check(width+' library includes all records',"window.__reflection.controller.rows.length===10&&document.body.innerText.includes('本班全部考试记录')");
 await act("c.setQuery('合成历史原因检索证据')");await check(width+' reason search finds legacy',"window.__reflection.controller.rows.length===1&&window.__reflection.controller.rows[0].reflection.id==='legacy-reflection'");
 await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('学生09')&&b.textContent.includes('未关联'))?.click()");await wait(150);await check(width+' legacy detail opens',"document.body.innerText.includes('未关联考试的历史反思')&&!!document.querySelector('dialog[open]')");
 let shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});let bytes=Buffer.from(shot.data,'base64'),name=width+'-legacy-detail.png';writeFileSync(path.join(out,name),bytes);report.evidence.push({path:name,sha256:hash(bytes)});
 await evaluate("(()=>{const e=document.querySelector('[aria-label=关联考试]');e.value='older-exam';e.dispatchEvent(new Event('change',{bubbles:true}));})()");await wait(120);await click('关联所选考试并编辑');
 await check(width+' legacy id retained in editor',"window.__reflection.controller.draft.id==='legacy-reflection'&&window.__reflection.controller.draft.examId==='older-exam'&&window.__reflection.controller.dirty");
 await act("void c.submit('草稿')");await wait(550);await check(width+' legacy association saved once',"window.__reflection.getData().examReflections.filter(r=>r.id==='legacy-reflection').length===1&&window.__reflection.getData().examReflections.find(r=>r.id==='legacy-reflection').examId==='older-exam'");
 await evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('synthetic denial')}}});document.execCommand=()=>true");await act('void c.copy()');await check(width+' clipboard fallback success',"window.__reflection.controller.message==='已复制反思'");
 await go('mobile-editor',width);await evaluate("document.querySelector('[aria-label=班主任跟进]').scrollIntoView({block:'center'})");await wait(150);await check(width+' final field above action bar',"(()=>{const t=document.querySelector('[aria-label=班主任跟进]').getBoundingClientRect(),f=document.querySelector('form footer').getBoundingClientRect();return t.bottom<=f.top+1||window.innerWidth>900})()");
 shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});bytes=Buffer.from(shot.data,'base64');name=width+'-last-field.png';writeFileSync(path.join(out,name),bytes);report.evidence.push({path:name,sha256:hash(bytes)});
}
console.log(report.interactions);
}catch(e){report.failures.push(String(e));console.error(e);process.exitCode=1;}finally{writeFileSync(path.join(out,'review-fixes.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
