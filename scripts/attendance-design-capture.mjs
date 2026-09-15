import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || '.qa-shots/attendance-design/round1');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9237',`--user-data-dir=${path.resolve('.qa-shots/attendance-design/chrome')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9237/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');
 const states=(process.env.DESIGN_STATES||'normal,selected-batch,day-note,month-calendar,history-date,no-day-record,empty-class,search-empty,students-105,long-note,readonly,loading,saving,save-failure,conflict-409,dirty-leave,filters,save-failure-empty').split(',');
 const viewports=process.env.DESIGN_NARROW?[[1057,900],[360,780]]:[[1536,1024],[390,844]];
 for(const [width,height] of viewports)for(const state of states){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const url='http://127.0.0.1:4210/attendance.html?state='+state;await send('Page.navigate',{url});await wait(850);
  for(let i=0;i<50;i++){if(await evaluate('!!window.__attendance'))break;await wait(150);}
  await evaluate('document.fonts.ready.then(()=>true)');await wait(200);
  if(['month-calendar','save-failure-empty'].includes(state)&&width<=900){await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='月历')?.click()");await wait(150);}
  if(state==='filters'&&width<=900){await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='筛选')?.click()");await wait(150);}
  if(state==='long-note'){await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='展开全文')?.click()");await wait(100);}
  if(state==='dirty-leave'){await evaluate("document.querySelector('[aria-label=前一天]')?.click()");await wait(100);}
  const info=await evaluate(`(()=>{const visible=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;const regions={};for(const e of document.querySelectorAll('[data-att-design],h1,[class*=mobileHeader]')){if(!visible(e))continue;const r=e.getBoundingClientRect(),s=getComputedStyle(e);regions[e.dataset.attDesign||e.tagName]={x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,color:s.color,background:s.backgroundColor,padding:s.padding,gap:s.gap};}return{ready:!!window.__attendance,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,regions,dialogs:[...document.querySelectorAll('dialog[open]')].map(e=>e.innerText.slice(0,250)),squeezed:[...document.querySelectorAll('button')].filter(e=>visible(e)&&getComputedStyle(e).fontSize!=='0px'&&e.scrollWidth>e.clientWidth+1).map(e=>({text:e.innerText,width:e.clientWidth,scroll:e.scrollWidth})),images:[...document.images].filter(visible).map(e=>({src:e.getAttribute('src'),complete:e.complete,naturalWidth:e.naturalWidth})),font:getComputedStyle(document.body).fontFamily,state:window.__attendance.getState(),mobileTargets:[...document.querySelectorAll('[data-att-design=date] button,[data-att-design=date] input,[data-att-design=toolbar] input,[data-att-design=toolbar] button,[data-student-id] label[class*=check],[data-student-id] [class*=note] input,dialog[open] [class*=days] button')].filter(visible).map(e=>({tag:e.tagName,text:e.getAttribute('aria-label')||e.textContent.slice(0,15),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),statusTargets:[...document.querySelectorAll('[class*=statuses] button')].slice(0,4).map(e=>({text:e.textContent,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),bodyText:document.body.innerText.slice(0,90)}})()`);
  if(!info.ready||info.scrollWidth>width+1||info.squeezed.length||info.images.some(i=>!i.naturalWidth))report.failures.push({state,width,info});
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const name=width+'-'+state+'.png';const bytes=Buffer.from(shot.data,'base64');writeFileSync(path.join(out,name),bytes);
  const fixture=await evaluate("document.getElementById('attendance-design-fixture').textContent");
  report.evidence.push({stateId:state,viewport:width+'x'+height,dpr:1,url,path:name,sha256:hash(bytes),fixtureSha256:hash(fixture),font:info.font,info});
 }
 console.log(JSON.stringify({out,evidence:report.evidence.length,failures:report.failures.length,consoleErrors:report.consoleErrors.length}));
 if(report.failures.length||report.consoleErrors.length)process.exitCode=1;
}finally{writeFileSync(path.join(out,'capture.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
