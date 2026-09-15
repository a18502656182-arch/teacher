import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || '.qa-shots/homework-design/supplement');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9234',`--user-data-dir=${path.resolve('.qa-shots/homework-design/chrome-supplement')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9234/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');

 const ui = async code => evaluate(`(async()=>{const pause=()=>new Promise(r=>setTimeout(r,100));const visible=e=>e.getBoundingClientRect().width>0;const click=(text,root=document)=>[...root.querySelectorAll('button')].find(e=>visible(e)&&e.textContent.trim()===text)?.click();const input=(selector,value)=>{const e=document.querySelector(selector);const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));};${code}})()`);
 const check=(name,value)=>{report.interactions.push({name,pass:!!value});if(!value)report.failures.push(name);};
 const go=async(state,width)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1024,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://127.0.0.1:4208/homework.html?state='+state});await wait(800);for(let i=0;i<40;i++){if(await evaluate('!!document.querySelector("[data-module=homework]")'))break;await wait(100);}await wait(200);};

 for(const state of ['normal','mobile-detail','students-105','long-title-note']){
  const width=state==='normal'?1536:390;await go(state,width);
  if(state==='long-title-note'){
   check('long-full-content',await ui(`const d=document.querySelector('[class*=fullTitle]');d.open=true;await pause();return d.querySelector('p').textContent === JSON.parse(document.getElementById('homework-design-fixture').textContent).homeworkTasks[0].title;`));
  }
  if(state==='long-title-note'){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(path.join(out,'390-long-expanded.png'),Buffer.from(shot.data,'base64'));}
  if(width===390){
   check(state+' pager-reachable',await ui(`const nav=document.querySelector('[aria-label="学生分页"]');nav.scrollIntoView({block:'center'});await pause();const r=nav.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;`));
   if(state==='students-105')check('105 last-page',await ui(`const nav=document.querySelector('[aria-label="学生分页"]');for(let i=0;i<5;i++){click('下一页',nav);await pause();}return document.body.innerText.includes('学生105')&&nav.textContent.includes('6 / 6');`));
  }
  await send('DOM.enable');await send('CSS.enable');const root=await send('DOM.getDocument');const head=await send('DOM.querySelector',{nodeId:root.root.nodeId,selector:'[data-module=homework] h1'});const fonts=head.nodeId?(await send('CSS.getPlatformFontsForNode',{nodeId:head.nodeId})).fonts:[];
  const controls=await evaluate(`[...document.querySelectorAll('[class*=studentRow] [role=group] button')].map(e=>({height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width,font:getComputedStyle(e).font,color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor}))`);
  report.interactions.push({name:state+' measured-font-and-controls',fonts,controls});
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const name=width+'-'+state+'-scrolled.png';writeFileSync(path.join(out,name),Buffer.from(shot.data,'base64'));
  report.evidence.push({path:name,sha256:hash(Buffer.from(shot.data,'base64')),stateId:state,viewport:width+'x'+(width===390?844:1024),purpose:'scrolled pagination or full content evidence'});
  if(state==='normal'){
   const full=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:1536,height:(await send('Page.getLayoutMetrics')).cssContentSize.height,scale:1}});writeFileSync(path.join(out,'1536-full.png'),Buffer.from(full.data,'base64'));
  }
 }
 console.log(JSON.stringify({interactions:report.interactions.map(({name,pass})=>({name,pass})),failures:report.failures}));
 if(report.failures.length||report.consoleErrors.length)process.exitCode=1;
} finally {writeFileSync(path.join(out,'capture.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
