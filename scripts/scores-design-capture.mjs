import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || '.qa-shots/scores-design/round1');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9254',`--user-data-dir=${path.resolve('.qa-shots/scores-design/chrome')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9254/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');
 const states=(process.env.DESIGN_STATES||'normal,mobile-detail,empty-class,no-exams,search-empty,students-105,long-subjects,mixed-max,composer,student-editor,batch,ranges,readonly,loading,saving,save-failure,save-throw,conflict-409,dirty-close,trends,long-history,analysis,paper-review,ai-failure,item-editor,item-scores').split(',');
 for(const [width,height]of (process.env.DESIGN_NARROW?[[1057,900],[360,780]]:[[1536,1024],[390,844]]))for(const state of states){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});const url='http://127.0.0.1:4218/scores.html?state='+state;await send('Page.navigate',{url});await wait(1100);for(let i=0;i<40;i++){if(await evaluate('!!window.__scores'))break;await wait(150);}await evaluate('document.fonts.ready.then(()=>true)');if(state==='filters'){await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='筛选')?.click()");await wait(100);}const info=await evaluate(`(()=>{const visible=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;return{ready:!!window.__scores,scrollWidth:document.documentElement.scrollWidth,font:getComputedStyle(document.body).fontFamily,body:document.body.innerText.slice(0,120),state:window.__scores?.getState(),squeezed:[...document.querySelectorAll('[data-scores-design] button')].filter(e=>visible(e)&&e.scrollWidth>e.clientWidth+1).map(e=>e.textContent),images:[...document.images].filter(visible).map(e=>e.naturalWidth)}})()`);if(!info.ready||info.scrollWidth>width+1||info.squeezed.length||info.images.some(v=>!v))report.failures.push({state,width,info});const fullHeight=process.env.DESIGN_FULL?await evaluate('document.documentElement.scrollHeight'):height;const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:!!process.env.DESIGN_FULL,...(process.env.DESIGN_FULL?{clip:{x:0,y:0,width,height:Math.min(fullHeight,12000),scale:1}}:{})});const bytes=Buffer.from(shot.data,'base64'),name=width+'-'+state+'.png';writeFileSync(path.join(out,name),bytes);report.evidence.push({path:name,sha256:hash(bytes),viewport:width+'x'+height,stateId:state,url,fixtureSha256:hash(await evaluate("document.getElementById('scores-design-fixture').textContent")),info});}
 console.log(JSON.stringify({out,evidence:report.evidence.length,failures:report.failures,consoleErrors:report.consoleErrors}));if(report.failures.length||report.consoleErrors.length)process.exitCode=1;
}finally{writeFileSync(path.join(out,'capture.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
