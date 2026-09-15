import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || 'docs/page-designs/V4/reflection/screenshots/p02-proof');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9265',`--user-data-dir=${path.resolve('.qa-shots/reflection-design/p02-proof-chrome')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9265/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');

 const check=async(name,expression)=>{const passed=await evaluate(`Boolean(${expression})`);report.interactions.push({name,passed});if(!passed){console.log(await evaluate('({state:window.__reflection.getState(),error:window.__reflection.controller.error,body:document.body.innerText.slice(-1500)})'));report.failures.push(name);process.exitCode=1;}};
 const go=async(state,width)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:width<900?844:1024,deviceScaleFactor:1,mobile:width<900});await send('Page.navigate',{url:'http://127.0.0.1:4220/reflection.html?state='+state});await wait(1100);for(let i=0;i<30;i++){if(await evaluate("!!window.__reflection"))return;await wait(200);}throw Error("preview not ready");};
 const act=async(code)=>{await evaluate(`(()=>{const c=window.__reflection.controller;${code}})()`);await wait(120);};
 const click=async(text)=>{await evaluate(`[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0).reverse().find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`);await wait(120);};



const shot=async(name,width,height)=>{const bytes=Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64');writeFileSync(path.join(out,name+'.png'),bytes);report.evidence.push({path:name+'.png',sha256:hash(bytes),viewport:width+'x'+height,url:await evaluate('location.href'),fixtureSha256:hash(await evaluate("document.getElementById('reflection-design-fixture').textContent"))});};
for(const width of [1536,390,360,920,1057]){
 const height=width<900?844:1024;
 await go('saved-library',width);
 await check(width+' no horizontal overflow','document.documentElement.scrollWidth<='+width);
 await evaluate("document.querySelector('[aria-label=已保存反思分页]').scrollIntoView({block:'end'});document.scrollingElement.scrollTop=document.scrollingElement.scrollHeight;for(const e of document.querySelectorAll('*'))if(['auto','scroll'].includes(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight)e.scrollTop=e.scrollHeight");await wait(150);
 await shot(width+'-library-bottom',width,height);
 await go('saved-long-detail',width);
 await evaluate("document.querySelector('article[aria-label=已保存反思详情] footer').scrollIntoView({block:'end'});document.scrollingElement.scrollTop=document.scrollingElement.scrollHeight;for(const e of document.querySelectorAll('*'))if(['auto','scroll'].includes(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight)e.scrollTop=e.scrollHeight");await wait(150);
 await check(width+' final reading text clear of fixed actions', "(()=>{const footer=document.querySelector('article footer');const buttons=[...document.querySelectorAll('button')];const button=buttons.find(b=>b.textContent==='编辑反思');const last=footer.previousElementSibling.lastElementChild.querySelector('p');return last.getBoundingClientRect().bottom<=(innerWidth<900?button.getBoundingClientRect().top:innerHeight);})()");
 await shot(width+'-detail-bottom',width,height);
 await go('saved-detail',width);await click('编辑反思');
 await check(width+' saved editor keeps five inputs',"document.querySelectorAll('textarea').length===5");
 await shot(width+'-saved-editor',width,height);
 await evaluate("document.querySelector('textarea[aria-label=班主任跟进]').scrollIntoView({block:'center'})");await wait(150);
 await shot(width+'-editor-bottom',width,height);
}
console.log(report.interactions);
}catch(e){report.failures.push(String(e));console.error(e);process.exitCode=1;}finally{writeFileSync(path.join(out,'interactions.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
