import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || '.qa-shots/health-design/supplement');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9248',`--user-data-dir=${path.resolve('.qa-shots/health-design/supplement-chrome')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9248/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');
 await send('DOM.enable');await send('CSS.enable');report.measurements=[];
 const cases=[[1536,1024,'normal','full'],[390,844,'normal','full'],[390,844,'long-record','full'],[390,844,'conflict-409','recovery'],[390,844,'students-105','last-page'],[390,844,'composer','picker'],[390,844,'contact','expanded'],[1057,900,'normal','narrow'],[360,780,'normal','narrow'],[360,780,'mobile-detail','narrow']];
 for(const [width,height,state,kind]of cases){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});await send('Page.navigate',{url:'http://127.0.0.1:4214/health.html?state='+state});await wait(1200);await evaluate('document.fonts.ready.then(()=>true)');
 if(kind==='recovery')await evaluate("(()=>{const b=[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent==='导出草稿');b.scrollIntoView({block:'center'});return b.getBoundingClientRect().top;})()");
 if(kind==='last-page'){for(let i=0;i<10;i++){await evaluate("[...document.querySelectorAll('[aria-label=照护记录分页] button')].find(b=>b.textContent==='下一页')?.click()");await wait(40);}await evaluate("document.querySelector('[aria-label=照护记录分页]').scrollIntoView({block:'center'})");}
 if(kind==='picker'){await evaluate("[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent==='搜索姓名或学号选择学生').click()");await wait(150);}
 if(kind==='expanded'){await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='查看联系人信息').click()");await wait(100);}
 const info=await evaluate(`(()=>{const result={};for(const [name,selector]of Object.entries({page:'[data-health-design]',heading:'[data-health-design] h1',search:'[aria-label=搜索学生或行动提示]',row:'[data-care-id]',detail:'[aria-label=照护详情]',toolbar:'[class*=toolbar]'})){const e=document.querySelector(selector);if(!e)continue;const r=e.getBoundingClientRect(),s=getComputedStyle(e);result[name]={x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,gap:s.gap,padding:s.padding,background:s.backgroundColor};}return{regions:result,scrollWidth:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('[data-health-design] button')].filter(e=>e.getBoundingClientRect().width>0).filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent),recovery:[...document.querySelectorAll('dialog[open] button')].filter(e=>['导出草稿','载入最新数据'].includes(e.textContent)).map(e=>({text:e.textContent,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom}))};})()`);
 const doc=await send('DOM.getDocument'),q=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'[data-health-design] h1,[data-health-design] h2'});const fonts=q.nodeId?await send('CSS.getPlatformFontsForNode',{nodeId:q.nodeId}):null;report.measurements.push({viewport:width+'x'+height,state,kind,...info,fonts});if(info.scrollWidth>width+1||info.buttons.length)report.failures.push({state,kind,info});
 const metrics=await send('Page.getLayoutMetrics'),params={format:'png',captureBeyondViewport:kind==='full'};if(kind==='full')params.clip={x:0,y:0,width,height:Math.ceil(metrics.cssContentSize.height),scale:1};const shot=await send('Page.captureScreenshot',params),bytes=Buffer.from(shot.data,'base64'),name=width+'-'+state+'-'+kind+'.png';writeFileSync(path.join(out,name),bytes);report.evidence.push({path:name,sha256:hash(bytes),viewport:width+'x'+height,stateId:state,kind,fixtureSha256:hash(await evaluate("document.getElementById('health-design-fixture').textContent"))});
 }
 console.log(JSON.stringify({count:report.evidence.length,failures:report.failures,errors:report.consoleErrors.length}));if(report.failures.length||report.consoleErrors.length)process.exitCode=1;
}finally{writeFileSync(path.join(out,'supplement.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
