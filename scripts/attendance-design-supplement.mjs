import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || '.qa-shots/attendance-design/supplement');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9239',`--user-data-dir=${path.resolve('.qa-shots/attendance-design/chrome-supplement')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9239/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');
 for(const [width,height] of [[1536,1024],[390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  for(const state of ['normal','students-105','long-note']){
   await send('Page.navigate',{url:'http://127.0.0.1:4210/attendance.html?state='+state});await wait(1100);await evaluate('document.fonts.ready.then(()=>true)');
   if(state==='students-105'){await evaluate(`(async()=>{for(let i=0;i<${width===390?5:2};i++){[...document.querySelectorAll('button')].find(b=>b.textContent==='下一页')?.click();await new Promise(r=>setTimeout(r,100));}document.querySelector('[data-att-design=list]').scrollTop=99999;window.scrollTo(0,0);})()`);}
   if(state==='long-note'){await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='展开全文')?.click()");await wait(100);}
   await send('DOM.enable');await send('CSS.enable');const doc=await send('DOM.getDocument');const node=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:width>900?'[data-att-design=heading] h1':'[data-student-id] strong'});const fonts=node.nodeId?(await send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId})).fonts:[];
   const bounds=await evaluate('({body:document.body.getBoundingClientRect().height,scroll:document.documentElement.scrollHeight})'); const layout=await send('Page.getLayoutMetrics');const size=layout.cssContentSize||layout.contentSize;
   const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:Math.min(width,size.width),height:Math.min(6000,size.height),scale:1}});
   const name=width+'-'+state+'-full.png';const bytes=Buffer.from(shot.data,'base64');writeFileSync(path.join(out,name),bytes);
   report.evidence.push({stateId:state+'-full',viewport:width+'x'+height,path:name,sha256:hash(bytes),platformFonts:fonts,bounds,contentSize:size,fixtureSha256:hash(await evaluate("document.getElementById('attendance-design-fixture').textContent"))});
  }
 }
 console.log(JSON.stringify({evidence:report.evidence.length,consoleErrors:report.consoleErrors.length}));
}finally{writeFileSync(path.join(out,'supplement.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
