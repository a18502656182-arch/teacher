import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || 'docs/page-designs/V3/health/screenshots/source');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9245',`--user-data-dir=${path.resolve('.qa-shots/health-source/chrome')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9245/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');
 for(const [width,height,detail] of [[1536,1024,false],[390,844,false]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});const url='http://127.0.0.1:4213/health-source.html'+(detail?'?detail=1':'');await send('Page.navigate',{url});await wait(5000);await evaluate('document.fonts.ready.then(()=>true)');const body=await evaluate('document.body.innerText');if(!body.includes('照护'))throw new Error(body.slice(0,1000));const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const bytes=Buffer.from(shot.data,'base64');const name=width+(detail?'-detail':'-normal')+'.png';writeFileSync(path.join(out,name),bytes);report.evidence.push({path:name,sha256:hash(bytes),viewport:width+'x'+height,url,bodyText:body});}console.log(JSON.stringify({evidence:report.evidence.length,errors:report.consoleErrors}));}finally{writeFileSync(path.join(out,'capture.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}